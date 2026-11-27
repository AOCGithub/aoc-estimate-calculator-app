import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const ink = [32, 44, 42];
const green = [33, 105, 87];
const muted = [99, 113, 107];
const line = [226, 231, 227];
const pale = [239, 246, 243];
const date = input => input && Number.isFinite(Date.parse(input))
  ? new Date(input).toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'}) + ' UTC'
  : 'Not confirmed';
const money = (amount, currency) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: String(currency || 'usd').toUpperCase(), currencyDisplay: 'code',
}).format(amount / 100);
const text = input => input == null || input === '' ? 'Not provided in the accepted order'
  : Array.isArray(input) ? input.join(', ') : String(input);

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
  let y = 42;
  const pageBottom = 270;
  function space(height) {
    if (y + height > pageBottom) {
      doc.addPage();
      y = 42;
    }
  }
  function setText(size = 9, weight = 'normal', color = ink) {
    doc.setFont('NotoSans', weight); doc.setFontSize(size); doc.setTextColor(...color);
  }
  function paragraph(input, {size = 9, color = muted, x = 18, width = 174, gap = 3} = {}) {
    const rows = doc.splitTextToSize(String(input), width);
    const height = size * 0.3528 * 1.5;
    for (const row of rows) {
      space(height);
      setText(size, 'normal', color);
      doc.text(row, x, y);
      y += height;
    }
    y += gap;
  }
  function section(title) {
    space(18);
    y += 4;
    setText(12, 'bold');
    doc.text(title, 18, y);
    y += 7;
  }
  function table(rows, {labelWidth = 50, columnWidths} = {}) {
    autoTable(doc, {startY: y, margin: {left: 18, right: 18, top: 42, bottom: 22}, theme: 'plain', body: rows,
      styles: {font: 'NotoSans', fontSize: 8.5, textColor: ink, cellPadding: 3, overflow: 'linebreak',
        lineColor: line, lineWidth: {bottom: 0.2}},
      columnStyles: columnWidths
        ? Object.fromEntries(columnWidths.map((cellWidth, index) => [index, {cellWidth}]))
        : {0: {cellWidth: labelWidth, textColor: muted}},
      rowPageBreak: 'avoid'});
    y = doc.lastAutoTable.finalY + 5;
  }
  function deliverablesTable() {
    space(28);
    autoTable(doc, {
      startY: y,
      margin: {left: 18, right: 18, top: 42, bottom: 22},
      theme: 'plain',
      head: [['Design service item', 'Included work or payment detail', 'Responsible party']],
      body: [
        ...(order.service.included || []).map(item => ['Included work', text(item), 'Always Open Commerce']),
        ['Design service fee', `${money(order.price.amount, order.price.currency)}; ${text(order.price.tax)}`,
          'Client pays at checkout'],
      ],
      styles: {font: 'NotoSans', fontSize: 7.8, textColor: ink, cellPadding: 2.8,
        overflow: 'linebreak', lineColor: line, lineWidth: {bottom: 0.2}},
      headStyles: {font: 'NotoSans', fontStyle: 'bold', fillColor: pale, textColor: green},
      columnStyles: {0: {cellWidth: 38}, 1: {cellWidth: 99}, 2: {cellWidth: 37}},
      rowPageBreak: 'avoid',
    });
    y = doc.lastAutoTable.finalY + 5;
  }

  const client = order.client || {};
  const project = order.project || {};
  const service = order.service || {};
  const acceptedAt = date(order.acceptance.acceptedAt);
  const orderVersion = text(order.version);
  const orderReference = text(order.reference);
  const business = text(client.company);

  setText(7.5, 'bold', green);
  doc.text('AI COMMERCE JOURNEY', 18, y);
  y += 7;
  paragraph('Review and accept  >  Secure payment  >  Confirmation', {size: 8, color: green, gap: 5});
  const title = order.documentTitle || 'Process Optimization & Solution Design Order';
  const titleRows = doc.splitTextToSize(title, 174);
  setText(19, 'bold');
  for (const row of titleRows) {
    space(9);
    doc.text(row, 18, y);
    y += 8;
  }
  y += 2;
  paragraph('This is the client-specific order accepted before payment. It records the service, scope, fee and terms agreed for this purchase.',
    {color: ink});

  section('Document information');
  table([
    ['Prepared by', 'Always Open Commerce'],
    ['Prepared for', business],
    ['Client contact', `${text(client.name)}${client.role ? ` — ${client.role}` : ''}`],
    ['Business email', text(client.businessEmail)],
    ['Project', `${text(service.name)} — ${text(project.businessArea)}`],
    ['Order reference / version', `${orderReference} / ${orderVersion}`],
    ['Issue date', date(order.issuedAt)],
    ['Accepted', acceptedAt],
  ]);

  section('Your design service purchase');
  paragraph(text(service.description), {color: ink});

  section('Agreed design-service scope');
  table([
    ['Client', business],
    ['Business goal', text(project.businessGoal)],
    ['Process / department', `${text(project.agreedProcess)}\n${text(project.businessArea)} — ${text(project.departments)}`],
    ['Systems', text(project.systems)],
    ['Not included', text(service.excluded)],
  ], {labelWidth: 43});

  section('What happens after purchase');
  paragraph('We will use the process information and scope recorded in this accepted order to deliver the service described below. If clarification or additional information is needed, we will contact you.',
    {color: ink});
  paragraph('Your order acceptance and payment confirmation are recorded here. The accepted C10, estimate PDF and Stripe receipt are separate records.',
    {color: muted});

  section('Solution design order');
  paragraph('Included work and payment detail', {size: 9, color: ink, gap: 2});
  deliverablesTable();
  table([
    ['Total accepted', money(order.price.total, order.price.currency)],
    ['Payment status', purchase.outcome === 'paid' ? 'Paid' : 'Not confirmed'],
    ['Stripe checkout', text(purchase.stripeCheckoutReference)],
    ['Stripe payment', text(purchase.stripePaymentReference)],
  ]);

  section('Timing, exclusions and purchase terms');
  table([
    ['Expected delivery', text(service.delivery)],
    ['Implementation / other excluded work', text(service.excluded)],
    ['Eligible build credit', text(service.credit)],
    ['Refund', text(service.refund)],
    ['Changes outside scope', text(service.changeControl)],
  ], {labelWidth: 48});
  paragraph('The preliminary build estimate is not a final implementation quote. Implementation requires a separate agreed scope, price and approval.',
    {color: ink});

  section('How this purchase is recorded');
  paragraph(`Your acceptance was captured at checkout on ${acceptedAt}. The same accepted order is attached to the payment-confirmation email after verified payment. No second signature is required for this order.`,
    {color: ink});
  paragraph('Any later implementation requires its own agreed scope, price, schedule and payment terms.', {color: ink});

  section('Checkout acceptance');
  paragraph(text(order.acceptance.wording), {color: ink});
  table([
    ['Client representative', text(client.name)],
    ['Acceptance reference', `${orderReference} / ${orderVersion}`],
    ['Accepted at', acceptedAt],
    ['Agreement version', text(order.acceptance.agreementVersion)],
    ['Purchase confirmation', text(purchase.purchaseReference)],
    ['Submission reference', text(order.submissionReference)],
    ['Work-description record', text(order.recordingReference)],
    ['Order fingerprint', text(order.fingerprint)],
  ], {labelWidth: 48});
  paragraph('The Stripe receipt is a separate payment record and is not part of this C10 PDF.', {size: 8, color: muted});

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
