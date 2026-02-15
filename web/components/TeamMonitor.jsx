'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb } from 'lucide-react'
import MilestoneTimeline from './MilestoneTimeline'
import EventFeed from './EventFeed'

const STATUS_COLORS = {
  'Ideating': 'text-blue-400',
  'Prototyping': 'text-cyan-400',
  'Building MVP': 'text-primary',
  'Integrating': 'text-amber-400',
  'Polishing Demo': 'text-purple-400',
  'Final Push': 'text-red-400',
}

export default function TeamMonitor({ team }) {
  const idea = team.currentIdea

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-base font-semibold text-cream tracking-tight">{team.name}</h3>
          <span className={`text-[10px] font-mono uppercase tracking-wider ${STATUS_COLORS[team.status] || 'text-text-secondary'}`}>
            {team.status}
          </span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {team.chips.map(chip => (
            <span
              key={chip}
              className="text-[9px] font-mono px-1.5 py-0.5 text-text-muted"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      {/* Current Idea — only appears once an ideaUpdate event fires */}
      <AnimatePresence mode="wait">
        {idea ? (
          <motion.div
            key={`${idea.title}-${idea.direction}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="px-4 py-2 overflow-hidden"
          >
            <div className="flex items-start gap-2">
              <Lightbulb size={11} className="text-primary/60 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-cream">{idea.title}</span>
                {idea.pitch && (
                  <span className="text-[11px] text-text-secondary ml-1.5">{idea.pitch}</span>
                )}
                {idea.direction && (
                  <p className="text-[10px] text-text-muted mt-0.5 italic">{idea.direction}</p>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="brainstorming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-2"
          >
            <p className="text-[11px] text-text-muted italic">Brainstorming...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestones */}
      <MilestoneTimeline milestones={team.milestones} />

      {/* Event Feed — takes remaining space */}
      <EventFeed events={team.events} />
    </div>
  )
}
