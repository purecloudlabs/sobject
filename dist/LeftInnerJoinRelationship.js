'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _parameterValidator = require('parameter-validator');

var _SObject = require('./SObject');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
var LeftInnerJoinRelationship = function () {

    /**
    * @param {Object} options
    * @param {string} options.property                         - The SalesForce name of the property on the local object
    * @param {Object} options.relatedObject
    * @param {string} options.relatedObject.name               - The name of the related SalesForce SObject
    * @param {string} options.relatedObject.comparisonProperty - The name of the property against the local object's property will be compared
    * @param {string} options.relatedObject.queryValueProperty - The name of the property used for querying
    */
    function LeftInnerJoinRelationship(options) {
        _classCallCheck(this, LeftInnerJoinRelationship);

        (0, _parameterValidator.validate)(options, ['property', 'relatedObject'], this);

        (0, _parameterValidator.validate)(this.relatedObject, ['name', 'comparisonProperty', 'queryValueProperty']);
    }

    /**
    * Creates a query comparison that can be included in the predicate of a SOQL query.
    *
    * @param   {string|number} value
    * @returns {string}
    */


    _createClass(LeftInnerJoinRelationship, [{
        key: 'createQueryComparison',
        value: function createQueryComparison(value) {

            return this.property + ' IN (SELECT ' + this.relatedObject.comparisonProperty + ' FROM ' + this.relatedObject.name + ' WHERE ' + (0, _SObject.getBasicQueryComparison)(this.relatedObject.queryValueProperty, value) + ')';
        }
    }]);

    return LeftInnerJoinRelationship;
}();

exports.default = LeftInnerJoinRelationship;