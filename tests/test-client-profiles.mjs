import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createLocalClientProfiles } from '../server/local-client-profiles.mjs';
import { mergeCompanyFacts } from '../shared/client-profile.mjs';

const filename = join(mkdtempSync(join(tmpdir(), 'aoc-profile-test-')), 'profiles.sqlite');
let time = Date.now();
const store = createLocalClientProfiles(filename, { now: () => time });
const inspection = new DatabaseSync(filename, { readOnly: true });
const profile = { name: 'Local Test', company: 'Example Company', website: 'example.com', role: 'Testing', businessEmail: 'local@example.com' };
const body = { profile, consent: true, confirmed: true };
function request(path = '', method = 'GET', value, cookie = '', extraHeaders = {}) {
  return new Request('http://127.0.0.1:5174/api/client-profile' + path, { method,
    headers: { origin: 'http://127.0.0.1:5174', cookie, 'content-type': 'application/json', ...extraHeaders },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
}
const rows = () => inspection.prepare('SELECT * FROM client_profiles').all();
try {
  let response = await store.handle(request('/status'));
  assert.deepEqual(await response.json(), { available: true, saved: false, revision: null, retentionDays: 30 });
  for (const consent of [false, undefined, 'true']) {
    response = await store.handle(request('', 'POST', { ...body, consent }));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal((await store.handle(request('', 'POST', { ...body, confirmed: false }))).status, 400);
  assert.equal(rows().length, 0, 'No consent or review means no saved profile.');
  response = await store.handle(request('', 'POST', body, '', { origin: 'https://evil.test' }));
  assert.equal(response.status, 403);
  response = await store.handle(request('', 'POST', { ...body, profile: { ...profile, website: 'javascript:alert(1)' } }));
  assert.equal(response.status, 400);
  response = await store.handle(request('', 'POST', body));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const setCookieA = response.headers.get('set-cookie');
  assert.match(setCookieA, /HttpOnly; SameSite=Strict/);
  assert.ok(!setCookieA.includes(profile.businessEmail));
  const cookieA = setCookieA.split(';')[0];
  assert.equal(rows().length, 1);
  const revisionA = rows()[0].id;
  assert.ok(!JSON.stringify(rows()).includes(cookieA.split('=')[1]), 'Only a digest of the browser credential is stored.');
  response = await store.handle(request('/status', 'GET', undefined, cookieA));
  assert.deepEqual(await response.json(), { available: true, saved: true, revision: revisionA, retentionDays: 30 }, 'Status discloses no business details.');
  response = await store.handle(request('', 'GET', undefined, cookieA));
  assert.deepEqual((await response.json()).profile, { ...profile, website: 'https://example.com/' });
  assert.equal((await store.handle(request('', 'GET'))).status, 404);
  assert.equal((await store.handle(request('?businessEmail=local@example.com', 'GET'))).status, 400, 'Knowing an email cannot locate a profile.');
  assert.equal((await store.handle(request('', 'GET', undefined, 'aoc_local_client_profile=' + 'f'.repeat(64)))).status, 404);
  assert.equal((await store.handle(request('', 'GET', undefined, cookieA, { 'sec-fetch-site': 'cross-site' }))).status, 403);
  const profileB = { ...profile, company: 'Separate Company', businessEmail: 'another@example.com' };
  response = await store.handle(request('', 'POST', { ...body, profile: profileB }));
  const cookieB = response.headers.get('set-cookie').split(';')[0];
  assert.equal(rows().length, 2);
  const fault = new DatabaseSync(filename);
  fault.exec("CREATE TRIGGER fail_test_write BEFORE INSERT ON client_profiles WHEN json_extract(NEW.details, '$.role') = 'Synthetic failure' BEGIN SELECT RAISE(ABORT, 'private test storage failure'); END");
  fault.exec("CREATE TRIGGER fail_test_update BEFORE UPDATE ON client_profiles WHEN json_extract(NEW.details, '$.role') = 'Synthetic failure' BEGIN SELECT RAISE(ABORT, 'private test storage failure'); END");
  fault.close();
  response = await store.handle(request('', 'POST', { ...body, expectedRevision: revisionA, profile: { ...profile, role: 'Synthetic failure' } }, cookieA));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('private test storage failure'));
  assert.equal((await store.handle(request('', 'GET', undefined, cookieA))).status, 200, 'Failed replacement keeps the previous profile and credential.');
  assert.equal(rows().length, 2);
  response = await store.handle(request('', 'GET', undefined, cookieB));
  assert.equal((await response.json()).profile.company, profileB.company);
  response = await store.handle(request('', 'POST', { ...body, expectedRevision: revisionA, profile: { ...profile, role: 'Updated role' }, reuseConfirmed: true }, cookieA));
  let renewedCookieA = response.headers.get('set-cookie').split(';')[0];
  assert.equal(rows().length, 2, 'Explicit replacement removes only the same browser’s old snapshot.');
  assert.equal((await store.handle(request('', 'GET', undefined, cookieA))).status, 200, 'Stable private credential survives updates; stale revisions remain rejected.');
  const updatedRow = rows().find(row => JSON.parse(row.details).company === profile.company);
  const sources = JSON.parse(updatedRow.field_sources);
  assert.equal(sources.company.source, 'reviewed_saved_profile');
  assert.equal(sources.role.source, 'client_entry');
  assert.equal(updatedRow.consent_version, 'client-profile-v3');
  response = await store.handle(request('', 'POST', { ...body, expectedRevision: revisionA }, renewedCookieA));
  assert.equal(response.status, 409, 'A stale review cannot overwrite a newer profile.');
  response = await store.handle(request('', 'POST', { ...body, expectedRevision: updatedRow.id, profile: profileB }, renewedCookieA));
  assert.equal(response.status, 409, 'A new client cannot overwrite another saved company.');
  const facts = { systems: { value: ['Wave'], source: { kind: 'client_entry' } },
    app_access_owner: { value: 'Internal staff', source: { kind: 'client_entry' } },
    data_information_location: { value: 'Shared files', source: { kind: 'ai_extracted', quote: 'shared files' } } };
  for (const invalid of [{ monthly_plan: { value: '10000' } }, { systems: { value: 'Not sure' } }]) {
    response = await store.handle(request('', 'POST', { ...body, expectedRevision: updatedRow.id, area: 'area0', facts: invalid }, renewedCookieA));
    assert.equal(response.status, 400, 'Pricing and unknowns cannot become reusable company facts.');
  }
  response = await store.handle(request('', 'POST', { ...body, expectedRevision: updatedRow.id, area: 'area0', description: 'We keep our information in shared files.', facts }, renewedCookieA));
  assert.equal(response.status, 200);
  const factsRevision = (await response.json()).revision;
  renewedCookieA = response.headers.get('set-cookie').split(';')[0];
  let savedSnapshot = await (await store.handle(request('', 'GET', undefined, renewedCookieA))).json();
  assert.deepEqual(savedSnapshot.facts.systems.value, ['Wave']);
  assert.equal(savedSnapshot.facts.data_information_location.source.kind, 'ai_extracted');
  assert.equal(savedSnapshot.facts.data_information_location.source.quote, 'shared files');
  assert.equal(savedSnapshot.facts.systems.source.area, 'area0');
  assert.equal(savedSnapshot.facts.systems.source.confirmedAt, time);
  response = await store.handle(request('', 'POST', { ...body, expectedRevision: factsRevision }, renewedCookieA));
  assert.equal(response.status, 200);
  const identityRevision = (await response.json()).revision;
  renewedCookieA = response.headers.get('set-cookie').split(';')[0];
  savedSnapshot = await (await store.handle(request('', 'GET', undefined, renewedCookieA))).json();
  assert.deepEqual(savedSnapshot.facts.systems.value, ['Wave'], 'Saving contact details does not erase company facts.');
  response = await store.handle(request('', 'POST', { ...body, expectedRevision: identityRevision, removeIds: ['app_access_owner'] }, renewedCookieA));
  assert.equal(response.status, 200);
  renewedCookieA = response.headers.get('set-cookie').split(';')[0];
  savedSnapshot = await (await store.handle(request('', 'GET', undefined, renewedCookieA))).json();
  assert.equal(savedSnapshot.facts.app_access_owner, undefined);
  assert.ok(savedSnapshot.facts.systems, 'Explicit removal preserves other facts.');
  response = await store.handle(request('', 'POST', { ...body, expectedRevision: savedSnapshot.revision, area: 'area0', facts: {
    data_information_location: { value: 'Shared files', source: { kind: 'reviewed_saved_profile' } },
  } }, renewedCookieA));
  assert.equal(response.status, 200);
  renewedCookieA = response.headers.get('set-cookie').split(';')[0];
  savedSnapshot = await (await store.handle(request('', 'GET', undefined, renewedCookieA))).json();
  assert.equal(savedSnapshot.facts.data_information_location.source.origin.kind, 'ai_extracted');
  assert.equal(savedSnapshot.facts.data_information_location.source.origin.quote, 'shared files', 'Re-saving a reviewed fact retains its original evidence.');
  const merge = mergeCompanyFacts({ answers: { systems: 'Current app', app_access_owner: null }, profileSources: {}, removedScopeFields: [] },
    { ...savedSnapshot.facts, monthly_plan: { value: '10000' }, app_access_owner: facts.app_access_owner }, savedSnapshot.revision);
  assert.equal(merge.answers.systems, 'Current app');
  assert.equal(merge.answers.app_access_owner, null, 'Explicitly cleared answers stay cleared.');
  assert.equal(merge.answers.data_information_location, 'Shared files');
  assert.equal(merge.answers.monthly_plan, undefined);
  assert.equal(merge.count, 1);
  assert.equal(merge.profileSources.data_information_location.kind, 'reviewed_saved_profile');
  assert.equal(mergeCompanyFacts({ answers: { systems: 'Shopify' }, profileSources: {}, facts: { systems: 'Shopify' }, removedScopeFields: [] }, savedSnapshot.facts, savedSnapshot.revision).answers.systems, 'Shopify', 'Fresh description facts are protected too.');
  response = await store.handle(request('', 'DELETE', undefined, renewedCookieA, { 'if-match': revisionA }));
  assert.equal(response.status, 409, 'A stale deletion cannot remove a newer profile.');
  response = await store.handle(request('', 'DELETE', undefined, renewedCookieA, { 'if-match': savedSnapshot.revision }));
  assert.equal((await response.json()).forgotten, true);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(rows().length, 1);
  response = await store.handle(request('', 'GET', undefined, cookieB));
  assert.equal((await response.json()).profile.company, profileB.company, 'Another visitor’s saved details remain untouched.');
  // A separate connection/restart retains the same profile, not just browser memory.
  const reopened = createLocalClientProfiles(filename, { now: () => time });
  assert.equal((await reopened.handle(request('', 'GET', undefined, cookieB))).status, 200);
  reopened.close();
  time += 31 * 24 * 60 * 60 * 1000;
  response = await store.handle(request('/status', 'GET', undefined, cookieB));
  assert.equal((await response.json()).saved, false);
  assert.equal(rows().length, 0, 'Expired profiles are removed.');
  assert.equal((await store.handle(request('', 'PUT', {}))).status, 405);
  response = await store.handle(new Request('http://remote.example.test/api/client-profile/status'));
  assert.equal(response.status, 403);
  response = await store.handle(new Request('http://127.0.0.1:5174/api/client-profile', { method: 'POST', headers: { origin: 'http://127.0.0.1:5174', 'content-type': 'application/json' }, body: '{' }));
  assert.equal(response.status, 400);
  response = await store.handle(request('', 'POST', { ...body, extra: 'x'.repeat(50000) }));
  assert.equal(response.status, 413);
  console.log('PASS: Local profile consent, validation, private browser ownership, no email lookup, renewal/provenance, persistence, forgetting, cross-client isolation, expiry and origin guards.');
} finally { inspection.close(); store.close(); }
