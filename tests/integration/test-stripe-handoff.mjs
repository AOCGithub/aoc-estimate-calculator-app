import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir,rm } from 'node:fs/promises';
import path from 'node:path';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import fixture from '../fixtures/commercial.cjs';
import Calculation from '../../public/journey-calculation.js';
import { createHandoffStore } from '../../server/payments/handoff-store.mjs';
import { createG2Payments,handleG2Payment } from '../../server/payments/stripe-handoff.mjs';
import { handleAccessVerification } from '../../server/api-handlers.mjs';
import { auditService } from '../../server/payments/audit-service.mjs';
import { createPaymentEmailSender } from '../../server/payments/payment-email.mjs';

const origin='http://localhost:5173';
const env={AOC_STRIPE_TEST_HANDOFF_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_synthetic_fixture_not_a_real_key',
  STRIPE_WEBHOOK_SECRET:'whsec_'+('s'.repeat(40)),
  AOC_ACCESS_GATE_ENABLED:'true',AOC_INTAKE_ONLY_ENABLED:'true',AOC_ACCESS_SESSION_SECRET:'g2-access-fixture-'.repeat(4),
  AOC_ACCESS_REQUESTS_ENABLED:'false',AOC_ESTIMATE_RECORDS_ENABLED:'false',AOC_RECAPTCHA_ENABLED:'false'};
const profile={name:'Synthetic G2 Tester',company:'Synthetic G2 Company',website:'example.com',role:'Tester',businessEmail:'g2@example.com'};
const {area,process_confirmed,management,...answers}=fixture;
const payload=()=>({requestReference:randomUUID(),consent:true,description:'Prepare invoice drafts in Wave. Staff check and approve every invoice. This text includes my manual correction.',
  calculation:{area,confirmed:process_confirmed,answers:{...answers}},profile});
