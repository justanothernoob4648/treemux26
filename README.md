# Treemux

**AI-Powered Hackathon Orchestration Platform**

Treemux takes a single problem statement and spawns N parallel AI workers — each running Claude Code CLI inside isolated Modal sandboxes — to ideate, implement, and deploy complete projects autonomously. Every task set gets its own GitHub repo, and each worker gets its own branch and live Vercel deployment, for quick idea prototyping. with real-time progress streamed to users. Finally, we run our own evaluator model, which is responsabile for evaluating and judging each of the projects based ono on idea and implementation.

> Task → N × AI Workers (Modal + Claude Code) → GitHub → Vercel → Live Demos

This has tremendous potenttial. Imagine a founder simulating a batch of 100 YC companies in 3 hours for  $10 worth of Claude credits and having a deep research judge pick the best *implemented* idea?g

---

### System Overview

![System Overview](system-overview.drawio.svg)

### How It Works

1. **Task Submission** — `POST /v1.0/task` with a problem description and N worker profiles
2. **Setup** — Orchestrator creates a GitHub repo, N branches, and N Vercel deployments
3. **Spawn** — N Modal sandboxes boot (Ubuntu + Node + Bun + Claude Code CLI)
4. **Implement** — Each Claude agent autonomously writes code, using `treemux-report` to:
   - `start` — declare its idea and step plan
   - `step` — commit, push, and report progress after each step
   - `done` — write PITCH.md and finalize
5. **Real-Time UI** — Workers POST callbacks → store.ts → SSE → React dashboard updates live
6. **Completion** — When all workers finish, the evaluator webhook scores submissions

### Final Outputs (per worker)

| Output           | Description                          |
| ---------------- | ------------------------------------ |
| GitHub Branch    | Full source code on its own branch   |
| Vercel URL       | Live deployed demo at a unique URL   |
| PITCH.md         | Auto-generated project pitch         |
| Evaluation Score | Feasibility, novelty, demo readiness |

---

## Project Structure

```
treehacks-26/
├── api/                    # Orchestrator API (Bun + TypeScript)
│   └── src/
│       ├── server.ts       # HTTP + WebSocket server (:3000)
│       ├── index.ts        # Dev entry point (local testing)
│       ├── task.ts         # Task controller (repos, branches, spawn)
│       ├── ideation.ts     # OpenRouter-based idea generation
│       ├── github.ts       # GitHub API integration
│       ├── vercel.ts       # Vercel API integration
│       ├── implementation-spawn.ts  # Modal worker spawning
│       ├── observability.ts # WebSocket broadcast
│       ├── config.ts       # Configuration loader
│       ├── logger.ts       # Colored terminal logging
│       └── types.ts        # Shared type definitions
│
├── worker/                 # Modal implementation worker
│   ├── implementation_worker.py  # Modal app + HTTP trigger
│   ├── runner.py           # Sandbox entry point (git + Claude CLI)
│   ├── scripts/
│   │   └── treemux_report.py    # CLI tool for progress reporting
│   └── skills/             # Reference docs baked into sandbox
│       ├── shadcn-ui/
│       ├── frontend-design/
│       ├── vercel-react-best-practices/
│       ├── ai-sdk/
│       ├── streamdown/
│       └── find-skills/
│
├── web/                    # Next.js frontend
│   ├── app/
│   │   ├── page.tsx        # Landing (redirects to /live)
│   │   ├── layout.tsx      # Root layout
│   │   ├── create/page.tsx # Task creation page
│   │   ├── live/page.tsx   # Real-time build monitor
│   │   ├── judges/page.tsx # Results dashboard
│   │   └── api/            # Next.js API routes
│   │       ├── events/route.ts        # SSE event stream
│   │       └── log/{start,step,push,deployment}/route.ts  # Worker callbacks
│   ├── components/
│   │   ├── LiveBuildRoom.tsx    # 6-team grid display
│   │   ├── TeamMonitor.tsx      # Per-team build pipeline
│   │   ├── BuildFlow.tsx        # DAG visualization (@xyflow/react)
│   │   ├── MilestoneTimeline.tsx
│   │   ├── MetricsStrip.tsx
│   │   ├── JudgesScreen.tsx
│   │   ├── LandingPage.tsx      # Landing page UI
│   │   ├── ControlBar.tsx       # Playback controls
│   │   ├── DotGrid.tsx          # Animated dot grid background
│   │   ├── EventFeed.tsx        # Real-time event log
│   │   ├── MobileTeamSwitcher.tsx # Mobile team navigation
│   │   └── flow/                # Custom @xyflow/react nodes
│   │       ├── BuildNode.tsx
│   │       ├── JudgingNode.tsx
│   │       ├── PreviewNode.tsx
│   │       └── StartNode.tsx
│   ├── hooks/
│   │   ├── useJobStream.ts      # SSE consumer + event aggregation
│   │   ├── useTaskStream.ts     # Task stream hook
│   │   └── useSimulation.ts     # Accelerated clock
│   ├── contexts/
│   │   └── SimulationContext.tsx
│   └── lib/
│       └── store.ts             # In-memory event log + SSE broadcast
│
└── architecture.drawio     # Detailed architecture diagrams (5 pages)
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.3+)
- [Modal](https://modal.com) account + CLI (`pip install modal`)
- GitHub Personal Access Token
- Vercel Token
- Anthropic API Key

### Environment Variables

Create a `.env` file in the project root:

```env
GITHUB_TOKEN=ghp_...
VERCEL_TOKEN=...
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_CODE_OAUTH_TOKEN=...
MODAL_IMPLEMENTATION_WORKER_URL=https://...
CALLBACK_BASE_URL=https://your-server-url
EVALUATOR_WEBHOOK_URL=https://...
MODEL=sonnet
PORT=3000
```

### Run Locally

```bash
# 1. Deploy the Modal worker
cd worker
modal deploy implementation_worker.py

# 2. Start the orchestrator API
cd api
bun install
bun run src/server.ts

# 3. Start the frontend
cd web
bun install
bun run dev
```

The frontend runs on `http://localhost:3000` (or the next available port). The API runs on port 3000 by default.

### Trigger a Task

```bash
curl -X POST http://localhost:3000/v1.0/task \
  -H "Content-Type: application/json" \
  -d '{
    "taskDescription": "Build a real-time collaborative whiteboard app",
    "workers": 3,
    "workerDescriptions": [
      "Full-stack engineer specializing in React and WebSockets",
      "UI/UX focused developer with design system experience",
      "Backend engineer focused on scalability and real-time sync"
    ],
    "model": "sonnet"
  }'
```

Then open `http://localhost:3000/live` to watch all workers build in real-time.

---

## Key Concepts

### treemux-report

A CLI tool available inside each sandbox that Claude uses to report progress:

```bash
# Declare idea and plan
treemux-report start --idea "Collaborative whiteboard" --steps "Setup Next.js" "Add canvas" "WebSocket sync"

# After completing each step (commits + pushes automatically)
treemux-report step --index 0 --summary "Scaffolded Next.js with Tailwind"

# When done (writes PITCH.md + final push)
treemux-report done
```

Each command sends an HTTP callback to the orchestrator, which forwards it to the frontend via SSE.

### Concurrency Model

- N workers run **in parallel**, each in a fully isolated Modal sandbox
- Each worker gets its own **GitHub branch** and **Vercel deployment**
- Workers report progress **independently** via HTTP callbacks
- The frontend aggregates all events into a **unified real-time dashboard**
- No worker depends on another — they race to complete the same task with different approaches

---

## License

Built for [TreeHacks 2026](https://www.treehacks.com/).
