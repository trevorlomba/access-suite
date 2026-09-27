import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AccessInput, SettingsProvider } from '@access-suite/access-ui';
import '@access-suite/access-ui/styles.css';
import './hub.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <AccessInput>
        <App />
      </AccessInput>
    </SettingsProvider>
  </StrictMode>,
);
