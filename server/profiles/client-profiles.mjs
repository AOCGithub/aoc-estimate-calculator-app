import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { json, validateAccessProfile } from '../api-handlers.mjs';
import AccessRequests from '../access/access-requests.cjs';
import { companyFactFields, sameProfileOwner, validateCompanyFacts } from '../../shared/client-profile.mjs';

const fields = ['name', 'company', 'website', 'role', 'businessEmail'];
const digest = value => createHash('sha256').update(value).digest('hex');
const cookieName = request => new URL(request.url).protocol === 'https:' ? '__Host-aoc_client_profile' : 'aoc_client_profile';
function tokenFrom(request) {
  const value = String(request.headers.get('cookie') || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(cookieName(request) + '='))?.slice(cookieName(request).length + 1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
function cookie(request, token, days) {
  const path = new URL(request.url).protocol === 'https:' ? '/' : '/api/client-profile';
  return `${cookieName(request)}=${token}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${days * 86400}`
    + (new URL(request.url).protocol === 'https:' ? '; Secure' : '');
}
export function profileConfiguration(environment = process.env) {
  const config = AccessRequests.configuration(environment);
  const requested = Number(environment.AOC_CLIENT_PROFILE_TTL_DAYS || 30);
  return { ...config, enabled: environment.AOC_CLIENT_PROFILES_ENABLED === 'true'
      && environment.AOC_ACCESS_GATE_ENABLED === 'true' && environment.AOC_INTAKE_ONLY_ENABLED === 'true',
    retentionDays: Number.isInteger(requested) && requested >= 1 && requested <= 365 ? requested : 30 };
}

// The same request/consent protocol is used by Supabase and the offline test adapter.
export function createClientProfiles(store, { now = Date.now, retentionDays = 30 } = {}) {
  async function handle(request) {
    const url = new URL(request.url);
    if (url.search) return json({ error: 'Use this browser’s saved profile.' }, 400);
    if (!['/api/client-profile', '/api/client-profile/status'].includes(url.pathname)) return json({ error: 'Not found.' }, 404);
    if (!['GET', 'POST', 'DELETE'].includes(request.method) || (url.pathname.endsWith('/status') && request.method !== 'GET')) return json({ error: 'Method not allowed.' }, 405);
    if (request.headers.get('sec-fetch-site') === 'cross-site'
      || (request.headers.has('origin') && request.headers.get('origin') !== url.origin)
      || (request.method !== 'GET' && request.headers.get('origin') !== url.origin)) return json({ error: 'Use this estimator page.' }, 403);
    try {
      const time = now(), token = tokenFrom(request), hash = token ? digest(token) : null;
      if (hash) await store.expire(hash, time);
      const previous = hash ? await store.find(hash, time) : null;
      if (request.method === 'GET') {
        if (url.pathname.endsWith('/status')) return json({ available: true, saved: Boolean(previous), revision: previous?.id || null, retentionDays });
        if (!previous) return json({ error: 'No saved details are available in this browser.' }, 404);
        return json({ profile: previous.details, facts: previous.facts, revision: previous.id, confirmedAt: previous.confirmed_at });
      }
      if (request.method === 'DELETE') {
        if (previous && request.headers.get('if-match') !== previous.id) return json({ error: 'The saved profile changed. Review it again before removing it.' }, 409);
        if (previous && !await store.remove(hash, previous.id)) return json({ error: 'The saved profile changed. Review it again before removing it.' }, 409);
        const response = json({ forgotten: true });
        response.headers.set('set-cookie', cookie(request, '', 0));
        return response;
      }
      if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON required.' }, 415);
      if (Number(request.headers.get('content-length') || 0) > 40000) return json({ error: 'The request is too large.' }, 413);
      // Read incrementally: a missing Content-Length cannot bypass the byte limit.
      const reader = request.body?.getReader();
      let raw = '', size = 0;
      if (reader) {
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 40000) { await reader.cancel(); return json({ error: 'The request is too large.' }, 413); }
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      }
      let body;
      try { body = JSON.parse(raw); } catch { return json({ error: 'Could not read the request.' }, 400); }
      if (body?.consent !== true || body?.confirmed !== true) return json({ error: 'Choose to remember your details and confirm them before saving.' }, 400);
      const validated = validateAccessProfile(body.profile);
      if (validated.error) return json({ error: validated.error }, 400);
      if ((previous?.id || null) !== (body.expectedRevision || null)) return json({ error: 'The saved profile changed. Review it again before saving.' }, 409);
      const earlier = previous?.details;
      if (earlier && !sameProfileOwner(earlier, validated.profile)) return json({ error: 'This saved profile belongs to different client details. Forget it before saving another client.' }, 409);
      let selected;
      try { selected = validateCompanyFacts(body.facts); } catch (error) { return json({ error: error.message }, 400); }
      const removeIds = body.removeIds ?? [];
      if (!Array.isArray(removeIds) || removeIds.some(id => !companyFactFields.some(field => field.id === id) || Object.hasOwn(selected, id))) return json({ error: 'Review which saved facts should be removed.' }, 400);
      if (Object.keys(selected).length && !/^area(?:[0-9]|10|11)$/.test(body.area || '')) return json({ error: 'Choose the business area for these facts.' }, 400);
      const factsOnly = Object.hasOwn(body, 'facts') || removeIds.length > 0;
      const details = earlier && factsOnly ? earlier : validated.profile;
      const facts = structuredClone(previous?.facts || {});
      for (const id of removeIds) delete facts[id];
      for (const [id, fact] of Object.entries(selected)) {
        const quote = typeof fact.source.quote === 'string' ? fact.source.quote.slice(0, 1000) : '';
        const evidenced = fact.source.kind === 'ai_extracted' && quote && typeof body.description === 'string' && body.description.includes(quote);
        const reused = fact.source.kind === 'reviewed_saved_profile' && previous?.facts[id] && JSON.stringify(previous.facts[id].value) === JSON.stringify(fact.value);
        const previousSource = reused ? previous.facts[id].source : null;
        facts[id] = { value: fact.value, source: { kind: evidenced ? 'ai_extracted' : reused ? 'reviewed_saved_profile' : 'client_entry',
          area: body.area, confirmedAt: time, ...(evidenced ? { quote } : {}),
          ...(reused ? { fromRevision: previous.id, origin: previousSource.origin || previousSource } : {}) } };
      }
      const sources = earlier && factsOnly ? previous.field_sources : Object.fromEntries(fields.map(field => [field, {
        source: body.reuseConfirmed === true && earlier?.[field] === details[field] ? 'reviewed_saved_profile' : 'client_entry', confirmedAt: time,
        ...(body.reuseConfirmed === true && earlier?.[field] === details[field] ? { fromProfile: previous.id } : {}),
      }]));
      const credential = previous ? token : randomBytes(32).toString('hex');
      const row = { id: randomUUID(), token_hash: digest(credential), details, facts, field_sources: sources,
        consent_version: 'client-profile-v3', confirmed_at: time, expires_at: time + retentionDays * 86400000 };
      // CAS is performed by the database itself, not just the earlier read.
      if (!await store.save(row, previous)) return json({ error: 'The saved profile changed. Review it again before saving.' }, 409);
      const response = json({ saved: true, revision: row.id });
      response.headers.set('set-cookie', cookie(request, credential, retentionDays));
      return response;
    } catch {
      return json({ error: 'Saved details are temporarily unavailable. Your current answers are unchanged.' }, 503);
    }
  }
  return { handle };
}

export function createSupabaseProfileStore(configuration, fetcher = fetch) {
  const headers = { apikey: configuration.key, ...(configuration.key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + configuration.key }), 'Content-Type': 'application/json' };
  const iso = time => new Date(time).toISOString();
  async function query(method, filters = {}, body, representation = false) {
    const url = new URL(configuration.url + '/rest/v1/client_profiles');
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetcher(url, { method, headers: { ...headers, Prefer: representation ? 'return=representation' : 'return=minimal' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000) });
    if (response.status === 409) return [];
    if (!response.ok) throw new Error('Profile storage unavailable.');
    return method === 'GET' || representation ? response.json() : null;
  }
  return {
    expire: (hash, time) => query('DELETE', { token_hash: 'eq.' + hash, expires_at: 'lte.' + iso(time) }),
    async find(hash, time) {
      const rows = await query('GET', { token_hash: 'eq.' + hash, expires_at: 'gt.' + iso(time),
        select: 'id,details,field_sources,facts,consent_version,confirmed_at,expires_at', limit: '1' });
      const row = rows[0];
      return row ? { ...row, confirmed_at: Date.parse(row.confirmed_at), expires_at: Date.parse(row.expires_at) } : null;
    },
    async save(row, previous) {
      const data = { ...row, confirmed_at: iso(row.confirmed_at), expires_at: iso(row.expires_at) };
      const rows = await query(previous ? 'PATCH' : 'POST', previous ? { id: 'eq.' + previous.id, token_hash: 'eq.' + row.token_hash, expires_at: 'gt.' + iso(row.confirmed_at) } : {}, data, true);
      return rows.length === 1;
    },
    async remove(hash, revision) { return (await query('DELETE', { token_hash: 'eq.' + hash, id: 'eq.' + revision }, undefined, true)).length === 1; },
  };
}
export async function handleClientProfile(request, environment = process.env) {
  const configuration = profileConfiguration(environment);
  if (!configuration.enabled || !configuration.configured) return new URL(request.url).pathname.endsWith('/status') && request.method === 'GET'
    ? json({ available: false, saved: false, revision: null }) : json({ error: 'Profile saving is unavailable. You can continue without it.' }, 503);
  return createClientProfiles(createSupabaseProfileStore(configuration), configuration).handle(request);
}
export async function handleProfileCleanup(request, environment = process.env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const secret = String(environment.CRON_SECRET || '');
  const supplied = request.headers.get('authorization') || '';
  if (secret.length < 32 || !timingSafeEqual(Buffer.from(digest(supplied)), Buffer.from(digest('Bearer ' + secret)))) return json({ error: 'Unauthorized.' }, 401);
  const configuration = profileConfiguration(environment);
  if (!configuration.configured) return json({ error: 'Profile storage unavailable.' }, 503);
  try {
    const response = await fetch(configuration.url + '/rest/v1/rpc/purge_expired_client_profiles', { method: 'POST',
      headers: { apikey: configuration.key, ...(configuration.key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + configuration.key }), 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error();
    return json({ cleaned: true });
  } catch { return json({ error: 'Expired profile cleanup failed.' }, 503); }
}
