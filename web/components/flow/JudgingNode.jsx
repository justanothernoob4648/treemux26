'use client'

import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { Trophy, Loader2 } from 'lucide-react'

export default function JudgingNode({ data }) {
  const { deployedCount, totalJobs } = data
  const allDeployed = totalJobs > 0 && deployedCount === totalJobs

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-primary !border-primary"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`px-6 py-4 rounded-xl border backdrop-blur-md min-w-[180px] ${
          allDeployed
            ? 'border-yellow-400/50 bg-yellow-400/5'
            : 'border-border-green bg-bg-dark/90'
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            animate={allDeployed ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: allDeployed ? Infinity : 0, repeatDelay: 2 }}
          >
            <Trophy size={24} className={allDeployed ? 'text-yellow-400' : 'text-text-muted'} />
          </motion.div>
          <div>
            <h3 className="text-sm font-bold text-cream">Judging</h3>
            <p className="text-[10px] font-mono text-text-muted">
              {deployedCount}/{totalJobs} builds ready
            </p>
          </div>
        </div>

        {allDeployed ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <span className="text-[10px] font-mono text-yellow-400/80 uppercase tracking-wider">
              Ready to Judge
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 size={10} className="text-text-muted" />
            </motion.div>
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
              Waiting for builds...
            </span>
          </div>
        )}
      </motion.div>
    </div>
  )
}
