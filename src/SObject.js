import _ from 'lodash';
import { validate, validateAsync } from 'parameter-validator';
import { ParameterValidationError } from 'parameter-validator';
import { ResourceNotFoundError, NotImplementedError } from './errors';
import convertPropertyNames from './convertPropertyNames';
import LeftInnerJoinRelationship from './LeftInnerJoinRelationship';
import MockLogger from './MockLogger';

const DEFAULT_API_VERSION = '34.0';

/**
* Allows queries and CRUD operations to be performed on a SalesForce SObject with minimal setup and a friendly API.
*
* Simply give it the SObject's name (e.g. `Account`) and a `propertyMap` which defines friendly names for the properties
* in which you're interested (e.g. `{ primaryContactName: 'Primary_Contact__r.Name' }`). Now you can query and update records
* using the friendly names, and this class takes care of the conversion to and from the SalesForce format.
*
* To use this class, either extend it to override its `objectName` and `propertyMap` properties, or simply create an
* instance by passing those properties into this class's constructor. Either approach will allow you to use the default
* implementations of the CRUD methods (e.g. `query()`, `insert()`, etc.) which automatically handle the property name conversion.
*/
class SObject {

    /**
    * @param {object}               options
    * @param {SalesForceConnection} options.connection          - Either an instance of this module's default `SalesForceConnection`
    *                                                             class or a custom version which implements that simple interface.
    * @param {string}               [options.objectName]        - Allows the `objectName` to be defined without
    *                                                             creating a subclass to override that property.
    * @param {object}               [options.propertyMap]       - Allows the `propertyMap` to be defined without
    *                                                             creating a subclass to override that property.
    * @param {int|float|string}     [options.apiVersion='34.0'] - e.g. `'30.0'`, `31`, `32.0`
    * @param {Object}               [options.logger]            - Optional Winston-style logger for capturing log output.
    */
    constructor(options) {

        validate(options, [ 'connection' ], this, { addPrefix: '_' });
        this._objectName = options.objectName || options.salesForceObjectName; // Respect the legacy `salesForceObjectName` option.
        this._propertyMap = options.propertyMap;
        this._logger = options.logger || new MockLogger();
        this._apiVersion = DEFAULT_API_VERSION;

        if (options.apiVersion) {

            let versionNumber = Number.parseFloat(options.apiVersion);
            if (isNaN(versionNumber)) {
                throw new ParameterValidationError(`Provided version number '${versionNumber} is not a number.'`);
            }
            this._apiVersion = versionNumber.toFixed(1).toString();
        }

        // An alias for convertPropertyNames, saved as an instance method to facilitate spying in unit tests.
        this._convertPropertyNames = convertPropertyNames;
    }

    /**
    * Override this class to specify your SObject's name, including any required prefixes and suffixes.
    *
    * @example
    * get objectName() {
    *     return 'Order__c'
    * }
    *
    * @type {string}
    */
    get objectName() {

        if (this._objectName) { return this._objectName; }
        // Respect the legacy `salesForceObjectName` property if it is overridden.
        if (this.salesForceObjectName) { return this.salesForceObjectName; }
        return new NotImplementedError();
    }

    /**
    * Defines friendly (i.e. camelCase) names for your SObject's SalesForce property names, which are often
    * riddled with suffixes, prefixes, and underscores. Nested SalesForce objects are also supported (e.g. `'Contact.Customer_Rep__r.Name'`).
    *
    * Override this property to define your SObject's properties. If you instead need the property map to be dynamic
    * and determined asynchronously (for example, if you need to check a feature toggle to determine which properties
    * should be included), then override the asynchronous `getPropertyMap()` method instead.
    *
    * @example
    * get propertyMap() {
    *     return {
    *         name: 'Name',
    *         primaryContactEmail: 'Primary_Contact__r.Email__c'
    *     };
    * }
    *
    * @type {Object}
    */
    get propertyMap() {

        if (this._propertyMap) {
            return this._propertyMap;
        }
        throw new NotImplementedError();
    }

