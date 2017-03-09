import _ from 'lodash';
import ParameterValidator from 'parameter-validator';
import { ParameterValidationError } from 'parameter-validator';
import { returnBody } from '../../../util/requestHelper';
import StorageProvider from '../../../models/StorageProvider';
import { ResourceNotFoundError, NotImplementedError } from '../../../models/errors';
import convertPropertyNames from '../../../util/convertPropertyNames';

/**
* Whereas most SObject properties are mapped with a basic relationship to rename the property
* (e.g. { listPrice: 'List_Price__c' }), this class can be used to define a more complex relationship
* involving a left inner join.
*
* For more info on the different types of SOQL joins, see this page:
* https://developer.salesforce.com/page/A_Deeper_look_at_SOQL_and_Relationship_Queries_on_Force.com
*
* @example
* // Example of how this relationship can be used to add a `pureCloudOrgId` object to a quote object.
* // The result is that `storage.query({ pureCloudOrgId: 'org0' })` gets translated into
* // "SELECT <other properties> FROM zqu__Quote__c where zqu__Account__c IN (SELECT Account__c FROM PureCloud_Organization__c WHERE Org_ID__c = 'org0'"
*
* get propertyMap {
*    ...
*    pureCloudOrgId: new LeftInnerJoinRelationship({
*        property: 'zqu__Account__c',
*        relatedObject: {
*            name: 'PureCloud_Organization__c',
*            comparisonProperty: 'Account__c', // PureCloud_Organization__r.Account__c
*            queryValueProperty: 'Org_ID__c'   // PureCloud_Organization__r.Org_ID__c
*        }
*    })
*    ...
* }
*/
export class LeftInnerJoinRelationship {

    /**
    * @param {Object} options
    * @param {string} options.property                         - The SalesForce name of the property on the local object
    * @param {Object} options.relatedObject
    * @param {string} options.relatedObject.name               - The name of the related SalesForce SObject
    * @param {string} options.relatedObject.comparisonProperty - The name of the property against the local object's property will be compared
    * @param {string} options.relatedObject.queryValueProperty - The name of the property used for querying
    */
    constructor(options) {

        let parameterValidator = new ParameterValidator();
        parameterValidator.validate(options, [
            'property',
            'relatedObject'
        ], this);

        parameterValidator.validate(this.relatedObject, [
            'name',
            'comparisonProperty',
            'queryValueProperty'
        ]);
    }

    /**
    * Creates a query comparison that can be included in the predicate of a SOQL query.
    *
    * @param   {string|number} value
    * @returns {string}
    */
    createQueryComparison(value) {

        return `${this.property} IN (SELECT ${this.relatedObject.comparisonProperty} FROM ${this.relatedObject.name} WHERE ${getBasicQueryComparison(this.relatedObject.queryValueProperty, value)})`;
    }
}


/**
* An abstract class that provides basic functionality for performing CRUD operations on SalesForce
* SObjects via SalesForce's REST API. To use this class, extend it and override at least
* salesForceObjectName and propertyMap in your subclass - this will allow you to use the default
* implementations of the crud methods and the methods for converting to/from the SalesForce format.
* If you need additional functionality, you can either update this base class to support the functionality
* if it is general enough to be useful for others and doesn't break default functionality, or you can
* override / extend the method in your subclass.
* @abstract
*/
export default class SObjectStorage extends StorageProvider {

    /**
    * @param {object}               options
    * @param {SalesForceClient}     options.salesForceClient
    * @param {string}               [options.salesForceObjectName] - Allows the salesForceObjectName to be defined without
    *                                                                creating a subclass to override that property.
    * @param {object}               [options.propertyMap]          - Allows the propertyMap to be defined without
    *                                                                creating a subclass to override that property.
    */
    constructor(options) {
        super();
        this.parameterValidator = new ParameterValidator();
        this.parameterValidator.validate(options, ['salesForceClient'], this);
        this._salesForceObjectName = options.salesForceObjectName;
        this._propertyMap = options.propertyMap;

        // An alias for utils/convertPropertyNames, saved as an instance method to facilitate spying in unit tests.
        this.convertPropertyNames = convertPropertyNames;
    }

