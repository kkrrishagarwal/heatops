import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App3D from './App3D';
import './i18n';
import './index.css';
import './3d-styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App3D />
    <Analytics />
  </React.StrictMode>
);
