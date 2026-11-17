// Browser-component fixture only; not part of the production entry point.
import { createRoot } from 'react-dom/client';
import { TestPurchase } from '../../src/features/payments/TestPurchase.jsx';
import '../../src/styles/base.css';
const fixture=await (await fetch('/__g2_fixture')).json();
createRoot(document.getElementById('root')).render(<main style={{maxWidth:950,margin:'20px auto',padding:12}}>
  <TestPurchase state={fixture.state} profile={fixture.profile} onNavigate={step=>{window.testNavigation=step;}} />
</main>);
