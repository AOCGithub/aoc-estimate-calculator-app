import { handleLiveVoice } from '../../server/api-handlers.mjs';

export default { fetch: request => handleLiveVoice(request) };
