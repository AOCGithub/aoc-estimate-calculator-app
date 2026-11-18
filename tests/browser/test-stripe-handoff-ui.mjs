import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir,readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';
import Calculation from '../../public/journey-calculation.js';
import fixture from '../fixtures/commercial.cjs';
import {auditService} from '../../server/payments/audit-service.mjs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const {area,process_confirmed,management,...answers}=fixture;
const result=Calculation.calculate({area,confirmed:true,answers}).result;
const description='Prepare invoice drafts in Wave. Staff review every invoice. These are the final manually corrected words.';
const purchase={testMode:true,submissionReference:randomUUID(),recordingReference:randomUUID(),purchaseReference:randomUUID(),
 auditIntakeReference:null,outcome:'pending',amount:result.audit*100,currency:'usd',item:auditService.name,receiptUrl:null,
 snapshot:{area,description,answers,result,service:auditService,calculatorVersion:'synthetic-ui-fixture',savedAt:'2026-11-17T10:00:00Z'}};
let mode='review',outcome='pending',calls=0,refreshDelay=0,refreshError=false,refreshChecks=0,server,browser;
const errors=[];
try{
 server=await createServer({configFile:false,root:process.cwd(),envDir:path.resolve('tests/fixtures'),logLevel:'silent',
  define:{'import.meta.env.VITE_AOC_STRIPE_TEST_HANDOFF_ENABLED':'"true"'},
  plugins:[react(),{name:'g2-ui-fixture',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
   const url=new URL(req.url,'http://fixture');
   const respond=body=>res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify(body));
   if(['/', '/payment/status'].includes(url.pathname)){
    const rules=url.pathname==='/'&&!url.searchParams.has('purchase_reference')?'<script src="/engine.js"></script><script src="/approved-pricing.js"></script><script src="/approved-bank.js"></script><script src="/commercial.js"></script><script src="/journey-engine.js"></script>':'';
    const html=await vite.transformIndexHtml(req.url,`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>
      ${rules}<script type="module" src="/tests/fixtures/g2-purchase-ui.jsx"></script></html>`);
    res.writeHead(200,{'content-type':'text/html'}).end(html);return;
   }
   if(url.pathname==='/__g2_fixture'){respond({state:{area,answers,description,confirmed:true,dirty:false,result:mode==='no-quote'?{...result,audit:null}:result,calculationSource:'server'}});return;}
   if(url.pathname==='/api/payments/status'){
    if(url.searchParams.get('refresh')==='true'){
     refreshChecks++;
     if(refreshDelay)await new Promise(resolve=>setTimeout(resolve,refreshDelay));
     if(refreshError){res.writeHead(502,{'content-type':'application/json'}).end(JSON.stringify({error:'We could not check Stripe right now. Your saved payment status has not changed. Please try again.'}));return;}
    }
    if(mode==='disabled'){respond({enabled:false});return;}
    if(mode==='setup'){respond({enabled:true,configured:false});return;}
    if(['missing-return','invalid-return','expired-session','temporary-error'].includes(mode)&&url.searchParams.has('purchase_reference')){
     const code=mode==='invalid-return'?400:mode==='temporary-error'?503:mode==='expired-session'?401:404;
     res.writeHead(code,{'content-type':'application/json'}).end(JSON.stringify({error:code===503?'Payment details are temporarily unavailable.':'Purchase not found for this session.'}));return;
    }
    respond(!url.searchParams.has('purchase_reference')?{enabled:true,configured:true,pricing:'quoted_audit',service:auditService}:
      {enabled:true,configured:true,purchase:{...purchase,snapshot:mode==='legacy-return'?{...purchase.snapshot,service:undefined}:purchase.snapshot,outcome,auditIntakeReference:outcome==='paid'?'synthetic-intake-reference':null,
        paidAt:outcome==='paid'?'2026-11-17T10:01:00Z':null,receiptUrl:outcome==='paid'?'https://pay.stripe.com/receipts/payment/fixture':null}});return;
   }
   if(url.pathname==='/api/payments/checkout'){
    let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);assert.equal(body.consent,true);
    if(!body.submissionReference){assert.equal(body.description,description);assert.equal(body.calculation.answers.implementation_fee,11500);}
    else assert.deepEqual(body,{consent:true,submissionReference:purchase.submissionReference});
    calls++;respond({purchase:{...purchase,outcome}});return;
   }
   next();
  });}}],server:{host:'127.0.0.1',port:5179,strictPort:false,fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/artifacts/**']}}});
 await server.listen();const origin='http://127.0.0.1:'+server.httpServer.address().port;
 const executablePath=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
 assert.ok(executablePath,'Set CHROME_PATH to run the G2 browser check.');
 browser=await chromium.launch({executablePath,headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await page.getByRole('button',{name:'Review audit payment',exact:true}).click();
 const review=await page.getByRole('region',{name:'Audit payment'}).innerText();
 assert.ok(review.includes('$1,250'));assert.ok(review.includes('$11,500'));
 assert.ok(review.includes(auditService.excluded));
 assert.ok(review.includes('No real charge or audit booking'));
 assert.ok(review.includes('Due today'));assert.ok(review.includes(auditService.included[0]));
 await page.getByText('Timing, audit credit and refunds',{exact:true}).click();
 for(const value of [auditService.delivery,auditService.credit,auditService.refund])assert.equal(await page.getByText(value,{exact:true}).isVisible(),true);
 await mkdir('artifacts/g2',{recursive:true});await page.screenshot({path:'artifacts/g2/audit-review-official-desktop.png',fullPage:true});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:950});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const actions=page.locator('.g2-purchase__checkout .g2-purchase__actions');
  const primary=await actions.getByRole('button',{name:'Continue to Stripe',exact:true}).boundingBox();
  const back=await actions.getByRole('button',{name:'Back to audit overview',exact:true}).boundingBox();
  assert.ok(primary.height>=44&&back.height>=44&&primary.y<back.y&&primary.width===back.width,'The primary action leads the full-width mobile buttons');
  await page.screenshot({path:`artifacts/g2/audit-review-official-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 const pay=page.getByRole('button',{name:'Continue to Stripe',exact:true});
 const consent=page.getByRole('checkbox',{name:/Save my answers and work description/});
 assert.equal(await pay.isDisabled(),true);
 await page.getByText('Check the box above to continue.',{exact:true}).waitFor();
 await consent.check();assert.equal(await pay.isEnabled(),true);
 await page.getByRole('button',{name:'Back to audit overview',exact:true}).click();
 await page.waitForFunction(()=>document.activeElement?.textContent==='Review audit payment');
 assert.equal(calls,0,'Closing the review makes no checkout request');
 await page.getByRole('button',{name:'Review audit payment',exact:true}).press('Enter');
 await page.waitForFunction(()=>document.activeElement?.tagName==='H2'&&document.activeElement.textContent==='Initial audit & roadmap');
 assert.equal(await consent.isChecked(),false,'Reopening requires fresh consent');
 assert.equal(await pay.isDisabled(),true);
 await consent.check();
 await page.getByText('You’ll review the total and pay on Stripe.',{exact:true}).waitFor();
 assert.equal(await pay.isEnabled(),true);
 await pay.click();await page.getByRole('heading',{name:'Payment not confirmed'}).waitFor();
 assert.equal(new URL(page.url()).pathname,'/payment/status');
 assert.equal(calls,1);assert.equal(await page.getByRole('link',{name:/View Stripe receipt/}).count(),0);
 await page.getByText('Work description and estimate',{exact:true}).click();
 assert.equal(await page.getByText(description,{exact:true}).count(),1);
 await page.getByText('Submission and audit references',{exact:true}).click();
 assert.equal(await page.getByText('Waiting for payment confirmation',{exact:true}).count(),1);
 for(const value of [purchase.submissionReference,purchase.recordingReference,purchase.purchaseReference])assert.equal(await page.getByText(value,{exact:true}).isVisible(),true);
 mode='return';
 const paidReturn=origin+'/payment/status?purchase_reference='+purchase.purchaseReference+'&checkout_result=success';
 await page.goto(paidReturn);
 await page.getByRole('heading',{name:'Waiting for payment confirmation',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:/View Stripe receipt/}).count(),0,'The return URL itself never confirms a payment');
 outcome='paid';
 await page.getByRole('heading',{name:'Payment received',level:1,exact:true}).waitFor({timeout:9000});
 assert.equal(await page.getByText(/Thanks for your payment.*when you can expect your audit report/).isVisible(),true);
 assert.equal(await page.getByRole('link',{name:/View Stripe receipt/}).getAttribute('href'),'https://pay.stripe.com/receipts/payment/fixture');
 assert.equal(await page.getByRole('button',{name:'Review audit payment',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>Boolean(window.AOCBank)),false,'Status loads independently of calculator rules');
 assert.equal(await page.getByText('Amount paid',{exact:true}).isVisible(),true);
 assert.equal(await page.getByRole('link',{name:'Back to calculator'}).getAttribute('href'),'/');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download payment & estimate (PDF)',exact:true}).click();
 const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.pdf$/);
 const bytes=await readFile(await download.path());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert.equal(await page.evaluate(()=>Boolean(window.AOCJourneyEngine)),false,'The PDF can download without opening the calculator engine');
 const pdfTask=getDocument({data:new Uint8Array(bytes)}),pdf=await pdfTask.promise;
 const contents=[];for(let p=1;p<=pdf.numPages;p++)contents.push((await (await pdf.getPage(p)).getTextContent()).items.map(row=>row.str).join(' '));
 const text=contents.join(' ').replace(/\s+/g,' ');
 for(const expected of [description,purchase.submissionReference,purchase.recordingReference,purchase.purchaseReference,'Cash savings count expenses that would go away','This payment covers the initial audit','No real charge or audit booking','$1,250','$11,500',auditService.delivery,auditService.credit,auditService.refund,auditService.version])assert.ok(text.includes(expected),'PDF includes '+expected);
 await mkdir('artifacts/g2',{recursive:true});await import('node:fs/promises').then(fs=>fs.writeFile('artifacts/g2/payment-and-estimate-sample.pdf',bytes));
 await pdfTask.destroy();
 const checkFeedback=page.locator('.g2-purchase__check-feedback');
 refreshDelay=1100;
 await page.getByRole('button',{name:'Refresh payment status',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Checking payment…',exact:true}).isDisabled(),true);
 await checkFeedback.getByText('Checking with Stripe…',{exact:true}).waitFor();
 const refreshButton=await page.getByRole('button',{name:'Checking payment…',exact:true}).boundingBox();
 const card=await checkFeedback.locator('.g2-purchase__check-card').boundingBox();
 assert.ok(card.y>=refreshButton.y+refreshButton.height,'Stripe feedback appears below the payment actions');
 await page.locator('.g2-purchase').screenshot({path:'artifacts/g2/stripe-checking-desktop.png'});
 await checkFeedback.getByText('Payment received',{exact:true}).waitFor();
 await checkFeedback.getByText(/Checked at /).waitFor();
 assert.equal(refreshChecks,1,'One manual click checks the owned purchase with Stripe');
 assert.equal(calls,1,'Checking status never opens a new checkout');
 refreshDelay=0;refreshError=true;
 await page.getByRole('button',{name:'Refresh payment status',exact:true}).click();
 await checkFeedback.getByText('Couldn’t check payment',{exact:true}).waitFor();
 assert.match(await checkFeedback.textContent(),/We could not check Stripe right now\./);
 assert.equal(await page.getByRole('heading',{name:'Payment received',exact:true}).isVisible(),true,'A refresh failure preserves the saved outcome');
 assert.equal(await page.getByText(/Checked at /).count(),0,'No false successful-check message after failure');
 refreshError=false;await page.getByRole('button',{name:'Refresh payment status',exact:true}).click();
 await checkFeedback.getByText('Payment received',{exact:true}).waitFor();
 await checkFeedback.getByText(/Checked at /).waitFor();
 assert.equal(await checkFeedback.getByText('Couldn’t check payment',{exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Continue payment',exact:true}).count(),0);
 await page.screenshot({path:'artifacts/g2/paid-purchase-desktop.png',fullPage:true,animations:'disabled'});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:950});await page.screenshot({path:`artifacts/g2/paid-purchase-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'No overflow at '+width);
  const boxes=await page.locator('.g2-purchase__actions--documents > button, .g2-purchase__actions--documents > a').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height};}));
  assert.ok(boxes.every(box=>box.height>=44&&Math.abs(box.x-boxes[0].x)<1&&Math.abs(box.width-boxes[0].width)<1),'Mobile document actions have aligned, full-width touch targets');
 }
 await page.route('**/fonts/noto-sans/NotoSans-Regular.ttf',route=>route.fulfill({status:503,body:'Unavailable'}));
 await page.goto(origin+'/?purchase_reference='+purchase.purchaseReference);
 await page.getByRole('heading',{name:'Payment received',exact:true}).waitFor();
 await page.getByRole('button',{name:'Download payment & estimate (PDF)',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'We couldn’t create the PDF.'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Download payment & estimate (PDF)',exact:true}).isEnabled(),true,'PDF errors leave downloading retryable');
 await page.unroute('**/fonts/noto-sans/NotoSans-Regular.ttf');
 const retryDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download payment & estimate (PDF)',exact:true}).click();
 assert.match((await retryDownload).suggestedFilename(),/\.pdf$/);
 assert.equal(await page.getByRole('alert').count(),0);
 mode='legacy-return';await page.goto(origin+'/?purchase_reference='+purchase.purchaseReference);
 await page.getByRole('heading',{name:'Payment received',exact:true}).waitFor();
 assert.equal(await page.getByText('Audit details',{exact:true}).count(),0,'Current offer terms are not retroactively attached to old saved purchases');
 assert.equal(await page.getByRole('link',{name:/View Stripe receipt/}).count(),1,'The legacy root URL still opens the payment status page');
 mode='return';
 outcome='failed';await page.goto(origin+'/?purchase_reference='+purchase.purchaseReference+'&checkout_result=cancelled');
 await page.getByRole('heading',{name:'Payment failed',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:/View Stripe receipt/}).count(),0);await page.getByRole('button',{name:'Continue payment',exact:true}).waitFor();
 assert.ok((await page.getByRole('region',{name:'Audit payment'}).innerText()).includes('Your answers are saved'));
 outcome='processing';await page.goto(origin+'/?purchase_reference='+purchase.purchaseReference);
 await page.getByRole('heading',{name:'Payment processing',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:/View Stripe receipt/}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Continue payment',exact:true}).count(),0);
 outcome='incomplete';await page.goto(origin+'/payment/status?purchase_reference='+purchase.purchaseReference+'&checkout_result=cancelled');
 await page.getByRole('heading',{name:'Checkout not completed',exact:true}).waitFor();
 await page.getByRole('button',{name:'Continue payment',exact:true}).waitFor();
 await page.emulateMedia({reducedMotion:'reduce'});
 refreshDelay=600;
 await page.getByRole('button',{name:'Refresh payment status',exact:true}).click();
 await checkFeedback.getByText('Checking with Stripe…',{exact:true}).waitFor();
 assert.equal(await checkFeedback.locator('.g2-purchase__check-icon').evaluate(icon=>getComputedStyle(icon,'::before').animationName),'none');
 await checkFeedback.getByText('Checkout not completed',{exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:/View Stripe receipt/}).count(),0);
 refreshDelay=0;
 await page.emulateMedia({reducedMotion:'no-preference'});
 const beforeRetry=calls;
 await page.getByRole('button',{name:'Continue payment',exact:true}).click();
 await page.getByRole('button',{name:'Continue payment',exact:true}).waitFor();
 assert.equal(calls,beforeRetry+1,'Retry uses the existing saved submission');
 // A stale link cannot expose another session's purchase or silently start a new payment.
 for(const failure of ['missing-return','invalid-return','expired-session']){
  mode=failure;const before=calls;
  await page.goto(origin+'/payment/status?purchase_reference='+randomUUID()+'&checkout_result=success&keep=example#estimate');
  await page.getByText('This payment link is not available in this session.',{exact:true}).waitFor();
  assert.ok(new URL(page.url()).searchParams.has('purchase_reference'),'The old link is retained until the user chooses recovery');
  assert.equal(await page.getByText(/Checkout is unavailable right now/).count(),0,'Missing ownership is not a checkout configuration failure');
  assert.equal(await page.getByRole('link',{name:/View Stripe receipt/}).count(),0);
  assert.ok((await page.getByRole('region',{name:'Audit payment'}).innerText()).includes('share your Stripe receipt with AOC'));
  await page.getByRole('link',{name:'Back to calculator',exact:true}).click();
  await page.getByRole('button',{name:'Review audit payment',exact:true}).waitFor();
  const clean=new URL(page.url());assert.equal(clean.searchParams.has('purchase_reference'),false);assert.equal(clean.searchParams.has('checkout_result'),false);
  assert.equal(clean.searchParams.get('keep'),'example');assert.equal(clean.hash,'#estimate');
  assert.equal(await page.getByText('This payment link is not available in this session.',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Review audit payment',exact:true}).click();
  assert.equal(await page.getByRole('checkbox',{name:/Save my answers and work description/}).isChecked(),false);
  assert.equal(await page.getByRole('button',{name:'Continue to Stripe',exact:true}).isDisabled(),true);
  await page.getByText('Your work description',{exact:true}).click();
  assert.equal(await page.getByText(description,{exact:true}).isVisible(),true,'Current answers and description are preserved');
  assert.equal(calls,before,'Recovery makes no payment request');
 }
 mode='temporary-error';await page.goto(origin+'/?purchase_reference='+purchase.purchaseReference);
 await page.getByRole('button',{name:'Refresh payment status',exact:true}).waitFor();
 assert.ok(new URL(page.url()).searchParams.has('purchase_reference'),'A temporary failure does not discard a valid payment link');
 assert.equal(await page.getByText('This payment link is not available in this session.',{exact:true}).count(),0);
 mode='return';outcome='paid';await page.getByRole('button',{name:'Refresh payment status',exact:true}).click();
 await page.getByRole('heading',{name:'Payment received',exact:true}).waitFor();
 mode='no-quote';await page.goto(origin);await page.getByText(/Add the audit fee quoted by AOC/).waitFor();
 assert.equal(await page.getByRole('button',{name:'Review audit payment',exact:true}).isDisabled(),true);
 mode='setup';await page.goto(origin);await page.getByText(/Checkout is unavailable right now/).waitFor();
 await page.goto(origin+'/payment/status');
 await page.getByText('Use the link from your checkout to see your payment details.',{exact:true}).waitFor();
 mode='disabled';await page.goto(origin+'/payment/status?purchase_reference='+purchase.purchaseReference);
 await page.getByText('Payment status is unavailable in this preview.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Continue payment',exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: G2 review consent, standalone payment routes and legacy links, pending-to-paid polling, retry and receipt, immutable PDF, refresh feedback, desktop/mobile, private/expired-link recovery and disabled/setup states. Fixture APIs only; no Stripe purchase or database writes.');
}finally{await browser?.close();await server?.close();}
