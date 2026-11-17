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

const {area,process_confirmed,management,...answers}=fixture;
const result=Calculation.calculate({area,confirmed:true,answers}).result;
const description='Prepare invoice drafts in Wave. Staff review every invoice. These are the final manually corrected words.';
const purchase={testMode:true,submissionReference:randomUUID(),recordingReference:randomUUID(),purchaseReference:randomUUID(),
 auditIntakeReference:null,outcome:'pending',amount:10000,currency:'usd',item:'Initial audit — G2 test',receiptUrl:null,
 snapshot:{area,description,answers,result,calculatorVersion:'synthetic-ui-fixture',savedAt:'2026-11-17T10:00:00Z'}};
let mode='review',outcome='pending',calls=0,server,browser;
const errors=[];
try{
 server=await createServer({configFile:false,root:process.cwd(),envDir:path.resolve('tests/fixtures'),logLevel:'silent',
  plugins:[react(),{name:'g2-ui-fixture',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
   const url=new URL(req.url,'http://fixture');
   const respond=body=>res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify(body));
   if(url.pathname==='/'){
    const html=await vite.transformIndexHtml(req.url,`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>
      <script src="/engine.js"></script><script src="/approved-pricing.js"></script><script src="/approved-bank.js"></script>
      <script src="/commercial.js"></script><script src="/journey-engine.js"></script>
      <script type="module" src="/tests/fixtures/g2-purchase-ui.jsx"></script></html>`);
    res.writeHead(200,{'content-type':'text/html'}).end(html);return;
   }
   if(url.pathname==='/__g2_fixture'){respond({state:{area,answers,description,confirmed:true,dirty:false,result,calculationSource:'server'}});return;}
   if(url.pathname==='/api/payments/status'){
    if(mode==='disabled'){respond({enabled:false});return;}
    if(mode==='setup'){respond({enabled:true,configured:false});return;}
    respond(mode==='review'?{enabled:true,configured:true,offer:{amount:10000,name:purchase.item}}:
      {enabled:true,configured:true,purchase:{...purchase,outcome,auditIntakeReference:outcome==='paid'?'synthetic-intake-reference':null,
        paidAt:outcome==='paid'?'2026-11-17T10:01:00Z':null,receiptUrl:outcome==='paid'?'https://pay.stripe.com/receipts/payment/fixture':null}});return;
   }
   if(url.pathname==='/api/payments/checkout'){
    let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);assert.equal(body.consent,true);
    if(!body.submissionReference){assert.equal(body.description,description);assert.equal(body.calculation.answers.implementation_fee,11500);}
    calls++;respond({purchase:{...purchase,outcome}});return;
   }
   next();
  });}}],server:{host:'127.0.0.1',port:0,strictPort:true,fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/artifacts/**']}}});
 await server.listen();const origin='http://127.0.0.1:'+server.httpServer.address().port;
 const executablePath=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
 assert.ok(executablePath,'Set CHROME_PATH to run the G2 browser check.');
 browser=await chromium.launch({executablePath,headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await page.getByRole('button',{name:'Review test purchase',exact:true}).click();
 const pay=page.getByRole('button',{name:'Continue to Stripe test checkout',exact:true});
 assert.equal(await pay.isDisabled(),true);
 await page.getByRole('checkbox',{name:/Save this reviewed submission/}).check();assert.equal(await pay.isEnabled(),true);
 await pay.click();await page.getByRole('heading',{name:'Payment not confirmed'}).waitFor();
 assert.equal(calls,1);assert.equal(await page.getByRole('link',{name:/View Stripe/}).count(),0);
 await page.getByText('Estimate attached to this purchase',{exact:true}).click();
 assert.equal(await page.getByText(description,{exact:true}).count(),1);
 assert.equal(await page.getByText('Not created',{exact:true}).count(),1);
 mode='return';outcome='paid';await page.goto(origin+'/?purchase_reference='+purchase.purchaseReference+'&checkout_result=success');
 await page.getByRole('heading',{name:'Test payment confirmed',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:/View Stripe test receipt/}).getAttribute('href'),'https://pay.stripe.com/receipts/payment/fixture');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Download purchase and estimate details/}).click();
 const download=await downloadPromise;const text=await readFile(await download.path(),'utf8');
 for(const expected of [description,purchase.submissionReference,purchase.recordingReference,purchase.purchaseReference,'not necessarily cash savings'])assert.ok(text.includes(expected));
 assert.equal(await page.getByRole('button',{name:'Continue test payment',exact:true}).count(),0);
 await mkdir('artifacts/g2',{recursive:true});await page.screenshot({path:'artifacts/g2/paid-purchase-desktop.png',fullPage:true});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:950});await page.screenshot({path:`artifacts/g2/paid-purchase-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'No overflow at '+width);
 }
 outcome='failed';await page.goto(origin+'/?purchase_reference='+purchase.purchaseReference+'&checkout_result=cancelled');
 await page.getByRole('heading',{name:'Payment failed',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:/View Stripe/}).count(),0);await page.getByRole('button',{name:'Continue test payment',exact:true}).waitFor();
 mode='setup';await page.goto(origin);await page.getByText(/Stripe test setup is required/).waitFor();
 mode='disabled';await page.goto(origin+'/?purchase_reference='+purchase.purchaseReference);
 await page.waitForTimeout(250);assert.equal(await page.getByRole('region',{name:'G2 test purchase'}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: G2 review consent, corrected description, pending/failed outcomes, confirmed receipt, immutable summary download, 1440/390/320 layout and disabled/setup states. Component fixture APIs only; no Stripe purchase or database writes.');
}finally{await browser?.close();await server?.close();}
