import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initCapacitor } from '@/lib/capacitor.js'

// Initialize Capacitor plugins (status bar, keyboard, back button, etc.)
initCapacitor();

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)
