'use client'

import { createContext, useContext } from 'react'
import { useSimulation } from '../hooks/useSimulation'

const SimulationContext = createContext(null)

export function SimulationProvider({ children }) {
  const sim = useSimulation()
  return (
    <SimulationContext.Provider value={sim}>
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulationContext() {
  const ctx = useContext(SimulationContext)
  if (!ctx) throw new Error('useSimulationContext must be used within SimulationProvider')
  return ctx
}
