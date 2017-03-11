'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.getBasicQueryComparison = getBasicQueryComparison;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _parameterValidator = require('parameter-validator');

var _errors = require('./errors');

var _convertPropertyNames = require('./convertPropertyNames');

var _convertPropertyNames2 = _interopRequireDefault(_convertPropertyNames);

var _LeftInnerJoinRelationship = require('./LeftInnerJoinRelationship');

var _LeftInnerJoinRelationship2 = _interopRequireDefault(_LeftInnerJoinRelationship);

var _MockLogger = require('./MockLogger');

var _MockLogger2 = _interopRequireDefault(_MockLogger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_API_VERSION = '34.0';

/**
* Allows queries and CRUD operations to be performed on SalesForce SObjects with minimal setup and a friendly API.
*
* To use this class, either extend it and override the `objectName` and `propertyMap` properties, or simply create an
* instance by passing those properties into this class's constructor. Either approach will allow you to use the default
* implementations of the CRUD methods (e.g. `query()`, `insert()`, etc.) **which automatically convert property names from SalesForce format
* (i.e. with funky prefixes) to the friendly camelCase format, and vice versa**.
*/

var SObject = function () {

    /**
    * @param {object}               options
    * @param {SalesForceConnection} options.connection          - Either an instance of this module's default SalesForceConnection
    *                                                             class or a custom version that implements its simple interface.
    * @param {string}               [options.objectName]        - Allows the objectName to be defined without
    *                                                             creating a subclass to override that property.
    * @param {object}               [options.propertyMap]       - Allows the propertyMap to be defined without
    *                                                             creating a subclass to override that property.
    * @param {int|float|string}     [options.apiVersion='34.0'] - e.g. '30.0', 31, 32.0
    * @param {Object}               [options.logger]            - Optional Winston-style logger for capturing log output.
    */
    function SObject(options) {
        _classCallCheck(this, SObject);

        (0, _parameterValidator.validate)(options, ['connection'], this, { addPrefix: '_' });
        this._objectName = options.objectName || options.salesForceObjectName; // Respect the legacy `salesForceObjectName` option.
        this._propertyMap = options.propertyMap;
        this._logger = options.logger || new _MockLogger2.default();
        this._apiVersion = DEFAULT_API_VERSION;

        if (options.apiVersion) {

            var versionNumber = Number.parseFloat(options.apiVersion);
            if (isNaN(versionNumber)) {
                throw new _parameterValidator.ParameterValidationError('Provided version number \'' + versionNumber + ' is not a number.\'');
            }
            this._apiVersion = versionNumber.toFixed(1).toString();
        }

        // An alias for convertPropertyNames, saved as an instance method to facilitate spying in unit tests.
        this._convertPropertyNames = _convertPropertyNames2.default;
    }

    /**
    * Override this class to specify your SObject's name, including any required prefixes and suffixes.
    *
    * @example
    * get objectName() {
    *     return 'Order__c'
    * }
    *
    * @virtual
    */


    _createClass(SObject, [{
        key: 'getPropertyMap',


        /**
        * Defines friendly (i.e. camelCase) names for your SObject's ugly SalesForce property names, which are often
        * riddled with suffixes, prefixes, underscores, etc. Nested SalesForce objects are supported
        * (e.g. 'Contact.Customer_Rep__r.Name').
        *
        * In most cases, an SObject's property map is static, so it's easiest to override `propertyMap` to define your
        * SObject's properties. If you instead need the property map to be dynamic and determined asynchronously
        * (for example, if you need to check a feature toggle to determine which properties should be included),
        * then override this asynchronous method instead. This can be useful, for example, for managing deployments.
        * Since `query()` and `get()` query for all the properties defined in the property map, the property map
        * can't contain any properties that haven't been defined in SalesForce yet (i.e. haven't been deployed yet).
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
        *            propertyMap.primaryContactEmail: 'Primary_Contact__r.Email__c'
        *        }
        *        return propertyMap;
        *    });
        * }
        *
        * @virtual
        * @returns {Promise.<Object>}
        */
        value: function getPropertyMap() {

            return Promise.resolve(this.propertyMap);
        }

        /**
        * Fetches a single object matching the property or combination of properties provided. If multiple
        * entities match the given options, then the first is returned. If there are no matches, a
        * `ResourceNotFoundError` is thrown. Use `query()` instead if you want greater than or less than 1 result.
        *
        * @param   {Object} options - Names and values of properties that will be ANDed together for the search
        * @returns {Promise.<Object>}
        * @throws  {ParameterValidationError}
        * @throws  {ResourceNotFoundError}
        */

    }, {
        key: 'get',
        value: function get(options) {
            var _this = this;

            return this.getPropertyNames().then(function (propertyNames) {
                // Validate that a value was provided for at least one property.
                (0, _parameterValidator.validate)(options, [propertyNames]);

                // Perform a query and return the first result. A query is performed instead of fetching the entity
                // directly by ID for two reasons: 1) it allows the entity to be looked up by other properties and
                // 2) fetching the entity directly by ID won't grab nested entities that may be defined in the property
                // map (e.g. user.profile.name).
                return _this.query(options);
            }).then(function (results) {
                if (results.length) {
                    return results[0];
                }
                throw new _this.resourceNotFoundErrorClass('No ' + _this.objectName + ' found for the properties: ' + JSON.stringify(options));
            }).catch(function (error) {
                return _this._updateAndThrow(error, { options: options, method: 'get' });
            });
        }

        /**
        * Queries for entities matching the given search properties. If no options are provided, all entities are returned.
        *
        * @param   {object} [options] - Names and values of properties that will be ANDed together for the search
        * @returns {Promise.<Array.<Object>>}
        */

    }, {
        key: 'query',
        value: function query(options) {
            var _this2 = this;

            return this.buildQueryStatement(options).then(function (query) {
                return _this2.executeQuery(query);
            }).then(function (results) {
                return _this2.convertArrayFromSalesForceFormat(results);
            }).catch(function (error) {
                return _this2._updateAndThrow(error, { options: options, method: 'query' });
            });
        }

        /**
        * Inserts the given entity.
        *
        * @param   {Object} entity
        * @returns {Promise.<Object>} result
        * @returns {string} result.id  - The id of the entity created.
        */

    }, {
        key: 'insert',
        value: function insert(entity) {
            var _this3 = this;

            return this.convertToSalesForceFormat(entity).then(function (formattedEntity) {
                return _this3._request(_this3.getInsertRequestOptions(formattedEntity));
            }).then(function (response) {
                return _lodash2.default.pick(response, ['id']);
            }).catch(function (error) {
                return _this3._updateAndThrow(error, { entity: entity, method: 'insert' });
            });
        }

        /**
        * Patches an entity by updating only the properties specified.
        *
        * @param   {Object} entity
        * @param   {string} entity.id  - An `id` property is required for updates.
        * @param   {*}      entity.*   - Properties with which to patch the existing entity.
        * @returns {Object} result
        * @returns {string} result.id
        * @throws  {ParameterValidationError}
        * @throws  {ResourceNotFoundError}
        */

    }, {
        key: 'update',
        value: function update(entity) {
            var _this4 = this;

            return (0, _parameterValidator.validateAsync)(entity, ['id']).then(function (_ref) {
                var id = _ref.id;


                entity = _lodash2.default.cloneDeep(entity);
                var returnValue = { id: id };
                // SalesForce doesn't allow the ID in the request body for requests to
                // their data services API.
                delete entity.id;

                if (Object.keys(entity).length === 0) {
                    // No properties were specified to update, so don't bother sending a request to SalesForce.
                    return returnValue;
                }
                return _this4.convertToSalesForceFormat(entity).then(function (formattedEntity) {
                    return _this4._request({
                        url: _this4._objectUrlPath + id,
                        method: 'patch',
                        json: formattedEntity
                    });
                }).then(function () {
                    return returnValue;
                });
            }).catch(function (error) {
                return _this4._updateAndThrow(error, { entity: entity, method: 'update' });
            });
        }

        /**
        * Deletes the given entity entity.
        *
        * @param   {Object} options
        * @param   {string} options.id - An `id` property is required for deletion.
        * @returns {Promise.<Object>} deletedEntity
        * @returns {string} deletedEntity.id  - The ID of the entity deleted.
        * @throws  {ParameterValidationError}
        * @throws  {ResourceNotFoundError}
        */

    }, {
        key: 'delete',
        value: function _delete(options) {
            var _this5 = this;

            return (0, _parameterValidator.validateAsync)(options, ['id']).then(function (_ref2) {
                var id = _ref2.id;
                return _this5._request({
                    url: _this5._objectUrlPath + id,
                    method: 'delete',
                    json: true
                });
            }).then(function () {
                return { id: options.id };
            }).catch(function (error) {
                return _this5._updateAndThrow(error, { options: options, method: 'delete' });
            });
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

    }, {
        key: 'getReversePropertyMap',
        value: function getReversePropertyMap() {

            return this.getPropertyMap().then(function (propertyMap) {

                var reverseMap = {};

                for (var key in propertyMap) {
                    var value = propertyMap[key];

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

    }, {
        key: 'getPropertyNames',
        value: function getPropertyNames() {

            return this.getPropertyMap().then(function (propertyMap) {
                return Object.keys(propertyMap).sort();
            });
        }

        /**
        * Returns the SalesForce property names defined for the SObject.
        *
        * @returns {Promise.<Array.<string>>} The SalesForce property names.
        */

    }, {
        key: 'getSalesForcePropertyNames',
        value: function getSalesForcePropertyNames() {

            return this.getReversePropertyMap().then(function (propertyMap) {
                return Object.keys(propertyMap).sort();
            });
        }

        /**
        * Transforms the property names of the entity according to the property map.
        * You can override this method if you want to do additional or different formatting.
        *
        * @param   {Object}           entity
        * @returns {Promise.<Object>}
        * @virtual
        */

    }, {
        key: 'convertFromSalesForceFormat',
        value: function convertFromSalesForceFormat(entity) {
            var _this6 = this;

            return Promise.all([this.getReversePropertyMap(), this.getPropertyNames()]).then(function (_ref3) {
                var _ref4 = _slicedToArray(_ref3, 2),
                    reversePropertyMap = _ref4[0],
                    propertyNames = _ref4[1];

                var convertedEntity = _this6._convertPropertyNames(entity, reversePropertyMap);
                return _lodash2.default.pick(convertedEntity, propertyNames);
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

    }, {
        key: 'getInsertRequestOptions',
        value: function getInsertRequestOptions(options) {
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
        * @throws  {ParameterValidationError}
        */

    }, {
        key: 'convertArrayFromSalesForceFormat',
        value: function convertArrayFromSalesForceFormat(entities) {
            var _this7 = this;

            return Promise.resolve().then(function () {
                if (!Array.isArray(entities)) {
                    throw new _parameterValidator.ParameterValidationError('First argument must be an array, but instead received a ' + (typeof entities === 'undefined' ? 'undefined' : _typeof(entities)) + ': ' + JSON.stringify(entities));
                }
                return Promise.all(entities.map(function (entity) {
                    return _this7.convertFromSalesForceFormat(entity);
                }));
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

    }, {
        key: 'convertToSalesForceFormat',
        value: function convertToSalesForceFormat(entity) {
            var _this8 = this;

            var _ref5 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
                _ref5$includeAttribut = _ref5.includeAttributesProperty,
                includeAttributesProperty = _ref5$includeAttribut === undefined ? false : _ref5$includeAttribut,
                _ref5$includeNestedPr = _ref5.includeNestedProperties,
                includeNestedProperties = _ref5$includeNestedPr === undefined ? false : _ref5$includeNestedPr;

            return Promise.all([this.getPropertyMap(), this.getReversePropertyMap()]).then(function (_ref6) {
                var _ref7 = _slicedToArray(_ref6, 2),
                    propertyMap = _ref7[0],
                    reversePropertyMap = _ref7[1];

                // In most cases, propertyMap's values are strings which indicate a basic name-to-name mapping.
                // However, a value can also be an object which defines a more complex relationship used only for `query` and `get`
                // (e.g. LeftInnerJoinRelationship). We want to omit those complex property definitions here so that the values passed
                // to convertPropertyNames are just strings.
                for (var key in propertyMap) {
                    var value = propertyMap[key];
                    if (typeof value !== 'string') {
                        delete propertyMap[key];
                    }
                }

                var convertedEntity = _this8._convertPropertyNames(entity, propertyMap);

                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                    for (var _iterator = Object.keys(convertedEntity)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        var propertyName = _step.value;


                        var isNestedProperty = propertyName.includes('.');

                        // Dont' include the property if it's not defined in this class's reverse property map,
                        // its value is undefined, or if it's a nested property and nested properties
                        // aren't to be included.
                        var _value = convertedEntity[propertyName];
                        if (!reversePropertyMap[propertyName] || _value === undefined || isNestedProperty && !includeNestedProperties) {
                            delete convertedEntity[propertyName];
                        }
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }

                if (includeAttributesProperty) {
                    convertedEntity.attributes = { type: _this8.objectName };
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

    }, {
        key: 'convertArrayToSalesForceFormat',
        value: function convertArrayToSalesForceFormat(entities) {
            var _this9 = this;

            return Promise.resolve().then(function () {
                if (!Array.isArray(entities)) {
                    throw new _parameterValidator.ParameterValidationError('First argument must be an array, but instead received a ' + (typeof entities === 'undefined' ? 'undefined' : _typeof(entities)) + ': ' + JSON.stringify(entities));
                }
                return Promise.all(entities.map(function (entity) {
                    return _this9.convertToSalesForceFormat(entity, { includeAttributesProperty: true });
                }));
            });
        }

        /**
        * A subclass can override this to provide a different class to use instead of the default ResourceNotFoundError.
        * @virtual
        * @private
        */

    }, {
        key: 'buildQueryStatement',


        /**
        * Builds a SOQL query from the given query options.
        *
        * @param   {Object}           options - Query options, which are the friendly names and values that the query results will match.
        * @returns {Promise.<string>}
        */
        value: function buildQueryStatement(options) {
            var _this10 = this;

            return Promise.all([this._buildQueryPredicate(options), this.getSalesForcePropertyNames()]).then(function (_ref8) {
                var _ref9 = _slicedToArray(_ref8, 2),
                    predicate = _ref9[0],
                    salesForcePropertyNames = _ref9[1];

                return 'SELECT ' + salesForcePropertyNames.join(', ') + ' FROM ' + _this10.objectName + ' ' + predicate + ' ORDER BY CreatedDate DESC';
            });
        }

        /**
        * Returns all results for the given SOQL query.
        *
        * @param   {string} query    - SOQL query
        * @returns {Array.<Objects>} - Results in SalesForce format.
        * @throws  {BadRequestError}
        */

    }, {
        key: 'executeQuery',
        value: function executeQuery(query) {
            var _this11 = this;

            return this._request({
                url: this._queryUrlPath,
                method: 'get',
                json: true,
                qs: { q: query }
            }).then(function (response) {
                return _this11._getRemainingQueryRecords(response);
            });
        }
    }, {
        key: '_updateAndThrow',
        value: function _updateAndThrow(error) {
            var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};


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

    }, {
        key: '_buildQueryPredicate',
        value: function _buildQueryPredicate(options) {

            if (!options || !Object.keys(options).length) {
                return Promise.resolve('');
            }

            return Promise.all([this._getBasicQueryComparisons(options), this._getComplexQueryComparisons(options)]).then(function (_ref10) {
                var _ref11 = _slicedToArray(_ref10, 2),
                    basicQueryComparisons = _ref11[0],
                    complexQueryComparisons = _ref11[1];

                var queryComparisons = [].concat(_toConsumableArray(basicQueryComparisons), _toConsumableArray(complexQueryComparisons));
                return 'WHERE ' + queryComparisons.join(' AND ');
            });
        }

        /**
        * Gets the query comparisons (e.g. [ 'firstName = \'Paula\'', 'age = 30' ]) for basic relationships (i.e. not complex joins).
        *
        * @param {Object} options - query options
        * @private
        */

    }, {
        key: '_getBasicQueryComparisons',
        value: function _getBasicQueryComparisons(options) {

            return this.convertToSalesForceFormat(options, { includeNestedProperties: true }).then(function (basicQueryProps) {
                return Object.keys(basicQueryProps).sort() // Sort so that the order of properties in the WHERE clause is deterministic.
                .map(function (key) {
                    return getBasicQueryComparison(key, basicQueryProps[key]);
                });
            });
        }

        /**
        * Gets the query comparisons for complex relationships (e.g. LeftInnerJoinRelationship).
        *
        * @param {Object} options - query options
        * @private
        */

    }, {
        key: '_getComplexQueryComparisons',
        value: function _getComplexQueryComparisons(options) {

            return this.getPropertyMap().then(function (propertyMap) {

                var queryProperties = Object.keys(options);

                return queryProperties.reduce(function (comparisons, queryProperty) {

                    var relationship = propertyMap[queryProperty];

                    if (relationship instanceof _LeftInnerJoinRelationship2.default) {
                        var queryValue = options[queryProperty],
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

    }, {
        key: '_getRemainingQueryRecords',
        value: function _getRemainingQueryRecords(_ref12) {
            var _this12 = this;

            var records = _ref12.records,
                done = _ref12.done,
                nextRecordsUrl = _ref12.nextRecordsUrl;


            return Promise.resolve().then(function () {

                // Check explicitly for `done` and `nextRecordsUrl` to be set so we don't wind up polling
                // for forever if the response doesn't contain a `done` property for some reason.
                if (done === false && nextRecordsUrl) {

                    return _this12._request({
                        url: nextRecordsUrl,
                        method: 'get',
                        json: true
                    }).then(function (response) {
                        return _this12._getRemainingQueryRecords(response);
                    }).then(function (remainingRecords) {
                        return records.concat(remainingRecords);
                    });
                }

                return records;
            });
        }
    }, {
        key: '_request',
        value: function _request() {
            var _connection;

            return (_connection = this._connection).request.apply(_connection, arguments);
        }
    }, {
        key: 'objectName',
        get: function get() {

            if (this._objectName) {
                return this._objectName;
            }
            // Respect the legacy `salesForceObjectName` property if it is overridden.
            if (this.salesForceObjectName) {
                return this.salesForceObjectName;
            }
            return new _errors.NotImplementedError();
        }

        /**
        * Defines friendly (i.e. camelCase) names for your SObject's ugly SalesForce property names, which are often
        * riddled with suffixes, prefixes, underscores, etc. Nested SalesForce objects are supported (e.g. 'Contact.Customer_Rep__r.Name').
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
        * @virtual
        * @type {Object}
        */

    }, {
        key: 'propertyMap',
        get: function get() {

            if (this._propertyMap) {
                return this._propertyMap;
            }
            throw new _errors.NotImplementedError();
        }
    }, {
        key: 'resourceNotFoundErrorClass',
        get: function get() {

            return _errors.ResourceNotFoundError;
        }
    }, {
        key: '_dataServicesUrlPath',
        get: function get() {

            return 'services/data/v' + this._apiVersion + '/';
        }
    }, {
        key: '_objectUrlPath',
        get: function get() {

            return this._dataServicesUrlPath + ('sobjects/' + this.objectName + '/');
        }
    }, {
        key: '_queryUrlPath',
        get: function get() {

            return this._dataServicesUrlPath + 'query';
        }
    }]);

    return SObject;
}();

exports.default = SObject;

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

function getBasicQueryComparison(property, value) {

    if (typeof value === 'string') {
        // Include single quotes for a string literal.
        return property + ' = \'' + value + '\'';
    } else if (Array.isArray(value)) {
        // This is an array of potential values that should be ORed together,
        // so call this method recursively.
        var potentialValues = value.map(function (nestedValue) {
            return getBasicQueryComparison(property, nestedValue);
        }).join(' OR ');
        // Values that are ORed together need to be wrapped in parens in case additional AND parameters
        // are added to the query. i.e. WHERE deleted = false AND (name = 'cats' OR name = 'ferrets').
        return '(' + potentialValues + ')';
    } else {
        // Don't include single quotes for a number literal.
        return property + ' = ' + value;
    }
}