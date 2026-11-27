import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import questionBank from '../../public/approved-bank.js';
import { createPurchasePdf } from '../../src/features/payments/purchase-pdf.js';
import { createC10OrderPdf } from '../../src/features/payments/c10-order-pdf.mjs';
import { renderPaymentEmail, supportEmail } from './payment-email-templates.mjs';
import { createMicrosoftMailTransport } from './microsoft-mail.mjs';

function emailAddress(value) {
  const address = typeof value === 'string' ? value.trim() : '';
  return address.length <= 254 && /^[^\s<>,;:@]+@[^\s<>,;:@]+\.[^\s<>,;:@]+$/.test(address) ? address : '';
}

let pdfAssets;
async function attachmentAssets() {
  pdfAssets ||= Promise.all([
    new URL('../../public/fonts/noto-sans/NotoSans-Regular.ttf', import.meta.url),
    new URL('../../public/fonts/noto-sans/NotoSans-Bold.ttf', import.meta.url),
    new URL('../../public/favicon.png', import.meta.url),
  ].map(asset => readFile(asset, 'base64'))).catch(error => { pdfAssets = null; throw error; });
  const [regularFont, boldFont, logo] = await pdfAssets;
  return {regularFont, boldFont, logo};
}

async function paymentAttachments(purchase) {
  const {regularFont, boldFont, logo} = await attachmentAssets();
  const doc = createPurchasePdf(purchase, {regularFont, boldFont, logo, questionBank});
  const estimate = {filename: `aoc-estimate-${purchase.submissionReference}.pdf`, contentType: 'application/pdf',
    content: Buffer.from(doc.output('arraybuffer')),
    cid: `aoc-estimate-${purchase.purchaseReference.slice(0, 8)}@alwaysopencommerce.com`,
    contentDisposition: 'attachment'};
  const c10 = await createC10OrderPdf(purchase, {regularFont, boldFont});
  const order = {filename: `aoc-process-optimization-order-${purchase.acceptedOrder.reference}.pdf`, contentType: 'application/pdf',
    content: Buffer.from(c10),
    cid: `aoc-c10-${purchase.purchaseReference.slice(0, 8)}@alwaysopencommerce.com`,
    contentDisposition: 'attachment'};
  return {estimate, order};
}

function smtpFailure(error) {
  if (Number.isInteger(error.responseCode)) return error.responseCode < 500 ? 'retry' : 'failed';
  if (['CONN', 'EHLO', 'HELO', 'STARTTLS', 'MAIL FROM', 'RCPT TO'].includes(error.command) ||
      /^AUTH\b/.test(error.command || '')) return 'retry';
  // A lost connection after DATA can mean the SMTP server already accepted the message.
  return 'uncertain';
}

export function createPaymentEmailSender({store, transport, fromAddress, testClientAddress = ''}) {
  async function deliver({purchase, audience, to, clientName, checkoutEmail, attachments}) {
    const id = purchase.purchaseReference;
    if (!(await store.claimPaymentEmail(id, audience))) return;
    let message;
    try {
      const copy = await renderPaymentEmail({purchase, audience, clientName, checkoutEmail,
        estimatePdfHref: `cid:${attachments.estimate.cid}`, orderPdfHref: `cid:${attachments.order.cid}`});
      message = {...copy, to: {address: to, name: audience === 'client' ? clientName : 'AOC Support'},
        from: {address: fromAddress, name: 'Always Open Commerce'}, replyTo: supportEmail,
        messageId: `<aoc-audit-${id}-${audience}@${fromAddress.split('@')[1]}>`,
        attachments: [attachments.order, attachments.estimate]};
    } catch {
      await store.finishPaymentEmail(id, audience, 'retry');
      throw new Error('payment_email_render_failed');
    }
    let state;
    try {
      const result = await transport.sendMail(message);
      state = result.accepted?.length === 1 ? 'sent' : 'failed';
    } catch (error) {
      state = error.deliveryState || smtpFailure(error);
    }
    await store.finishPaymentEmail(id, audience, state);
    if (state === 'retry') throw new Error('payment_email_retry');
    if (state !== 'sent') console.warn('G2 payment email needs review.', {purchaseReference: id, audience, state});
  }

  return async function notifyPaid(purchase, customerDetails) {
    if (purchase.outcome !== 'paid') return;
    const checkoutEmail = emailAddress(customerDetails?.email);
    const clientName = purchase.snapshot.profile?.name || customerDetails?.name || '';
    const attachments = await paymentAttachments(purchase);
    const checkout = {purchase, clientName, checkoutEmail, attachments};
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

function smtpTransport(environment) {
  const port = Number(environment.AOC_G2_SMTP_PORT || 587);
  const {AOC_G2_SMTP_HOST: host, AOC_G2_SMTP_USER: user, AOC_G2_SMTP_PASSWORD: pass} = environment;
  if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('payment_email_config_incomplete');
  }
  return nodemailer.createTransport({host, port, secure: port === 465, requireTLS: port !== 465,
    auth: {user, pass}, connectionTimeout: 6000, greetingTimeout: 8000, socketTimeout: 12000,
    disableFileAccess: true, disableUrlAccess: true});
}

export function createLocalCaptureTransport(directory = fileURLToPath(
  new URL('../../artifacts/g2/email-capture/', import.meta.url))) {
  const renderer = nodemailer.createTransport({streamTransport: true, buffer: true, newline: 'windows'});
  return {async sendMail(message) {
    await mkdir(directory, {recursive: true});
    const rendered = await renderer.sendMail(message);
    const base = String(message.messageId || `local-${Date.now()}`)
      .replace(/[<>]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
    const paths = [join(directory, `${base}.eml`)];
    await writeFile(paths[0], rendered.message);
    for (const attachment of message.attachments || []) {
      const filename = String(attachment.filename || 'attachment.bin').replace(/[^a-zA-Z0-9._-]+/g, '-');
      const path = join(directory, `${base}--${filename}`);
      await writeFile(path, attachment.content);
      paths.push(path);
    }
    console.log('Local payment email captured.', {to: message.to.address, files: paths});
    return {accepted: [message.to.address], capturePaths: paths};
  }};
}

export function configurePaymentEmailSender(environment, store) {
  const fromAddress = emailAddress(environment.AOC_G2_EMAIL_FROM);
  const testClientAddress = emailAddress(environment.AOC_G2_EMAIL_TEST_CLIENT_TO);
  if (!fromAddress || (environment.AOC_G2_EMAIL_TEST_CLIENT_TO && !testClientAddress)) {
    throw new Error('payment_email_config_incomplete');
  }
  const provider = environment.AOC_G2_EMAIL_PROVIDER || (environment.VERCEL ? 'microsoft365' : 'smtp');
  let transport;
  if (provider === 'microsoft365') {
    transport = createMicrosoftMailTransport({tenantId: environment.AOC_G2_MS_TENANT_ID,
      clientId: environment.AOC_G2_MS_CLIENT_ID, clientSecret: environment.AOC_G2_MS_CLIENT_SECRET,
      mailboxId: environment.AOC_G2_MS_MAILBOX_ID});
  } else if (provider === 'smtp') {
    transport = smtpTransport(environment);
  } else if (provider === 'capture' && !environment.VERCEL) {
    transport = createLocalCaptureTransport();
  } else {
    throw new Error('payment_email_provider_invalid');
  }
  return createPaymentEmailSender({store, transport, fromAddress, testClientAddress});
}
