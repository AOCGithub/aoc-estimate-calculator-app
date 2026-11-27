const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createTestPricing, createPreviewServer } = require('../../scripts/dev/local-test-pricing.cjs');
const fixture = require('../fixtures/local-test-pricing.json');
const normalCalculation = require('../../public/journey-calculation.js');
const productionPricing = require('../../public/approved-pricing.js');
const productionBank = require('../../public/approved-bank.js');
const version = productionPricing.version;
const sourceFiles = ['data/commercial-rules-20261029.json', 'public/approved-pricing.js', 'public/approved-bank.js'];
const before = sourceFiles.map(file => fs.readFileSync(file, 'utf8'));

function payload() {
  return {
    area: 'area0',
    confirmed: true,
    answers: {
      solution: 'workflow',
      steps_band: 2,
      variation_band: 2,
      systems: 'None',
      workspace_context: 'none',
      ai_account_context: 'none',
      documentation_readiness: 'Clear and current',
      data_information_location: 'Shared files',
      data_preparation_level: 'clean',
      data_preparation_owner: 'Our team',
      people_count: 3,
      department_count: 1,
      action_mode: 'draft',
      team_time: 40,
      blended_hourly_cost: 50,
    },
  };
}

(async () => {
  const local = createTestPricing();
  const expectedBuild = fixture.moderateCore + 250 + 500 + 500 + 500;
  const localResult = local.calculate(payload()).result;
  assert.equal(local.pricing.simplified.core.moderate, fixture.moderateCore);
  assert.equal(localResult.build, expectedBuild);
  assert.equal(localResult.audit, Math.round(expectedBuild * 0.15 * 100) / 100);
  assert.equal(localResult.net, 1600);
  assert.equal(localResult.monthly, 0);
  assert.ok(localResult.commercialReady);
  assert.match(localResult.commercialNotice, /SYNTHETIC LOCAL TEST DATA/);
  assert.equal(normalCalculation.calculate(payload()).result.build, 5250, 'normal calculation retains approved pricing');
  assert.equal(productionBank.version, version);
  assert.equal(productionPricing.version, version);

  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const html = await (await fetch(origin)).text();
    assert.match(html, /SYNTHETIC LOCAL TEST DATA/);
    assert.match(html, /Moderate workflow core in this preview/);
    const js = await (await fetch(`${origin}/approved-pricing.js`)).text();
    assert.match(js, /synthetic-local/);
    assert.match(js, /"moderate":1234/);
    const response = await fetch(`${origin}/api/journey/calculate`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(payload()),
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.result.build, expectedBuild);
    assert.equal(data.testOnly, true);
    assert.match(data.version, /synthetic-local/);
    assert.equal((await fetch(`${origin}/api/journey/calculate`, {
      method: 'POST',
      headers: { origin: 'https://untrusted.invalid', 'content-type': 'application/json' },
      body: '{}',
    })).status, 403);
    assert.equal((await fetch(`${origin}/api/journey/calculate`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: '{',
    })).status, 400);
    const organizer = await fetch(`${origin}/api/journey/analyze`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal((await organizer.json()).localFallback, true, 'no paid AI request can be made through this preview');
    for (let i = 0; i < sourceFiles.length; i++) {
      assert.equal(fs.readFileSync(sourceFiles[i], 'utf8'), before[i], 'production data remains unchanged');
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  console.log('PASS: isolated synthetic core pricing, normal approved pricing, local API and preview banner; no production pricing changes or AI calls.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
