import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Restore persisted UI density (Settings → Preferences) before first paint
try {
  const stored = localStorage.getItem('novogenics_density');
  if (stored === 'compact' || stored === 'comfortable') {
    document.body.setAttribute('data-density', stored);
  }
} catch { /* localStorage unavailable — ignore */ }

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
