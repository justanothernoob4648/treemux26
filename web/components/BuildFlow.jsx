'use client'

import { useMemo } from 'react'
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import StartNode from './flow/StartNode'
import BuildNode from './flow/BuildNode'
import PreviewNode from './flow/PreviewNode'
import JudgingNode from './flow/JudgingNode'

const nodeTypes = {
  startNode: StartNode,
  buildNode: BuildNode,
  previewNode: PreviewNode,
  judgingNode: JudgingNode,
}

const edgeDefaults = {
  animated: true,
  style: { stroke: 'rgba(3, 141, 57, 0.4)', strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(3, 141, 57, 0.4)' },
}

const BUILD_X = 350
const PREVIEW_X = 750
const JUDGING_X = 1150
const VERTICAL_SPACING = 420
const VERTICAL_OFFSET = 40

function buildFlowElements(jobs) {
  const nodes = []
  const edges = []

  // Calculate vertical centering
  const totalHeight = jobs.length > 0 ? (jobs.length - 1) * VERTICAL_SPACING : 0
  const startY = -totalHeight / 2

  // Start node
  nodes.push({
    id: 'start',
    type: 'startNode',
    position: { x: 0, y: 0 },
    data: {},
  })

  const deployedCount = jobs.filter(j => j.status === 'deployed').length

  jobs.forEach((job, i) => {
    const y = startY + i * VERTICAL_SPACING + VERTICAL_OFFSET
    const buildId = `build-${job.jobId}`
    const previewId = `preview-${job.jobId}`

    // Build node
    nodes.push({
      id: buildId,
      type: 'buildNode',
      position: { x: BUILD_X, y },
      data: { job },
    })

    // Edge: start → build
    edges.push({
      id: `start-${buildId}`,
      source: 'start',
      target: buildId,
      ...edgeDefaults,
    })

    // Preview node (if deployed)
    if (job.deploymentUrl) {
      nodes.push({
        id: previewId,
        type: 'previewNode',
        position: { x: PREVIEW_X, y },
        data: { url: job.deploymentUrl },
      })

      // Edge: build → preview
      edges.push({
        id: `${buildId}-${previewId}`,
        source: buildId,
        target: previewId,
        ...edgeDefaults,
        style: { stroke: 'rgba(3, 141, 57, 0.6)', strokeWidth: 2 },
      })

      // Edge: preview → judging
      edges.push({
        id: `${previewId}-judging`,
        source: previewId,
        target: 'judging',
        ...edgeDefaults,
      })
    } else {
      // Edge: build → judging (dashed, waiting)
      edges.push({
        id: `${buildId}-judging`,
        source: buildId,
        target: 'judging',
        ...edgeDefaults,
        animated: false,
        style: { stroke: 'rgba(3, 141, 57, 0.15)', strokeWidth: 1, strokeDasharray: '4 4' },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(3, 141, 57, 0.15)' },
      })
    }
  })

  // Judging node
  nodes.push({
    id: 'judging',
    type: 'judgingNode',
    position: { x: JUDGING_X, y: 0 },
    data: { deployedCount, totalJobs: jobs.length },
  })

  return { nodes, edges }
}

export default function BuildFlow({ jobs }) {
  const { nodes, edges } = useMemo(() => buildFlowElements(jobs), [jobs])

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
      >
        <Background color="rgba(3, 141, 57, 0.08)" gap={32} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-bg-dark/80 !border-border-green !rounded-lg"
        />
      </ReactFlow>
    </div>
  )
}
