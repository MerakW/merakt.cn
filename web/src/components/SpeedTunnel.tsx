'use client'
import { useEffect, useRef } from 'react'

/** Perspective light trails; the canvas sleeps offscreen and respects reduced motion. */
export default function SpeedTunnel() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0, height = 0, frame = 0, last = 0, visible = true
    let pointerX = .5, pointerY = .5, centerX = 0, centerY = 0
    let speed = .006, targetSpeed = .006, previousScroll = window.scrollY
    let light = document.documentElement.dataset.theme !== 'dark'
    const makeStar = (z = 1) => ({ x: (Math.random() * 2 - 1) * 1.4, y: (Math.random() * 2 - 1) * 1.4, z, color: Math.random() })
    const stars = Array.from({ length: 420 }, () => makeStar(.02 + Math.random() * .98))
    const draw = (delta = 0) => {
      const step = delta / (1000 / 60)
      speed += (targetSpeed - speed) * .05
      targetSpeed += (.006 - targetSpeed) * .03
      centerX += ((.62 - (pointerX - .5) * .18) * width - centerX) * .04
      centerY += ((.48 - (pointerY - .5) * .18) * height - centerY) * .04
      ctx.clearRect(0, 0, width, height)
      const focal = Math.max(width, height) * .5
      for (const star of stars) {
        const previousZ = star.z
        star.z -= speed * step
        if (star.z <= .02) { Object.assign(star, makeStar()); continue }
        const x = centerX + star.x / star.z * focal, y = centerY + star.y / star.z * focal
        if (delta && (x < -50 || x > width + 50 || y < -50 || y > height + 50)) { Object.assign(star, makeStar()); continue }
        const color = star.color < .07 ? (light ? '#e8552a' : '#ff6a3d') : star.color < .3 ? (light ? '#2349ed' : '#7f9bff') : (light ? '#1b2540' : '#ffffff')
        ctx.globalAlpha = Math.min(1, (1 - star.z) * 1.3) * (light ? .5 : .85)
        ctx.strokeStyle = color
        ctx.fillStyle = color
        ctx.lineWidth = (1 - star.z) * 2 + .3
        if (!delta) { ctx.fillRect(x, y, 1.5, 1.5); continue }
        ctx.beginPath()
        ctx.moveTo(centerX + star.x / previousZ * focal, centerY + star.y / previousZ * focal)
        ctx.lineTo(x, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    const tick = (time: number) => {
      if (time - last >= 1000 / 60) { draw(last ? Math.min(50, time - last) : 16.67); last = time }
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame); last = 0
      if (!reduced.matches && !document.hidden && visible) frame = requestAnimationFrame(tick)
      else draw()
    }
    const resize = () => {
      const rect = element.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2)
      width = rect.width; height = rect.height
      element.width = Math.round(width * dpr); element.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      centerX = width * .62; centerY = height * .48
      draw(); sync()
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || reduced.matches) return
      const rect = element.getBoundingClientRect()
      pointerX = (event.clientX - rect.left) / rect.width
      pointerY = (event.clientY - rect.top) / rect.height
    }
    const leave = () => { pointerX = .5; pointerY = .5 }
    const boost = () => {
      if (visible && !reduced.matches) targetSpeed = Math.min(.04, .006 + Math.abs(window.scrollY - previousScroll) * .0006)
      previousScroll = window.scrollY
    }
    const parent = element.parentElement
    const resizeObserver = new ResizeObserver(resize)
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    const themeObserver = new MutationObserver(() => { light = document.documentElement.dataset.theme !== 'dark'; if (reduced.matches || !visible) draw() })
    resizeObserver.observe(element); intersection.observe(element)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    parent?.addEventListener('pointermove', move); parent?.addEventListener('pointerleave', leave)
    window.addEventListener('scroll', boost, { passive: true })
    document.addEventListener('visibilitychange', sync); reduced.addEventListener('change', sync)
    resize()
    return () => {
      cancelAnimationFrame(frame); resizeObserver.disconnect(); intersection.disconnect(); themeObserver.disconnect()
      parent?.removeEventListener('pointermove', move); parent?.removeEventListener('pointerleave', leave)
      window.removeEventListener('scroll', boost)
      document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', sync)
    }
  }, [])
  return <canvas ref={canvas} className="speed-tunnel" aria-hidden="true" />
}
