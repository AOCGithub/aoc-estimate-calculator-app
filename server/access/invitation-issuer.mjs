// Trusted AOC operator only. Never import this file into a browser or public API.
import { createHash, randomBytes } from 'node:crypto';

export async function issueInvitation(sql, requestId, { baseURL, validHours = 24 }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(requestId || '')) throw new Error('Use the request ID from Supabase.');
  const base = new URL(baseURL);
  if (base.username || base.password || base.search || base.hash
    || !(base.protocol === 'https:' || base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) {
    throw new Error('Use an HTTPS site URL or the explicit localhost trial.');
  }
  if (!Number.isInteger(validHours) || validHours < 1 || validHours > 72) throw new Error('Invitation expiry must be 1–72 hours.');
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  const invitation = await sql.begin(async transaction => {
    const [request] = await transaction`select id, review_status from public.access_requests where id = ${requestId} for update`;
    if (!request || request.review_status !== 'approved') throw new Error('Approve this request in Supabase before creating its access link.');
    await transaction`update public.access_invitations set expires_at = now()
      where request_id = ${requestId} and used_at is null and expires_at > now()`;
    const [created] = await transaction`insert into public.access_invitations (token_hash, request_id, expires_at)
      values (${hash}, ${requestId}, now() + ${validHours} * interval '1 hour') returning expires_at`;
    return created;
  });
  const link = new URL('/', base);
  link.hash = 'access=' + token;
  return { url: link.toString(), expiresAt: invitation.expires_at };
}
