'use client'

import { motion } from 'framer-motion'
import { Check, Circle } from 'lucide-react'

export default function MilestoneTimeline({ milestones }) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-0.5 overflow-x-auto">
        {milestones.map((m, i) => {
          const isLast = i === milestones.length - 1
          return (
            <div key={m.id} className="flex items-center shrink-0">
              <div className="flex flex-col items-center">
                <motion.div
                  className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                    m.completed
                      ? 'bg-primary border-primary'
                      : 'border-border-green bg-transparent'
                  }`}
                  animate={m.completed ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {m.completed ? (
                    <Check size={8} className="text-bg-dark" strokeWidth={3} />
                  ) : (
                    <Circle size={6} className="text-text-muted" />
                  )}
                </motion.div>
                <span className={`text-[8px] font-mono mt-0.5 whitespace-nowrap ${
                  m.completed ? 'text-primary' : 'text-text-muted'
                }`}>
                  {m.label}
                </span>
              </div>
              {!isLast && (
                <div className={`w-3 h-px mx-0.5 mt-[-8px] ${
                  m.completed ? 'bg-primary' : 'bg-border-green'
                }`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
