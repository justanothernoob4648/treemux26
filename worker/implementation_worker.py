"""
Epoch implementation worker – single file.
Trigger endpoint + Sandbox that runs the inlined runner via stdin.
Templates are stored in a Modal Volume so the Sandbox always has them.
"""

import json
import os
import shutil
from pathlib import Path

import modal
from fastapi import Request, Response

app = modal.App("epoch-implementation")

# ── Volume for the Next.js template ──
# Created once via: modal volume create epoch-templates
# Populated by the sync_templates function below.
_template_vol = modal.Volume.from_name("epoch-templates", create_if_missing=True)

# Local template dir (used by sync_templates to upload to the Volume)
_WORKER_DIR = Path(__file__).resolve().parent
_TEMPLATE_DIR = _WORKER_DIR / "templates" / "nextjs-base"

# ── Image (no add_local_dir — templates come from the Volume) ──
_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "curl")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
    )
    .pip_install("claude-agent-sdk", "httpx", "anyio", "fastapi[standard]")
)


# ── Image with templates baked in (only used by sync_templates) ──
_sync_image = _image.add_local_dir(str(_TEMPLATE_DIR), remote_path="/tmp/tpl", copy=True)


# ── Sync templates: local dir → Volume (run once after deploy) ──
@app.function(image=_sync_image, volumes={"/vol/templates": _template_vol})
def sync_templates():
    """Upload templates/nextjs-base into the epoch-templates Volume.
    Run: modal run worker/implementation.py::sync_templates
    """
    print("[sync] uploading templates to Volume...")
    dst = Path("/vol/templates/nextjs-base")
    if dst.exists():
        shutil.rmtree(dst)
    dst.mkdir(parents=True, exist_ok=True)
    src = Path("/tmp/tpl")
    if src.exists():
        shutil.copytree(src, dst, dirs_exist_ok=True)
    _template_vol.commit()
    print("[sync] done. Volume contents:")
    for p in dst.rglob("*"):
        if p.is_file():
            print("  " + str(p.relative_to("/vol/templates")))


def _log(msg: str) -> None:
    print(f"[worker] {msg}", flush=True)


