import { handleAccessLogout } from '../_shared.mjs';

export default function handler(request) {
  return handleAccessLogout(request);
}
