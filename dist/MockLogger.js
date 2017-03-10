"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
* A mock version of the logger that will be used if no real logger is injected.
*
* @private
*/
var MockLogger = function () {
    function MockLogger() {
        _classCallCheck(this, MockLogger);
    }

    _createClass(MockLogger, [{
        key: "log",
        value: function log() {}
    }, {
        key: "info",
        value: function info() {}
    }, {
        key: "error",
        value: function error() {}
    }, {
        key: "verbose",
        value: function verbose() {}
    }, {
        key: "silly",
        value: function silly() {}
    }, {
        key: "warn",
        value: function warn() {}
    }, {
        key: "debug",
        value: function debug() {}
    }]);

    return MockLogger;
}();

exports.default = MockLogger;