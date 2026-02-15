# Treemux

**AI-Powered Orchestration Platform**

Treemux takes a single problem statement and spawns N parallel AI workers — each running Claude Code CLI inside isolated Modal sandboxes — to ideate, implement, and deploy complete projects autonomously. Every task set gets its own GitHub repo, and each worker gets its own branch and live Vercel deployment, for quick idea prototyping, with real-time progress streamed to users. Finally, we run our own evaluator model, which is responsible for evaluating and judging each of the projects based on idea and implementation.

> Task → N × AI Workers (Modal + Claude Code) → GitHub → Vercel → Live Demos → AI Judges

This has tremendous potential. Imagine a founder simulating a batch of 100 YC companies in 3 hours for $10 worth of Claude credits and having a deep research judge pick the best *implemented* idea.

---

## System Overview

![System Overview](system-overview.drawio.svg)

The architecture is split into four independent services:

| Folder | Stack | Role |
|--------|-------|------|
| `api/` | Bun + TypeScript | Orchestrator — HTTP/WS server, task lifecycle, provider integrations |
| `worker/` | Python + Modal | Implementation — isolated sandboxes running Claude Code CLI |
| `eval/` | TypeScript + Claude Agent SDK | Evaluation — multi-judge scoring with browser-based testing |
| `web/` | Next.js + React + @xyflow/react | Frontend — real-time pipeline visualization and results dashboard |

---

## How It Works

1. **Task Submission** — `POST /v1.0/task` with a problem description and N worker profiles
2. **Setup** — Orchestrator creates a GitHub repo, N branches, and N Vercel deployments
3. **Spawn** — N Modal sandboxes boot (Ubuntu + Node + Bun + Claude Code CLI)
4. **Implement** — Each Claude agent autonomously writes code, using `treemux-report` to:
   - `start` — declare its idea and step plan
   - `step` — commit, push, and report progress after each step
   - `done` — write PITCH.md and finalize
5. **Real-Time UI** — Workers POST callbacks → API → WebSocket → React dashboard updates live
6. **Evaluation** — When all workers finish, the eval service judges every deployment with AI agents + real browsers
7. **Results** — Rankings, composite scores, and detailed feedback streamed to the frontend sidebar

### Final Outputs (per worker)

| Output           | Description                          |
| ---------------- | ------------------------------------ |
| GitHub Branch    | Full source code on its own branch   |
| Vercel URL       | Live deployed demo at a unique URL   |
| PITCH.md         | Auto-generated project pitch         |
| Evaluation Score | Feasibility, novelty, demo readiness |

---

## Provider Deep Dive

Treemux integrates with 8 external providers. Here's exactly how each one is used.

### 1. Modal — Cloud Sandboxes

**Used by:** `worker/`, `eval/`

Modal provides isolated cloud sandboxes where AI agents execute code without risk to the host system.

- **Implementation workers** (`worker/implementation_worker.py`): Each worker spawns a Modal sandbox with a custom image (Ubuntu + Node.js + Bun + Claude Code CLI). The API triggers the worker via Modal's HTTP endpoint. Inside the sandbox, `runner.py` sets up git, runs Claude Code CLI, and pushes code to GitHub on every step.
- **Evaluation sandboxes** (`eval/src/modal/client.ts`): The eval system can optionally dispatch judge agents to Modal sandboxes for isolated browser-based evaluation, preventing resource contention when running many judges in parallel.
- **Configuration**: `MODAL_IMPLEMENTATION_WORKER_URL` env var points to the deployed Modal function endpoint.

### 2. GitHub — Version Control

**Used by:** `api/`, `worker/`

GitHub stores all generated code and enables Vercel auto-deployments via branch tracking.

- **Repo creation** (`api/src/github.ts`): The API creates a new public GitHub repo per task (e.g. `treemux-<nanoid>`) using the REST API with `auto_init: true`.
- **Branch creation** (`api/src/github.ts`): N branches are created (one per worker, e.g. `treemux-worker-<jobId>`), each forked from the default branch's HEAD SHA. Includes retry logic for the initial commit race condition.
- **Git push from sandbox** (`worker/runner.py`): Inside the Modal sandbox, the worker configures git with the provided `GITHUB_TOKEN`, `GIT_USER_NAME`, and `GIT_USER_EMAIL`, then commits and force-pushes after every implementation step.
- **Authentication**: `GITHUB_TOKEN` (Personal Access Token with `repo` scope).

### 3. Vercel — Deployment Platform

**Used by:** `api/`

Vercel provides instant deployments for every worker branch, giving each implementation a live URL.

