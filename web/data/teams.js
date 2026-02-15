const PERSONALITY_CHIPS = [
  'Full-Stack', 'ML/AI', 'Design', 'Backend', 'Mobile', 'Hardware',
  'Data Viz', 'DevOps', 'Blockchain', 'AR/VR', 'NLP', 'Systems',
]

const TEAM_NAMES = [
  'NeuroLink', 'GreenByte', 'QuantumLeap', 'EchoVerse',
  'SynthWave', 'Arboretum', 'Meridian', 'NovaCraft',
  'Terraform', 'Helix',
]

const MILESTONE_TEMPLATES = [
  { id: 'ideation', label: 'Ideation', defaultHour: 2 },
  { id: 'mvp-skeleton', label: 'MVP Skeleton', defaultHour: 8 },
  { id: 'pivot', label: 'Pivot', defaultHour: null },
  { id: 'breakthrough', label: 'Breakthrough', defaultHour: 18 },
  { id: 'demo-polish', label: 'Demo Polish', defaultHour: 30 },
  { id: 'submission', label: 'Submitted', defaultHour: 36 },
]

// Each script tells a story: propose ideas → one gets challenged → pivot → build
// ideaUpdate fields populate/change the idea card dynamically
const TEAM_SCRIPTS = [
  // Team 0: NeuroLink — proposes EEG idea, gets challenged on hardware cost, stays course
  [
    { hour: 0.3, text: 'Pitching ideas: EEG focus tracker, sleep optimizer, stress monitor', type: 'Milestone' },
    { hour: 0.8, text: '"What about a real-time focus score from brainwaves?"', type: 'Milestone' },
    { hour: 1.2, text: 'Mentor pushes back: "Consumer EEG headbands are noisy — how will you filter?"', type: 'Risk' },
    { hour: 1.8, text: 'Team commits: will solve noise with bandpass filtering',
      type: 'Milestone', milestone: 'ideation',
      ideaUpdate: { title: 'BrainBridge', pitch: 'Real-time neural feedback for focus optimization', direction: 'Building EEG-to-app pipeline' },
    },
    { hour: 3, text: 'Repo scaffolded, Python + React monorepo', type: 'Shipping' },
    { hour: 5, text: 'Raw EEG signal parsing working in terminal', type: 'Shipping' },
    { hour: 7, text: 'Basic websocket streaming from device to browser', type: 'Shipping', milestone: 'mvp-skeleton' },
    { hour: 10, text: 'Signal noise way higher than expected — mentor was right', type: 'Risk' },
    { hour: 12, text: 'Implemented bandpass filter — signal finally clean', type: 'Breakthrough' },
    { hour: 15, text: 'Focus score algorithm v1 producing reasonable output', type: 'Shipping',
      ideaUpdate: { direction: 'Focus scoring pipeline working, building visualization' },
    },
    { hour: 18, text: 'Real-time focus visualization rendering in browser', type: 'Breakthrough', milestone: 'breakthrough' },
    { hour: 22, text: 'Added historical session tracking and trends', type: 'Shipping' },
    { hour: 26, text: 'Calibration flow confusing for new users', type: 'Risk' },
    { hour: 28, text: 'Simplified onboarding to 3 steps', type: 'Shipping',
      ideaUpdate: { direction: 'Polishing UX — simplified onboarding flow' },
    },
    { hour: 31, text: 'Demo walkthrough scripted and rehearsed', type: 'Milestone', milestone: 'demo-polish' },
    { hour: 34, text: 'Final polish: animations + loading states', type: 'Shipping' },
    { hour: 35.5, text: 'Submission package uploaded', type: 'Shipping', milestone: 'submission' },
  ],
  // Team 1: GreenByte — starts with AR carbon tracker, AR gets destroyed, pivots to card UI
  [
    { hour: 0.3, text: 'Three ideas on the board: AR carbon lens, food waste tracker, green routing', type: 'Milestone' },
    { hour: 0.7, text: '"AR overlay that shows carbon footprint when you point at any product"', type: 'Milestone' },
    { hour: 1.3, text: 'Team excited — going all in on AR approach', type: 'Milestone',
      ideaUpdate: { title: 'CarbonLens', pitch: 'AR overlay showing carbon footprint of products', direction: 'Building AR camera pipeline' },
    },
    { hour: 2, text: 'Committed to barcode-scan + AR overlay', type: 'Milestone', milestone: 'ideation' },
    { hour: 4, text: 'Camera API + barcode detection working', type: 'Shipping' },
    { hour: 6, text: 'Emissions database API returning data', type: 'Shipping' },
    { hour: 8, text: 'End-to-end scan → AR result flow working', type: 'Shipping', milestone: 'mvp-skeleton' },
    { hour: 10, text: 'AR overlay is way too laggy on mobile — 4fps on iPhone', type: 'Risk' },
    { hour: 11, text: 'Tried WebXR, ARKit bridge, three.js — all too slow', type: 'Risk' },
    { hour: 12, text: 'Pivoting: dropping AR entirely, switching to clean card-based results',
      type: 'Pivot', milestone: 'pivot',
      ideaUpdate: { title: 'CarbonLens', pitch: 'Scan any product barcode to see its carbon footprint', direction: 'Pivoted to card UI — much faster' },
    },
    { hour: 14, text: 'New card UI renders in under 200ms — night and day difference', type: 'Breakthrough' },
    { hour: 17, text: 'Added product comparison feature', type: 'Shipping',
      ideaUpdate: { direction: 'Card UI working, adding comparison features' },
    },
    { hour: 20, text: 'Carbon savings calculator working', type: 'Breakthrough', milestone: 'breakthrough' },
    { hour: 24, text: 'Social sharing for eco-impact scores', type: 'Shipping' },
    { hour: 28, text: 'Demo flow polished with sample products', type: 'Milestone', milestone: 'demo-polish' },
    { hour: 32, text: 'Accessibility audit — added screen reader support', type: 'Shipping' },
    { hour: 35, text: 'Final submission with video demo', type: 'Shipping', milestone: 'submission' },
  ],
  // Team 2: QuantumLeap — proposes sim, challenged on audience, pivots to puzzle game
  [
    { hour: 0.5, text: 'Brainstorming: quantum circuit sim, quantum game, crypto tool', type: 'Milestone' },
    { hour: 1, text: '"Let\'s build a full quantum circuit simulator in the browser"', type: 'Milestone',
      ideaUpdate: { title: 'QBit Sim', pitch: 'Full quantum circuit simulator in the browser', direction: 'Exploring WebAssembly for simulation speed' },
    },
    { hour: 1.5, text: 'Judge feedback: "Cool tech, but who would actually use this at a hackathon demo?"', type: 'Risk' },
    { hour: 2.5, text: 'Pivoting to puzzle game — teaches quantum concepts through play',
      type: 'Pivot', milestone: 'ideation',
      ideaUpdate: { title: 'QBit Tutor', pitch: 'Learn quantum computing through interactive puzzles', direction: 'Designing puzzle mechanics around qubit gates' },
    },
    { hour: 5, text: 'Basic qubit visualization rendering', type: 'Shipping' },
    { hour: 8, text: 'First puzzle level playable end-to-end', type: 'Shipping', milestone: 'mvp-skeleton' },
    { hour: 11, text: 'Gate operation animations look broken — confusing for players', type: 'Risk' },
    { hour: 13, text: 'Rewrote animation engine from scratch', type: 'Shipping',
      ideaUpdate: { direction: 'Rebuilt animation system — much clearer' },
    },
    { hour: 16, text: 'New animations are gorgeous — huge improvement', type: 'Breakthrough' },
    { hour: 19, text: '5 puzzle levels complete with difficulty curve', type: 'Milestone', milestone: 'breakthrough' },
    { hour: 23, text: 'Added explanatory tooltips between levels', type: 'Shipping' },
    { hour: 27, text: 'Performance issues with complex circuits on mobile', type: 'Risk' },
    { hour: 29, text: 'Optimized circuit renderer — runs smooth', type: 'Shipping' },
    { hour: 31, text: 'Demo script: "teach superposition in 3 minutes"', type: 'Milestone', milestone: 'demo-polish',
      ideaUpdate: { direction: 'Demo-ready: 8 levels, teaches superposition + entanglement' },
    },
    { hour: 35, text: 'Submitted with all 8 levels polished', type: 'Shipping', milestone: 'submission' },
  ],
  // Team 3: EchoVerse — validated by users early, never pivots
  [
    { hour: 0.3, text: 'Ideas: spatial audio nav, gesture-based music, voice-controlled home', type: 'Milestone' },
    { hour: 0.6, text: '"What if we built audio maps for blind navigation?"', type: 'Milestone' },
    { hour: 1, text: 'Called 2 visually impaired friends — both said "please build this"', type: 'Milestone',
      ideaUpdate: { title: 'SoundScape', pitch: 'Spatial audio maps for visually impaired navigation', direction: 'Validated by real users — building LiDAR + audio pipeline' },
    },
    { hour: 2, text: 'Approach validated by testers — locked in', type: 'Milestone', milestone: 'ideation' },
    { hour: 4, text: 'LiDAR point cloud processing pipeline up', type: 'Shipping' },
    { hour: 7, text: 'Basic audio spatialization from depth data', type: 'Shipping', milestone: 'mvp-skeleton' },
    { hour: 10, text: 'Tester feedback: all audio cues sound the same — can\'t tell wall from chair', type: 'Risk' },
    { hour: 13, text: 'Assigned distinct sound textures: walls=low hum, furniture=clicks, doors=chime', type: 'Breakthrough',
      ideaUpdate: { direction: 'Sound textures working — walls, furniture, doors all distinct' },
    },
    { hour: 16, text: 'Tested with 3 users — positive reactions, one cried', type: 'Milestone' },
    { hour: 19, text: 'Added voice narration for navigation prompts', type: 'Breakthrough', milestone: 'breakthrough',
      ideaUpdate: { direction: 'Voice nav added — full spatial awareness system' },
    },
    { hour: 23, text: 'Indoor mapping with room layout detection', type: 'Shipping' },
    { hour: 27, text: 'Battery drain from constant LiDAR scanning — 45min to dead', type: 'Risk' },
    { hour: 29, text: 'Adaptive scanning: only active when user is moving', type: 'Shipping', milestone: 'demo-polish' },
    { hour: 33, text: 'Demo video recorded with real user navigating a room', type: 'Milestone' },
    { hour: 35.5, text: 'Submitted with accessibility statement', type: 'Shipping', milestone: 'submission' },
  ],
  // Team 4: SynthWave — wild brainstorm, settles late, pivots approach mid-hack
  [
    { hour: 0.5, text: '12 ideas on the whiteboard. Chaos.', type: 'Milestone' },
    { hour: 1.5, text: 'Top 3: mood lighting, AI DJ, biometric art generator', type: 'Milestone' },
    { hour: 2.5, text: '"Workspace lights that change color based on how the team is feeling"', type: 'Milestone' },
    { hour: 3, text: 'Locked in: ambient sentiment lighting via Slack analysis',
      type: 'Milestone', milestone: 'ideation',
      ideaUpdate: { title: 'MoodMesh', pitch: 'Ambient workspace lighting synced to team sentiment', direction: 'Hooking up Slack webhook + NLP pipeline' },
    },
    { hour: 5, text: 'Slack webhook capturing team messages', type: 'Shipping' },
    { hour: 7, text: 'NLP sentiment model returning per-message scores', type: 'Shipping' },
    { hour: 9, text: 'IoT bulbs changing color from API calls — it works!', type: 'Shipping', milestone: 'mvp-skeleton' },
    { hour: 12, text: 'Problem: sentiment flips wildly message-to-message. Lights are seizure-inducing.', type: 'Risk' },
    { hour: 13, text: '"This is unusable. We need to rethink the signal."', type: 'Risk' },
    { hour: 14, text: 'Pivoting: aggregate mood over 30-min sliding windows instead of per-message',
      type: 'Pivot', milestone: 'pivot',
      ideaUpdate: { title: 'MoodMesh', pitch: 'Ambient workspace lighting synced to team sentiment', direction: 'Pivoted to 30-min rolling mood — much smoother' },
    },
    { hour: 17, text: 'Smoothed mood curves look beautiful — gentle color transitions', type: 'Breakthrough', milestone: 'breakthrough' },
    { hour: 21, text: 'Added dashboard with mood history graph', type: 'Shipping',
      ideaUpdate: { direction: 'Mood dashboard + IoT lights working in harmony' },
    },
    { hour: 25, text: 'WebSocket keeps disconnecting under load', type: 'Risk' },
    { hour: 27, text: 'Switched to SSE — much more stable', type: 'Shipping' },
    { hour: 30, text: 'Demo setup with live Slack integration running', type: 'Milestone', milestone: 'demo-polish' },
    { hour: 34, text: 'Final tweaks to color palette transitions', type: 'Shipping' },
    { hour: 35.5, text: 'Submitted with hardware demo video', type: 'Shipping', milestone: 'submission' },
  ],
  // Team 5: Arboretum — deep tech, challenged on "so what?", adds compelling viz
  [
    { hour: 0.5, text: 'Ideas: soil monitoring, precision farming, root system mapping', type: 'Milestone' },
    { hour: 1, text: '"3D visualization of underground root systems from soil sensors"', type: 'Milestone',
      ideaUpdate: { title: 'RootMapper', pitch: 'Underground root system visualization from soil sensors', direction: 'Exploring sensor data → 3D render pipeline' },
    },
    { hour: 1.5, text: 'Mentor: "This is technically cool but who cares about roots? What\'s the use case?"', type: 'Risk' },
    { hour: 2.5, text: 'Reframed: detect early root disease to prevent crop loss. Locked in.',
      type: 'Milestone', milestone: 'ideation',
      ideaUpdate: { title: 'RootMapper', pitch: 'Detect root disease early to prevent crop loss', direction: 'Sensor data → disease detection → 3D viz' },
    },
    { hour: 5, text: 'Sensor data parser ingesting CSV streams', type: 'Shipping' },
    { hour: 8, text: 'Basic 3D scatter plot of sensor readings', type: 'Shipping', milestone: 'mvp-skeleton' },
    { hour: 11, text: 'Three.js rendering too slow for dense point clouds — 8fps', type: 'Risk' },
    { hour: 14, text: 'Switched to instanced meshes — 10x faster, smooth 60fps', type: 'Breakthrough',
      ideaUpdate: { direction: 'Rendering breakthrough — smooth 3D at 60fps' },
    },
    { hour: 17, text: 'Root path estimation algorithm working — can trace individual roots', type: 'Breakthrough', milestone: 'breakthrough' },
    { hour: 20, text: 'Added time-lapse animation of root growth over weeks', type: 'Shipping' },
    { hour: 24, text: 'Color-coded health indicators per root segment', type: 'Shipping',
      ideaUpdate: { direction: 'Health detection working — red/yellow/green per root segment' },
    },
    { hour: 27, text: 'Mobile view broken — responsive 3D is hard', type: 'Risk' },
    { hour: 29, text: 'Desktop-only with nice fallback message for mobile', type: 'Shipping' },
    { hour: 31, text: 'Demo with synthetic but realistic dataset', type: 'Milestone', milestone: 'demo-polish' },
    { hour: 35, text: 'Submitted with research paper link', type: 'Shipping', milestone: 'submission' },
  ],
]

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

