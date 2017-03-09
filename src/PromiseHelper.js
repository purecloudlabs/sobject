/**
 * Utilities for helping with the execution of promises.
 */

function executeWithRetryWorker(promiseProvider, retryPredicate, maxRetries, currentRetry, retryBackoffFactor, logger) {
    return new Promise((resolve, reject) => {
        var exponentialBackoffMs = currentRetry ? (Math.pow(2, currentRetry) * retryBackoffFactor): 0;

        setTimeout(() => {
            promiseProvider()
            .then((result) => {
                resolve(result);
            })
            .catch((err) => {
                if (currentRetry < maxRetries && retryPredicate(err, currentRetry)) {
                    logger.warn(`Error executing promise - retrying.`, {
                        currentRetry: currentRetry,
                        maxRetries: maxRetries,
                        exponentialBackoffMs: exponentialBackoffMs,
                        message: err.message,
                        name: err.name,
                        stack: err.stack
                    });

                    resolve(executeWithRetryWorker(promiseProvider, retryPredicate, maxRetries, currentRetry + 1, retryBackoffFactor, logger));
                }
                else {
                    logger.warn(`Promise retry limit exceeded.`, {
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

class PromiseHelper {
    /*
     * Attempts to execute a failure-prone promise using an exponential backoff algorithm to vary the delay between attempts.
     * Heavily Influenced by: http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ErrorHandling.html#APIRetries
     *
     * Approximate time delays (using the default values for maxRetries and retryBackoffFactor):
     * Retry #          1   2   3   4    5    6    7     8     9
     * Delay Ms         100 200 400 800  1600 3200 6400  12800 25600
     * Total Delay Ms   100 300 700 1500 3100 6300 12700 25500 51100
     *
     */
    static executeWithRetry(promiseProvider, options) {
        options = options || {};
        var maxRetries = options.maxRetries || 9;
        var retryBackoffFactor = options.retryBackoffFactor || 50;
        var currentRetry = 0;
        var logger = PromiseHelper.logger || { warn: () => {} };
        var retryPredicate = options.retryPredicate || (() => true);

        return executeWithRetryWorker(promiseProvider, retryPredicate, maxRetries, currentRetry, retryBackoffFactor, logger)
        .catch((err) => {
            // The maxium retries was passed, so bubble to the error up to the caller.
            throw err;
        });
    }
}

export default PromiseHelper;
