'use client'

import { useJobStream } from '../../hooks/useJobStream'
import BuildFlow from '../../components/BuildFlow'
import { Trash2 } from 'lucide-react'

export default function LivePage() {
  const { jobs, clearJobs } = useJobStream()

  return (
    <div className="h-screen flex flex-col relative z-10">
      {/* Header bar */}
      <div className="sticky top-0 z-30 border-b border-border-green bg-bg-dark/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3 gap-4 max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-bg-dark">TH</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-cream leading-tight">TreeHacks Live</h1>
              <p className="text-xs text-text-muted">Build Pipeline</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-text-secondary">
              {jobs.length} build{jobs.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs font-mono text-primary">
              {jobs.filter(j => j.status === 'deployed').length} deployed
            </span>
            {jobs.length > 0 && (
              <button
                onClick={clearJobs}
                className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                title="Clear all builds"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Flow canvas */}
      <div className="flex-1">
        {jobs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border border-border-green flex items-center justify-center mx-auto mb-4">
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              </div>
              <p className="text-sm text-text-secondary font-mono">Waiting for builds...</p>
              <p className="text-xs text-text-muted mt-1">
                Builds will appear here when webhook events arrive
              </p>
            </div>
          </div>
        ) : (
          <BuildFlow jobs={jobs} />
        )}
      </div>
    </div>
  )
}
