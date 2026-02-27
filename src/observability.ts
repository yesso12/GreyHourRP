type TelemetryLevel = 'info' | 'warn' | 'error'

type TelemetryPayload = {
  level: TelemetryLevel
  event: string
  message?: string
  path?: string
  stack?: string
  userAgent?: string
  ts: string
}

function telemetryEndpoint() {
  return import.meta.env.VITE_OBSERVABILITY_ENDPOINT as string | undefined
}

function sendTelemetry(payload: TelemetryPayload) {
  const endpoint = telemetryEndpoint()
  if (!endpoint) return

  const body = JSON.stringify(payload)

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon(endpoint, blob)
    return
  }

  void fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {})
}

export function logTelemetry(input: Omit<TelemetryPayload, 'ts' | 'userAgent'> & { path?: string }) {
  sendTelemetry({
    ...input,
    path: input.path ?? window.location.pathname,
    userAgent: navigator.userAgent,
    ts: new Date().toISOString()
  })
}

export function initObservability() {
  window.addEventListener('error', (event) => {
    sendTelemetry({
      level: 'error',
      event: 'window.error',
      message: event.message,
      path: window.location.pathname,
      stack: event.error?.stack,
      userAgent: navigator.userAgent,
      ts: new Date().toISOString()
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error
      ? `${event.reason.name}: ${event.reason.message}`
      : String(event.reason)

    sendTelemetry({
      level: 'error',
      event: 'window.unhandledrejection',
      message: reason,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      ts: new Date().toISOString()
    })
  })

  sendTelemetry({
    level: 'info',
    event: 'app.start',
    path: window.location.pathname,
    userAgent: navigator.userAgent,
    ts: new Date().toISOString()
  })
}
