import { handleAccessVerification } from '../../server/api-handlers.mjs';

export default { fetch: request => handleAccessVerification(request) };