# ── Inlined runner ──────────────────────────────────────────────
# Runs inside the Sandbox. /template is the Volume mount.
_RUN_IMPL_SOURCE = r'''
import os
import re
import subprocess
import json
import urllib.request
from pathlib import Path

def _env(key, default=""):
    return (os.environ.get(key) or default).strip()

def main():
    job_id = _env("JOB_ID")
    idea = _env("IDEA")
    callback_base_url = _env("CALLBACK_BASE_URL")
    repo_url = _env("REPO_URL") or None
    github_token = _env("GITHUB_TOKEN") or None
    branch = _env("BRANCH", "main")
    risk = int(_env("RISK", "50"))
    temperature = int(_env("TEMPERATURE", "50"))
    worker_profile = _env("WORKER_PROFILE")

    work_dir = Path("/out")
    work_dir.mkdir(parents=True, exist_ok=True)

    # Copy template from Volume mount into working directory
    import shutil
    tpl = Path("/template/nextjs-base")
    if tpl.exists():
        for p in tpl.rglob("*"):
            if p.is_file():
                rel = p.relative_to(tpl)
                dst = work_dir / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, dst)
        print("[worker] template copied to /out", flush=True)
    else:
        print("[worker] WARNING: /template/nextjs-base not found in Volume", flush=True)

    os.chdir(work_dir)

    base = callback_base_url.rstrip("/") if callback_base_url else ""
    if not base or not (base.startswith("http://") or base.startswith("https://")):
        base = ""

    push_url = None
    if repo_url and github_token:
        push_url = repo_url.replace("https://", "https://x-access-token:%s@" % github_token)
        try:
            subprocess.run(["git", "init"], cwd=work_dir, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "epoch@epoch.local"], cwd=work_dir, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Epoch"], cwd=work_dir, check=True, capture_output=True)
            subprocess.run(["git", "branch", "-M", branch], cwd=work_dir, check=True, capture_output=True)
            subprocess.run(["git", "remote", "add", "origin", push_url], cwd=work_dir, check=True, capture_output=True)
            subprocess.run(["git", "pull", "origin", branch], cwd=work_dir, check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            push_url = None
            stderr = (e.stderr or b"").decode(errors="replace").strip()
            print("[worker] git init failed: %s stderr=%s" % (e, stderr), flush=True)
            if base:
                try:
                    _err = urllib.request.Request(base + "/v1.0/log/error", data=json.dumps({"jobId": job_id, "error": "git init failed: %s" % e, "stderr": stderr, "phase": "git_init"}).encode(), headers={"Content-Type": "application/json"}, method="POST")
                    urllib.request.urlopen(_err, timeout=10)
                except Exception:
                    pass

    def _log(msg):
        print("[worker]", msg, flush=True)

    def _post(path, body):
        if not base:
            return
        try:
            req = urllib.request.Request(base + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
            urllib.request.urlopen(req, timeout=10)
        except Exception as e:
            _log("callback %s error: %s" % (path, e))

    def commit_and_push(step_index, summary):
        if not push_url:
            return
        try:
            subprocess.run(["git", "add", "-A"], cwd=work_dir, check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "Step %s: %s" % (step_index, summary[:72]), "--allow-empty"], cwd=work_dir, check=True, capture_output=True)
            subprocess.run(["git", "push", "--force", "-u", "origin", branch], cwd=work_dir, check=True, capture_output=True, timeout=120)
            _log("pushed step %s" % step_index)
            _post("/v1.0/log/push", {"jobId": job_id, "stepIndex": step_index, "branch": branch, "summary": summary})
        except subprocess.CalledProcessError as e:
            stderr = (e.stderr or b"").decode(errors="replace").strip()
            _log("git push step %s failed: %s stderr=%s" % (step_index, e, stderr))
            _post("/v1.0/log/error", {"jobId": job_id, "error": "git push failed at step %s: %s" % (step_index, e), "stderr": stderr, "phase": "git_push"})

    _log("started job_id=%s branch=%s" % (job_id, branch))

    # ── Claude agent ──
    import anyio
    from claude_agent_sdk import ClaudeAgentOptions, query, AssistantMessage, TextBlock, ResultMessage

    system_prompt = """You are an expert full-stack developer building a Next.js app.

CONTEXT:
- The current directory already contains a Next.js 14 app (App Router, TypeScript, Tailwind CSS 4).
- Do NOT run npx create-next-app, npm create, or any scaffolding command.
- Just implement the idea by editing and adding files.

PLAN FORMAT (mandatory first message):
Output a numbered plan. Each line MUST be:
  <number>. <PipelineLabel> — <one sentence description>
Example:
  1. Installing dependencies — Add required npm packages for the feature
  2. Creating data model — Define TypeScript types and API route
  3. Building UI components — Create the main page and interactive elements
  4. Adding styling — Apply Tailwind classes and responsive layout
  5. Testing build — Run npm build to verify everything compiles

STEP OUTPUT FORMAT (each subsequent message):
Start each step with EXACTLY one line matching:
  [STEP <number>/<total>] <PipelineLabel>
Then do the work silently. Do NOT narrate what you are doing, do NOT say "Let me...", "Now I'll...", "Perfect!", "Great!", etc. Just output the step header line, then use tools.

Idea: %s
Worker profile: %s
Risk level (0-100): %s
Temperature (creativity, 0-100): %s""" % (idea, worker_profile, risk, temperature)

    prompt = "Implement this idea: %s\n\nOutput your numbered plan first, then execute each step." % idea

    plan_steps = []
    total_steps = [0]
    step_index = [0]
    started_sent = [False]

    def send_step(summary, done):
        idx = step_index[0]
        _post("/v1.0/log/step", {"jobId": job_id, "stepIndex": idx, "totalSteps": total_steps[0], "done": done, "summary": summary})
        commit_and_push(idx, summary)

    async def run_agent():
        async for message in query(prompt=prompt, options=ClaudeAgentOptions(system_prompt=system_prompt, allowed_tools=["Read", "Write", "Edit", "Bash", "Glob"], permission_mode="acceptEdits")):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock) and block.text.strip():
                        text = block.text.strip()

                        # First message: parse the numbered plan
                        if not started_sent[0]:
                            started_sent[0] = True
                            lines = [l.strip() for l in text.split("\n") if l.strip()]
                            for l in lines:
                                m = re.match(r"^(\d+)\.\s*(.+?)(?:\s*[-\u2014]\s*.+)?$", l)
                                if m:
                                    plan_steps.append(m.group(2).strip())
                            if not plan_steps:
                                plan_steps.extend(lines[:6])
                            total_steps[0] = len(plan_steps) or 6
                            _post("/v1.0/log/start", {"jobId": job_id, "idea": idea, "temperature": temperature, "risk": risk, "branch": branch, "totalSteps": total_steps[0], "planSteps": plan_steps})
                            continue

                        # Subsequent messages: extract [STEP n/t] label or use plan step
                        step_m = re.match(r"^\[STEP\s+(\d+)/(\d+)\]\s*(.+)", text, re.IGNORECASE)
                        if step_m:
                            summary = step_m.group(3).strip()
                        elif step_index[0] < len(plan_steps):
                            summary = plan_steps[step_index[0]]
                        else:
                            summary = "Implementing step %s" % (step_index[0] + 1)

                        send_step(summary, False)
                        step_index[0] += 1

            elif isinstance(message, ResultMessage):
                send_step("Build complete", True)

    anyio.run(run_agent)
    _log("agent run finished")

    pitch = "Built with Epoch: %s..." % idea[:120]
    _post("/v1.0/log/done", {"jobId": job_id, "repoUrl": repo_url or "", "pitch": pitch, "success": bool(repo_url or not github_token), "error": None, "branch": branch})
    _log("finished")
main()
'''


