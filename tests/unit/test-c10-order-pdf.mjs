import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createC10OrderPdf } from '../../src/features/payments/c10-order-pdf.js';

const [regularFont, boldFont] = await Promise.all([
  '../../public/fonts/noto-sans/NotoSans-Regular.ttf',
  '../../public/fonts/noto-sans/NotoSans-Bold.ttf',
].map(async file => (await readFile(new URL(file, import.meta.url))).toString('base64')));

const purchase = {
  testMode: true, outcome: 'paid', paidAt: '2026-11-27T01:06:00Z',
  purchaseReference: '33333333-3333-4333-8333-333333333333',
  stripeCheckoutReference: 'cs_test_c10_fixture', stripePaymentReference: 'pi_c10_fixture',
  acceptedOrder: {
    documentType: 'C10', documentTitle: 'Process Optimization & Solution Design Order',
    version: 'C10-2026-11-27-v1', reference: 'C10-22222222-2222-4222-8222-222222222222',
    fingerprint: 'c'.repeat(64), issuedAt: '2026-11-27T01:00:00Z',
    submissionReference: '11111111-1111-4111-8111-111111111111',
    recordingReference: '44444444-4444-4444-8444-444444444444',
    client: {name: 'Vianca Example', company: 'Example Commerce', businessEmail: 'vianca@example.com',
      website: 'example.com', role: 'Authorized representative'},
    project: {businessArea: 'Finance & billing', businessGoal: 'Reduce invoice handling time',
      agreedProcess: 'Prepare invoice drafts and route every invoice for approval.',
      systems: 'Shopify, Stripe, Google Drive', departments: 'Finance and operations'},
    service: {name: 'AI Commerce Discovery & Implementation Plan',
      description: 'We review the agreed invoice workflow and recommend a practical improvement plan.',
      included: ['Review the current process and available information.',
        'Provide a written report covering options, risks and responsibilities.',
        'If viable, provide a build plan, proposed steps, quote and estimated running costs.'],
      excluded: 'Implementation and ongoing services are separate.',
      delivery: 'Within 5 business days after complete inputs.',
      credit: 'The eligible fee can be credited once toward an accepted build.',
      refund: 'A full refund applies if AOC cannot validate and deliver a viable approach.',
      changeControl: 'Work outside this order requires a separately accepted quote or change order.'},
    price: {amount: 172500, currency: 'usd',
      tax: 'No separate tax amount is added at sandbox checkout.', total: 172500},
    acceptance: {agreementVersion: 'agreement-v2', wording: 'I accept this paid discovery order.',
      acceptedAt: '2026-11-27T01:05:00Z'},
  },
};

async function extractPdf(bytes) {
  const task = getDocument({data: bytes});
  const pdf = await task.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push({page, text: content.items.map(item => item.str).join(' ')});
  }
  return {pdf, pages, task};
}

const before = JSON.stringify(purchase);
const bytes = await createC10OrderPdf(purchase, {regularFont, boldFont});
assert.equal(JSON.stringify(purchase), before, 'C10 generation cannot mutate the accepted order');
assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-');
const result = await extractPdf(bytes);
assert.equal(result.pdf.numPages, 5, 'The blank and AOC-only source pages are omitted');
const coverOperators = await result.pages[0].page.getOperatorList();
assert.ok(coverOperators.fnArray.includes(OPS.paintImageXObject),
  'The original Template V6 cover artwork is embedded in the PDF');
const text = result.pages.map(page => page.text).join(' ').replace(/\s+/g, ' ');
for (const expected of [
  'Accepted order — sandbox payment confirmed',
  'C10-22222222-2222-4222-8222-222222222222', 'Example Commerce', 'Finance & billing',
  'C10-2026-11-27-v1', 'Prepare invoice drafts and route every invoice for approval.',
  'Finance and operations', 'Reduce invoice handling time', 'Shopify, Stripe, Google Drive',
  'Review the current process and available information.',
  'Provide a written report covering options, risks and responsibilities.',
  'If viable, provide a build plan, proposed steps, quote and estimated running costs.',
  'Implementation and ongoing services are separate.',
  'Within 5 business days after complete inputs.',
  'The eligible fee can be credited once toward an accepted build.',
  'A full refund applies if AOC cannot validate and deliver a viable approach.',
  'Work outside this order requires a separately accepted quote or change order.',
  'USD 1,725.00', 'Stripe payment: pi_c10_fixture',
  purchase.purchaseReference, 'I accept this paid discovery order.',
]) {
  assert.ok(text.includes(expected), `Accepted C10 PDF includes ${expected}`);
}
assert.ok(!text.includes('AOC ONLY'));
assert.ok(!text.includes('WORKING DRAFT'));
assert.ok(!/\[[^\]]+\]/.test(text), 'The PDF text layer contains no unresolved placeholders');
await result.task.destroy();

const longPurchase = structuredClone(purchase);
longPurchase.acceptedOrder.project.agreedProcess = 'Invoice routing detail. '.repeat(300);
const longBytes = await createC10OrderPdf(longPurchase, {regularFont, boldFont});
const longResult = await extractPdf(longBytes);
assert.ok(longResult.pdf.numPages > 5, 'Long accepted processes receive a continuation page');
const longText = longResult.pages.map(page => page.text).join(' ').replace(/\s+/g, ' ');
assert.ok(longText.includes('AGREED PROCESS DETAILS'));
assert.ok(longText.includes('Invoice routing detail.'));
assert.ok(longText.includes('Finance and operations'));
assert.ok(!/\[[^\]]+\]/.test(longText));
await longResult.task.destroy();

await assert.rejects(
  createC10OrderPdf({...purchase, outcome: 'unpaid'}, {regularFont, boldFont}),
  /confirmed payment/,
);
console.log('PASS: C10 uses the Template V6 artwork, fills accepted order data, excludes the blank/internal pages and adds overflow safely.');
