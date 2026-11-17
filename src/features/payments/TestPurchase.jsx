import { useCallback, useEffect, useRef, useState } from 'react';
import { estimatorBank } from '../../lib/domain.js';
import { money, normalizeAnswers } from '../../lib/format.js';
import './test-purchase.css';

const outcomeLabels={pending:'Payment not confirmed',processing:'Payment processing',paid:'Test payment confirmed',failed:'Payment failed',incomplete:'Checkout expired or incomplete'};
const safeLink=(value,hosts)=>{try{const url=new URL(value);return url.protocol==='https:'&&hosts.includes(url.hostname)?url.href:null;}catch{return null;}};
const price=value=>money(value/100);

function snapshotText(purchase) {
  const snapshot=purchase.snapshot;
  const area=estimatorBank.areas.find(row=>row.id===snapshot.area);
  const labels=new Map([...estimatorBank.appFields,...estimatorBank.dataFields,...estimatorBank.roiFields,...estimatorBank.serviceFields,...(area?.fields||[])].map(row=>[row.id,row.question]));
  return [
    'AOC — G2 TEST PURCHASE AND ESTIMATE',
    'Test environment. The audit purchase does not mean the indicative build price is paid or accepted.',
    `Item: ${purchase.item}`,`Test purchase amount: ${price(purchase.amount)} ${purchase.currency.toUpperCase()}`,
    `Outcome: ${outcomeLabels[purchase.outcome]}`,`Submission: ${purchase.submissionReference}`,
    `Payment confirmed: ${purchase.paidAt||'Not confirmed'}`,
    `Work-description record: ${purchase.recordingReference}`,`Purchase: ${purchase.purchaseReference}`,
    `Audit intake: ${purchase.auditIntakeReference || 'Not created — payment must be confirmed'}`,
    `Saved: ${snapshot.savedAt}`,`Calculator rules: ${snapshot.calculatorVersion}`,
    '',`Business area: ${area?.label||snapshot.area}`,'REVIEWED WORK DESCRIPTION',snapshot.description,
    '', 'REVIEWED ANSWERS',
    ...Object.entries(snapshot.answers).map(([key,value])=>`${labels.get(key)||key.replaceAll('_',' ')}: ${Array.isArray(value)?value.join(', '):value??'Unknown'}`),
    '', 'INDICATIVE BUILD BREAKDOWN',
    ...(snapshot.result.lines||[]).map(line=>`${line.label}: ${money(line.amount)}`),
    `Indicative build: ${money(snapshot.result.provisionalBuild)}`,
    `Entered project quote: ${snapshot.result.buildQuoted?money(snapshot.result.build):'Not supplied'}`,
    `Audit quote entered in calculator: ${money(snapshot.result.audit)}`,
    `AOC monthly service: ${money(snapshot.result.monthly)}`,`Added monthly costs: ${money(snapshot.result.recurring)}`,
    `Monthly economic benefit: ${money(snapshot.result.net)}`,
    'Staff-time value is not necessarily cash savings. The Stripe test item is separate from these estimate amounts.',
    '', 'ASSUMPTIONS AND REVIEW ITEMS',
    ...(snapshot.result.assumptions||[]),...(snapshot.result.pending||[]),...(snapshot.result.warnings||[]),
    snapshot.result.commercialNotice||'',
  ].join('\n');
}

