'use client'

import { Play, Pause, SkipForward } from 'lucide-react'
import { motion } from 'framer-motion'

const SPEED_OPTIONS = [1, 2, 5, 10]
const JUMP_HOURS = [0, 12, 24, 36]

export default function ControlBar({ simHour, isPlaying, speed, onPlay, onPause, onSpeedChange, onJumpToHour, onViewResults }) {
  const progress = (simHour / 36) * 100

  return (
    <div className="sticky top-0 z-30 border-b border-border-green bg-bg-dark/90 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3 gap-4 max-w-[1800px] mx-auto">
        {/* Logo + Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-bg-dark">TH</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-cream leading-tight">TreeHacks Simulator</h1>
            <p className="text-xs text-text-muted">2026 Edition</p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center hover:bg-primary/30 transition-colors cursor-pointer"
          >
            {isPlaying ? (
              <Pause size={16} className="text-primary" />
            ) : (
              <Play size={16} className="text-primary ml-0.5" />
            )}
          </button>

          {/* Speed selector */}
          <div className="flex items-center bg-bg-card rounded-lg border border-border-green overflow-hidden">
            {SPEED_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-2.5 py-1.5 text-xs font-mono transition-colors cursor-pointer ${
                  speed === s
                    ? 'bg-primary text-bg-dark font-bold'
                    : 'text-text-secondary hover:text-cream hover:bg-primary/10'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Time Display + Progress */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono text-text-secondary">
              Hour {simHour.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-text-muted">36h</span>
          </div>
          <div className="h-1.5 bg-primary-dark/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Jump buttons */}
        <div className="flex items-center gap-1">
          {JUMP_HOURS.map(h => (
            <button
              key={h}
              onClick={() => onJumpToHour(h)}
              className={`px-2.5 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                Math.floor(simHour) === h
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-text-muted hover:text-cream hover:bg-primary/10 border border-transparent'
              }`}
            >
              {h}h
            </button>
          ))}
        </div>

        {/* View Results button — shown when sim is done and user is reviewing replay */}
        {onViewResults && (
          <button
            onClick={onViewResults}
            className="px-3 py-1.5 text-xs font-semibold text-bg-dark bg-primary rounded-md hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
          >
            View Results
          </button>
        )}

        {/* Mobile time */}
        <div className="md:hidden text-xs font-mono text-primary">
          H{simHour.toFixed(0)}
        </div>
      </div>
    </div>
  )
}
