'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'treehacks-events'

function buildJobsFromEvents(events) {
  const jobs = new Map()

  for (const event of events) {
    switch (event.type) {
      case 'start':
        jobs.set(event.jobId, {
          jobId: event.jobId,
          idea: event.idea,
          temperature: event.temperature,
          risk: event.risk,
          branch: event.branch,
          totalSteps: event.totalSteps,
          planSteps: event.planSteps,
          currentStep: -1,
          steps: [],
          pushes: [],
          deploymentUrl: null,
          status: 'building',
        })
        break
      case 'step': {
        const job = jobs.get(event.jobId)
        if (job) {
          job.currentStep = event.stepIndex
          if (!job.steps.some(s => s.stepIndex === event.stepIndex)) {
            job.steps.push({
              stepIndex: event.stepIndex,
              summary: event.summary,
              done: event.done,
            })
          }
        }
        break
      }
      case 'push': {
        const job = jobs.get(event.jobId)
        if (job) {
          if (!job.pushes.some(p => p.stepIndex === event.stepIndex)) {
            job.pushes.push({
              stepIndex: event.stepIndex,
              branch: event.branch,
              summary: event.summary,
            })
          }
        }
        break
      }
      case 'deployment': {
        const job = jobs.get(event.jobId)
        if (job) {
          job.deploymentUrl = event.url
          job.status = 'deployed'
        }
        break
      }
    }
  }

  return jobs
}

function loadStoredEvents() {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function getMaxEventId(events) {
  return events.reduce((max, e) => Math.max(max, e.id || 0), 0)
}

export function useJobStream() {
  const eventsRef = useRef(loadStoredEvents())
  const [jobs, setJobs] = useState(() => buildJobsFromEvents(eventsRef.current))

  useEffect(() => {
    const lastId = getMaxEventId(eventsRef.current)
    const eventSource = new EventSource(`/api/events?lastId=${lastId}`)

    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data)

      // Deduplicate by event id
      if (eventsRef.current.some(existing => existing.id === event.id)) return

      eventsRef.current = [...eventsRef.current, event]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsRef.current))
      setJobs(buildJobsFromEvents(eventsRef.current))
    }

    eventSource.onerror = () => {
      // EventSource auto-reconnects
    }

    return () => eventSource.close()
  }, [])

  const clearJobs = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    eventsRef.current = []
    setJobs(new Map())
  }, [])

  return {
    jobs: Array.from(jobs.values()),
    clearJobs,
  }
}
