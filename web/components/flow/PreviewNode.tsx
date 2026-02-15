'use client'

import { useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { ExternalLink, Globe } from 'lucide-react'

interface PreviewNodeProps {
  data: { url: string }
}

export default function PreviewNode({ data }: PreviewNodeProps) {
  const { url } = data

  const openUrl = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [url])

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
        <div className="px-3 py-2 border-b border-border-green/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe size={10} className="text-primary" />
            <span className="text-[10px] font-mono text-primary uppercase tracking-wider">
              Live Preview
            </span>
          </div>
          <button
            onClick={openUrl}
            className="nopan nodrag nowheel flex items-center gap-1 text-[9px] font-mono text-text-muted hover:text-cream transition-colors cursor-pointer bg-transparent border-none outline-none"
          >
            Open <ExternalLink size={8} />
          </button>
        </div>

        <div className="nopan nodrag nowheel w-[320px] h-[200px] bg-bg-dark relative overflow-hidden">
          <iframe
            src={url}
            title="Site preview"
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>

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