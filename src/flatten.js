import flat from 'flat';

/**
* Flattens the given object into one that is just one level deep with period-delimited keys
* (example: { brand: { name: 'Fender' }} becomes { 'brand.name': 'Fender' }). Any properties
* that are arrays will be kept as arrays, but the objects in those arrays are flattened.
* @private
*/
export default function flatten(object) {
    // The `safe` option specifies that it should not transform arrays - so any arrays are preserved and
    // can still contain nested objects. So, we then call this method recursively on the array
    // objects to flatten them out, too.
    let flattenedObject = flat(object, { safe: true });

    for (let key in flattenedObject) {
        let value = flattenedObject[key];

        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                let item = value[i];
                if (typeof item === 'object') {
                    // Replace the object in the array with its nested version.
                    value.splice(i, 1, flatten(item));
                }
            }
        }
    }
    return flattenedObject;
}
