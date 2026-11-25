import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import calculationRoute from '../../api/journey/calculate.mjs';
import analysisRoute from '../../api/journey/analyze.mjs';
import intakeStatusRoute from '../../api/intake/status.mjs';
import intakeAnalysisRoute from '../../api/intake/analyze.mjs';
import intakeTranscriptionRoute from '../../api/intake/transcribe.mjs';
import commercialFixture from '../fixtures/commercial.cjs';

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalEnabled = process.env.AOC_AI_ORGANIZER_ENABLED;
const origin = 'https://aoc-estimate-calculator-app.vercel.app';

try {
  for (const path of ['access/status', 'access/verify', 'access/logout', 'access/redeem',
    'journey/calculate', 'journey/analyze', 'journey/correct', 'intake/status', 'intake/analyze', 'intake/transcribe', 'voice/session',
    'client-profile', 'client-profile/status', 'client-profile/cleanup']) {
    const route = await import('../../api/' + path + '.mjs');
    assert.equal(typeof route.default.fetch, 'function', path + ' must use the Web Request/Response entry format.');
  }
  const {area:fixtureArea,process_confirmed:fixtureConfirmed,...quoteAnswers}=commercialFixture;
  const calculation = { area: fixtureArea, confirmed: fixtureConfirmed, answers: quoteAnswers };
  let response = await calculationRoute.fetch(new Request(`${origin}/api/journey/calculate`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(calculation),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, 'server');
  assert.equal(result.result.build, 12250);
  assert.equal(result.result.audit, 1837.5);
  assert.equal(result.result.auditRate, 0.15);
  assert.equal(result.result.monthly, 0, 'the retired monthly service price is not calculated');
  assert.equal(result.version, 'simplified-2026-11-25-v7-paid-advertising-coming-soon');
  const monthlyRequest = { ...calculation, answers: { ...calculation.answers, implementation_route:'monthly', monthly_plan:'level2' } };
  response = await calculationRoute.fetch(new Request(`${origin}/api/journey/calculate`, {method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(monthlyRequest)}));
  assert.equal(response.status,400, 'deferred monthly programs cannot be priced by the launch API');
  assert.match((await response.json()).error, /Unknown calculation field/);
  for(const [key,value] of [['action_mode','manage'],['data_preparation_level','Some preparation'],['workspace_context','personal']]) {
    response = await calculationRoute.fetch(new Request(`${origin}/api/journey/calculate`, {method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({...calculation,answers:{...calculation.answers,[key]:value}})}));
    assert.equal(response.status,400,'invalid simplified-rule input is rejected');
  }

  response = await calculationRoute.fetch(new Request(`${origin}/api/journey/calculate`, {
    method: 'POST',
    headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
    body: JSON.stringify(calculation),
  }));
  assert.equal(response.status, 403);

  delete process.env.OPENAI_API_KEY;
  process.env.AOC_AI_ORGANIZER_ENABLED = 'false';
  response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ area: 'area0', text: 'We prepare 40 invoices in Wave each month.' }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).localFallback, true);

  response = await intakeStatusRoute.fetch(new Request(`${origin}/api/intake/status`));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).configured, false);

  response = await intakeTranscriptionRoute.fetch(new Request(`${origin}/api/intake/transcribe`, {
    method: 'POST',
    headers: { origin },
  }));
  assert.equal(response.status, 503);

  process.env.OPENAI_API_KEY = 'test-placeholder-not-real';
  process.env.AOC_AI_ORGANIZER_ENABLED = 'true';
  for (const [route, name] of [[analysisRoute, 'journey/analyze'], [intakeAnalysisRoute, 'intake/analyze'], [calculationRoute, 'journey/calculate']]) {
    for (const value of [null, [], 123, true, 'unexpected text']) {
      const invalid = await route.fetch(new Request(`${origin}/api/${name}`, {
        method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(value),
      }));
      assert.equal(invalid.status, 400, name + ' rejects non-object JSON without an unhandled exception');
      assert.equal(typeof (await invalid.json()).error, 'string');
    }
  }
  const output = {
    title: 'Invoice preparation',
    summary: 'Monthly invoice preparation',
    solution: 'workflow',
    recommendationReason: 'Defined rules',
    classification: { steps: 2, variations: 1, decisions: null, reason: 'Several steps' },
    routes: ['Create and send invoices'],
    facts: [
      { id: 'invoice_volume', value: '40', quote: '40 invoices' },
      { id: 'systems', value: 'Wave', quote: 'Wave' },
    ],
    relevantFields: ['invoice_volume'],
    uncertainties: [],
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.ok(body.text.format.schema.properties.facts);
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
  };
  response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ area: 'area0', text: 'We prepare 40 invoices in Wave each month.' }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).analysis.facts.map(fact => fact.id), ['invoice_volume']);

  const unknownResponsibility = 'We do not yet know who should manage it. Please help us identify the missing details.';
  output.facts = [{ id: 'responsibility_split', value: 'help', quote: unknownResponsibility }];
  response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ area: 'area0', text: unknownResponsibility }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).analysis.facts, [], 'API removes retired management-help choices');

  const manualPublishing = 'Staff review and publish everything manually.';
  const unknownManager = manualPublishing + ' We do not know how many people will use it, who will manage the finished workflow, or how much time it will save.';
  output.facts = [{ id: 'responsibility_split', value: 'client', quote: manualPublishing }, { id: 'management', value: 'no', quote: manualPublishing }];
  response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ area: 'area10', text: unknownManager }),
  }));
  assert.equal(response.status, 400, 'future business areas cannot be analyzed before launch');

  const explicitManagementHelp = 'Please help us decide who should manage the process.';
  output.facts = [{ id: 'responsibility_split', value: 'help', quote: explicitManagementHelp }];
  response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ area: 'area0', text: explicitManagementHelp }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).analysis.facts, [], 'API excludes retired management-help fields');

  for (const [text, value, expected] of [
    ['A person must approve every reply in Help Scout.', 'approved', []],
    ['We need draft replies in Help Scout. A person must approve every reply.', 'approved', ['draft']],
    ['We need draft replies in Help Scout. A person must approve every reply.', 'draft', ['draft']],
    ['Make changes only after our approval.', 'approved', ['approved']],
    ['The agent drafts replies, then sends them once approved.', 'approved', ['approved']],
    ['Send routine replies automatically within agreed limits.', 'automatic', ['automatic']],
  ]) {
    output.facts = [{ id: 'action_mode', value, quote: text }];
    response = await analysisRoute.fetch(new Request(`${origin}/api/journey/analyze`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ area: 'area1', text }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).analysis.facts.map(fact => fact.value), expected, 'API keeps drafting separate from execution');
  }

  const vercelConfig = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercelConfig.framework, 'vite');
  assert.equal(vercelConfig.outputDirectory, 'dist/client');
  const fallback = vercelConfig.redirects.find(rule => rule.has?.some(condition => condition.type === 'host' && condition.value === 'aoc-estimate-calculator.vercel.app'));
  assert.equal(fallback.source, '/', 'Only the entry page redirects; existing API and asset routes are preserved');
  assert.equal(fallback.destination, 'https://estimate.alwaysopencommerce.com/');
  assert.equal(fallback.permanent, false);
  assert.ok(vercelConfig.redirects.every(rule => !rule.has.some(condition => condition.value === 'estimate.alwaysopencommerce.com')), 'The registered AOC hostname does not redirect back to itself');
  assert.ok(vercelConfig.headers.some(rule => rule.headers.some(header => header.key === 'Content-Security-Policy')));
  const csp = vercelConfig.headers.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy').value;
  assert.ok(csp.split(';').find(directive => directive.trim().startsWith('font-src ')).split(/\s+/).includes("'self'"), 'Self-hosted entry fonts are permitted by production CSP');

  console.log('PASS: Vercel calculation, organizer fallback/provider contract, retained status, origin guard, output path, and security configuration.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalEnabled === undefined) delete process.env.AOC_AI_ORGANIZER_ENABLED;
  else process.env.AOC_AI_ORGANIZER_ENABLED = originalEnabled;
}
