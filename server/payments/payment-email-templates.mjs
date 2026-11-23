import { createElement as h } from 'react';
import { render, toPlainText } from '@react-email/render';

export const supportEmail = 'support@alwaysopencommerce.com';

const website = 'https://alwaysopencommerce.com';
const assetBase = 'https://estimate.alwaysopencommerce.com/email-assets/';
const font = 'Montserrat, Arial, sans-serif';
const colors = {
  ink: '#18191b', copy: '#343d50', muted: '#505d74', link: '#406bff',
  border: '#dce4f1', panel: '#f3f6fc', callout: '#e3e9ff', white: '#ffffff', black: '#000000',
};
const fontImport = '@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400..700&display=swap");';
const mobileStyles = [
  '@media screen and (max-width: 520px) {',
  '  .email-nav-gap { padding-left: 14px !important; padding-right: 14px !important; }',
  '  .email-nav-link { font-size: 13px !important; }',
  '  .email-hero, .email-content { padding-left: 22px !important; padding-right: 22px !important; }',
  '  .email-label { width: 37% !important; }',
  '  .email-footer-gap { width: 10px !important; }',
  '  .email-copyright { font-size: 13px !important; }',
  '}',
  '@media screen and (max-width: 400px) {',
  '  .email-nav-gap { padding-left: 9px !important; padding-right: 9px !important; }',
  '  .email-doc { display: block !important; width: 100% !important; }',
  '  .email-doc-gap { display: block !important; height: 12px !important; }',
  '  .email-docs { table-layout: fixed !important; }',
  '  .email-summary { padding: 16px !important; }',
  '}',
].join('\n');

const table = (props, ...rows) => h('table', {
  role: 'presentation', border: 0, cellPadding: 0, cellSpacing: 0,
  ...props, style: {borderCollapse: 'collapse', ...props.style},
}, h('tbody', null, ...rows));
const tr = (...children) => h('tr', null, ...children);
const td = (props, ...children) => h('td', props, ...children);
const paragraph = (style, ...children) => h('p', {style: {margin: 0, ...style}}, ...children);
const heading = (text, size = 20) => h('h2', {style: {
  margin: 0, color: colors.ink, fontSize: size, fontWeight: 700, lineHeight: size === 20 ? '24px' : '1.5',
}}, text);
const gap = size => h('div', {'aria-hidden': true, style: {height: size, lineHeight: size + 'px', fontSize: 0}});
const divider = size => h('div', {'aria-hidden': true, style: {
  margin: size + 'px 0', borderTop: '1px solid ' + colors.border, fontSize: 0, lineHeight: 0,
}});
const link = (label, href, style) => h('a', {href, style: {
  color: colors.link, textDecoration: 'underline', ...style,
}}, label);

function picture(file, alt, width, height, style) {
  return h('img', {src: assetBase + file + '.png', alt, width, height, fetchPriority: 'low', style: {
    display: 'block', border: 0, maxWidth: '100%', height: 'auto', ...style,
  }});
}

function emailHeader() {
  const menu = [
    ['Growth Services', '/growth-services/'], ['About Us', '/about-us/'], ['Contact Us', '/contact-us/'],
  ];
  return h('div', {className: 'email-branding'}, table({width: '100%'},
    tr(td({align: 'center', bgcolor: colors.ink, height: 48, style: {backgroundColor: colors.ink}},
      table({align: 'center'}, tr(...menu.map(([label, path], index) => td({key: path, valign: 'middle'},
        table({}, tr(
          index ? td({className: 'email-nav-gap', style: {padding: '0 32px'}},
            picture('nav-divider', '', 1, 25, {maxWidth: 'none'})) : null,
          td({style: {whiteSpace: 'nowrap'}}, h('a', {className: 'email-nav-link',
            href: website + path, style: {color: colors.white, textDecoration: 'none', fontWeight: 700, fontSize: 16},
          }, label)),
        )),
      )))),
    )),
    tr(td({align: 'center', valign: 'middle', height: 82, bgcolor: colors.black},
      h('a', {href: website, style: {display: 'block', maxWidth: 300, margin: '0 16px'}},
        picture('aoc-masthead', 'Always Open Commerce', 300, 47)),
    )),
  ));
}

