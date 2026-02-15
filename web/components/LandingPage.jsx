'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'

// Fake event data for the preview panes
const PREVIEW_TEAMS = [
  {
    name: 'NeuralBridge',
    status: 'Building MVP',
    statusColor: 'text-primary',
    events: [
      { type: 'Breakthrough', text: 'WebSocket latency under 50ms' },
      { type: 'Shipping', text: 'Auth flow deployed to staging' },
      { type: 'Milestone', text: 'Core API endpoints complete' },
    ],
  },
  {
    name: 'QuantumLeap',
    status: 'Prototyping',
    statusColor: 'text-cyan-400',
    events: [
      { type: 'Pivot', text: 'Switching from B2C to API-first' },
      { type: 'Risk', text: 'Rate limiting on external API' },
    ],
  },
  {
    name: 'EchoFrame',
    status: 'Integrating',
    statusColor: 'text-amber-400',
    events: [
      { type: 'Shipping', text: 'Real-time dashboard live' },
      { type: 'Breakthrough', text: 'Edge caching reduces load 4x' },
      { type: 'Milestone', text: 'User testing round 1 done' },
    ],
  },
  {
    name: 'SynthWave',
    status: 'Ideating',
    statusColor: 'text-blue-400',
    events: [
      { type: 'Milestone', text: 'Problem space validated' },
      { type: 'Risk', text: 'Unclear differentiation from competitors' },
    ],
  },
  {
    name: 'DataForge',
    status: 'Polishing Demo',
    statusColor: 'text-purple-400',
    events: [
      { type: 'Shipping', text: 'Demo video recorded' },
      { type: 'Breakthrough', text: 'ML pipeline accuracy at 94%' },
    ],
  },
  {
    name: 'CloudPulse',
    status: 'Building MVP',
    statusColor: 'text-primary',
    events: [
      { type: 'Shipping', text: 'Landing page deployed' },
      { type: 'Risk', text: 'Third-party SDK breaking changes' },
      { type: 'Milestone', text: 'Database schema finalized' },
    ],
  },
]

const TYPE_COLORS = {
  Pivot: 'bg-amber-500/20 text-amber-400/80 border-amber-500/20',
  Breakthrough: 'bg-emerald-500/20 text-emerald-400/80 border-emerald-500/20',
  Risk: 'bg-red-500/20 text-red-400/80 border-red-500/20',
  Milestone: 'bg-blue-500/20 text-blue-400/80 border-blue-500/20',
  Shipping: 'bg-purple-500/20 text-purple-400/80 border-purple-500/20',
}

function PreviewPane({ team, col, row }) {
  const borders = [
    row === 0 ? 'border-b border-border-green/25' : '',
    col < 2 ? 'border-r border-border-green/25' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`overflow-hidden p-3 ${borders}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-cream/50">{team.name}</span>
        <span className={`text-[8px] font-mono uppercase tracking-wider ${team.statusColor} opacity-60`}>
          {team.status}
        </span>
      </div>

      {/* Fake events */}
      <div className="space-y-1.5">
        {team.events.map((event, j) => (
          <div key={j} className="flex items-start gap-1.5">
            <span className={`text-[7px] font-mono px-1 py-0.5 rounded border shrink-0 ${TYPE_COLORS[event.type]}`}>
              {event.type}
            </span>
            <span className="text-[9px] text-text-muted/60 leading-tight">{event.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.3 }}
      className="absolute inset-0"
    >
      {/* Simulated control bar */}
      <div className="h-8 border-b border-border-green/20 flex items-center px-4 gap-3">
        <div className="w-3 h-3 rounded-full border border-primary/30" />
        <div className="flex-1 h-1 bg-primary/10 rounded-full">
          <div className="w-1/3 h-full bg-primary/25 rounded-full" />
        </div>
        <span className="text-[8px] font-mono text-text-muted/40">12.4h / 36h</span>
      </div>

      {/* 3x2 grid */}
      <div className="grid grid-cols-3 grid-rows-2" style={{ height: 'calc(100% - 2rem)' }}>
        {PREVIEW_TEAMS.map((team, i) => (
          <PreviewPane key={team.name} team={team} col={i % 3} row={Math.floor(i / 3)} />
        ))}
      </div>
    </motion.div>
  )
}

export default function LandingPage({ onStart }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className="min-h-screen relative z-10 flex flex-col lg:flex-row isolate">
      {/* Left side — Typography block */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="lg:w-[35%] relative z-20 flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-16 lg:py-0 min-h-[50vh] lg:min-h-screen"
      >
        <div className="max-w-md">
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-cream tracking-tight leading-[1.05] mb-2">
            TreeHacks
            <br />
            Simulator
          </h1>
          <p className="text-lg sm:text-xl font-mono text-primary mb-8">2026 Edition</p>

          {/* Tagline */}
          <p className="text-sm text-text-secondary font-mono leading-relaxed mb-10">
            36 Hours. 6 Teams. Live Build.
          </p>

          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-8">
            <motion.span
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-xs font-mono text-primary/80 uppercase tracking-wider">
              Simulation Ready
            </span>
          </div>

          {/* CTA */}
          <motion.button
            onClick={onStart}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group inline-flex items-center gap-3 px-7 py-3.5 bg-transparent border border-primary text-primary font-semibold text-sm rounded-lg hover:bg-primary hover:text-bg-dark transition-all duration-300 cursor-pointer"
            style={{
              boxShadow: isHovered
                ? '0 0 30px rgba(3,141,57,0.3), 0 0 60px rgba(3,141,57,0.1)'
                : '0 0 15px rgba(3,141,57,0.1)',
            }}
          >
            <Play size={16} fill="currentColor" />
            Watch Simulation
          </motion.button>

          {/* Footer */}
          <p className="text-[10px] text-text-muted font-mono mt-12">
            Stanford University — February 2026
          </p>
        </div>
      </motion.div>

      {/* Right side — Dashboard preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
        className="lg:w-[65%] relative z-10 overflow-hidden min-h-[50vh] lg:min-h-screen hidden md:block"
      >
        {/* Scale up preview, but keep it from slamming into the seam */}
        <div className="absolute inset-0 origin-center scale-[1.10] translate-x-2">
          <DashboardPreview />
        </div>

        {/* Seam blend overlay: removes the hard vertical cutoff at the left boundary */}
        <div className="absolute inset-y-0 left-0 w-28 pointer-events-none bg-gradient-to-r from-bg-dark via-bg-dark/70 to-transparent" />

        {/* Vignette edges (softened) */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Left edge fade (wider + softer) */}
          <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-bg-dark via-bg-dark/60 to-transparent" />
          {/* Top edge fade */}
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-bg-dark/70 to-transparent" />
          {/* Bottom edge fade */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-bg-dark/70 to-transparent" />
          {/* Right edge subtle fade */}
          <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-bg-dark/40 to-transparent" />
        </div>
      </motion.div>

      {/* Mobile: simplified preview hint */}
      <div className="md:hidden px-8 pb-12">
        <div className="border border-border-green/20 rounded-lg p-4 opacity-30">
          <div className="grid grid-cols-2 gap-2">
            {PREVIEW_TEAMS.slice(0, 4).map(team => (
              <div key={team.name} className="p-2">
                <span className="text-[9px] font-semibold text-cream/40">{team.name}</span>
                <span className={`text-[7px] font-mono ml-1.5 ${team.statusColor} opacity-40`}>
                  {team.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
