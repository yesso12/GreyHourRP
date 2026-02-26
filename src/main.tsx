import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/global.css'
import "./admin/styles/admin.css";

// GitHub Pages SPA fallback:
// 404.html redirects unknown routes to "/?p=<original-path>".
// Restore that path before React Router bootstraps.
const params = new URLSearchParams(window.location.search)
const redirectedPath = params.get('p')
if (redirectedPath) {
  const cleanPath = redirectedPath.startsWith('/') ? redirectedPath : `/${redirectedPath}`
  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
    window.location.replace('https://frenzynets.com/admin/')
  } else {
    const next = `${cleanPath}${window.location.hash || ''}`
    window.history.replaceState(null, '', next)
  }
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root container missing in index.html')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
