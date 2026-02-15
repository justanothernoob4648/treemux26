"""
Treemux implementation worker — CLI-based agent integration.
Trigger endpoint + Sandbox that runs Claude Code CLI via runner.py.
Skills and treemux-report tool are uploaded to the sandbox.
"""

import json
import os
from pathlib import Path

import modal
from fastapi import Request, Response

app = modal.App("treemux-implementation")

_WORKER_DIR = Path(__file__).resolve().parent

# ── Sandbox image: Ubuntu 22.04, Node.js 22, bun, uv, Claude Code CLI ──
_sandbox_image = (
    modal.Image.from_registry("ubuntu:22.04")
    .env({"DEBIAN_FRONTEND": "noninteractive"})
    .apt_install(
        "wget", "ca-certificates", "curl", "net-tools", "iproute2",
        "git", "build-essential", "unzip",
        "python3", "python3-pip", "python3-venv", "python-is-python3",
    )
    # Node.js 22
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y nodejs",
    )
    # uv + bun
    .run_commands(
        "curl -LsSf https://astral.sh/uv/install.sh | sh",
        "cp /root/.local/bin/uv /usr/local/bin/",
        "cp /root/.local/bin/uvx /usr/local/bin/",
        "curl -fsSL https://bun.sh/install | bash",
        "cp /root/.bun/bin/bun /usr/local/bin/",
        "ln -sf /usr/local/bin/bun /usr/local/bin/bunx",
    )
    # Non-root agent user
    .run_commands(
        "useradd -m -s /bin/bash agent",
        "mkdir -p /workspace && chown agent:agent /workspace",
    )
    # Claude Code CLI (installed as agent so config is created for agent)
    .run_commands(
        "runuser -u agent -- bash -c 'curl -fsSL https://claude.ai/install.sh | bash'",
        "ln -sf /home/agent/.local/bin/claude /usr/local/bin/claude",
    )
    .env({"PATH": "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"})
)

# ── Function image: lightweight Python + files to upload to sandbox ──
_fn_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi[standard]"
)

# Bake worker files into the function image so they can be uploaded to sandboxes
_fn_image = _fn_image.add_local_file(
    str(_WORKER_DIR / "runner.py"),
    "/opt/treemux/runner.py",
    copy=True,
)
_fn_image = _fn_image.add_local_file(
    str(_WORKER_DIR / "scripts" / "treemux_report.py"),
    "/opt/treemux/scripts/treemux_report.py",
    copy=True,
)

# Add skills directory if it exists
_skills_dir = _WORKER_DIR / "skills"
if _skills_dir.exists():
    _fn_image = _fn_image.add_local_dir(
        str(_skills_dir),
        "/opt/treemux/skills",
        copy=True,
    )


def _log(msg: str) -> None:
    print("[worker] %s" % msg, flush=True)


def _try_parse_json(line: str):
    """Try to parse JSON from a line, handling verbose prefixes."""
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        pass
    idx = line.find("{")
    if idx > 0:
        try:
            return json.loads(line[idx:])
        except json.JSONDecodeError:
            pass
    return None


def _summarize_tool_input(tool_name, tool_input):
    """Create compact summary of tool input for logging."""
    if tool_name == "Bash":
        cmd = tool_input.get("command", "")
        return cmd[:100] + "..." if len(cmd) > 100 else cmd
    elif tool_name == "Read":
        return tool_input.get("file_path", "")
    elif tool_name == "Write":
        path = tool_input.get("file_path", "")
        content = tool_input.get("content", "")
        return "%s (%d chars)" % (path, len(content))
    elif tool_name == "Edit":
        return tool_input.get("file_path", "")
    elif tool_name == "Glob":
        return tool_input.get("pattern", "")
    elif tool_name == "Grep":
        pattern = tool_input.get("pattern", "")
        path = tool_input.get("path", "")
        return "'%s' in %s" % (pattern, path) if path else "'%s'" % pattern
    else:
        s = json.dumps(tool_input)
        return s[:100] + "..." if len(s) > 100 else s


