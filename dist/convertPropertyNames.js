'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = convertPropertyNames;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _flatten = require('./flatten');

var _flatten2 = _interopRequireDefault(_flatten);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
* Returns a copy of obj with its property names transformed according to propertyNameMap.
* obj can be nested and the keys in propertyNameMap can be period delimitted such that the
* the object returned is a flattened version of obj with its property names transformed
* @example
*
* convertPropertyNames(
*           {zqu__ProductRatePlanCharge__r: {Sku__c: 'foo'}, Id: 'bar'},
*           {'zqu__ProductRatePlanCharge__r.Sku__c': 'sku', Id: 'id'}
* )
* returns {sku: 'foo', id: 'bar'}
*
* @param {object|array} obj                - An object or array of objects to transform
* @param {object}       propertyNameMap
* @param {boolean}      [capitalizeOthers] - If true, property names in obj that aren't included
*                                            in the map will be capitalized.
* @param {object|array}
* @private
*/
function convertPropertyNames(obj, propertyNameMap) {
    var capitalizeOthers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    if (!obj) {
        throw new Error('obj parameter is required.');
    }
    if (!propertyNameMap) {
        throw new Error('propertyNameMap parameter is required.');
    }
    if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object') {
        throw new Error('obj parameter must be an object.');
    }

    if (Array.isArray(obj)) {
        // Obj is an Array, so execute this function for each item in it.
        var convertedObjs = [];

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = obj[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var item = _step.value;

                if (item && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object') {
                    item = convertPropertyNames(item, propertyNameMap, capitalizeOthers);
                }
                convertedObjs.push(item);
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

        return convertedObjs;
    }

    // Flatten the target object.
    // Example: {zqu__ProductRatePlanCharge__r: {Sku__c: 'foo'}, Id: 'bar'} => {'zqu__ProductRatePlanCharge__r.Sku__c': 'foo', Id: 'bar'}
    obj = (0, _flatten2.default)(obj);

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = Object.keys(obj)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var propertyName = _step2.value;

            if (propertyName in propertyNameMap) {
                if (propertyNameMap[propertyName] !== propertyName) {
                    obj[propertyNameMap[propertyName]] = obj[propertyName];
                    delete obj[propertyName];
                }
            } else if (capitalizeOthers) {
                if (_lodash2.default.capitalize(propertyName) !== propertyName) {
                    obj[_lodash2.default.capitalize(propertyName)] = obj[propertyName];
                    delete obj[propertyName];
                }
            }
        }
    } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
            }
        } finally {
            if (_didIteratorError2) {
                throw _iteratorError2;
            }
        }
    }

    return obj;
}