# ── Sandbox runner ──────────────────────────────────────────────
@app.function(
    image=_image,
    timeout=1900,
    secrets=[modal.Secret.from_name("anthropic")],
    volumes={"/vol/templates": _template_vol},
)
def run_in_sandbox(
    job_id: str,
    idea: str,
    risk: int,
    temperature: int,
    worker_profile: str,
    callback_base_url: str,
    branch: str,
    repo_url: str | None,
    github_token: str | None,
) -> None:
    """Create a Sandbox with the template Volume mounted, run the inlined runner."""
    job_secret = modal.Secret.from_dict({
        "JOB_ID": job_id,
        "IDEA": idea,
        "RISK": str(risk),
        "TEMPERATURE": str(temperature),
        "WORKER_PROFILE": worker_profile or "",
        "CALLBACK_BASE_URL": callback_base_url or "",
        "BRANCH": branch,
        "REPO_URL": repo_url or "",
        "GITHUB_TOKEN": github_token or "",
    })
    _log("creating Sandbox for job_id=%s branch=%s" % (job_id, branch))
    sb = modal.Sandbox.create(
        app=app,
        image=_image,
        secrets=[modal.Secret.from_name("anthropic"), job_secret],
        volumes={"/template": _template_vol},
        timeout=1800,
    )
    try:
        _log("executing inlined runner in Sandbox")
        p = sb.exec("python", "-c", "exec(compile(open(0).read(), '<stdin>', 'exec'))", timeout=1700)
        p.stdin.write(_RUN_IMPL_SOURCE.encode())
        p.stdin.write_eof()
        p.stdin.drain()
        for line in p.stdout:
            print(line, end="", flush=True)
        exit_code = p.wait()
        _log("runner exited with code %s" % exit_code)
    finally:
        sb.terminate()
        _log("Sandbox terminated")


# ── HTTP trigger ────────────────────────────────────────────────
@app.function(image=_image)
@modal.fastapi_endpoint(method="POST")
async def trigger(request: Request):
    raw = await request.body()
    _log("trigger received body length=%s" % len(raw))
    try:
        body = json.loads(raw)
    except json.JSONDecodeError as e:
        _log("trigger invalid JSON: %s" % e)
        return Response(content=json.dumps({"ok": False, "error": "Invalid JSON"}), status_code=400, media_type="application/json")
    run_in_sandbox.spawn(
        job_id=body.get("job_id") or "",
        idea=body.get("idea") or "",
        risk=int(body.get("risk", 50)),
        temperature=int(body.get("temperature", 50)),
        worker_profile=body.get("worker_profile") or "",
        callback_base_url=body.get("callback_base_url") or "",
        branch=body.get("branch") or "main",
        repo_url=body.get("repo_url"),
        github_token=body.get("github_token"),
    )
    return {"ok": True, "message": "implementation spawned"}
