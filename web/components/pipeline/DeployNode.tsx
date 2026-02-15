'use client'

import { useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { ExternalLink, Globe } from 'lucide-react'

interface DeployNodeProps {
  data: { url: string; index: number }
}

export default function DeployNode({ data }: DeployNodeProps) {
  const { url, index } = data

  const openUrl = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    [url],
  )

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
        transition={{ delay: index * 0.08 + 0.2 }}
        className="rounded-xl border border-primary/40 bg-bg-dark/90 backdrop-blur-md overflow-hidden w-[280px]"
      >
        <div className="px-3 py-2 border-b border-border-green/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe size={10} className="text-primary" />
            <span className="text-[9px] font-mono text-primary uppercase tracking-wider">
              Live Preview
            </span>
          </div>
          <button
            onClick={openUrl}
            className="nopan nodrag nowheel flex items-center gap-1 text-[8px] font-mono text-text-muted hover:text-cream transition-colors cursor-pointer bg-transparent border-none outline-none"
          >
            Open <ExternalLink size={8} />
          </button>
        </div>

        <div className="nopan nodrag nowheel w-[280px] h-[170px] bg-bg-dark relative overflow-hidden">
          <iframe
            src={url}
            title="Site preview"
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
          />
        </div>

        <div className="px-3 py-1.5 border-t border-border-green/20">
          <p className="text-[7px] font-mono text-text-muted truncate">{url}</p>
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
 