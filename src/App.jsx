import { lazy, Suspense } from 'react';
import { useAccessGate } from './features/access/useAccessGate.js';
import { useClientProfile } from './features/profiles/useClientProfile.js';
import { AccessGate } from './features/access/AccessGate.jsx';
import { Brand } from './components/Brand.jsx';
import { loadEstimatorRules } from './lib/loadEstimatorRules.js';
import { isPaymentStatusLocation } from './features/payments/payment-client.js';

function CalculatorLoading({ failed = false }) {
  return <>
    <header className="app-header"><Brand /></header>
    {!failed && <span className="calculator-loading__announcement" role="status">Opening calculator</span>}
    <main className="calculator-main calculator-loading" aria-label="Calculator" aria-busy={!failed}>
      {failed ? <div className="panel calculator-loading__error" role="alert">
        <h1>The calculator could not load</h1>
        <p>Reload the page to try again.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload calculator</button>
      </div> : <div aria-hidden="true">
        <div className="calculator-loading__intro">
          <div className="calculator-loading__heading" />
          <div className="calculator-loading__line" />
        </div>
        <div className="workspace">
          <div className="calculator-loading__steps" />
          <div className="panel">
            <div className="calculator-loading__heading" />
            <div className="calculator-loading__line" />
            <div className="areas calculator-loading__options">
              {Array.from({ length: 4 }, (_, index) => <div key={index} />)}
            </div>
          </div>
          <div className="estimate-card calculator-loading__estimate">
            <div className="calculator-loading__heading" />
            <div className="calculator-loading__line" />
            <div className="calculator-loading__line" />
          </div>
        </div>
      </div>}
    </main>
  </>;
}

const Calculator = lazy(async () => {
  try {
    await loadEstimatorRules();
    return await import('./features/calculator/Calculator.jsx');
  } catch {
    return { default: () => <CalculatorLoading failed /> };
  }
});

const PaymentStatusPage = import.meta.env.VITE_AOC_STRIPE_TEST_HANDOFF_ENABLED === 'true'
  ? lazy(() => import('./features/payments/PaymentStatusPage.jsx'))
  : null;

function EstimatorApp() {
  const access = useAccessGate();
  const profiles = useClientProfile(access.intakeOnly, access.profilesEnabled);
  if (access.loading) return <CalculatorLoading />;
  if (access.enabled && !access.authenticated) return <AccessGate access={access} profiles={profiles} />;
  return <Suspense fallback={<CalculatorLoading />}><Calculator access={access} profiles={profiles} /></Suspense>;
}

export default function App() {
  if (PaymentStatusPage && isPaymentStatusLocation(window.location)) {
    return <Suspense fallback={<main className="access-shell" role="status">Checking your payment…</main>}><PaymentStatusPage /></Suspense>;
  }
  return <EstimatorApp />;
}
