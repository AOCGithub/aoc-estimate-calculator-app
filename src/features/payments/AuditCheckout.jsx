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
  const ready = Boolean(state.result && !state.dirty && state.confirmed && state.calculationSource === 'server'
    && state.description?.trim() && state.result.provisionalBuild !== null && state.answers.legacy_system_check === 'Standard' && quotedAudit);

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
      {!quotedAudit && <p role="status">Add the audit fee quoted by AOC in Responsibilities and service, then calculate again.</p>}
      {quotedAudit && !ready && <p className="helper">Review your description and answers, then calculate to continue. <button type="button" className="quiet" onClick={() => onNavigate(2)}>Review description</button></p>}
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
