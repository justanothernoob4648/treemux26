'use client'

import { ChevronLeft, ChevronRight, Grid3x3 } from 'lucide-react'

export default function MobileTeamSwitcher({ teams, activeIndex, onSelect, showGrid, onToggleGrid }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border-green bg-bg-dark/90 backdrop-blur-md lg:hidden">
      <button
        onClick={() => onSelect(Math.max(0, activeIndex - 1))}
        disabled={activeIndex <= 0}
        className="p-1.5 rounded-md hover:bg-primary/10 disabled:opacity-30 cursor-pointer"
      >
        <ChevronLeft size={18} className="text-cream" />
      </button>

      <div className="flex items-center gap-2 overflow-x-auto px-2">
        {teams.slice(0, 6).map((team, i) => (
          <button
            key={team.id}
            onClick={() => onSelect(i)}
            className={`px-2.5 py-1 text-xs font-mono rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              activeIndex === i
                ? 'bg-primary text-bg-dark font-bold'
                : 'text-text-secondary hover:text-cream hover:bg-primary/10'
            }`}
          >
            {team.name}
          </button>
        ))}
      </div>

      <button
        onClick={onToggleGrid}
        className={`p-1.5 rounded-md cursor-pointer ${showGrid ? 'bg-primary/20 text-primary' : 'text-text-muted hover:bg-primary/10'}`}
      >
        <Grid3x3 size={18} />
      </button>

      <button
        onClick={() => onSelect(Math.min(5, activeIndex + 1))}
        disabled={activeIndex >= 5}
        className="p-1.5 rounded-md hover:bg-primary/10 disabled:opacity-30 cursor-pointer"
      >
        <ChevronRight size={18} className="text-cream" />
      </button>
    </div>
  )
}
