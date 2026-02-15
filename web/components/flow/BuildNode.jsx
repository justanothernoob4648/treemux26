'use client'

import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { GitBranch, Thermometer, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

export default function BuildNode({ data }) {
  const { job } = data
  const completedSteps = job.steps.length
  const progress = job.totalSteps > 0 ? (completedSteps / job.totalSteps) * 100 : 0
  const currentStepName = job.planSteps?.[job.currentStep] || 'Waiting...'
  const isDeployed = job.status === 'deployed'

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-primary !border-primary"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`rounded-xl border backdrop-blur-md min-w-[300px] max-w-[340px] overflow-hidden ${
          isDeployed
            ? 'border-primary bg-primary/5'
            : 'border-border-green bg-bg-dark/90'
        }`}
      >
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b border-border-green/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider truncate max-w-[180px]">
              {job.jobId.slice(0, 12)}...
            </span>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
              isDeployed
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            }`}>
              {isDeployed ? 'Deployed' : 'Building'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitBranch size={10} className="text-text-muted shrink-0" />
            <span className="text-[9px] font-mono text-text-muted truncate">{job.branch}</span>
          </div>
        </div>

        {/* Idea */}
        <div className="px-4 py-2.5">
          <p className="text-xs text-cream leading-snug line-clamp-3">{job.idea}</p>
        </div>

        {/* Gauges */}
        <div className="px-4 pb-2 flex gap-4">
          <div className="flex items-center gap-1.5">
            <Thermometer size={10} className="text-amber-400" />
            <span className="text-[10px] font-mono text-text-secondary">{job.temperature}</span>
            <div className="w-12 h-1 bg-primary-dark/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400/60 rounded-full transition-all"
                style={{ width: `${job.temperature}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={10} className="text-red-400" />
            <span className="text-[10px] font-mono text-text-secondary">{job.risk}</span>
            <div className="w-12 h-1 bg-primary-dark/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400/60 rounded-full transition-all"
                style={{ width: `${job.risk}%` }}
              />
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-text-muted">
              Step {completedSteps}/{job.totalSteps}
            </span>
            <span className="text-[10px] font-mono text-primary">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1.5 bg-primary-dark/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Current step */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5">
            {isDeployed ? (
              <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 size={10} className="text-primary shrink-0" />
              </motion.div>
            )}
            <span className="text-[10px] text-text-secondary truncate">
              {isDeployed ? 'Build complete' : currentStepName}
            </span>
          </div>
        </div>

        {/* Step list */}
        <div className="px-4 pb-3 max-h-[140px] overflow-y-auto">
          <div className="space-y-1">
            {job.planSteps?.map((step, i) => {
              const isDone = job.steps.some(s => s.stepIndex === i)
              const isCurrent = job.currentStep === i && !isDone
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isDone ? 'bg-primary' : isCurrent ? 'bg-amber-400' : 'bg-border-green'
                  }`} />
                  <span className={`text-[9px] font-mono truncate ${
                    isDone ? 'text-primary/70' : isCurrent ? 'text-cream' : 'text-text-muted'
                  }`}>
                    {step}
                  </span>
                </div>
              )
            })}
          </div>
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