def stream_agent_output(process):
    """Stream and log agent messages from sandbox process stdout."""
    for line in process.stdout:
        line = line.strip()
        if not line:
            continue

        msg = _try_parse_json(line)
        if msg is None:
            _log("[sandbox] %s" % line)
            continue

        msg_type = msg.get("type", "unknown")

        if msg_type == "assistant":
            message = msg.get("message", {})
            if isinstance(message, dict):
                for block in message.get("content", []):
                    if not isinstance(block, dict):
                        continue
                    btype = block.get("type", "")
                    if btype == "text":
                        _log("[assistant] %s" % block.get("text", "")[:200])
                    elif btype == "tool_use":
                        name = block.get("name", "?")
                        tool_input = block.get("input", {})
                        summary = _summarize_tool_input(name, tool_input)
                        _log("[tool_call] %s(%s)" % (name, summary))
                    elif btype == "thinking":
                        thinking = block.get("thinking", "")
                        _log("[thinking] %s..." % thinking[:100])

        elif msg_type == "user":
            message = msg.get("message", {})
            if isinstance(message, dict):
                for block in message.get("content", []):
                    if not isinstance(block, dict):
                        continue
                    btype = block.get("type", "")
                    if btype == "tool_result":
                        content = block.get("content", "")
                        is_error = block.get("is_error", False)
                        if isinstance(content, str):
                            preview = content[:200].replace("\n", "\\n")
                        else:
                            preview = str(content)[:200]
                        prefix = "tool_error" if is_error else "tool_result"
                        _log("[%s] %s" % (prefix, preview))

        elif msg_type == "result":
            cost = msg.get("cost_usd", msg.get("total_cost_usd", "?"))
            turns = msg.get("num_turns", "?")
            is_error = msg.get("is_error", False)
            status = "ERROR" if is_error else "SUCCESS"
            _log("[result] %s | Cost: $%s | Turns: %s" % (status, cost, turns))

        elif msg_type == "system":
            subtype = msg.get("subtype", "")
            _log("[system:%s]" % subtype)

        elif msg_type == "error":
            _log("[error] %s" % msg.get("message", msg.get("error", "")))

        else:
            _log("[%s] %s" % (msg_type, json.dumps(msg)[:200]))


def upload_file_to_sandbox(sb, local_path, remote_path):
    """Upload a single file to the sandbox."""
    content = Path(local_path).read_text()
    with sb.open(remote_path, "w") as f:
        f.write(content)


def upload_skills_to_sandbox(sb):
    """Upload skills directory to sandbox."""
    skills_dir = Path("/opt/treemux/skills")
    if not skills_dir.exists():
        _log("No skills/ directory found, skipping")
        return

    sb.exec(
        "runuser", "-u", "agent", "--",
        "mkdir", "-p", "/home/agent/.claude/skills",
    ).wait()

    count = 0
    for file_path in skills_dir.rglob("*"):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(skills_dir)
        remote = "/home/agent/.claude/skills/%s" % rel
        remote_dir = str(Path(remote).parent)
        sb.exec(
            "runuser", "-u", "agent", "--",
            "mkdir", "-p", remote_dir,
        ).wait()
        content = file_path.read_text()
        with sb.open(remote, "w") as f:
            f.write(content)
        count += 1

    sb.exec("bash", "-c", "chown -R agent:agent /home/agent/.claude").wait()
    _log("Uploaded %d skill files" % count)


def _post_callback(callback_base_url, path, body):
    """Post a callback to the orchestrator (fallback when agent doesn't report)."""
    import urllib.request

    if not callback_base_url:
        return
    url = callback_base_url.rstrip("/") + path
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        _log("callback %s error: %s" % (path, e))


