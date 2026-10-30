import { handleDescriptionCorrection } from '../../server/api-handlers.mjs';

export default { fetch: request => handleDescriptionCorrection(request) };