- **Project + Deployment creation** (`api/src/vercel.ts`): Uses the `@vercel/sdk` to create a deployment linked to the GitHub repo + branch. Framework is set to Next.js with `npm run build` / `npm install`.
- **Auto-deploy on push**: Vercel watches each branch — every `git push` from the worker triggers a new build automatically.
- **Deployment protection** (`api/src/vercel.ts`): Disables SSO/password protection so all deployments are publicly accessible for evaluation.
- **Environment variables** (`api/src/vercel.ts`): Injects `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `OPENROUTER_API_KEY` into each Vercel project so deployed apps can call AI services at runtime.
- **Authentication**: `VERCEL_TOKEN` (Vercel API token).

### 4. Anthropic (Claude) — AI Code Generation & Evaluation

**Used by:** `worker/`, `eval/`

Claude powers both the code-writing agents and the evaluation judges.

- **Claude Code CLI** (`worker/runner.py`): The implementation sandbox runs `claude` (the Claude Code CLI) which autonomously writes, edits, and commits code. It receives the task idea, worker profile, temperature, and risk level as context. Authenticated via `CLAUDE_CODE_OAUTH_TOKEN`.
- **Claude Agent SDK** (`eval/src/agents/`): The evaluation system uses the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) for three agent types:
  - **Planner agent** — generates a judging plan with scoring categories and judge personas
  - **Judge agents** — score each project on defined criteria (text-only or browser-based)
  - **Report writer** — produces a rankings summary from all judge results
- **Models used**: `claude-sonnet-4-5-20250929` for planning/research/judging, `claude-opus-4-6` for report writing.
- **Authentication**: `ANTHROPIC_API_KEY` for the Agent SDK, `CLAUDE_CODE_OAUTH_TOKEN` for the CLI.

### 5. OpenRouter — AI API Gateway

**Used by:** `api/`

OpenRouter provides access to multiple LLM providers through a single API.

- **Ideation** (`api/src/ideation.ts`): Calls OpenRouter with `google/gemma-2-9b-it` to generate structured ideas from the task description + worker profiles. Returns a JSON array with `idea`, `risk` (0-100), and `temperature` (0-100) per worker. Currently the pipeline uses synthetic ideation (passing the task directly), but the OpenRouter infrastructure is fully wired.
- **Pitch generation**: The worker sandbox has access to `OPENROUTER_API_KEY` to generate compelling elevator pitches for the evaluator.
- **Authentication**: `OPENROUTER_API_KEY`.

### 6. OpenAI — Alternative AI Provider

**Used by:** `worker/` (sandbox environment)

OpenAI GPT models are available as an alternative AI provider in the sandbox.

- **Environment injection**: The API injects `OPENAI_API_KEY` into both the Modal sandbox and the Vercel deployment environment, allowing worker-built apps to use GPT models at runtime.
- **Authentication**: `OPENAI_API_KEY`.

### 7. BrowserBase (Stagehand) — Browser Automation

**Used by:** `eval/`

BrowserBase provides cloud browser sessions for evaluating deployed web applications.

- **Stagehand SDK** (`eval/src/tools/stagehand.ts`): The evaluation system uses `@browserbasehq/stagehand` to launch browser sessions that navigate to each deployed project URL.
- **Session pooling** (`eval/src/tools/stagehand-pool.ts`): A pool manager maintains concurrent browser sessions to evaluate multiple projects in parallel without exceeding limits.
- **Judge evaluation flow**: Browser-based judges navigate to the live deployment, interact with the UI, take screenshots, and assess functionality, accessibility, and demo readiness.
- **Authentication**: `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID`.

### 8. Microlink — Screenshot API

**Used by:** `web/`

Microlink provides live screenshot thumbnails for the pipeline visualization.

- **DeployNode** (`web/components/pipeline/DeployNode.tsx`): Fetches a screenshot of each Vercel deployment URL via `https://api.microlink.io/?url=<url>&screenshot=true&meta=false&embed=screenshot.url`. The screenshot auto-refreshes every 5 seconds with cache busting to show the latest build state.
- **PreviewNode** (`web/components/flow/PreviewNode.tsx`): Same screenshot logic for the `/live` simulation page.
- **Iframe embedding**: Deployed projects include `Content-Security-Policy: frame-ancestors *` (via `vercel.json` and `next.config.ts` headers) which overrides Vercel's default `X-Frame-Options` in modern browsers, enabling live iframe previews.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.3+)
- [Modal](https://modal.com) account + CLI (`pip install modal`)
- GitHub Personal Access Token
- Vercel Token
- Anthropic API Key

### Environment Variables

Create `api/.env`:

```env
# Core
PORT=3000
CALLBACK_BASE_URL=https://your-server-url

# GitHub
GITHUB_TOKEN=ghp_...
GIT_USER_NAME=your-github-username
GIT_USER_EMAIL=your@email.com

# Vercel
VERCEL_TOKEN=...

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_CODE_OAUTH_TOKEN=...
OPENAI_API_KEY=sk-proj-...
OPENROUTER_API_KEY=sk-or-v1-...

# Worker
MODAL_IMPLEMENTATION_WORKER_URL=https://...
MODEL=sonnet

# Eval
EVAL_WS_URL=ws://localhost:3002/evaluate
EVALUATOR_WEBHOOK_URL=
```

Create `web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
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

# 3. Start the eval server (optional)
cd eval
bun install
bun run src/eval/server.ts

# 4. Start the frontend
cd web
bun install
bun run dev
```

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
    "evaluator": {
      "count": 1,
      "role": "hackathon judge",
      "criteria": "novelty, feasibility, demo readiness"
    },
    "model": "sonnet"
  }'
```

Open `http://localhost:3000` to create a task via the UI, or `http://localhost:3000/live` to watch builds in real-time.

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

Each command sends an HTTP callback to the orchestrator, which forwards it to the frontend via WebSocket.

### Concurrency Model

- N workers run **in parallel**, each in a fully isolated Modal sandbox
- Each worker gets its own **GitHub branch** and **Vercel deployment**
- Workers report progress **independently** via HTTP callbacks
- The frontend aggregates all events into a **unified real-time dashboard**
- No worker depends on another — they race to complete the same task with different approaches

### Evaluation Pipeline

1. All workers complete → `ALL_DONE` event fires
2. API's eval bridge connects to the eval server via WebSocket
3. Eval server creates a judging plan with AI-generated judge personas
4. Each judge evaluates each project (text analysis + live browser testing via BrowserBase)
5. Scores are normalized, composites computed, outliers detected
6. Rankings + summary streamed back → API → frontend sidebar

--- 

## License

Built for [TreeHacks 2026](https://www.treehacks.com/).
