'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _parameterValidator = require('parameter-validator');

var _SObject = require('./SObject');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
* Most often, an entry in `SObject.prototype.propertyMap` simply defines a friendly alias for a property of a
* SalesForce SObject (e.g. `{ listPrice: 'List_Price__c' }`). However, there comes a time in every developer's life when
* a simple relationship won't cut it, and that's when this class comes in. It lets you define a more complex relationship involving a
* [left inner join](https://developer.salesforce.com/page/A_Deeper_look_at_SOQL_and_Relationship_Queries_on_Force.com).
*
* @example
* // For this example, imagine we have two custom objects that each have a property which references an Account:
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
    * @private
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