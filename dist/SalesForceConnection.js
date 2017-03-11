'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _requestPromiseNative = require('request-promise-native');

var _requestPromiseNative2 = _interopRequireDefault(_requestPromiseNative);

var _parameterValidator = require('parameter-validator');

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _PromiseHelper = require('./PromiseHelper');

var _PromiseHelper2 = _interopRequireDefault(_PromiseHelper);

var _MockLogger = require('./MockLogger');

var _MockLogger2 = _interopRequireDefault(_MockLogger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Manages a session with and sends requests to SalesForce's REST API. It handles authentication and automatically retries
 * common request failures (e.g. the infamous `UNABLE_TO_LOCK_ROW` error).
 *
 * This class's interface consists of a single `request()` method, so if you want different request-level functionality, you
 * can extend this class or implement a replacement which implements the same interface.
 */
var SalesForceConnection = function () {

    /**
    * @param {Object}              options
    * @param {string}              options.loginUrl              - SalesForce OAuth login URI
    * @param {string}              options.clientId              - API user client ID
    * @param {string}              options.clientSecret          - API user client secret
    * @param {string}              options.username
    * @param {string}              options.password
    * @param {int}                 [options.requestRetriesMax]   - The number of times an request will be retried if it throws an error that's not
    *                                                              a BadRequestError or ResourceNotFoundError. Default: 4.
    * @param {int}                 [options.requestTimeoutMs]
    * @param {Object}              [options.logger]
    */
    function SalesForceConnection(options) {
        _classCallCheck(this, SalesForceConnection);

        (0, _parameterValidator.validate)(options, ['loginUrl', 'clientId', 'clientSecret', 'username', 'password'], this, { addPrefix: '_' });

        this._logger = options.logger || new _MockLogger2.default();
        this._requestTimeoutMs = options.requestTimeoutMs || 30000;
        this._requestRetriesMax = options.requestRetriesMax === undefined ? 8 : options.requestRetriesMax;
    }

    /**
    * Sends a request to the SalesForce REST API. The options available are those for the [`request` module](https://www.npmjs.com/package/request),
    * although in reality, only the small subset of options listed here are used by SObject.
    *
    * @param   {Object}      options          - options passed to the `request` module
    * @param   {string}      options.url      - The relative API URL path (e.g. 'services/data/v36.0/sobjects/Account/00129000009VuH3AAK').
    *                                           Unlike the other options, this one isn't passed directly to the `request` module; it's appended
    *                                           to the instance URL obtained through authentication
    * @param   {string}      options.method   - e.g. 'post', 'get'
    * @param   {Object|bool} options.json
    * @param   {Object}      options.headers
    * @returns {Promise} - Promise that resolve to the deserialized response body
    */


    _createClass(SalesForceConnection, [{
        key: 'request',
        value: function request(options) {
            var _this = this;

            return _PromiseHelper2.default.executeWithRetry(function () {
                return _this._request(options);
            }, {
                retryPredicate: this._determineIfRequestShouldBeRetried.bind(this),
                maxRetries: this._requestRetriesMax
            });
        }
    }, {
        key: '_getAccessToken',
        value: function _getAccessToken() {
            if (!this._accessTokenPromise) {
                this._renewAccessToken();
            }

            return this._accessTokenPromise;
        }
    }, {
        key: '_renewAccessToken',
        value: function _renewAccessToken() {
            var _this2 = this;

            this._logger.info('Renewing SalesForce access token');

            this._accessTokenPromise = (0, _requestPromiseNative2.default)({
                url: this._loginUrl,
                method: 'post',
                form: {
                    grant_type: 'password',
                    client_id: this._clientId,
                    client_secret: this._clientSecret,
                    username: this._username,
                    password: this._password
                },
                json: true
            }).then(function (result) {
                _this2._logger.info('SalesForce access token renewed');
                _this2._instanceUrl = result.instance_url;
                return result.access_token;
            });
        }
    }, {
        key: '_request',
        value: function _request(options) {
            var _this3 = this;

            var authRetriesRemaining = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 3;


            return this._getAccessToken().then(function (accessToken) {

                var updatedOptions = _lodash2.default.cloneDeep(options); // Avoid side effects.

                if (!updatedOptions.headers) {
                    updatedOptions.headers = {};
                }

                updatedOptions.headers.Authorization = 'Bearer ' + accessToken;
                updatedOptions.url = _url2.default.resolve(_this3._instanceUrl, options.url);

                return (0, _requestPromiseNative2.default)(updatedOptions);
            }).catch(function (error) {

                if (error.statusCode !== 401) {
                    _this3._logger.error('An error occurred while executing a SalesForce request.', { error: error, options: options });
                    throw error;
                }

                _this3._logger.warn('SalesForce session invalid or expired.');

                if (authRetriesRemaining <= 0) {
                    throw new Error('Exceeded the maximum number of authentication retries.');
                }

                _this3._renewAccessToken();
                return _this3._request(options, --authRetriesRemaining);
            });
        }

        /*
        * Requests for which an error response code of 400 or 404 is received will not be retried, with some exceptions.
        */

    }, {
        key: '_determineIfRequestShouldBeRetried',
        value: function _determineIfRequestShouldBeRetried(error, currentRetry) {

            var statusCodesToNotRetry = [404, 410, // Resource gone
            403 // Forbidden
            ];

            var statusCode = error.statusCode;

            // Erred requests are retryable by default.

            var retryable = statusCodesToNotRetry.includes(statusCode);

            if ([400, 500].includes(statusCode)) {
                // In some error scenarios, SalesForce responds with a 400 even though the
                // server is at fault and not the client. In those scenarios, we do want to retry.
                if (error.message && error.message.includes('UNABLE_TO_LOCK_ROW')) {
                    this._logger.info('Received an "UNABLE_TO_LOCK_ROW" error response from SalesForce, so the request will be retried.');
                } else if (error.message && error.message.includes('QUERY_TIMEOUT')) {
                    this._logger.info('Received a "QUERY_TIMEOUT" error response from SalesForce, so the request will be retried.');
                } else {
                    // All other 400s and 500s are non-retryable.
                    retryable = false;
                }
            }

            if (retryable) {
                var errorMessage = 'A SalesForce request threw an error and will be retried ' + ('(retry attempt ' + (currentRetry + 1) + ' of ' + this._requestRetriesMax + ').');
                this._logger.error(errorMessage, { error: error });
            }
            return retryable;
        }
    }]);

    return SalesForceConnection;
}();

exports.default = SalesForceConnection;