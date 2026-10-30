import { handleJourneyAnalysis } from '../../server/api-handlers.mjs';

export default { fetch: request => handleJourneyAnalysis(request) };
