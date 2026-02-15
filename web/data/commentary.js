// Generates structured judge commentary based on team simulation data.
// Commentary is derived from metrics, events, and pivots — not random.

function hadPivot(team) {
  return team.events?.some(e => e.type === 'Pivot')
}

function riskCount(team) {
  return team.events?.filter(e => e.type === 'Risk').length || 0
}

function breakthroughCount(team) {
  return team.events?.filter(e => e.type === 'Breakthrough').length || 0
}

function shippingCount(team) {
  return team.events?.filter(e => e.type === 'Shipping').length || 0
}

function topMetric(breakdown) {
  const entries = Object.entries(breakdown)
  entries.sort((a, b) => b[1] - a[1])
  return entries[0]
}

function weakestMetric(breakdown) {
  const entries = Object.entries(breakdown)
  entries.sort((a, b) => a[1] - b[1])
  return entries[0]
}

const METRIC_LABELS = {
  feasibility: 'feasibility',
  novelty: 'novelty',
  demoReadiness: 'demo readiness',
  marketClarity: 'market clarity',
}

function generateStrengths(team) {
  const strengths = []
  const b = team.breakdown

  if (b.novelty >= 75) strengths.push('Highly original concept that stood out from the field')
  if (b.feasibility >= 75) strengths.push('Strong technical execution with a working, reliable prototype')
  if (b.demoReadiness >= 70) strengths.push('Polished demo that clearly communicated the value proposition')
  if (b.marketClarity >= 70) strengths.push('Well-defined target user and clear problem-solution fit')
  if (breakthroughCount(team) >= 2) strengths.push('Multiple technical breakthroughs showed deep engineering capability')
  if (shippingCount(team) >= 5) strengths.push('Consistent shipping velocity throughout the hackathon')
  if (!hadPivot(team) && b.feasibility >= 60) strengths.push('Clear early conviction that paid off — no wasted cycles')
  if (hadPivot(team) && b.novelty >= 65) strengths.push('Adapted quickly when the initial approach hit walls')

  // Ensure at least 2 strengths
  if (strengths.length < 2) {
    const [topKey] = topMetric(b)
    strengths.push(`Strongest score in ${METRIC_LABELS[topKey]} among the top contenders`)
  }

  return strengths.slice(0, 4)
}

function generateWeaknesses(team) {
  const weaknesses = []
  const b = team.breakdown

  if (b.novelty < 60) weaknesses.push('Concept felt derivative — judges wanted a more distinctive angle')
  if (b.feasibility < 55) weaknesses.push('Technical foundation felt fragile under scrutiny')
  if (b.demoReadiness < 55) weaknesses.push('Demo needed more polish to land the full story')
  if (b.marketClarity < 50) weaknesses.push('Target audience and go-to-market path remained unclear')
  if (riskCount(team) >= 3) weaknesses.push('Accumulated technical risks that narrowed the team\'s options late')
  if (hadPivot(team)) weaknesses.push('Pivot cost valuable build time mid-hackathon')
  if (b.demoReadiness < 65 && b.feasibility > 70) weaknesses.push('Strong tech under the hood, but the demo didn\'t fully showcase it')

  if (weaknesses.length < 2) {
    const [weakKey] = weakestMetric(b)
    weaknesses.push(`Relatively lower ${METRIC_LABELS[weakKey]} compared to peers`)
  }

  return weaknesses.slice(0, 3)
}

function generateTradeoffs(team, rank, ranked) {
  const tradeoffs = []
  const b = team.breakdown

  if (b.novelty > b.feasibility + 15) {
    tradeoffs.push('Prioritized ambition over stability — high ceiling but higher risk')
  }
  if (b.feasibility > b.novelty + 15) {
    tradeoffs.push('Chose reliability over novelty — solid execution but less wow factor')
  }
  if (b.demoReadiness > b.marketClarity + 15) {
    tradeoffs.push('Invested heavily in demo polish at the expense of market framing')
  }
  if (hadPivot(team)) {
    tradeoffs.push('The pivot was the right call but compressed the remaining timeline')
  }

  // Comparative tradeoffs
  if (rank === 0 && ranked[1]) {
    const diff = team.finalScore - ranked[1].finalScore
    if (diff <= 5) {
      tradeoffs.push(`Razor-thin margin over ${ranked[1].name} — could have gone either way`)
    }
  }
  if (rank === 1 && ranked[0]) {
    const gap = ranked[0].finalScore - team.finalScore
    if (gap <= 8) {
      tradeoffs.push(`Close to the top spot — a stronger demo could have closed the ${gap}-point gap`)
    }
  }
  if (rank === 2) {
    tradeoffs.push('Solid showing that would have placed higher in a less competitive field')
  }

  if (tradeoffs.length < 2) {
    tradeoffs.push('Balanced approach across all criteria with no major blind spots')
  }

  return tradeoffs.slice(0, 3)
}

function generateExecutiveSummary(ranked) {
  const first = ranked[0]
  const second = ranked[1]
  const third = ranked[2]
  const gap12 = first.finalScore - second.finalScore
  const gap23 = second.finalScore - third.finalScore

  const lines = []

  // Why first place won
  const [topKey] = topMetric(first.breakdown)
  lines.push(
    `${first.name} took first place with a final score of ${first.finalScore}, driven by exceptional ${METRIC_LABELS[topKey]} that set them apart from the field.`
  )

  // The gap
  if (gap12 <= 3) {
    lines.push(
      `The margin was razor-thin — ${second.name} trailed by just ${gap12} points, making this one of the closest finishes the judges have seen.`
    )
  } else if (gap12 <= 8) {
    lines.push(
      `${second.name} finished ${gap12} points behind, with a strong showing that fell just short in the final evaluation.`
    )
  } else {
    lines.push(
      `${second.name} put up a competitive score but ${first.name} pulled ahead decisively with a ${gap12}-point lead.`
    )
  }

  // Third place context
  if (hadPivot(third)) {
    lines.push(
      `${third.name} recovered well from a mid-hackathon pivot but the lost time showed in the final scores.`
    )
  } else {
    lines.push(
      `${third.name} delivered consistent work throughout but lacked the breakout moment that separated the top two.`
    )
  }

  // Overall observation
  const avgNovelty = Math.round((first.breakdown.novelty + second.breakdown.novelty + third.breakdown.novelty) / 3)
  if (avgNovelty >= 70) {
    lines.push(
      'Across the board, this cohort showed unusually high originality — the judges noted several ideas with real-world potential beyond the hackathon.'
    )
  } else {
    lines.push(
      'The top teams distinguished themselves through execution quality rather than concept novelty, reflecting a pragmatic and shipping-focused cohort.'
    )
  }

  return lines
}

export function generateCommentary(ranked) {
  const summary = generateExecutiveSummary(ranked)

  const teamAnalyses = ranked.slice(0, 3).map((team, i) => ({
    name: team.name,
    title: team.currentIdea?.title || team.name,
    rank: i,
    strengths: generateStrengths(team),
    weaknesses: generateWeaknesses(team),
    tradeoffs: generateTradeoffs(team, i, ranked),
  }))

  return { summary, teamAnalyses }
}
