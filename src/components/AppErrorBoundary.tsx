import React from 'react'
import { logTelemetry } from '../observability'

type State = {
  hasError: boolean
  message: string
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = {
    hasError: false,
    message: ''
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message ?? 'Unknown frontend error'
    }
  }

  componentDidCatch(error: Error) {
    console.error('[app-error-boundary]', error)
    logTelemetry({
      level: 'error',
      event: 'app.error-boundary',
      message: error?.message ?? 'Unknown frontend error',
      stack: error?.stack
    })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="container" style={{ paddingTop: 64, paddingBottom: 64 }}>
        <div className="card" style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 12 }}>
          <div className="badge">
            <span style={{ color: 'var(--accent2)' }}>Recovery Notice</span>
          </div>
          <h1 className="h2">We hit a loading error.</h1>
          <p className="p" style={{ margin: 0 }}>
            Try reloading the page. If this keeps happening, the browser is likely using stale cached assets.
          </p>
          <div className="small" style={{ wordBreak: 'break-word' }}>{this.state.message}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="btn" href="/">Go Home</a>
          </div>
        </div>
      </div>
    )
  }
}