    /**
    * Defines friendly (i.e. camelCase) names for your SObject's SalesForce property names, which are often
    * riddled with suffixes, prefixes, and underscores. Nested SalesForce objects are also supported (e.g. `'Contact.Customer_Rep__r.Name'`).
    *
    * In most use cases, a property map is static, so it's easiest to override `propertyMap` to define your
    * SObject's properties. If you instead need the property map to be *dynamic* and determined asynchronously
    * (for example, if you need to check a feature toggle to determine whether a property should be included),
    * then override this asynchronous method instead. This can be useful, for example, for managing deployments.
    * Since `query()` and `get()` query for all the properties defined in the property map, the property map
    * can't contain any properties that haven't been defined in SalesForce (i.e. haven't been deployed yet).
    *
    * @example
    * getPropertyMap() {
    *
    *    let propertyMap = {
    *        name: 'Name',
    *        // ...
    *    };
    *    return checkMyFeatureToggle()
    *    .then(emailPropertyEnabled => {
    *
    *        if (emailPropertyEnabled) {
    *            propertyMap.primaryContactEmail = 'Primary_Contact__r.Email__c';
    *        }
    *        return propertyMap;
    *    });
    * }
    *
    * @returns {Promise.<Object>}
    */
    getPropertyMap() {

        return Promise.resolve(this.propertyMap);
    }


    /**
    * Fetches a single object matching the property or combination of properties provided. If multiple
    * entities match the given options, then the first is returned. If there are no matches, a
    * `ResourceNotFoundError` is thrown. Use `query()` instead if you want greater than or less than 1 result.
    *
    * @param   {Object} options - Names and values of properties that will be ANDed together for the search
    * @returns {Promise.<Object>}
    * @throws  {ResourceNotFoundError}
    */
    get(options) {

        return this.getPropertyNames()
        .then(propertyNames => {
            // Validate that a value was provided for at least one property.
            validate(options, [ propertyNames ]);

            // Perform a query and return the first result. A query is performed instead of fetching the entity
            // directly by ID for two reasons: 1) it allows the entity to be looked up by other properties and
            // 2) fetching the entity directly by ID won't grab nested entities that may be defined in the property
            // map (e.g. user.profile.name).
            return this.query(options);
        })
        .then(results => {
            if (results.length) {
                return results[0];
            }
            throw new this.resourceNotFoundErrorClass(`No ${this.objectName} found for the properties: ${JSON.stringify(options)}`);
        })
        .catch(error => this._updateAndThrow(error, {options, method: 'get'}));
    }

    /**
    * Queries for entities matching the given search properties. If no options are provided, all entities are returned.
    *
    * @param   {object} [options] - Names and values of properties that will be ANDed together for the search
    * @returns {Promise.<Array.<Object>>}
    */
    query(options) {
        return this.buildQueryStatement(options)
        .then(query => this.executeQuery(query))
        .then(results => this.convertArrayFromSalesForceFormat(results))
        .catch(error => this._updateAndThrow(error, {options, method: 'query'}));
    }

    /**
    * Inserts the given entity.
    *
    * @param   {Object} entity
    * @returns {Promise.<Object>} - Object with an `id` property indicating the ID of the created entity.
    */
    insert(entity) {
        return this.convertToSalesForceFormat(entity)
        .then(formattedEntity => this._request(this.getInsertRequestOptions(formattedEntity)))
        .then(response => _.pick(response, [ 'id' ]))
        .catch(error => this._updateAndThrow(error, {entity, method: 'insert'}));
    }

    /**
    * Patches an entity by updating only the properties specified.
    *
    * @param   {Object} entity
    * @param   {string} entity.id  - An `id` property is required for updates.
    * @param   {*}      entity.*   - Properties with which to patch the existing entity.
    * @returns {Object} result     - Object with an `id` property indicating the ID of the updated entity.
    */
    update(entity) {

        return validateAsync(entity, [ 'id' ])
        .then(({ id }) => {

            entity = _.cloneDeep(entity);
            let returnValue = { id };
            // SalesForce doesn't allow the ID in the request body for requests to
            // their data services API.
            delete entity.id;

            if (Object.keys(entity).length === 0) {
                // No properties were specified to update, so don't bother sending a request to SalesForce.
                return returnValue;
            }
            return this.convertToSalesForceFormat(entity)
            .then(formattedEntity => this._request({
                url: this._objectUrlPath + id,
                method: 'patch',
                json: formattedEntity
            }))
            .then(() => returnValue);
        })
        .catch(error => this._updateAndThrow(error, { entity, method: 'update' }));
    }

