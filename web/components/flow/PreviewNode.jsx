'use client'

import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { ExternalLink, Globe } from 'lucide-react'

export default function PreviewNode({ data }) {
  const { url } = data

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
        className="rounded-xl border border-primary/50 bg-bg-dark/90 backdrop-blur-md overflow-hidden min-w-[320px]"
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-border-green/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe size={10} className="text-primary" />
            <span className="text-[10px] font-mono text-primary uppercase tracking-wider">
              Live Preview
            </span>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] font-mono text-text-muted hover:text-cream transition-colors"
          >
            Open <ExternalLink size={8} />
          </a>
        </div>

        {/* Iframe preview */}
        <div className="w-[320px] h-[200px] bg-bg-dark relative">
          <iframe
            src={url}
            title="Live preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
          <div className="absolute inset-0 pointer-events-none border border-primary/10 rounded-b-xl" />
        </div>

        {/* URL */}
        <div className="px-3 py-1.5 border-t border-border-green/20">
          <p className="text-[8px] font-mono text-text-muted truncate">{url}</p>
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
