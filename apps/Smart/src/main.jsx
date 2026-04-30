// Catch any JS errors before React mounts and display them visibly
window.__sfos_error = null;
window.onerror = function(msg, src, line, col, err) {
  window.__sfos_error = err || msg;
  const root = document.getElementById('root');
  if (root && !root.innerHTML) {
    root.innerHTML = '<div style="padding:2rem;font-family:monospace;color:#c00;background:#fff;white-space:pre-wrap">'
      + '<b>SmartFixOS — Fatal Error</b>\n\n' + String(err || msg) + '\n' + src + ':' + line + '</div>';
  }
};
window.onunhandledrejection = function(e) {
  const root = document.getElementById('root');
  if (root && !root.innerHTML) {
    root.innerHTML = '<div style="padding:2rem;font-family:monospace;color:#c00;background:#fff;white-space:pre-wrap">'
      + '<b>SmartFixOS — Unhandled Promise Rejection</b>\n\n' + String(e.reason) + '</div>';
  }
};

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/native-ios-styles.css'
import { initCapacitor } from '@/lib/capacitor.js'

// Initialize Capacitor plugins (status bar, keyboard, back button, etc.)
initCapacitor();

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)