    /**
    * Override this class to specify your SObject's name.
    *
    * @example
    * get salesForceObjectName() {
    *     return 'Order__c'
    * }
    *
    * @virtual
    */
    get salesForceObjectName() {
        if (this._salesForceObjectName) { return this._salesForceObjectName; }
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
    *         zuoraId: 'zqu__Zuora_ID__c',
    *         axLegalEntityId: 'Country__r.AX_Legal_Entity_ID__c'
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
    *         zuoraId: 'zqu__Zuora_ID__c',
    *         axLegalEntityId: 'Country__r.AX_Legal_Entity_ID__c'
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
            this.parameterValidator.validate(options, [ propertyNames ]);

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
            throw new ResourceNotFoundError(`No ${this.salesForceObjectName} found for the properties: ${JSON.stringify(options)}`);
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
        .then(formattedEntity => {

            return this.getBasicRequestor({
                operationName: 'insert',
            }).then(requestor => {
                return requestor
                .withResponseModifier((res, body) => ({id: body.id}))
                .execute(this.getInsertExecuteParams(formattedEntity));
            });
        }).catch(error => this._updateAndThrow(error, {entity, method: 'insert'}));
    }

    /**
    * @virtual
    * @param   {array.<object>}   entities
    * @returns {Promise.<object>} insertedEntities
    * @returns {string}           insertedEntities[i].id
    */
    insertMany(entities) {
        return this.convertArrayToSalesForceFormat(entities)
        .then(formattedEntities => {
            return this.getBasicRequestor({
                operationName: 'insertMany',
            }).then(requestor => {
                return requestor
                .withResponseModifier((res, body) => body.entities.map(entity => ({id: entity.id})))
                .execute({
                    uri: this.apexRestServicesUrlPath + 'PureCloudBulkStorage',
                    method: 'post',
                    json: {entities: formattedEntities}
                });
            });
        }).catch(error => this._updateAndThrow(error, {entities, method: 'insertMany'}));
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
        return Promise.resolve()
        .then(() => {
            entity = _.cloneDeep(entity);

            let {id} = this.parameterValidator.validate(entity, ['id']),
                returnValue = {id},
                entityToSend;

            // SalesForce doesn't allow the ID in the request body for requests to
            // their data services API.
            delete entity.id;

            if (Object.keys(entity).length === 0) {
                // No properties were specified to update, so don't bother sending a request to SalesForce.
                return returnValue;
            }

            return this.convertToSalesForceFormat(entity)
            .then(formattedEntity => {
                entityToSend = formattedEntity;
                return this.getBasicRequestor({
                    operationName: 'update',
                });
            })
            .then(requestor => {
                return requestor
                .withResponseModifier(() => returnValue)
                .execute({
                    uri: this.objectUrlPath + id,
                    method: 'patch',
                    json: entityToSend
                });
            });
        }).catch(error => this._updateAndThrow(error, {entity, method: 'update'}));
    }

    /**
    * @virtual
    * @param   {array.<object>}   entities
    * @returns {Promise.<object>} updatedEntities
    * @returns {string}           updatedEntities[i].id
    */
    updateMany(entities) {
        return this.convertArrayToSalesForceFormat(entities)
        .then(formattedEntities => {
            return this.getBasicRequestor({
                operationName: 'updateMany',
            }).then(requestor => {
                return requestor
                .withResponseModifier((res, body) => body.entities.map(entity => ({id: entity.id})))
                .execute({
                    uri: this.apexRestServicesUrlPath + 'PureCloudBulkStorage',
                    method: 'patch',
                    json: {entities: formattedEntities}
                });
            });
        }).catch(error => this._updateAndThrow(error, {entities, method: 'updateMany'}));
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
        return Promise.resolve()
        .then(() => {
            this.parameterValidator.validate(options, ['id']);

            return this.getBasicRequestor({
                operationName: 'delete',
            });
        }).then((requestor) => {
            return requestor
            .withResponseModifier(() => ({id: options.id}))
            .execute({
                uri: this.objectUrlPath + options.id,
                method: 'delete',
                json: true
            });
        }).catch(error => this._updateAndThrow(error, {options, method: 'delete'}));
    }

