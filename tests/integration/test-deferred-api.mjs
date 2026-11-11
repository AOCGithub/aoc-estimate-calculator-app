import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { handleAccessStatus, handleJourneyCalculation } from '../../server/api-handlers.mjs';

const require = createRequire(import.meta.url);
const isLoaded = file => Boolean(require.cache[require.resolve('../../public/' + file)]);
const expensive = ['approved-bank.js', 'catalog.js', 'journey-calculation.js', 'journey-contract.js', 'intake-contract.js'];
assert.deepEqual(expensive.filter(isLoaded), [], 'Loading access handlers does not initialize calculator or historical intake data');
assert.equal((await handleAccessStatus(new Request('https://deferred.example/api/access/status'), {}).json()).authenticated, true);
const denied = await handleJourneyCalculation(new Request('https://deferred.example/api/journey/calculate', {
  method: 'POST', headers: { origin: 'https://other.example', 'content-type': 'application/json' }, body: '{}',
}), {});
assert.equal(denied.status, 403);
assert.deepEqual(expensive.filter(isLoaded), [], 'Rejected requests do not initialize calculation data');
const { area, process_confirmed, ...answers } = require('../fixtures/commercial.cjs');
const response = await handleJourneyCalculation(new Request('https://deferred.example/api/journey/calculate', {
  method: 'POST', headers: { origin: 'https://deferred.example', 'content-type': 'application/json' },
  body: JSON.stringify({ area, answers, confirmed: process_confirmed }),
}), {});
assert.equal(response.status, 200);
assert.equal((await response.json()).result.build, 11500);
assert.equal(isLoaded('approved-bank.js'), true);
assert.equal(isLoaded('journey-calculation.js'), true);
assert.equal(isLoaded('catalog.js'), false, 'Current calculations do not load the historical intake catalog');
assert.equal(isLoaded('intake-contract.js'), false);
console.log('PASS: Cold access and rejected API requests skip calculator/intake data; valid calculations initialize only their dependencies and preserve pricing.');
