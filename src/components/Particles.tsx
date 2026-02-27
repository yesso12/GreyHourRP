import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  a: number
}

export function Particles() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    const particles: Particle[] = []
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    const isMobile = window.innerWidth < 768
    const count = isMobile ? 24 : 56

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const reset = () => {
      particles.length = 0
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.6 + Math.random() * 2.4,
          vx: -0.18 + Math.random() * 0.36,
          vy: 0.08 + Math.random() * 0.48,
          a: 0.04 + Math.random() * 0.12
        })
      }
    }

    resize()
    reset()
    const ro = new ResizeObserver(() => { resize(); reset() })
    ro.observe(canvas)

    let raf = 0
    let lastTs = 0
    const frameInterval = 1000 / 30 // cap to ~30fps
    const tick = () => {
      const now = performance.now()
      if (lastTs && now - lastTs < frameInterval) {
        raf = requestAnimationFrame(tick)
        return
      }
      lastTs = now

      if (document.hidden) {
        raf = requestAnimationFrame(tick)
        return
      }

      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w }
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.closePath()
        ctx.fillStyle = `rgba(241,230,208,${p.a})`
        ctx.fill()
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.6
      }}
      aria-hidden="true"
    />
  )
}
