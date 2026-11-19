import { readFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import questionBank from '../../public/approved-bank.js';
import { createPurchasePdf } from '../../src/features/payments/purchase-pdf.js';
import { renderPaymentEmail, supportEmail } from './payment-email-templates.mjs';

function emailAddress(value) {
  const address = typeof value === 'string' ? value.trim() : '';
  return address.length <= 254 && /^[^\s<>,;:@]+@[^\s<>,;:@]+\.[^\s<>,;:@]+$/.test(address) ? address : '';
}

let pdfAssets;
async function estimateAttachment(purchase) {
  pdfAssets ||= Promise.all([
    new URL('../../public/fonts/noto-sans/NotoSans-Regular.ttf', import.meta.url),
    new URL('../../public/fonts/noto-sans/NotoSans-Bold.ttf', import.meta.url),
    new URL('../../public/favicon.png', import.meta.url),
  ].map(asset => readFile(asset, 'base64'))).catch(error => { pdfAssets = null; throw error; });
  const [regularFont, boldFont, logo] = await pdfAssets;
  const doc = createPurchasePdf(purchase, {regularFont, boldFont, logo, questionBank});
  return {filename: `aoc-estimate-${purchase.submissionReference}.pdf`, contentType: 'application/pdf',
    content: Buffer.from(doc.output('arraybuffer'))};
}

function smtpFailure(error) {
  if (Number.isInteger(error.responseCode)) return error.responseCode < 500 ? 'retry' : 'failed';
  if (['CONN', 'EHLO', 'HELO', 'STARTTLS', 'MAIL FROM', 'RCPT TO'].includes(error.command) ||
      /^AUTH\b/.test(error.command || '')) return 'retry';
  // A lost connection after DATA can mean the SMTP server already accepted the message.
  return 'uncertain';
}

export function createPaymentEmailSender({store, transport, fromAddress, testClientAddress = ''}) {
  async function deliver({purchase, audience, to, clientName, checkoutEmail}) {
    const id = purchase.purchaseReference;
    if (!(await store.claimPaymentEmail(id, audience))) return;
    let message;
    try {
      const copy = await renderPaymentEmail({purchase, audience, clientName, checkoutEmail});
      message = {...copy, to: {address: to, name: audience === 'client' ? clientName : 'AOC Support'},
        from: {address: fromAddress, name: 'Always Open Commerce'}, replyTo: supportEmail,
        messageId: `<aoc-audit-${id}-${audience}@${fromAddress.split('@')[1]}>`,
        ...(audience === 'client' ? {attachments: [await estimateAttachment(purchase)]} : {})};
    } catch {
      await store.finishPaymentEmail(id, audience, 'retry');
      throw new Error('payment_email_render_failed');
    }
    let state;
    try {
      const result = await transport.sendMail(message);
      state = result.accepted?.length === 1 ? 'sent' : 'failed';
    } catch (error) {
      state = smtpFailure(error);
    }
    await store.finishPaymentEmail(id, audience, state);
    if (state === 'retry') throw new Error('payment_email_retry');
    if (state !== 'sent') console.warn('G2 payment email needs review.', {purchaseReference: id, audience, state});
  }

  return async function notifyPaid(purchase, customerDetails) {
    if (purchase.outcome !== 'paid') return;
    const checkoutEmail = emailAddress(customerDetails?.email);
    const clientName = purchase.snapshot.profile?.name || customerDetails?.name || '';
    const checkout = {purchase, clientName, checkoutEmail};
    const messages = [deliver({...checkout, audience: 'support', to: supportEmail})];
    // Stripe can report a paid session before the receipt URL is available.
    if (checkoutEmail && purchase.receiptUrl) {
      messages.push(deliver({...checkout, audience: 'client', to: testClientAddress || checkoutEmail}));
    } else if (checkoutEmail) {
      messages.push(Promise.reject(new Error('payment_receipt_pending')));
    }
    const results = await Promise.allSettled(messages);
    if (results.some(result => result.status === 'rejected')) throw new Error('payment_email_retry');
  };
}

export function configurePaymentEmailSender(environment, store) {
  const fromAddress = emailAddress(environment.AOC_G2_EMAIL_FROM);
  const testClientAddress = emailAddress(environment.AOC_G2_EMAIL_TEST_CLIENT_TO);
  const port = Number(environment.AOC_G2_SMTP_PORT || 587);
  const {AOC_G2_SMTP_HOST: host, AOC_G2_SMTP_USER: user, AOC_G2_SMTP_PASSWORD: pass} = environment;
  if (!fromAddress || !host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535 ||
      (environment.AOC_G2_EMAIL_TEST_CLIENT_TO && !testClientAddress)) throw new Error('payment_email_config_incomplete');
  const transport = nodemailer.createTransport({host, port, secure: port === 465, requireTLS: port !== 465,
    auth: {user, pass}, connectionTimeout: 6000, greetingTimeout: 8000, socketTimeout: 12000,
    disableFileAccess: true, disableUrlAccess: true});
  return createPaymentEmailSender({store, transport, fromAddress, testClientAddress});
}