    /**
    * Deletes the given entity entity.
    *
    * @param   {Object} options
    * @param   {string} options.id - An `id` property is required for deletion.
    * @returns {Promise.<Object>}  - Object with an `id` property indicating the ID of the deleted entity.
    */
    delete(options) {

        return validateAsync(options, [ 'id' ])
        .then(({ id }) => this._request({
            url: this._objectUrlPath + id,
            method: 'delete',
            json: true
        }))
        .then(() => ({ id: options.id }))
        .catch(error => this._updateAndThrow(error, { options, method: 'delete' }));
    }

    /**
    * Like `getPropertyMap`, but the reverse - mapping ugly SalesForce property names of
    * properties to their friendly names.
    *
    * Unlike `getPropertyMap`, which can include both basic name-to-name mappings and more complex
    * relationship type objects (i.e. `LeftInnerJoinRelationship`), reversePropertyMap only includes
    * basic name-to-name mappings.
    *
    * @returns {Promise.<Object>}
    */
    getReversePropertyMap() {

        return this.getPropertyMap()
        .then(propertyMap => {

            let reverseMap = {};

            for (let key in propertyMap) {
                let value = propertyMap[key];

                // Omit objects used to define more complex relationship types (e.g. LeftInnerJoinRelationship)
                if (typeof value === 'string') {
                    reverseMap[value] = key;
                }
            }
            return reverseMap;
        });
    }

    /**
    * Returns the 'friendly' property names for the properties.
    *
    * @returns {Promise.<Array.<string>>}
    */
    getPropertyNames() {

        return this.getPropertyMap()
        .then(propertyMap => Object.keys(propertyMap).sort());
    }

    /**
    * Returns the SalesForce property names defined for the SObject.
    *
    * @returns {Promise.<Array.<string>>} The SalesForce property names.
    */
    getSalesForcePropertyNames() {

        return this.getReversePropertyMap()
        .then(propertyMap => Object.keys(propertyMap).sort());
    }

    /**
    * Transforms the property names of the entity according to the property map.
    * You can override this method if you want to do additional or different formatting.
    *
    * @param   {Object}           entity
    * @returns {Promise.<Object>}
    */
    convertFromSalesForceFormat(entity) {

        return Promise.all([
            this.getReversePropertyMap(),
            this.getPropertyNames()
        ])
        .then(([ reversePropertyMap, propertyNames ]) => {

            let convertedEntity = this._convertPropertyNames(entity, reversePropertyMap);
            return _.pick(convertedEntity, propertyNames);
        });
    }

    /**
    * Acts as a customization point for insert requests. A subclass can override this method
    * to supply additional options that will be passed to `connection.request()` for an insert, like headers.
    *
    * @example
    * // Adds the 'Sforce-Auto-Assign' header to prevent SalesForce from assigning a newly inserted
    * // lead to the default user.
    * getInsertRequestOptions(...args) {
    *     let params = super.getInsertRequestOptions(...args);
    *     if (!params.headers) { params.headers = {}; }
    *     params.headers['Sforce-Auto-Assign'] = 'FALSE';
    *     return params;
    * }
    *
    * @param {Object} options - Options that will be passed to `connection.request()` for an insert
    */
    getInsertRequestOptions(options) {
        return {
            url: this._objectUrlPath,
            method: 'post',
            json: options
        };
    }

    /**
    * Converts an array of entities from their ugly SalesForce format to their friendly format.
    *
    * @param   {Array.<Object>} entities
    * @returns {Promise.<Array.<Object>>}
    */
    convertArrayFromSalesForceFormat(entities) {
        return Promise.resolve().then(() => {
            if (!Array.isArray(entities)) {
                throw new ParameterValidationError(`First argument must be an array, but instead received a ${typeof entities}: ${JSON.stringify(entities)}`);
            }
            return Promise.all(entities.map(entity => this.convertFromSalesForceFormat(entity)));
        });
    }

