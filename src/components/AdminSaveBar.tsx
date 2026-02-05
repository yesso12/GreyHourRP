type Props = {
  dirty: boolean
  saving: boolean
  error?: string | null
  onSave: () => void
}

export function AdminSaveBar({ dirty, saving, error, onSave }: Props) {
  if (!dirty && !saving && !error) return null

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 16,
        zIndex: 50,
        background: 'rgba(10,10,12,0.85)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        boxShadow: 'var(--shadow)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div style={{ flex: 1 }}>
        {saving && <span className="small">Saving…</span>}
        {!saving && dirty && <span className="small">Unsaved changes</span>}
        {error && (
          <span className="small" style={{ color: 'var(--bad)' }}>
            {error}
          </span>
        )}
      </div>

      <button
        className="btn btn-primary"
        disabled={!dirty || saving}
        onClick={onSave}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