export function TestPurchase({state,profile,onNavigate}) {
  const [configuration,setConfiguration]=useState(null);
  const [reviewing,setReviewing]=useState(false);
  const [consent,setConsent]=useState(false);
  const [purchase,setPurchase]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const requestReference=useRef(null);
  const parameters=new URLSearchParams(window.location.search);
  const returnReference=parameters.get('purchase_reference');
  const cancelled=parameters.get('checkout_result')==='cancelled';

  const refresh=useCallback(async signal=>{
    const response=await fetch('/api/payments/status'+(returnReference?'?purchase_reference='+encodeURIComponent(returnReference):''),{
      credentials:'same-origin',headers:{Accept:'application/json'},signal});
    const body=await response.json().catch(()=>({enabled:false}));
    if(!response.ok)throw new Error(body.error||'The test purchase could not be loaded.');
    setConfiguration(body);
    if(body.purchase)setPurchase(body.purchase);
  },[returnReference]);

  useEffect(()=>{
    const controller=new AbortController();
    refresh(controller.signal).catch(reason=>{if(reason.name!=='AbortError'&&returnReference)setError(reason.message);});
    return()=>controller.abort();
  },[refresh,returnReference]);

  useEffect(()=>{
    if(!returnReference||!purchase||!['pending','processing'].includes(purchase.outcome)||cancelled)return undefined;
    const controller=new AbortController();
    const timer=setInterval(()=>{refresh(controller.signal).catch(()=>{});},4000);
    const stop=setTimeout(()=>clearInterval(timer),90000);
    return()=>{clearInterval(timer);clearTimeout(stop);controller.abort();};
  },[returnReference,purchase?.outcome,cancelled,refresh]);

  if(configuration?.enabled===false||(!configuration?.enabled&&!returnReference))return null;
  const ready=Boolean(state.result&&!state.dirty&&state.confirmed&&state.calculationSource==='server'
    &&state.description?.trim()&&state.result.provisionalBuild!==null&&state.answers.legacy_system_check==='Standard');

  async function checkout(retry=false) {
    if(busy)return;
    setBusy(true);setError('');
    try {
      requestReference.current ||= crypto.randomUUID();
      const body=retry?{consent:true,submissionReference:purchase.submissionReference}:{
        requestReference:requestReference.current,consent,description:state.description,
        calculation:{area:state.area,answers:normalizeAnswers(state.answers),confirmed:state.confirmed},
        ...(profile?{profile}:{}),
      };
      const response=await fetch('/api/payments/checkout',{method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Test checkout could not be opened.');
      setPurchase(data.purchase);
      const destination=safeLink(data.checkoutUrl,['checkout.stripe.com']);
      if(destination)window.location.assign(destination);
    }catch(reason){setError(reason.message);}finally{setBusy(false);}
  }

  function download() {
    const url=URL.createObjectURL(new Blob([snapshotText(purchase)],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='aoc-test-purchase-'+purchase.purchaseReference+'.txt';link.click();URL.revokeObjectURL(url);
  }

  return <section className="g2-purchase" aria-label="G2 test purchase">
    <div className="g2-purchase__heading"><div><p className="eyebrow">G2 · STRIPE TEST ENVIRONMENT</p>
      <h2>{purchase?outcomeLabels[purchase.outcome]:'Initial audit — test purchase'}</h2></div>
      {configuration?.offer&&<strong>{price(configuration.offer.amount)} USD <small>test amount only</small></strong>}
    </div>
    <p className="helper">This local rehearsal does not purchase the estimated build or approve a final quote. Reusable-profile saving is a separate choice.</p>
    {error&&<p role="alert" className="g2-purchase__error">{error}</p>}
    {!configuration?.configured&&!purchase?<p role="status">Stripe test setup is required. Add the test key, one-time USD test Price ID and local webhook signing secret, then restart the G2 preview.</p>:purchase?<>
      <p role="status">{purchase.outcome==='paid'?'The server recorded a confirmed test payment and one audit intake.':cancelled?'Checkout was closed. Your saved submission is retained; payment has not been confirmed.':'No paid audit intake is created until Stripe confirms payment. You can check the status or retry.'}</p>
      <dl className="g2-purchase__references">
        <div><dt>Purchased item</dt><dd>{purchase.item}</dd></div>
        <div><dt>Test amount</dt><dd>{price(purchase.amount)} {purchase.currency.toUpperCase()}</dd></div>
        {purchase.paidAt&&<div><dt>Payment confirmed</dt><dd>{new Date(purchase.paidAt).toLocaleString()}</dd></div>}
        <div><dt>Submission reference</dt><dd>{purchase.submissionReference}</dd></div>
        <div><dt>Work-description reference</dt><dd>{purchase.recordingReference}</dd></div>
        <div><dt>Purchase reference</dt><dd>{purchase.purchaseReference}</dd></div>
        <div><dt>Audit intake reference</dt><dd>{purchase.auditIntakeReference||'Not created'}</dd></div>
      </dl>
      <details><summary>Estimate attached to this purchase</summary>
        <p>{purchase.snapshot.description}</p>
        <p>Indicative build: <strong>{money(purchase.snapshot.result.provisionalBuild)}</strong> · rules {purchase.snapshot.calculatorVersion}</p>
        <ul>{purchase.snapshot.result.lines.map(line=><li key={line.label}>{line.label}: {money(line.amount)}</li>)}</ul>
        <p className="helper">This saved estimate does not change when you edit the calculator. It is not a receipt for the estimated build.</p>
      </details>
      <div className="g2-purchase__actions">
        <button type="button" onClick={download}>Download purchase and estimate details</button>
        {purchase.outcome==='paid'&&safeLink(purchase.receiptUrl,['pay.stripe.com','receipts.stripe.com'])
          ?<a href={purchase.receiptUrl} target="_blank" rel="noopener noreferrer">View Stripe test receipt ↗</a>
          :purchase.outcome==='paid'?<span>Receipt link is not available yet. Check status to retry.</span>:null}
        <button type="button" disabled={busy} onClick={()=>{setError('');refresh().catch(reason=>setError(reason.message));}}>Check payment status</button>
        {['failed','incomplete','pending'].includes(purchase.outcome)&&<button className="primary" type="button" disabled={busy} onClick={()=>checkout(true)}>{busy?'Opening test checkout…':'Continue test payment'}</button>}
      </div>
    </>:<>
      {!ready&&<p className="helper">Add your description, confirm a complete unblocked scope and calculate before reviewing a test purchase. <button type="button" className="quiet" onClick={()=>onNavigate(2)}>Review description</button></p>}
      {!reviewing?<button type="button" disabled={!ready} onClick={()=>{requestReference.current=null;setConsent(false);setReviewing(true);}}>Review test purchase</button>:<>
        <p><strong>{configuration.offer?.name}</strong> · {price(configuration.offer?.amount||0)} USD test amount.</p>
        <p>{state.description}</p>
        <p>Indicative build: {money(state.result?.provisionalBuild)}. Your reviewed answers and server-calculated breakdown will be attached.</p>
        <label className="g2-purchase__consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} />
          <span>Save this reviewed submission and work description for the test purchase. These records are separate from optional profile saving.</span></label>
        <div className="g2-purchase__actions"><button className="primary" type="button" disabled={!ready||!consent||busy} onClick={()=>checkout()}>{busy?'Opening Stripe test checkout…':'Continue to Stripe test checkout'}</button>
          <button type="button" disabled={busy} onClick={()=>setReviewing(false)}>Cancel</button></div>
      </>}
    </>}
  </section>;
}
