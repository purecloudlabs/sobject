// Export SObject as both the default and as a named export.
import SObject from './SObject';
export default SObject;
export { default as SObject } from './SObject';

export { default as SalesForceConnection } from './SalesForceConnection';
export { ResourceNotFoundError } from './errors';
