'use client'

import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

export default function StartNode() {
  return (
    <div className="relative">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="px-6 py-4 rounded-xl border border-primary bg-bg-dark/90 backdrop-blur-md min-w-[180px]"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-base font-bold text-bg-dark">TH</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-cream">TreeHacks</h2>
            <p className="text-[10px] font-mono text-primary">2026 Builds</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3">
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-primary"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-[10px] font-mono text-primary/80 uppercase tracking-wider">
            Live
          </span>
        </div>
      </motion.div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-primary !border-primary"
      />
    </div>
  )
}
