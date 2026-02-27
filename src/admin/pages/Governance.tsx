import { useEffect, useMemo, useState } from 'react'
import { AdminSaveBar } from '../../components/AdminSaveBar'
import { getContent, saveContent } from '../api/client'

type LawEntry = {
  id: string
  title: string
  category: string
  description: string
  penalty: string
  active: boolean
}

type WarrantEntry = {
  id: string
  target: string
  reason: string
  status: 'active' | 'served' | 'expired' | 'cancelled'
  issuedBy: string
  issuedUtc: string
  expiresUtc: string
}

type PropertyRecord = {
  id: string
  name: string
  zone: string
  type: string
  owner: string
  status: 'public' | 'private' | 'government'
  taxRate: number
  securityTier: string
  notes: string
}

type TreasuryEntry = {
  id: string
  timeUtc: string
  type: 'income' | 'expense'
  category: string
  amount: number
  description: string
  reference: string
}

type LawsPayload = {
  laws: LawEntry[]
  warrants: WarrantEntry[]
  updatedUtc: string
}

type PropertyPayload = {
  properties: PropertyRecord[]
  updatedUtc: string
}

type TreasuryPayload = {
  openingBalance: number
  entries: TreasuryEntry[]
  updatedUtc: string
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function defaultLawsPayload(): LawsPayload {
  return {
    laws: [],
    warrants: [],
    updatedUtc: new Date().toISOString()
  }
}

function defaultPropertyPayload(): PropertyPayload {
  return {
    properties: [],
    updatedUtc: new Date().toISOString()
  }
}

function defaultTreasuryPayload(): TreasuryPayload {
  return {
    openingBalance: 0,
    entries: [],
    updatedUtc: new Date().toISOString()
  }
}

export function AdminGovernance() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lawsData, setLawsData] = useState<LawsPayload>(defaultLawsPayload())
  const [propertyData, setPropertyData] = useState<PropertyPayload>(defaultPropertyPayload())
  const [treasuryData, setTreasuryData] = useState<TreasuryPayload>(defaultTreasuryPayload())

  useEffect(() => {
    Promise.all([
      getContent<LawsPayload>('laws-warrants').catch(() => defaultLawsPayload()),
      getContent<PropertyPayload>('property-registry').catch(() => defaultPropertyPayload()),
      getContent<TreasuryPayload>('treasury-ledger').catch(() => defaultTreasuryPayload())
    ])
      .then(([laws, properties, treasury]) => {
        setLawsData({ ...defaultLawsPayload(), ...laws, laws: laws.laws ?? [], warrants: laws.warrants ?? [] })
        setPropertyData({ ...defaultPropertyPayload(), ...properties, properties: properties.properties ?? [] })
        setTreasuryData({ ...defaultTreasuryPayload(), ...treasury, entries: treasury.entries ?? [] })
      })
      .finally(() => setLoading(false))
  }, [])

  const currentBalance = useMemo(() => {
    const delta = (treasuryData.entries ?? []).reduce((sum, entry) => {
      const amount = Number(entry.amount) || 0
      return entry.type === 'income' ? sum + amount : sum - amount
    }, 0)
    return Number(treasuryData.openingBalance || 0) + delta
  }, [treasuryData])

  function markDirty() {
    setDirty(true)
  }

  function addLaw() {
    const next: LawEntry = {
      id: newId('law'),
      title: 'New statute',
      category: 'criminal',
      description: '',
      penalty: '',
      active: true
    }
    setLawsData(prev => ({ ...prev, laws: [next, ...prev.laws] }))
    markDirty()
  }

  function addWarrant() {
    const now = new Date()
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const next: WarrantEntry = {
      id: newId('warrant'),
      target: '',
      reason: '',
      status: 'active',
      issuedBy: '',
      issuedUtc: now.toISOString(),
      expiresUtc: expires.toISOString()
    }
    setLawsData(prev => ({ ...prev, warrants: [next, ...prev.warrants] }))
    markDirty()
  }

  function addProperty() {
    const next: PropertyRecord = {
      id: newId('prop'),
      name: 'Town Hall Annex',
      zone: 'Louisville',
      type: 'civic',
      owner: 'Town Council',
      status: 'government',
      taxRate: 0,
      securityTier: 'high',
      notes: ''
    }
    setPropertyData(prev => ({ ...prev, properties: [next, ...prev.properties] }))
    markDirty()
  }

  function addTreasuryEntry() {
    const next: TreasuryEntry = {
      id: newId('ledger'),
      timeUtc: new Date().toISOString(),
      type: 'income',
      category: 'permit',
      amount: 100,
      description: '',
      reference: ''
    }
    setTreasuryData(prev => ({ ...prev, entries: [next, ...prev.entries] }))
    markDirty()
  }

  function applyEmergencyTemplate() {
    if (!confirm('Apply Emergency Session template?')) return
    const now = new Date().toISOString()
    setLawsData(prev => ({
      ...prev,
      laws: [
        {
          id: newId('law'),
          title: 'Emergency Curfew',
          category: 'public-order',
          description: 'Temporary nighttime curfew authorized during active threats.',
          penalty: 'Fine or detention',
          active: true
        },
        ...prev.laws
      ],
      warrants: [
        {
          id: newId('warrant'),
          target: '',
          reason: 'Emergency detention order',
          status: 'active',
          issuedBy: 'Town Council',
          issuedUtc: now,
          expiresUtc: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        },
        ...prev.warrants
      ]
    }))
    setTreasuryData(prev => ({
      ...prev,
      entries: [
        {
          id: newId('ledger'),
          timeUtc: now,
          type: 'expense',
          category: 'emergency-response',
          amount: 500,
          description: 'Emergency supplies and mobilization.',
          reference: 'EMERG-SESSION'
        },
        ...prev.entries
      ]
    }))
    markDirty()
  }

  function applyElectionTemplate() {
    if (!confirm('Apply Election Day template?')) return
    const now = new Date().toISOString()
    setLawsData(prev => ({
      ...prev,
      laws: [
        {
          id: newId('law'),
          title: 'Election Integrity Act',
          category: 'governance',
          description: 'Defines polling rules, counting standards, and anti-fraud penalties.',
          penalty: 'Office ban and fines',
          active: true
        },
        ...prev.laws
      ]
    }))
    setTreasuryData(prev => ({
      ...prev,
      entries: [
        {
          id: newId('ledger'),
          timeUtc: now,
          type: 'expense',
          category: 'election',
          amount: 300,
          description: 'Polling station setup and staffing.',
          reference: 'ELECT-DAY'
        },
        ...prev.entries
      ]
    }))
    markDirty()
  }

  function applyTownHallBootstrapTemplate() {
    if (!confirm('Apply Town Hall Bootstrap template?')) return
    setPropertyData(prev => ({
      ...prev,
      properties: [
        {
          id: newId('prop'),
          name: 'Town Hall',
          zone: 'Central District',
          type: 'government-hub',
          owner: 'Town Council',
          status: 'government',
          taxRate: 0,
          securityTier: 'critical',
          notes: 'Primary political operations center and records archive.'
        },
        {
          id: newId('prop'),
          name: 'Municipal Court',
          zone: 'Central District',
          type: 'judicial',
          owner: 'Town Council',
          status: 'government',
          taxRate: 0,
          securityTier: 'high',
          notes: 'Courtroom, records, detention intake.'
        },
        ...prev.properties
      ]
    }))
    setTreasuryData(prev => ({
      ...prev,
      entries: [
        {
          id: newId('ledger'),
          timeUtc: new Date().toISOString(),
          type: 'expense',
          category: 'infrastructure',
          amount: 1000,
          description: 'Town Hall startup construction and security budget.',
          reference: 'TOWNHALL-BOOTSTRAP'
        },
        ...prev.entries
      ]
    }))
    markDirty()
  }

  async function saveAll() {
    setSaving(true)
    setError(null)
    const updatedUtc = new Date().toISOString()
    try {
      await Promise.all([
        saveContent('laws-warrants', { ...lawsData, updatedUtc }),
        saveContent('property-registry', { ...propertyData, updatedUtc }),
        saveContent('treasury-ledger', { ...treasuryData, updatedUtc })
      ])
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-card">Loading governance modules…</div>

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Government</div>
          <h1>Laws, Registry, Treasury</h1>
          <p className="admin-sub">High-impact political tools for court, property control, and public finance.</p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={addLaw}>Add law</button>
          <button className="admin-btn" onClick={addWarrant}>Add warrant</button>
          <button className="admin-btn" onClick={addProperty}>Add property</button>
          <button className="admin-btn" onClick={addTreasuryEntry}>Add ledger entry</button>
          <button className="admin-btn" onClick={applyEmergencyTemplate}>Template: Emergency Session</button>
          <button className="admin-btn" onClick={applyElectionTemplate}>Template: Election Day</button>
          <button className="admin-btn" onClick={applyTownHallBootstrapTemplate}>Template: Town Hall Bootstrap</button>
        </div>
      </div>

      {error && <div className="admin-card" style={{ color: 'var(--bad)' }}>{error}</div>}

      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Laws and Warrants</h2>
        </div>
        <div className="admin-list">
          {lawsData.laws.map((law, index) => (
            <div key={law.id} className="admin-card">
              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Title</span>
                  <input className="admin-input" value={law.title} onChange={e => {
                    const laws = [...lawsData.laws]
                    laws[index] = { ...laws[index], title: e.target.value }
                    setLawsData(prev => ({ ...prev, laws }))
                    markDirty()
                  }} />
                </label>
                <label className="admin-field">
                  <span>Category</span>
                  <input className="admin-input" value={law.category} onChange={e => {
                    const laws = [...lawsData.laws]
                    laws[index] = { ...laws[index], category: e.target.value }
                    setLawsData(prev => ({ ...prev, laws }))
                    markDirty()
                  }} />
                </label>
                <label className="admin-field">
                  <span>Penalty</span>
                  <input className="admin-input" value={law.penalty} onChange={e => {
                    const laws = [...lawsData.laws]
                    laws[index] = { ...laws[index], penalty: e.target.value }
                    setLawsData(prev => ({ ...prev, laws }))
                    markDirty()
                  }} />
                </label>
              </div>
              <label className="admin-field">
                <span>Description</span>
                <textarea className="admin-input" rows={2} value={law.description} onChange={e => {
                  const laws = [...lawsData.laws]
                  laws[index] = { ...laws[index], description: e.target.value }
                  setLawsData(prev => ({ ...prev, laws }))
                  markDirty()
                }} />
              </label>
              <div className="admin-actions" style={{ justifyContent: 'space-between' }}>
                <label className="admin-field checkbox" style={{ margin: 0 }}>
                  <input type="checkbox" checked={law.active} onChange={e => {
                    const laws = [...lawsData.laws]
                    laws[index] = { ...laws[index], active: e.target.checked }
                    setLawsData(prev => ({ ...prev, laws }))
                    markDirty()
                  }} />
                  <span>Active</span>
                </label>
                <button className="admin-btn ghost" onClick={() => {
                  if (!confirm('Delete this law?')) return
                  setLawsData(prev => ({ ...prev, laws: prev.laws.filter((_, i) => i !== index) }))
                  markDirty()
                }}>Delete</button>
              </div>
            </div>
          ))}
          {lawsData.laws.length === 0 && <div className="admin-card">No laws yet. Click Add law.</div>}
        </div>

        <div className="admin-list" style={{ marginTop: 12 }}>
          {lawsData.warrants.map((warrant, index) => (
            <div key={warrant.id} className="admin-card">
              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Target</span>
                  <input className="admin-input" value={warrant.target} onChange={e => {
                    const warrants = [...lawsData.warrants]
                    warrants[index] = { ...warrants[index], target: e.target.value }
                    setLawsData(prev => ({ ...prev, warrants }))
                    markDirty()
                  }} />
                </label>
                <label className="admin-field">
                  <span>Issued by</span>
                  <input className="admin-input" value={warrant.issuedBy} onChange={e => {
                    const warrants = [...lawsData.warrants]
                    warrants[index] = { ...warrants[index], issuedBy: e.target.value }
                    setLawsData(prev => ({ ...prev, warrants }))
                    markDirty()
                  }} />
                </label>
                <label className="admin-field">
                  <span>Status</span>
                  <select className="admin-input" value={warrant.status} onChange={e => {
                    const warrants = [...lawsData.warrants]
                    warrants[index] = { ...warrants[index], status: e.target.value as WarrantEntry['status'] }
                    setLawsData(prev => ({ ...prev, warrants }))
                    markDirty()
                  }}>
                    <option value="active">Active</option>
                    <option value="served">Served</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>
              <label className="admin-field">
                <span>Reason</span>
                <textarea className="admin-input" rows={2} value={warrant.reason} onChange={e => {
                  const warrants = [...lawsData.warrants]
                  warrants[index] = { ...warrants[index], reason: e.target.value }
                  setLawsData(prev => ({ ...prev, warrants }))
                  markDirty()
                }} />
              </label>
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Issued UTC</span>
                  <input className="admin-input" value={warrant.issuedUtc} onChange={e => {
                    const warrants = [...lawsData.warrants]
                    warrants[index] = { ...warrants[index], issuedUtc: e.target.value }
                    setLawsData(prev => ({ ...prev, warrants }))
                    markDirty()
                  }} />
                </label>
                <label className="admin-field">
                  <span>Expires UTC</span>
                  <input className="admin-input" value={warrant.expiresUtc} onChange={e => {
                    const warrants = [...lawsData.warrants]
                    warrants[index] = { ...warrants[index], expiresUtc: e.target.value }
                    setLawsData(prev => ({ ...prev, warrants }))
                    markDirty()
                  }} />
                </label>
              </div>
              <div className="admin-actions">
                <button className="admin-btn ghost" onClick={() => {
                  if (!confirm('Delete this warrant?')) return
                  setLawsData(prev => ({ ...prev, warrants: prev.warrants.filter((_, i) => i !== index) }))
                  markDirty()
                }}>Delete</button>
              </div>
            </div>
          ))}
          {lawsData.warrants.length === 0 && <div className="admin-card">No warrants yet. Click Add warrant.</div>}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Property Registry</h2>
        </div>
        <div className="admin-list">
          {propertyData.properties.map((row, index) => (
            <div key={row.id} className="admin-card">
              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Property name</span>
                  <input className="admin-input" value={row.name} onChange={e => {
                    const properties = [...propertyData.properties]
                    properties[index] = { ...properties[index], name: e.target.value }
                    setPropertyData(prev => ({ ...prev, properties }))
                    markDirty()
                  }} />
                </label>
                <label className="admin-field">
                  <span>Zone</span>
                  <input className="admin-input" value={row.zone} onChange={e => {
                    const properties = [...propertyData.properties]
                    properties[index] = { ...properties[index], zone: e.target.value }
                    setPropertyData(prev => ({ ...prev, properties }))
                    markDirty()
                  }} />
                </label>
                <label className="admin-field">
                  <span>Type</span>
                  <input className="admin-input" value={row.type} onChange={e => {
                    const properties = [...propertyData.properties]
                    properties[index] = { ...properties[index], type: e.target.value }
                    setPropertyData(prev => ({ ...prev, properties }))
                    markDirty()
                  }} />
                </label>
              </div>
              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Owner</span>
                  <input className="admin-input" value={row.owner} onChange={e => {
                    const properties = [...propertyData.properties]
                    properties[index] = { ...properties[index], owner: e.target.value }
                    setPropertyData(prev => ({ ...prev, properties }))
                    markDirty()
                  }} />
                </label>
                <label className="admin-field">
                  <span>Status</span>
                  <select className="admin-input" value={row.status} onChange={e => {
                    const properties = [...propertyData.properties]
                    properties[index] = { ...properties[index], status: e.target.value as PropertyRecord['status'] }
                    setPropertyData(prev => ({ ...prev, properties }))
                    markDirty()
                  }}>
                    <option value="government">Government</option>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </label>
                <label className="admin-field">
                  <span>Tax rate %</span>
                  <input className="admin-input" type="number" value={row.taxRate} onChange={e => {
                    const properties = [...propertyData.properties]
                    properties[index] = { ...properties[index], taxRate: Number(e.target.value) || 0 }
                    setPropertyData(prev => ({ ...prev, properties }))
                    markDirty()
                  }} />
                </label>
              </div>
              <label className="admin-field">
                <span>Security tier</span>
                <input className="admin-input" value={row.securityTier} onChange={e => {
                  const properties = [...propertyData.properties]
                  properties[index] = { ...properties[index], securityTier: e.target.value }
                  setPropertyData(prev => ({ ...prev, properties }))
                  markDirty()
                }} />
              </label>
              <label className="admin-field">
                <span>Notes</span>
                <textarea className="admin-input" rows={2} value={row.notes} onChange={e => {
                  const properties = [...propertyData.properties]
                  properties[index] = { ...properties[index], notes: e.target.value }
                  setPropertyData(prev => ({ ...prev, properties }))
                  markDirty()
                }} />
              </label>
              <div className="admin-actions">
                <button className="admin-btn ghost" onClick={() => {
                  if (!confirm('Delete this property record?')) return
                  setPropertyData(prev => ({ ...prev, properties: prev.properties.filter((_, i) => i !== index) }))
                  markDirty()
                }}>Delete</button>
              </div>
            </div>
          ))}
          {propertyData.properties.length === 0 && <div className="admin-card">No properties yet. Click Add property.</div>}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Treasury Ledger</h2>
        </div>
        <div className="admin-card">
          <div className="admin-grid three">
            <label className="admin-field">
              <span>Opening balance</span>
              <input className="admin-input" type="number" value={treasuryData.openingBalance} onChange={e => {
                setTreasuryData(prev => ({ ...prev, openingBalance: Number(e.target.value) || 0 }))
                markDirty()
              }} />
            </label>
            <div className="admin-field">
              <span>Current balance</span>
              <input className="admin-input" value={currentBalance.toFixed(2)} readOnly />
            </div>
            <div className="admin-field">
              <span>Entries</span>
              <input className="admin-input" value={`${treasuryData.entries.length}`} readOnly />
            </div>
          </div>
        </div>
        <div className="admin-list">
          {treasuryData.entries.map((entry, index) => (
            <div key={entry.id} className="admin-card">
              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Type</span>
                  <select className="admin-input" value={entry.type} onChange={e => {
                    const entries = [...treasuryData.entries]
                    entries[index] = { ...entries[index], type: e.target.value as TreasuryEntry['type'] }
                    setTreasuryData(prev => ({ ...prev, entries }))
                    markDirty()
                  }}>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </label>
                <label className="admin-field">
                  <span>Category</span>
                  <input className="admin-input" value={entry.category} onChange={e => {
                    const entries = [...treasuryData.entries]
                    entries[index] = { ...entries[index], category: e.target.value }
                    setTreasuryData(prev => ({ ...prev, entries }))
                    markDirty()
                  }} />
                </label>
                <label className="admin-field">
                  <span>Amount</span>
                  <input className="admin-input" type="number" value={entry.amount} onChange={e => {
                    const entries = [...treasuryData.entries]
                    entries[index] = { ...entries[index], amount: Number(e.target.value) || 0 }
                    setTreasuryData(prev => ({ ...prev, entries }))
                    markDirty()
                  }} />
                </label>
              </div>
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Description</span>
                  <input className="admin-input" value={entry.description} onChange={e => {
                    const entries = [...treasuryData.entries]
                    entries[index] = { ...entries[index], description: e.target.value }
                    setTreasuryData(prev => ({ ...prev, entries }))
                    markDirty()
                  }} />
                </label>
                <label className="admin-field">
                  <span>Reference</span>
                  <input className="admin-input" value={entry.reference} onChange={e => {
                    const entries = [...treasuryData.entries]
                    entries[index] = { ...entries[index], reference: e.target.value }
                    setTreasuryData(prev => ({ ...prev, entries }))
                    markDirty()
                  }} />
                </label>
              </div>
              <label className="admin-field">
                <span>Time UTC</span>
                <input className="admin-input" value={entry.timeUtc} onChange={e => {
                  const entries = [...treasuryData.entries]
                  entries[index] = { ...entries[index], timeUtc: e.target.value }
                  setTreasuryData(prev => ({ ...prev, entries }))
                  markDirty()
                }} />
              </label>
              <div className="admin-actions">
                <button className="admin-btn ghost" onClick={() => {
                  if (!confirm('Delete this ledger entry?')) return
                  setTreasuryData(prev => ({ ...prev, entries: prev.entries.filter((_, i) => i !== index) }))
                  markDirty()
                }}>Delete</button>
              </div>
            </div>
          ))}
          {treasuryData.entries.length === 0 && <div className="admin-card">No ledger entries yet. Click Add ledger entry.</div>}
        </div>
      </div>

      <AdminSaveBar
        dirty={dirty}
        saving={saving}
        error={error}
        onSave={() => { void saveAll() }}
      />
    </div>
  )
}
