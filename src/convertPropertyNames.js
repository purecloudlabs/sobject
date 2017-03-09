import _ from 'lodash';
import flatten from './flatten';

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
export default function convertPropertyNames(obj, propertyNameMap, capitalizeOthers = false) {
    if (!obj) { throw new Error('obj parameter is required.'); }
    if (!propertyNameMap) { throw new Error('propertyNameMap parameter is required.'); }
    if (typeof obj !== 'object') { throw new Error('obj parameter must be an object.'); }

    if (Array.isArray(obj)) {
        // Obj is an Array, so execute this function for each item in it.
        let convertedObjs = [];

        for (let item of obj) {
            if (item && typeof obj === 'object') {
                item = convertPropertyNames(item, propertyNameMap, capitalizeOthers);
            }
            convertedObjs.push(item);
        }
        return convertedObjs;
    }

    // Flatten the target object.
    // Example: {zqu__ProductRatePlanCharge__r: {Sku__c: 'foo'}, Id: 'bar'} => {'zqu__ProductRatePlanCharge__r.Sku__c': 'foo', Id: 'bar'}
    obj = flatten(obj);

    for (let propertyName of Object.keys(obj)) {
        if (propertyName in propertyNameMap) {
            if (propertyNameMap[propertyName] !== propertyName) {
                obj[propertyNameMap[propertyName]] = obj[propertyName];
                delete obj[propertyName];
            }
        } else if (capitalizeOthers) {
            if (_.capitalize(propertyName) !== propertyName) {
                obj[_.capitalize(propertyName)] = obj[propertyName];
                delete obj[propertyName];
            }
        }
    }
    return obj;
}
