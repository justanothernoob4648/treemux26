'use client'
 
import { useState, useCallback, useEffect, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { ExternalLink, Globe, Image as ImageIcon, RefreshCw } from 'lucide-react'
 
const REFRESH_INTERVAL = 30_000 // 30s between refreshes
 
interface DeployNodeProps {
  data: { url: string; index: number }
}
 
export default function DeployNode({ data }: DeployNodeProps) {
  const { url, index } = data
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const tickRef = useRef(0)
 
  // Fetch screenshot as blob so we own the bytes — no redirect flicker
  const fetchScreenshot = useCallback(
    async (cacheBust: number) => {
      // Abort any previous in-flight fetch
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
 
      const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url&cacheBust=${cacheBust}`
 
      try {
        setLoading(true)
        const res = await fetch(apiUrl, { signal: ac.signal })
        if (!res.ok) throw new Error('fetch failed')
        const blob = await res.blob()
        if (ac.signal.aborted) return
        // Revoke previous blob to avoid memory leak
        setBlobUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      } catch {
        // Aborted or network error — keep the old screenshot
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    },
    [url],
  )
 
  // Initial load + periodic refresh
  useEffect(() => {
    fetchScreenshot(tickRef.current)
 
    const interval = setInterval(() => {
      tickRef.current += 1
      fetchScreenshot(tickRef.current)
    }, REFRESH_INTERVAL)
 
    return () => {
      clearInterval(interval)
      abortRef.current?.abort()
    }
  }, [fetchScreenshot])
 
  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      setBlobUrl(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [])
 
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
        {/* Header */}
        <div className="px-3 py-2 border-b border-border-green/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe size={10} className="text-primary" />
            <span className="text-[9px] font-mono text-primary uppercase tracking-wider">
              Live Preview
            </span>
            {loading && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <RefreshCw size={7} className="text-primary/40" />
              </motion.div>
            )}
          </div>
          <button
            onClick={openUrl}
            className="nopan nodrag nowheel flex items-center gap-1 text-[8px] font-mono text-text-muted hover:text-cream transition-colors cursor-pointer bg-transparent border-none outline-none"
          >
            Open <ExternalLink size={8} />
          </button>
        </div>
 
        {/* Preview */}
        <button
          onClick={openUrl}
          className="nopan nodrag nowheel w-[280px] h-[170px] bg-bg-dark relative overflow-hidden cursor-pointer border-none outline-none block"
        >
          {blobUrl ? (
            <img
              src={blobUrl}
              alt="Site preview"
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <ImageIcon size={20} className="text-text-muted/30" />
              <span className="text-[9px] font-mono text-text-muted/50">
                {loading ? 'Loading preview…' : 'Click to open preview'}
              </span>
            </div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-primary/0 hover:bg-primary/5 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <span className="text-[9px] font-mono text-primary flex items-center gap-1 bg-bg-dark/80 px-3 py-1.5 rounded-full border border-primary/30">
              Open <ExternalLink size={8} />
            </span>
          </div>
          <div className="absolute inset-0 pointer-events-none border border-primary/10" />
        </button>
 
        {/* URL */}
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
 