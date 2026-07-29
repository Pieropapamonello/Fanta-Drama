import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').then((registration) => registration.update()) })

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
