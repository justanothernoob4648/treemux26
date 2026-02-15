# Epoch implementation worker

Runs on [Modal](https://modal.com): FastAPI trigger + Sandbox that executes the inlined runner (Claude Agent + git push). Templates are stored in a Modal Volume (`epoch-templates`) so every Sandbox has them.

## Setup

```bash
# 1. Deploy the worker
modal deploy worker/implementation_worker.py

# 2. Sync templates to the Volume (run once, or after changing templates)
modal run worker/implementation_worker.py::sync_templates
```

- **`MODAL_IMPLEMENTATION_WORKER_URL`** is the deployed trigger URL (used by the API server to spawn jobs).
- Templates live in `worker/templates/nextjs-base/` and are uploaded to the `epoch-templates` Volume by `sync_templates`.
