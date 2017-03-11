"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
* Utilities for helping with the execution of promises.
* @private
*/
function executeWithRetryWorker(promiseProvider, retryPredicate, maxRetries, currentRetry, retryBackoffFactor, logger) {
    return new Promise(function (resolve, reject) {
        var exponentialBackoffMs = currentRetry ? Math.pow(2, currentRetry) * retryBackoffFactor : 0;

        setTimeout(function () {
            promiseProvider().then(function (result) {
                resolve(result);
            }).catch(function (err) {
                if (currentRetry < maxRetries && retryPredicate(err, currentRetry)) {
                    logger.warn("Error executing promise - retrying.", {
                        currentRetry: currentRetry,
                        maxRetries: maxRetries,
                        exponentialBackoffMs: exponentialBackoffMs,
                        message: err.message,
                        name: err.name,
                        stack: err.stack
                    });

                    resolve(executeWithRetryWorker(promiseProvider, retryPredicate, maxRetries, currentRetry + 1, retryBackoffFactor, logger));
                } else {
                    logger.warn("Promise retry limit exceeded.", {
                        currentRetry: currentRetry,
                        maxRetries: maxRetries,
                        exponentialBackoffMs: exponentialBackoffMs,
                        message: err.message,
                        name: err.name,
                        stack: err.stack
                    });

                    reject(err);
                }
            });
        }, exponentialBackoffMs);
    });
}

var PromiseHelper = function () {
    function PromiseHelper() {
        _classCallCheck(this, PromiseHelper);
    }

    _createClass(PromiseHelper, null, [{
        key: "executeWithRetry",

        /**
        * Attempts to execute a failure-prone promise using an exponential backoff algorithm to vary the delay between attempts.
        * Heavily Influenced by: http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ErrorHandling.html#APIRetries
        *
        * Approximate time delays (using the default values for maxRetries and retryBackoffFactor):
        * Retry #          1   2   3   4    5    6    7     8     9
        * Delay Ms         100 200 400 800  1600 3200 6400  12800 25600
        * Total Delay Ms   100 300 700 1500 3100 6300 12700 25500 51100
        * @private
        */
        value: function executeWithRetry(promiseProvider, options) {
            options = options || {};
            var maxRetries = options.maxRetries || 9;
            var retryBackoffFactor = options.retryBackoffFactor || 50;
            var currentRetry = 0;
            var logger = PromiseHelper.logger || { warn: function warn() {} };
            var retryPredicate = options.retryPredicate || function () {
                return true;
            };

            return executeWithRetryWorker(promiseProvider, retryPredicate, maxRetries, currentRetry, retryBackoffFactor, logger).catch(function (err) {
                // The maxium retries was passed, so bubble to the error up to the caller.
                throw err;
            });
        }
    }]);

    return PromiseHelper;
}();

exports.default = PromiseHelper;