/*jshint expr: true*/
import { expect } from 'chai';
import { spy, stub } from 'sinon';
import _ from 'lodash';
import MockRequestor from '../../../util/MockRequestor';
import SObjectStorage from '../../../../src/interop/salesforce/storage/SObjectStorage';
import { LeftInnerJoinRelationship } from '../../../../src/interop/salesforce/storage/SObjectStorage';
import { ParameterValidationError } from 'parameter-validator';
import convertPropertyNames from '../../../../src/util/convertPropertyNames';
import { BadRequestError } from '../../../../src/models/errors';

describe('SObjectStorage', () => {
    let storage, salesForceClient, salesForceObjectName, propertyMap, salesForceEntity, friendlyFormattedEntity,
        salesForceEntity2, friendlyFormattedEntity2, salesForceEntities, friendlyFormattedEntities, requestor,
        idEntities, salesForceEntitiesWithAttributes, constructorParams, salesForceClientWithLoginError,
        storageWithLoginError, requestorWithLoginError, logger, reversePropertyMap, dataServicesUrlPath;

    beforeEach(() => {
        logger = {
            info: spy(),
            debug: spy(),
            silly: spy(),
            warn: spy(),
            error: spy()
        };
        idEntities = [{id: 'pet0'}, {id: 'pet1'}];
        requestor = new MockRequestor({ body: { entities: idEntities }});
        requestorWithLoginError = new MockRequestor({ body: { entities: idEntities }});
        let failedLoginPromise = Promise.resolve().then(() => {
            throw new BadRequestError('failed login');
        });
        requestorWithLoginError.execute = () => {
            return failedLoginPromise;
        };

        dataServicesUrlPath = 'http://test.party/';

        salesForceClient = {
            getBasicRequestor: spy(() => Promise.resolve(requestor)),
            apexRestServicesUrlPath: 'services/apexrest/',
            logger,
            dataServicesUrlPath
        };
        salesForceClientWithLoginError = {
            getBasicRequestor: spy(() => Promise.resolve(requestorWithLoginError)),
            apexRestServicesUrlPath: 'services/apexrest/',
            logger
        };

        salesForceObjectName = 'Pet__c';
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

        constructorParams = { salesForceClient, salesForceObjectName, propertyMap };
        storage = new SObjectStorage(constructorParams);
        storageWithLoginError = new SObjectStorage({ salesForceClient: salesForceClientWithLoginError, salesForceObjectName, propertyMap });
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
        salesForceEntities = [salesForceEntity, salesForceEntity2];
        salesForceEntitiesWithAttributes = salesForceEntities.map(entity => {
            entity = _.cloneDeep(entity);
            entity.attributes = {type: 'Pet__c'};
            return entity;
        });
        friendlyFormattedEntities = [friendlyFormattedEntity, friendlyFormattedEntity2];
    });

    describe('constructor', () => {
        it(`throws a ParameterValidationError if required parameters aren't included`, () => {

            try {
                storage = new SObjectStorage();
                throw new Error(`Constructor didn't throw an error like it's supposed to.`);
            } catch(error) {
                expect(error instanceof ParameterValidationError).to.equal(true);
            }

            try {
                storage = new SObjectStorage({});
                throw new Error(`Constructor didn't throw an error like it's supposed to.`);
            } catch(error) {
                expect(error instanceof ParameterValidationError).to.equal(true);
            }
        });

        it(`sets the required parameters as instance properties`, () => {
            storage = new SObjectStorage({salesForceClient});
            expect(storage.salesForceClient).to.equal(salesForceClient);
        });

        it(`allows the salesForceObjectName and propertyMap properties to be optionally defined as parameters`, () => {
            let salesForceObjectName = 'Cat__c',
                propertyMap = {
                    name: 'CatName__c',
                    id: 'Id',
                    shippingAddressId: 'ShippingAddressId__c'
                };

            storage = new SObjectStorage({salesForceClient, salesForceObjectName, propertyMap});

            expect(storage.salesForceObjectName).to.equal(salesForceObjectName);
            expect(storage.propertyMap).to.equal(propertyMap);
        });
    });

    describe('when login fails', () => {
        describe('get', () => {
            it(`doesn't append multiple error messages`, () => {
                return storageWithLoginError.get({ id: 'pet0' })
                .then(() => {
                    throw new Error('Expected first get to throw an error');
                }, err => {
                    expect(err.message).to.equal('failed login');  // i.e. doesn't include the request data for this request
                }).then(() => {
                    return storageWithLoginError.get({ id: 'pet1' })
                    .then(() => {
                        throw new Error('Expected second get to throw an error');
                    }, err => {
                        expect(err.message).to.equal('failed login');  // i.e. doesn't include the request data for this or the previous request
                    });
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
                expect(storage.convertToSalesForceFormat.firstCall.args).to.deep.equal([friendlyFormattedEntity]);
            });
        });

        it('passes the formatted entity to getInsertExecuteParams() in order to get the params for execute()', () => {

            let formattedEntity = { property1: 'first', property2: 'second' },
                executeParams = { mockParams: true };
            stub(storage, 'convertToSalesForceFormat').returns(Promise.resolve(formattedEntity));
            stub(storage, 'getInsertExecuteParams').returns(executeParams);

            return storage.insert(friendlyFormattedEntity)
            .then(() => {

                expect(storage.getInsertExecuteParams.callCount).to.equal(1);
                expect(storage.getInsertExecuteParams.firstCall.args).to.deep.equal([ formattedEntity ]);
                expect(requestor.execute.callCount).to.equal(1);
                expect(requestor.execute.firstCall.args).to.deep.equal([ executeParams ]);
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
                expect(error instanceof ParameterValidationError).to.be.true;
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

        it('passes the formatted entity to requestor.execute() to send the request', () => {

            let formattedEntity = { property1: 'first', property2: 'second' };
            stub(storage, 'convertToSalesForceFormat').returns(Promise.resolve(formattedEntity));

            return storage.update(friendlyFormattedEntity)
            .then(() => {

                expect(requestor.execute.callCount).to.equal(1);
                expect(requestor.execute.firstCall.args).to.deep.equal([{
                    uri: `${dataServicesUrlPath}sobjects/Pet__c/pet0`,
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
            // `query.({ streetAddress: '7601 Interactive Way' })` looks pets with owners that have a home with that address.
            let streetAddress = new LeftInnerJoinRelationship({
                property: 'Owner__c',

                relatedObject: {
                    name: 'Address__c',
                    comparisonProperty: 'Person__c',
                    queryValueProperty: 'StreetAddress__c'
                }
            });

            propertyMap.streetAddress = streetAddress;

            storage = new SObjectStorage(constructorParams);
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

            spy(storage, 'convertPropertyNames');

            let expectedPropertyMap = { property1: 'first', property2: 'second' };
            stub(storage, 'getReversePropertyMap').returns(Promise.resolve(expectedPropertyMap));

            return storage.convertFromSalesForceFormat(salesForceEntity)
            .then(() => {
                expect(storage.getReversePropertyMap.callCount).to.equal(1);
                expect(storage.convertPropertyNames.callCount).to.equal(1);
                expect(storage.convertPropertyNames.firstCall.args[0]).to.equal(salesForceEntity);
                expect(storage.convertPropertyNames.firstCall.args[1]).to.deep.equal(expectedPropertyMap);
            });
        });

        it(`removes properties that aren't listed in the propertyMap`, () => {

            salesForceEntity.Age__c = 200;
            salesForceEntity.Skills__c = ['magic', 'flying'];

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
                expect(error instanceof ParameterValidationError).to.equal(true);
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

            spy(storage, 'convertPropertyNames');

            let expectedPropertyMap = { property1: 'first', property2: 'second' };
            stub(storage, 'getPropertyMap').returns(Promise.resolve(expectedPropertyMap));

            let reversePropertyMap = { first: 'property1', second: 'property2' };
            stub(storage, 'getReversePropertyMap').returns(Promise.resolve(reversePropertyMap));

            return storage.convertToSalesForceFormat(friendlyFormattedEntity)
            .then(() => {
                expect(storage.getPropertyMap.callCount).to.equal(1);
                expect(storage.convertPropertyNames.callCount).to.equal(1);
                expect(storage.convertPropertyNames.firstCall.args[0]).to.equal(friendlyFormattedEntity);
                expect(storage.convertPropertyNames.firstCall.args[1]).to.deep.equal(expectedPropertyMap);
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
                expect(error instanceof ParameterValidationError).to.equal(true);
            });
        });

        it('calls convertToSalesForceFormat() for each of the entities and returns the formatted results, ' +
            'which each include an attributes property by default', () => {

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

    describe('convertPropertyNames()', () => {
        it('is an alias for utils.convertPropertyNames', () => {
            expect(storage.convertPropertyNames).to.equal(convertPropertyNames);
        });
    });

    describe('insertMany()', () => {

        it('converts the array using convertArrayToSalesForceFormat()', () => {

            spy(storage, 'convertArrayToSalesForceFormat');

            return storage.insertMany(friendlyFormattedEntities)
            .then(() => {
                expect(storage.convertArrayToSalesForceFormat.callCount).to.equal(1);
                expect(storage.convertArrayToSalesForceFormat.firstCall.args[0]).to.deep.equal(friendlyFormattedEntities);
            });
        });

        it('sends a POST request to the bulk storage endpoint containing the formatted entities', () => {

            return storage.insertMany(friendlyFormattedEntities)
            .then(() => {
                expect(salesForceClient.getBasicRequestor.callCount).to.equal(1);
                expect(requestor.execute.callCount).to.equal(1);
                expect(requestor.execute.firstCall.args[0]).to.deep.equal({
                    uri: 'services/apexrest/PureCloudBulkStorage',
                    method: 'post',
                    json: {entities: salesForceEntitiesWithAttributes}
                });
            });
        });

        it('returns objects where each contains the ID of the entity inserted', () => {
            return storage.insertMany(friendlyFormattedEntities)
            .then(results => {
                expect(results).to.deep.equal(idEntities);
            });
        });
    });

    describe('updateMany()', () => {

        it('converts the array using convertArrayToSalesForceFormat()', () => {

            spy(storage, 'convertArrayToSalesForceFormat');

            return storage.updateMany(friendlyFormattedEntities)
            .then(() => {
                expect(storage.convertArrayToSalesForceFormat.callCount).to.equal(1);
                expect(storage.convertArrayToSalesForceFormat.firstCall.args[0]).to.deep.equal(friendlyFormattedEntities);
            });
        });

        it('sends a PATCH request to the bulk storage endpoint containing the formatted entities', () => {
            // Add id properties to input entities.
            for(let index in friendlyFormattedEntities) {
                friendlyFormattedEntities[index].id = 'pet' + index;
            }

            return storage.updateMany(friendlyFormattedEntities)
            .then(() => {
                expect(salesForceClient.getBasicRequestor.callCount).to.equal(1);
                expect(requestor.execute.callCount).to.equal(1);
                expect(requestor.execute.firstCall.args[0]).to.deep.equal({
                    uri: 'services/apexrest/PureCloudBulkStorage',
                    method: 'patch',
                    json: {entities: salesForceEntitiesWithAttributes}
                });
            });
        });

        it('returns objects where each contains the ID of the entity inserted', () => {
            return storage.updateMany(friendlyFormattedEntities)
            .then(results => {
                expect(results).to.deep.equal(idEntities);
            });
        });
    });

    describe('deleteMany()', () => {

        beforeEach(() => {
            // An HTTP DELETE request returns an array of string IDs instead an array of objects.
            requestor.body = {results: idEntities.map(entity => entity.id)};
        });

        it(`sends a DELETE request to the bulk storage endpoint containing a comma delimitted list of the IDs of those entities' IDs`, () => {
            // Add id properties to input entities.
            for(let index in friendlyFormattedEntities) {
                friendlyFormattedEntities[index].id = 'pet' + index;
            }

            return storage.deleteMany(friendlyFormattedEntities)
            .then(() => {
                expect(salesForceClient.getBasicRequestor.callCount).to.equal(1);
                expect(requestor.execute.callCount).to.equal(1);
                expect(requestor.execute.firstCall.args[0]).to.deep.equal({
                    uri: 'services/apexrest/PureCloudBulkStorage',
                    method: 'delete',
                    json: true,
                    qs: {ids: friendlyFormattedEntities.map(entity => entity.id).join(',')}
                });
            });
        });

        it('returns objects where each contains the ID of the entity inserted', () => {
            return storage.deleteMany(friendlyFormattedEntities)
            .then(results => {
                expect(results).to.deep.equal(idEntities);
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

            storage = new SObjectStorage(constructorParams);

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
