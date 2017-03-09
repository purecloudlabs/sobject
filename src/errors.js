
/**
* An Error subclass that's extended easily in order to create custom
* errors that can be caught and that provide the specific error name when
* converted to a string.
* @class
*
* @example
*
* class ResourceNotFoundError extends ExtendableError {
* 	constructor(message) {
*		super(message);
*   }
* }
*
* try {
* 	throw new ResourceNotFoundError('404!');
* } catch(error) {
* 	if (error.name === 'ResourceNotFoundError') {
* 		alert('The requested resource could not be found.');
		console.log('error: ' + error); // Includes the error name and stack trace.
* 	} else {
*		alert('Something bad happened, but I have no idea what. Error: ' + error);
* 	}
* }
*/
export class ExtendableError extends Error {

	constructor(message) {
		super(message);
		this.name = this.constructor.name;
		this.message = message;
        if (typeof Error.captureStackTrace === 'function') {
    		Error.captureStackTrace(this, this.constructor.name);
        }
	}
}

/**
* Error indicating that a requested resource could not be found (i.e. HTTP status 404).
*/
export class ResourceNotFoundError extends ExtendableError {}

/**
* Error indicating that an abstract method was not implemented.
*/
export class NotImplementedError extends ExtendableError {}