const request=(route,{method='GET',body,cookie,headers={}}={})=>new Request(origin+route,{method,
  headers:{...(body===undefined?{}:{'content-type':'application/json',origin}),...(cookie?{cookie}:{}),...headers},
  ...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
async function cookie(){
  const response=await handleAccessVerification(request('/api/access/verify',{method:'POST',body:{...profile,saveData:false}}),env);
  assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];
}
function stripeFixture(){
 const sessions=new Map(),byKey=new Map();let serial=0;const calls={create:0,retrieve:0};
 const stripe={webhooks:Stripe.webhooks,
  checkout:{sessions:{
   async create(params,options){
    calls.create++;assert.equal(params.payment_intent_data.metadata.recording_reference,params.metadata.recording_reference);
    assert.equal(params.line_items[0].price,undefined);
    assert.equal(params.line_items[0].price_data.currency,'usd');
    assert.equal(params.line_items[0].price_data.product_data.description,auditService.description);
    assert.equal(params.payment_method_types,undefined);assert.deepEqual(params.allowed_payment_method_types,['card']);
    for(const [value,outcome] of [[params.success_url,'success'],[params.cancel_url,'cancelled']]){
     const redirect=new URL(value);
     assert.equal(redirect.origin,origin);assert.equal(redirect.pathname,'/payment/status');
     assert.equal(redirect.searchParams.get('purchase_reference'),params.metadata.purchase_reference);
     assert.equal(redirect.searchParams.get('checkout_result'),outcome);
    }
    if(byKey.has(options.idempotencyKey))return structuredClone(byKey.get(options.idempotencyKey));
    const id='cs_test_fixture_'+(++serial),session={id,livemode:false,mode:'payment',metadata:params.metadata,
     client_reference_id:params.client_reference_id,amount_total:params.line_items[0].price_data.unit_amount,currency:'usd',url:'https://checkout.stripe.com/c/pay/'+id,
     status:'open',payment_status:'unpaid',line_items:{data:[{price:{id:'price_fixture_'+serial,livemode:false,type:'one_time',currency:'usd',unit_amount:params.line_items[0].price_data.unit_amount},quantity:1,amount_total:params.line_items[0].price_data.unit_amount,description:params.line_items[0].price_data.product_data.name}]},
     payment_intent:{id:'pi_fixture_'+serial,latest_charge:null}};
    sessions.set(id,session);byKey.set(options.idempotencyKey,session);return structuredClone(session);
   },
   async retrieve(id){calls.retrieve++;if(!sessions.has(id))throw new Error('fixture_session_missing');return structuredClone(sessions.get(id));},
  }}};
 return {stripe,sessions,calls};
}
const auth=await cookie(),otherAuth=await cookie();
const store=createHandoffStore(':memory:');
const provider=stripeFixture();
const api=createG2Payments({environment:env,store,stripe:provider.stripe});
const send=(route,options={})=>api.handle(request(route,{cookie:auth,...options}));
let eventCounter=0;
async function event(purchase,{type='checkout.session.completed',id,outcome='paid',change=()=>{},timestamp,handler=api}={}){
 const session=provider.sessions.get(purchase.stripeCheckoutReference);
 if(outcome==='paid')Object.assign(session,{status:'complete',payment_status:'paid',payment_intent:{...session.payment_intent,latest_charge:{receipt_url:'https://pay.stripe.com/receipts/payment/fixture'}}});
 if(outcome==='processing')Object.assign(session,{status:'complete',payment_status:'unpaid'});
 if(outcome==='failed')Object.assign(session,{status:'open',payment_status:'unpaid'});
 if(outcome==='incomplete')Object.assign(session,{status:'expired',payment_status:'unpaid'});
 const object=type.startsWith('payment_intent.')?{id:session.payment_intent.id,livemode:false,metadata:session.metadata}:structuredClone(session);
 const value={id:id||'evt_fixture_'+(++eventCounter),livemode:false,type,data:{object}};change(value,session);
 const body=JSON.stringify(value),signature=Stripe.webhooks.generateTestHeaderString({payload:body,secret:env.STRIPE_WEBHOOK_SECRET,...(timestamp?{timestamp}:{})});
 return handler.handle(request('/api/payments/webhook',{method:'POST',body,headers:{'stripe-signature':signature}}));
}
async function requestQuote(body=payload(),handler=api,cookieValue=auth){
 const response=await handler.handle(request('/api/payments/quote-request',{method:'POST',body,cookie:cookieValue}));
 assert.equal(response.status,200,await response.clone().text());return (await response.json()).quoteRequest;
}
const acceptedCheckout = quote => ({consent:true,purchaseAgreement:true,
 submissionReference:quote.submissionReference,orderReference:quote.order.reference,orderVersion:quote.order.version,
 orderFingerprint:quote.order.fingerprint});
const acceptedRetry = purchase => ({consent:true,purchaseAgreement:true,
 submissionReference:purchase.submissionReference,orderReference:purchase.acceptedOrder.reference,
 orderVersion:purchase.acceptedOrder.version,orderFingerprint:purchase.acceptedOrder.fingerprint});
async function start(body=payload()){
 const requested=await requestQuote(body);
 const response=await send('/api/payments/checkout',{method:'POST',body:acceptedCheckout(requested)});assert.equal(response.status,200,await response.clone().text());
 const result=await response.json();assert.ok(result.checkoutUrl.startsWith('https://checkout.stripe.com/'));return {body,purchase:result.purchase};
}
const checks=[];
async function check(name,run){await run();checks.push(name);}
try{
 await check('Disabled by default and hosted mode requires the exact HTTPS origin and sandbox settings',async()=>{
  for(const [environment,url]of [[{},origin],[{...env,VERCEL:'1'},origin],[env,'https://production.example']]){
   const response=await handleG2Payment(new Request(url+'/api/payments/status'),environment);assert.equal((await response.json()).enabled,false);
  }
  const hostedOrigin='https://estimate.example';
  const hosted={...env,VERCEL:'1',AOC_G2_HOSTED_ORIGIN:hostedOrigin};
  for(const url of ['https://preview.example','http://estimate.example',origin]){
   const result=await handleG2Payment(new Request(url+'/api/payments/status'),hosted);
   assert.equal((await result.json()).enabled,false);
  }
  const missingDatabase=await handleG2Payment(new Request(hostedOrigin+'/api/payments/status'),hosted);
  assert.deepEqual(await missingDatabase.json(),{enabled:true,configured:false,settings:{testKey:true,webhook:true,storage:false}});
  const badKey=await handleG2Payment(new Request(hostedOrigin+'/api/payments/webhook',{method:'POST'}),
   {...hosted,POSTGRES_URL:'postgres://unused.invalid/g2',STRIPE_SECRET_KEY:'sk_live_fixture'});
  assert.equal(badKey.status,503);
 });
 await check('Test configuration status exposes no credentials',async()=>{
  const body=await (await send('/api/payments/status')).json();assert.equal(body.configured,true);assert.equal(body.pricing,'project_total_15_percent');assert.equal(body.auditRate,.15);assert.equal(body.offer,undefined);
  assert.deepEqual(body.service,auditService);
  assert.equal(JSON.stringify(body).includes(env.STRIPE_SECRET_KEY),false);assert.equal(JSON.stringify(body).includes(env.STRIPE_WEBHOOK_SECRET),false);
  const live=await handleG2Payment(request('/api/payments/status'),{...env,STRIPE_SECRET_KEY:'sk_live_synthetic_rejected'});
  assert.equal((await live.json()).configured,false);
 });
 await check('Access, origin, consent, missing description, blocked scope and client price overrides are rejected',async()=>{
  assert.equal((await api.handle(request('/api/payments/quote-request',{method:'POST',body:payload()}))).status,401);
  assert.equal((await send('/api/payments/quote-request',{method:'POST',body:payload(),headers:{origin:'https://elsewhere.example'}})).status,403);
  for(const change of [p=>p.consent=false,p=>p.description='',p=>p.amount=1,p=>p.service={refund:'Unconditional refund'},p=>p.calculation.confirmed=false,p=>p.calculation.answers.legacy_system_check='Restricted',p=>p.calculation.answers.implementation_fee=11500,p=>p.calculation.answers.steps_band=5,p=>p.calculation=null]){
   const p=payload();change(p);assert.equal((await send('/api/payments/quote-request',{method:'POST',body:p})).status,400);
  }
  assert.equal(store.counts().submissions,0);
 });
 await check('The server calculates and locks the audit at 15% of the project estimate',async()=>{
  const isolatedStore=createHandoffStore(':memory:');
  try{
   const isolatedApi=createG2Payments({environment:env,store:isolatedStore,stripe:provider.stripe});
   const body=payload(),expected=Calculation.calculate(body.calculation).result;
   const quoted=await requestQuote(body,isolatedApi);
   assert.equal(quoted.status,'quoted');assert.equal(quoted.amount,Math.round(expected.audit*100));assert.equal(quoted.calculated,true);
   assert.equal(isolatedStore.counts().quotes,1);assert.equal(isolatedStore.counts().purchases,0);
   const staleCheckout=await isolatedApi.handle(request('/api/payments/checkout',{method:'POST',cookie:auth,
    body:{consent:true,submissionReference:quoted.submissionReference}}));
   assert.equal(staleCheckout.status,409,'an older checkout page receives a refresh instruction');
   assert.match((await staleCheckout.json()).error,/out of date.*Refresh/i);
   for(const purchaseAgreement of [false,'true']){
    const rejectedAgreement=await isolatedApi.handle(request('/api/payments/checkout',{method:'POST',cookie:auth,
     body:{...acceptedCheckout(quoted),purchaseAgreement}}));
    assert.equal(rejectedAgreement.status,400,'checkout requires an explicit purchase agreement');
   }
   const wrongOrder=await isolatedApi.handle(request('/api/payments/checkout',{method:'POST',cookie:auth,
    body:{...acceptedCheckout(quoted),orderReference:'C10-wrong'}}));
   assert.equal(wrongOrder.status,409,'checkout requires the exact displayed C10 reference and version');
   assert.equal(isolatedStore.counts().purchases,0);
   isolatedStore.approveQuote({submissionReference:quoted.submissionReference,amount:1,quotedBy:'tamper@example.com'});
   const rejected=await isolatedApi.handle(request('/api/payments/checkout',{method:'POST',cookie:auth,
    body:acceptedCheckout(quoted)}));
   assert.equal(rejected.status,409,'a manual or stale amount cannot replace the calculated audit fee');
  }finally{isolatedStore.close();}
 });
 const initial=await start();
 await check('Submission and reviewed text receive separate stable references; calculation is recomputed',async()=>{
  assert.notEqual(initial.purchase.submissionReference,initial.purchase.recordingReference);
  assert.equal(initial.purchase.snapshot.description,initial.body.description);
  assert.deepEqual(initial.purchase.snapshot.answers,initial.body.calculation.answers);
  assert.equal(initial.purchase.snapshot.result.build,Calculation.calculate(initial.body.calculation).result.build);
  assert.equal(initial.purchase.amount,Math.round(initial.purchase.snapshot.result.audit*100));
  assert.equal(initial.purchase.purchaseAgreementVersion,auditService.purchaseAgreement.version);
  assert.ok(Number.isFinite(Date.parse(initial.purchase.purchaseAgreedAt)));
  assert.equal(initial.purchase.acceptedOrder.documentType,'C10');
  assert.equal(initial.purchase.acceptedOrder.reference,(await (await send('/api/payments/status?submission_reference='+initial.purchase.submissionReference)).json()).quoteRequest.order.reference);
  assert.equal(initial.purchase.acceptedOrder.price.amount,initial.purchase.amount);
  assert.equal(initial.purchase.acceptedOrder.price.tax,'No separate tax amount is added at checkout.');
  assert.equal(initial.purchase.acceptedOrder.project.sourceDescription,initial.body.description);
  assert.equal(initial.purchase.acceptedOrder.project.agreedProcess,'Prepare invoice drafts in Wave.');
  assert.match(initial.purchase.acceptedOrder.project.businessGoal,/Optimize the agreed finance & billing process/i);
  assert.equal(initial.purchase.acceptedOrder.acceptance.acceptedAt,initial.purchase.purchaseAgreedAt);
  assert.equal(store.purchase(initial.purchase.purchaseReference).purchase_agreement_version,auditService.purchaseAgreement.version);
  assert.equal(provider.sessions.get(initial.purchase.stripeCheckoutReference).metadata.agreement_version,
   auditService.purchaseAgreement.version);
  assert.equal(provider.sessions.get(initial.purchase.stripeCheckoutReference).metadata.order_reference,
   initial.purchase.acceptedOrder.reference);
  assert.equal(provider.sessions.get(initial.purchase.stripeCheckoutReference).metadata.order_version,
   initial.purchase.acceptedOrder.version);
  assert.equal(provider.sessions.get(initial.purchase.stripeCheckoutReference).metadata.order_fingerprint,
   initial.purchase.acceptedOrder.fingerprint);
  assert.deepEqual(initial.purchase.snapshot.service,auditService);
  assert.equal(initial.purchase.outcome,'pending');assert.equal(initial.purchase.auditIntakeReference,null);assert.equal(initial.purchase.receiptUrl,null);
  const quote=(await (await send('/api/payments/status?submission_reference='+initial.purchase.submissionReference)).json()).quoteRequest;
  assert.equal(quote.amount,initial.purchase.amount);assert.equal(quote.calculated,true);assert.equal(quote.scope.description,initial.body.description);
  assert.throws(()=>store.approveQuote({submissionReference:initial.purchase.submissionReference,amount:1,quotedBy:'tamper@example.com'}),/quote_locked/);
 });
 await check('Duplicate checkout requests reuse the purchase and Stripe idempotency key',async()=>{
  const checkoutBody={consent:true,purchaseAgreement:true,submissionReference:initial.purchase.submissionReference,
    orderReference:initial.purchase.acceptedOrder.reference,orderVersion:initial.purchase.acceptedOrder.version,
    orderFingerprint:initial.purchase.acceptedOrder.fingerprint};
  const results=await Promise.all([send('/api/payments/checkout',{method:'POST',body:checkoutBody}),send('/api/payments/checkout',{method:'POST',body:checkoutBody})]);
  for(const r of results)assert.equal((await r.json()).purchase.purchaseReference,initial.purchase.purchaseReference);
  assert.equal(store.counts().purchases,1);
 });
 await check('Manual corrections cannot silently overwrite a saved purchase snapshot',async()=>{
  const changed=structuredClone(initial.body);changed.description+=' Changed after starting checkout.';
  assert.equal((await send('/api/payments/quote-request',{method:'POST',body:changed})).status,409);
  assert.equal(store.submission(initial.purchase.submissionReference).description,initial.body.description);
 });
 await check('A different session cannot read or retry another purchase',async()=>{
  assert.equal((await send('/api/payments/status?purchase_reference='+initial.purchase.purchaseReference,{cookie:otherAuth})).status,404);
  assert.equal((await send('/api/payments/checkout',{method:'POST',cookie:otherAuth,body:acceptedRetry(initial.purchase)})).status,404);
 });
 await check('Browser success URL alone does not create a paid intake',async()=>{
  const result=await send('/api/payments/status?purchase_reference='+initial.purchase.purchaseReference+'&checkout_result=success');
  assert.equal((await result.json()).purchase.outcome,'pending');assert.equal(store.counts().auditIntakes,0);
 });
 await check('Unsigned, tampered, stale-signature and live-mode notifications are rejected',async()=>{
  assert.equal((await send('/api/payments/webhook',{method:'POST',body:'{}'})).status,400);
  const raw=JSON.stringify({id:'evt_tampered',livemode:false,type:'checkout.session.completed',data:{object:{}}});
  const signature=Stripe.webhooks.generateTestHeaderString({payload:raw,secret:env.STRIPE_WEBHOOK_SECRET});
  assert.equal((await send('/api/payments/webhook',{method:'POST',body:raw+' ',headers:{'stripe-signature':signature}})).status,400);
  assert.equal((await event(initial.purchase,{timestamp:Math.floor(Date.now()/1000)-500})).status,400);
  assert.equal((await event(initial.purchase,{change:e=>e.livemode=true})).status,400);
  assert.equal((await event(initial.purchase,{change:e=>e.data.object.livemode=true})).status,400);
  assert.equal(store.counts().events,0);
 });
 await check('Reference, amount and currency mismatches cannot create an intake',async()=>{
  const original=structuredClone(provider.sessions.get(initial.purchase.stripeCheckoutReference));
  for(const change of [(e,s)=>s.amount_total=1,(e,s)=>s.currency='eur',(e,s)=>e.data.object.metadata.recording_reference=randomUUID(),
    (e,s)=>s.line_items.data[0].price.unit_amount=1,(e,s)=>s.line_items.data[0].price.id='price_wrong',
    (e,s)=>s.line_items.data[0].description='Unrelated purchase']){
   provider.sessions.set(original.id,structuredClone(original));
   const result=await event(initial.purchase,{change});assert.equal(result.status,400);
  }
  provider.sessions.set(original.id,original);
  assert.equal(store.counts().auditIntakes,0);
 });
 await check('Completed but unpaid remains processing, with no receipt or paid intake',async()=>{
  const response=await event(initial.purchase,{outcome:'processing'});assert.equal(response.status,200);
  assert.equal((await response.json()).outcome,'processing');assert.equal(store.counts().auditIntakes,0);
 });
 let intakeReference;
 await check('Confirmed payment creates one audit intake and exposes a valid Stripe receipt',async()=>{
  const response=await event(initial.purchase,{type:'checkout.session.async_payment_succeeded',id:'evt_confirmed_once'});assert.equal(response.status,200);
  const outcome=await response.json();intakeReference=outcome.auditIntakeReference;assert.ok(intakeReference);
  assert.equal(store.counts().auditIntakes,1);
  const details=(await (await send('/api/payments/status?purchase_reference='+initial.purchase.purchaseReference)).json()).purchase;
  assert.equal(details.receiptUrl,'https://pay.stripe.com/receipts/payment/fixture');assert.ok(details.paidAt);
 });
 await check('Repeated and concurrent events keep the same single audit intake',async()=>{
  const responses=await Promise.all([
   event(initial.purchase,{type:'checkout.session.async_payment_succeeded',id:'evt_confirmed_once'}),
   event(initial.purchase,{id:'evt_second_object_notification'}),event(initial.purchase,{id:'evt_second_object_notification'})]);
  for(const response of responses)assert.equal((await response.json()).auditIntakeReference,intakeReference);
  assert.equal(store.counts().auditIntakes,1);
 });
 await check('Late failures cannot downgrade a payment confirmed by current Stripe state',async()=>{
  const response=await event(initial.purchase,{type:'payment_intent.payment_failed'});
  assert.equal((await response.json()).outcome,'paid');assert.equal(store.counts().auditIntakes,1);
 });
 const failed=await start();
 await check('Card failure records an unsuccessful outcome with no paid intake; retry retains both references',async()=>{
  const before=store.counts().auditIntakes;
  const response=await event(failed.purchase,{type:'payment_intent.payment_failed',outcome:'failed'});
  assert.equal((await response.json()).outcome,'failed');assert.equal(store.counts().auditIntakes,before);
  const retry=await (await send('/api/payments/checkout',{method:'POST',body:{consent:true,purchaseAgreement:true,
    submissionReference:failed.purchase.submissionReference,orderReference:failed.purchase.acceptedOrder.reference,
    orderVersion:failed.purchase.acceptedOrder.version,orderFingerprint:failed.purchase.acceptedOrder.fingerprint}})).json();
  assert.equal(retry.purchase.purchaseReference,failed.purchase.purchaseReference);
  assert.equal(retry.purchase.recordingReference,failed.purchase.recordingReference);
 });
 const expired=await start();
 await check('Expired checkout creates no intake; a new attempt keeps the original submission and recording',async()=>{
  assert.equal((await event(expired.purchase,{type:'checkout.session.expired',outcome:'incomplete'})).status,200);
  const retry=await (await send('/api/payments/checkout',{method:'POST',body:{consent:true,purchaseAgreement:true,
    submissionReference:expired.purchase.submissionReference,orderReference:expired.purchase.acceptedOrder.reference,
    orderVersion:expired.purchase.acceptedOrder.version,orderFingerprint:expired.purchase.acceptedOrder.fingerprint}})).json();
  assert.notEqual(retry.purchase.purchaseReference,expired.purchase.purchaseReference);
  assert.equal(retry.purchase.submissionReference,expired.purchase.submissionReference);
  assert.equal(retry.purchase.recordingReference,expired.purchase.recordingReference);
 });
 await check('A transaction failure rolls back the event insert and intake update',async()=>{
  const before=store.counts();
  assert.throws(()=>store.applyEvent({eventId:'evt_rollback',type:'test',objectId:'cs_test_rollback',purchaseId:failed.purchase.purchaseReference,
   sessionId:failed.purchase.stripeCheckoutReference,outcome:'not_a_valid_state',checkoutState:'open'}));
  assert.deepEqual(store.counts(),before);
 });
 await check('Webhook persistence failures return a retryable status; no false success',async()=>{
  const broken=createG2Payments({environment:env,store:{...store,applyEvent(){throw new Error('synthetic_disk_failure');}},stripe:provider.stripe});
  const session=provider.sessions.get(failed.purchase.stripeCheckoutReference);session.payment_status='paid';session.status='complete';
  const body=JSON.stringify({id:'evt_retry_after_storage_failure',livemode:false,type:'checkout.session.completed',data:{object:session}});
  const signature=Stripe.webhooks.generateTestHeaderString({payload:body,secret:env.STRIPE_WEBHOOK_SECRET});
  const req=()=>request('/api/payments/webhook',{method:'POST',body,headers:{'stripe-signature':signature}});
  assert.equal((await broken.handle(req())).status,503);assert.equal((await api.handle(req())).status,200);
 });
 await check('Persisted replay protection and audit reference survive a database restart',async()=>{
  const root=path.resolve('artifacts/g2-tests');await mkdir(root,{recursive:true});const filename=path.join(root,randomUUID()+'.sqlite');
  let disk=createHandoffStore(filename);
  try{
   let handler=createG2Payments({environment:env,store:disk,stripe:provider.stripe});
   const body=payload(),requested=await requestQuote(body,handler);
   const created=await (await handler.handle(request('/api/payments/checkout',{method:'POST',body:acceptedCheckout(requested),cookie:auth}))).json();
   const p=created.purchase,s=provider.sessions.get(p.stripeCheckoutReference);s.status='complete';s.payment_status='paid';
   const eventBody=JSON.stringify({id:'evt_durable_replay',livemode:false,type:'checkout.session.completed',data:{object:s}});
   const headers={'stripe-signature':Stripe.webhooks.generateTestHeaderString({payload:eventBody,secret:env.STRIPE_WEBHOOK_SECRET})};
   const first=await (await handler.handle(request('/api/payments/webhook',{method:'POST',body:eventBody,headers}))).json();disk.close();
   disk=createHandoffStore(filename);handler=createG2Payments({environment:env,store:disk,stripe:provider.stripe});
   const repeated=await (await handler.handle(request('/api/payments/webhook',{method:'POST',body:eventBody,headers}))).json();
   assert.equal(repeated.duplicate,true);assert.equal(repeated.auditIntakeReference,first.auditIntakeReference);
   assert.equal(disk.counts().auditIntakes,1);
  }finally{disk.close();assert.equal(path.dirname(filename),root);for(const suffix of ['','-wal','-shm'])await rm(filename+suffix,{force:true});}
 });
 await check('Simultaneous checkout requests create only one purchase and Stripe session for the approved quote',async()=>{
  const p=payload(),before=store.counts(),sessionsBefore=provider.sessions.size;
  const requested=await requestQuote(p);
  const checkoutBody=acceptedCheckout(requested);
  const responses=await Promise.all([send('/api/payments/checkout',{method:'POST',body:checkoutBody}),send('/api/payments/checkout',{method:'POST',body:checkoutBody})]);
  const bodies=await Promise.all(responses.map(async response=>{assert.equal(response.status,200);return response.json();}));
  assert.equal(bodies[0].purchase.purchaseReference,bodies[1].purchase.purchaseReference);
  assert.equal(store.counts().submissions,before.submissions+1);assert.equal(store.counts().purchases,before.purchases+1);
  assert.equal(provider.sessions.size,sessionsBefore+1);
 });
 await check('Different reviewed scopes create matching 15% audit amounts without client price control',async()=>{
  for(const steps of [2,3]){
   const body=payload();body.calculation.answers.steps_band=steps;
   const expected=Calculation.calculate(body.calculation).result;
   const started=await start(body),purchase=started.purchase;
   const fee=Math.round(expected.audit*100);
   assert.equal(purchase.amount,fee);
   assert.equal(purchase.snapshot.result.build,expected.build);
   assert.equal(purchase.snapshot.result.auditRate,.15);
   const session=provider.sessions.get(purchase.stripeCheckoutReference);
   assert.equal(session.amount_total,fee);
   assert.equal(session.line_items.data[0].price.unit_amount,fee);
   session.status='expired';await event(purchase,{type:'checkout.session.expired',outcome:'incomplete'});
   const retry=await (await send('/api/payments/checkout',{method:'POST',body:{consent:true,purchaseAgreement:true,
    submissionReference:purchase.submissionReference,orderReference:purchase.acceptedOrder.reference,
    orderVersion:purchase.acceptedOrder.version,orderFingerprint:purchase.acceptedOrder.fingerprint}})).json();
   assert.equal(retry.purchase.amount,fee);assert.equal(retry.purchase.recordingReference,purchase.recordingReference);
  }
 });
 await check('Explicit refresh verifies Stripe, recovers a missed paid webhook and shares its single intake with later events',async()=>{
  const {purchase}=await start(),before=store.counts();
  const session=provider.sessions.get(purchase.stripeCheckoutReference);
  Object.assign(session,{status:'complete',payment_status:'paid',payment_intent:{...session.payment_intent,latest_charge:{receipt_url:'https://pay.stripe.com/receipts/payment/fixture'}}});
  const cached=await (await send('/api/payments/status?purchase_reference='+purchase.purchaseReference)).json();
  assert.equal(cached.purchase.outcome,'pending');
  const responses=await Promise.all([1,2].map(()=>send('/api/payments/status?purchase_reference='+purchase.purchaseReference+'&refresh=true')));
  const bodies=await Promise.all(responses.map(async r=>{assert.equal(r.status,200);return r.json();}));
  assert.equal(bodies[0].purchase.outcome,'paid');assert.ok(Date.parse(bodies[0].checkedAt));
  assert.equal(bodies[0].purchase.receiptUrl,'https://pay.stripe.com/receipts/payment/fixture');
  assert.equal(bodies[0].purchase.auditIntakeReference,bodies[1].purchase.auditIntakeReference);
  assert.equal(store.counts().auditIntakes,before.auditIntakes+1);assert.equal(store.counts().events,before.events);
  const later=await (await event(purchase)).json();assert.equal(later.auditIntakeReference,bodies[0].purchase.auditIntakeReference);
  assert.equal(store.counts().auditIntakes,before.auditIntakes+1);
  session.payment_status='unpaid';session.status='open';
  assert.equal((await (await send('/api/payments/status?purchase_reference='+purchase.purchaseReference+'&refresh=true')).json()).purchase.outcome,'paid');
 });
 await check('Refresh cannot bypass ownership, trust a success URL, accept mismatched amounts or hide a Stripe outage',async()=>{
  const {purchase}=await start(),route='/api/payments/status?purchase_reference='+purchase.purchaseReference+'&refresh=true';
  const retrieved=provider.calls.retrieve;
  assert.equal((await send(route,{cookie:otherAuth})).status,404);assert.equal(provider.calls.retrieve,retrieved);
  assert.equal((await (await send(route+'&checkout_result=success')).json()).purchase.outcome,'pending');
  const session=provider.sessions.get(purchase.stripeCheckoutReference),before=store.counts();session.amount_total=1;
  assert.equal((await send(route)).status,409);assert.deepEqual(store.counts(),before);
  session.amount_total=purchase.amount;
  const broken=createG2Payments({environment:env,store,stripe:{...provider.stripe,checkout:{sessions:{retrieve(){throw new Error('synthetic_outage');}}}}});
  const response=await broken.handle(request(route,{cookie:auth}));assert.equal(response.status,502);
  assert.match((await response.json()).error,/could not check Stripe/);
  assert.equal(store.purchase(purchase.purchaseReference).outcome,'pending');assert.deepEqual(store.counts(),before);
 });
 await check('Refresh distinguishes processing and expired unpaid sessions without creating a paid intake',async()=>{
  const {purchase}=await start(),session=provider.sessions.get(purchase.stripeCheckoutReference),before=store.counts();
  const route='/api/payments/status?purchase_reference='+purchase.purchaseReference+'&refresh=true';
  session.status='complete';session.payment_status='unpaid';
  assert.equal((await (await send(route)).json()).purchase.outcome,'processing');
  session.status='expired';
  assert.equal((await (await send(route)).json()).purchase.outcome,'incomplete');
  assert.equal(store.counts().auditIntakes,before.auditIntakes);assert.equal(store.counts().events,before.events);
 });
 await check('Paid webhooks send two messages with separate C10 and estimate PDFs, retrying only the failed recipient',async()=>{
  const attempts=[], messages=[];
  const mime=nodemailer.createTransport({streamTransport:true,buffer:true});
  const support='support@alwaysopencommerce.com',email='checkout-recipient@example.com';
  let supportBusy=true;
  const transport={async sendMail(message){
   attempts.push(message.to.address);
   if(message.to.address===support&&supportBusy){supportBusy=false;throw Object.assign(new Error('Synthetic SMTP response'),{responseCode:451});}
   const rendered=await mime.sendMail(message);
   assert.deepEqual(rendered.envelope.to,[message.to.address]);
   messages.push({message,mime:rendered.message});
   return {accepted:[message.to.address]};
  }};
  const notifyPaid=createPaymentEmailSender({store,transport,fromAddress:'audits@example.com'});
  const handler=createG2Payments({environment:{...env,AOC_G2_PAYMENT_EMAILS_ENABLED:'true'},store,stripe:provider.stripe,notifyPaid});
  const unpaid=await start();
  assert.equal((await event(unpaid.purchase,{handler,outcome:'incomplete',type:'checkout.session.expired'})).status,200);
  assert.deepEqual(attempts,[]);
  const {purchase}=await start({...payload(),description:'Review draft invoices.\n\n<script>Keep client wording as text.</script>'});
  const paidAt='2026-11-19T04:30:00.000Z';
  const change=(_,session)=>{
   session.customer_details={name:'Stripe Contact',email};
   session.payment_intent.latest_charge.created=Date.parse(paidAt)/1000;
  };
  const id='evt_email_retry_fixture';
  const first=await event(purchase,{handler,id,change});
  assert.equal(first.status,503);
  const saved=store.purchase(purchase.purchaseReference);
  assert.equal(saved.outcome,'paid');assert.equal(saved.paid_at,paidAt);
  const intake=store.submission(purchase.submissionReference).audit_intake_reference;
  assert.ok(intake);
  assert.equal((await event(purchase,{handler,id,change})).status,200);
  const replays=await Promise.all([event(purchase,{handler,id,change}),event(purchase,{handler,change})]);
  assert.ok(replays.every(response=>response.status===200));
  assert.equal(store.submission(purchase.submissionReference).audit_intake_reference,intake);
  assert.equal(attempts.filter(address=>address===support).length,2);
  assert.equal(attempts.filter(address=>address===email).length,1);
  assert.equal(messages.length,2);
  const client=messages.find(entry=>entry.message.to.address===email);
  assert.match(client.message.subject,/^\[Stripe test\]/);
  assert.match(client.message.text,/Hi Synthetic,/);
  const expectedEmailAmount=(purchase.amount/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  assert.match(client.message.text,new RegExp('USD\\s+'+expectedEmailAmount.replace('.','\\.')));
  assert.match(client.message.text,/Nov 19, 2026, 4:30 AM UTC/);
  assert.match(client.message.text,/What Happens Next\?/i);
  assert.match(client.message.text,/https:\/\/pay\.stripe\.com\/receipts\/payment\/fixture/);
  assert.ok(client.message.html.includes('&lt;script&gt;')&&!client.message.html.includes('<script>'));
  assert.match(client.message.html,/Review draft invoices\.<br\/?><br\/?>&lt;script&gt;/);
  assert.equal(client.message.attachments.length,2);
  assert.equal(client.message.attachments[0].content.subarray(0,5).toString(),'%PDF-');
  assert.ok(client.message.attachments[0].filename.includes(purchase.acceptedOrder.reference));
  assert.match(client.message.attachments[0].cid,/^aoc-c10-.+@alwaysopencommerce\.com$/);
  assert.ok(client.message.attachments[1].filename.includes(purchase.submissionReference));
  assert.match(client.message.attachments[1].cid,/^aoc-estimate-.+@alwaysopencommerce\.com$/);
  assert.ok(client.message.html.includes(`href="cid:${client.message.attachments[0].cid}"`));
  assert.ok(client.message.html.includes(`href="cid:${client.message.attachments[1].cid}"`));
  assert.match(client.message.html,/aria-label="Download Process Optimization and Solution Design Order PDF"/);
  assert.match(client.message.text,/Process Optimization & Solution Design Order/);
  assert.doesNotMatch(client.message.text,/Accepted C10 Order/);
  assert.match(client.message.html,/aria-label="Download estimate PDF"/);
  assert.ok(!client.message.text.includes('cid:'),'plain-text email hides the internal attachment identifier');
  assert.match(client.mime.toString(),/Content-Type: application\/pdf/);
  assert.match(client.mime.toString(),/Content-ID: <aoc-c10-.+@alwaysopencommerce\.com>/);
  assert.match(client.mime.toString(),/Content-ID: <aoc-estimate-.+@alwaysopencommerce\.com>/);
  assert.match(client.mime.toString(),/Content-Type: text\/plain/);
  const internal=messages.find(entry=>entry.message.to.address===support).message;
  assert.ok(internal.text.includes(intake)&&internal.text.includes(email));
  assert.equal(internal.attachments.length,2);
  assert.equal(internal.attachments[0].content.subarray(0,5).toString(),'%PDF-');
  assert.ok(internal.html.includes(`href="cid:${internal.attachments[0].cid}"`));
  assert.ok(!internal.text.includes('cid:'),'support plain-text email hides the internal attachment identifier');
  for(const {html} of [client.message,internal]){
   assert.doesNotMatch(html,/Accepted C10 Order/);
   assert.match(html,/href="https:\/\/alwaysopencommerce\.com\/about-us\/"[^>]*>About Us<\/a>/);
   assert.match(html,/href="https:\/\/alwaysopencommerce\.com\/contact-us\/"[^>]*>Contact Us<\/a>/);
   assert.match(html,/href="https:\/\/alwaysopencommerce\.com\/growth-services\/"[^>]*>Growth Services<\/a>/);
   assert.match(html,/<!--\[if mso\]><table[^>]+width="600"[^>]*><tr><td><!\[endif\]-->/);
   assert.match(html,/<!--\[if mso\]><\/td><\/tr><\/table><!\[endif\]-->/);
  }
 });
 await check('A late receipt can complete the client email and ambiguous SMTP acceptance is never retried automatically',async()=>{
  const attempts=[];
  const notifyPaid=createPaymentEmailSender({store,fromAddress:'audits@example.com',testClientAddress:'tester@example.com',
   transport:{async sendMail({to}){
    attempts.push(to.address);
    if(to.address==='tester@example.com')throw Object.assign(new Error('Synthetic lost SMTP connection'),{command:'DATA'});
    return {accepted:[to.address]};
   }}});
  const handler=createG2Payments({environment:{...env,AOC_G2_PAYMENT_EMAILS_ENABLED:'true'},store,stripe:provider.stripe,notifyPaid});
  const {purchase}=await start();
  const id='evt_late_receipt_fixture',email='synthetic-checkout@example.com';
  const setCustomer=(_,session)=>{session.customer_details={email};};
  const first=await event(purchase,{id,handler,change:(evt,session)=>{
   setCustomer(evt,session);delete session.payment_intent.latest_charge.receipt_url;
  }});
  assert.equal(first.status,503);
  assert.deepEqual(attempts,['support@alwaysopencommerce.com']);
  assert.equal((await event(purchase,{id,handler,change:setCustomer})).status,200);
  assert.equal((await event(purchase,{id,handler,change:setCustomer})).status,200);
  assert.deepEqual(attempts,['support@alwaysopencommerce.com','tester@example.com']);
  assert.ok(store.purchase(purchase.purchaseReference).receipt_url);
 });
 console.log('PASS: '+checks.length+' G2 checks: '+checks.join('; ')+'.');
 console.log('These are local database/HTTP-handler tests with signed fixtures and mocked Stripe API responses; no real Stripe purchase, Supabase write or email was made.');
}finally{store.close();}
