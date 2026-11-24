import { useEffect, useId, useRef, useState } from 'react';
import { estimatorBank } from '../../lib/domain.js';
import { money, normalizeAnswers } from '../../lib/format.js';
import { AuditDetails } from './AuditDetails.jsx';
import { paymentStatusUrl, readAuditQuote, readPaymentStatus, requestAuditQuote, startAuditCheckout, stripeLink } from './payment-client.js';
import { sandboxNotice } from './payment-copy.js';
import './test-purchase.css';

export function AuditCheckout({ state, profile, onNavigate }) {
  const [configuration, setConfiguration] = useState(null);
  const [quoteRequest, setQuoteRequest] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [purchaseAgreement, setPurchaseAgreement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestReference = useRef(null);
  const reviewHeading = useRef(null);
  const reviewButton = useRef(null);
  const checkoutHintId = useId();

  useEffect(() => {
    const controller = new AbortController();
    readPaymentStatus({ signal: controller.signal }).then(setConfiguration).catch(() => {});
    const savedReference = new URLSearchParams(window.location.search).get('audit_request');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedReference || '')) {
      readAuditQuote(savedReference, { signal: controller.signal }).then(setQuoteRequest).catch(() => {});
    }
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus();
  }, [reviewing]);

  if (!configuration?.enabled) return null;
  const service = configuration.service;
  const auditAmount = quoteRequest?.status === 'quoted' && Number.isSafeInteger(quoteRequest.amount)
    ? quoteRequest.amount : null;
  const quotedAudit = auditAmount > 0 && auditAmount <= 99999999 && quoteRequest?.currency === 'usd';
  const calculatedAudit = Number.isFinite(state.result?.audit) && state.result.audit > 0
    && state.result?.auditRate === 0.15 && state.result?.auditPurchasable === true;
  const displayedAudit = quotedAudit ? auditAmount / 100 : calculatedAudit ? state.result.audit : null;
  const savedScope = quoteRequest?.scope || null;
  const blockers = [];
  if (!state.description?.trim()) blockers.push('Add your work description.');
  if (!state.confirmed) blockers.push('Complete the required questions and confirm your answers.');
  if (state.answers.legacy_system_check !== 'Standard') {
    blockers.push(state.answers.legacy_system_check
      ? 'Resolve the app or access restriction with AOC.'
      : 'Confirm that the listed apps can support the required work.');
  }
  if (state.result?.build === null) blockers.push('Complete the scope details needed for the project estimate.');
  else if (!calculatedAudit) blockers.push('Recalculate the 15% audit fee from the completed project estimate.');
  if (!state.result) blockers.push('Calculate your estimate.');
  else if (state.dirty) blockers.push('Recalculate after your latest changes.');
  else if (state.calculationSource !== 'server') blockers.push('Recalculate while connected to the estimator service.');
  const estimateReady = Boolean(state.result && !state.dirty && state.confirmed && state.calculationSource === 'server'
    && state.description?.trim() && state.result.build !== null && calculatedAudit
    && state.answers.legacy_system_check === 'Standard');
  const ready = quotedAudit && Boolean(savedScope);
  const displayedBlockers = quoteRequest ? [] : blockers;
  const reviewStep = !state.description?.trim() ? 2
    : state.answers.legacy_system_check !== 'Standard' ? 4
      : state.result?.build === null || !calculatedAudit ? 3 : 7;

  function goToMissingDetails() {
    onNavigate(reviewStep);
  }

  async function submitForReview() {
    if (busy || !estimateReady || !consent) return;
    setBusy(true);
    setError('');
    try {
      requestReference.current ||= crypto.randomUUID();
      const submitted = await requestAuditQuote({
        requestReference: requestReference.current,
        consent,
        description: state.description,
        calculation: { area: state.area, answers: normalizeAnswers(state.answers), confirmed: state.confirmed },
        ...(profile ? { profile } : {}),
      });
      setQuoteRequest(submitted);
      const url = new URL(window.location.href);
      url.searchParams.set('audit_request', submitted.submissionReference);
      window.history.replaceState(null, '', url);
      const quoteReady = submitted.status === 'quoted' && Number.isSafeInteger(submitted.amount)
        && submitted.amount > 0 && submitted.currency === 'usd';
      setReviewing(quoteReady);
      if (!quoteReady) setConsent(false);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshQuote() {
    if (!quoteRequest?.submissionReference || busy) return;
    setBusy(true);
    setError('');
    try {
      setQuoteRequest(await readAuditQuote(quoteRequest.submissionReference));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (busy || !ready || !consent || !purchaseAgreement) return;
    setBusy(true);
    setError('');
    try {
      const data = await startAuditCheckout({ consent, purchaseAgreement,
        submissionReference: quoteRequest.submissionReference });
      const destination = stripeLink(data.checkoutUrl, ['checkout.stripe.com']);
      window.location.assign(destination || paymentStatusUrl(data.purchase.purchaseReference, quoteRequest.submissionReference));
    } catch (reason) {
      setError(reason.message);
      setBusy(false);
    }
  }

  function beginReview() {
    if (!quoteRequest) requestReference.current = null;
    setConsent(false);
    setPurchaseAgreement(false);
    setError('');
    setReviewing(true);
  }

  function closeReview() {
    setReviewing(false);
    setError('');
    requestAnimationFrame(() => reviewButton.current?.focus());
  }

  const checkoutHint = quotedAudit && (!consent || !purchaseAgreement) ? 'Select both checkboxes to continue to Stripe.'
    : !quotedAudit && !estimateReady ? 'Update your estimate before continuing.'
      : !consent ? 'Check the box above to continue.'
      : quotedAudit ? 'You’ll review the total and pay on Stripe.'
        : 'Save the reviewed scope and its 15% audit fee to continue.';

  return <section className="g2-purchase g2-purchase--checkout" aria-label="Audit payment">
    <div className="g2-purchase__heading">
      <div><p className="eyebrow">YOUR AUDIT</p><h2 ref={reviewHeading} tabIndex={-1}>{service?.name || 'Initial audit & roadmap'}</h2></div>
      {quotedAudit && <strong>{money(auditAmount / 100)} USD <small>One-time audit fee</small></strong>}
    </div>
    <p className="helper">{service?.description || 'This payment covers the audit. The fee is 15% of the complete one-time project estimate; monthly services are separate.'}</p>
    {!configuration.configured ? <p role="status">Checkout is unavailable right now. You can still edit your estimate.</p> : <>
      {!ready && <div className="g2-purchase__requirements" role="status" aria-live="polite">
        <strong>{quoteRequest?.status === 'pending' ? 'This saved audit needs recalculation' : estimateReady ? 'Your estimate is ready for audit payment' : 'Audit payment is not ready yet'}</strong>
        {!quoteRequest && estimateReady && <p className="g2-purchase__quote-pending"><strong>{money(state.result.audit)} USD audit fee.</strong> This is 15% of the {money(state.result.build)} one-time project estimate.</p>}
        {quoteRequest?.status === 'pending' && <p>Start a new audit review so the saved amount follows the current 15% rule.</p>}
        {displayedBlockers.length > 0 && <>
          <span>Complete the following before continuing:</span>
          <ul>{displayedBlockers.map(item => <li key={item}>{item}</li>)}</ul>
        </>}
        {displayedBlockers.length > 0 && <button type="button" className="quiet" onClick={goToMissingDetails}>Go to missing details</button>}
        {quoteRequest?.status === 'pending' && <button type="button" className="quiet" disabled={busy} onClick={refreshQuote}>{busy ? 'Checking...' : 'Check quote status'}</button>}
        {error && <p role="alert" className="g2-purchase__error">{error}</p>}
      </div>}
      {!reviewing ? <div className="g2-purchase__actions g2-purchase__actions--audit">
        <button ref={reviewButton} className="primary" type="button" disabled={quotedAudit ? false : !estimateReady || quoteRequest?.status === 'pending'} onClick={beginReview}>Review audit payment</button>
      </div> : <>
        <p className="g2-purchase__scope">Business area: <strong>{estimatorBank.areas.find(area => area.id === (savedScope?.area || state.area))?.label || 'Your agreed project'}</strong></p>
        <AuditDetails service={service} />
        <details><summary>Your work description</summary><p>{savedScope?.description || state.description}</p></details>
        <p>{(savedScope?.result || state.result)?.buildQuoted ? 'Project quote entered' : 'Build estimate'}: {money((savedScope?.result || state.result)?.buildQuoted ? (savedScope?.result || state.result).build : (savedScope?.result || state.result)?.provisionalBuild)}. The audit is priced and purchased separately.</p>
        <div className="g2-purchase__checkout">
          <div className="g2-purchase__total"><span>Due today - one-time audit</span><strong>{displayedAudit === null ? 'Complete the project estimate' : money(displayedAudit) + ' USD'}</strong></div>
          {displayedAudit !== null && <p className="g2-purchase__quote-pending"><strong>Calculated at 15%.</strong> Based on the complete one-time project estimate shown above.</p>}
          <label className="g2-purchase__consent">
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
            <span><strong>Save my answers and work description for this audit.</strong>
              <small>{profile
                ? 'We will save your estimate and the contact details you entered. Stripe receives your email only when you continue to checkout.'
                : 'We will save your estimate and calculated audit fee for this payment.'} Remembering your company profile is a separate choice.</small>
            </span>
          </label>
          {quotedAudit && <label className="g2-purchase__consent g2-purchase__agreement">
            <input type="checkbox" checked={purchaseAgreement}
              onChange={event => setPurchaseAgreement(event.target.checked)} />
            <span><strong>Purchase agreement</strong>
              <small>{service?.purchaseAgreement?.text || 'I have reviewed the audit details and agree to purchase the AI Commerce Audit. Implementation and ongoing services are separate.'}</small>
            </span>
          </label>}
          {error && <p role="alert" className="g2-purchase__error">{error}</p>}
          <p id={checkoutHintId} className="g2-purchase__checkout-hint">{checkoutHint}</p>
          <div className="g2-purchase__actions g2-purchase__actions--audit">
            <button className="primary" type="button" disabled={(quotedAudit ? !ready : !estimateReady) || !consent || (quotedAudit && !purchaseAgreement) || busy} aria-describedby={checkoutHintId} onClick={quotedAudit ? checkout : submitForReview}>{busy ? (quotedAudit ? 'Opening Stripe...' : 'Saving...') : (quotedAudit ? 'Continue to Stripe' : 'Save audit and continue')}</button>
            <button className="g2-purchase__back" type="button" disabled={busy} onClick={closeReview}>Back to audit overview</button>
          </div>
        </div>
      </>}
    </>}
    <p className="g2-purchase__mode">{sandboxNotice}</p>
  </section>;
}
