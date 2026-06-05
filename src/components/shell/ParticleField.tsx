import { useEffect, useRef } from 'react'
import styles from './ParticleField.module.css'

interface Ember {
  x: number
  y: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
  phase: number
  brightness: number
}

const EMBER_COUNT = 40

function spawnEmber(w: number, h: number, scatter = false): Ember {
  const maxLife = 200 + Math.random() * 280
  return {
    x: Math.random() * w,
    y: scatter ? Math.random() * h : h * 0.4 + Math.random() * h * 0.6,
    vy: -(0.25 + Math.random() * 0.55),
    life: scatter ? Math.random() * maxLife : 0,
    maxLife,
    size: 0.6 + Math.random() * 1.4,
    hue: 22 + Math.random() * 26,
    phase: Math.random() * Math.PI * 2,
    brightness: 60 + Math.random() * 30,
  }
}

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const embers = useRef<Ember[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      canvas!.width = canvas!.offsetWidth
      canvas!.height = canvas!.offsetHeight
      embers.current = Array.from({ length: EMBER_COUNT }, () =>
        spawnEmber(canvas!.width, canvas!.height, true)
      )
    }

    function draw() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const w = canvas.width
      const h = canvas.height

      embers.current.forEach(e => {
        e.life += 1

        if (e.life >= e.maxLife || e.y < -10) {
          Object.assign(e, spawnEmber(w, h, false))
          return
        }

        e.x += Math.sin(e.life * 0.025 + e.phase) * 0.35
        e.y += e.vy

        const progress = e.life / e.maxLife
        let opacity: number
        if (progress < 0.12) {
          opacity = progress / 0.12
        } else if (progress > 0.72) {
          opacity = (1 - progress) / 0.28
        } else {
          opacity = 1
        }
        opacity *= 0.65

        ctx.save()
        ctx.shadowBlur = 5 + e.size * 4
        ctx.shadowColor = `hsla(${e.hue}, 100%, ${e.brightness}%, ${opacity * 0.8})`
        ctx.fillStyle = `hsla(${e.hue}, 100%, ${e.brightness + 15}%, ${opacity})`
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      animRef.current = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    draw()

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
  }, [])

  return (
    <div className={styles.bg}>
      {/* Atmospheric depth orbs — CSS animated, zero JS */}
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />
      <div className={`${styles.orb} ${styles.orb4}`} />
      <div className={`${styles.orb} ${styles.orb5}`} />

      {/* Ember canvas */}
      <canvas ref={canvasRef} className={styles.canvas} />

      {/* Vignette — darkens edges so content reads cleanly */}
      <div className={styles.vignette} />
    </div>
  )
}
