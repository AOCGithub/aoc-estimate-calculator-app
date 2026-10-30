import { handleAccessStatus } from '../../server/api-handlers.mjs';

export default { fetch: request => handleAccessStatus(request) };
