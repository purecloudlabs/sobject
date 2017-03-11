'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _extendableBuiltin(cls) {
	function ExtendableBuiltin() {
		var instance = Reflect.construct(cls, Array.from(arguments));
		Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
		return instance;
	}

	ExtendableBuiltin.prototype = Object.create(cls.prototype, {
		constructor: {
			value: cls,
			enumerable: false,
			writable: true,
			configurable: true
		}
	});

	if (Object.setPrototypeOf) {
		Object.setPrototypeOf(ExtendableBuiltin, cls);
	} else {
		ExtendableBuiltin.__proto__ = cls;
	}

	return ExtendableBuiltin;
}

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
* @private
*/
var ExtendableError = exports.ExtendableError = function (_extendableBuiltin2) {
	_inherits(ExtendableError, _extendableBuiltin2);

	function ExtendableError(message) {
		_classCallCheck(this, ExtendableError);

		var _this = _possibleConstructorReturn(this, (ExtendableError.__proto__ || Object.getPrototypeOf(ExtendableError)).call(this, message));

		_this.name = _this.constructor.name;
		_this.message = message;
		if (typeof Error.captureStackTrace === 'function') {
			Error.captureStackTrace(_this, _this.constructor.name);
		}
		return _this;
	}

	return ExtendableError;
}(_extendableBuiltin(Error));

/**
* Thrown by `SObject.prototype.get()` if it doesn't find a record matching the provided search options.
* You can import this class to check if an error is an instance of it. In scenarios where you would
* prefer this error not be thrown, use `query()` instead of `get()`.
*/


var ResourceNotFoundError = exports.ResourceNotFoundError = function (_ExtendableError) {
	_inherits(ResourceNotFoundError, _ExtendableError);

	function ResourceNotFoundError() {
		_classCallCheck(this, ResourceNotFoundError);

		return _possibleConstructorReturn(this, (ResourceNotFoundError.__proto__ || Object.getPrototypeOf(ResourceNotFoundError)).apply(this, arguments));
	}

	return ResourceNotFoundError;
}(ExtendableError);

/**
* Error indicating that an abstract method was not implemented.
* @private
*/


var NotImplementedError = exports.NotImplementedError = function (_ExtendableError2) {
	_inherits(NotImplementedError, _ExtendableError2);

	function NotImplementedError() {
		_classCallCheck(this, NotImplementedError);

		return _possibleConstructorReturn(this, (NotImplementedError.__proto__ || Object.getPrototypeOf(NotImplementedError)).apply(this, arguments));
	}

	return NotImplementedError;
}(ExtendableError);