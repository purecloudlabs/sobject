'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = flatten;

var _flat = require('flat');

var _flat2 = _interopRequireDefault(_flat);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
* Flattens the given object into one that is just one level deep with period-delimited keys
* (example: { brand: { name: 'Fender' }} becomes { 'brand.name': 'Fender' }). Any properties
* that are arrays will be kept as arrays, but the objects in those arrays are flattened.
* @private
*/
function flatten(object) {
    // The `safe` option specifies that it should not transform arrays - so any arrays are preserved and
    // can still contain nested objects. So, we then call this method recursively on the array
    // objects to flatten them out, too.
    var flattenedObject = (0, _flat2.default)(object, { safe: true });

    for (var key in flattenedObject) {
        var value = flattenedObject[key];

        if (Array.isArray(value)) {
            for (var i = 0; i < value.length; i++) {
                var item = value[i];
                if ((typeof item === 'undefined' ? 'undefined' : _typeof(item)) === 'object') {
                    // Replace the object in the array with its nested version.
                    value.splice(i, 1, flatten(item));
                }
            }
        }
    }
    return flattenedObject;
}