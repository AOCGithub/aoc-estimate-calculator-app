import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App.jsx';
import { performanceOrigin, sanitizePerformanceEvent } from './lib/speedInsights.js';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {import.meta.env.PROD && window.location.origin === performanceOrigin && (
      <SpeedInsights route="/" debug={false} beforeSend={sanitizePerformanceEvent} />
    )}
  </StrictMode>,
);
