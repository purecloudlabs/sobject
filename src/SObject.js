import _ from 'lodash';
import { validate, validateAsync } from 'parameter-validator';
import { ParameterValidationError } from 'parameter-validator';
import { ResourceNotFoundError, NotImplementedError } from './errors';
import convertPropertyNames from './convertPropertyNames';
import LeftInnerJoinRelationship from './LeftInnerJoinRelationship';
import MockLogger from './MockLogger';

const DEFAULT_API_VERSION = '34.0';

/**
* A class that provides basic functionality for performing CRUD operations on SalesForce
* SObjects via SalesForce's REST API. To use this class, extend it and override at least
* objectName and propertyMap in your subclass - this will allow you to use the default
* implementations of the crud methods and the methods for converting to/from the SalesForce format.
* If you need additional functionality, you can either update this base class to support the functionality
* if it is general enough to be useful for others and doesn't break default functionality, or you can
* override / extend the method in your subclass.
* @abstract
*/
class SObject {

    /**
    * @param {object}               options
    * @param {SalesForceConnection} options.connection
    * @param {string}               [options.objectName]        - Allows the objectName to be defined without
    *                                                             creating a subclass to override that property.
    * @param {object}               [options.propertyMap]       - Allows the propertyMap to be defined without
    *                                                             creating a subclass to override that property.
    * @param {int|float|string}     [options.apiVersion='34.0'] - e.g. '30.0', 31, 32.0
    * @param {Object}               [options.logger]            - Optional Winston-style logger for capturing log output.
    */
    constructor(options) {

        validate(options, [ 'connection' ], this);
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
    * Override this class to specify your SObject's name.
    *
    * @example
    * get objectName() {
    *     return 'Order__c'
    * }
    *
    * @virtual
    */
    get objectName() {
        if (this._objectName) { return this._objectName; }
        // Respect the legacy `salesForceObjectName` property if it is overridden.
        if (this.salesForceObjectName) { return this.salesForceObjectName; }
        return new NotImplementedError();
    }

    /**
    * If your object's properties are static (e.g. not based on a feature toggle), you can override this property to
    * return an object that maps your 'friendly' property names to their ugly SalesForce counterparts, which can
    * be period-delimited to show nested objects.
    *
    * @see getPropertyMap - The public api for querying an entity's property map, which can be overridden to specify
    *                       an entity's properties dynamically (e.g. based on a feature toggle).
    *
    * @ example
    * get propertyMap() {
    *     return {
    *         name: 'Name',
    *         primaryContactEmail: 'Primary_Contact__r.Email__c'
    *     };
    * }
    *
    * @abstract
    * @returns {object}
    */
    get propertyMap() {

        if (this._propertyMap) {
            return this._propertyMap;
        }
        throw new NotImplementedError();
    }

    /**
    * The public api for getting the instance's property map, which is an object that maps friendly
    * property names to the SalesForce-specific property names.
    *
    * The default implementation just returns the `propertyMap` property wrapped in a promise, so that the only
    * thing that most subclasses need to implement is to override `propertyMap`. If a subclass needs to conditionally
    * include some properties (e.g. based on a feature toggle), it can instead override `getPropertyMap` so that it can
    * return the property map asynchronously.
    *
    * @example
    * getPropertyMap() {
    *     return {
    *         name: 'Name',
    *         primaryContactEmail: 'Primary_Contact__r.Email__c'
    *     };
    * }

    *
    * @returns {Promise.<Object>}
    */
    getPropertyMap() {

        return Promise.resolve(this.propertyMap);
    }


    /**
    * Gets an entity with the given `id` or other identifier(s), converts it from the ugly SalesForce format to the friendly format,
    * and returns it.
    *
    * @virtual
    * @param   {object} entity
    * @param   {string} [entity.id]
    * @param   {*}      [entity.{*}] - Any other field name/value pairs to use to look up the entity.
    * @returns {object} result
    * @returns {string} result.id
    * @throws  {ParameterValidationError}
    * @throws  {ResourceNotFoundError}
    * @throws  {BadRequestError}
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
            throw new ResourceNotFoundError(`No ${this.objectName} found for the properties: ${JSON.stringify(options)}`);
        })
        .catch(error => this._updateAndThrow(error, {options, method: 'get'}));
    }

    /**
    * Queries SalesForce according to the given query options, converts the ugly SalesForce entities to their friendly versions,
    * and returns them. Query options can be provided for filtering or they can be omitted to select all of the entities.
    * You can override this method if you want different query behavior.
    *
    * @virtual
    * @param   {object}          [options] - Friendly property name / value pairs (from propertyMap) that will be ANDed together
    *                                        in the query predicate. If omitted, all entities will be returned.
    * @returns {array.<object>}
    */
    query(options) {
        return this.buildQueryStatement(options)
        .then(query => this.executeQuery(query))
        .then(results => this.convertArrayFromSalesForceFormat(results))
        .catch(error => this._updateAndThrow(error, {options, method: 'query'}));
    }

    /**
    * Converts the given entity from 'friendly' format to the ugly SalesForce format
    * and inserts it. You can override this method if you want to do additional
    * formatting or data massaging prior to the insert.
    *
    * @virtual
    * @param   {object} entity
    * @returns {Object} result
    * @returns {string} result.id  - The id of the entity created.
    * @throws  {BadRequestError}
    */
    insert(entity) {
        return this.convertToSalesForceFormat(entity)
        .then(formattedEntity => this._request(this.getInsertExecuteParams(formattedEntity)))
        .then(response => _.pick(response, [ 'id' ]))
        .catch(error => this._updateAndThrow(error, {entity, method: 'insert'}));
    }

    /**
    * Converts the given entity from 'friendly' format to the ugly SalesForce format
    * and updates it. You can override this method if you want to do additional
    * formatting or data massaging prior to the update.
    *
    * @virtual
    * @param   {object} entity
    * @param   {string} entity.id
    * @param   {*}      entity.*   - Properties with which to patch the existing entity.
    * @returns {object} result
    * @returns {string} result.id
    * @throws  {ParameterValidationError}
    * @throws  {ResourceNotFoundError}
    * @throws  {BadRequestError}
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
    * Deletes an entity.
    *
    * @virtual
    * @param   {Object} options
    * @param   {string} options.id - The ID of a the entity to delete.
    * @returns {Object} deletedEntity
    * @returns {string} deletedEntity.id  - The ID of the entity deleted.
    * @throws  {ParameterValidationError}
    * @throws  {ResourceNotFoundError}
    * @throws  {BadRequestError}
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
    * Unlike getPropertyMap, which can include both basic name-to-name mappings and more complex
    * relationship type object (@see LeftInnerJoinRelationship), reversePropertyMap only includes
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
    * Returns the grotesque SalesForce property names for the properties.
    *
    * @returns {Promise.<Array.<string>>} The grotesque SalesForce property names.
    */
    getSalesForcePropertyNames() {

        return this.getReversePropertyMap()
        .then(propertyMap => Object.keys(propertyMap).sort());
    }

    /**
    * Transforms the property names of the entity according to the map of SalesForce properties to their
    * friendly names. You can override this method if you want to do additional or different formatting.
    *
    * @param   {object}           entity
    * @returns {Promise.<object>}
    * @virtual
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
    * to supply additional parameters to execute(), like headers.
    * @virtual
    */
    getInsertRequestParams(entity) {
        return {
            url: this._objectUrlPath,
            method: 'post',
            json: entity
        };
    }

    /**
    * @returns {Promise.<array>}
    * @throws  {ParameterValidationError}
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
    * Transforms the property names of the entity according to the map returned by getPropertyMap() and
    * removes properties not included in the map.
    *
    * @param   {object}   entity
    * @param   {object}   options
    * @param   {boolean}  [options.includeAttributesProperty] - When we get deserialized SObjects from the REST data API,
    *                                                           each entity has an 'attributes' property containing the name
    *                                                           of its SObject type and its URL. This parameter optionally
    *                                                           includes this 'attributes' property so that the resulting object
    *                                                           is in a format that can be deserialized back into a native
    *                                                           SObject in Apex code.
    * @param   {boolean}  [options.includeNestedProperties]   - Used to optionally allow nested properties in the output (disabled
    *                                                           by default).
    * @returns {Promise.<object>}
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

    convertArrayToSalesForceFormat(entities) {
        return Promise.resolve().then(() => {
            if (!Array.isArray(entities)) {
                throw new ParameterValidationError(`First argument must be an array, but instead received a ${typeof entities}: ${JSON.stringify(entities)}`);
            }
            return Promise.all(entities.map(entity => this.convertToSalesForceFormat(entity, { includeAttributesProperty: true })));
        });
    }

    /**
    * Allows a subclass to provide a different class to use instead of the default ResourceNotFoundError.
    *
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
    * Creates a SOQL query from the given query options.
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
    * @param   {string} soqlQuery
    * @returns {object} An object to be passed to `requestor.execute()`.
    */
    getQueryExecution(soqlQuery) {
        return {
            url: this._queryUrlPath,
            method: 'get',
            json: true,
            qs: {q: soqlQuery}
        };
    }

    /**
    * Returns all results for the given SOQL query.
    *
    * @param   {string}          query
    * @returns {array.<objects>} results
    * @throws  {BadRequestError}
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
*/
export function getBasicQueryComparison(property, value) {

    if (typeof value === 'string') {
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
