import { useCallback, useEffect, useRef, useState } from 'react';
import { Brand } from '../../components/Brand.jsx';
import { money } from '../../lib/format.js';
import { loadEstimatorBank } from '../../lib/loadEstimatorRules.js';
import { AuditDetails } from './AuditDetails.jsx';
import { calculatorReturnUrl, paymentStatusUrl, readPaymentStatus, startAuditCheckout, stripeLink } from './payment-client.js';
import { paymentOutcomes, sandboxNotice } from './payment-copy.js';
import './test-purchase.css';
import './payment-status.css';

function PaymentCheckFeedback({ checking, checkedAt, error, outcome }) {
  const visible = checking || Boolean(error || checkedAt);
  const tone = checking ? 'checking' : error ? 'error' : outcome === 'paid' ? 'paid' : 'checked';
  const label = checking ? 'Checking with Stripe…' : error ? 'Couldn’t check payment' : paymentOutcomes[outcome]?.[0];
  return <div className="g2-purchase__check-feedback" data-visible={visible} role="status" aria-atomic="true">
    <div className="g2-purchase__check-body">
      {visible && <div className="g2-purchase__check-card" data-tone={tone}>
        <span className="g2-purchase__check-icon" aria-hidden="true" />
        <div className="g2-purchase__check-copy" key={tone}>
          <strong>{label}</strong>
          {error && <span>{error}</span>}
        </div>
        {!checking && !error && checkedAt && <span className="g2-purchase__check-time">Checked at {checkedAt}</span>}
      </div>}
    </div>
  </div>;
}

function SavedPurchaseDetails({ purchase }) {
  const { snapshot } = purchase;
  const { result } = snapshot;
  const build = result.buildQuoted ? result.build : result.provisionalBuild;
  return <div className="payment-status__details">
    {snapshot.service && <details><summary>Audit details</summary><AuditDetails service={snapshot.service} /></details>}
    <details><summary>Work description and estimate</summary>
      <p className="payment-status__description">{snapshot.description}</p>
      <p>{result.buildQuoted ? 'Project quote entered' : 'Build estimate'}: <strong>{money(build)}</strong>. {result.auditRate === .15
        ? 'The one-time audit fee was calculated at 15% of this saved project estimate.'
        : 'The audit fee is separate from the cost of the build.'}</p>
      {result.lines.length > 0 && <>
        <p className="helper">Here’s how the calculator estimated the cost of the build.</p>
        <ul>{result.lines.map(line => <li key={line.label}>{line.label}: {money(line.amount)}</li>)}</ul>
      </>}
      <p className="helper">We saved this copy when you started checkout.</p>
    </details>
    <details><summary>Submission and audit references</summary>
      <dl className="g2-purchase__references">
        <div><dt>Submission reference</dt><dd>{purchase.submissionReference}</dd></div>
        <div><dt>Work-description reference</dt><dd>{purchase.recordingReference}</dd></div>
        <div><dt>Audit request reference</dt><dd>{purchase.auditIntakeReference || 'Waiting for payment confirmation'}</dd></div>
      </dl>
    </details>
  </div>;
}

