import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { money } from '../../lib/format.js';
import { describeEstimate } from '../../lib/estimate-display.js';
import { auditNextStep, paymentOutcomes, sandboxNotice } from './payment-copy.js';

const ink=[32,44,42],green=[33,105,87],muted=[99,113,107],line=[226,231,227];
const date=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})+' UTC':'Not confirmed';
const answer=value=>Array.isArray(value)?value.join(', '):String(value);
const hasAnswer=value=>value!=null&&(Array.isArray(value)?value.length>0:typeof value!=='string'||value.trim()!=='');
const titleCase=value=>value.charAt(0).toUpperCase()+value.slice(1);
const solutions={workflow:'Automated workflow',agent:'AI agent'};
const actionModes={draft:'Prepare drafts for a person to approve',approved:'Make changes after approval',automatic:'Routine work proceeds within agreed limits'};

// One AOC template, filled only from the immutable purchase snapshot. It never
// recalculates prices or uses the visitor's later calculator edits.
export function createPurchasePdf(purchase,{regularFont,boldFont,logo,questionBank=globalThis.AOCBank}={}) {
  if(!regularFont||!boldFont)throw new Error('PDF fonts are required.');
  const estimatorBank=questionBank;
  if(!estimatorBank)throw new Error('The calculator questions could not be loaded.');
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  doc.addFileToVFS('NotoSans-Regular.ttf',regularFont);doc.addFont('NotoSans-Regular.ttf','NotoSans','normal');
  doc.addFileToVFS('NotoSans-Bold.ttf',boldFont);doc.addFont('NotoSans-Bold.ttf','NotoSans','bold');
  doc.setProperties({title:'AOC - Paid discovery payment and estimate',author:'Always Open Commerce',subject:purchase.purchaseReference});
  const {snapshot}=purchase,{result,service,profile,answers}=snapshot;
  const display=describeEstimate(result,answers);
  const area=estimatorBank.areas.find(row=>row.id===snapshot.area);
  const labels=new Map([...estimatorBank.appFields,...estimatorBank.dataFields,...estimatorBank.roiFields,...estimatorBank.serviceFields,...(area?.fields||[])].map(row=>[row.id,row.question]));
  let y=44;
  function space(height){if(y+height>276){doc.addPage();y=42;}}
  function text(value,size=10,weight='normal',color=ink){doc.setFont('NotoSans',weight);doc.setFontSize(size);doc.setTextColor(...color);return String(value);}
  function paragraph(value,{size=9,color=muted}={}){
    const rows=doc.splitTextToSize(text(value,size,'normal',color),174),height=size*0.3528*1.5;
    for(const row of rows){space(height);text(row,size,'normal',color);doc.text(row,18,y);y+=height;}
    y+=4;
  }
  function section(title,minHeight=24){space(minHeight);y+=5;text(title,12,'bold');doc.text(title,18,y);y+=8;}
  function table(rows,{head,labelWidth=64}={}){
    if(!rows.length)return;
    if(head)space(21);
    autoTable(doc,{startY:y,margin:{left:18,right:18,top:42,bottom:22},theme:'plain',
      ...(head?{head:[head]}:{}),body:rows,
      styles:{font:'NotoSans',fontSize:8.5,textColor:ink,cellPadding:3.2,overflow:'linebreak',lineColor:line,lineWidth:{bottom:0.2}},
      headStyles:{fillColor:green,textColor:[255,255,255],fontStyle:'bold'},
      columnStyles:{0:{cellWidth:labelWidth,textColor:muted}},rowPageBreak:'avoid'});
    y=doc.lastAutoTable.finalY+5;
  }

  text('Payment & estimate',24,'bold');doc.text('Payment & estimate',18,y);y+=10;
  paragraph(sandboxNotice,{size:8.5});
  space(38);
  doc.setFillColor(239,244,240);doc.roundedRect(18,y,174,32,3,3,'F');
  const [statusLabel]=paymentOutcomes[purchase.outcome];
  text(statusLabel,10,'bold',green);doc.text(statusLabel,24,y+9);
  const paymentAmount=money(purchase.amount/100)+' '+purchase.currency.toUpperCase();
  text(paymentAmount,21,'bold');doc.text(paymentAmount,24,y+21);
  text('One-time discovery fee',8,'normal',muted);doc.text('One-time discovery fee',186,y+21,{align:'right'});y+=40;
  table([
    ['Payment for',purchase.item],['Payment confirmed',date(purchase.paidAt)],
    ['Purchase reference',purchase.purchaseReference],
    ...[['Client', [profile?.name,profile?.company].filter(Boolean).join(' / ')],
      ['Business email',profile?.businessEmail]].filter(([,value])=>hasAnswer(value)),
  ]);
  if(purchase.outcome!=='paid')paragraph('Payment hasn’t been confirmed. Use your Stripe receipt once payment goes through.');
  section('What the payment covers');
  paragraph(`This payment covers ${purchase.item || 'the paid discovery service'}. The fixed-price build is confirmed separately.`);
  if(result.auditRate===.15&&result.build!=null)paragraph('The paid discovery fee is 15% of the saved one-time build estimate. The build remains provisional until AOC confirms scope and price.');
  if(service){
    paragraph(service.description);
    for(const item of service.included)paragraph('• '+item,{color:ink});
    paragraph(service.excluded);
    paragraph(service.delivery);
  }

  section('Work you submitted',42);
  const scope=[
    ['Business area',area?.label||snapshot.area],['Proposed solution',solutions[answers.solution]],
    ['Apps identified for connection',answers.systems],
    ['How changes are approved',actionModes[answers.action_mode]],['What needs approval',answers.client_approval_checkpoints],
  ].filter(([,value])=>hasAnswer(value)).map(([label,value])=>[label,answer(value)]);
  table(scope);
  paragraph(snapshot.description,{color:ink});

  section('Your saved project estimate');
  paragraph('All amounts are in USD. You’ll agree the build and any ongoing costs separately with AOC.');
  table([
    ...(result.level?[['Scope classification',titleCase(result.level)]]:[]),
    ['Fixed-price build quote',result.buildQuoted
      ? result.build != null ? money(result.build) : 'AOC needs to confirm the work before showing a total'
      : 'To be confirmed by AOC after paid discovery'],
    ['Planning estimate for the build',result.provisionalBuild != null?money(result.provisionalBuild):'AOC needs more detail about the work to estimate the build'],
  ]);
  if(result.buildQuoted&&result.build!=null){
    table([
      ['Preparation and foundation',answers.preparation_fee],
      ['Implementation including agreed reusable training',answers.implementation_fee],
      ['Additional live training',answers.live_training==='yes'?answers.live_training_fee:null],
    ].filter(([,value])=>hasAnswer(value)).map(([label,value])=>[label,money(Number(value))]),{head:['Entered quote item','Amount (USD)']});
  }
  if(result.lines?.length){
    section('Planning estimate breakdown');
    paragraph('Here’s how the calculator estimated the cost of the build. Any quote you entered is listed above.');
    table(result.lines.filter(row=>row.amount!=null).map(row=>[row.label,money(row.amount)]),{head:['Item','Amount (USD)'],labelWidth:133});
  }

  section('Ongoing costs and potential value');
  table([
    ['Proposed Launch Support',display.support],
    ['Future operating costs',display.ongoing],
    ...(result.capacity!=null?[['Value of team time freed',money(result.capacity)+' / month']]:[]),
    ...(result.cash!=null?[['Recurring cash savings',money(result.cash)+' / month']]:[]),
    ...(result.net!=null?[['Estimated monthly value after costs',money(result.net)+' / month']]:[]),
    ...(display.payback?[['Illustrative payback',display.payback]]:[]),
  ]);
  if(result.capacity!=null)paragraph('Time saved frees your team to do other work. Cash savings count expenses that would go away.');
  if(display.roiNote)paragraph(display.roiNote);
  if(display.paybackNote)paragraph(display.paybackNote);

  section('Next steps and discovery terms');
  paragraph(purchase.outcome==='paid'
    ? auditNextStep
    : 'We’ll review your discovery request once Stripe confirms payment.');
  if(service)table([['Credit toward your build',service.credit],['Refund',service.refund]],{labelWidth:42});
  if(result.credit?.amount!=null)paragraph('This estimate shows a discovery fee credit of '+money(result.credit.amount)+'. AOC will confirm the credit before applying it.');
  else if(result.credit?.reason)paragraph(result.credit.reason);

  doc.addPage();y=44;
  section('Supporting details for AOC');
  paragraph('Share your purchase reference with AOC if you have a question about this payment.');
  table([
    ['Submission reference',purchase.submissionReference],['Work-description record',purchase.recordingReference],
    ['Purchase reference',purchase.purchaseReference],
    ...(purchase.auditIntakeReference?[['Discovery request reference',purchase.auditIntakeReference]]:[]),
    ['Answers saved',date(snapshot.savedAt)],['Calculator rules',snapshot.calculatorVersion],
    ...(service?.version?[['Discovery offer version',service.version]]:[]),
    ...[['Company website',profile?.website],['Client role',profile?.role]].filter(([,value])=>hasAnswer(value)),
  ]);
  const notices=[...(result.errors||[]),...(result.assumptions||[]),...(result.pending||[]),...(result.warnings||[]),result.commercialNotice].filter(Boolean);
  if(notices.length){section('Calculator notes');for(const notice of new Set(notices))paragraph('• '+notice);}
  const savedAnswers=Object.entries(answers).filter(([,value])=>hasAnswer(value));
  if(savedAnswers.length){
    doc.addPage();y=44;
    section('Saved answers');
    paragraph('These are the answers you provided before checkout.');
    table(savedAnswers.map(([key,value])=>[labels.get(key)||titleCase(key.replaceAll('_',' ')),answer(value)]),{head:['Question','Saved answer'],labelWidth:83});
  }
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    doc.setPage(page);
    if(logo)doc.addImage(logo,'PNG',18,14,9,9);
    text('Always Open Commerce',10,'bold');doc.text('Always Open Commerce',logo?31:18,19);
    text('AI COMMERCE / DISCOVERY',7,'normal',muted);doc.text('AI COMMERCE / DISCOVERY',192,19,{align:'right'});
    doc.setDrawColor(...line);doc.line(18,29,192,29);doc.line(18,282,192,282);
    text('Sandbox • No real charge',7,'normal',muted);doc.text('Sandbox • No real charge',18,289);
    doc.text(`Page ${page} of ${pages}`,192,289,{align:'right'});
  }
  return doc;
}

let assets;
async function pdfAssets(){
  assets ||= Promise.all(['/fonts/noto-sans/NotoSans-Regular.ttf','/fonts/noto-sans/NotoSans-Bold.ttf','/favicon.png'].map(async path=>{
    const response=await fetch(path,{credentials:'same-origin'});
    if(!response.ok)throw new Error('PDF asset unavailable.');
    const bytes=new Uint8Array(await response.arrayBuffer());let binary='';
    for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));
    return btoa(binary);
  })).catch(error=>{assets=null;throw error;});
  const [regularFont,boldFont,logo]=await assets;return {regularFont,boldFont,logo};
}

export async function downloadPurchasePdf(purchase){
  const doc=createPurchasePdf(purchase,await pdfAssets());
  doc.save('aoc-discovery-payment-'+purchase.purchaseReference+'.pdf');
}
