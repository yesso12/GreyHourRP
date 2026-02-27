import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { initObservability } from './observability'
import './styles/global.css'
import "./admin/styles/admin.css";

// GitHub Pages SPA fallback:
// 404.html redirects unknown routes to "/?p=<original-path>".
// Restore that path before React Router bootstraps.
const params = new URLSearchParams(window.location.search)
const redirectedPath = params.get('p')
if (redirectedPath) {
  const cleanPath = redirectedPath.startsWith('/') ? redirectedPath : `/${redirectedPath}`
  const next = `${cleanPath}${window.location.hash || ''}`
  window.history.replaceState(null, '', next)
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root container missing in index.html')
}

initObservability()

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
)
