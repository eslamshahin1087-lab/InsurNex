import './theme/client360-action-fix.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/tokens.css';
import './theme/mobile.css';
import './theme/theme-v2.css';
import './theme/client-edit.css';
import './theme/claim360-2.css';
import './theme/renewals2.css';
import './theme/policy-modal-viewport-fix.css';
import './theme/policies2-relations.css';
import './theme/client360-s8.css';
import './theme/insurer-dropdown-fix.css';
import './theme/sprint8-2.css';
import './theme/sprint8-3.css';
import App from './App';
import './theme/insurnex-design-system.css';
import { ThemeProvider } from './theme/ThemeProvider';

// Register the privacy-safe PWA worker only for production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.warn('InsurNex service worker registration failed.', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
