import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { json, requireAccess, validateAccessProfile } from '../api-handlers.mjs';
import { auditService } from './audit-service.mjs';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const allowedEvents = new Set(['checkout.session.completed','checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed','checkout.session.expired','payment_intent.payment_failed']);
const loopback = request => ['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
function enabled(request, env) {
  if (env.AOC_STRIPE_TEST_HANDOFF_ENABLED !== 'true') return false;
  if (!env.VERCEL) return loopback(request);
  const {protocol, origin} = new URL(request.url);
  return protocol === 'https:' && origin === env.AOC_G2_HOSTED_ORIGIN;
}
const hostedConnection = env => env.AOC_G2_POSTGRES_URL || env.POSTGRES_URL;
const settings = env => ({
  testKey: String(env.STRIPE_SECRET_KEY || '').startsWith('sk_test_'),
  webhook: String(env.STRIPE_WEBHOOK_SECRET || '').startsWith('whsec_') && env.STRIPE_WEBHOOK_SECRET.length >= 20,
  ...(env.VERCEL ? {storage: Boolean(hostedConnection(env))} : {}),
});
const ready = env => Object.values(settings(env)).every(Boolean);
const hash = value => createHash('sha256').update(value).digest('hex');
const safeUrl = (value,hosts) => {
  try { const url = new URL(value); return url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
};
const checkoutUrl = value => safeUrl(value,['checkout.stripe.com']);
const receiptUrl = value => safeUrl(value,['pay.stripe.com','receipts.stripe.com']);
const CALCULATED_AUDIT_SOURCE = 'AOC calculator 15% project estimate';
const readSnapshot = value => typeof value === 'string' ? JSON.parse(value) : value;
function chargeDate(intent) {
  const timestamp=intent?.latest_charge?.created;
  return Number.isSafeInteger(timestamp) && timestamp>0 && timestamp<8640000000000
    ? new Date(timestamp*1000).toISOString() : null;
}

async function rawBody(request,limit) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new Error('request_too_large');
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks=[];let size=0;
  try {
    while (true) {
      const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>limit){await reader.cancel();throw new Error('request_too_large');}
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}

function view(bundle) {
  const p=bundle.purchase,s=bundle.submission;
  return { testMode:true, submissionReference:s.id, recordingReference:s.recording_reference,
    purchaseReference:p.id, auditIntakeReference:s.audit_intake_reference,
    purchaseAgreementVersion:p.purchase_agreement_version || null,
    purchaseAgreedAt:p.purchase_agreed_at || null,
    outcome:p.outcome, amount:p.amount, currency:p.currency, item:p.item_name,paidAt:p.paid_at,
    stripeCheckoutReference:p.checkout_reference, stripePaymentReference:p.payment_reference,
    receiptUrl:p.outcome==='paid'?receiptUrl(p.receipt_url):null,
    snapshot:{...readSnapshot(s.snapshot),description:s.description,savedAt:s.created_at} };
}

export function createG2Payments({ environment:env,store,stripe,checkAccess=requireAccess,notifyPaid }) {
  let paymentEmailSender;
  async function sendPaymentEmails(result, session) {
    if (env.AOC_G2_PAYMENT_EMAILS_ENABLED !== 'true' || session.payment_status !== 'paid') return;
    const purchase = view(result);
    const verifiedReceipt = receiptUrl(session.payment_intent?.latest_charge?.receipt_url);
    if (!purchase.receiptUrl && verifiedReceipt) {
      await store.setReceipt(purchase.purchaseReference, verifiedReceipt);
      purchase.receiptUrl = verifiedReceipt;
    }
    paymentEmailSender ||= notifyPaid || (await import('./payment-email.mjs')).configurePaymentEmailSender(env,store);
    await paymentEmailSender(purchase,session.customer_details);
  }

  function calculatedAudit(snapshot) {
    const result=readSnapshot(snapshot)?.result;
    if(!result||result.route!=='project'||result.auditPurchasable!==true||result.auditRate!==0.15
      ||!Number.isFinite(result.build)||result.build<=0||!Number.isFinite(result.audit)||result.audit<=0)return null;
    const amount=Math.round(result.audit*100),buildCents=Math.round(result.build*100);
    const expected=Number((BigInt(buildCents)*1500n+5000n)/10000n);
    return Number.isSafeInteger(amount)&&amount===expected&&amount<=99999999?amount:null;
  }
  function validAuditRecord(saved,quote) {
    const amount=calculatedAudit(saved.snapshot);
    return Boolean(amount&&quote&&quote.status==='quoted'&&uuid(quote.id)&&quote.amount===amount
      &&quote.currency==='usd'&&quote.scope_fingerprint===saved.fingerprint
      &&quote.quoted_by===CALCULATED_AUDIT_SOURCE);
  }
  function auditOffer(saved,quote) {
    if(!validAuditRecord(saved,quote))throw new Error('audit_quote_pending');
    return {id:'audit_quote_'+quote.id,quoteReference:quote.id,amount:quote.amount,currency:quote.currency,name:auditService.name};
  }
  function quoteView(saved,quote) {
    const snapshot=readSnapshot(saved.snapshot);
    const currentQuote=validAuditRecord(saved,quote)?quote:null;
    return {submissionReference:saved.id,recordingReference:saved.recording_reference,
      status:currentQuote?'quoted':'pending',...(currentQuote?{amount:currentQuote.amount,currency:currentQuote.currency,
        calculated:true}:{}),
      requestedAt:saved.created_at,scope:{area:snapshot.area,answers:snapshot.answers,confirmed:snapshot.confirmed,
        result:snapshot.result,calculatorVersion:snapshot.calculatorVersion,description:saved.description}};
  }
  async function owner(request) {
    if(env.AOC_ACCESS_GATE_ENABLED!=='true')return {response:json({error:'Enter the calculator before starting a test purchase.'},401)};
    const denied=await checkAccess(request,env);if(denied)return {response:denied};
    const cookie=String(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('aoc_estimator_access='));
    if(!cookie)return {response:json({error:'Enter the calculator before starting a test purchase.'},401)};
    return {hash:hash(cookie)};
  }
  async function references(p) {
    const submission=await store.submission(p.submission_reference);
    return {submission_reference:p.submission_reference,recording_reference:submission.recording_reference,purchase_reference:p.id,
      ...(p.quote_reference?{quote_reference:p.quote_reference}:{}),
      ...(p.purchase_agreement_version?{agreement_version:p.purchase_agreement_version}:{})};
  }
  function verifySession(session,p,refs) {
    const metadata=session.metadata||{};
    if(session.livemode!==false || session.mode!=='payment' || !String(session.id).startsWith('cs_test_')
      || session.client_reference_id!==refs.submission_reference
      || Object.entries(refs).some(([key,value])=>metadata[key]!==value)
      || session.amount_total!==p.amount || session.currency!==p.currency
      || (p.checkout_reference && session.id!==p.checkout_reference)) throw new Error('purchase_mismatch');
    const items=session.line_items?.data;
    const item=items?.[0],price=item?.price;
    if(!Array.isArray(items)||items.length!==1||item.quantity!==1||!/^price_/.test(price?.id||'')
      || ((/^price_/.test(p.price_reference)||!p.quote_reference)
        &&p.price_reference!=='inline_audit_quote'&&price.id!==p.price_reference)
      || price.livemode!==false||price.type!=='one_time'||price.currency!==p.currency||price.unit_amount!==p.amount
      || item.amount_total!==p.amount||item.description!==p.item_name)throw new Error('purchase_mismatch');
    return session;
  }
  const retrieve = async p => verifySession(await stripe.checkout.sessions.retrieve(p.checkout_reference,
    {expand:['line_items','payment_intent.latest_charge']}),p,await references(p));

  async function checkout(request,ownerHash) {
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
    let body;
    try { body=JSON.parse((await rawBody(request,160000)).toString('utf8')); }
    catch(error){return json({error:'Send a bounded JSON purchase request.'},error.message==='request_too_large'?413:400);}
    if(!body || typeof body!=='object' || Array.isArray(body)
      || Object.keys(body).some(key=>!['consent','purchaseAgreement','submissionReference'].includes(key)))
      return json({error:'Start payment only from the saved AOC quote.'},400);
    if(body.consent!==true)return json({error:'Confirm saving this submission and work description for the test purchase.'},400);
    if(!Object.hasOwn(body,'purchaseAgreement'))return json({error:'This checkout page is out of date. Refresh the calculator, review the audit again and accept both checkboxes.'},409);
    if(body.purchaseAgreement!==true)return json({error:'Review and accept the audit purchase agreement before continuing.'},400);
    let prepared;
    try {
      if(!uuid(body.submissionReference))return json({error:'Save the calculated audit fee before payment.'},400);
      const saved=await store.submission(body.submissionReference);
      if(!saved||saved.owner_hash!==ownerHash)return json({error:'Audit quote not found for this session.'},404);
      const quote=await store.quote(saved.id);
      if(quote?.scope_fingerprint!==saved.fingerprint)throw new Error('snapshot_conflict');
      const offer=auditOffer(saved,quote);
      const agreement={version:auditService.purchaseAgreement.version,acceptedAt:new Date().toISOString()};
      prepared=await store.prepare({ownerHash,submissionReference:body.submissionReference,price:offer,agreement});
      if(!prepared)return json({error:'Audit quote not found for this session.'},404);
      if(prepared.purchase.outcome==='paid')return json({purchase:view(prepared)});
      if(prepared.purchase.checkout_reference){
        const session=await retrieve(prepared.purchase);
        if(session.status==='expired'){
          await store.closeExpiredCheckout(prepared.purchase.id);
          prepared=await store.prepare({ownerHash,submissionReference:prepared.submission.id,price:offer,agreement});
          if(prepared.purchase.outcome==='paid')return json({purchase:view(prepared)});
          if(prepared.purchase.checkout_reference)return json({purchase:view(prepared),waitingForPaymentEvent:true});
        }else if(session.status==='open' && checkoutUrl(session.url))return json({purchase:view(prepared),checkoutUrl:checkoutUrl(session.url)});
        else return json({purchase:view(prepared),waitingForPaymentEvent:true});
      }
      const p=prepared.purchase,refs=await references(p),origin=new URL(request.url).origin;
      const snapshot=readSnapshot(prepared.submission.snapshot);
      const result=await stripe.checkout.sessions.create({mode:'payment',line_items:[{price_data:{currency:p.currency,
          unit_amount:p.amount,product_data:{name:p.item_name,description:snapshot.service?.description||'Initial audit of the agreed work. Implementation and ongoing services are separate.'}},quantity:1}],expand:['line_items'],
        allowed_payment_method_types:['card'],adaptive_pricing:{enabled:false},automatic_tax:{enabled:false},allow_promotion_codes:false,
        client_reference_id:prepared.submission.id,metadata:refs,payment_intent_data:{metadata:refs},
        ...(snapshot.profile?.businessEmail?{customer_email:snapshot.profile.businessEmail}:{}),
        success_url:`${origin}/payment/status?purchase_reference=${p.id}&audit_request=${prepared.submission.id}&checkout_result=success`,
        cancel_url:`${origin}/payment/status?purchase_reference=${p.id}&audit_request=${prepared.submission.id}&checkout_result=cancelled`},
        {idempotencyKey:'g2-checkout-'+p.id});
      if(result.livemode!==false || !String(result.id).startsWith('cs_test_')||!checkoutUrl(result.url))throw new Error('invalid_test_checkout');
      verifySession(result,p,refs);
      await store.bindCheckout(p.id,result);
      const stored=await store.bundle(p.id,ownerHash);
      return json({purchase:view(stored),...(stored.purchase.outcome==='paid'?{}:{checkoutUrl:checkoutUrl(result.url)})});
    }catch(error){
      if(error.message==='audit_quote_pending')return json({error:'The saved audit fee does not match 15% of this project estimate. Start a new audit review.'},409);
      if(error.message==='snapshot_conflict')return json({error:'This submission has changed. Review it as a new test purchase.'},409);
      if(error.message==='agreement_conflict')return json({error:'The purchase agreement changed. Review the current terms before starting a new checkout.'},409);
      if(error.message==='purchase_mismatch')return json({error:'Stripe references or amounts need review; no new purchase was created.'},409);
      console.warn('Stripe sandbox checkout failed.',{type:error.type||error.name,code:error.code||null,param:error.param||null});
      return json({error:'Could not open Stripe test checkout. Your saved submission is retained; retry safely.'},502);
    }
  }

  async function quoteRequest(request,ownerHash) {
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
    let body;
    try { body=JSON.parse((await rawBody(request,160000)).toString('utf8')); }
    catch(error){return json({error:'Send a bounded JSON quote request.'},error.message==='request_too_large'?413:400);}
    if(!body||typeof body!=='object'||Array.isArray(body)
      ||Object.keys(body).some(key=>!['requestReference','consent','description','calculation','profile'].includes(key)))
      return json({error:'Send only the reviewed estimate fields.'},400);
    if(body.consent!==true)return json({error:'Confirm that AOC may save and review this estimate.'},400);
    if(!uuid(body.requestReference)||typeof body.description!=='string'||!body.description.trim()||body.description.length>18000)
      return json({error:'Add a reviewed work description of up to 18,000 characters.'},400);
    try {
      const {default:Calculation}=await import('../../public/journey-calculation.js');
      let calculated;
      try { calculated=Calculation.calculate(body.calculation); }
      catch { return json({error:'Review the calculator answers and recalculate before preparing the audit payment.'},400); }
      if(!body.calculation.confirmed||calculated.result.errors.length||calculated.result.build===null
        ||body.calculation.answers.legacy_system_check!=='Standard')
        return json({error:'Confirm a complete, unblocked scope and recalculate before preparing the audit payment.'},400);
      let profile=null;
      if(body.profile){const checked=validateAccessProfile(body.profile);if(checked.error)return json({error:checked.error},400);profile=checked.profile;}
      const snapshot={area:body.calculation.area,answers:body.calculation.answers,confirmed:true,result:calculated.result,
        calculatorVersion:calculated.version,profile,service:auditService};
      const input={description:body.description.trim(),calculation:body.calculation,profile};
      const saved=await store.saveSubmission({ownerHash,requestReference:body.requestReference,
        fingerprint:hash(JSON.stringify(input)),description:input.description,snapshot});
      const amount=calculatedAudit(saved.submission.snapshot);
      if(!amount)return json({error:'The complete one-time project estimate is required to calculate the 15% audit fee.'},400);
      let quote=saved.quote;
      if(!validAuditRecord(saved.submission,quote))quote=await store.approveQuote({submissionReference:saved.submission.id,
        amount,currency:'usd',quotedBy:CALCULATED_AUDIT_SOURCE});
      return json({quoteRequest:quoteView(saved.submission,quote)});
    }catch(error){
      if(error.message==='snapshot_conflict'||error.message==='quote_locked')return json({error:'This saved request no longer matches the current 15% audit calculation. Start a new estimate before payment.'},409);
      return json({error:'The audit review request could not be saved. Your estimate is unchanged.'},503);
    }
  }

  async function webhook(request) {
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    let event;
    try {event=stripe.webhooks.constructEvent(await rawBody(request,1000000),request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET);}
    catch {return json({error:'Invalid Stripe signature or payload.'},400);}
    if(!event || event.livemode!==false || !/^evt_[a-zA-Z0-9_]+$/.test(event.id || ''))return json({error:'G2 accepts valid test events only.'},400);
    if(!allowedEvents.has(event.type))return json({received:true,ignored:true});
    const object=event.data?.object,metadata=object?.metadata||{};
    if(object?.livemode!==false)return json({error:'G2 accepts test objects only.'},400);
    if(!uuid(metadata.purchase_reference))return json({received:true,ignored:true});
    try {
      const p=await store.purchase(metadata.purchase_reference);
      if(!p)return json({error:'Referenced purchase is unavailable; retry delivery.'},503);
      const refs=await references(p);
      if(Object.entries(refs).some(([key,value])=>metadata[key]!==value))return json({error:'Purchase references do not match.'},400);
      let session;
      if(event.type.startsWith('checkout.session.')){
        if(object.livemode!==false || (p.checkout_reference&&p.checkout_reference!==object.id))throw new Error('purchase_mismatch');
        session=verifySession(await stripe.checkout.sessions.retrieve(object.id,{expand:['line_items','payment_intent.latest_charge']}),p,refs);
      }else{
        if(!p.checkout_reference)return json({error:'Checkout binding is not ready; retry delivery.'},503);
        session=await retrieve(p);
        const paymentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
        if(object.id!==paymentId)throw new Error('purchase_mismatch');
      }
      // Current Stripe state wins over delivery order. 'completed' alone is not proof of payment.
      const outcome=session.payment_status==='paid'?'paid':session.status==='expired'?'incomplete'
        :['checkout.session.async_payment_failed','payment_intent.payment_failed'].includes(event.type)?'failed'
          :session.status==='complete'?'processing':'pending';
      const intent=session.payment_intent;
      const result=await store.applyEvent({eventId:event.id,type:event.type,objectId:object.id,purchaseId:p.id,
        sessionId:session.id,paymentId:typeof intent==='string'?intent:intent?.id,
        outcome,receiptUrl:outcome==='paid'?receiptUrl(intent?.latest_charge?.receipt_url):null,checkoutState:session.status,
        paidAt:outcome==='paid'?chargeDate(intent):null});
      try {
        // The paid record is committed first; retries only address outstanding emails.
        await sendPaymentEmails(result,session);
      } catch(error) {
        console.warn('G2 payment email delivery pending.',{purchaseReference:p.id,code:error.code||error.name});
        return json({error:'Payment was recorded. Retry email delivery.'},503);
      }
      return json({received:true,duplicate:result.duplicate,outcome:result.purchase.outcome,auditIntakeReference:result.submission.audit_intake_reference});
    }catch(error){
      if(error.message==='purchase_mismatch')return json({error:'Stripe purchase details do not match the saved order.'},400);
      return json({error:'Purchase outcome was not recorded; retry delivery.'},503);
    }
  }

  return {
    async handle(request) {
      const path=new URL(request.url).pathname;
      if(!enabled(request,env))return path==='/api/payments/status'?json({enabled:false}):json({error:'Not found.'},404);
      if(!ready(env))return path==='/api/payments/status'?json({enabled:true,configured:false,settings:settings(env)}):json({error:'Stripe test setup is incomplete.'},503);
      if(path==='/api/payments/webhook')return webhook(request);
      if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Use this estimator page.'},403);
      if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Use this estimator page.'},403);
      if(['/api/payments/checkout','/api/payments/quote-request'].includes(path)
        &&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Use this estimator page.'},403);
      const identity=await owner(request);if(identity.response)return identity.response;
      if(path==='/api/payments/quote-request')return quoteRequest(request,identity.hash);
      if(path==='/api/payments/checkout')return checkout(request,identity.hash);
      if(path!=='/api/payments/status'||request.method!=='GET')return json({error:'Method not allowed.'},405);
      const url=new URL(request.url);
      const submissionReference=url.searchParams.get('submission_reference');
      if(submissionReference){
        if(!uuid(submissionReference))return json({error:'Invalid submission reference.'},400);
        const saved=await store.submission(submissionReference);
        if(!saved||saved.owner_hash!==identity.hash)return json({error:'Audit review request not found for this session.'},404);
        const quote=await store.quote(submissionReference);
        return json({enabled:true,configured:true,quoteRequest:quoteView(saved,quote)});
      }
      const reference=url.searchParams.get('purchase_reference');
      if(reference){
        if(!uuid(reference))return json({error:'Invalid purchase reference.'},400);
        const stored=await store.bundle(reference,identity.hash);
        if(!stored)return json({error:'Purchase not found for this session.'},404);
        if(new URL(request.url).searchParams.get('refresh')==='true'){
          try {
            if(!stored.purchase.checkout_reference)return json({error:'Checkout is still being prepared. Please check again shortly.'},503);
            const current=await retrieve(stored.purchase),intent=current.payment_intent;
            const outcome=current.payment_status==='paid'?'paid':current.status==='expired'?'incomplete'
              :current.status==='complete'?'processing':stored.purchase.outcome==='failed'?'failed':'pending';
            const updated=await store.reconcileCheckout({purchaseId:reference,sessionId:current.id,
              paymentId:typeof intent==='string'?intent:intent?.id,outcome,checkoutState:current.status,
              receiptUrl:outcome==='paid'?receiptUrl(intent?.latest_charge?.receipt_url):null,
              paidAt:outcome==='paid'?chargeDate(intent):null});
            return json({enabled:true,configured:true,purchase:view(updated),checkedAt:new Date().toISOString()});
          }catch(error){
            if(error.message==='purchase_mismatch')return json({error:'The payment details did not match your saved order. Contact AOC before trying another payment.'},409);
            return json({error:'We could not check Stripe right now. Your saved payment status has not changed. Please try again.'},502);
          }
        }
        if(stored.purchase.outcome==='paid'&&!stored.purchase.receipt_url){
          try {const current=await retrieve(stored.purchase);const url=receiptUrl(current.payment_intent?.latest_charge?.receipt_url);
            if(url){await store.setReceipt(reference,url);stored.purchase.receipt_url=url;}}catch{/* A missing receipt must not undo a recorded payment. */}
        }
        return json({enabled:true,configured:true,purchase:view(stored)});
      }
      await store.check?.();
      return json({enabled:true,configured:true,testMode:true,pricing:'project_total_15_percent',
        auditRate:0.15,service:auditService});
    },
    close:()=>store.close(),
  };
}

let payments;
export async function handleG2Payment(request,environment=process.env) {
  const status=new URL(request.url).pathname==='/api/payments/status';
  if(!enabled(request,environment))return status?json({enabled:false}):json({error:'Not found.'},404);
  if(!ready(environment))return status?json({enabled:true,configured:false,settings:settings(environment)}):json({error:'Stripe test setup is incomplete.'},503);
  payments ||= (async () => {
    const {default:Stripe}=await import('stripe');
    let store;
    if(environment.VERCEL){
      const {createHostedHandoffStore}=await import('./hosted-handoff-store.mjs');
      store=createHostedHandoffStore(hostedConnection(environment));
    }else{
      const {createHandoffStore}=await import('./handoff-store.mjs');
      store=createHandoffStore(environment.AOC_G2_STORE_PATH || fileURLToPath(new URL('../../artifacts/g2/stripe-handoff.sqlite',import.meta.url)));
    }
    return createG2Payments({environment,store,stripe:new Stripe(environment.STRIPE_SECRET_KEY,{maxNetworkRetries:2,timeout:12000})});
  })().catch(error=>{payments=null;throw error;});
  try { return await (await payments).handle(request); }
  catch(error){
    console.warn('G2 payment service unavailable.',{code:error.code||error.name});
    return json({error:'Could not access the saved test payment. Try again shortly.'},503);
  }
}
export async function closeG2Payments(){if(payments){const current=await payments;payments=null;await current.close();}}
