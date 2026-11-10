import { handleClientProfile } from '../server/profiles/client-profiles.mjs';
export default { fetch: request => handleClientProfile(request) };
