'use client'

import { useState, useRef, useCallback } from 'react'
import ControlBar from './ControlBar'
import TeamMonitor from './TeamMonitor'
import MobileTeamSwitcher from './MobileTeamSwitcher'

export default function LiveBuildRoom({ sim, onViewResults }) {
  const { simHour, isPlaying, speed, teams, play, pause, setSimSpeed, jumpToHour } = sim
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0)
  const [showMobileGrid, setShowMobileGrid] = useState(false)
  const containerRef = useRef(null)

  const displayTeams = teams.slice(0, 6)

  const handleScroll = useCallback((e) => {
    const delta = e.target.scrollTop - (e.target._lastScrollTop || 0)
    e.target._lastScrollTop = e.target.scrollTop
    window.dispatchEvent(new CustomEvent('dotgrid-scroll', { detail: { delta } }))
  }, [])

  return (
    <div className="h-screen flex flex-col relative z-10">
      <ControlBar
        simHour={simHour}
        isPlaying={isPlaying}
        speed={speed}
        onPlay={play}
        onPause={pause}
        onSpeedChange={setSimSpeed}
        onJumpToHour={jumpToHour}
        onViewResults={onViewResults}
      />

      <MobileTeamSwitcher
        teams={displayTeams}
        activeIndex={mobileActiveIndex}
        onSelect={setMobileActiveIndex}
        showGrid={showMobileGrid}
        onToggleGrid={() => setShowMobileGrid(g => !g)}
      />

      {/* Desktop: 3x2 grid with line dividers */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-hidden hidden lg:block"
      >
        <div className="grid grid-cols-3 grid-rows-2 h-full max-w-[1800px] mx-auto">
          {displayTeams.map((team, i) => {
            const col = i % 3
            const row = Math.floor(i / 3)
            const borders = [
              row === 0 ? 'border-b border-border-green/40' : '',
              col < 2 ? 'border-r border-border-green/40' : '',
            ].join(' ')

            return (
              <div key={team.id} className={`overflow-hidden ${borders}`}>
                <TeamMonitor team={team} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Tablet: 2-col with line dividers */}
      <div
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto hidden md:block lg:hidden"
      >
        <div className="grid grid-cols-2 max-w-[900px] mx-auto">
          {displayTeams.map((team, i) => {
            const col = i % 2
            const row = Math.floor(i / 2)
            const borders = [
              row < 2 ? 'border-b border-border-green/40' : '',
              col === 0 ? 'border-r border-border-green/40' : '',
            ].join(' ')

            return (
              <div key={team.id} className={`h-[calc(33.33vh-20px)] overflow-hidden ${borders}`}>
                <TeamMonitor team={team} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile: Single pane or mini grid */}
      <div
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto md:hidden"
      >
        {showMobileGrid ? (
          <div className="grid grid-cols-2 gap-px bg-border-green/30">
            {displayTeams.map((team, i) => (
              <button
                key={team.id}
                onClick={() => { setMobileActiveIndex(i); setShowMobileGrid(false) }}
                className={`p-3 text-left cursor-pointer bg-bg-dark ${
                  mobileActiveIndex === i ? 'bg-primary/5' : ''
                }`}
              >
                <p className="text-xs font-semibold text-cream">{team.name}</p>
                <p className="text-[10px] text-text-muted truncate">{team.currentIdea.title}</p>
                <p className="text-[9px] text-primary font-mono mt-1">{team.status}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="h-full">
            {displayTeams[mobileActiveIndex] && (
              <TeamMonitor team={displayTeams[mobileActiveIndex]} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
