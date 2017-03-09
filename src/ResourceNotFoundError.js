import ExtendableError from './ExtendableError';

/**
* Error indicating that a requested resource could not be found (i.e. HTTP status 404).
*/
class ResourceNotFoundError extends ExtendableError {}

export default ResourceNotFoundError;