export const TEAMS = Array.from({ length: 10 }, (_, i) => ({
  id: `team-${i}`,
  name: TEAM_NAMES[i],
  chips: pickN(PERSONALITY_CHIPS, 3),
  initialMetrics: {
    feasibility: 40 + Math.floor(Math.random() * 30),
    novelty: 50 + Math.floor(Math.random() * 30),
    demoReadiness: 10 + Math.floor(Math.random() * 15),
    marketClarity: 30 + Math.floor(Math.random() * 25),
  },
  initialMilestones: MILESTONE_TEMPLATES.map(m => ({
    ...m,
    completed: false,
    hour: null,
  })),
  initialEvents: [],
  script: TEAM_SCRIPTS[i] || TEAM_SCRIPTS[i % 6].map(e => ({ ...e })),
}))

export function getTeamStatus(hour) {
  if (hour < 2) return 'Ideating'
  if (hour < 8) return 'Prototyping'
  if (hour < 18) return 'Building MVP'
  if (hour < 28) return 'Integrating'
  if (hour < 34) return 'Polishing Demo'
  return 'Final Push'
}

export function calculateFinalScores(teams) {
  return teams.map(team => {
    const m = team.metrics
    const total = Math.round(
      m.feasibility * 0.25 +
      m.novelty * 0.3 +
      m.demoReadiness * 0.25 +
      m.marketClarity * 0.2
    )
    return {
      ...team,
      finalScore: total,
      breakdown: {
        feasibility: m.feasibility,
        novelty: m.novelty,
        demoReadiness: m.demoReadiness,
        marketClarity: m.marketClarity,
      },
    }
  }).sort((a, b) => b.finalScore - a.finalScore)
}
