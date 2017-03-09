/**
* A mock version of the logger that will be used if no real logger is injected.
*
* @private
*/
export default class MockLogger {
    log();
    info();
    error();
    verbose();
    silly();
    warn();
    debug();
}