function emailFooter() {
  const badges = [
    ['bigcommerce', 'BigCommerce Certified Partner', 102, 32],
    ['shopify', 'Shopify Partner', 117, 20],
    ['make-partners', 'Make Partners', 144, 18],
    ['review-badge', 'Reviewed by Clutch, 5.0 rating', 117, 23],
  ];
  return table({width: '100%', className: 'email-branding', bgcolor: colors.black, style: {backgroundColor: colors.black}},
    tr(td({align: 'center', style: {padding: '24px 16px', color: colors.white}},
      table({align: 'center', width: '100%'},
        tr(td({align: 'center', height: 50}, picture('aoc-footer', 'Always Open Commerce', 300, 47))),
        tr(td({height: 24, style: {lineHeight: 0, fontSize: 0}})),
        tr(td({align: 'center', height: 63},
          table({align: 'center', width: '100%', style: {maxWidth: 552, tableLayout: 'fixed'}},
            tr(...badges.flatMap(([file, alt, width, height], index) => [
              index ? td({key: file + '-gap', className: 'email-footer-gap', width: 24}) : null,
              td({key: file, align: 'center', valign: 'middle', style: {width: (width / 552 * 100) + '%'}},
                picture(file, alt, width, height)),
            ])),
          ),
        )),
        tr(td({height: 24, style: {lineHeight: 0, fontSize: 0}})),
        tr(td({align: 'center', className: 'email-copyright', style: {color: colors.white}},
          'Always Open Commerce © ' + new Date().getUTCFullYear() + '. All Rights Reserved')),
      ),
    )),
  );
}

function paymentHero(isClient, clientName) {
  const firstName = clientName.trim().split(/\s+/)[0];
  const background = isClient ? '#00523d' : '#1d44ab';
  const gradient = isClient ? 'linear-gradient(180deg,#001913 0%,#00523d 100%)'
    : 'linear-gradient(180deg,#122b6b 0%,#1d44ab 100%)';
  const content = isClient ? [
    picture('paid-seal', '', 52, 52, {margin: '0 auto'}),
    gap(8),
    paragraph({fontWeight: 400}, firstName ? 'Hi ' + firstName + ',' : 'Hi,'),
    gap(8),
    h('h1', {style: {margin: 0, color: colors.white, fontSize: 24, fontWeight: 700, lineHeight: '1.2'}},
      'Thank you for your payment!'),
    gap(8),
    paragraph({}, 'Your AI Commerce Audit purchase has been confirmed.'),
  ] : [
    paragraph({fontWeight: 700}, 'Hi Team,'),
    gap(8),
    paragraph({}, 'A new AI Commerce Audit payment has been successfully processed through the AOC Estimate Calculator.'),
  ];
  return tr(td({align: isClient ? 'center' : 'left', bgcolor: background,
    className: 'email-hero', style: {
      padding: '30px 40px', color: colors.white, backgroundColor: background, backgroundImage: gradient,
      overflowWrap: 'anywhere',
    },
  }, ...content));
}

function detailRows(fields, spacing) {
  return table({width: '100%', style: {tableLayout: 'fixed'}}, ...fields.map(([label, value, compact], index) => {
    const rowStyle = {paddingTop: index ? spacing : 0, fontSize: compact ? 13 : 15,
      lineHeight: compact ? '20px' : '23px', fontWeight: compact ? 600 : 500};
    return h('tr', {key: index},
      td({width: 166, className: 'email-label', valign: 'top', style: {
        ...rowStyle, width: 166, color: colors.ink,
      }}, label),
      td({valign: 'top', style: {
        ...rowStyle, color: colors.muted, paddingLeft: 14, overflowWrap: 'anywhere', wordBreak: 'break-word',
      }}, value),
    );
  }));
}

