import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './theme/tokens.css';
import './theme/mobile.css';

import App from './App';

createRoot(
  document.getElementById('root')!
).render(
  <StrictMode>
    <App />
  </StrictMode>
);