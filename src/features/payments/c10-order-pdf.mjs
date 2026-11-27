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
};
const templateText = {
  serviceDescription: "This paid design service examines your current process, identifies efficiency and cost-saving opportunities, and proposes an optimized workflow and phased solution plan. You'll receive findings, recommendations, solution design and an implementation roadmap. This is design only: no build, configuration, testing or activation. Implementation is quoted and approved separately.",
  scopeBoundary: "Only these areas are included. We'll agree on scope and price before assessing anything else.",
  inputs: "We'll send a private Loom guide for one or more short recordings of your current process. We may also need sample files, answers to a few questions or limited system access. We'll explain what to share and how to do it safely. No presentation is needed.",
  safeSharing: "Use sample data and keep passwords and sensitive details out of recordings. We won't connect live systems just for checkout. If recording isn't safe, we'll agree on another way to share information. You'll review our process summary before we finalize scope.",
  confirmationDocuments: 'Stripe receipt, same accepted-order PDF and separate workflow guide',
  purchaseOverview: "You'll receive a project-scoping report with our findings and feasibility assessment, a proposed workflow diagram, a phased plan and key dependencies. We'll identify likely software needs where we can assess them. If the information is sufficient, we'll include a separate fixed-price implementation proposal; otherwise we'll explain what still needs investigation. Building, connecting or activating a workflow is not included.",
  deliverables: [
    'Current-process review, findings, feasibility, risks and practical recommendations.',
    'Proposed workflow diagram, phased project scope, dependencies and responsibilities.',
    'Likely software needs and estimated usage where supportable; a separate implementation scope and quotation if sufficiently defined.',
  ],
  implementationExclusion: 'Implementation, configuration, integrations, testing, deployment, ongoing support and third-party software costs are excluded from this design-only service unless expressly agreed in a separate implementation order.',
  additionalWork: "If you'd like additional work outside the agreed design scope, we'll explain its scope and price before you decide.",
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
  document.setTitle(`${order.documentTitle || 'Process Optimization & Solution Design Order'} ${value(order.reference)}`);
  document.setAuthor('Always Open Commerce');
  document.setSubject(`Process Optimization & Solution Design Order ${value(order.reference)}`);
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
  const delivery = value(service.delivery).replace(/[.\s]+$/, '');
  const processContent = `${summarizeSingleLine(process, regular, 7.2, 300)}\nDepartments: ${departments}`;

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
  drawTextBox(scope, `${reference} / ${version}`, bold, {
    x: 150, y: 640.3, width: 136, height: 18, fontSize: 7.5, minFontSize: 6, maxLines: 2,
    lineHeightFactor: 1.05,
    color: colors.green, field: 'order reference',
  });
  drawInline(scope, 'CLIENT CONTACT', bold, {x: 294.6, y: 640.3, size: 8.2, color: colors.muted});
  drawTextBox(scope, value(client.name), bold, {
    x: 378, y: 640.3, width: 175, height: 12, fontSize: 7.8, minFontSize: 6.8, maxLines: 1,
    color: colors.green, field: 'client contact',
  });
  drawTextBox(scope, templateText.serviceDescription, regular, {
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
  drawTextBox(scope, processContent, regular, {
    x: 223.5, y: 400.5, width: 300, height: 17, fontSize: 7.2, minFontSize: 7.2, maxLines: 2,
    lineHeightFactor: 1.05,
    color: colors.green, field: 'agreed process',
  });
  drawTextBox(scope, systems, bold, {
    x: 223.5, y: 374, width: 300, height: 18, fontSize: 9.2, maxLines: 1,
    color: colors.green, field: 'systems',
  });
  drawTextBox(scope, value(service.excluded), bold, {
    x: 223.5, y: 351.3, width: 300, height: 18, fontSize: 8.4, minFontSize: 5.8, maxLines: 1,
    color: colors.green, field: 'exclusions',
  });
  drawTextBox(scope, templateText.scopeBoundary, regular, {
    x: 60, y: 325.3, width: 490, height: 23, fontSize: 9.1, maxLines: 2,
    color: colors.body, field: 'scope boundary',
  });
  drawInline(scope, "What we'll need from you after purchase", bold, {
    x: 60, y: 299, size: 11, color: colors.blue,
  });
  drawTextBox(scope,
    templateText.inputs,
    regular, {x: 60, y: 278.9, width: 493, height: 48, fontSize: 9.6, minFontSize: 8.8, maxLines: 4, field: 'after-purchase instructions'});
  drawTextBox(scope,
    templateText.safeSharing,
    regular, {x: 60, y: 207.3, width: 493, height: 48, fontSize: 9.6, minFontSize: 8.8, maxLines: 4, field: 'safe information sharing'});

  drawTextBox(purchasePage, templateText.confirmationDocuments, regular, {
    x: 381.8, y: 664.5, width: 164, height: 40, fontSize: 9.2, maxLines: 3,
    color: colors.body, field: 'confirmation documents',
  });
  drawTextBox(purchasePage, 'PAYMENT Secure Stripe checkout', bold, {
    x: 60, y: 610.5, width: 152, height: 14, fontSize: 8.8, minFontSize: 7.6, maxLines: 1,
    color: colors.muted, field: 'payment status',
  });
  drawTextBox(purchasePage, `ORDER ${reference}`, bold, {
    x: 220, y: 610.5, width: 330, height: 14, fontSize: 8.6, minFontSize: 7.6, maxLines: 1,
    color: colors.green, field: 'purchase order reference',
  });
  drawTextBox(purchasePage, templateText.purchaseOverview, regular, {
    x: 60, y: 509.1, width: 493, height: 72, fontSize: 10, maxLines: 5,
    minFontSize: 8.8, color: colors.body, field: 'purchase overview',
  });
  const includedRows = [
    {text: templateText.deliverables[0], x: 210.8, y: 388.5, height: 36, field: 'included work item 1'},
    {text: templateText.deliverables[1], x: 210.8, y: 346.6, height: 36, field: 'included work item 2'},
    {text: templateText.deliverables[2], x: 210.8, y: 304.7, height: 42, field: 'included work item 3'},
  ];
  for (const row of includedRows) {
    drawTextBox(purchasePage, row.text, regular, {
      x: row.x, y: row.y, width: 216, height: row.height, fontSize: 9.2, minFontSize: 8.2,
      maxLines: 3, color: colors.body, field: row.field,
    });
  }
  const feeSummary = [
    `DESIGN SERVICE FEE 15% of the preliminary build estimate: ${formatMoney(order.price.amount, currency)}`,
    `TAX ${value(order.price.tax)}`,
    `TOTAL DUE ${formatMoney(order.price.total, currency)}`,
    'PAYMENT Secure Stripe checkout',
    ...(order.price.offerValidUntil ? [`OFFER VALID UNTIL ${value(order.price.offerValidUntil)}`] : []),
  ].join('\n');
  drawTextBox(purchasePage, feeSummary, regular, {
    x: 210.8, y: 250.4, width: 216, height: 76, fontSize: 8.5, minFontSize: 7.4,
    maxLines: 8, color: colors.green, field: 'fee and tax details',
  });
  drawTextBox(purchasePage, 'Client pays at checkout', regular, {
    x: 444, y: 250.4, width: 103, height: 18, fontSize: 8.8, minFontSize: 7.5, maxLines: 1,
    color: colors.body, field: 'payment responsible party',
  });
  drawTextBox(purchasePage, `We'll begin the agreed process optimization and solution design once your order and payment are confirmed. Expected delivery: ${delivery}. If anything essential is missing, we'll tell you what we need and whether it affects timing.`, regular, {
    x: 60, y: 122.4, width: 493, height: 48, fontSize: 9.4, minFontSize: 8.2, maxLines: 5,
    color: colors.body, field: 'expected delivery',
  });

  drawTextBox(terms, templateText.implementationExclusion, regular, {
    x: 60, y: 728.2, width: 493, height: 44, fontSize: 9.8, maxLines: 3,
    color: colors.body, field: 'excluded work',
  });
  drawTextBox(terms, templateText.additionalWork, regular, {
    x: 60, y: 679.5, width: 493, height: 36, fontSize: 9.8, maxLines: 2,
    color: colors.body, field: 'additional work terms',
  });
  drawTextBox(terms, value(service.credit), regular, {
    x: 60, y: 644.7, width: 493, height: 54, fontSize: 9.5, maxLines: 4,
    color: colors.body, field: 'credit terms',
  });
  drawTextBox(terms, `Refund terms: ${value(service.refund)}`, regular, {
    x: 60, y: 582.2, width: 493, height: 23, fontSize: 9.2, maxLines: 2,
    color: colors.body, field: 'refund terms',
  });
  drawTextBox(terms, `Changes or cancellation: ${value(service.changeControl)}`, regular, {
    x: 60, y: 561.3, width: 493, height: 25, fontSize: 8.8, minFontSize: 8, maxLines: 2,
    color: colors.body, field: 'cancellation and changes',
  });
  drawInline(terms, 'How to purchase and what follows', bold, {
    x: 60, y: 534.9, size: 11, color: colors.blue,
  });
  drawTextBox(terms,
    "1. Before paying, review the scope, what you'll need to share, what we'll deliver and the terms. The fee is currently 15% of the calculator's preliminary build estimate; the exact client-specific fee, tax and total appear in this order and at checkout. The build estimate is not a final implementation quote.",
    regular, {x: 96, y: 514.9, width: 455, height: 48, fontSize: 9.2, minFontSize: 8.2, maxLines: 4, field: 'purchase step 1'});
  drawTextBox(terms,
    '2. Accept this exact client-specific order, including its version and price, before Stripe payment. Checkout records your acceptance reference and date/time.',
    regular, {x: 96, y: 459.3, width: 455, height: 35, fontSize: 9.4, maxLines: 2, field: 'purchase step 2'});
  drawTextBox(terms,
    "3. Once payment is verified as successful, we'll email the same accepted-order PDF with your confirmation. The preliminary build estimate PDF and Stripe receipt are separate documents. We'll send the recording guide and private link when they're ready.",
    regular, {x: 96, y: 431.6, width: 455, height: 45, fontSize: 9.2, minFontSize: 8.2, maxLines: 4, field: 'purchase step 3'});
  drawTextBox(terms,
    "4. We'll review the recording and any agreed samples or access, clarify what is missing and ask you to confirm our process summary. Then we'll complete the agreed optimization and solution design work.",
    regular, {x: 96, y: 381.9, width: 455, height: 38, fontSize: 9.2, minFontSize: 8.2, maxLines: 3, field: 'purchase step 4'});
  drawTextBox(terms,
    "5. You'll receive findings, a proposed workflow and a practical scope and plan. Any implementation quotation is separate, and no build starts without a new approval.",
    regular, {x: 96, y: 332.2, width: 455, height: 38, fontSize: 9.2, minFontSize: 8.2, maxLines: 3, field: 'purchase step 5'});

  drawInline(acceptance, 'ORDER REFERENCE', bold, {x: 60, y: 592, size: 8.5, color: colors.muted});
  drawTextBox(acceptance, `${reference} / ${version} / ${issuedAt}`, bold, {
    x: 158, y: 592, width: 390, height: 14, fontSize: 8.2, minFontSize: 7.2, maxLines: 1,
    color: colors.green, field: 'acceptance order reference',
  });
  drawTextBox(acceptance, value(client.name), bold, {
    x: 70, y: 525.5, width: 225, height: 20, fontSize: 9.5, maxLines: 1,
    color: colors.green, field: 'accepting representative',
  });
  drawTextBox(acceptance, `Acceptance reference ${reference}`, regular, {
    x: 70, y: 492.9, width: 225, height: 17, fontSize: 8.2, minFontSize: 6, maxLines: 1,
    color: colors.body, field: 'acceptance reference',
  });
  drawTextBox(acceptance, `Date ${acceptedAt}`, regular, {
    x: 70, y: 477.6, width: 225, height: 17, fontSize: 8.2, minFontSize: 7, maxLines: 1,
    color: colors.body, field: 'acceptance date',
  });
  drawTextBox(acceptance, `Purchase ${value(purchase.purchaseReference)}`, bold, {
    x: 315.8, y: 525.5, width: 230, height: 20, fontSize: 8.2, minFontSize: 7, maxLines: 1,
    color: colors.green, field: 'purchase reference',
  });
  drawTextBox(acceptance, `Confirmation ${value(purchase.stripePaymentReference)}`, regular, {
    x: 315.8, y: 492.9, width: 230, height: 17, fontSize: 8.2, minFontSize: 7, maxLines: 1,
    color: colors.body, field: 'payment confirmation reference',
  });
  drawTextBox(acceptance, `Date ${paidAt}`, regular, {
    x: 315.8, y: 477.6, width: 230, height: 17, fontSize: 8.2, minFontSize: 7, maxLines: 1,
    color: colors.body, field: 'payment confirmation date',
  });
  drawInline(acceptance, 'AGREEMENT STATUS', bold, {x: 60, y: 448.2, size: 8.5, color: colors.muted});
  drawInline(acceptance, 'ACCEPTED AT CHECKOUT', bold, {x: 157, y: 448.2, size: 8.5, color: colors.green});
  drawTextBox(acceptance, `ACCEPTANCE REFERENCE ${reference}`, bold, {
    x: 60, y: 436.3, width: 490, height: 12, fontSize: 8.2, minFontSize: 7.2, maxLines: 1,
    color: colors.green, field: 'recorded acceptance reference',
  });
  drawTextBox(acceptance, `ACCEPTED AT ${acceptedAt}`, bold, {
    x: 60, y: 424.5, width: 490, height: 12, fontSize: 8.2, minFontSize: 7.2, maxLines: 1,
    color: colors.green, field: 'recorded acceptance time',
  });
  drawFooter(document, regular);
  return document.save();
}
