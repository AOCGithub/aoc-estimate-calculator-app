import { createRequire } from 'node:module';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const journeyContract = require('./public/journey-contract.js');
const journeyCalculation = require('./public/journey-calculation.js');

function sendJson(response, status, data) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json;charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(data));
}

function readBody(request, limit = 50000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('request_too_large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

const accessCookieName = 'aoc_estimator_access';

function localAccessSubject(email) {
  return createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
}

function basicLocalEmail(value) {
  const parts = String(value).split('@');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0 && !/\s/u.test(value);
}

function localAccessConfiguration(environment) {
  const enabled = String(process.env.AOC_ACCESS_GATE_ENABLED || environment.AOC_ACCESS_GATE_ENABLED || 'false').toLowerCase() === 'true';
  let approvals = [];
  try {
    const parsed = JSON.parse(process.env.AOC_APPROVED_EMAILS || environment.AOC_APPROVED_EMAILS || '[]');
    if (Array.isArray(parsed)) {
      approvals = parsed
        .map(item => typeof item === 'string' ? item.trim().toLowerCase() : '')
        .filter(basicLocalEmail)
        .map(email => ({ email, subject: localAccessSubject(email) }));
    }
  } catch {
    approvals = [];
  }
  const secret = String(process.env.AOC_ACCESS_SESSION_SECRET || environment.AOC_ACCESS_SESSION_SECRET || '');
  const requestedHours = Number(process.env.AOC_ACCESS_SESSION_HOURS || environment.AOC_ACCESS_SESSION_HOURS || 8);
  const hours = Number.isFinite(requestedHours) ? Math.min(24, Math.max(1, requestedHours)) : 8;
  return { enabled, approvals, secret, hours, configured: approvals.length > 0 && secret.length >= 32 };
}

function localAccessCookie(request) {
  for (const cookie of String(request.headers.cookie || '').split(';')) {
    const [name, ...parts] = cookie.trim().split('=');
    if (name === accessCookieName) return parts.join('=');
  }
  return '';
}

function localSafeEqual(left, right) {
  const a = createHash('sha256').update(String(left)).digest();
  const b = createHash('sha256').update(String(right)).digest();
  return timingSafeEqual(a, b);
}

function localAccessSignature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function localAccessSession(configuration, subject) {
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    expires: Date.now() + configuration.hours * 60 * 60 * 1000,
    nonce: randomBytes(16).toString('base64url'),
    subject,
  })).toString('base64url');
  return `${payload}.${localAccessSignature(payload, configuration.secret)}`;
}

function localAccessGranted(request, configuration) {
  if (!configuration.enabled) return true;
  if (!configuration.configured) return false;
  const token = localAccessCookie(request);
  const separator = token.lastIndexOf('.');
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  if (!localSafeEqual(token.slice(separator + 1), localAccessSignature(payload, configuration.secret))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.version === 1
      && Number(data.expires) > Date.now()
      && configuration.approvals.some(item => localSafeEqual(item.subject, data.subject));
  } catch {
    return false;
  }
}

