import { expect } from 'chai';
import { spy, stub, createStubInstance } from 'sinon';
import _ from 'lodash';
import { ParameterValidationError } from 'parameter-validator';
import SObject from '../src/SObject';
import SalesForceConnection from '../src/SalesForceConnection';
import LeftInnerJoinRelationship from '../src/LeftInnerJoinRelationship';

describe('SObject', () => {

    let storage,
        connection,
        objectName,
        propertyMap,
        salesForceEntity,
        friendlyFormattedEntity,
        salesForceEntity2,
        friendlyFormattedEntity2,
        salesForceEntities,
        friendlyFormattedEntities,
        idEntities,
        salesForceEntitiesWithAttributes,
        constructorParams,
        connectionWithLoginError,
        reversePropertyMap,
        dataServicesUrlPath,
        failedLoginPromise;

    beforeEach(() => {

        idEntities = [ { id: 'pet0' }, { id: 'pet1' } ];

        let failedLoginError = new Error('failed login');
        failedLoginError.statusCode = 401;
        failedLoginPromise = Promise.reject(failedLoginError);
        dataServicesUrlPath = 'http://test.party/';
        connection = createStubInstance(SalesForceConnection);
        connection.request.returns(Promise.resolve({ entities: idEntities }));
        objectName = 'Pet__c';

        propertyMap = {
            id: 'Id',
            name: 'Name',
            contactId: 'ContactId__c',
            type: 'Type__c',
            shippingAddressId: 'ShippingAddressId__c'
        };

        reversePropertyMap = {};

        for (let propertyName in propertyMap) {
            let salesForcePropertyName = propertyMap[propertyName];
            reversePropertyMap[salesForcePropertyName] = propertyName;
        }

        constructorParams = { connection, objectName, propertyMap };
        storage = new SObject(constructorParams);
        salesForceEntity = {
            Id: 'pet0',
            Name: 'Jimothy',
            ContactId__c: 'contact0',
            Type__c: 'Tarantula',
            ShippingAddressId__c: 'address0'
        };
        friendlyFormattedEntity = {
            id: 'pet0',
            name: 'Jimothy',
            contactId: 'contact0',
            type: 'Tarantula',
            shippingAddressId: 'address0'
        };
        salesForceEntity2 = {
            Id: 'pet1',
            Name: 'Bevan',
            ContactId__c: 'contact1',
            Type__c: 'Hamster',
            ShippingAddressId__c: 'address1'
        };
        friendlyFormattedEntity2 = {
            id: 'pet1',
            name: 'Bevan',
            contactId: 'contact1',
            type: 'Hamster',
            shippingAddressId: 'address1'
        };
        salesForceEntities = [ salesForceEntity, salesForceEntity2 ];
        salesForceEntitiesWithAttributes = salesForceEntities.map(entity => {
            entity = _.cloneDeep(entity);
            entity.attributes = {type: 'Pet__c'};
            return entity;
        });
        friendlyFormattedEntities = [ friendlyFormattedEntity, friendlyFormattedEntity2 ];
    });

    describe('constructor', () => {

        it(`throws a ParameterValidationError if required parameters aren't included`, () => {

            try {
                storage = new SObject();
                throw new Error(`Constructor didn't throw an error like it's supposed to.`);
            } catch(error) {
                expect(error).to.be.instanceof(ParameterValidationError);
            }

            try {
                storage = new SObject({});
                throw new Error(`Constructor didn't throw an error like it's supposed to.`);
            } catch(error) {
                expect(error).to.be.instanceof(ParameterValidationError);
            }
        });

        it(`allows the objectName and propertyMap properties to be optionally defined as parameters`, () => {

            let objectName = 'Cat__c',
                propertyMap = {
                    name: 'CatName__c',
                    id: 'Id',
                    shippingAddressId: 'ShippingAddressId__c'
                };

            storage = new SObject({ connection, objectName, propertyMap });

            expect(storage.objectName).to.equal(objectName);
            expect(storage.propertyMap).to.equal(propertyMap);
        });

        it(`sets the instance's logger if one is provided`, () => {

            let customerLogger = { error: spy() };
            constructorParams.logger = customerLogger;
            storage = new SObject(constructorParams);

            return storage.insert() // Invoke insert without args so that an error is thrown and logged.
            .catch(() => {})        // Swallow the error
            .then(() => {
                expect(customerLogger.error.callCount).to.equal(1);
                expect(customerLogger.error.firstCall.args[0]).to.equal('Error in Salesforce request');
            });
        });
    });

    describe('when login fails', () => {

        describe('get', () => {

            it(`doesn't append multiple error messages`, () => {

                storage.get = stub().returns(failedLoginPromise);

                return storage.get({ id: 'pet0' })
                .then(() => {
                    throw new Error('Expected first get to throw an error');
                })
                .catch(error => {
                    expect(error.message).to.equal('failed login');  // i.e. doesn't include the request data for this request
                    return storage.get({ id: 'pet1' });
                })
                .then(() => {
                    throw new Error('Expected second get to throw an error');
                })
                .catch(error => {
                    expect(error.message).to.equal('failed login');  // i.e. doesn't include the request data for this or the previous request
                });
            });
        });
    });

    describe('insert()', () => {

        it('converts the entity using convertToSalesForceFormat()', () => {

            spy(storage, 'convertToSalesForceFormat');

            return storage.insert(friendlyFormattedEntity)
            .then(() => {
                expect(storage.convertToSalesForceFormat.callCount).to.equal(1);
                expect(storage.convertToSalesForceFormat.firstCall.args).to.deep.equal([ friendlyFormattedEntity ]);
            });
        });

        it('passes the formatted entity to getInsertRequestOptions() in order to get the params for request()', () => {

            let formattedEntity = { property1: 'first', property2: 'second' },
                requestParams = { mockParams: true };

            stub(storage, 'convertToSalesForceFormat').returns(Promise.resolve(formattedEntity));
            stub(storage, 'getInsertRequestOptions').returns(requestParams);

            return storage.insert(friendlyFormattedEntity)
            .then(() => {
                expect(storage.getInsertRequestOptions.callCount).to.equal(1);
                expect(storage.getInsertRequestOptions.firstCall.args).to.deep.equal([ formattedEntity ]);
                expect(connection.request.callCount).to.equal(1);
                expect(connection.request.firstCall.args).to.deep.equal([ requestParams ]);
            });
        });
    });

    describe('update()', () => {

        it('throws a ParameterValidationError if the "id" parameter is omitted', () => {

            return storage.update(_.omit(friendlyFormattedEntity, [ 'id' ]))
            .then(() => {
                throw new Error(`The method didn't throw an error like it's supposed to.`);
            })
            .catch(error => {
                expect(error).to.be.instanceof(ParameterValidationError);
            });
        });

        it('removes the "id" parameter from the entity and converts it using convertToSalesForceFormat()', () => {

            spy(storage, 'convertToSalesForceFormat');

            let expectedEntity = _.omit(friendlyFormattedEntity, [ 'id' ]);

            return storage.update(friendlyFormattedEntity)
            .then(() => {
                expect(storage.convertToSalesForceFormat.callCount).to.equal(1);
                expect(storage.convertToSalesForceFormat.firstCall.args).to.deep.equal([expectedEntity]);
            });
        });

        it('passes the formatted entity to connection.request() to send the request', () => {

            let formattedEntity = { property1: 'first', property2: 'second' };
            stub(storage, 'convertToSalesForceFormat').returns(Promise.resolve(formattedEntity));

            return storage.update(friendlyFormattedEntity)
            .then(() => {
                expect(connection.request.callCount).to.equal(1);
                expect(connection.request.firstCall.args).to.deep.equal([{
                    url: 'services/data/v34.0/sobjects/Pet__c/pet0',
                    method: 'patch',
                    json: formattedEntity
                }]);
            });
        });
    });

    describe('buildQueryStatement()', () => {

        beforeEach(() => {

            // This property indicates that there's a Pet__r.Owner__c property that references some sort of person object
            // and that there's also an SObject named Address__c with a Address__r.Person__c property that is a reference to
            // the same type of person object. This LeftInnerJoinRelationship creates a `streetAddress` query property that allows
            // Pet__c records to be looked up by the home's street address. I.e.:
            //
            // `query({ streetAddress: '7601 Interactive Way' })` looks pets with owners that have a home with that address.
            let streetAddress = new LeftInnerJoinRelationship({
                property: 'Owner__c',

                relatedObject: {
                    name: 'Address__c',
                    comparisonProperty: 'Person__c',
                    queryValueProperty: 'StreetAddress__c'
                }
            });

            propertyMap.streetAddress = streetAddress;
            storage = new SObject(constructorParams);
        });

        it(`doesn't include a WHERE clause if no options argument is provided`, () => {

            return storage.buildQueryStatement()
            .then(statement => {
                expect(statement).to.equal('SELECT ContactId__c, Id, Name, ShippingAddressId__c, Type__c FROM Pet__c  ORDER BY CreatedDate DESC');
            });
        });

        it(`doesn't include a WHERE clause if an empty options argument is provided`, () => {

            return storage.buildQueryStatement({})
            .then(statement => {
                expect(statement).to.equal('SELECT ContactId__c, Id, Name, ShippingAddressId__c, Type__c FROM Pet__c  ORDER BY CreatedDate DESC');
            });
        });

        it('includes quotes when including a string in a WHERE clause', () => {

            return storage.buildQueryStatement({ shippingAddressId: 'address0' })
            .then(statement => {
                expect(statement).to.equal(`SELECT ContactId__c, Id, Name, ShippingAddressId__c, Type__c FROM Pet__c WHERE ShippingAddressId__c = 'address0' ORDER BY CreatedDate DESC`);
            });
        });

        it(`doesn't include quotes when including a number in a WHERE clause`, () => {

            return storage.buildQueryStatement({ shippingAddressId: 1234 })
            .then(statement => {
                expect(statement).to.equal(`SELECT ContactId__c, Id, Name, ShippingAddressId__c, Type__c FROM Pet__c WHERE ShippingAddressId__c = 1234 ORDER BY CreatedDate DESC`);
            });
        });

        describe('when a query property is provided for which a LeftInnerJoinRelationship is defined', () => {

            it('includes a left inner join statement that includes quotes around the value when the value is a string', () => {

                return storage.buildQueryStatement({ streetAddress: '7601 Interactive Way' })
                .then(statement => {
                    expect(statement).to.equal(`SELECT ContactId__c, Id, Name, ShippingAddressId__c, Type__c FROM Pet__c WHERE Owner__c IN (SELECT Person__c FROM Address__c WHERE StreetAddress__c = '7601 Interactive Way') ORDER BY CreatedDate DESC`);
                });
            });

            it(`includes a left inner join statement that doesn't include quotes around the value when the value is a number`, () => {

                return storage.buildQueryStatement({ streetAddress: 999 })
                .then(statement => {
                    expect(statement).to.equal(`SELECT ContactId__c, Id, Name, ShippingAddressId__c, Type__c FROM Pet__c WHERE Owner__c IN (SELECT Person__c FROM Address__c WHERE StreetAddress__c = 999) ORDER BY CreatedDate DESC`);
                });
            });
        });

        it(`combines multiple query properties in the provided in the options parameter using AND`, () => {

            return storage.buildQueryStatement({ shippingAddressId: 1234, contactId: 'contact0', streetAddress: '7601 Interactive Way' })
            .then(statement => {
                expect(statement).to.equal(`SELECT ContactId__c, Id, Name, ShippingAddressId__c, Type__c FROM Pet__c WHERE ContactId__c = 'contact0' AND ShippingAddressId__c = 1234 AND Owner__c IN (SELECT Person__c FROM Address__c WHERE StreetAddress__c = '7601 Interactive Way') ORDER BY CreatedDate DESC`);
            });
        });

        describe('when the value of a query property is an array', () => {

            it('combines the possible values in the array using OR', () => {

                return storage.buildQueryStatement({ shippingAddressId: 1234, contactId: [ 'contact0', 'contact1' ]})
                .then(statement => {
                    expect(statement).to.equal(`SELECT ContactId__c, Id, Name, ShippingAddressId__c, Type__c FROM Pet__c WHERE (ContactId__c = 'contact0' OR ContactId__c = 'contact1') AND ShippingAddressId__c = 1234 ORDER BY CreatedDate DESC`);
                });
            });
        });
    });

    describe('convertFromSalesForceFormat()', () => {

        it(`uses convertPropertyNames and the property map returned by getReversePropertyMap() to convert the entity's property names`, () => {

            spy(storage, '_convertPropertyNames');

            let expectedPropertyMap = { property1: 'first', property2: 'second' };
            stub(storage, 'getReversePropertyMap').returns(Promise.resolve(expectedPropertyMap));

            return storage.convertFromSalesForceFormat(salesForceEntity)
            .then(() => {
                expect(storage.getReversePropertyMap.callCount).to.equal(1);
                expect(storage._convertPropertyNames.callCount).to.equal(1);
                expect(storage._convertPropertyNames.firstCall.args[0]).to.equal(salesForceEntity);
                expect(storage._convertPropertyNames.firstCall.args[1]).to.deep.equal(expectedPropertyMap);
            });
        });

        it(`removes properties that aren't listed in the propertyMap`, () => {

            salesForceEntity.Age__c = 200;
            salesForceEntity.Skills__c = [ 'magic', 'flying' ];

            return storage.convertFromSalesForceFormat(salesForceEntity)
            .then(convertedEntity => {
                expect(convertedEntity).to.deep.equal(friendlyFormattedEntity);
            });
        });
    });

    describe('convertArrayFromSalesForceFormat()', () => {

        it('throws a ParameterValidationError if the first argument is not an array', () => {

            return storage.convertArrayFromSalesForceFormat()
            .then(() => {
                throw new Error(`Method didn't throw an error like it's supposed to.`);
            })
            .catch(error => {
                expect(error).to.be.instanceof(ParameterValidationError);
            });
        });

        it('calls convertFromSalesForceFormat() for each of the entities and returns the formatted result', () => {

            spy(storage, 'convertFromSalesForceFormat');

            return storage.convertArrayFromSalesForceFormat(salesForceEntities)
            .then(convertedEntities => {

                expect(storage.convertFromSalesForceFormat.callCount).to.equal(2);
                expect(storage.convertFromSalesForceFormat.firstCall.args[0]).to.deep.equal(salesForceEntity);
                expect(storage.convertFromSalesForceFormat.secondCall.args[0]).to.deep.equal(salesForceEntity2);
                expect(convertedEntities).to.deep.equal(friendlyFormattedEntities);
            });
        });
    });

    describe('convertToSalesForceFormat()', () => {

        it(`converts the entity using convertPropertyNames() and the property map from getPropertyMap()`, () => {

            spy(storage, '_convertPropertyNames');

            let expectedPropertyMap = { property1: 'first', property2: 'second' };
            stub(storage, 'getPropertyMap').returns(Promise.resolve(expectedPropertyMap));

            let reversePropertyMap = { first: 'property1', second: 'property2' };
            stub(storage, 'getReversePropertyMap').returns(Promise.resolve(reversePropertyMap));

            return storage.convertToSalesForceFormat(friendlyFormattedEntity)
            .then(() => {
                expect(storage.getPropertyMap.callCount).to.equal(1);
                expect(storage._convertPropertyNames.callCount).to.equal(1);
                expect(storage._convertPropertyNames.firstCall.args[0]).to.equal(friendlyFormattedEntity);
                expect(storage._convertPropertyNames.firstCall.args[1]).to.deep.equal(expectedPropertyMap);
            });
        });

        it(`removes properties that aren't listed in the propertyMap, and doesn't include an attribute property on entities by default`, () => {

            friendlyFormattedEntity.age = 200;
            friendlyFormattedEntity.skills = ['magic', 'flying'];

            return storage.convertToSalesForceFormat(friendlyFormattedEntity)
            .then(convertedEntity => {
                expect(convertedEntity).to.deep.equal(salesForceEntity);
            });
        });

        it(`doesn't include an attribute property on entities if the includeAttributseProperty option is false`, () => {

            return storage.convertToSalesForceFormat(friendlyFormattedEntity, { includeAttributesProperty: false })
            .then(convertedEntity => {
                expect(convertedEntity).to.deep.equal(salesForceEntity);
            });
        });

        it(`includes an attribute property on entities if the includeAttributesProperty option is true`, () => {

            salesForceEntity.attributes = {type: 'Pet__c'};

            return storage.convertToSalesForceFormat(friendlyFormattedEntity, { includeAttributesProperty: true })
            .then(convertedEntity => {
                expect(convertedEntity).to.deep.equal(salesForceEntity);
            });
        });
    });

    describe('convertArrayToSalesForceFormat()', () => {

        it('throws a ParameterValidationError if the first argument is not an array', () => {

            return storage.convertArrayToSalesForceFormat()
            .then(() => {
                throw new Error(`Method didn't throw an error like it's supposed to.`);
            })
            .catch(error => {
                expect(error).to.be.instanceof(ParameterValidationError);
            });
        });

        it('calls convertToSalesForceFormat() for each of the entities and returns the formatted results, which each include an attributes property by default', () => {

            spy(storage, 'convertToSalesForceFormat');

            return storage.convertArrayToSalesForceFormat(friendlyFormattedEntities)
            .then(convertedEntities => {

                expect(storage.convertToSalesForceFormat.callCount).to.equal(2);
                expect(storage.convertToSalesForceFormat.firstCall.args[0]).to.deep.equal(friendlyFormattedEntity);
                expect(storage.convertToSalesForceFormat.secondCall.args[0]).to.deep.equal(friendlyFormattedEntity2);
                expect(convertedEntities).to.deep.equal(salesForceEntitiesWithAttributes);
            });
        });
    });

    describe('getPropertyNames()', () => {

        it('returns all of the properties in `propertyMap`', () => {

            return storage.getPropertyNames()
            .then(propertyNames => expect(propertyNames).to.deep.equal(Object.keys(propertyMap).sort()));
        });
    });

    describe('getSalesForcePropertyNames()', () => {

        it('returns all of the SalesForce property names in `propertyMap`', () => {

            let expectedPropertyNames = Object.keys(storage.propertyMap).map(key => storage.propertyMap[key]).sort();

            return storage.getSalesForcePropertyNames()
            .then(propertyNames => expect(propertyNames).to.deep.equal(expectedPropertyNames));
        });

        it(`doesn't contain duplicates when propertyMap defines multiple property names that map to the same SalesForce property`, () => {

            let friendlyPropertyToBeDuplicated = Object.keys(propertyMap)[0],
                salesForcePropertyToBeDuplicated = propertyMap[friendlyPropertyToBeDuplicated];

            let propertyMapWithDuplicate = Object.assign({ anotherProperty: salesForcePropertyToBeDuplicated }, propertyMap);

            constructorParams.propertyMap = propertyMapWithDuplicate;

            storage = new SObject(constructorParams);

            let expectedPropertyNames = Object.keys(propertyMap).map(key => storage.propertyMap[key]).sort();

            return storage.getSalesForcePropertyNames()
            .then(propertyNames => expect(propertyNames).to.deep.equal(expectedPropertyNames));
        });
    });

    describe('getPropertyMap()', () => {

        it('returns all of the properties in `propertyMap`', () => {

            return storage.getPropertyMap()
            .then(actualPropertyMap => expect(actualPropertyMap).to.deep.equal(propertyMap));
        });
    });

    describe('getReversePropertyMap()', () => {

        it('returns a reversed version of `propertyMap`', () => {

            return storage.getReversePropertyMap()
            .then(actualPropertyMap => expect(actualPropertyMap).to.deep.equal(reversePropertyMap));
        });
    });
});
