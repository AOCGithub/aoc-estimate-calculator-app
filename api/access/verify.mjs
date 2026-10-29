import { handleAccessVerification } from '../_shared.mjs';

export default async function handler(request) {
  return handleAccessVerification(request);
}
