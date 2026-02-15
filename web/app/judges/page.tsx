'use client'

import { useRouter } from 'next/navigation'
import { useJobStream } from '../../hooks/useJobStream'
import { motion } from 'framer-motion'
import { Trophy, ExternalLink, Globe } from 'lucide-react'

export default function JudgesPage() {
  const router = useRouter()
  const { jobs } = useJobStream()

  const deployedJobs = jobs.filter(j => j.status === 'deployed')

  return (
    <div className="min-h-screen relative z-10 flex flex-col">
      {/* Header */}
      <div className="text-center pt-12 pb-8 px-6">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
        >
          <Trophy size={48} className="text-yellow-400 mx-auto mb-4" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl sm:text-4xl font-bold text-cream mb-2"
        >
          Judging
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-text-secondary font-mono text-sm"
        >
          {deployedJobs.length} build{deployedJobs.length !== 1 ? 's' : ''} ready for review
        </motion.p>
      </div>

      {/* Deployed builds */}
      <div className="max-w-4xl mx-auto px-6 w-full space-y-6 pb-12">
        {deployedJobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-text-muted font-mono">No deployed builds yet.</p>
            <button
              onClick={() => router.push('/live')}
              className="mt-4 px-4 py-2 text-sm font-mono text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
            >
              Back to Live
            </button>
          </div>
        ) : (
          deployedJobs.map((job, i) => (
            <motion.div
              key={job.jobId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="border border-border-green rounded-xl overflow-hidden bg-bg-dark/80"
            >
              {/* Job header */}
              <div className="px-6 py-4 border-b border-border-green/30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-cream">Build #{i + 1}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      Deployed
                    </span>
                  </div>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">{job.idea}</p>
              </div>

              {/* Stats */}
              <div className="px-6 py-3 flex gap-6 border-b border-border-green/20">
                <div>
                  <span className="text-[10px] font-mono text-text-muted block">Temperature</span>
                  <span className="text-sm font-mono text-amber-400">{job.temperature}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-text-muted block">Risk</span>
                  <span className="text-sm font-mono text-red-400">{job.risk}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-text-muted block">Steps</span>
                  <span className="text-sm font-mono text-primary">{job.totalSteps}</span>
                </div>
              </div>

              {/* Preview */}
              {job.deploymentUrl && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Globe size={12} className="text-primary" />
                      <span className="text-[10px] font-mono text-primary uppercase tracking-wider">
                        Live Preview
                      </span>
                    </div>
                    <a
                      href={job.deploymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-mono text-text-muted hover:text-cream transition-colors"
                    >
                      Open <ExternalLink size={10} />
                    </a>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-border-green/30 bg-bg-dark">
                    <iframe
                      src={job.deploymentUrl}
                      title={`Preview for ${job.jobId}`}
                      className="w-full h-[300px] border-0"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <p className="text-[9px] font-mono text-text-muted mt-1.5 truncate">{job.deploymentUrl}</p>
                </div>
              )}
            </motion.div>
          ))
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-4 pt-4"
        >
          <button
            onClick={() => router.push('/live')}
            className="px-6 py-3 text-sm font-semibold text-cream border border-border-green rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
          >
            Back to Live
          </button>
        </motion.div>
      </div>
    </div>
  )
}
