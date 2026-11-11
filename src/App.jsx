import { lazy, Suspense } from 'react';
import { useAccessGate } from './features/access/useAccessGate.js';
import { useClientProfile } from './features/profiles/useClientProfile.js';
import { AccessGate } from './features/access/AccessGate.jsx';
import { Brand } from './components/Brand.jsx';
import { loadEstimatorRules } from './lib/loadEstimatorRules.js';

function CalculatorLoading({ failed = false }) {
  return <div className="access-page">
    <header className="access-header"><Brand /></header>
    <main className="access-shell" aria-busy={!failed}>
      <div role={failed ? 'alert' : 'status'}>
        <p>{failed ? 'The calculator could not load. Please reload to try again.' : 'Loading calculator…'}</p>
        {failed && <button type="button" onClick={() => window.location.reload()}>Reload calculator</button>}
      </div>
    </main>
  </div>;
}

const Calculator = lazy(async () => {
  try {
    await loadEstimatorRules();
    return await import('./features/calculator/Calculator.jsx');
  } catch {
    return { default: () => <CalculatorLoading failed /> };
  }
});

export default function App() {
  const access = useAccessGate();
  const profiles = useClientProfile(access.intakeOnly, access.profilesEnabled);
  if (access.enabled && !access.authenticated) return <AccessGate access={access} profiles={profiles} />;
  return <Suspense fallback={<CalculatorLoading />}><Calculator access={access} profiles={profiles} /></Suspense>;
}
