import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import Correction from '../../server/description/description-correction.cjs';
import { handleDescriptionCorrection, handleAccessVerification } from '../../server/api-handlers.mjs';

const origin = 'https://correction.test';
function request(text, cookie = '', method = text === undefined ? 'GET' : 'POST', source = origin, inputSource) {
  return new Request(origin + '/api/journey/correct', { method,
    headers: { origin: source, cookie, 'content-type': 'application/json' },
    ...(text === undefined ? {} : { body: JSON.stringify({ area: 'area10', text, ...(inputSource ? { source: inputSource } : {}) }) }),
  });
}
if (process.argv.includes('--live')) {
  assert.ok(process.env.OPENAI_API_KEY, 'Load the server key without printing it.');
  const settings = { ...process.env, AOC_ACCESS_GATE_ENABLED: 'false', AOC_MANUAL_ACCESS_ENABLED: 'false', AOC_DESCRIPTION_CORRECTION_ENABLED: 'true' };
  const cases = process.argv.includes('--quality') ? [
    { name: 'Missing commas with protected facts', text: 'Before we publish a campaign we review the budget check the audience and approve the final ad. We use Meta Ads Manager Shopify and Google Sheets. Our budget is $2,500.50 monthly and we only draft replies; we do not send them.',
      check(result) {
        assert.match(result.text, /campaign, we review/);
        assert.match(result.text, /Manager, Shopify/);
        assert.ok(result.text.includes('$2,500.50 monthly'));
        assert.equal(result.text.replace(/[,.]/g, ''), this.text.replace(/[,.]/g, ''), 'Punctuation cannot change words or facts.');
      } },
    { name: 'Ambiguous first word and inaudible value', source: 'voice', text: 'Testem one two three I am checking my microphone. Our budget is [inaudible]. We only want drafts and do not approve sending.',
      check(result) {
        assert.ok(result.text.startsWith('Testem'), 'An uncertain first word must require confirmation.');
        assert.ok(result.review.some(item => item.before === 'Testem' && /^testing$/i.test(item.after)), 'Offer a possible wording for review.');
        assert.ok(result.text.includes('budget is [inaudible]'));
        assert.ok(result.text.includes('only want drafts and do not approve sending'));
      } },
  ] : [
    { name: 'Typed misspellings and facts', text: 'we need adverstising and weekly reprots. our budget is $2500 monthly. only draft replies; do not send them. the additional cost is unknown.',
      check(result) { assert.match(result.text, /advertising and weekly reports/); assert.ok(result.text.includes('$2500 monthly')); assert.ok(result.text.includes('only draft replies; do not send them.')); assert.ok(result.text.includes('additional cost is unknown')); } },
    { name: 'Contextual speech wording', text: 'we need adds on meta and weekly reprots for our store. our ad spend is [inaudible]. do not increase it.',
      check(result) { assert.match(result.text, /need ads on meta and weekly reports/); assert.ok(result.text.includes('ad spend is [inaudible]')); assert.ok(result.text.includes('do not increase it')); } },
    { name: 'Names, unknowns and restrictions', text: 'Qorvex and Acmely use Xero. Budget and account count are unknown. We need draft replies only. No sending, refunds or changes without human approval.',
      check(result) { assert.equal(result.text, this.text); } },
  ];
  const results = [];
  const originalProviderFetch = globalThis.fetch;
  let rawOutput = '';
  if (process.argv.includes('--quality')) globalThis.fetch = async (...args) => {
    const response = await originalProviderFetch(...args);
    const payload = await response.clone().json().catch(() => ({}));
    rawOutput = (payload.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('');
    return response;
  };
  for (const item of cases) {
    const started = Date.now();
    const response = await handleDescriptionCorrection(request(item.text, '', 'POST', origin, item.source), settings);
    const result = await response.json();
    const record = { name: item.name, passed: false, elapsedMs: Date.now() - started, ...result,
      ...(process.argv.includes('--quality') ? { rawOutput } : {}) };
    results.push(record);
    try {
      assert.equal(response.status, 200, JSON.stringify(result));
      item.check(result);
      record.passed = true;
      console.log('PASS:', item.name, JSON.stringify(result));
    } catch (error) {
      record.error = error.message;
      process.exitCode = 1;
      console.error('FAIL:', item.name, error.message);
    }
  }
  globalThis.fetch = originalProviderFetch;
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/description-correction-live' + (process.argv.includes('--quality') ? '-quality' : '') + '.json', JSON.stringify({ syntheticTextOnly: true, requests: cases.length, results }, null, 2));
  console.log(`${results.every(result => result.passed) ? 'PASS' : 'FAIL'}: ${cases.length} short paid cleanup checks; no audio capture, database writes or deployment.`);
} else {
  const edit = (before, after, kind = 'typo') => ({ before, after, kind });
  const source = 'we need adverstising and reprots. keep $2500 monthly, Qorvex, draft replies only; do not send them. budget unknown.';
  const fixed = Correction.validate(source, { edits: [edit('adverstising', 'advertising'), edit('reprots', 'reports'),
    edit('$2500', '$3500'), edit('monthly', 'weekly'), edit('Qorvex', 'Corvex'), edit('do not', 'do'), edit('draft', 'send'), edit('unknown', 'known')] });
  assert.equal(fixed.text, source.replace('adverstising', 'advertising').replace('reprots', 'reports'));
  assert.deepEqual(fixed.edits.map(item => item.before), ['adverstising', 'reprots']);
  assert.equal(fixed.review[0].before, 'Qorvex');
  for (const [before, after] of [['five', 'four'], ['can', 'cannot'], ['no', 'yes'], ['send', 'spend'], ['approval', 'automatic'], ['not sure', 'certain'], ['client@example.com', 'other@example.com'], ['https://aoc.com', 'https://other.com']]) {
    assert.equal(Correction.validate(before, { edits: [edit(before, after)] }).text, before);
  }
  assert.equal(Correction.validate('reprots reprots', { edits: [edit('reprots', 'reports')] }).text, 'reprots reprots', 'Ambiguous source spans are not replaced.');
  assert.equal(Correction.validate('lead routing', { edits: [edit('lead routing', 'lead scoring', 'unclear')] }).text, 'lead routing');
  assert.equal(Correction.validate('lead routing', { edits: [edit('lead routing', 'lead scoring', 'unclear')] }).review.length, 1);
  assert.equal(Correction.validate('x'.repeat(17996) + ' ab', { edits: [edit('ab', 'abcd')] }).text.length, 17999, 'Corrections cannot exceed the description limit.');
  assert.throws(() => Correction.validate(source, {}));
  const unpunctuated = 'Before publishing we check the budget audience and ad copy. We use Meta Shopify and Google Sheets';
  const punctuated = 'Before publishing, we check the budget, audience, and ad copy. We use Meta, Shopify, and Google Sheets.';
  const punctuation = Correction.validate(unpunctuated, { edits: [edit(unpunctuated, punctuated, 'punctuation')] });
  assert.equal(punctuation.text, punctuated);
  assert.ok(punctuation.edits.every(item => item.before === '' && /^[,.]$/.test(item.after)), 'Return minimal insertions so caret positions can be preserved.');
  for (const [before, after] of [['Do not send ads', 'Do not, send ads'], ['Only prepare drafts', 'Only, prepare drafts'],
    ['$2500 monthly', '$2,500 monthly'], ['client@example.com', 'client,@example.com'], ['https://example.com/path', 'https://example.com,/path'],
    ['no, send drafts', 'no send drafts'], ['Budget unknown', 'Budget $500'], ['Send drafts only', 'Send. drafts only']]) {
    assert.equal(Correction.validate(before, { edits: [edit(before, after, 'punctuation')] }).text, before, 'Reject unsafe punctuation: ' + after);
  }
  assert.equal(Correction.validate('https://reprots.example.com', { edits: [edit('reprots', 'reports')] }).text, 'https://reprots.example.com', 'A typo-sized substring cannot change an identifier.');
  const mixed = 'we need reprots from Meta Shopify and Google Sheets';
  assert.equal(Correction.validate(mixed, { edits: [edit('reprots', 'reports'), edit(mixed, mixed.replace('Meta Shopify', 'Meta, Shopify') + '.', 'punctuation')] }).text,
    'we need reports from Meta, Shopify and Google Sheets.');

  const settings = { AOC_ACCESS_GATE_ENABLED: 'true', AOC_APPROVED_EMAILS: '["spelling@example.test"]',
    AOC_ACCESS_SESSION_SECRET: 'synthetic-correction-secret-at-least-32-characters',
    AOC_DESCRIPTION_CORRECTION_ENABLED: 'true', OPENAI_API_KEY: 'synthetic-key', AOC_INTAKE_MODEL: 'correction-fixture' };
  let mode = 'ok', calls = 0;
  const originalFetch = globalThis.fetch;
  async function provider(url, options) {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, 'Bearer synthetic-key');
    assert.equal(body.model, 'correction-fixture');
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.ok(body.instructions.includes('untrusted text'));
    assert.ok(body.text.format.schema.properties.edits.items.properties.kind.enum.includes('punctuation'));
    if (mode === 'quota') return Response.json({ error: 'private-provider-details' }, { status: 429 });
    if (mode === 'failure') throw new Error('private-provider-details');
    return Response.json({ status: mode === 'incomplete' ? 'incomplete' : 'completed', output: [{ content: [{ type: 'output_text',
      text: mode === 'invalid' ? '{}' : JSON.stringify({ edits: [edit('adverstising', 'advertising'), edit('reprots', 'reports')] }),
    }] }] });
  }
  async function exercise(dispatch, cookie) {
    assert.equal((await dispatch(request())).status, 401);
    assert.equal((await dispatch(request(undefined, cookie))).status, 200);
    assert.equal((await dispatch(request(source, cookie, 'POST', 'https://other.test'))).status, 403);
    assert.equal((await dispatch(request('a', cookie))).status, 400);
    assert.equal((await dispatch(request('a'.repeat(18001), cookie))).status, 400);
    assert.equal((await dispatch(request('a'.repeat(100001), cookie))).status, 413);
    assert.equal((await dispatch(request(undefined, cookie, 'DELETE'))).status, 405);
    assert.equal((await dispatch(request(source, cookie, 'POST', origin, 'invalid'))).status, 400);
    assert.equal((await dispatch(request(source, cookie), { ...settings, OPENAI_API_KEY: '' })).status, 503);
    assert.deepEqual(await (await dispatch(request(undefined, cookie), { ...settings, AOC_DESCRIPTION_CORRECTION_ENABLED: 'false' })).json(), { configured: false });
    const prior = calls;
    for (const [scenario, code] of [['ok', 200], ['quota', 429], ['failure', 502], ['incomplete', 502], ['invalid', 502]]) {
      mode = scenario;
      const response = await dispatch(request(source, cookie));
      assert.equal(response.status, code, scenario);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const raw = await response.text();
      assert.ok(!/synthetic-key|private-provider-details/u.test(raw));
      if (code === 200) assert.equal(JSON.parse(raw).text, fixed.text);
    }
    assert.equal(calls - prior, 5);
    mode = 'ok';
  }
  try {
    globalThis.fetch = provider;
    const access = await handleAccessVerification(new Request(origin + '/api/access/verify', { method: 'POST',
      headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Spelling Test', company: 'Example Company', website: 'example.com', role: 'Testing', businessEmail: 'spelling@example.test' }) }), settings);
    assert.equal(access.status, 200);
    const cookie = access.headers.get('set-cookie').split(';')[0];
    await exercise((request, environment = settings) => handleDescriptionCorrection(request, environment), cookie);
    const bundled = await readFile(new URL('../../dist/server/index.js', import.meta.url), 'utf8');
    const context = vm.createContext({ Request, Response, Blob, FormData, URL, AbortSignal, crypto: webcrypto,
      atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout, console, fetch: provider });
    vm.runInContext(bundled.replace(/export default\s*\{\s*async fetch/, 'globalThis.worker={async fetch'), context);
    await exercise((request, environment = settings) => context.worker.fetch(request, environment), cookie);
    for (let i = 0; i < 121; i++) {
      const result = await handleDescriptionCorrection(request(source, cookie), settings);
      if (i === 120) assert.equal(result.status, 429);
    }
    console.log('PASS: Small spelling edits, protected facts/numbers/names/negations/permissions, uncertain suggestions, bounds, access/origin/configuration guards, rate guard, provider failures and Node/Worker parity. No paid calls.');
  } finally { globalThis.fetch = originalFetch; }
}