    /**
    * Transforms the property names of the given entity according to the property map and
    * removes properties not included in the map.
    *
    * @param   {Object}   entity
    * @param   {Object}   options
    * @param   {boolean}  [options.includeAttributesProperty] - When we get deserialized SObjects from the REST data API,
    *                                                           each entity has an 'attributes' property containing the name
    *                                                           of its SObject type and its URL. This parameter optionally
    *                                                           includes this 'attributes' property so that the resulting object
    *                                                           is in a format that can be deserialized back into a native
    *                                                           SObject in Apex code.
    * @param   {boolean}  [options.includeNestedProperties]   - Used to optionally allow nested properties in the output (disabled
    *                                                           by default).
    * @returns {Promise.<Object>}
    */
    convertToSalesForceFormat(entity, { includeAttributesProperty = false, includeNestedProperties = false } = {}) {

        return Promise.all([
            this.getPropertyMap(),
            this.getReversePropertyMap()
        ])
        .then(([ propertyMap, reversePropertyMap ]) => {

            // In most cases, propertyMap's values are strings which indicate a basic name-to-name mapping.
            // However, a value can also be an object which defines a more complex relationship used only for `query` and `get`
            // (e.g. LeftInnerJoinRelationship). We want to omit those complex property definitions here so that the values passed
            // to convertPropertyNames are just strings.
            for (let key in propertyMap) {
                let value = propertyMap[key];
                if (typeof value !== 'string') {
                    delete propertyMap[key];
                }
            }

            let convertedEntity = this._convertPropertyNames(entity, propertyMap);

            for (let propertyName of Object.keys(convertedEntity)) {

                let isNestedProperty = propertyName.includes('.');

                // Dont' include the property if it's not defined in this class's reverse property map,
                // its value is undefined, or if it's a nested property and nested properties
                // aren't to be included.
                let value = convertedEntity[propertyName];
                if (!reversePropertyMap[propertyName] ||
                    value === undefined ||
                    (isNestedProperty && !includeNestedProperties)) {
                    delete convertedEntity[propertyName];
                }
            }
            if (includeAttributesProperty) {
                convertedEntity.attributes = {type: this.objectName};
            }
            return convertedEntity;
        });
    }

    /**
    * Converts an array of entities from their frienly format to their ugly SalesForce format.
    *
    * @param   {Array.<Object>} entities
    * @returns {Promise.<Array.<Object>>}
    */
    convertArrayToSalesForceFormat(entities) {
        return Promise.resolve().then(() => {
            if (!Array.isArray(entities)) {
                throw new ParameterValidationError(`First argument must be an array, but instead received a ${typeof entities}: ${JSON.stringify(entities)}`);
            }
            return Promise.all(entities.map(entity => this.convertToSalesForceFormat(entity, { includeAttributesProperty: true })));
        });
    }

    /**
    * A subclass can override this to provide a different class to use instead of the default ResourceNotFoundError.
    * @private
    */
    get resourceNotFoundErrorClass() {

        return ResourceNotFoundError;
    }

    get _dataServicesUrlPath() {

        return `services/data/v${this._apiVersion}/`;
    }

    get _objectUrlPath() {

        return this._dataServicesUrlPath + `sobjects/${this.objectName}/`;
    }

    get _queryUrlPath() {

        return this._dataServicesUrlPath + 'query';
    }

    /**
    * Builds a SOQL query from the given query options.
    *
    * @param   {Object}           options - Query options, which are the friendly names and values that the query results will match.
    * @returns {Promise.<string>}
    */
    buildQueryStatement(options) {

        return Promise.all([
            this._buildQueryPredicate(options),
            this.getSalesForcePropertyNames()
        ])
        .then(([ predicate, salesForcePropertyNames ]) => {
            return  `SELECT ${salesForcePropertyNames.join(', ')} FROM ${this.objectName} ${predicate} ORDER BY CreatedDate DESC`;
        });
    }

    /**
    * Returns all results for the given SOQL query.
    *
    * @param   {string} query    - SOQL query
    * @returns {Array.<Objects>} - Results in SalesForce format.
    */
    executeQuery(query) {

        return this._request({
            url: this._queryUrlPath,
            method: 'get',
            json: true,
            qs: { q: query }
        })
        .then(response => this._getRemainingQueryRecords(response));
    }

    _updateAndThrow(error, data = {}) {

        Object.assign(data, {
            'SObject type': this.objectName,
            message: error.message,
            stack: error.stack
        });
        this._logger.error('Error in Salesforce request', data);
        throw error;
    }

