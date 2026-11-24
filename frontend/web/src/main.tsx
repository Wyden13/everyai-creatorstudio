import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CreatorStudioApp } from './creator-studio';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root mount element');
}

const preview = new URLSearchParams(window.location.search).get('preview') === '1';

createRoot(rootEl).render(
  <StrictMode>
    <CreatorStudioApp preview={preview} />
  </StrictMode>,
);
