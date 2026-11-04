import { handleClientProfile } from '../server/client-profiles.mjs';
export default { fetch: request => handleClientProfile(request) };
