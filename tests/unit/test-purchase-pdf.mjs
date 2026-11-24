import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {auditService} from '../../server/payments/audit-service.mjs';
const require=createRequire(import.meta.url);
globalThis.AOCBank=require('../../public/approved-bank.js');
globalThis.AOCJourneyEngine=require('../../public/journey-engine.js');
const {createPurchasePdf}=await import('../../src/features/payments/purchase-pdf.js');
const {area,process_confirmed,management,...answers}=require('../fixtures/commercial.cjs');
const calculate=require('../../public/journey-calculation.js').calculate;
const result=calculate({area,confirmed:true,answers}).result;
const [regularFont,boldFont,logo]=await Promise.all(['NotoSans-Regular.ttf','NotoSans-Bold.ttf','../../favicon.png'].map(async file=>(await readFile(new URL('../../public/fonts/noto-sans/'+file,import.meta.url))).toString('base64')));
const assets={regularFont,boldFont,logo};
const original={testMode:true,submissionReference:'11111111-1111-4111-8111-111111111111',recordingReference:'22222222-2222-4222-8222-222222222222',purchaseReference:'33333333-3333-4333-8333-333333333333',
 auditIntakeReference:'44444444-4444-4444-8444-444444444444',outcome:'paid',paidAt:'2026-11-18T04:00:00Z',amount:result.audit*100,currency:'usd',item:auditService.name,
 snapshot:{area,description:'José’s team reviews draft invoices, checks totals, and approves each invoice.',answers,result,service:auditService,calculatorVersion:'synthetic-pdf-fixture',savedAt:'2026-11-18T03:55:00Z',
 profile:{name:'José Dela Peña',company:'Synthetic PDF Company',website:'example.com',role:'Owner',businessEmail:'synthetic@example.com'}}};

async function inspect(purchase){
 const before=JSON.stringify(purchase),doc=createPurchasePdf(purchase,assets);
 assert.equal(JSON.stringify(purchase),before,'Generating a PDF cannot change the saved record');
 const bytes=new Uint8Array(doc.output('arraybuffer'));assert.equal(Buffer.from(bytes.subarray(0,5)).toString(),'%PDF-');
 const task=getDocument({data:bytes}),pdf=await task.promise,rows=[];
 for(let p=1;p<=pdf.numPages;p++){
  const page=await pdf.getPage(p),content=await page.getTextContent(),viewport=page.getViewport({scale:1});
  const pageRows=content.items.filter(row=>row.str?.trim());rows.push(pageRows.map(row=>row.str).join(' '));
  for(const row of pageRows){
   const [,,,,x,y]=row.transform;
   assert.ok(x>=0&&x+row.width<=viewport.width+1,'PDF text stays within the page width: '+row.str);
   assert.ok(y>=0&&y<=viewport.height,'PDF text stays within the page height: '+row.str);
   if(!row.str.startsWith('Page ')&&!row.str.includes('Sandbox •')&&!row.str.includes('AI COMMERCE')&&!row.str.includes('Always Open Commerce'))assert.ok(y>56,'Body text does not overlap page footers: '+row.str);
  }
 }
 const text=rows.join(' ').replace(/\s+/g,' '),pages=pdf.numPages;
 await task.destroy();return {text,pages,doc};
}
await mkdir('artifacts/g2',{recursive:true});
const {text,pages,doc}=await inspect(structuredClone(original));
for(const value of ['José Dela Peña',original.snapshot.description,original.submissionReference,original.recordingReference,original.purchaseReference,original.auditIntakeReference,'$1,725 USD','$11,500','Payment received','This payment covers the initial audit','Cash savings count expenses that would go away',auditService.credit,auditService.refund,auditService.version])assert.ok(text.includes(value),'Saved PDF includes '+value);
assert.ok(text.includes('The audit fee is 15% of the saved one-time project estimate.'),'Current PDF explains the audit calculation');
const sections=['Payment received','What the payment covers','Work you submitted','Your saved project estimate','Planning estimate breakdown','Ongoing costs and potential value','Next steps and audit terms','Supporting details for AOC','Saved answers'];
let lastSection=-1;
for(const section of sections){
 const position=text.indexOf(section);
 assert.ok(position>lastSection,'PDF presents '+section+' in order');
 lastSection=position;
}
assert.match(text,/Scope classification Complex/);
assert.match(text,/AOC monthly service Ongoing AOC support not included/);
assert.match(text,/Recurring cash savings \$0 \/ month/);
assert.ok(pages>=2&&pages<=8,'The full saved answer appendix has a bounded page count');
await writeFile('artifacts/g2/payment-estimate-template.pdf',Buffer.from(doc.output('arraybuffer')));
for(const outcome of ['pending','processing','failed','incomplete']){
 const row=structuredClone(original);Object.assign(row,{outcome,paidAt:null,auditIntakeReference:null});
 const {text}=await inspect(row);
 assert.ok(text.includes('Payment hasn’t been confirmed'));assert.ok(!text.includes('Payment received'));
}
const legacy=structuredClone(original);delete legacy.snapshot.service;
assert.ok(!(await inspect(legacy)).text.includes(auditService.refund),'Old snapshots do not acquire new offer terms');
const earlierOffer=structuredClone(original);
Object.assign(earlierOffer.snapshot.service,{version:'2026-11-18-audit-v1',refund:'A full audit-fee refund applies if AOC cannot validate and deliver a workable approach for the scope you purchased.'});
const earlierOfferPdf=await inspect(earlierOffer);
assert.ok(earlierOfferPdf.text.includes(earlierOffer.snapshot.service.refund));
assert.ok(!earlierOfferPdf.text.includes(auditService.refund),'A purchase with prior terms keeps the wording shown at checkout');
const optional=structuredClone(original);
Object.assign(optional.snapshot.answers,{team_time:null,blended_hourly_cost:'',software_replaced_portion:null,incremental_software_cost:null});
optional.snapshot.result=calculate({area,confirmed:true,answers:optional.snapshot.answers}).result;
const optionalPdf=await inspect(optional);
assert.equal(optionalPdf.text.split('ROI not estimated because optional time or cost details were not provided.').length,2);
assert.match(optionalPdf.text,/Software costs not provided/);
assert.doesNotMatch(optionalPdf.text,/Awaiting details|Estimated monthly value after costs|Illustrative payback/);
assert.match(optionalPdf.text,/\$1,725 USD/);
assert.match(optionalPdf.text,/Project quote entered \$11,500/);
await writeFile('artifacts/g2/payment-estimate-optional-inputs.pdf',Buffer.from(optionalPdf.doc.output('arraybuffer')));

