import { useCallback, useEffect, useRef, useState } from 'react'

type AmbientMode = 'file' | 'synth' | 'off'
export type AmbientPreset = 'apocalypse' | 'dusk' | 'tension' | 'safehouse'
export type AmbientIntensity = 'low' | 'medium' | 'high' | 'nightmare'
type AmbientTrack = { path: string; fallbackPath?: string }

type SynthNodes = {
  ctx: AudioContext
  master: GainNode
  droneA: OscillatorNode
  droneB: OscillatorNode
  wobble: OscillatorNode
  wobbleGain: GainNode
}

type SfxNodes = {
  ctx: AudioContext
  gain: GainNode
}

const KEY_ENABLED = 'gh_audio_enabled_v2'
const KEY_VOLUME = 'gh_audio_volume_v2'
const KEY_SFX = 'gh_audio_sfx_v2'
const KEY_PRESET = 'gh_audio_preset_v2'
const KEY_PRESET_INTENSITY = 'gh_audio_preset_intensity_v2'

const INTENSITY_GAIN: Record<AmbientIntensity, number> = {
  low: 0.75,
  medium: 1.0,
  high: 1.22,
  nightmare: 1.42
}

const DEFAULT_PRESET_INTENSITY: Record<AmbientPreset, AmbientIntensity> = {
  apocalypse: 'high',
  dusk: 'medium',
  tension: 'medium',
  safehouse: 'medium'
}

export const AMBIENT_PRESETS: Array<{ id: AmbientPreset; label: string; tracks: AmbientTrack[] }> = [
  {
    id: 'apocalypse',
    label: 'Dead Zone',
    tracks: [
      { path: '/audio/apocalypse.wav', fallbackPath: '/audio/apocalypse.wav' }
    ]
  },
  { id: 'dusk', label: 'Dusk', tracks: [{ path: '/audio/dusk.ogg', fallbackPath: '/audio/dusk.wav' }] },
  { id: 'tension', label: 'Stalker', tracks: [{ path: '/audio/tension.wav', fallbackPath: '/audio/tension.wav' }] },
  { id: 'safehouse', label: 'Safehouse', tracks: [{ path: '/audio/safehouse.ogg', fallbackPath: '/audio/safehouse.wav' }] }
]

function isPreset(value: string): value is AmbientPreset {
  return value === 'apocalypse' || value === 'dusk' || value === 'tension' || value === 'safehouse'
}

function presetPaths(preset: AmbientPreset) {
  const selected = AMBIENT_PRESETS.find(p => p.id === preset)
  if (!selected || selected.tracks.length === 0) return ['/audio/apocalypse.wav']

  // Prefer OGG for quality/size, but transparently fall back to WAV when needed.
  const probe = document.createElement('audio')
  const canPlayOgg = !!probe.canPlayType('audio/ogg; codecs="vorbis"')
  return selected.tracks.map(track => {
    if (canPlayOgg) return track.path
    return track.fallbackPath ?? track.path
  })
}

function readBool(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    return v === '1'
  } catch {
    return fallback
  }
}

function readVolume() {
  try {
    const raw = localStorage.getItem(KEY_VOLUME)
    if (!raw) return 0.22
    const n = Number(raw)
    if (!Number.isFinite(n)) return 0.22
    return Math.min(1, Math.max(0, n))
  } catch {
    return 0.22
  }
}

function readPreset() {
  try {
    const raw = localStorage.getItem(KEY_PRESET)
    if (!raw) return 'apocalypse' as AmbientPreset
    return isPreset(raw) ? raw : ('apocalypse' as AmbientPreset)
  } catch {
    return 'apocalypse' as AmbientPreset
  }
}

function isIntensity(value: string): value is AmbientIntensity {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'nightmare'
}

