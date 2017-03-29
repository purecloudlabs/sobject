## Classes

<dl>
<dt><a href="#LeftInnerJoinRelationship">LeftInnerJoinRelationship</a></dt>
<dd><p>Most often, an entry in <code>SObject.prototype.propertyMap</code> simply defines a friendly alias for a property of a
SalesForce SObject (e.g. <code>{ listPrice: &#39;List_Price__c&#39; }</code>). However, there comes a time in every developer&#39;s life when
a simple relationship won&#39;t cut it, and that&#39;s when this class comes in. It lets you define a more complex relationship involving a
<a href="https://developer.salesforce.com/page/A_Deeper_look_at_SOQL_and_Relationship_Queries_on_Force.com">left inner join</a>.</p>
</dd>
<dt><a href="#SObject">SObject</a></dt>
<dd><p>Allows queries and CRUD operations to be performed on a SalesForce SObject with minimal setup and a friendly API.</p>
<p>Simply give it the SObject&#39;s name (e.g. <code>Account</code>) and a <code>propertyMap</code> which defines friendly names for the properties
in which you&#39;re interested (e.g. <code>{ primaryContactName: &#39;Primary_Contact__r.Name&#39; }</code>). Now you can query and update records
using the friendly names, and this class takes care of the conversion to and from the SalesForce format.</p>
<p>To use this class, either extend it to override its <code>objectName</code> and <code>propertyMap</code> properties, or simply create an
instance by passing those properties into this class&#39;s constructor. Either approach will allow you to use the default
implementations of the CRUD methods (e.g. <code>query()</code>, <code>insert()</code>, etc.) which automatically handle the property name conversion.</p>
</dd>
<dt><a href="#SalesForceConnection">SalesForceConnection</a></dt>
<dd><p>Manages a session with and sends requests to SalesForce&#39;s REST API. It handles authentication and automatically retries
common request failures (e.g. the infamous <code>UNABLE_TO_LOCK_ROW</code> error).</p>
<p>This class&#39;s interface consists of a single <code>request()</code> method, so if you want different request-level functionality, you
can easily extend this class or implement a replacement which implements the same interface.</p>
</dd>
<dt><a href="#ResourceNotFoundError">ResourceNotFoundError</a></dt>
<dd><p>Thrown by <code>SObject.prototype.get()</code> if it doesn&#39;t find a record matching the provided search options.
You can import this class to check if an error is an instance of it. In scenarios where you would
prefer this error not be thrown, use <code>query()</code> instead of <code>get()</code>.</p>
</dd>
</dl>

<a name="LeftInnerJoinRelationship"></a>

## LeftInnerJoinRelationship
Most often, an entry in `SObject.prototype.propertyMap` simply defines a friendly alias for a property of a
SalesForce SObject (e.g. `{ listPrice: 'List_Price__c' }`). However, there comes a time in every developer's life when
a simple relationship won't cut it, and that's when this class comes in. It lets you define a more complex relationship involving a
[left inner join](https://developer.salesforce.com/page/A_Deeper_look_at_SOQL_and_Relationship_Queries_on_Force.com).

**Kind**: global class  
<a name="new_LeftInnerJoinRelationship_new"></a>

### new LeftInnerJoinRelationship(options)

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> |  |
| options.property | <code>string</code> | The SalesForce name of the property on the local object |
| options.relatedObject | <code>Object</code> |  |
| options.relatedObject.name | <code>string</code> | The name of the related SalesForce SObject |
| options.relatedObject.comparisonProperty | <code>string</code> | The name of the property against the local object's property will be compared |
| options.relatedObject.queryValueProperty | <code>string</code> | The name of the property used for querying |

**Example**  
```js
// For this example, imagine we have two custom objects that each have a property which references an Account:
//
// 1. Organization__c object with properties:
//     - Account__c
//     - Org_ID__c
//
// 2. Quote__c with property:
//     - Account__c
//
// This example demonstrates how to add an `organizationId` property for the quote object.
// The result is that `quoteStorage.query({ organizationId: 'org0' })` gets translated into the query
// "SELECT <other properties> FROM Quote__c where Account__c IN (SELECT Account__c FROM Organization__c WHERE Org_ID__c = 'org0'"

get propertyMap {
   // ...
   organizationId: new LeftInnerJoinRelationship({
       property: 'Account__c',
       relatedObject: {
           name: 'Organization__c',
           comparisonProperty: 'Account__c', // Organization__r.Account__c
           queryValueProperty: 'Org_ID__c'   // Organization__r.Org_ID__c
       }
   })
}
```
<a name="SObject"></a>

## SObject
Allows queries and CRUD operations to be performed on a SalesForce SObject with minimal setup and a friendly API.

Simply give it the SObject's name (e.g. `Account`) and a `propertyMap` which defines friendly names for the properties
in which you're interested (e.g. `{ primaryContactName: 'Primary_Contact__r.Name' }`). Now you can query and update records
using the friendly names, and this class takes care of the conversion to and from the SalesForce format.

To use this class, either extend it to override its `objectName` and `propertyMap` properties, or simply create an
instance by passing those properties into this class's constructor. Either approach will allow you to use the default
implementations of the CRUD methods (e.g. `query()`, `insert()`, etc.) which automatically handle the property name conversion.

**Kind**: global class  

* [SObject](#SObject)
    * [new SObject(options)](#new_SObject_new)
    * [.objectName](#SObject+objectName) : <code>string</code>
    * [.propertyMap](#SObject+propertyMap) : <code>Object</code>
    * [.getPropertyMap()](#SObject+getPropertyMap) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.get(options)](#SObject+get) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.query([options])](#SObject+query) ⇒ <code>Promise.&lt;Array.&lt;Object&gt;&gt;</code>
    * [.insert(entity)](#SObject+insert) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.update(entity)](#SObject+update) ⇒ <code>Object</code>
    * [.delete(options)](#SObject+delete) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.getReversePropertyMap()](#SObject+getReversePropertyMap) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.getPropertyNames()](#SObject+getPropertyNames) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
    * [.getSalesForcePropertyNames()](#SObject+getSalesForcePropertyNames) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
    * [.convertFromSalesForceFormat(entity)](#SObject+convertFromSalesForceFormat) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.getInsertRequestOptions(options)](#SObject+getInsertRequestOptions)
    * [.convertArrayFromSalesForceFormat(entities)](#SObject+convertArrayFromSalesForceFormat) ⇒ <code>Promise.&lt;Array.&lt;Object&gt;&gt;</code>
    * [.convertToSalesForceFormat(entity, options)](#SObject+convertToSalesForceFormat) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.convertArrayToSalesForceFormat(entities)](#SObject+convertArrayToSalesForceFormat) ⇒ <code>Promise.&lt;Array.&lt;Object&gt;&gt;</code>
    * [.buildQueryStatement(options)](#SObject+buildQueryStatement) ⇒ <code>Promise.&lt;string&gt;</code>
    * [.executeQuery(query)](#SObject+executeQuery) ⇒ <code>Array.&lt;Objects&gt;</code>

<a name="new_SObject_new"></a>

### new SObject(options)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>object</code> |  |  |
| options.connection | <code>[SalesForceConnection](#SalesForceConnection)</code> |  | Either an instance of this module's default `SalesForceConnection`                                                             class or a custom version which implements that simple interface. |
| [options.objectName] | <code>string</code> |  | Allows the `objectName` to be defined without                                                             creating a subclass to override that property. |
| [options.propertyMap] | <code>object</code> |  | Allows the `propertyMap` to be defined without                                                             creating a subclass to override that property. |
| [options.apiVersion] | <code>int</code> &#124; <code>float</code> &#124; <code>string</code> | <code>&#x27;34.0&#x27;</code> | e.g. `'30.0'`, `31`, `32.0` |
| [options.logger] | <code>Object</code> |  | Optional Winston-style logger for capturing log output. |

<a name="SObject+objectName"></a>

### sObject.objectName : <code>string</code>
Override this class to specify your SObject's name, including any required prefixes and suffixes.

**Kind**: instance property of <code>[SObject](#SObject)</code>  
**Example**  
```js
get objectName() {
    return 'Order__c'
}
```
<a name="SObject+propertyMap"></a>

### sObject.propertyMap : <code>Object</code>
Defines friendly (i.e. camelCase) names for your SObject's SalesForce property names, which are often
riddled with suffixes, prefixes, and underscores. Nested SalesForce objects are also supported (e.g. `'Contact.Customer_Rep__r.Name'`).

Override this property to define your SObject's properties. If you instead need the property map to be dynamic
and determined asynchronously (for example, if you need to check a feature toggle to determine which properties
should be included), then override the asynchronous `getPropertyMap()` method instead.

**Kind**: instance property of <code>[SObject](#SObject)</code>  
**Example**  
```js
get propertyMap() {
    return {
        name: 'Name',
        primaryContactEmail: 'Primary_Contact__r.Email__c'
    };
}
```
<a name="SObject+getPropertyMap"></a>

### sObject.getPropertyMap() ⇒ <code>Promise.&lt;Object&gt;</code>
Defines friendly (i.e. camelCase) names for your SObject's SalesForce property names, which are often
riddled with suffixes, prefixes, and underscores. Nested SalesForce objects are also supported (e.g. `'Contact.Customer_Rep__r.Name'`).

In most use cases, a property map is static, so it's easiest to override `propertyMap` to define your
SObject's properties. If you instead need the property map to be *dynamic* and determined asynchronously
(for example, if you need to check a feature toggle to determine whether a property should be included),
then override this asynchronous method instead. This can be useful, for example, for managing deployments.
Since `query()` and `get()` query for all the properties defined in the property map, the property map
can't contain any properties that haven't been defined in SalesForce (i.e. haven't been deployed yet).

**Kind**: instance method of <code>[SObject](#SObject)</code>  
**Example**  
```js
getPropertyMap() {

   let propertyMap = {
       name: 'Name',
       // ...
   };
   return checkMyFeatureToggle()
   .then(emailPropertyEnabled => {

       if (emailPropertyEnabled) {
           propertyMap.primaryContactEmail = 'Primary_Contact__r.Email__c';
       }
       return propertyMap;
   });
}
```
<a name="SObject+get"></a>

### sObject.get(options) ⇒ <code>Promise.&lt;Object&gt;</code>
Fetches a single object matching the property or combination of properties provided. If multiple
entities match the given options, then the first is returned. If there are no matches, a
`ResourceNotFoundError` is thrown. Use `query()` instead if you want greater than or less than 1 result.

**Kind**: instance method of <code>[SObject](#SObject)</code>  
**Throws**:

- <code>[ResourceNotFoundError](#ResourceNotFoundError)</code> 


| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Names and values of properties that will be ANDed together for the search |

<a name="SObject+query"></a>

### sObject.query([options]) ⇒ <code>Promise.&lt;Array.&lt;Object&gt;&gt;</code>
Queries for entities matching the given search properties. If no options are provided, all entities are returned.

**Kind**: instance method of <code>[SObject](#SObject)</code>  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | Names and values of properties that will be ANDed together for the search |

<a name="SObject+insert"></a>

### sObject.insert(entity) ⇒ <code>Promise.&lt;Object&gt;</code>
Inserts the given entity.

**Kind**: instance method of <code>[SObject](#SObject)</code>  
**Returns**: <code>Promise.&lt;Object&gt;</code> - - Object with an `id` property indicating the ID of the created entity.  

| Param | Type |
| --- | --- |
| entity | <code>Object</code> | 

<a name="SObject+update"></a>

### sObject.update(entity) ⇒ <code>Object</code>
Patches an entity by updating only the properties specified.

**Kind**: instance method of <code>[SObject](#SObject)</code>  
**Returns**: <code>Object</code> - result     - Object with an `id` property indicating the ID of the updated entity.  

| Param | Type | Description |
| --- | --- | --- |
| entity | <code>Object</code> |  |
| entity.id | <code>string</code> | An `id` property is required for updates. |
| entity.* | <code>\*</code> | Properties with which to patch the existing entity. |

<a name="SObject+delete"></a>

### sObject.delete(options) ⇒ <code>Promise.&lt;Object&gt;</code>
Deletes the given entity entity.

**Kind**: instance method of <code>[SObject](#SObject)</code>  
**Returns**: <code>Promise.&lt;Object&gt;</code> - - Object with an `id` property indicating the ID of the deleted entity.  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> |  |
| options.id | <code>string</code> | An `id` property is required for deletion. |

<a name="SObject+getReversePropertyMap"></a>

### sObject.getReversePropertyMap() ⇒ <code>Promise.&lt;Object&gt;</code>
Like `getPropertyMap`, but the reverse - mapping ugly SalesForce property names of
properties to their friendly names.

Unlike `getPropertyMap`, which can include both basic name-to-name mappings and more complex
relationship type objects (i.e. `LeftInnerJoinRelationship`), reversePropertyMap only includes
basic name-to-name mappings.

**Kind**: instance method of <code>[SObject](#SObject)</code>  
<a name="SObject+getPropertyNames"></a>

### sObject.getPropertyNames() ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
Returns the 'friendly' property names for the properties.

**Kind**: instance method of <code>[SObject](#SObject)</code>  
<a name="SObject+getSalesForcePropertyNames"></a>

### sObject.getSalesForcePropertyNames() ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
Returns the SalesForce property names defined for the SObject.

**Kind**: instance method of <code>[SObject](#SObject)</code>  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - The SalesForce property names.  
<a name="SObject+convertFromSalesForceFormat"></a>

### sObject.convertFromSalesForceFormat(entity) ⇒ <code>Promise.&lt;Object&gt;</code>
Transforms the property names of the entity according to the property map.
You can override this method if you want to do additional or different formatting.

**Kind**: instance method of <code>[SObject](#SObject)</code>  

| Param | Type |
| --- | --- |
| entity | <code>Object</code> | 

<a name="SObject+getInsertRequestOptions"></a>

### sObject.getInsertRequestOptions(options)
Acts as a customization point for insert requests. A subclass can override this method
to supply additional options that will be passed to `connection.request()` for an insert, like headers.

**Kind**: instance method of <code>[SObject](#SObject)</code>  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Options that will be passed to `connection.request()` for an insert |

**Example**  
```js
// Adds the 'Sforce-Auto-Assign' header to prevent SalesForce from assigning a newly inserted
// lead to the default user.
getInsertRequestOptions(...args) {
    let params = super.getInsertRequestOptions(...args);
    if (!params.headers) { params.headers = {}; }
    params.headers['Sforce-Auto-Assign'] = 'FALSE';
    return params;
}
```
<a name="SObject+convertArrayFromSalesForceFormat"></a>

### sObject.convertArrayFromSalesForceFormat(entities) ⇒ <code>Promise.&lt;Array.&lt;Object&gt;&gt;</code>
Converts an array of entities from their ugly SalesForce format to their friendly format.

**Kind**: instance method of <code>[SObject](#SObject)</code>  

| Param | Type |
| --- | --- |
| entities | <code>Array.&lt;Object&gt;</code> | 

<a name="SObject+convertToSalesForceFormat"></a>

### sObject.convertToSalesForceFormat(entity, options) ⇒ <code>Promise.&lt;Object&gt;</code>
Transforms the property names of the given entity according to the property map and
removes properties not included in the map.

**Kind**: instance method of <code>[SObject](#SObject)</code>  

| Param | Type | Description |
| --- | --- | --- |
| entity | <code>Object</code> |  |
| options | <code>Object</code> |  |
| [options.includeAttributesProperty] | <code>boolean</code> | When we get deserialized SObjects from the REST data API,                                                           each entity has an 'attributes' property containing the name                                                           of its SObject type and its URL. This parameter optionally                                                           includes this 'attributes' property so that the resulting object                                                           is in a format that can be deserialized back into a native                                                           SObject in Apex code. |
| [options.includeNestedProperties] | <code>boolean</code> | Used to optionally allow nested properties in the output (disabled                                                           by default). |

<a name="SObject+convertArrayToSalesForceFormat"></a>

### sObject.convertArrayToSalesForceFormat(entities) ⇒ <code>Promise.&lt;Array.&lt;Object&gt;&gt;</code>
Converts an array of entities from their frienly format to their ugly SalesForce format.

**Kind**: instance method of <code>[SObject](#SObject)</code>  

| Param | Type |
| --- | --- |
| entities | <code>Array.&lt;Object&gt;</code> | 

<a name="SObject+buildQueryStatement"></a>

### sObject.buildQueryStatement(options) ⇒ <code>Promise.&lt;string&gt;</code>
Builds a SOQL query from the given query options.

**Kind**: instance method of <code>[SObject](#SObject)</code>  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Query options, which are the friendly names and values that the query results will match. |

<a name="SObject+executeQuery"></a>

### sObject.executeQuery(query) ⇒ <code>Array.&lt;Objects&gt;</code>
Returns all results for the given SOQL query.

**Kind**: instance method of <code>[SObject](#SObject)</code>  
**Returns**: <code>Array.&lt;Objects&gt;</code> - - Results in SalesForce format.  

| Param | Type | Description |
| --- | --- | --- |
| query | <code>string</code> | SOQL query |

<a name="SalesForceConnection"></a>

## SalesForceConnection
Manages a session with and sends requests to SalesForce's REST API. It handles authentication and automatically retries
common request failures (e.g. the infamous `UNABLE_TO_LOCK_ROW` error).

This class's interface consists of a single `request()` method, so if you want different request-level functionality, you
can easily extend this class or implement a replacement which implements the same interface.

**Kind**: global class  

* [SalesForceConnection](#SalesForceConnection)
    * [new SalesForceConnection(options)](#new_SalesForceConnection_new)
    * [.request(options)](#SalesForceConnection+request) ⇒ <code>Promise</code>

<a name="new_SalesForceConnection_new"></a>

### new SalesForceConnection(options)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  |  |
| options.loginUrl | <code>string</code> |  | SalesForce OAuth login URI (e.g. `'https://test.salesforce.com/services/oauth2/token'`). |
| options.clientId | <code>string</code> |  | API user client ID |
| options.clientSecret | <code>string</code> |  | API user client secret |
| options.username | <code>string</code> |  | API user username |
| options.password | <code>string</code> |  | Depending on your security settings, you often will need to append a security                                                              token to the end of your password. |
| [options.requestRetriesMax] | <code>int</code> | <code>4</code> | The number of times an request will be retried if it throws an error that's not                                                              a BadRequestError or ResourceNotFoundError. |
| [options.requestTimeoutMs] | <code>int</code> | <code>30000</code> |  |
| [options.logger] | <code>Object</code> |  | Optional Winston-style logger for capturing log output. |

<a name="SalesForceConnection+request"></a>

### salesForceConnection.request(options) ⇒ <code>Promise</code>
Sends a request to the SalesForce REST API. The options available are those for the [`request` module](https://www.npmjs.com/package/request),
although in reality, only the small subset of options listed here are used by SObject.

**Kind**: instance method of <code>[SalesForceConnection](#SalesForceConnection)</code>  
**Returns**: <code>Promise</code> - - Promise that resolve to the deserialized response body  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | options passed to the `request` module |
| options.url | <code>string</code> | The relative API URL path (e.g. `'services/data/v36.0/sobjects/Account/00129000009VuH3AAK'`).                                           Unlike the other options, this one isn't passed directly to the `request` module; it's appended                                           to the instance URL obtained through authentication |
| options.method | <code>string</code> | e.g. `'post'`, `'get'` |
| options.json | <code>Object</code> &#124; <code>bool</code> |  |
| options.headers | <code>Object</code> |  |

<a name="ResourceNotFoundError"></a>

## ResourceNotFoundError
Thrown by `SObject.prototype.get()` if it doesn't find a record matching the provided search options.
You can import this class to check if an error is an instance of it. In scenarios where you would
prefer this error not be thrown, use `query()` instead of `get()`.

**Kind**: global class  
