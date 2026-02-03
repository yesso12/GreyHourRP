import { useEffect, useRef, useState } from 'react'

/**
 * Drop your file here (optional):
 *   public/audio/ambient.mp3
 *
 * The UI will show a toggle regardless.
 */
export function useAmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const a = new Audio('/audio/ambient.mp3')
    a.loop = true
    a.volume = 0.22
    audioRef.current = a

    // Check availability without throwing
    fetch('/audio/ambient.mp3', { method: 'HEAD' })
      .then(r => setAvailable(r.ok))
      .catch(() => setAvailable(false))

    return () => {
      a.pause()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (!enabled) {
      a.pause()
      a.currentTime = 0
      return
    }
    // Browsers require user gesture, so this is called from UI click.
    a.play().catch(() => {
      // If play is blocked, flip back off
      setEnabled(false)
    })
  }, [enabled])

  return { enabled, setEnabled, available }
}
