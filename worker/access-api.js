const accessCookieName = 'aoc_estimator_access';
const accessEncoder = new TextEncoder();

function accessGateEnabled(env) {
  return env.AOC_ACCESS_GATE_ENABLED === 'true';
}

function accessBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function accessDecodeBase64Url(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function accessDigest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', accessEncoder.encode(String(value))));
}

async function accessSubject(email) {
  return Array.from(await accessDigest(String(email).trim().toLowerCase()))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function basicAccessEmail(value) {
  const parts = String(value).split('@');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0 && !/\s/u.test(value);
}

async function accessGateConfiguration(env) {
  let approvals = [];
  try {
    const parsed = JSON.parse(env.AOC_APPROVED_EMAILS || '[]');
    if (Array.isArray(parsed)) {
      const candidates = parsed
        .map(item => typeof item === 'string' ? item.trim().toLowerCase() : '')
        .filter(basicAccessEmail);
      approvals = await Promise.all(candidates.map(async email => ({ email, subject: await accessSubject(email) })));
    }
  } catch {
    approvals = [];
  }
  const secret = String(env.AOC_ACCESS_SESSION_SECRET || '');
  const requestedHours = Number(env.AOC_ACCESS_SESSION_HOURS || 8);
  const hours = Number.isFinite(requestedHours) ? Math.min(24, Math.max(1, requestedHours)) : 8;
  return { approvals, secret, hours, configured: approvals.length > 0 && secret.length >= 32 };
}

async function accessSafeEqual(left, right) {
  const [a, b] = await Promise.all([accessDigest(left), accessDigest(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function accessSignature(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    accessEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return accessBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, accessEncoder.encode(payload))));
}

function accessCookie(request) {
  for (const cookie of String(request.headers.get('cookie') || '').split(';')) {
    const [name, ...parts] = cookie.trim().split('=');
    if (name === accessCookieName) return parts.join('=');
  }
  return '';
}

async function accessSessionValid(request, configuration) {
  const token = accessCookie(request);
  const separator = token.lastIndexOf('.');
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!await accessSafeEqual(signature, await accessSignature(payload, configuration.secret))) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(accessDecodeBase64Url(payload)));
    if (data.version !== 1 || Number(data.expires) <= Date.now()) return false;
    const matches = await Promise.all(configuration.approvals.map(item => accessSafeEqual(item.subject, data.subject)));
    return matches.some(Boolean);
  } catch {
    return false;
  }
}

async function createAccessSession(configuration, subject) {
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);
  const payload = accessBase64Url(accessEncoder.encode(JSON.stringify({
    version: 1,
    expires: Date.now() + configuration.hours * 60 * 60 * 1000,
    nonce: accessBase64Url(nonce),
    subject,
  })));
  return payload + '.' + await accessSignature(payload, configuration.secret);
}

function accessCookieHeader(request, value, maximumAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return accessCookieName + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maximumAge + secure;
}

function accessText(value, maximumLength) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function validateAccessRequest(body) {
  const profile = {
    name: accessText(body?.name, 100),
    company: accessText(body?.company, 120),
    website: accessText(body?.website, 500),
    role: accessText(body?.role, 100),
    businessEmail: accessText(body?.businessEmail, 254).toLowerCase(),
  };
  if (profile.name.length < 2 || profile.company.length < 2 || profile.role.length < 2) {
    return { error: 'Add your name, company and role.' };
  }
  if (!basicAccessEmail(profile.businessEmail)) {
    return { error: 'Enter a valid business email.' };
  }
  try {
    const websiteValue = /^[a-z][a-z\d+.-]*:\/\//iu.test(profile.website)
      ? profile.website
      : 'https://' + profile.website;
    const website = new URL(websiteValue);
    if (!['http:', 'https:'].includes(website.protocol)) throw new Error('invalid_protocol');
    profile.website = website.toString();
  } catch {
    return { error: 'Enter your company website.' };
  }
  return { profile };
}

async function readAccessRequest(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return { response: json({ error: 'JSON required.' }, 415) };
  if (Number(request.headers.get('content-length') || 0) > 10000) return { response: json({ error: 'The request is too large.' }, 413) };
  try {
    const raw = await request.text();
    if (raw.length > 10000) return { response: json({ error: 'The request is too large.' }, 413) };
    return { body: JSON.parse(raw) };
  } catch {
    return { response: json({ error: 'Could not read the request.' }, 400) };
  }
}

async function requireWorkerAccess(request, env) {
  if (!accessGateEnabled(env)) return null;
  const configuration = await accessGateConfiguration(env);
  if (!configuration.configured) return json({ error: 'Access verification is not configured.' }, 503);
  if (!await accessSessionValid(request, configuration)) return json({ error: 'Access verification is required.' }, 401);
  return null;
}

async function accessStatusAPI(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  if (!accessGateEnabled(env)) return json({ enabled: false, configured: true, authenticated: true });
  const configuration = await accessGateConfiguration(env);
  return json({
    enabled: true,
    configured: configuration.configured,
    authenticated: configuration.configured && await accessSessionValid(request, configuration),
  });
}

async function accessVerifyAPI(request, env, url) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Use this estimator page.' }, 403);
  if (!accessGateEnabled(env)) return json({ enabled: false, authenticated: true });
  const configuration = await accessGateConfiguration(env);
  if (!configuration.configured) return json({ error: 'Access verification is not configured.' }, 503);
  const now = Date.now();
  const bucketId = 'access:public-pilot';
  const bucket = buckets.get(bucketId) || { start: now, count: 0 };
  if (now - bucket.start > 3600000) {
    bucket.start = now;
    bucket.count = 0;
  }
  if (bucket.count >= 30) return json({ error: 'Too many access attempts. Try again later.' }, 429);
  bucket.count += 1;
  buckets.set(bucketId, bucket);
  const parsed = await readAccessRequest(request);
  if (parsed.response) return parsed.response;
  const validated = validateAccessRequest(parsed.body);
  if (validated.error) return json({ error: validated.error }, 400);
  const matches = await Promise.all(configuration.approvals.map(item => accessSafeEqual(item.email, validated.profile.businessEmail)));
  const approval = configuration.approvals[matches.findIndex(Boolean)];
  if (!approval) return json({ error: 'This business email is not approved for calculator access.' }, 403);
  const response = json({ enabled: true, authenticated: true });
  response.headers.set('set-cookie', accessCookieHeader(
    request,
    await createAccessSession(configuration, approval.subject),
    configuration.hours * 60 * 60,
  ));
  return response;
}

function accessLogoutAPI(request, url) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Use this estimator page.' }, 403);
  const response = json({ authenticated: false });
  response.headers.set('set-cookie', accessCookieHeader(request, '', 0));
  return response;
}
