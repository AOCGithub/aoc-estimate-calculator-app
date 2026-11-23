import { useEffect, useId, useRef, useState } from 'react';
import { estimatorBank } from '../../lib/domain.js';
import { money, normalizeAnswers } from '../../lib/format.js';
import { AuditDetails } from './AuditDetails.jsx';
import { paymentStatusUrl, readPaymentStatus, startAuditCheckout, stripeLink } from './payment-client.js';
import { sandboxNotice } from './payment-copy.js';
import './test-purchase.css';

export function AuditCheckout({ state, profile, onNavigate }) {
  const [configuration, setConfiguration] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestReference = useRef(null);
  const reviewHeading = useRef(null);
  const reviewButton = useRef(null);
  const checkoutHintId = useId();

  useEffect(() => {
    const controller = new AbortController();
    readPaymentStatus({ signal: controller.signal }).then(setConfiguration).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus();
  }, [reviewing]);

  if (!configuration?.enabled) return null;
  const service = configuration.service;
  const auditAmount = typeof state.result?.audit === 'number' ? Math.round(state.result.audit * 100) : null;
  const quotedAudit = Number.isSafeInteger(auditAmount) && auditAmount > 0 && auditAmount <= 99999999
    && Math.abs(state.result.audit * 100 - auditAmount) <= 0.000001;
  const enteredAudit = Number(state.answers.audit_fee);
  const enteredAuditCents = Math.round(enteredAudit * 100);
  const validEnteredAudit = Number.isFinite(enteredAudit) && Number.isSafeInteger(enteredAuditCents)
    && enteredAuditCents > 0 && enteredAuditCents <= 99999999
    && Math.abs(enteredAudit * 100 - enteredAuditCents) <= 0.000001;
  const blockers = [];
  if (!state.description?.trim()) blockers.push('Add your work description.');
  if (!state.confirmed) blockers.push('Complete the required questions and confirm your answers.');
  if (state.answers.legacy_system_check !== 'Standard') {
    blockers.push(state.answers.legacy_system_check
      ? 'Resolve the app or access restriction with AOC.'
      : 'Confirm that the listed apps can support the required work.');
  }
  if (state.result?.provisionalBuild === null) blockers.push('Complete the scope details needed for a build estimate.');
  const quotePending = !validEnteredAudit;
  if (!quotePending && state.result && !state.dirty && !quotedAudit) blockers.push('Recalculate to verify the audit fee.');
  if (!state.result) blockers.push('Calculate your estimate.');
  else if (state.dirty) blockers.push('Recalculate after your latest changes.');
  else if (state.calculationSource !== 'server') blockers.push('Recalculate while connected to the estimator service.');
  const ready = Boolean(state.result && !state.dirty && state.confirmed && state.calculationSource === 'server'
    && state.description?.trim() && state.result.provisionalBuild !== null
    && state.answers.legacy_system_check === 'Standard' && quotedAudit);
  const reviewStep = !state.description?.trim() ? 2
    : state.answers.legacy_system_check !== 'Standard' ? 4
      : state.result?.provisionalBuild === null ? 3 : 7;

  function goToMissingDetails() {
    onNavigate(reviewStep);
    if (reviewStep !== 7 || validEnteredAudit) return;
    let attempts = 0;
    const revealAuditFee = () => {
      const details = document.getElementById('quote-details');
      const field = document.getElementById('f_audit_fee');
      if (details && field) {
        details.open = true;
        field.scrollIntoView({behavior: 'smooth', block: 'center'});
        field.focus({preventScroll: true});
      } else if (++attempts < 6) requestAnimationFrame(revealAuditFee);
    };
    requestAnimationFrame(revealAuditFee);
  }

  async function checkout() {
    if (busy || !ready || !consent) return;
    setBusy(true);
    setError('');
    try {
      requestReference.current ||= crypto.randomUUID();
      const data = await startAuditCheckout({
        requestReference: requestReference.current,
        consent,
        description: state.description,
        calculation: { area: state.area, answers: normalizeAnswers(state.answers), confirmed: state.confirmed },
        ...(profile ? { profile } : {}),
      });
      const destination = stripeLink(data.checkoutUrl, ['checkout.stripe.com']);
      window.location.assign(destination || paymentStatusUrl(data.purchase.purchaseReference));
    } catch (reason) {
      setError(reason.message);
      setBusy(false);
    }
  }

  function beginReview() {
    requestReference.current = null;
    setConsent(false);
    setError('');
    setReviewing(true);
  }

  function closeReview() {
    setReviewing(false);
    setError('');
    requestAnimationFrame(() => reviewButton.current?.focus());
  }

  const checkoutHint = !ready ? 'Update your estimate before continuing.'
    : !consent ? 'Check the box above to continue.'
      : 'You’ll review the total and pay on Stripe.';
  return <section className="g2-purchase g2-purchase--checkout" aria-label="Audit payment">
    <div className="g2-purchase__heading">
      <div><p className="eyebrow">YOUR AUDIT</p><h2 ref={reviewHeading} tabIndex={-1}>{service?.name || 'Initial audit & roadmap'}</h2></div>
      {quotedAudit && <strong>{money(auditAmount / 100)} USD <small>One-time audit fee</small></strong>}
    </div>
    <p className="helper">{service?.description || 'This payment covers the audit. We price the build and any monthly services separately.'}</p>
    {!configuration.configured ? <p role="status">Checkout is unavailable right now. You can still edit your estimate.</p> : <>
      {!ready && <div className="g2-purchase__requirements" role="status" aria-live="polite">
        <strong>{quotePending && blockers.length === 0
          ? 'Audit payment is waiting for an AOC quote'
          : 'Audit payment isn’t ready yet'}</strong>
        {quotePending && <p className="g2-purchase__quote-pending">AOC has not provided a fixed audit fee for this estimate. Leave it blank unless AOC has quoted an amount. You can still review the estimate, but payment cannot begin until the audit price is provided.</p>}
        {blockers.length > 0 && <>
          <span>Complete the following before continuing:</span>
          <ul>{blockers.map(item => <li key={item}>{item}</li>)}</ul>
        </>}
        <button type="button" className="quiet" onClick={goToMissingDetails}>{quotePending && blockers.length === 0
          ? 'Add an existing AOC quote'
          : 'Go to missing details'}</button>
      </div>}
      {!reviewing ? <div className="g2-purchase__actions g2-purchase__actions--audit">
        <button ref={reviewButton} className="primary" type="button" disabled={!ready} onClick={beginReview}>Review audit payment</button>
      </div> : <>
        <p className="g2-purchase__scope">Business area: <strong>{estimatorBank.areas.find(area => area.id === state.area)?.label || 'Your agreed project'}</strong></p>
        <AuditDetails service={service} />
        <details><summary>Your work description</summary><p>{state.description}</p></details>
        <p>{state.result?.buildQuoted ? 'Project quote entered' : 'Build estimate'}: {money(state.result?.buildQuoted ? state.result.build : state.result?.provisionalBuild)}. Today’s payment covers the audit only.</p>
        <div className="g2-purchase__checkout">
          <div className="g2-purchase__total"><span>Due today · one-time audit</span><strong>{quotedAudit ? money(auditAmount / 100) + ' USD' : 'Awaiting an AOC audit quote'}</strong></div>
          <label className="g2-purchase__consent">
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
            <span><strong>Save my answers and work description with this audit payment.</strong>
              <small>{profile
                ? 'We’ll save your estimate and the contact details you entered with this payment. Stripe receives your email for checkout. Use test details.'
                : 'We’ll save your estimate with the payment. Use test details.'} Remembering your company profile is a separate choice.</small>
            </span>
          </label>
          {error && <p role="alert" className="g2-purchase__error">{error}</p>}
          <p id={checkoutHintId} className="g2-purchase__checkout-hint">{checkoutHint}</p>
          <div className="g2-purchase__actions g2-purchase__actions--audit">
            <button className="primary" type="button" disabled={!ready || !consent || busy} aria-describedby={checkoutHintId} onClick={checkout}>{busy ? 'Opening Stripe…' : 'Continue to Stripe'}</button>
            <button className="g2-purchase__back" type="button" disabled={busy} onClick={closeReview}>Back to audit overview</button>
          </div>
        </div>
      </>}
    </>}
    <p className="g2-purchase__mode">{sandboxNotice}</p>
  </section>;
}
