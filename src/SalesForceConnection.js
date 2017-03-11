import _ from 'lodash';
import request from 'request-promise-native';
import { validate } from 'parameter-validator';
import url from 'url';
import PromiseHelper from './PromiseHelper';
import MockLogger from './MockLogger';

/**
 * Manages a session with and sends requests to SalesForce's REST API. It handles authentication and automatically retries
 * common request failures (e.g. the infamous `UNABLE_TO_LOCK_ROW` error).
 *
 * This class's interface consists of a single `request()` method, so if you want different request-level functionality, you
 * can easily extend this class or implement a replacement which implements the same interface.
 */
class SalesForceConnection {

    /**
    * @param {Object}              options
    * @param {string}              options.loginUrl              - SalesForce OAuth login URI (e.g. `'https://test.salesforce.com/services/oauth2/token'`).
    * @param {string}              options.clientId              - API user client ID
    * @param {string}              options.clientSecret          - API user client secret
    * @param {string}              options.username              - API user username
    * @param {string}              options.password              - Depending on your security settings, you often will need to append a security
    *                                                              token to the end of your password.
    * @param {int}                 [options.requestRetriesMax=4] - The number of times an request will be retried if it throws an error that's not
    *                                                              a BadRequestError or ResourceNotFoundError.
    * @param {int}                 [options.requestTimeoutMs=30000]
    * @param {Object}              [options.logger]              - Optional Winston-style logger for capturing log output.
    */
    constructor(options) {

        validate(options, [
            'loginUrl',
            'clientId',
            'clientSecret',
            'username',
            'password'
        ], this, { addPrefix: '_' });

        this._logger = options.logger || new MockLogger();
        this._requestTimeoutMs = options.requestTimeoutMs || 30000;
        this._requestRetriesMax = options.requestRetriesMax === undefined ? 8 : options.requestRetriesMax;
    }

    /**
    * Sends a request to the SalesForce REST API. The options available are those for the [`request` module](https://www.npmjs.com/package/request),
    * although in reality, only the small subset of options listed here are used by SObject.
    *
    * @param   {Object}      options          - options passed to the `request` module
    * @param   {string}      options.url      - The relative API URL path (e.g. `'services/data/v36.0/sobjects/Account/00129000009VuH3AAK'`).
    *                                           Unlike the other options, this one isn't passed directly to the `request` module; it's appended
    *                                           to the instance URL obtained through authentication
    * @param   {string}      options.method   - e.g. `'post'`, `'get'`
    * @param   {Object|bool} options.json
    * @param   {Object}      options.headers
    * @returns {Promise} - Promise that resolve to the deserialized response body
    */
    request(options) {

        return PromiseHelper.executeWithRetry(
            () => this._request(options),
            {
                retryPredicate: this._determineIfRequestShouldBeRetried.bind(this),
                maxRetries: this._requestRetriesMax
            }
        );
    }

    _getAccessToken() {
        if (!this._accessTokenPromise) {
            this._renewAccessToken();
        }

        return this._accessTokenPromise;
    }

    _renewAccessToken() {
        this._logger.info('Renewing SalesForce access token');

        this._accessTokenPromise = request({
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
        })
        .then(result => {
            this._logger.info('SalesForce access token renewed');
            this._instanceUrl = result.instance_url;
            return result.access_token;
        });
    }

    _request(options, authRetriesRemaining = 3) {

        return this._getAccessToken()
        .then(accessToken => {

            let updatedOptions = _.cloneDeep(options); // Avoid side effects.

            if (!updatedOptions.headers) {
                updatedOptions.headers = {};
            }

            updatedOptions.headers.Authorization = `Bearer ${accessToken}`;
            updatedOptions.url = url.resolve(this._instanceUrl, options.url);

            return request(updatedOptions);
        })
        .catch(error => {

            if (error.statusCode !== 401) {
                this._logger.error('An error occurred while executing a SalesForce request.', { error, options });
                throw error;
            }

            this._logger.warn('SalesForce session invalid or expired.');

            if (authRetriesRemaining <= 0) {
                throw new Error('Exceeded the maximum number of authentication retries.');
            }

            this._renewAccessToken();
            return this._request(options, --authRetriesRemaining);
        });
    }

    /*
    * Requests for which an error response code of 400 or 404 is received will not be retried, with some exceptions.
    */
    _determineIfRequestShouldBeRetried(error, currentRetry) {

        let statusCodesToNotRetry = [
            404,
            410, // Resource gone
            403  // Forbidden
        ];

        let { statusCode } = error;

        // Erred requests are retryable by default.
        let retryable = statusCodesToNotRetry.includes(statusCode);

        if ([ 400, 500 ].includes(statusCode)) {
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
            let errorMessage = 'A SalesForce request threw an error and will be retried ' +
                `(retry attempt ${currentRetry + 1} of ${this._requestRetriesMax}).`;
            this._logger.error(errorMessage, { error });
        }
        return retryable;
    }
}

export default SalesForceConnection;