export default function PaymentStatusPage() {
  const parameters = new URLSearchParams(window.location.search);
  const reference = parameters.get('purchase_reference');
  const checkoutResult = parameters.get('checkout_result');
  const returnUrl = calculatorReturnUrl(window.location);

  const [purchase, setPurchase] = useState(null);
  const [unavailable, setUnavailable] = useState('');
  const [checkError, setCheckError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState('');
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState('');
  const manualCheck = useRef(false);
  const latestRequest = useRef(0);

  const load = useCallback(async (signal, refresh = false, silent = false) => {
    if (!reference || manualCheck.current) return;
    const request = ++latestRequest.current;
    const isCurrent = () => request === latestRequest.current && !signal?.aborted;
    if (refresh) {
      manualCheck.current = true;
      setChecking(true);
      setCheckError('');
      setCheckedAt('');
    }
    try {
      const data = await readPaymentStatus({ reference, refresh, signal });
      if (!isCurrent()) return;
      if (!data.enabled || !data.configured) {
        setPurchase(null);
        setUnavailable('Payment status is unavailable in this preview.');
        return;
      }
      if (!data.purchase) throw new Error('We could not load your payment details. Please try again.');
      setPurchase(data.purchase);
      setUnavailable('');
      setCheckError('');
      if (refresh) {
        setCheckedAt(new Date(data.checkedAt || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      }
    } catch (error) {
      if (!isCurrent()) return;
      if ([400, 401, 403, 404].includes(error.status)) {
        setPurchase(null);
        setCheckedAt('');
        setCheckError('');
        setUnavailable('This payment link is not available in this session.');
      } else if (!silent) {
        setCheckError(error.message);
      }
    } finally {
      if (refresh) {
        manualCheck.current = false;
        if (isCurrent()) setChecking(false);
      }
    }
  }, [reference]);

  useEffect(() => {
    document.title = 'Audit payment | Always Open Commerce';
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const outcome = purchase?.outcome;
  const canPoll = ['pending', 'processing'].includes(outcome) && !(checkoutResult === 'cancelled' && outcome === 'pending');
  useEffect(() => {
    if (!canPoll) return;
    const controller = new AbortController();
    const timer = setInterval(() => load(controller.signal, false, true), 4000);
    const stop = setTimeout(() => clearInterval(timer), 90000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
      controller.abort();
    };
  }, [canPoll, load]);

  async function retryCheckout() {
    if (openingCheckout || manualCheck.current) return;
    setOpeningCheckout(true);
    setActionError('');
    setCheckError('');
    setCheckedAt('');
    try {
      const data = await startAuditCheckout({ consent: true, submissionReference: purchase.submissionReference });
      const destination = stripeLink(data.checkoutUrl, ['checkout.stripe.com']);
      if (destination || data.purchase.purchaseReference !== reference) {
        window.location.assign(destination || paymentStatusUrl(data.purchase.purchaseReference));
        return;
      }
      // Ignore any older poll in flight before applying the checkout response.
      latestRequest.current++;
      setPurchase(data.purchase);
    } catch (error) {
      setActionError(error.message);
    }
    setOpeningCheckout(false);
  }

  async function download() {
    if (downloading) return;
    setDownloading(true);
    setActionError('');
    try {
      await loadEstimatorBank();
      const { downloadPurchasePdf } = await import('./purchase-pdf.js');
      await downloadPurchasePdf(purchase);
    } catch {
      setActionError('We couldn’t create the PDF. Try downloading it again.');
    } finally {
      setDownloading(false);
    }
  }

  let title = 'Checking your payment…';
  let message = '';
  if (unavailable || !reference) {
    title = 'Payment details unavailable';
    message = unavailable || 'Use the link from your checkout to see your payment details.';
  } else if (purchase) {
    [title, message] = paymentOutcomes[outcome];
    if (outcome === 'pending' && checkoutResult === 'cancelled') {
      title = 'Checkout not completed';
      message = 'You left Stripe before we could confirm the payment. We’ve saved your answers.';
    } else if (outcome === 'pending' && checkoutResult === 'success') {
      title = 'Waiting for payment confirmation';
      message = 'We’re waiting for Stripe to confirm your payment. Check again in a moment.';
    }
  } else if (checkError && !checking) {
    title = 'Couldn’t load payment details';
    message = 'Use the button below to check again.';
  }

  const receipt = outcome === 'paid' && stripeLink(purchase.receiptUrl, ['pay.stripe.com', 'receipts.stripe.com']);
  const canRetry = ['failed', 'incomplete', 'pending'].includes(outcome) && !(outcome === 'pending' && checkoutResult === 'success');

  return <div className="payment-status">
    <header className="payment-status__header"><div><Brand /><a href={returnUrl}>Back to calculator</a></div></header>
    <main className="payment-status__main">
      <section className="g2-purchase payment-status__card" aria-label="Audit payment">
        <div className="payment-status__banner" data-outcome={outcome}>
          <p className="eyebrow">AUDIT PAYMENT</p>
          <h1 aria-live="polite">{title}</h1>
          {message && <p>{message}</p>}
        </div>
        <div className="payment-status__body">
          {purchase && <dl className="payment-status__summary">
            <div><dt>Service</dt><dd>{purchase.item}</dd></div>
            <div><dt>{outcome === 'paid' ? 'Amount paid' : 'Audit amount'}</dt><dd>{money(purchase.amount / 100)} {purchase.currency.toUpperCase()}</dd></div>
            <div><dt>Purchase reference</dt><dd>{purchase.purchaseReference}</dd></div>
            {purchase.paidAt && <div><dt>Payment confirmed</dt><dd>{new Date(purchase.paidAt).toLocaleString()}</dd></div>}
          </dl>}
          {unavailable && reference && <p>Try the browser you used to pay. If you still can’t open your payment details, share your Stripe receipt with AOC so we can look it up.</p>}
          {actionError && <p role="alert" className="g2-purchase__error">{actionError}</p>}
          {(purchase || (checkError && !unavailable) || checking) && <div className="g2-purchase__actions g2-purchase__actions--documents">
            {receipt && <a className="payment-status__receipt" href={receipt} target="_blank" rel="noopener noreferrer">View Stripe receipt ↗</a>}
            {canRetry && <button className="primary" type="button" disabled={openingCheckout || checking} onClick={retryCheckout}>{openingCheckout ? 'Opening checkout…' : 'Continue payment'}</button>}
            {purchase && <button type="button" disabled={downloading} onClick={download}>{downloading ? 'Creating PDF…' : 'Download payment & estimate (PDF)'}</button>}
            <button type="button" disabled={openingCheckout || checking} onClick={() => load(undefined, true)}>{checking ? 'Checking payment…' : 'Refresh payment status'}</button>
          </div>}
          <PaymentCheckFeedback checking={checking} checkedAt={checkedAt} error={checkError} outcome={outcome} />
          {outcome === 'paid' && !receipt && <p className="helper">Your Stripe receipt isn’t ready yet. Check again in a moment.</p>}
          {purchase && <SavedPurchaseDetails purchase={purchase} />}
          <p className="g2-purchase__mode">{sandboxNotice}</p>
        </div>
      </section>
    </main>
  </div>;
}
