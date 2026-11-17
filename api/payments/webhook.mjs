import { handleG2Payment } from '../../server/payments/stripe-handoff.mjs';
export default { fetch: request => handleG2Payment(request) };
