import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const ink = [32, 44, 42];
const green = [33, 105, 87];
const muted = [99, 113, 107];
const line = [226, 231, 227];
const date = input => input && Number.isFinite(Date.parse(input))
  ? new Date(input).toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'}) + ' UTC'
  : 'Not confirmed';
const money = (amount, currency) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: String(currency || 'usd').toUpperCase(), currencyDisplay: 'code',
}).format(amount / 100);

export function createC10OrderPdf(purchase, {regularFont, boldFont, logo} = {}) {
  if (!regularFont || !boldFont) throw new Error('PDF fonts are required.');
  const order = purchase.acceptedOrder;
  if (!order?.acceptance?.acceptedAt) throw new Error('An accepted C10 order is required.');
  const doc = new jsPDF({unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true});
  doc.addFileToVFS('NotoSans-Regular.ttf', regularFont);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFileToVFS('NotoSans-Bold.ttf', boldFont);
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  doc.setProperties({title: `C10 accepted order ${order.reference}`, author: 'Always Open Commerce',
    subject: purchase.purchaseReference});
  let y = 43;
  const pageBottom = 276;
  function space(height) { if (y + height > pageBottom) { doc.addPage(); y = 42; } }
  function setText(size = 9, weight = 'normal', color = ink) {
    doc.setFont('NotoSans', weight); doc.setFontSize(size); doc.setTextColor(...color);
  }
  function paragraph(input, {size = 9, color = muted, bullet = false} = {}) {
    const prefix = bullet ? '- ' : '';
    const rows = doc.splitTextToSize(prefix + String(input), bullet ? 168 : 174);
    const height = size * 0.3528 * 1.5;
    for (const row of rows) { space(height); setText(size, 'normal', color); doc.text(row, bullet ? 22 : 18, y); y += height; }
    y += 3;
  }
  function section(title, minHeight = 24) {
    space(minHeight); y += 4; setText(12, 'bold'); doc.text(title, 18, y); y += 7;
  }
  function table(rows, labelWidth = 53) {
    autoTable(doc, {startY: y, margin: {left: 18, right: 18, top: 42, bottom: 22}, theme: 'plain', body: rows,
      styles: {font: 'NotoSans', fontSize: 8.5, textColor: ink, cellPadding: 3.1, overflow: 'linebreak',
        lineColor: line, lineWidth: {bottom: 0.2}}, columnStyles: {0: {cellWidth: labelWidth, textColor: muted}},
      rowPageBreak: 'avoid'});
    y = doc.lastAutoTable.finalY + 5;
  }

  setText(7.5, 'bold', green); doc.text('C10 / ACCEPTED ORDER', 18, y); y += 8;
  setText(21, 'bold'); doc.text('Process Optimization &', 18, y); y += 8;
  doc.text('Solution Design Order', 18, y); y += 10;
  paragraph('This is the accepted order for the paid discovery and planning stage. It does not authorize implementation or ongoing services.');
  table([
    ['Order reference', order.reference], ['Order version', order.version], ['Issued', date(order.issuedAt)],
    ['Accepted', date(order.acceptance.acceptedAt)], ['Purchase reference', purchase.purchaseReference],
    ['Payment status', purchase.outcome === 'paid' ? 'Paid' : 'Not confirmed'],
  ]);

  section('Client and project');
  table([
    ['Client representative', order.client.name], ['Company', order.client.company],
    ['Business email', order.client.businessEmail], ['Business area', order.project.businessArea],
    ['Systems', order.project.systems], ['Departments', order.project.departments],
  ]);
  paragraph(order.project.agreedProcess, {color: ink});

  section('Ordered service');
  table([['Service', order.service.name], ['Description', order.service.description]]);
  for (const item of order.service.included) paragraph(item, {color: ink, bullet: true});
  paragraph(order.service.excluded);

  section('Fee and payment');
  table([
    ['One-time fee', money(order.price.amount, order.price.currency)],
    ['Tax treatment', order.price.tax], ['Total accepted', money(order.price.total, order.price.currency)],
    ['Stripe checkout', purchase.stripeCheckoutReference || 'Not recorded'],
    ['Stripe payment', purchase.stripePaymentReference || 'Not recorded'],
  ]);
  paragraph('The Stripe receipt is a separate payment record and is not part of this C10 PDF.');

  section('Delivery and commercial terms');
  table([
    ['Expected delivery', order.service.delivery], ['Build credit', order.service.credit],
    ['Refund', order.service.refund], ['Changes', order.service.changeControl],
  ]);

  section('Electronic acceptance');
  paragraph(order.acceptance.wording, {color: ink});
  table([
    ['Authorized representative', order.client.name], ['Order accepted', `${order.reference} / ${order.version}`],
    ['Acceptance time', date(order.acceptance.acceptedAt)], ['Agreement version', order.acceptance.agreementVersion],
    ['Order fingerprint', order.fingerprint],
    ['Submission reference', order.submissionReference], ['Work-description record', order.recordingReference],
  ]);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    if (logo) doc.addImage(logo, 'PNG', 18, 14, 9, 9);
    setText(10, 'bold'); doc.text('Always Open Commerce', logo ? 31 : 18, 19);
    setText(7, 'normal', muted); doc.text('AI COMMERCE / C10', 192, 19, {align: 'right'});
    doc.setDrawColor(...line); doc.line(18, 29, 192, 29); doc.line(18, 282, 192, 282);
    doc.text(purchase.testMode ? 'Sandbox - no real charge or booking' : 'Accepted electronic order', 18, 289);
    doc.text(`Page ${page} of ${pages}`, 192, 289, {align: 'right'});
  }
  return doc;
}
