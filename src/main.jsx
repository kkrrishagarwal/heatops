import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App3D from './App3D';
import AppErrorBoundary from './components/AppErrorBoundary';
import { applyViewModeAttr, readStoredViewMode, autoViewMode } from './hooks/useViewMode';
import './i18n';
import './index.css';
import './3d-styles.css';

// Second deployments (Render) serve only the static app; the serverless API lives on Vercel.
// When the page is not on Vercel or localhost, send same-origin /api/* calls to Vercel.
;(() => {
  try {
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app')) return
    const API = 'https://heatops.vercel.app'
    const orig = window.fetch.bind(window)
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.startsWith('/api/')) return orig(API + input, init)
      if (input instanceof Request && new URL(input.url).origin === window.location.origin && new URL(input.url).pathname.startsWith('/api/')) return orig(new Request(API + new URL(input.url).pathname + new URL(input.url).search, input), init)
      return orig(input, init)
    }
  } catch { /* keep the native fetch */ }
})()

// Stamp the view mode on <html> before the first render so the layout CSS is
// right from the first frame (no flash of the other layout).
applyViewModeAttr(readStoredViewMode() || autoViewMode());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App3D />
    </AppErrorBoundary>
    <Analytics />
  </React.StrictMode>
);