function normalizeAccessText(value, maximumLength) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function localRequestSameOrigin(request) {
  try {
    return new URL(request.headers.origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function validateLocalAccessProfile(body) {
  const profile = {
    name: normalizeAccessText(body?.name, 100),
    company: normalizeAccessText(body?.company, 120),
    website: normalizeAccessText(body?.website, 500),
    role: normalizeAccessText(body?.role, 100),
    businessEmail: normalizeAccessText(body?.businessEmail, 254).toLowerCase(),
  };
  if (profile.name.length < 2 || profile.company.length < 2 || profile.role.length < 2) return { error: 'Add your name, company and role.' };
  if (!basicLocalEmail(profile.businessEmail)) return { error: 'Enter a valid business email.' };
  try {
    const websiteValue = /^[a-z][a-z\d+.-]*:\/\//iu.test(profile.website)
      ? profile.website
      : `https://${profile.website}`;
    const website = new URL(websiteValue);
    if (!['http:', 'https:'].includes(website.protocol)) throw new Error('invalid_protocol');
    profile.website = website.toString();
  } catch {
    return { error: 'Enter your company website.' };
  }
  return { profile };
}

function localAccessApi(configuration) {
  return {
    name: 'aoc-local-access-api',
    configureServer(server) {
      server.middlewares.use('/api/access/status', (request, response, next) => {
        if (request.method !== 'GET') return next();
        sendJson(response, 200, configuration.enabled
          ? { enabled: true, configured: configuration.configured, authenticated: localAccessGranted(request, configuration) }
          : { enabled: false, configured: true, authenticated: true });
      });
      server.middlewares.use('/api/access/verify', async (request, response, next) => {
        if (request.method !== 'POST') return next();
        if (!localRequestSameOrigin(request)) return sendJson(response, 403, { error: 'Use this estimator page.' });
        if (!configuration.enabled) return sendJson(response, 200, { enabled: false, authenticated: true });
        if (!configuration.configured) return sendJson(response, 503, { error: 'Access verification is not configured.' });
        let body;
        try {
          body = JSON.parse(await readBody(request, 10000));
        } catch (error) {
          return sendJson(response, error.message === 'request_too_large' ? 413 : 400, { error: 'Could not read the request.' });
        }
        const validated = validateLocalAccessProfile(body);
        if (validated.error) return sendJson(response, 400, { error: validated.error });
        const approval = configuration.approvals.find(item => localSafeEqual(item.email, validated.profile.businessEmail));
        if (!approval) return sendJson(response, 403, { error: 'This business email is not approved for calculator access.' });
        response.setHeader('Set-Cookie', `${accessCookieName}=${localAccessSession(configuration, approval.subject)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${configuration.hours * 60 * 60}`);
        return sendJson(response, 200, { enabled: true, authenticated: true });
      });
      server.middlewares.use('/api/access/logout', (request, response, next) => {
        if (request.method !== 'POST') return next();
        if (!localRequestSameOrigin(request)) return sendJson(response, 403, { error: 'Use this estimator page.' });
        response.setHeader('Set-Cookie', `${accessCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
        return sendJson(response, 200, { authenticated: false });
      });
    },
  };
}

function localAnalysisApi({ enabled, apiKey, model, access }) {
  return {
    name: 'aoc-local-analysis-api',
    configureServer(server) {
      server.middlewares.use('/api/journey/analyze', async (request, response, next) => {
        if (request.method !== 'POST') {
          next();
          return;
        }
        if (!localAccessGranted(request, access)) {
          sendJson(response, access.configured ? 401 : 503, { error: access.configured ? 'Access verification is required.' : 'Access verification is not configured.' });
          return;
        }
        if (!enabled || !apiKey) {
          sendJson(response, 200, {
            localFallback: true,
            mode: 'local',
          });
          return;
        }

        let body;
        try {
          body = JSON.parse(await readBody(request));
        } catch (error) {
          sendJson(response, error.message === 'request_too_large' ? 413 : 400, {
            error: error.message === 'request_too_large'
              ? 'Please shorten the description.'
              : 'Could not read the request.',
          });
          return;
        }

        if (
          typeof body.area !== 'string'
          || typeof body.text !== 'string'
          || body.text.trim().length < 30
          || body.text.length > 18000
        ) {
          sendJson(response, 400, {
            error: 'Choose an area and describe the process in 30-18,000 characters.',
          });
          return;
        }

        try {
          const provider = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              store: false,
              instructions: journeyContract.prompt(body.area),
              input: body.text,
              max_output_tokens: 9000,
              text: {
                format: {
                  type: 'json_schema',
                  name: 'aoc_journey_scope',
                  strict: true,
                  schema: journeyContract.schema(body.area),
                },
              },
            }),
            signal: AbortSignal.timeout(55000),
          });
          const payload = await provider.json();
          if (!provider.ok || payload.status !== 'completed') {
            sendJson(response, provider.status === 429 ? 429 : 502, {
              error: 'AI could not complete this request. Your text is preserved; use editable fields or retry.',
            });
            return;
          }
          const output = (payload.output || [])
            .flatMap((item) => item.content || [])
            .filter((item) => item.type === 'output_text')
            .map((item) => item.text)
            .join('');
          sendJson(response, 200, {
            analysis: journeyContract.validate(JSON.parse(output), body.text, body.area),
            model: payload.model,
          });
        } catch {
          sendJson(response, 502, {
            error: 'Analysis could not be validated or timed out. Your description is preserved; continue with editable fields.',
          });
        }
      });
    },
  };
}

function localCalculationApi(access) {
  return {
    name: 'aoc-local-calculation-api',
    configureServer(server) {
      server.middlewares.use('/api/journey/calculate', async (request, response, next) => {
        if (request.method !== 'POST') {
          next();
          return;
        }
        if (!localAccessGranted(request, access)) {
          sendJson(response, access.configured ? 401 : 503, { error: access.configured ? 'Access verification is required.' : 'Access verification is not configured.' });
          return;
        }
        if (!request.headers['content-type']?.startsWith('application/json')) {
          sendJson(response, 415, { error: 'JSON required.' });
          return;
        }
        try {
          const body = JSON.parse(await readBody(request, 100000));
          const calculation = journeyCalculation.calculate(body);
          sendJson(response, 200, { ...calculation, source: 'server' });
        } catch (error) {
          sendJson(response, error.message === 'request_too_large' ? 413 : 400, {
            error: error.message === 'request_too_large'
              ? 'The calculation request is too large.'
              : error.message,
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  const apiKey = process.env.OPENAI_API_KEY || environment.OPENAI_API_KEY;
  const model = process.env.AOC_INTAKE_MODEL || environment.AOC_INTAKE_MODEL || 'gpt-5.4';
  const enabled = String(
    process.env.AOC_AI_ORGANIZER_ENABLED || environment.AOC_AI_ORGANIZER_ENABLED || 'false',
  ).toLowerCase() === 'true';
  const access = localAccessConfiguration(environment);

  return {
    plugins: [react(), localAccessApi(access), localCalculationApi(access), localAnalysisApi({ enabled, apiKey, model, access })],
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
    },
  };
});
