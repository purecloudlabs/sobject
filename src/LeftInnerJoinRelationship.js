import { validate } from 'parameter-validator';
import { getBasicQueryComparison } from './SObject';

/**
* Most often, an entry in SObject.prototype.propertyMap simply defines a friendly alias that maps to specific
* SalesForce property (e.g. `{ listPrice: 'List_Price__c' }`). Where this class comes in is when a simple
* relationship won't cut it you need to define a more complex relationship involving a
* [left inner join](https://developer.salesforce.com/page/A_Deeper_look_at_SOQL_and_Relationship_Queries_on_Force.com).
*
* @example
* // For this example, imagine two custom objects that each have a property which references an Account:
* //
* // 1. Organization__c object with properties:
* //     - Account__c
* //     - Org_ID__c
* //
* // 2. Quote__c with property:
* //     - Account__c
* //
* // This example demonstrates how to add an `organizationId` property for the quote object.
* // The result is that `quoteStorage.query({ organizationId: 'org0' })` gets translated into the query
* // "SELECT <other properties> FROM Quote__c where Account__c IN (SELECT Account__c FROM Organization__c WHERE Org_ID__c = 'org0'"
*
* get propertyMap {
*    // ...
*    organizationId: new LeftInnerJoinRelationship({
*        property: 'Account__c',
*        relatedObject: {
*            name: 'Organization__c',
*            comparisonProperty: 'Account__c', // Organization__r.Account__c
*            queryValueProperty: 'Org_ID__c'   // Organization__r.Org_ID__c
*        }
*    })
* }
*/
class LeftInnerJoinRelationship {

    /**
    * @param {Object} options
    * @param {string} options.property                         - The SalesForce name of the property on the local object
    * @param {Object} options.relatedObject
    * @param {string} options.relatedObject.name               - The name of the related SalesForce SObject
    * @param {string} options.relatedObject.comparisonProperty - The name of the property against the local object's property will be compared
    * @param {string} options.relatedObject.queryValueProperty - The name of the property used for querying
    */
    constructor(options) {

        validate(options, [
            'property',
            'relatedObject'
        ], this);

        validate(this.relatedObject, [
            'name',
            'comparisonProperty',
            'queryValueProperty'
        ]);
    }

    /**
    * Creates a query comparison that can be included in the predicate of a SOQL query.
    *
    * @param   {string|number} value
    * @returns {string}
    */
    createQueryComparison(value) {

        return `${this.property} IN (SELECT ${this.relatedObject.comparisonProperty} FROM ${this.relatedObject.name} WHERE ${getBasicQueryComparison(this.relatedObject.queryValueProperty, value)})`;
    }
}

export default LeftInnerJoinRelationship;
