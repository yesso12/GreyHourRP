import { useEffect, useState } from 'react'
import { AdminSaveBar } from '../../components/AdminSaveBar'
import type { DiscordAutomationConfig } from '../api/client'
import { loadDiscordAutomation, saveDiscordAutomation } from '../api/client'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

const DEFAULT_CONFIG: DiscordAutomationConfig = {
  enabled: false,
  timezone: 'UTC',
  defaultChannelLabel: '#announcements',
  defaultChannelId: '',
  quietHoursStartUtc: 2,
  quietHoursEndUtc: 8,
  rotatingTemplates: [
    { id: uid('tpl'), title: 'Update', message: 'New update is now live.', enabled: true },
    { id: uid('tpl'), title: 'Event', message: 'Event starts soon. Join now.', enabled: true }
  ],
  schedules: [
    {
      id: uid('sch'),
      name: 'Daily Restart Reminder',
      timeUtc: '17:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      mentionEveryone: false,
      templateId: '',
      message: 'Daily reminder: server restart window starts soon. Secure your base and vehicle.',
      channelId: '',
      enabled: true
    }
  ],
  campaigns: [
    {
      id: uid('cmp'),
      name: 'Weekend Event Push',
      cadence: 'Weekly',
      audience: 'All players',
      callToAction: 'Join this weekend event',
      message: 'Weekend event lineup is live. Rally your faction and join in.',
      channelId: '',
      enabled: true
    }
  ],
  manualDispatches: []
}

