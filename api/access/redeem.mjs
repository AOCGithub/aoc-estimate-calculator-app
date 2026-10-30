import { handleAccessRedemption } from '../../server/api-handlers.mjs';

export default { fetch: request => handleAccessRedemption(request) };
