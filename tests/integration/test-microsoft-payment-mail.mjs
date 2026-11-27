import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMicrosoftMailTransport } from '../../server/payments/microsoft-mail.mjs';
import { configurePaymentEmailSender, createLocalCaptureTransport } from '../../server/payments/payment-email.mjs';

const settings = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  clientId: '22222222-2222-4222-8222-222222222222',
  mailboxId: '33333333-3333-4333-8333-333333333333',
  clientSecret: 'synthetic-app-secret',
};
const tokenUrl = `https://login.microsoftonline.com/${settings.tenantId}/oauth2/v2.0/token`;
const sendUrl = `https://graph.microsoft.com/v1.0/users/${settings.mailboxId}/sendMail`;
const user = {address: 'client@example.com', name: 'Sample Client'};
const message = {
  from: {address: 'audit@example.com', name: 'Always Open Commerce'}, to: user,
  subject: 'Audit payment', text: 'Your audit payment has been confirmed.',
  html: '<p>Your audit payment has been confirmed.</p>', replyTo: 'support@example.com',
  messageId: '<local-fixture@example.com>',
  attachments: [{filename: 'estimate.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-fixture'),
    cid: 'estimate-fixture@alwaysopencommerce.com', contentDisposition: 'attachment'}],
};
const fakeToken = () => Response.json({access_token: 'synthetic-access-token', expires_in: 3600});
const accepted = () => new Response(null, {status: 202});

{
  const directory = await mkdtemp(join(tmpdir(), 'aoc-g3-mail-capture-'));
  try {
    const result = await createLocalCaptureTransport(directory).sendMail(message);
    assert.deepEqual(result.accepted, [user.address]);
    const files = await readdir(directory);
    assert.equal(files.filter(file => file.endsWith('.eml')).length, 1);
    assert.equal(files.filter(file => file.endsWith('--estimate.pdf')).length, 1);
    const eml = await readFile(join(directory, files.find(file => file.endsWith('.eml'))), 'utf8');
    assert.match(eml, /Subject: Audit payment/);
    assert.match(eml, /Content-Type: application\/pdf/);
  } finally {
    await rm(directory, {recursive: true});
  }
}

{
  let tokenRequests = 0;
  const messages = [];
  const transport = createMicrosoftMailTransport(settings, async (url, request) => {
    assert.equal(request.redirect, 'error');
    assert.equal(request.method, 'POST');
    if (url === tokenUrl) {
      tokenRequests++;
      assert.equal(request.body.get('client_id'), settings.clientId);
      assert.equal(request.body.get('client_secret'), settings.clientSecret);
      assert.equal(request.body.get('scope'), 'https://graph.microsoft.com/.default');
      assert.equal(request.body.get('grant_type'), 'client_credentials');
      return fakeToken();
    }
    assert.equal(url, sendUrl);
    assert.equal(request.headers.Authorization, 'Bearer synthetic-access-token');
    assert.equal(request.headers['Content-Type'], 'text/plain');
    assert.ok(!request.body.includes(settings.clientSecret));
    messages.push(Buffer.from(request.body, 'base64').toString('utf8'));
    return accepted();
  });
  const sends = await Promise.all([transport.sendMail(message),
    transport.sendMail({...message, to: 'support@example.com', attachments: []})]);
  assert.deepEqual(sends, [{accepted: [user.address]}, {accepted: ['support@example.com']}]);
  assert.equal(tokenRequests, 1);
  const client = messages.find(raw => raw.includes(user.address));
  for (const value of ['Subject: Audit payment', 'Reply-To: support@example.com', 'Message-ID: <local-fixture@example.com>',
    'Content-Type: text/plain', 'Content-Type: text/html', 'Content-Type: application/pdf',
    'Content-ID: <estimate-fixture@alwaysopencommerce.com>', 'estimate.pdf']) {
    assert.ok(client.includes(value), `MIME email contains ${value}`);
  }
}

{
  const otpFailure = createMicrosoftMailTransport(settings, async url => {
    assert.equal(url, tokenUrl);
    return new Response(null, {status: 401});
  });
  await assert.rejects(otpFailure.sendMail(message), {deliveryState: 'retry'});

  for (const [status, state] of [[400, 'failed'], [403, 'retry'], [429, 'retry'], [503, 'uncertain']]) {
    const transport = createMicrosoftMailTransport(settings, async url =>
      url === tokenUrl ? fakeToken() : new Response(null, {status}));
    await assert.rejects(transport.sendMail(message), {deliveryState: state});
  }

  const disconnected = createMicrosoftMailTransport(settings, async url => {
    if (url === tokenUrl) return fakeToken();
    throw new Error('Connection closed');
  });
  await assert.rejects(disconnected.sendMail(message), {deliveryState: 'uncertain'});
}

{
  let tokenRequests = 0;
  let sendRequests = 0;
  const transport = createMicrosoftMailTransport(settings, async url => {
    if (url === tokenUrl) { tokenRequests++; return fakeToken(); }
    return ++sendRequests === 1 ? new Response(null, {status: 401}) : accepted();
  });
  await assert.rejects(transport.sendMail(message), {deliveryState: 'retry'});
  assert.deepEqual(await transport.sendMail(message), {accepted: [user.address]});
  assert.equal(tokenRequests, 2);
}

assert.throws(() => createMicrosoftMailTransport({...settings, mailboxId: 'audit@example.com'}), /config_incomplete/);
assert.throws(() => configurePaymentEmailSender({VERCEL: '1', AOC_G2_EMAIL_FROM: 'audit@example.com'}, {}), /microsoft_mail_config_incomplete/);
assert.equal(typeof configurePaymentEmailSender({AOC_G2_EMAIL_FROM: 'audit@example.com',
  AOC_G2_SMTP_HOST: '127.0.0.1', AOC_G2_SMTP_USER: 'local-fixture', AOC_G2_SMTP_PASSWORD: 'fixture'}, {}), 'function');
assert.equal(typeof configurePaymentEmailSender({AOC_G2_EMAIL_FROM: 'sandbox@localhost.test',
  AOC_G2_EMAIL_PROVIDER: 'capture'}, {}), 'function');
assert.throws(() => configurePaymentEmailSender({VERCEL: '1', AOC_G2_EMAIL_FROM: 'sandbox@localhost.test',
  AOC_G2_EMAIL_PROVIDER: 'capture'}, {}), /provider_invalid/);
console.log('PASS: Microsoft OAuth, shared token, one sender mailbox, MIME attachment, recipient routing, retry states and local SMTP preview. No Microsoft requests or emails.');
