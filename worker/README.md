# Treemux implementation worker

Runs on [Modal](https://modal.com): FastAPI trigger + Sandbox that executes the inlined runner (Claude Agent + git push). Templates are baked into the function image at deploy time and shuttled to the sandbox via an ephemeral Volume.

## Setup

```bash
# Deploy the worker
modal deploy worker/implementation_worker.py
```

- **`MODAL_IMPLEMENTATION_WORKER_URL`** is the deployed trigger URL (used by the API server to spawn jobs).
- Templates live in `worker/templates/nextjs-base/` and are baked into the function image at deploy time.