    /**
    * @virtual
    * @param   {array.<object>}   entities
    * @returns {Promise.<object>} deletedEntities
    * @returns {string}           deletedEntities[i].id
    */
    deleteMany(entities) {
        return Promise.resolve().then(() => {
            if (!Array.isArray(entities)) {
                throw new ParameterValidationError(`Parameter of ${typeof entities} is invalid - the first parameter must be an array.`);
            }
            if (!entities.length) {
                throw new ParameterValidationError(`No entities were provided for deletion.`);
            }

            let invalidEntities = [],
                ids = [];

            for(let entity of entities) {
                let {id} = entity;
                if (typeof id === 'string') {
                    ids.push(id);
                } else {
                    invalidEntities.push(entity);
                }
            }
            return this.getBasicRequestor({
                operationName: 'deleteMany',
            }).then(requestor => {
                return requestor
                .withResponseModifier((res, body) => body.results.map(id => ({id})))
                .execute({
                    uri: this.apexRestServicesUrlPath + 'PureCloudBulkStorage',
                    method: 'delete',
                    json: true,
                    qs: {ids: ids.join(',')}
                });
            });
        }).catch(error => this._updateAndThrow(error, {entities, method: 'deleteMany'}));
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

    getBasicRequestor(options) {
        // The getBasicRequestor implementation stays inside of salesForceClient, because
        // it's expected that all of the SObjectStorage instances will share the same
        // SalesForceClient instance.
        return this.salesForceClient.getBasicRequestor(options);
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

            let convertedEntity = this.convertPropertyNames(entity, reversePropertyMap);
            return _.pick(convertedEntity, propertyNames);
        });
    }

    /**
    * Acts as a customization point for insert requests. A subclass can override this method
    * to supply additional parameters to execute(), like headers.
    * @virtual
    */
    getInsertExecuteParams(entity) {
        return {
            uri: this.objectUrlPath,
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

            let convertedEntity = this.convertPropertyNames(entity, propertyMap);

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
                convertedEntity.attributes = {type: this.salesForceObjectName};
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

    get dataServicesUrlPath() {
        return this.salesForceClient.dataServicesUrlPath;
    }

    get objectUrlPath() {
        return this.dataServicesUrlPath + `sobjects/${this.salesForceObjectName}/`;
    }

    get queryUrlPath() {
        return this.salesForceClient.dataServicesQueryUrlPath;
    }

    get apexRestServicesUrlPath() {
        return this.salesForceClient.apexRestServicesUrlPath;
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
            return  `SELECT ${salesForcePropertyNames.join(', ')} FROM ${this.salesForceObjectName} ${predicate} ORDER BY CreatedDate DESC`;
        });
    }

    /**
    * @param   {string} soqlQuery
    * @returns {object} An object to be passed to `requestor.execute()`.
    */
    getQueryExecution(soqlQuery) {
        return {
            uri: this.queryUrlPath,
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

        return this.getBasicRequestor({
            operationName: 'query'
        })
        .then(requestor => requestor
            .withResponseModifier(returnBody)
            .execute({
                uri: this.queryUrlPath,
                method: 'get',
                json: true,
                qs: {q: query}
        }))
        .then(response => this._getRemainingQueryRecords(response));
    }

    get logger() {
        return this.salesForceClient.logger;
    }

    _updateAndThrow(error, data = {}) {

        Object.assign(data, {
            'SObject type': this.salesForceObjectName,
            message: error.message,
            stack: error.stack
        });
        this.logger.error('Error in Salesforce request', data);
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

                return this.getBasicRequestor({ operationName: '_getRemainingQueryRecords' })
                .then(requestor => requestor
                    .withResponseModifier(returnBody)
                    .execute({
                        uri: nextRecordsUrl,
                        method: 'get',
                        json: true
                }))
                .then(response => this._getRemainingQueryRecords(response))
                .then(remainingRecords => records.concat(remainingRecords));
            }

            return records;
        });
    }
}


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
function getBasicQueryComparison(property, value) {

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
