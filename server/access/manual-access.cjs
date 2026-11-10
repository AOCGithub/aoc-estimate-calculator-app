// Server-only, shared unchanged by Vercel, Vite and the retained Worker.
(function (root, factory) {
  const storage = typeof module === 'object' && module.exports ? require('./access-requests.cjs') : root.AOCAccessRequests;
  const api = factory(storage);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AOCManualAccess = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (storage) {
  const cookieName = 'aoc_estimator_review_access';
  const attempts = new Map();
  const tokenPattern = /^[0-9a-f]{64}$/u;
  const invalidInvitation = 'This access link is expired, already used or no longer approved. Ask AOC for a new link.';

  function enabled(env) {
    return env.AOC_ACCESS_GATE_ENABLED === 'true' && env.AOC_MANUAL_ACCESS_ENABLED === 'true'
      && env.AOC_INTAKE_ONLY_ENABLED !== 'true';
  }
  function configuration(env) {
    const requestStorage = storage.configuration(env);
    const hours = Number(env.AOC_ACCESS_SESSION_HOURS || 8);
    return { ...requestStorage, configured: requestStorage.enabled && requestStorage.configured,
      hours: Number.isFinite(hours) ? Math.min(24, Math.max(1, Math.trunc(hours))) : 8 };
  }
  function json(body, status = 200) {
    return Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  }
  function tokenCookie(request) {
    const match = String(request.headers.get('cookie') || '').split(';').map(item => item.trim())
      .find(item => item.startsWith(cookieName + '='));
    return match ? match.slice(cookieName.length + 1) : '';
  }
  function cookie(request, token, age) {
    return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
  }
  function randomToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
  }
  async function digest(token) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
  }
  async function database(config, path, options = {}) {
    const response = await fetch(config.url + '/rest/v1/' + path, {
      ...options,
      headers: { apikey: config.key,
        ...(config.key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + config.key }),
        'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('storage_unavailable');
    }
    if (response.status === 204) return null;
    return response.json();
  }
  async function sessionValid(request, config) {
    const token = tokenCookie(request);
    if (!tokenPattern.test(token)) return false;
    const rows = await database(config, 'access_invitations?session_hash=eq.' + await digest(token)
      + '&select=request_id,session_expires_at&limit=1');
    if (!Array.isArray(rows)) throw new Error('storage_unavailable');
    const invitation = rows[0];
    if (!invitation || !(new Date(invitation.session_expires_at).getTime() > Date.now())) return false;
    if (!/^[0-9a-f-]{36}$/u.test(invitation.request_id)) return false;
    const decisions = await database(config, 'access_requests?id=eq.' + invitation.request_id + '&select=review_status&limit=1');
    return Array.isArray(decisions) && decisions[0]?.review_status === 'approved';
  }
  function consumeAttempt(action) {
    const now = Date.now();
    let bucket = attempts.get(action);
    if (!bucket || now - bucket.start > 3600000) bucket = { start: now, count: 0 };
    attempts.set(action, bucket);
    return ++bucket.count <= 30;
  }
  async function body(request) {
    if (!request.headers.get('content-type')?.startsWith('application/json')) return { response: json({ error: 'JSON required.' }, 415) };
    if (Number(request.headers.get('content-length') || 0) > 10000) return { response: json({ error: 'The request is too large.' }, 413) };
    try {
      const raw = await request.text();
      if (raw.length > 10000) return { response: json({ error: 'The request is too large.' }, 413) };
      return { value: JSON.parse(raw) };
    } catch { return { response: json({ error: 'Could not read the request.' }, 400) }; }
  }
  function profile(value) {
    const limits = { name: 100, company: 120, website: 500, role: 100, businessEmail: 254 };
    const result = Object.fromEntries(Object.entries(limits).map(([key, limit]) =>
      [key, typeof value?.[key] === 'string' ? value[key].trim().slice(0, limit) : '']));
    result.businessEmail = result.businessEmail.toLowerCase();
    if ([result.name, result.company, result.role].some(text => text.length < 2)) return { error: 'Add your name, company and role.' };
    if (!/^[^\s@]+@[^\s@]+$/u.test(result.businessEmail)) return { error: 'Enter a valid business email.' };
    try {
      const website = new URL(/^[a-z][a-z\d+.-]*:\/\//iu.test(result.website) ? result.website : 'https://' + result.website);
      if (!['https:', 'http:'].includes(website.protocol)) throw new Error('website');
      result.website = website.toString();
    } catch { return { error: 'Enter your company website.' }; }
    return { value: result };
  }
  async function status(request, env) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
    const config = configuration(env);
    const result = { enabled: true, requestsEnabled: true, manualApproval: true, configured: config.configured, authenticated: false };
    try {
      result.authenticated = config.configured && await sessionValid(request, config);
      return json(result);
    } catch { return json({ ...result, configured: false, error: 'Calculator access is temporarily unavailable.' }, 503); }
  }
  async function requireAccess(request, env) {
    const config = configuration(env);
    if (!config.configured) return json({ error: 'Access requests are not configured.' }, 503);
    try {
      return await sessionValid(request, config) ? null : json({ error: 'An approved access link is required.' }, 401);
    } catch { return json({ error: 'Calculator access is temporarily unavailable.' }, 503); }
  }
  async function handle(request, env, action) {
    if (action === 'status') return status(request, env);
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Use this estimator page.' }, 403);
    const config = configuration(env);
    if (!config.configured) return json({ error: 'Access requests are not configured.' }, 503);
    if (action === 'logout') {
      const token = tokenCookie(request);
      try {
        if (tokenPattern.test(token)) await database(config, 'access_invitations?session_hash=eq.' + await digest(token), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ session_hash: null, session_expires_at: null }),
        });
        const response = json({ authenticated: false });
        response.headers.set('set-cookie', cookie(request, '', 0));
        return response;
      } catch { return json({ error: 'Could not end this session. Please try again.' }, 503); }
    }
    if (!['verify', 'redeem'].includes(action)) return json({ error: 'Not found.' }, 404);
    if (!consumeAttempt(action)) return json({ error: 'Too many access attempts. Try again later.' }, 429);
    const parsed = await body(request);
    if (parsed.response) return parsed.response;
    if (action === 'verify') {
      const validated = profile(parsed.value);
      if (validated.error) return json({ error: validated.error }, 400);
      try {
        await storage.save(config, validated.value);
        // No allowlist check: a submission never grants access in this mode.
        return json({ enabled: true, authenticated: false, pending: true }, 202);
      } catch { return json({ error: 'We could not save your access request. Your details are still here; please try again later.' }, 503); }
    }
    if (typeof parsed.value?.token !== 'string' || !tokenPattern.test(parsed.value.token)) return json({ error: invalidInvitation }, 400);
    try {
      const session = randomToken();
      const redeemed = await database(config, 'rpc/redeem_access_invitation', {
        method: 'POST', body: JSON.stringify({ p_token_hash: await digest(parsed.value.token), p_session_hash: await digest(session), p_hours: config.hours }),
      });
      if (!Array.isArray(redeemed) || redeemed.length !== 1) return json({ error: invalidInvitation }, 403);
      const response = json({ enabled: true, authenticated: true });
      response.headers.set('set-cookie', cookie(request, session, config.hours * 3600));
      return response;
    } catch { return json({ error: 'We could not check this access link. Please try again later.' }, 503); }
  }
  return { enabled, handle, requireAccess };
});
