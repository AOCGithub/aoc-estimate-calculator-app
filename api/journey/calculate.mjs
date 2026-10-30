import { handleJourneyCalculation } from '../../server/api-handlers.mjs';

export default { fetch: request => handleJourneyCalculation(request) };
