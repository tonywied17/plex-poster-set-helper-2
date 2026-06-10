import { useEffect, useRef } from 'react'
import styles from './ParticleField.module.css'

interface Orb {
  /** 0-1 fraction of canvas width. */
  baseX: number
  /** 0-1 fraction of canvas height. */
  baseY: number
  /** 0-1 fraction of Math.max(w, h). */
  radius: number
  r: number
  g: number
  b: number
  alpha: number
  /** 0-1 fraction of canvas width. */
  driftX: number
  /** 0-1 fraction of canvas height. */
  driftY: number
  /** Radians per frame. */
  speed: number
  phase: number
}

interface Ember {
  x: number
  y: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
  phase: number
}

/**
 * Atmospheric background orbs. Positions / sizes are fractions so they scale
 * with any window size; alpha is intentionally very low.
 */
const ORBS: Orb[] = [
  // Large warm gold bloom - upper left
  { baseX: -0.05, baseY: -0.15, radius: 0.55, r: 212, g: 170, b: 64,  alpha: 0.10, driftX: 0.07, driftY: 0.10, speed: 0.00018, phase: 0 },
  // Mid deep amber - right edge
  { baseX: 1.05,  baseY: 0.35,  radius: 0.38, r: 226, g: 150, b: 40,  alpha: 0.07, driftX: 0.06, driftY: 0.09, speed: 0.00014, phase: 1.8 },
  // Large deep indigo - bottom, cold contrast anchor
  { baseX: 0.30,  baseY: 1.10,  radius: 0.62, r: 20,  g: 28,  b: 100, alpha: 0.22, driftX: 0.05, driftY: 0.06, speed: 0.00010, phase: 3.4 },
  // Small warm gold core - mid-canvas
  { baseX: 0.52,  baseY: 0.28,  radius: 0.22, r: 212, g: 170, b: 64,  alpha: 0.06, driftX: 0.09, driftY: 0.11, speed: 0.00022, phase: 0.9 },
  // Deep blue-black - upper right
  { baseX: 0.88,  baseY: -0.08, radius: 0.34, r: 8,   g: 14,  b: 70,  alpha: 0.18, driftX: 0.06, driftY: 0.08, speed: 0.00013, phase: 2.6 },
]

const EMBER_COUNT = 22

/** Creates an ember; scatter spreads initial positions across the canvas for first paint. */
function spawnEmber(w: number, h: number, scatter: boolean): Ember {
  const maxLife = 240 + Math.random() * 320
  return {
    x: Math.random() * w,
    y: scatter ? Math.random() * h : h * 0.5 + Math.random() * h * 0.5,
    vy: -(0.18 + Math.random() * 0.38),
    life: scatter ? Math.random() * maxLife : 0,
    maxLife,
    size: 0.5 + Math.random() * 0.9,
    hue: 22 + Math.random() * 24,
    phase: Math.random() * Math.PI * 2,
  }
}

/** Draws one radial-gradient orb. */
function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  r: number, g: number, b: number, alpha: number
) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
  grad.addColorStop(0,    `rgba(${r},${g},${b},${alpha})`)
  grad.addColorStop(0.30, `rgba(${r},${g},${b},${alpha * 0.60})`)
  grad.addColorStop(0.60, `rgba(${r},${g},${b},${alpha * 0.20})`)
  grad.addColorStop(0.85, `rgba(${r},${g},${b},${alpha * 0.05})`)
  grad.addColorStop(1,    `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

/** Ambient canvas background of drifting orbs, rising embers, and a vignette. */
export default function ParticleField({ animate = true }: { animate?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const frameRef  = useRef<number>(0)
  const embers    = useRef<Ember[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      canvas!.width  = canvas!.offsetWidth
      canvas!.height = canvas!.offsetHeight
      embers.current = Array.from({ length: EMBER_COUNT }, () =>
        spawnEmber(canvas!.width, canvas!.height, true)
      )
      // Static mode (e.g. Docker/VNC): paint a single frame on resize, no loop
      if (!animate) draw()
    }

    function draw() {
      if (!canvas || !ctx) return
      const w = canvas.width
      const h = canvas.height
      const t = ++frameRef.current

      ctx.clearRect(0, 0, w, h)

      const maxDim = Math.max(w, h)
      for (const orb of ORBS) {
        const cx = orb.baseX * w + Math.sin(t * orb.speed + orb.phase) * orb.driftX * w
        const cy = orb.baseY * h + Math.cos(t * orb.speed * 0.7 + orb.phase) * orb.driftY * h
        drawOrb(ctx, cx, cy, orb.radius * maxDim, orb.r, orb.g, orb.b, orb.alpha)
      }

      ctx.save()
      for (const e of embers.current) {
        e.life += 1
        if (e.life >= e.maxLife || e.y < -8) {
          Object.assign(e, spawnEmber(w, h, false))
          continue
        }
        e.x += Math.sin(e.life * 0.022 + e.phase) * 0.28
        e.y += e.vy

        const p = e.life / e.maxLife
        let opacity = p < 0.12 ? p / 0.12 : p > 0.75 ? (1 - p) / 0.25 : 1
        opacity *= 0.32   // cap opacity so embers stay subtle

        ctx.shadowBlur  = 4 + e.size * 3
        ctx.shadowColor = `hsla(${e.hue},100%,65%,${opacity * 0.7})`
        ctx.fillStyle   = `hsla(${e.hue},100%,78%,${opacity})`
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.38)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, w, h)

      // Loop only when animating; static mode renders a single frame
      if (animate) animRef.current = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    draw()

    if (!animate) {
      return () => { cancelAnimationFrame(animRef.current); ro.disconnect() }
    }

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(animRef.current)
      else animRef.current = requestAnimationFrame(draw)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [animate])

  return <canvas ref={canvasRef} className={styles.canvas} />
}
