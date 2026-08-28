import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App3D from './App3D';
import AppErrorBoundary from './components/AppErrorBoundary';
import { applyViewModeAttr, readStoredViewMode, autoViewMode } from './hooks/useViewMode';
import './i18n';
import './index.css';
import './3d-styles.css';

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
