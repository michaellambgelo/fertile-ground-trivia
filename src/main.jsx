import './deck-stage.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ControlApp from './ControlApp.jsx';

const isControl = window.location.hash.startsWith('#/control');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isControl ? <ControlApp /> : <App />}
  </React.StrictMode>
);

// Reload when the hash changes so each mode boots cleanly.
window.addEventListener('hashchange', () => window.location.reload());
