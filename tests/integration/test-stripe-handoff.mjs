import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir,rm } from 'node:fs/promises';
import path from 'node:path';
import Stripe from 'stripe';
import fixture from '../fixtures/commercial.cjs';
import { createHandoffStore } from '../../server/payments/handoff-store.mjs';
import { createG2Payments,handleG2Payment } from '../../server/payments/stripe-handoff.mjs';
import { handleAccessVerification } from '../../server/api-handlers.mjs';

const origin='http://localhost:5173';
const env={AOC_STRIPE_TEST_HANDOFF_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_synthetic_fixture_not_a_real_key',
  STRIPE_TEST_AUDIT_PRICE_ID:'price_g2_fixture',STRIPE_WEBHOOK_SECRET:'whsec_'+('s'.repeat(40)),
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
 const stripe={webhooks:Stripe.webhooks,prices:{retrieve:async()=>({id:env.STRIPE_TEST_AUDIT_PRICE_ID,livemode:false,active:true,type:'one_time',currency:'usd',unit_amount:10000,product:{name:'Initial audit — G2 test'}})},
  checkout:{sessions:{
   async create(params,options){
    calls.create++;assert.equal(params.payment_intent_data.metadata.recording_reference,params.metadata.recording_reference);
    assert.equal(params.line_items[0].price,env.STRIPE_TEST_AUDIT_PRICE_ID);
    if(byKey.has(options.idempotencyKey))return structuredClone(byKey.get(options.idempotencyKey));
    const id='cs_test_fixture_'+(++serial),session={id,livemode:false,mode:'payment',metadata:params.metadata,
     client_reference_id:params.client_reference_id,amount_total:10000,currency:'usd',url:'https://checkout.stripe.com/c/pay/'+id,
     status:'open',payment_status:'unpaid',line_items:{data:[{price:{id:env.STRIPE_TEST_AUDIT_PRICE_ID},quantity:1}]},
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
async function event(purchase,{type='checkout.session.completed',id,outcome='paid',change=()=>{},timestamp}={}){
 const session=provider.sessions.get(purchase.stripeCheckoutReference);
 if(outcome==='paid')Object.assign(session,{status:'complete',payment_status:'paid',payment_intent:{...session.payment_intent,latest_charge:{receipt_url:'https://pay.stripe.com/receipts/payment/fixture'}}});
 if(outcome==='processing')Object.assign(session,{status:'complete',payment_status:'unpaid'});
 if(outcome==='failed')Object.assign(session,{status:'open',payment_status:'unpaid'});
 if(outcome==='incomplete')Object.assign(session,{status:'expired',payment_status:'unpaid'});
 const object=type.startsWith('payment_intent.')?{id:session.payment_intent.id,livemode:false,metadata:session.metadata}:structuredClone(session);
 const value={id:id||'evt_fixture_'+(++eventCounter),livemode:false,type,data:{object}};change(value,session);
 const body=JSON.stringify(value),signature=Stripe.webhooks.generateTestHeaderString({payload:body,secret:env.STRIPE_WEBHOOK_SECRET,...(timestamp?{timestamp}:{})});
 return send('/api/payments/webhook',{method:'POST',body,headers:{'stripe-signature':signature}});
}
async function start(body=payload()){
 const response=await send('/api/payments/checkout',{method:'POST',body});assert.equal(response.status,200,await response.clone().text());
 const result=await response.json();assert.ok(result.checkoutUrl.startsWith('https://checkout.stripe.com/'));return {body,purchase:result.purchase};
}
const checks=[];
async function check(name,run){await run();checks.push(name);}
try{
 await check('Disabled by default, and always disabled on Vercel or a non-local hostname',async()=>{
  for(const [environment,url]of [[{},origin],[{...env,VERCEL:'1'},origin],[env,'https://production.example']]){
   const response=await handleG2Payment(new Request(url+'/api/payments/status'),environment);assert.equal((await response.json()).enabled,false);
  }
 });
 await check('Test configuration status exposes no credentials',async()=>{
  const body=await (await send('/api/payments/status')).json();assert.equal(body.configured,true);assert.equal(body.offer.amount,10000);
  assert.equal(JSON.stringify(body).includes(env.STRIPE_SECRET_KEY),false);assert.equal(JSON.stringify(body).includes(env.STRIPE_WEBHOOK_SECRET),false);
 });
 await check('Access, origin, consent, missing description, blocked scope and client price overrides are rejected',async()=>{
  assert.equal((await api.handle(request('/api/payments/checkout',{method:'POST',body:payload()}))).status,401);
  assert.equal((await send('/api/payments/checkout',{method:'POST',body:payload(),headers:{origin:'https://elsewhere.example'}})).status,403);
  for(const change of [p=>p.consent=false,p=>p.description='',p=>p.amount=1,p=>p.calculation.confirmed=false,p=>p.calculation.answers.legacy_system_check='Restricted',p=>p.calculation.answers.steps_band=5,p=>p.calculation=null]){
   const p=payload();change(p);assert.equal((await send('/api/payments/checkout',{method:'POST',body:p})).status,400);
  }
  assert.equal(store.counts().submissions,0);
 });
 const initial=await start();
 await check('Submission and reviewed text receive separate stable references; calculation is recomputed',async()=>{
  assert.notEqual(initial.purchase.submissionReference,initial.purchase.recordingReference);
  assert.equal(initial.purchase.snapshot.description,initial.body.description);
  assert.deepEqual(initial.purchase.snapshot.answers,initial.body.calculation.answers);
  assert.equal(initial.purchase.snapshot.result.build,11500);
  assert.equal(initial.purchase.outcome,'pending');assert.equal(initial.purchase.auditIntakeReference,null);assert.equal(initial.purchase.receiptUrl,null);
 });
 await check('Duplicate checkout requests reuse the purchase and Stripe idempotency key',async()=>{
  const results=await Promise.all([send('/api/payments/checkout',{method:'POST',body:initial.body}),send('/api/payments/checkout',{method:'POST',body:initial.body})]);
  for(const r of results)assert.equal((await r.json()).purchase.purchaseReference,initial.purchase.purchaseReference);
  assert.equal(store.counts().purchases,1);
 });
 await check('Manual corrections cannot silently overwrite a saved purchase snapshot',async()=>{
  const changed=structuredClone(initial.body);changed.description+=' Changed after starting checkout.';
  assert.equal((await send('/api/payments/checkout',{method:'POST',body:changed})).status,409);
  assert.equal(store.submission(initial.purchase.submissionReference).description,initial.body.description);
 });
 await check('A different session cannot read or retry another purchase',async()=>{
  assert.equal((await send('/api/payments/status?purchase_reference='+initial.purchase.purchaseReference,{cookie:otherAuth})).status,404);
  assert.equal((await send('/api/payments/checkout',{method:'POST',cookie:otherAuth,body:{consent:true,submissionReference:initial.purchase.submissionReference}})).status,404);
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
  for(const change of [(e,s)=>s.amount_total=1,(e,s)=>s.currency='eur',(e,s)=>e.data.object.metadata.recording_reference=randomUUID()]){
   const session=provider.sessions.get(initial.purchase.stripeCheckoutReference);session.amount_total=10000;session.currency='usd';
   const result=await event(initial.purchase,{change});assert.equal(result.status,400);
  }
  const session=provider.sessions.get(initial.purchase.stripeCheckoutReference);session.amount_total=10000;session.currency='usd';
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
  const retry=await (await send('/api/payments/checkout',{method:'POST',body:{consent:true,submissionReference:failed.purchase.submissionReference}})).json();
  assert.equal(retry.purchase.purchaseReference,failed.purchase.purchaseReference);
  assert.equal(retry.purchase.recordingReference,failed.purchase.recordingReference);
 });
 const expired=await start();
 await check('Expired checkout creates no intake; a new attempt keeps the original submission and recording',async()=>{
  assert.equal((await event(expired.purchase,{type:'checkout.session.expired',outcome:'incomplete'})).status,200);
  const retry=await (await send('/api/payments/checkout',{method:'POST',body:{consent:true,submissionReference:expired.purchase.submissionReference}})).json();
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
   const created=await (await handler.handle(request('/api/payments/checkout',{method:'POST',body:payload(),cookie:auth}))).json();
   const p=created.purchase,s=provider.sessions.get(p.stripeCheckoutReference);s.status='complete';s.payment_status='paid';
   const body=JSON.stringify({id:'evt_durable_replay',livemode:false,type:'checkout.session.completed',data:{object:s}});
   const headers={'stripe-signature':Stripe.webhooks.generateTestHeaderString({payload:body,secret:env.STRIPE_WEBHOOK_SECRET})};
   const first=await (await handler.handle(request('/api/payments/webhook',{method:'POST',body,headers}))).json();disk.close();
   disk=createHandoffStore(filename);handler=createG2Payments({environment:env,store:disk,stripe:provider.stripe});
   const repeated=await (await handler.handle(request('/api/payments/webhook',{method:'POST',body,headers}))).json();
   assert.equal(repeated.duplicate,true);assert.equal(repeated.auditIntakeReference,first.auditIntakeReference);
   assert.equal(disk.counts().auditIntakes,1);
  }finally{disk.close();assert.equal(path.dirname(filename),root);for(const suffix of ['','-wal','-shm'])await rm(filename+suffix,{force:true});}
 });
 await check('Simultaneous first checkout requests create only one submission, purchase and Stripe session',async()=>{
  const p=payload(),before=store.counts(),sessionsBefore=provider.sessions.size;
  const responses=await Promise.all([send('/api/payments/checkout',{method:'POST',body:p}),send('/api/payments/checkout',{method:'POST',body:p})]);
  const bodies=await Promise.all(responses.map(async response=>{assert.equal(response.status,200);return response.json();}));
  assert.equal(bodies[0].purchase.purchaseReference,bodies[1].purchase.purchaseReference);
  assert.equal(store.counts().submissions,before.submissions+1);assert.equal(store.counts().purchases,before.purchases+1);
  assert.equal(provider.sessions.size,sessionsBefore+1);
 });
 console.log('PASS: '+checks.length+' G2 checks: '+checks.join('; ')+'.');
 console.log('These are local database/HTTP-handler tests with signed fixtures and mocked Stripe API responses; no real Stripe purchase, Supabase write or email was made.');
}finally{store.close();}
