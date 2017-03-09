import { validate } from 'parameter-validator';

/**
* Whereas most SObject properties are mapped with a basic relationship to rename the property
* (e.g. { listPrice: 'List_Price__c' }), this class can be used to define a more complex relationship
* involving a left inner join.
*
* For more info on the different types of SOQL joins, see this page:
* https://developer.salesforce.com/page/A_Deeper_look_at_SOQL_and_Relationship_Queries_on_Force.com
*
* @example
* // Example of how this relationship can be used to add a `pureCloudOrgId` object to a quote object.
* // The result is that `storage.query({ pureCloudOrgId: 'org0' })` gets translated into
* // "SELECT <other properties> FROM zqu__Quote__c where zqu__Account__c IN (SELECT Account__c FROM PureCloud_Organization__c WHERE Org_ID__c = 'org0'"
*
* get propertyMap {
*    ...
*    pureCloudOrgId: new LeftInnerJoinRelationship({
*        property: 'zqu__Account__c',
*        relatedObject: {
*            name: 'PureCloud_Organization__c',
*            comparisonProperty: 'Account__c', // PureCloud_Organization__r.Account__c
*            queryValueProperty: 'Org_ID__c'   // PureCloud_Organization__r.Org_ID__c
*        }
*    })
*    ...
* }
*/
export class LeftInnerJoinRelationship {

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
