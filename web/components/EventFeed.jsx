'use client'

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const TYPE_STYLES = {
  Pivot: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Breakthrough: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Risk: 'bg-red-500/20 text-red-400 border-red-500/30',
  Milestone: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Shipping: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

export default function EventFeed({ events }) {
  const scrollRef = useRef(null)
  const prevCountRef = useRef(events.length)

  // Auto-scroll to top when new events arrive (newest first)
  useEffect(() => {
    if (events.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
    prevCountRef.current = events.length
  }, [events.length])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
      <AnimatePresence mode="popLayout">
        {events.map(event => (
          <motion.div
            key={event.id}
            layout
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex items-start gap-2 py-1.5 border-b border-border-green/50 last:border-0"
          >
            <span className="text-[10px] font-mono text-text-muted shrink-0 mt-0.5 w-7">
              {event.hour.toFixed(0)}h
            </span>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${TYPE_STYLES[event.type] || ''}`}>
              {event.type}
            </span>
            <p className="text-xs text-text-secondary leading-tight">{event.text}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
