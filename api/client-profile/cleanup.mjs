import { handleProfileCleanup } from '../../server/profiles/client-profiles.mjs';
export default { fetch: request => handleProfileCleanup(request) };
