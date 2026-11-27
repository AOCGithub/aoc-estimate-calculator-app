import { readFile } from 'node:fs/promises';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';

const pageFiles = [1, 3, 4, 5, 6].map(page => new URL(`./template-v6/page-${page}.png`, import.meta.url));
const pageSize = [612, 792];
const colors = {
  ink: rgb(0.07, 0.17, 0.23),
  blue: rgb(0.04, 0.19, 0.70),
  body: rgb(0.33, 0.42, 0.54),
  green: rgb(0.07, 0.51, 0.24),
  muted: rgb(0.35, 0.42, 0.52),
  white: rgb(1, 1, 1),
  rule: rgb(0.78, 0.81, 0.85),
};
let pageImagesPromise;

const value = (input, fallback = 'Not provided in the accepted order') => {
  if (Array.isArray(input)) return input.length ? input.map(item => String(item)).join(', ') : fallback;
  return input == null || String(input).trim() === '' ? fallback : String(input);
};

function formatDate(input) {
  if (!input || !Number.isFinite(Date.parse(input))) return 'Not recorded';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(new Date(input)) + ' UTC';
}

function formatMoney(amount, currency) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid accepted C10 price.');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || '').toUpperCase(),
    currencyDisplay: 'code',
  }).format(amount / 100);
}