    /**
    * Builds the SOQL query predicate for query().
    *
    * @param {Object} options - query options
    * @private
    */
    _buildQueryPredicate(options) {

        if (!options || !Object.keys(options).length) {
            return Promise.resolve('');
        }

        return Promise.all([
            this._getBasicQueryComparisons(options),
            this._getComplexQueryComparisons(options)
        ])
        .then(([ basicQueryComparisons, complexQueryComparisons ]) => {

            let queryComparisons = [ ...basicQueryComparisons, ...complexQueryComparisons ];
            return `WHERE ${queryComparisons.join(' AND ')}`;
        });
    }

    /**
    * Gets the query comparisons (e.g. [ 'firstName = \'Paula\'', 'age = 30' ]) for basic relationships (i.e. not complex joins).
    *
    * @param {Object} options - query options
    * @private
    */
    _getBasicQueryComparisons(options) {

        return this.convertToSalesForceFormat(options, { includeNestedProperties: true })
        .then(basicQueryProps => {
            return Object.keys(basicQueryProps)
                   .sort() // Sort so that the order of properties in the WHERE clause is deterministic.
                   .map(key => getBasicQueryComparison(key, basicQueryProps[key]));
        });
    }

    /**
    * Gets the query comparisons for complex relationships (e.g. LeftInnerJoinRelationship).
    *
    * @param {Object} options - query options
    * @private
    */
    _getComplexQueryComparisons(options) {

        return this.getPropertyMap()
        .then(propertyMap => {

            let queryProperties = Object.keys(options);

            return queryProperties.reduce((comparisons, queryProperty) => {

                let relationship = propertyMap[queryProperty];

                if (relationship instanceof LeftInnerJoinRelationship) {
                    let queryValue = options[queryProperty],
                        comparison = relationship.createQueryComparison(queryValue);
                    comparisons.push(comparison);
                }

                return comparisons;
            }, []);
        });
    }

    /**
    * By default, SalesForce truncates query results at 2000 records. Luckily, a
    * query response has a property for determining whether the results were truncated
    * and another that's the url to the next set of records.
    *
    * @param {Object}         queryResponse
    * @param {Array.<Object>} queryResponse.records
    * @param {boolean}        queryResponse.done
    * @param {string}         queryResponse.nextRecordsUrl
    * @returns {Promise.<Array.<Object>>}                  - The remaining records
    * @private
    */
    _getRemainingQueryRecords({ records, done, nextRecordsUrl }) {

        return Promise.resolve()
        .then(() => {

            // Check explicitly for `done` and `nextRecordsUrl` to be set so we don't wind up polling
            // for forever if the response doesn't contain a `done` property for some reason.
            if (done === false && nextRecordsUrl) {

                return this._request({
                    url: nextRecordsUrl,
                    method: 'get',
                    json: true
                })
                .then(response => this._getRemainingQueryRecords(response))
                .then(remainingRecords => records.concat(remainingRecords));
            }

            return records;
        });
    }

    _request() {
        return this._connection.request(...arguments);
    }
}

export default SObject;

/**
* Returns a string representing a comparison for a given query property. Strings returned
* by this method are used to build a SOQL statement's predicate.
*
* @example
* _getBasicQueryComparison('id', '1234') // "id = '1234'"
* _getBasicQueryComparison(age, 25) // "age = 25"
* _getBasicQueryComparison(age, [ 24, 25, 26 ]) // "age = 24 OR age = 25 OR age = 26"
*
* @param {string}              property
* @param {string|number|Array} value
* @private
*/
export function getBasicQueryComparison(property, value) {

    if (typeof value === 'string') {
        // Escape any single quotes within the value string.
        value = value.replace('\'', '\\\'');
        // Include single quotes for a string literal.
        return `${property} = '${value}'`;
    } else if (Array.isArray(value)) {
        // This is an array of potential values that should be ORed together,
        // so call this method recursively.
        let potentialValues = value
        .map(nestedValue => getBasicQueryComparison(property, nestedValue))
        .join(' OR ');
        // Values that are ORed together need to be wrapped in parens in case additional AND parameters
        // are added to the query. i.e. WHERE deleted = false AND (name = 'cats' OR name = 'ferrets').
        return `(${potentialValues})`;
    } else {
        // Don't include single quotes for a number literal.
        return `${property} = ${value}`;
    }
}