function paymentDetails(purchase) {
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: purchase.currency.toUpperCase(), currencyDisplay: 'code',
  }).format(purchase.amount / 100);
  const paidAt = new Intl.DateTimeFormat('en-US', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'})
    .format(new Date(purchase.paidAt)) + ' UTC';
  return {amount, paidAt, description: h('span', {style: {whiteSpace: 'pre-wrap'}}, purchase.snapshot.description)};
}

function paidStatus() {
  return h('span', {style: {display: 'inline-block', padding: '3px 8px', borderRadius: 14,
    backgroundColor: '#e1e8fc', color: colors.link, fontSize: 15, fontWeight: 500, lineHeight: '16px',
  }}, picture('paid-check', '', 12, 12, {display: 'inline-block', verticalAlign: '-1px', marginRight: 5}), 'Paid');
}

function documentCard(icon, title, detail, href) {
  return td({className: 'email-doc', valign: 'top'}, table({width: '100%',
    style: {borderCollapse: 'separate', border: '1px solid ' + colors.border, borderRadius: 8}},
    tr(td({style: {padding: '13px 15px'}},
      table({width: '100%'}, tr(
        td({width: 24, valign: 'middle'}, picture(icon, '', 16, 16)),
        td({style: {fontSize: 13, lineHeight: '20px', fontWeight: 600, color: colors.ink}}, title),
        href ? td({width: 17, align: 'right'},
          h('a', {href, 'aria-label': 'View Stripe receipt', tabIndex: -1}, picture('arrow', '', 17, 17))) : null,
      )),
      gap(7),
      paragraph({fontSize: 12, lineHeight: '18px', fontWeight: 600, color: colors.link},
        href ? link(detail, href) : detail),
    )),
  ));
}

function clientCopy(purchase, {amount, paidAt, description}) {
  return [
    table({width: '100%', style: {borderCollapse: 'separate', border: '1px solid ' + colors.border,
      borderRadius: 10, backgroundColor: colors.panel}},
    tr(td({className: 'email-summary', style: {padding: '19px 20px'}},
      heading('Payment Summary'), divider(12),
      detailRows([
        [h('span', null, 'Estimate', h('br'), 'Reference ID:'), purchase.submissionReference],
        ['Work Description:', description],
        ['Audit Fee Paid:', amount],
        ['Payment Date:', paidAt],
        ['Payment Status:', paidStatus(), true],
      ], 12),
    ))),
    gap(24),
    heading('Your Documents'),
    gap(12),
    table({width: '100%', className: 'email-docs', style: {tableLayout: 'fixed'}}, tr(
      documentCard('pdf', 'Estimate PDF:', 'Attached to this email'),
      td({className: 'email-doc-gap', width: 12, style: {fontSize: 0, lineHeight: 0}}),
      documentCard('receipt', 'Payment Receipt:', 'View your Stripe receipt', purchase.receiptUrl),
    )),
    divider(24),
    heading('What Happens Next?'),
    gap(10),
    paragraph({}, "We'll email you secure instructions for showing us how you currently complete your workflow."),
    gap(10),
    paragraph({}, "Once we've reviewed the information, we'll contact you if we need any additional details or clarification."),
    gap(10),
    table({width: '100%', style: {borderCollapse: 'separate', borderRadius: 6, backgroundColor: colors.callout}},
      tr(td({style: {padding: '11px 14px', color: colors.muted, fontSize: 13, lineHeight: '20px'}},
        'Your purchase covers the AI Commerce Audit only. Any automation implementation would be quoted and approved separately.'))),
    divider(24),
    heading('Questions or Changes to Your Purchase?'),
    gap(10),
    paragraph({}, 'If you have questions, notice an error, or would like to request a change to your purchase, please contact ',
      link(supportEmail, 'mailto:' + supportEmail, {textDecoration: 'none', overflowWrap: 'anywhere'}),
      ' and include your Estimate Reference ID.'),
    gap(10),
    paragraph({}, "We'll review your request under the applicable order terms and confirm the next steps. Please don't email payment-card details."),
    gap(24),
    paragraph({}, 'Thank you!'),
    gap(2),
    paragraph({fontWeight: 700, color: colors.ink}, 'Always Open Commerce Team'),
  ];
}

