'use client'

import { motion } from 'framer-motion'

const METRICS = [
  { key: 'feasibility', label: 'FEAS', color: '#038d39' },
  { key: 'novelty', label: 'NOVL', color: '#22d3ee' },
  { key: 'demoReadiness', label: 'DEMO', color: '#f59e0b' },
  { key: 'marketClarity', label: 'MRKT', color: '#a78bfa' },
]

export default function MetricsStrip({ metrics }) {
  return (
    <div className="flex gap-3 px-4 py-2.5 mt-auto">
      {METRICS.map(m => (
        <div key={m.key} className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono text-text-muted tracking-wider">{m.label}</span>
            <span className="text-[10px] font-mono text-text-secondary">{metrics[m.key]}</span>
          </div>
          <div className="h-1 bg-primary-dark/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: m.color }}
              animate={{ width: `${metrics[m.key]}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
