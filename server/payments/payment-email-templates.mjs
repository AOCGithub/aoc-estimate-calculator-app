import { createElement as h } from 'react';
import { render, toPlainText } from '@react-email/render';

export const supportEmail = 'support@alwaysopencommerce.com';

const paragraph = (...children) => h('p', null, ...children);
const heading = text => h('h2', {style: {fontSize: '17px'}}, text);
const row = (label, value) => paragraph(h('strong', null, label + ': '), value);
const link = (label, href) => h('a', {href}, label);

function summary(purchase) {
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: purchase.currency.toUpperCase(), currencyDisplay: 'code',
  }).format(purchase.amount / 100);
  const paidAt = new Intl.DateTimeFormat('en-US', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'})
    .format(new Date(purchase.paidAt)) + ' UTC';
  return [
    heading('Payment Summary'),
    row('Estimate Reference ID', purchase.submissionReference),
    h('p', {style: {whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}},
      h('strong', null, 'Work Description: '), purchase.snapshot.description),
    row('Audit Fee Paid', amount),
    row('Payment Date', paidAt),
    row('Payment Status', 'Paid'),
  ];
}

function clientCopy(purchase, clientName) {
  const firstName = clientName.trim().split(/\s+/)[0];
  return [
    paragraph(firstName ? `Hi ${firstName},` : 'Hi,'),
    paragraph('Thank you for your payment! Your AI Commerce Audit purchase has been confirmed.'),
    ...summary(purchase),
    heading('Your Documents'),
    row('Estimate PDF', 'Attached to this email'),
    row('Payment Receipt', link('View your Stripe receipt', purchase.receiptUrl)),
    heading('What Happens Next?'),
    paragraph("We'll email you secure instructions for showing us how you currently complete your workflow."),
    paragraph("Once we've reviewed the information, we'll contact you if we need any additional details or clarification."),
    paragraph('Your purchase covers the AI Commerce Audit only. Any automation implementation would be quoted and approved separately.'),
    heading('Questions or Changes to Your Purchase?'),
    paragraph('If you have questions, notice an error, or would like to request a change to your purchase, please contact ',
      link(supportEmail, 'mailto:' + supportEmail), ' and include your Estimate Reference ID.'),
    paragraph("We'll review your request under the applicable order terms and confirm the next steps. Please don't email payment-card details."),
    paragraph('Thank you!'),
    paragraph('Always Open Commerce Team'),
  ];
}

function supportCopy(purchase, clientName, checkoutEmail) {
  return [
    paragraph('An AI Commerce Audit payment has been confirmed.'),
    ...summary(purchase),
    heading('Client Details'),
    row('Client', clientName || 'Not provided'),
    row('Company', purchase.snapshot.profile?.company || 'Not provided'),
    row('Checkout Email', checkoutEmail || 'Unavailable in Stripe Checkout'),
    heading('Order References'),
    row('Purchase', purchase.purchaseReference),
    row('Work-description record', purchase.recordingReference),
    row('Audit intake', purchase.auditIntakeReference || 'Pending'),
    ...(purchase.receiptUrl ? [row('Receipt', link('View the Stripe receipt', purchase.receiptUrl))] : []),
  ];
}

export async function renderPaymentEmail({purchase, audience, clientName, checkoutEmail}) {
  const content = audience === 'client' ? clientCopy(purchase, clientName) : supportCopy(purchase, clientName, checkoutEmail);
  const html = await render(h('html', {lang: 'en'}, h('body', {
    style: {margin: '24px', fontFamily: 'Arial, sans-serif', fontSize: '15px', lineHeight: '1.5', color: '#202c2a'},
  }, ...(purchase.testMode ? [paragraph(h('strong', null, 'Stripe sandbox test. No real charge or audit booking.'))] : []), ...content)));
  const prefix = purchase.testMode ? '[Stripe test] ' : '';
  const subject = audience === 'client' ? 'Your AI Commerce Audit payment is confirmed'
    : 'AI Commerce Audit paid · ' + purchase.submissionReference;
  return {subject: prefix + subject, html, text: toPlainText(html)};
}