# ── Sandbox runner ──────────────────────────────────────────────
@app.function(
    image=_fn_image,
    timeout=1900,
)
def run_in_sandbox(
    job_id: str,
    idea: str,
    worker_profile: str,
    callback_base_url: str,
    branch: str,
    repo_url: str | None,
    github_token: str | None,
    vercel_token: str | None,
    git_user_name: str | None,
    git_user_email: str | None,
    claude_oauth_token: str | None,
    model: str | None,
) -> None:
    """Create a Sandbox and run the agent."""
    job_secret = modal.Secret.from_dict({
        "JOB_ID": job_id,
        "IDEA": idea,
        "CALLBACK_BASE_URL": callback_base_url or "",
        "BRANCH": branch,
        "REPO_URL": repo_url or "",
        "GITHUB_TOKEN": github_token or "",
        "VERCEL_TOKEN": vercel_token or "",
        "GIT_USER_NAME": git_user_name or "",
        "GIT_USER_EMAIL": git_user_email or "",
        "CLAUDE_CODE_OAUTH_TOKEN": claude_oauth_token or "",
    })

    _log("creating Sandbox job_id=%s branch=%s" % (job_id, branch))

    sb = modal.Sandbox.create(
        app=app,
        image=_sandbox_image,
        secrets=[job_secret],
        workdir="/workspace",
        timeout=1800,
    )

    done_called = False
    try:
        # Upload runner.py
        upload_file_to_sandbox(sb, "/opt/treemux/runner.py", "/runner.py")
        _log("uploaded runner.py")

        # Upload treemux-report tool
        upload_file_to_sandbox(
            sb, "/opt/treemux/scripts/treemux_report.py",
            "/usr/local/bin/treemux-report",
        )
        sb.exec("chmod", "+x", "/usr/local/bin/treemux-report").wait()
        _log("uploaded treemux-report")

        # Upload skills
        upload_skills_to_sandbox(sb)

        # Build context JSON
        ctx = {
            "challenge_doc": idea,
            "worker_profile": worker_profile,
            "model": model,
        }
        ctx_json = json.dumps(ctx)

        _log("starting agent...")

        p = sb.exec(
            "runuser", "-u", "agent", "--",
            "python3", "-u", "/runner.py", ctx_json,
            timeout=1700,
        )

        # Stream stderr in background
        import threading

        def _drain_stderr(proc):
            for line in proc.stderr:
                _log("[stderr] %s" % line.strip())

        stderr_thread = threading.Thread(
            target=_drain_stderr, args=(p,), daemon=True
        )
        stderr_thread.start()

        stream_agent_output(p)
        exit_code = p.wait()
        stderr_thread.join(timeout=5)

        _log("agent exited with code %s" % exit_code)

        # Check if treemux-report done was called
        check = sb.exec(
            "bash", "-c",
            "cat /tmp/.treemux-state.json 2>/dev/null || echo '{}'",
        )
        state_output = ""
        for line in check.stdout:
            state_output += line
        check.wait()
        try:
            state = json.loads(state_output)
            done_called = state.get("done", False)
        except json.JSONDecodeError:
            done_called = False

    finally:
        # Fallback: if agent never called treemux-report done, send failure
        if not done_called:
            _log("agent did not call treemux-report done — sending failure callback")
            _post_callback(callback_base_url, "/v1.0/log/done", {
                "jobId": job_id,
                "repoUrl": repo_url or "",
                "idea": idea,
                "pitch": "Implementation did not complete successfully.",
                "success": False,
                "error": "Agent exited without calling treemux-report done",
                "branch": branch,
            })

        sb.terminate()
        _log("Sandbox terminated")


# ── HTTP trigger ────────────────────────────────────────────────
@app.function(image=_fn_image)
@modal.fastapi_endpoint(method="POST")
async def trigger(request: Request):
    raw = await request.body()
    _log("trigger received body length=%s" % len(raw))
    try:
        body = json.loads(raw)
    except json.JSONDecodeError as e:
        _log("trigger invalid JSON: %s" % e)
        return Response(
            content=json.dumps({"ok": False, "error": "Invalid JSON"}),
            status_code=400,
            media_type="application/json",
        )
    run_in_sandbox.spawn(
        job_id=body.get("job_id") or "",
        idea=body.get("idea") or "",
        worker_profile=body.get("worker_profile") or "",
        callback_base_url=body.get("callback_base_url") or "",
        branch=body.get("branch") or "main",
        repo_url=body.get("repo_url"),
        github_token=body.get("github_token"),
        vercel_token=body.get("vercel_token"),
        git_user_name=body.get("git_user_name"),
        git_user_email=body.get("git_user_email"),
        claude_oauth_token=body.get("claude_oauth_token"),
        model=body.get("model"),
    )
    return {"ok": True, "message": "implementation spawned"}