function supportCopy(purchase, clientName, checkoutEmail, {amount, paidAt, description}) {
  return [
    heading('Client Information', 16),
    gap(8),
    detailRows([
      ['Client Name:', clientName || 'Not provided'],
      ['Email:', checkoutEmail || 'Unavailable in Stripe Checkout'],
      ['Company:', purchase.snapshot.profile?.company || 'Not provided'],
    ], 8),
    divider(20),
    heading('Estimate Details', 16),
    gap(8),
    detailRows([
      ['Estimate ID:', purchase.submissionReference],
      ['Work Description:', description],
      ['Audit Fee Paid:', amount],
      ['Estimate PDF:', 'Included with the client confirmation', true],
    ], 8),
    divider(20),
    heading('Payment Information', 16),
    gap(8),
    detailRows([
      ['Payment Date:', paidAt],
      ['Payment Status:', 'Paid'],
      ['Payment Receipt:', purchase.receiptUrl ? link('View the Stripe receipt', purchase.receiptUrl) : 'Pending', true],
    ], 8),
    divider(20),
    heading('Next Step', 16),
    gap(8),
    paragraph({}, "Please review the corresponding audit intake record and coordinate the next steps for the client's audit."),
    gap(12),
    detailRows([
      ['Purchase:', purchase.purchaseReference],
      ['Work-description record:', purchase.recordingReference],
      ['Audit intake:', purchase.auditIntakeReference || 'Pending'],
    ], 8),
    gap(20),
    paragraph({fontSize: 15, fontWeight: 400}, 'Thank you!'),
  ];
}

export async function renderPaymentEmail({purchase, audience, clientName = '', checkoutEmail}) {
  const isClient = audience === 'client';
  const fields = paymentDetails(purchase);
  const content = isClient ? clientCopy(purchase, fields) : supportCopy(purchase, clientName, checkoutEmail, fields);
  const html = await render(h('html', {lang: 'en'},
    h('head', null, h('meta', {name: 'viewport', content: 'width=device-width, initial-scale=1'}),
      h('style', null, fontImport), h('style', null, mobileStyles)),
    h('body', {style: {margin: 0, padding: 0, fontFamily: font, color: colors.copy,
      fontSize: 16, fontWeight: 500, lineHeight: '24px'}},
    table({width: '100%', style: {backgroundColor: colors.white}}, tr(td({align: 'center'},
      table({className: 'payment-email', width: 600, align: 'center', bgcolor: colors.white, style: {
        maxWidth: 600, width: '100%', textAlign: 'left', fontFamily: font,
      }},
      tr(td({}, emailHeader())),
      paymentHero(isClient, clientName),
      purchase.testMode ? tr(td({align: 'center', bgcolor: colors.panel, className: 'email-content',
        style: {padding: '10px 36px', fontSize: 13, fontWeight: 700, color: colors.ink}},
      'Stripe sandbox test. No real charge or audit booking.')) : null,
      tr(td({className: 'email-content', style: {padding: (isClient ? 30 : 29) + 'px 36px'}}, ...content)),
      tr(td({}, emailFooter())),
      ),
    )))
    ),
  ));
  const prefix = purchase.testMode ? '[Stripe test] ' : '';
  const subject = isClient ? 'Your AI Commerce Audit payment is confirmed'
    : 'AI Commerce Audit paid · ' + purchase.submissionReference;
  return {subject: prefix + subject, html, text: toPlainText(html, {
    selectors: [{selector: '.email-branding', format: 'skip'}],
  })};
}
