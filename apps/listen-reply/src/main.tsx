import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AccessInput, SettingsProvider, registerOffline } from '@access-suite/access-ui';
import '@access-suite/access-ui/styles.css';
import '@access-suite/board/board.css';
import './listen.css';
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

registerOffline('../sw.js');
