import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createC10OrderPdf } from '../../src/features/payments/c10-order-pdf.js';

const [regularFont, boldFont, logo] = await Promise.all([
  '../../public/fonts/noto-sans/NotoSans-Regular.ttf',
  '../../public/fonts/noto-sans/NotoSans-Bold.ttf',
  '../../public/favicon.png',
].map(async file => (await readFile(new URL(file, import.meta.url))).toString('base64')));

const purchase = {
  testMode: true, outcome: 'paid', purchaseReference: '33333333-3333-4333-8333-333333333333',
  stripeCheckoutReference: 'cs_test_c10_fixture', stripePaymentReference: 'pi_c10_fixture',
  acceptedOrder: {
    documentType: 'C10', documentTitle: 'Process Optimization & Solution Design Order',
    version: 'C10-2026-11-27-v1', reference: 'C10-22222222-2222-4222-8222-222222222222', fingerprint: 'c'.repeat(64),
    issuedAt: '2026-11-27T01:00:00Z', submissionReference: '11111111-1111-4111-8111-111111111111',
    recordingReference: '44444444-4444-4444-8444-444444444444',
    client: {name: 'Vianca Example', company: 'Example Commerce', businessEmail: 'vianca@example.com',
      website: 'example.com', role: 'Authorized representative'},
    project: {businessArea: 'Finance & billing', agreedProcess: 'Prepare invoice drafts and route every invoice for approval.',
      systems: 'Shopify, Stripe, Google Drive', departments: 'Finance and operations'},
    service: {name: 'AI Commerce Discovery & Implementation Plan', description: 'Review and plan the agreed process.',
      included: ['Process review and findings', 'Proposed workflow and implementation plan', 'Build quote and running-cost estimate'],
      excluded: 'Implementation and ongoing services are separate.', delivery: 'Within 5 business days after complete inputs.',
      credit: 'The eligible fee can be credited once toward an accepted build.',
      refund: 'A full refund applies if AOC cannot validate and deliver a viable approach.',
      changeControl: 'Work outside this order requires a separately accepted quote or change order.'},
    price: {amount: 172500, currency: 'usd', tax: 'No separate tax amount is added at sandbox checkout.', total: 172500},
    acceptance: {agreementVersion: 'agreement-v2', wording: 'I accept this paid discovery order.',
      acceptedAt: '2026-11-27T01:05:00Z'},
  },
};

const before = JSON.stringify(purchase);
const doc = createC10OrderPdf(purchase, {regularFont, boldFont, logo});
assert.equal(JSON.stringify(purchase), before, 'C10 generation cannot mutate the accepted order');
const bytes = new Uint8Array(doc.output('arraybuffer'));
assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-');
const task = getDocument({data: bytes});
const pdf = await task.promise;
let text = '';
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  text += ' ' + content.items.map(item => item.str).join(' ');
}
text = text.replace(/\s+/g, ' ');
for (const expected of [purchase.acceptedOrder.reference, purchase.acceptedOrder.version,
  purchase.acceptedOrder.fingerprint,
  purchase.acceptedOrder.client.name, purchase.acceptedOrder.client.company,
  purchase.acceptedOrder.project.agreedProcess, purchase.acceptedOrder.project.systems,
  purchase.acceptedOrder.service.included[0], purchase.acceptedOrder.service.excluded,
  purchase.acceptedOrder.service.delivery, purchase.acceptedOrder.service.credit,
  purchase.acceptedOrder.service.refund, purchase.acceptedOrder.service.changeControl,
  'USD 1,725.00', purchase.purchaseReference, purchase.stripeCheckoutReference,
  purchase.stripePaymentReference, 'The Stripe receipt is a separate payment record']) {
  assert.ok(text.includes(expected), `C10 PDF includes ${expected}`);
}
assert.ok(text.includes('Paid'));
assert.ok(!text.includes('AOC ONLY'));
await task.destroy();
console.log('PASS: accepted C10 PDF preserves the locked client, scope, price, terms, acceptance and payment references without internal template notes.');
