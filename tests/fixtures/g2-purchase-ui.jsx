// Browser-component fixture only; not part of the production entry point.
import { createRoot } from 'react-dom/client';
import App from '../../src/App.jsx';
import { isPaymentStatusLocation } from '../../src/features/payments/payment-client.js';
import '../../src/styles/base.css';

const root = createRoot(document.getElementById('root'));
if (isPaymentStatusLocation(window.location)) root.render(<App />);
else {
  const { AuditCheckout } = await import('../../src/features/payments/AuditCheckout.jsx');
  const fixture = await (await fetch('/__g2_fixture')).json();
  root.render(<main style={{ maxWidth: 950, margin: '20px auto', padding: 12 }}>
    <AuditCheckout state={fixture.state} profile={fixture.profile} onNavigate={step => { window.testNavigation = step; }} />
  </main>);
}
