import { handleProfileCleanup } from '../../server/client-profiles.mjs';
export default { fetch: request => handleProfileCleanup(request) };