const support=structuredClone(original);
Object.assign(support.snapshot.answers,{responsibility_split:'shared',tier:'standard',implementation_fee:12001.67});
support.amount=180025;
support.snapshot.result=calculate({area,confirmed:true,answers:support.snapshot.answers}).result;
const supportPdf=await inspect(support);
assert.match(supportPdf.text,/Support fee to be quoted by AOC/);
assert.match(supportPdf.text,/ROI can be estimated after AOC quotes the support fee/);
assert.doesNotMatch(supportPdf.text,/ROI not estimated because optional/);
assert.match(supportPdf.text,/\$1,800\.25 USD/);

const undecided=structuredClone(support);
undecided.snapshot.answers.responsibility_split='help';
undecided.snapshot.result=calculate({area,confirmed:true,answers:undecided.snapshot.answers}).result;
assert.match((await inspect(undecided)).text,/Support arrangement not specified/);
const long=structuredClone(original);long.snapshot.description=('Review draft invoices, keep human approvals, and flag unclear totals.\n\n').repeat(220)+'END OF SAVED DESCRIPTION';
long.snapshot.answers.unknown_detail='x'.repeat(500)+' END OF LONG ANSWER';
const longPdf=await inspect(long);assert.ok(longPdf.pages>pages);assert.ok(longPdf.text.includes('END OF SAVED DESCRIPTION'));assert.ok(longPdf.text.includes('END OF LONG ANSWER'));
await writeFile('artifacts/g2/payment-estimate-long.pdf',Buffer.from(longPdf.doc.output('arraybuffer')));
console.log('PASS: parsed PDFs preserve immutable payment amounts, UTF-8 names, full descriptions/answers, references and original terms; unpaid outcomes cannot claim payment; legacy terms stay unchanged; unknown costs and fractional USD display correctly; long content paginates within page bounds.');
