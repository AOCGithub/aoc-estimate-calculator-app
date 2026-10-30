import { handleAccessLogout } from '../../server/api-handlers.mjs';

export default { fetch: request => handleAccessLogout(request) };
