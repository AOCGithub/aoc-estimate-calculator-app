import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  handleAccessLogout,
  handleAccessStatus,
  handleAccessVerification,
  handleJourneyCalculation,
} from '../server/api-handlers.mjs';

const require = createRequire(import.meta.url);
const fixture = require('./fixtures/commercial.cjs');
const environmentNames = [
  'AOC_ACCESS_GATE_ENABLED',
  'AOC_APPROVED_EMAILS',
  'AOC_ACCESS_SESSION_SECRET',
  'AOC_ACCESS_SESSION_HOURS',
];
const originalEnvironment = Object.fromEntries(environmentNames.map(name => [name, process.env[name]]));

function request(path, options = {}) {
  return new Request('https://estimate.example.test' + path, {
    ...options,
    headers: {
      origin: 'https://estimate.example.test',
      ...(options.headers || {}),
    },
  });
}

const approvedProfile = {
  name: 'Test User',
  company: 'Example Company',
  website: 'example.com',
  role: 'Operations lead',
  businessEmail: 'approved@company',
};

try {
  process.env.AOC_ACCESS_GATE_ENABLED = 'false';
  let response = handleAccessStatus(request('/api/access/status'));
  assert.deepEqual(await response.json(), { enabled: false, configured: true, authenticated: true });

  process.env.AOC_ACCESS_GATE_ENABLED = 'true';
  process.env.AOC_APPROVED_EMAILS = JSON.stringify([
    approvedProfile.businessEmail,
    'second@example.com',
  ]);
  process.env.AOC_ACCESS_SESSION_SECRET = 'phase-two-test-session-secret-with-more-than-32-characters';
  process.env.AOC_ACCESS_SESSION_HOURS = '8';

  response = handleAccessStatus(request('/api/access/status'));
  assert.deepEqual(await response.json(), { enabled: true, configured: true, authenticated: false });

  response = await handleAccessVerification(request('/api/access/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...approvedProfile, businessEmail: 'not-an-email' }),
  }));
  assert.equal(response.status, 400, 'a value without an @ sign is still rejected');

  response = await handleAccessVerification(request('/api/access/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...approvedProfile, businessEmail: 'unapproved@example.com' }),
  }));
  assert.equal(response.status, 403, 'an unapproved business email cannot access the calculator');

  response = await handleAccessVerification(request('/api/access/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(approvedProfile),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { enabled: true, authenticated: true });
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /aoc_estimator_access=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Secure/);
  assert.ok(!setCookie.includes(approvedProfile.businessEmail), 'the signed cookie does not expose the business email');
  const cookie = setCookie.split(';')[0];

  response = handleAccessStatus(request('/api/access/status', { headers: { cookie } }));
  assert.equal((await response.json()).authenticated, true);

  process.env.AOC_APPROVED_EMAILS = JSON.stringify(['second@example.com']);
  response = handleAccessStatus(request('/api/access/status', { headers: { cookie } }));
  assert.equal((await response.json()).authenticated, false, 'removing an approved email revokes its earlier session');
  process.env.AOC_APPROVED_EMAILS = JSON.stringify([
    approvedProfile.businessEmail,
    'second@example.com',
  ]);

  const calculationBody = {
    area: fixture.area,
    confirmed: true,
    answers: Object.fromEntries(
      Object.entries(fixture).filter(([key]) => !['area', 'process_confirmed'].includes(key)),
    ),
  };
  response = await handleJourneyCalculation(request('/api/journey/calculate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(calculationBody),
  }));
  assert.equal(response.status, 401, 'calculator API is blocked without a verified session');

  response = await handleJourneyCalculation(request('/api/journey/calculate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(calculationBody),
  }));
  assert.equal(response.status, 200);

  process.env.AOC_APPROVED_EMAILS = '[]';
  response = handleAccessStatus(request('/api/access/status', { headers: { cookie } }));
  assert.equal((await response.json()).authenticated, false, 'removing approval revokes the existing session');

  process.env.AOC_APPROVED_EMAILS = JSON.stringify([approvedProfile.businessEmail]);
  response = handleAccessLogout(request('/api/access/logout', { method: 'POST', headers: { cookie } }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);

  console.log('PASS: Phase 2 provisional email allowlist, signed sessions, revocation, logout, and server-enforced calculator access.');
} finally {
  for (const name of environmentNames) {
    if (originalEnvironment[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnvironment[name];
  }
}
