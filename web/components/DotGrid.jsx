'use client'

import { useRef, useEffect, useCallback } from 'react'

const DOT_SPACING = 32
const DOT_RADIUS = 1
const DOT_COLOR = 'rgba(3, 141, 57, 0.15)'

export default function DotGrid() {
  const canvasRef = useRef(null)
  const offsetRef = useRef(0)
  const rafRef = useRef(null)
  const lastScrollRef = useRef(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    const offset = offsetRef.current % DOT_SPACING

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = DOT_COLOR

    for (let y = -DOT_SPACING + offset; y < height + DOT_SPACING; y += DOT_SPACING) {
      for (let x = 0; x < width; x += DOT_SPACING) {
        ctx.beginPath()
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [])

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'
    draw()
  }, [draw])

  useEffect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)

    const onScroll = () => {
      const scrollY = window.scrollY
      const delta = scrollY - lastScrollRef.current
      lastScrollRef.current = scrollY
      // Parallax: dots move downward at 0.3x scroll speed
      offsetRef.current += delta * 0.3

      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', onScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [draw, handleResize])

  // Expose a method for internal container scroll parallax
  useEffect(() => {
    const handler = (e) => {
      const delta = e.detail?.delta || 0
      offsetRef.current += delta * 0.3
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }
    window.addEventListener('dotgrid-scroll', handler)
    return () => window.removeEventListener('dotgrid-scroll', handler)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