export function AdminAutomation() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [data, setData] = useState<DiscordAutomationConfig>(DEFAULT_CONFIG)
  const enabledTone = data.enabled ? 'good' : 'bad'

  useEffect(() => {
    loadDiscordAutomation()
      .then(res => {
        setData({
          ...DEFAULT_CONFIG,
          ...res,
          rotatingTemplates: res?.rotatingTemplates?.length ? res.rotatingTemplates : DEFAULT_CONFIG.rotatingTemplates,
          schedules: res?.schedules?.length ? res.schedules : DEFAULT_CONFIG.schedules,
          campaigns: res?.campaigns?.length ? res.campaigns : DEFAULT_CONFIG.campaigns,
          manualDispatches: res?.manualDispatches ?? []
        })
      })
      .catch(() => {
        setData(DEFAULT_CONFIG)
      })
      .finally(() => setLoading(false))
  }, [])

  function update<K extends keyof DiscordAutomationConfig>(key: K, value: DiscordAutomationConfig[K]) {
    setData(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  function getTemplateMessage(templateId: string) {
    const found = data.rotatingTemplates.find(t => t.id === templateId && t.enabled)
    return found?.message?.trim() ?? ''
  }

  async function queueRunNow(sourceType: 'schedule' | 'campaign', sourceId: string) {
    const sourceSchedule = sourceType === 'schedule'
      ? data.schedules.find(s => s.id === sourceId)
      : null
    const sourceCampaign = sourceType === 'campaign'
      ? data.campaigns.find(c => c.id === sourceId)
      : null

    if (!sourceSchedule && !sourceCampaign) return

    const name = sourceSchedule?.name ?? sourceCampaign?.name ?? 'Manual Dispatch'
    const mentionEveryone = sourceSchedule?.mentionEveryone ?? false
    const channelId = sourceSchedule?.channelId ?? sourceCampaign?.channelId ?? data.defaultChannelId ?? ''
    const baseMessage = sourceSchedule
      ? (getTemplateMessage(sourceSchedule.templateId) || sourceSchedule.message || '')
      : sourceCampaign?.message || ''
    const cta = sourceCampaign?.callToAction ? `\n${sourceCampaign.callToAction}` : ''
    const message = `${baseMessage}${cta}`.trim()
    if (!message) {
      setError('Run now message is empty. Add template or custom message first.')
      return
    }

    const manualDispatches = [
      ...(data.manualDispatches ?? []),
      {
        id: uid('dispatch'),
        sourceType,
        sourceId,
        name,
        message,
        mentionEveryone,
        channelId,
        createdUtc: new Date().toISOString(),
        createdBy: 'admin-ui'
      }
    ]

    const nextData: DiscordAutomationConfig = {
      ...data,
      manualDispatches
    }

    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await saveDiscordAutomation(nextData)
      setData(nextData)
      setDirty(false)
      setNotice(`Queued "${name}" for immediate dispatch.`)
      setTimeout(() => setNotice(null), 3000)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveDiscordAutomation(data)
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-card">Loading automation config…</div>

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Automation</div>
          <h1>Campaign & Scheduling</h1>
          <p className="admin-sub">Quick actions first, advanced options only when you need them.</p>
        </div>
      </div>

      <div className="admin-grid four" style={{ marginBottom: 16 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Automation</div>
          </div>
          <div className={`admin-status ${enabledTone}`} style={{ marginTop: 6 }}>
            <span className="admin-status-dot" />
            {data.enabled ? 'Enabled' : 'Disabled'}
          </div>
          <div className="admin-card-value" style={{ fontSize: 22 }}>{data.enabled ? 'On' : 'Off'}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Templates</div>
          </div>
          <div className="admin-card-value">{data.rotatingTemplates.filter(x => x.enabled).length}</div>
          <div className="admin-card-sub">enabled</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Schedules</div>
          </div>
          <div className="admin-card-value">{data.schedules.filter(x => x.enabled).length}</div>
          <div className="admin-card-sub">enabled</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Campaigns</div>
          </div>
          <div className="admin-card-value">{data.campaigns.filter(x => x.enabled).length}</div>
          <div className="admin-card-sub">enabled</div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-grid three">
          <label className="admin-field checkbox">
            <input
              type="checkbox"
              checked={data.enabled}
              onChange={e => update('enabled', e.target.checked)}
            />
            <span>Automation Enabled</span>
          </label>
          <label className="admin-field">
            <span>Timezone</span>
            <input className="admin-input" value={data.timezone} onChange={e => update('timezone', e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Default Channel Label</span>
            <input className="admin-input" value={data.defaultChannelLabel} onChange={e => update('defaultChannelLabel', e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Default Channel ID</span>
            <input
              className="admin-input"
              value={data.defaultChannelId ?? ''}
              onChange={e => update('defaultChannelId', e.target.value)}
              placeholder="e.g. 1468772120669720640 or <#1468772120669720640>"
            />
          </label>
        </div>
        <div className="admin-grid two" style={{ marginTop: 12 }}>
          <label className="admin-field">
            <span>Quiet Hours Start (UTC)</span>
            <input
              className="admin-input"
              type="number"
              min={0}
              max={23}
              value={data.quietHoursStartUtc}
              onChange={e => update('quietHoursStartUtc', Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
            />
          </label>
          <label className="admin-field">
            <span>Quiet Hours End (UTC)</span>
            <input
              className="admin-input"
              type="number"
              min={0}
              max={23}
              value={data.quietHoursEndUtc}
              onChange={e => update('quietHoursEndUtc', Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
            />
          </label>
        </div>
      </div>

      <details className="admin-section" open>
        <summary className="admin-section-header"><h2>Rotating Templates</h2></summary>
        <div className="admin-list" style={{ marginTop: 8 }}>
          {data.rotatingTemplates.map(item => (
            <div key={item.id} className="admin-card">
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Title</span>
                  <input
                    className="admin-input"
                    value={item.title}
                    onChange={e => update(
                      'rotatingTemplates',
                      data.rotatingTemplates.map(t => t.id === item.id ? { ...t, title: e.target.value } : t)
                    )}
                  />
                </label>
                <label className="admin-field checkbox">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={e => update(
                      'rotatingTemplates',
                      data.rotatingTemplates.map(t => t.id === item.id ? { ...t, enabled: e.target.checked } : t)
                    )}
                  />
                  <span>Enabled</span>
                </label>
              </div>
              <label className="admin-field">
                <span>Message</span>
                <textarea
                  className="admin-textarea"
                  rows={4}
                  value={item.message}
                  onChange={e => update(
                    'rotatingTemplates',
                    data.rotatingTemplates.map(t => t.id === item.id ? { ...t, message: e.target.value } : t)
                  )}
                />
              </label>
              <div className="admin-row">
                <button
                  className="admin-btn danger"
                  onClick={() => update('rotatingTemplates', data.rotatingTemplates.filter(t => t.id !== item.id))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="admin-row">
          <button
            className="admin-btn"
            onClick={() => update('rotatingTemplates', [
              ...data.rotatingTemplates,
              { id: uid('tpl'), title: 'New Template', message: '', enabled: true }
            ])}
          >
            Add Template
          </button>
        </div>
      </details>

      <details className="admin-section" open>
        <summary className="admin-section-header"><h2>Scheduled Broadcasts</h2></summary>
        <div className="admin-list" style={{ marginTop: 8 }}>
          {data.schedules.map(item => (
            <div key={item.id} className="admin-card">
              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Name</span>
                  <input
                    className="admin-input"
                    value={item.name}
                    onChange={e => update(
                      'schedules',
                      data.schedules.map(s => s.id === item.id ? { ...s, name: e.target.value } : s)
                    )}
                  />
                </label>
                <label className="admin-field">
                  <span>UTC Time</span>
                  <input
                    className="admin-input"
                    value={item.timeUtc}
                    onChange={e => update(
                      'schedules',
                      data.schedules.map(s => s.id === item.id ? { ...s, timeUtc: e.target.value } : s)
                    )}
                    placeholder="18:30"
                  />
                </label>
                <label className="admin-field checkbox">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={e => update(
                      'schedules',
                      data.schedules.map(s => s.id === item.id ? { ...s, enabled: e.target.checked } : s)
                    )}
                  />
                  <span>Enabled</span>
                </label>
              </div>
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Template</span>
                  <select
                    className="admin-input"
                    value={item.templateId}
                    onChange={e => update(
                      'schedules',
                      data.schedules.map(s => s.id === item.id ? { ...s, templateId: e.target.value } : s)
                    )}
                  >
                    <option value="">Custom / none</option>
                    {data.rotatingTemplates.map(tpl => (
                      <option key={tpl.id} value={tpl.id}>{tpl.title}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field checkbox">
                  <input
                    type="checkbox"
                    checked={item.mentionEveryone}
                    onChange={e => update(
                      'schedules',
                      data.schedules.map(s => s.id === item.id ? { ...s, mentionEveryone: e.target.checked } : s)
                    )}
                  />
                  <span>Mention @everyone</span>
                </label>
              </div>
              <label className="admin-field">
                <span>Target Channel ID (optional)</span>
                <input
                  className="admin-input"
                  value={item.channelId ?? ''}
                  onChange={e => update(
                    'schedules',
                    data.schedules.map(s => s.id === item.id ? { ...s, channelId: e.target.value } : s)
                  )}
                  placeholder="Leave empty to use default channel"
                />
              </label>
              <label className="admin-field">
                <span>Custom Message Fallback</span>
                <textarea
                  className="admin-textarea"
                  rows={3}
                  value={item.message ?? ''}
                  onChange={e => update(
                    'schedules',
                    data.schedules.map(s => s.id === item.id ? { ...s, message: e.target.value } : s)
                  )}
                  placeholder="Used when no template is selected."
                />
              </label>
              <div className="admin-field">
                <span>Days</span>
                <div className="admin-row" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
                  {DAYS.map(day => (
                    <label key={day} className="admin-field checkbox" style={{ minWidth: 72 }}>
                      <input
                        type="checkbox"
                        checked={item.days.includes(day)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...item.days, day]
                            : item.days.filter(d => d !== day)
                          update(
                            'schedules',
                            data.schedules.map(s => s.id === item.id ? { ...s, days: next } : s)
                          )
                        }}
                      />
                      <span>{day}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="admin-row">
                <button className="admin-btn" onClick={() => queueRunNow('schedule', item.id)} disabled={saving}>
                  {saving ? 'Working…' : 'Run Now'}
                </button>
                <button className="admin-btn danger" onClick={() => update('schedules', data.schedules.filter(s => s.id !== item.id))}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="admin-row">
          <button
            className="admin-btn"
            onClick={() => update('schedules', [
              ...data.schedules,
              {
                id: uid('sch'),
                name: 'New Schedule',
                timeUtc: '18:00',
                days: ['Mon', 'Wed', 'Fri'],
                mentionEveryone: false,
                templateId: '',
                message: '',
                channelId: '',
                enabled: true
              }
            ])}
          >
            Add Schedule
          </button>
        </div>
      </details>

      <details className="admin-section">
        <summary className="admin-section-header"><h2>Campaign Presets</h2></summary>
        <div className="admin-list" style={{ marginTop: 8 }}>
          {data.campaigns.map(item => (
            <div key={item.id} className="admin-card">
              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Name</span>
                  <input
                    className="admin-input"
                    value={item.name}
                    onChange={e => update('campaigns', data.campaigns.map(c => c.id === item.id ? { ...c, name: e.target.value } : c))}
                  />
                </label>
                <label className="admin-field">
                  <span>Cadence</span>
                  <input
                    className="admin-input"
                    value={item.cadence}
                    onChange={e => update('campaigns', data.campaigns.map(c => c.id === item.id ? { ...c, cadence: e.target.value } : c))}
                  />
                </label>
                <label className="admin-field checkbox">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={e => update('campaigns', data.campaigns.map(c => c.id === item.id ? { ...c, enabled: e.target.checked } : c))}
                  />
                  <span>Enabled</span>
                </label>
              </div>
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Audience</span>
                  <input
                    className="admin-input"
                    value={item.audience}
                    onChange={e => update('campaigns', data.campaigns.map(c => c.id === item.id ? { ...c, audience: e.target.value } : c))}
                  />
                </label>
                <label className="admin-field">
                  <span>Call To Action</span>
                  <input
                    className="admin-input"
                    value={item.callToAction}
                    onChange={e => update('campaigns', data.campaigns.map(c => c.id === item.id ? { ...c, callToAction: e.target.value } : c))}
                  />
                </label>
              </div>
              <label className="admin-field">
                <span>Target Channel ID (optional)</span>
                <input
                  className="admin-input"
                  value={item.channelId ?? ''}
                  onChange={e => update('campaigns', data.campaigns.map(c => c.id === item.id ? { ...c, channelId: e.target.value } : c))}
                  placeholder="Leave empty to use default channel"
                />
              </label>
              <label className="admin-field">
                <span>Message</span>
                <textarea
                  className="admin-textarea"
                  rows={4}
                  value={item.message}
                  onChange={e => update('campaigns', data.campaigns.map(c => c.id === item.id ? { ...c, message: e.target.value } : c))}
                />
              </label>
              <div className="admin-row">
                <button className="admin-btn" onClick={() => queueRunNow('campaign', item.id)} disabled={saving}>
                  {saving ? 'Working…' : 'Run Now'}
                </button>
                <button className="admin-btn danger" onClick={() => update('campaigns', data.campaigns.filter(c => c.id !== item.id))}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="admin-row">
          <button
            className="admin-btn"
            onClick={() => update('campaigns', [
              ...data.campaigns,
              {
                id: uid('cmp'),
                name: 'New Campaign',
                cadence: 'Weekly',
                audience: 'All players',
                callToAction: 'Join now',
                message: '',
                enabled: true
              }
            ])}
          >
            Add Campaign
          </button>
        </div>
      </details>

      {notice && <div className="admin-notice success">{notice}</div>}
      <AdminSaveBar dirty={dirty} saving={saving} error={error} onSave={save} />
    </div>
  )
}
