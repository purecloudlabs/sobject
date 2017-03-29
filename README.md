# SalesForce SObject

Allows queries and CRUD operations to be performed on a SalesForce SObject with minimal setup and a friendly API.

Simply give it the SObject's name (e.g. `'Account'`) and an object which defines friendly names for the properties in which you're interested (e.g. `{ primaryContactName: 'Primary_Contact__r.Name' }`). **Now you can query and update records using the friendly names, and this class takes care of the conversion to and from the SalesForce format.**

## Basic Usage

Either extend `SObject` to override its `objectName` and `propertyMap` properties, or simply create an instance by passing those properties into this class's constructor. Either approach will allow you to use the default implementations of the CRUD methods (e.g. `query()`, `insert()`, etc.) which automatically handle the property name conversion.

```js
// AccountStorage.js: This shows how you extend SObject for your various objects. Keeping these declarations
//                    in separate files is a good idea if you're working with many different objects.

import SObject from 'sobject';

export default class AccountStorage extends SObject {

    get objectName() {
        return 'Account';
    }

    get propertyMap() {
        return {
            id: 'Id',
            name: 'Name',
            primaryContactId: 'Primary_Contact__c'
            primaryContactEmail: 'Primary_Contact__r.Email'
        };
    }
}
```


```js
// index.js
import { SObject, SalesForceConnection } from 'sobject';
import AccountStorage from './AccountStorage';

// Create a connection, which handles sending authenticated requests to the API.
let connection = new SalesForceConnection({

    loginUrl: 'https://test.salesforce.com/services/oauth2/token',
    clientId: '3MVG9lKcPoNINVBJSoQsNCD.HHDdbugPsNXwwyFbgb47KWa_PTv',
    clientSecret: '5678471853609579508',
    username: 'steve.stevens@example.com',
    password: 'I❤️SalesForce'
});

// Instantiate the class we created for handling Account objects.
let accountStorage = new AccountStorage({ connection });

// We can also just create an SObject by passing its constructor those `objectName` and `propertyMap`
// properties. This is handy for simple scripting.
let contactStorage = new SObject({
    connection,
    objectName: 'Contact',
    propertyMap: {
        id: 'Id',
        accountId: 'AccountId',
        firstName: 'FirstName',
        lastName: 'LastName',
        email: 'Email'
    }
});

let accountId;

// Get a specific account by name
accountStorage.get({ name: 'Goofy Roofers' })
.then(account => {

    accountId = account.id;

    // Insert a new contact for the account
    return contactStorage.insert({
        accountId,
        firstName: 'Jimothy',
        last: 'Bagelson',
        email: 'jimothy.bagelson@example.com'
    });
})
.then(contact => {
    // Set the account's custom field using the new contact.
    return accountStorage.update({ id: accountId, primaryContactId: contact.id });
})
.then(() => {
    // Get the account again, this time querying by a field on its nested contact object.
    return accountStorage.query({ primaryContactEmail: 'jimothy.bagelson@example.com' });
})
.then(account => {
    // Delete the contact we had created.
    return Promise.all([
        contactStorage.delete({ id: account.primaryContactId }),
        accountStorage.update({ id: accountId, primaryContactId: null })
    ]);
});
```

For more detailed information, check out [this module's API docs](https://github.com/MyPureCloud/sobject/blob/master/docs/api.md) and the [SalesForce documentation on setting up REST API authorization](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/quickstart_oauth.htm).

## Development

This module is written in ES2015, but is currently transpiled to ES5 for distribution.

### Building

```
npm run build
```

There's also a git pre-commit hook which automatically transpiles and regenerates the docs upon commit.

### Testing

```
npm test
```