function readPresetIntensity() {
  try {
    const raw = localStorage.getItem(KEY_PRESET_INTENSITY)
    if (!raw) return { ...DEFAULT_PRESET_INTENSITY }
    const parsed = JSON.parse(raw) as Partial<Record<AmbientPreset, string>>
    const apocalypseRaw = parsed.apocalypse
    const duskRaw = parsed.dusk
    const tensionRaw = parsed.tension
    const safehouseRaw = parsed.safehouse
    return {
      apocalypse: isIntensity(apocalypseRaw ?? '') ? (apocalypseRaw as AmbientIntensity) : 'high',
      dusk: isIntensity(duskRaw ?? '') ? (duskRaw as AmbientIntensity) : 'medium',
      tension: isIntensity(tensionRaw ?? '') ? (tensionRaw as AmbientIntensity) : 'medium',
      safehouse: isIntensity(safehouseRaw ?? '') ? (safehouseRaw as AmbientIntensity) : 'medium'
    }
  } catch {
    return { ...DEFAULT_PRESET_INTENSITY }
  }
}

function withIntensity(base: number, intensity: AmbientIntensity) {
  return Math.min(1, Math.max(0, base * INTENSITY_GAIN[intensity]))
}

export function useAmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const synthRef = useRef<SynthNodes | null>(null)
  const sfxRef = useRef<SfxNodes | null>(null)
  const hoverRef = useRef<{ target: Element | null; at: number }>({ target: null, at: 0 })

  const [enabled, setEnabled] = useState(false)
  const [available, setAvailable] = useState(false)
  const [volume, setVolume] = useState(0.22)
  const [sfxEnabled, setSfxEnabled] = useState(true)
  const [preset, setPreset] = useState<AmbientPreset>('apocalypse')
  const [trackCursor, setTrackCursor] = useState(0)
  const [presetIntensity, setPresetIntensity] = useState<Record<AmbientPreset, AmbientIntensity>>(
    DEFAULT_PRESET_INTENSITY
  )
  const [mode, setMode] = useState<AmbientMode>('off')
  const selectedIntensity = presetIntensity[preset] ?? 'medium'
  const effectiveIntensity =
    preset !== 'apocalypse' && selectedIntensity === 'nightmare'
      ? 'high'
      : selectedIntensity

  const stopSynth = useCallback(() => {
    const s = synthRef.current
    if (!s) return
    try {
      s.droneA.stop()
      s.droneB.stop()
      s.wobble.stop()
    } catch {}
    s.ctx.close().catch(() => {})
    synthRef.current = null
  }, [])

  const getSfxContext = useCallback(() => {
    if (sfxRef.current) return sfxRef.current
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    const ctx = new AudioCtx()
    const gain = ctx.createGain()
    gain.gain.value = 0.15
    gain.connect(ctx.destination)
    sfxRef.current = { ctx, gain }
    return sfxRef.current
  }, [])

  const startSynth = useCallback(async () => {
    if (synthRef.current) return

    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    const master = ctx.createGain()
    const currentIntensity = effectiveIntensity
    master.gain.value = Math.min(0.12, Math.max(0.015, withIntensity(volume * 0.35, currentIntensity)))
    master.connect(ctx.destination)

    const droneA = ctx.createOscillator()
    droneA.type = 'triangle'
    droneA.frequency.value = 82

    const droneB = ctx.createOscillator()
    droneB.type = 'sine'
    droneB.frequency.value = 123

    const wobble = ctx.createOscillator()
    wobble.type = 'sine'
    wobble.frequency.value = 0.09

    const wobbleGain = ctx.createGain()
    wobbleGain.gain.value = 6

    droneA.connect(master)
    droneB.connect(master)
    wobble.connect(wobbleGain)
    wobbleGain.connect(droneA.frequency)

    droneA.start()
    droneB.start()
    wobble.start()

    synthRef.current = { ctx, master, droneA, droneB, wobble, wobbleGain }
  }, [volume, effectiveIntensity])

  const updateSynthVolume = useCallback((nextVolume: number, intensity: AmbientIntensity) => {
    const s = synthRef.current
    if (!s) return
    s.master.gain.setTargetAtTime(
      Math.min(0.12, Math.max(0.015, withIntensity(nextVolume * 0.35, intensity))),
      s.ctx.currentTime,
      0.1
    )
  }, [])

  const playUiClick = useCallback(() => {
    if (!enabled || !sfxEnabled) return

    const s = getSfxContext()
    if (!s) return
    const t = s.ctx.currentTime
    const osc = s.ctx.createOscillator()
    const gain = s.ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(920, t)
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.08)

    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.018 + volume * 0.03, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)

    osc.connect(gain)
    gain.connect(s.gain)
    osc.start(t)
    osc.stop(t + 0.1)
  }, [enabled, sfxEnabled, volume, getSfxContext])

  const playUiHover = useCallback(() => {
    if (!enabled || !sfxEnabled) return
    const s = getSfxContext()
    if (!s) return

    const t = s.ctx.currentTime
    const osc = s.ctx.createOscillator()
    const gain = s.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(520, t)
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.05)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.012 + volume * 0.02, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)

    osc.connect(gain)
    gain.connect(s.gain)
    osc.start(t)
    osc.stop(t + 0.07)
  }, [enabled, sfxEnabled, volume, getSfxContext])

  const playSuccess = useCallback(() => {
    if (!enabled || !sfxEnabled) return
    const s = getSfxContext()
    if (!s) return
    const t = s.ctx.currentTime

    const mk = (freq: number, at: number) => {
      const osc = s.ctx.createOscillator()
      const gain = s.ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, at)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.015 + volume * 0.03, at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09)
      osc.connect(gain)
      gain.connect(s.gain)
      osc.start(at)
      osc.stop(at + 0.1)
    }

    mk(620, t)
    mk(860, t + 0.08)
  }, [enabled, sfxEnabled, volume, getSfxContext])

  const playWarning = useCallback(() => {
    if (!enabled || !sfxEnabled) return
    const s = getSfxContext()
    if (!s) return
    const t = s.ctx.currentTime
    const osc = s.ctx.createOscillator()
    const gain = s.ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(260, t)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.02 + volume * 0.03, t + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    osc.connect(gain)
    gain.connect(s.gain)
    osc.start(t)
    osc.stop(t + 0.15)
  }, [enabled, sfxEnabled, volume, getSfxContext])

  useEffect(() => {
    setEnabled(readBool(KEY_ENABLED, false))
    setSfxEnabled(readBool(KEY_SFX, true))
    setVolume(readVolume())
    setPreset(readPreset())
    setPresetIntensity(readPresetIntensity())

    return () => {
      stopSynth()
      sfxRef.current?.ctx.close().catch(() => {})
      sfxRef.current = null
    }
  }, [stopSynth])

  useEffect(() => {
    const options = presetPaths(preset)
    const path = options[((trackCursor % options.length) + options.length) % options.length]
    const currentIntensity = effectiveIntensity
    const a = new Audio(path)
    a.loop = options.length <= 1
    a.preload = 'auto'
    a.volume = withIntensity(volume, currentIntensity)
    audioRef.current = a
    setAvailable(true)
    const onCanPlay = () => setAvailable(true)
    const onError = () => setAvailable(false)
    const onEnded = () => {
      if (options.length > 1) setTrackCursor(v => v + 1)
    }
    a.addEventListener('canplaythrough', onCanPlay)
    a.addEventListener('error', onError)
    a.addEventListener('ended', onEnded)
    a.load()

    return () => {
      a.removeEventListener('canplaythrough', onCanPlay)
      a.removeEventListener('error', onError)
      a.removeEventListener('ended', onEnded)
      a.pause()
      a.currentTime = 0
      if (audioRef.current === a) audioRef.current = null
    }
  }, [preset, trackCursor, volume, effectiveIntensity])

  useEffect(() => {
    setTrackCursor(0)
  }, [preset])

  useEffect(() => {
    try {
      localStorage.setItem(KEY_ENABLED, enabled ? '1' : '0')
    } catch {}
  }, [enabled])

  useEffect(() => {
    try {
      localStorage.setItem(KEY_SFX, sfxEnabled ? '1' : '0')
    } catch {}
  }, [sfxEnabled])

  useEffect(() => {
    try {
      localStorage.setItem(KEY_PRESET, preset)
    } catch {}
  }, [preset])

  useEffect(() => {
    try {
      localStorage.setItem(KEY_PRESET_INTENSITY, JSON.stringify(presetIntensity))
    } catch {}
  }, [presetIntensity])

  useEffect(() => {
    try {
      localStorage.setItem(KEY_VOLUME, volume.toFixed(2))
    } catch {}

    const a = audioRef.current
    const currentIntensity = effectiveIntensity
    if (a) a.volume = withIntensity(volume, currentIntensity)
    updateSynthVolume(volume, currentIntensity)
  }, [volume, effectiveIntensity, updateSynthVolume])

  useEffect(() => {
    const run = async () => {
      const a = audioRef.current
      if (!enabled) {
        if (a) {
          a.pause()
          a.currentTime = 0
        }
        stopSynth()
        setMode('off')
        return
      }

      if (available && a) {
        stopSynth()
        try {
          await a.play()
          setMode('file')
          return
        } catch (err) {
          const blocked = err instanceof DOMException && err.name === 'NotAllowedError'
          // Autoplay policy block is not a file failure; avoid dropping to synth.
          if (blocked) {
            setMode('off')
            return
          }
        }
      }

      await startSynth()
      setMode('synth')
    }

    run().catch(() => {
      setMode('off')
    })
  }, [enabled, available, startSynth, stopSynth, preset])

  useEffect(() => {
    const onSuccess = () => playSuccess()
    const onWarning = () => playWarning()
    window.addEventListener('gh:sfx-success', onSuccess)
    window.addEventListener('gh:sfx-warning', onWarning)
    return () => {
      window.removeEventListener('gh:sfx-success', onSuccess)
      window.removeEventListener('gh:sfx-warning', onWarning)
    }
  }, [playSuccess, playWarning])

  useEffect(() => {
    const selector = 'button, a, input[type="range"], input[type="checkbox"], select, [role="button"]'

    const onClick = (event: MouseEvent) => {
      if (!enabled || !sfxEnabled) return
      const target = event.target as Element | null
      if (!target) return
      if (target.closest(selector)) playUiClick()
    }

    const onHover = (event: PointerEvent) => {
      if (!enabled || !sfxEnabled) return
      const target = event.target as Element | null
      if (!target) return
      const interactive = target.closest(selector)
      if (!interactive) return

      const now = Date.now()
      if (hoverRef.current.target === interactive && now - hoverRef.current.at < 450) return
      hoverRef.current = { target: interactive, at: now }
      playUiHover()
    }

    window.addEventListener('click', onClick, true)
    window.addEventListener('pointerover', onHover, true)
    return () => {
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('pointerover', onHover, true)
    }
  }, [enabled, sfxEnabled, playUiClick, playUiHover])

  return {
    enabled,
    setEnabled,
    available,
    volume,
    setVolume,
    sfxEnabled,
    setSfxEnabled,
    preset,
    setPreset,
    currentIntensity: effectiveIntensity,
    setCurrentIntensity: (level: AmbientIntensity) => {
      const safeLevel = preset !== 'apocalypse' && level === 'nightmare' ? 'high' : level
      setPresetIntensity(prev => ({ ...prev, [preset]: safeLevel }))
    },
    intensityOptions: [
      { id: 'low' as AmbientIntensity, label: 'Low' },
      { id: 'medium' as AmbientIntensity, label: 'Medium' },
      { id: 'high' as AmbientIntensity, label: 'High' },
      { id: 'nightmare' as AmbientIntensity, label: 'Nightmare' }
    ],
    presets: AMBIENT_PRESETS,
    mode,
    playUiClick,
    playUiHover,
    playSuccess,
    playWarning
  }
}
