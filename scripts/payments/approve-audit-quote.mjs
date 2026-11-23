import assert from 'node:assert/strict';
import { createHostedHandoffStore } from '../../server/payments/hosted-handoff-store.mjs';

const [submissionReference, amountText, quotedBy] = process.argv.slice(2);
assert.match(submissionReference || '', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  'Provide the saved submission reference.');
assert.ok(/^\d+(\.\d{1,2})?$/.test(amountText || ''), 'Provide the fixed USD audit fee with no more than two decimal places.');
assert.ok(quotedBy?.trim(), 'Provide the AOC reviewer name or business email.');
const amount = Math.round(Number(amountText) * 100);
assert.ok(Number.isSafeInteger(amount) && amount > 0 && amount <= 99999999, 'The audit fee is outside the supported range.');
const connection = process.env.AOC_G2_POSTGRES_URL || process.env.POSTGRES_URL;
assert.ok(connection, 'Load the private server database connection through Vercel env run.');

const store = createHostedHandoffStore(connection);
try {
  const quote = await store.approveQuote({submissionReference, amount, quotedBy: quotedBy.trim()});
  console.log(`Audit quote ${quote.id} saved for submission ${submissionReference}: $${(amount / 100).toFixed(2)} USD.`);
} finally {
  await store.close();
}