function wrapText(text, font, fontSize, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split(/\r\n|\n|\r/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      let segment = '';
      for (const character of word) {
        const next = segment + character;
        if (segment && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
          lines.push(segment);
          segment = character;
        } else {
          segment = next;
        }
      }
      line = segment;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function summarizeSingleLine(text, font, fontSize, maxWidth) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (font.widthOfTextAtSize(normalized, fontSize) <= maxWidth) return normalized;
  let summary = '';
  for (const word of normalized.split(' ')) {
    const candidate = summary ? `${summary} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth) break;
    summary = candidate;
  }
  while (summary && font.widthOfTextAtSize(`${summary}…`, fontSize) > maxWidth) {
    summary = summary.slice(0, -1).trimEnd();
  }
  return `${summary}…`;
}

function fitText(text, font, {
  width, height, fontSize, minFontSize = 7, maxLines = Infinity, lineHeightFactor = 1.22, field,
}) {
  for (let size = fontSize; size >= minFontSize; size = Math.round((size - 0.25) * 100) / 100) {
    const lines = wrapText(text, font, size, width);
    const lineHeight = size * lineHeightFactor;
    if (lines.length <= maxLines && lines.length * lineHeight <= height) {
      return {lines, fontSize: size, lineHeight};
    }
  }
  throw new Error(`Accepted C10 text does not fit the ${field} field.`);
}

function drawTextBox(page, text, font, options) {
  const {x, y, color = colors.body} = options;
  const layout = fitText(text, font, options);
  layout.lines.forEach((line, index) => {
    page.drawText(line, {x, y: y - index * layout.lineHeight, size: layout.fontSize, font, color});
  });
  return layout;
}

function drawInline(page, text, font, {x, y, size, color = colors.body}) {
  page.drawText(String(text), {x, y, size, font, color});
}

async function getPageImages() {
  pageImagesPromise ||= Promise.all(pageFiles.map(file => readFile(file)))
    .catch(error => { pageImagesPromise = null; throw error; });
  return pageImagesPromise;
}

function addTemplatePage(document, image) {
  const page = document.addPage(pageSize);
  page.drawImage(image, {x: 0, y: 0, width: pageSize[0], height: pageSize[1]});
  return page;
}

function addProcessAppendix(document, image, text, regularFont, boldFont) {
  const lines = wrapText(text, regularFont, 9.8, 490);
  const linesPerPage = 42;
  for (let start = 0; start < lines.length; start += linesPerPage) {
    const page = addTemplatePage(document, image);
    page.drawRectangle({x: 58, y: 50, width: 500, height: 625, color: colors.white});
    page.drawLine({start: {x: 60, y: 58}, end: {x: 552, y: 58}, thickness: 0.5, color: colors.rule});
    drawInline(page, 'AGREED PROCESS DETAILS — CONTINUED', boldFont, {
      x: 60, y: 659, size: 10, color: colors.blue,
    });
    lines.slice(start, start + linesPerPage).forEach((line, index) => {
      page.drawText(line, {x: 60, y: 630 - index * 12.5, size: 9.8, font: regularFont, color: colors.body});
    });
  }
}

function drawFooter(document, regularFont) {
  const pages = document.getPages();
  for (let index = 1; index < pages.length; index += 1) {
    const label = `Page ${index + 1} of ${pages.length}`;
    const size = 9;
    const width = regularFont.widthOfTextAtSize(label, size);
    pages[index].drawText(label, {
      x: 552 - width, y: 27.3, size, font: regularFont, color: colors.muted,
    });
  }
}

export async function createC10OrderPdf(purchase, {regularFont, boldFont} = {}) {
  if (!regularFont || !boldFont) throw new Error('C10 PDF fonts are required.');
  const order = purchase?.acceptedOrder;
  if (!order?.acceptance?.acceptedAt) throw new Error('An accepted C10 order is required.');
  if (purchase.outcome !== 'paid' || !purchase.paidAt) {
    throw new Error('A confirmed payment is required to generate the accepted C10 PDF.');
  }
  if (!Number.isSafeInteger(order.price?.amount) || !Number.isSafeInteger(order.price?.total)) {
    throw new Error('The accepted C10 price is incomplete.');
  }

  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  document.setTitle(`${order.documentTitle || 'C10 accepted order'} ${value(order.reference)}`);
  document.setAuthor('Always Open Commerce');
  document.setSubject(`Accepted C10 order ${value(order.reference)}`);
  const [coverImage, scopeImage, purchaseImage, termsImage, acceptanceImage] = await Promise.all(
    (await getPageImages()).map(bytes => document.embedPng(bytes)),
  );
  const [cover, scope, purchasePage, terms, acceptance] = [
    coverImage, scopeImage, purchaseImage, termsImage, acceptanceImage,
  ].map(image => addTemplatePage(document, image));
  const regular = await document.embedFont(Buffer.from(regularFont, 'base64'));
  const bold = await document.embedFont(Buffer.from(boldFont, 'base64'));
  const client = order.client || {};
  const project = order.project || {};
  const service = order.service || {};
  const included = Array.isArray(service.included) ? service.included.map(item => value(item)) : [];
  if (included.length < 3) throw new Error('The accepted C10 is missing a required included-work item.');

  const business = value(client.company);
  const process = value(project.agreedProcess);
  const departments = value(project.departments);
  const systems = value(project.systems);
  const reference = value(order.reference);
  const version = value(order.version);
  const acceptedAt = formatDate(order.acceptance.acceptedAt);
  const issuedAt = formatDate(order.issuedAt);
  const paidAt = formatDate(purchase.paidAt);
  const currency = order.price.currency;
  const processContent = `${process}\nDepartments: ${departments}`;
  const processLines = wrapText(processContent, regular, 7.2, 300);
  const hasProcessAppendix = processLines.length > 2;
  const processAppendix = [
    `Agreed process: ${process}`,
    `Business area: ${value(project.businessArea)}`,
    `Departments: ${departments}`,
    `Systems: ${systems}`,
  ].join('\n\n');

  drawTextBox(cover, `Accepted order — ${purchase.testMode ? 'sandbox payment confirmed' : 'payment confirmed'}`,
    regular, {x: 47, y: 53.3, width: 340, height: 12, fontSize: 9.5, minFontSize: 8, maxLines: 1,
      color: colors.muted, field: 'cover status'});
  drawTextBox(cover, business, regular, {
    x: 146.8, y: 156.8, width: 205, height: 17, fontSize: 10.5, maxLines: 1,
    color: colors.ink, field: 'cover client',
  });
  drawTextBox(cover, `AI Commerce Solution Design — ${value(project.businessArea)}`, regular, {
    x: 146.8, y: 132.4, width: 235, height: 28, fontSize: 10, maxLines: 2,
    color: colors.ink, field: 'cover project',
  });
  drawTextBox(cover, version, bold, {
    x: 47, y: 17.9, width: 178, height: 13, fontSize: 10, maxLines: 1,
    color: colors.green, field: 'cover version',
  });
  drawTextBox(cover, issuedAt, bold, {
    x: 236.8, y: 17.9, width: 145, height: 13, fontSize: 9.5, maxLines: 1,
    color: colors.green, field: 'cover issue date',
  });

  drawInline(scope, 'ORDER REFERENCE', bold, {x: 60, y: 640.3, size: 8.2, color: colors.muted});
  drawTextBox(scope, `${reference.slice(0, 22)}…`, bold, {
    x: 150, y: 640.3, width: 136, height: 12, fontSize: 8.2, minFontSize: 7, maxLines: 1,
    color: colors.green, field: 'order reference',
  });
  drawInline(scope, 'CLIENT CONTACT', bold, {x: 294.6, y: 640.3, size: 8.2, color: colors.muted});
  drawTextBox(scope, `${value(client.name)}${client.role ? ` (${client.role})` : ''}`, bold, {
    x: 378, y: 640.3, width: 175, height: 12, fontSize: 7.8, minFontSize: 6.8, maxLines: 1,
    color: colors.green, field: 'client contact',
  });
  drawTextBox(scope, value(service.description, included.join(' ')), regular, {
    x: 60, y: 557.8, width: 493, height: 56, fontSize: 10.2, maxLines: 4,
    color: colors.body, field: 'service description',
  });
  drawTextBox(scope, business, bold, {
    x: 223.5, y: 442.3, width: 300, height: 18, fontSize: 9.5, maxLines: 1,
    color: colors.green, field: 'scope client',
  });
  drawTextBox(scope, value(project.businessGoal, 'Not separately stated in the accepted order'), bold, {
    x: 223.5, y: 419.5, width: 300, height: 18, fontSize: 9.2, maxLines: 1,
    color: colors.green, field: 'business goal',
  });
  drawTextBox(scope, hasProcessAppendix
    ? `Full agreed process details are in the appendix.\nDepartments: ${departments}`
    : processContent, regular, {
    x: 223.5, y: 400.5, width: 300, height: 17, fontSize: 7.2, minFontSize: 7.2, maxLines: 2,
    lineHeightFactor: 1.05,
    color: colors.green, field: 'agreed process',
  });
  drawTextBox(scope, systems, bold, {
    x: 223.5, y: 374, width: 300, height: 18, fontSize: 9.2, maxLines: 1,
    color: colors.green, field: 'systems',
  });
  drawTextBox(scope, summarizeSingleLine(value(service.excluded), bold, 8.8, 300), bold, {
    x: 223.5, y: 351.3, width: 300, height: 18, fontSize: 8.8, minFontSize: 8.8, maxLines: 1,
    color: colors.green, field: 'exclusions',
  });
  drawTextBox(scope, value(service.changeControl), regular, {
    x: 60, y: 325.3, width: 490, height: 23, fontSize: 9.1, maxLines: 2,
    color: colors.body, field: 'scope change control',
  });
  drawInline(scope, "What we'll need from you after purchase", bold, {
    x: 60, y: 299, size: 11, color: colors.blue,
  });
  drawTextBox(scope,
    "We'll email you secure instructions for showing us how you currently complete the workflow. Once we've reviewed the information, we'll contact you if we need additional details or clarification.",
    regular, {x: 60, y: 278.9, width: 493, height: 40, fontSize: 10, maxLines: 3, field: 'after-purchase instructions'});
  drawTextBox(scope,
    'Share only information relevant to this process. Do not send passwords or unnecessary sensitive details. If recording is not appropriate, contact us to agree on another way to share the information.',
    regular, {x: 60, y: 207.3, width: 493, height: 40, fontSize: 10, maxLines: 3, field: 'safe information sharing'});

  drawTextBox(purchasePage, 'Stripe receipt, accepted C10 and separate estimate PDF.', regular, {
    x: 381.8, y: 664.5, width: 164, height: 40, fontSize: 9.2, maxLines: 3,
    color: colors.body, field: 'confirmation documents',
  });
  drawTextBox(purchasePage, purchase.testMode ? 'PAYMENT Stripe sandbox confirmed' : 'PAYMENT Confirmed via Stripe', bold, {
    x: 60, y: 610.5, width: 152, height: 14, fontSize: 8.8, minFontSize: 7.6, maxLines: 1,
    color: colors.muted, field: 'payment status',
  });
  drawTextBox(purchasePage, `ORDER ${reference} / ${version}`, bold, {
    x: 220, y: 610.5, width: 330, height: 14, fontSize: 8.6, minFontSize: 7.6, maxLines: 1,
    color: colors.green, field: 'purchase order reference',
  });
  drawTextBox(purchasePage, `Included work: ${included.join(' ')}`, regular, {
    x: 60, y: 509.1, width: 493, height: 72, fontSize: 10, maxLines: 5,
    color: colors.body, field: 'included work summary',
  });
  const includedRows = [
    {text: included[0], x: 210.8, y: 388.5, height: 36, field: 'included work item 1'},
    {text: included[1], x: 210.8, y: 346.6, height: 36, field: 'included work item 2'},
    {text: included[2], x: 210.8, y: 304.7, height: 42, field: 'included work item 3'},
  ];
  for (const row of includedRows) {
    drawTextBox(purchasePage, row.text, regular, {
      x: row.x, y: row.y, width: 216, height: row.height, fontSize: 9.2, minFontSize: 8.2,
      maxLines: 3, color: colors.body, field: row.field,
    });
  }
  const feeSummary = [
    `DESIGN SERVICE FEE ${formatMoney(order.price.amount, currency)}`,
    `TAX ${value(order.price.tax)}`,
    `TOTAL DUE ${formatMoney(order.price.total, currency)}`,
    `PAYMENT ${purchase.testMode ? 'Stripe sandbox confirmed' : 'Confirmed via Stripe'}`,
  ].join('\n');
  drawTextBox(purchasePage, feeSummary, regular, {
    x: 210.8, y: 250.4, width: 216, height: 76, fontSize: 8.5, minFontSize: 7.4,
    maxLines: 8, color: colors.green, field: 'fee and tax details',
  });
  drawTextBox(purchasePage, 'Payment confirmed', regular, {
    x: 444, y: 250.4, width: 103, height: 18, fontSize: 8.8, minFontSize: 7.5, maxLines: 1,
    color: colors.body, field: 'payment responsible party',
  });
  drawTextBox(purchasePage, `Expected delivery: ${value(service.delivery)}`, regular, {
    x: 60, y: 122.4, width: 493, height: 48, fontSize: 9.8, maxLines: 4,
    color: colors.body, field: 'expected delivery',
  });

  drawTextBox(terms, value(service.excluded), regular, {
    x: 60, y: 728.2, width: 493, height: 44, fontSize: 9.8, maxLines: 3,
    color: colors.body, field: 'excluded work',
  });
  drawTextBox(terms, value(service.changeControl), regular, {
    x: 60, y: 679.5, width: 493, height: 36, fontSize: 9.8, maxLines: 2,
    color: colors.body, field: 'change control terms',
  });
  drawTextBox(terms, value(service.credit), regular, {
    x: 60, y: 644.7, width: 493, height: 54, fontSize: 9.5, maxLines: 4,
    color: colors.body, field: 'credit terms',
  });
  drawTextBox(terms, `Refund terms: ${value(service.refund)}`, regular, {
    x: 60, y: 582.2, width: 493, height: 23, fontSize: 9.2, maxLines: 2,
    color: colors.body, field: 'refund terms',
  });
  drawTextBox(terms, `Changes outside scope: ${value(service.changeControl)}`, regular, {
    x: 60, y: 561.3, width: 493, height: 25, fontSize: 8.8, minFontSize: 8, maxLines: 2,
    color: colors.body, field: 'scope changes',
  });
  drawInline(terms, 'How to purchase and what follows', bold, {
    x: 60, y: 534.9, size: 11, color: colors.blue,
  });
  drawTextBox(terms,
    '1. Before paying, review this exact accepted scope, deliverables, fee, tax, delivery timeframe and terms. The preliminary build estimate is not an implementation quote.',
    regular, {x: 96, y: 514.9, width: 455, height: 48, fontSize: 9.4, maxLines: 3, field: 'purchase step 1'});
  drawTextBox(terms,
    '2. Accept this exact client-specific order, including its version and price, before Stripe payment. Checkout records your acceptance reference and date/time.',
    regular, {x: 96, y: 459.3, width: 455, height: 35, fontSize: 9.4, maxLines: 2, field: 'purchase step 2'});
  drawTextBox(terms,
    '3. After verified payment, we email this accepted C10 and a separate estimate PDF. The Stripe receipt remains a separate record.',
    regular, {x: 96, y: 431.6, width: 455, height: 37, fontSize: 9.4, maxLines: 2, field: 'purchase step 3'});
  drawTextBox(terms,
    "4. We'll review the process information and contact you if clarification or additional detail is needed before completing the agreed work.",
    regular, {x: 96, y: 381.9, width: 455, height: 38, fontSize: 9.4, maxLines: 3, field: 'purchase step 4'});
  drawTextBox(terms,
    '5. You receive the written report and build plan stated in the accepted order. Any implementation is separately scoped and approved.',
    regular, {x: 96, y: 332.2, width: 455, height: 38, fontSize: 9.4, maxLines: 3, field: 'purchase step 5'});

  drawInline(acceptance, 'ORDER REFERENCE', bold, {x: 60, y: 592, size: 8.5, color: colors.muted});
  drawTextBox(acceptance, `${reference} / ${version} / ${issuedAt}`, bold, {
    x: 158, y: 592, width: 390, height: 14, fontSize: 8.2, minFontSize: 7.2, maxLines: 1,
    color: colors.green, field: 'acceptance order reference',
  });
  drawTextBox(acceptance, value(client.name), bold, {
    x: 70, y: 525.5, width: 225, height: 20, fontSize: 9.5, maxLines: 1,
    color: colors.green, field: 'accepting representative',
  });
  drawTextBox(acceptance, `Acceptance reference: ${reference.slice(0, 22)}…`, regular, {
    x: 70, y: 492.9, width: 225, height: 17, fontSize: 8.2, minFontSize: 7, maxLines: 1,
    color: colors.body, field: 'acceptance reference',
  });
  drawTextBox(acceptance, `Accepted: ${acceptedAt}`, regular, {
    x: 70, y: 477.6, width: 225, height: 17, fontSize: 8.2, minFontSize: 7, maxLines: 1,
    color: colors.body, field: 'acceptance date',
  });
  drawTextBox(acceptance, `Stripe payment: ${value(purchase.stripePaymentReference)}`, bold, {
    x: 315.8, y: 525.5, width: 230, height: 20, fontSize: 8.2, minFontSize: 7, maxLines: 1,
    color: colors.green, field: 'stripe payment reference',
  });
  drawTextBox(acceptance, `Purchase: ${value(purchase.purchaseReference)}`, regular, {
    x: 315.8, y: 492.9, width: 230, height: 17, fontSize: 8.2, minFontSize: 7, maxLines: 1,
    color: colors.body, field: 'purchase confirmation reference',
  });
  drawTextBox(acceptance, `Paid: ${paidAt}`, regular, {
    x: 315.8, y: 477.6, width: 230, height: 17, fontSize: 8.2, minFontSize: 7, maxLines: 1,
    color: colors.body, field: 'payment confirmation date',
  });
  drawInline(acceptance, 'AGREEMENT STATUS', bold, {x: 60, y: 448.2, size: 8.5, color: colors.muted});
  drawInline(acceptance, 'ACCEPTED AT CHECKOUT', bold, {x: 157, y: 448.2, size: 8.5, color: colors.green});
  drawTextBox(acceptance, `ACCEPTANCE REFERENCE ${reference} / ${version}`, bold, {
    x: 60, y: 436.3, width: 490, height: 12, fontSize: 8.2, minFontSize: 7.2, maxLines: 1,
    color: colors.green, field: 'recorded acceptance reference',
  });
  drawTextBox(acceptance, `ACCEPTED AT ${acceptedAt}`, bold, {
    x: 60, y: 424.5, width: 490, height: 12, fontSize: 8.2, minFontSize: 7.2, maxLines: 1,
    color: colors.green, field: 'recorded acceptance time',
  });
  drawInline(acceptance, 'ACCEPTED WORDING', bold, {x: 60, y: 394, size: 9, color: colors.blue});
  drawTextBox(acceptance, value(order.acceptance.wording), regular, {
    x: 60, y: 378, width: 490, height: 48, fontSize: 9.2, maxLines: 4,
    color: colors.body, field: 'accepted wording',
  });

  if (hasProcessAppendix) {
    addProcessAppendix(document, scopeImage, processAppendix, regular, bold);
  }
  drawFooter(document, regular);
  return document.save();
}
