import { useAmbientAudio } from '../../components/useAmbientAudio'

export function AdminAudio() {
  const audio = useAmbientAudio()
  const intensityOptions = audio.preset === 'apocalypse'
    ? audio.intensityOptions
    : audio.intensityOptions.filter(level => level.id !== 'nightmare')

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Experience</div>
          <h1>Audio and Feedback</h1>
          <p className="admin-sub">Control ambient soundtrack, UI sound effects, and feedback tones.</p>
        </div>
      </div>

      <div className="admin-grid two">
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Ambient Audio</div>
          </div>
          <div className="admin-row" style={{ justifyContent: 'flex-start' }}>
            <button className="admin-btn primary" onClick={() => audio.setEnabled(v => !v)}>
              {audio.enabled ? 'Disable Ambient' : 'Enable Ambient'}
            </button>
          </div>
          <div className="admin-card-sub" style={{ marginTop: 10 }}>
            Source: {audio.mode === 'file' ? 'Preset track file' : audio.mode === 'synth' ? 'Synth fallback' : 'Off'}
          </div>
          <label className="admin-field" style={{ marginTop: 12 }}>
            <span>Preset</span>
            <select
              className="admin-select"
              value={audio.preset}
              onChange={e => audio.setPreset(e.currentTarget.value as typeof audio.preset)}
            >
              {audio.presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Preset Intensity</span>
            <select
              className="admin-select"
              value={audio.currentIntensity}
              onChange={e => audio.setCurrentIntensity(e.currentTarget.value as typeof audio.currentIntensity)}
            >
              {intensityOptions.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-card-sub" style={{ marginTop: 8 }}>
            Expected files:{' '}
            {(audio.presets.find(p => p.id === audio.preset)?.tracks ?? [])
              .map(track => track.path)
              .join(', ')}
          </div>
          {!audio.available && (
            <div className="admin-card-sub" style={{ marginTop: 6 }}>
              Preset track missing. Add matching file in `/public/audio/` and deploy.
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Sound Effects</div>
          </div>
          <div className="admin-row" style={{ justifyContent: 'flex-start' }}>
            <button className="admin-btn" onClick={() => audio.setSfxEnabled(v => !v)}>
              UI SFX: {audio.sfxEnabled ? 'On' : 'Off'}
            </button>
            <button className="admin-btn" onClick={audio.playSuccess}>Test Success</button>
            <button className="admin-btn danger" onClick={audio.playWarning}>Test Warning</button>
          </div>
          <label className="admin-field" style={{ marginTop: 12 }}>
            <span>Master Volume ({Math.round(audio.volume * 100)}%)</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audio.volume * 100)}
              onChange={e => audio.setVolume(Number(e.currentTarget.value) / 100)}
            />
          </label>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Auto Feedback</div>
        </div>
        <div className="admin-card-sub" style={{ marginTop: 8 }}>
          Save/update/delete actions in Admin now automatically trigger success/error tones.
        </div>
      </div>
    </div>
  )
}
