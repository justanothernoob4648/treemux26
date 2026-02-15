#!/usr/bin/env python3
"""
treemux-report: CLI tool for Claude agent to report progress.
Installed at /usr/local/bin/treemux-report in the sandbox.

Usage:
  treemux-report start --idea "Real-time collab editor" --steps "Scaffold" "Build backend" "Create UI"
  treemux-report step --index 1 --summary "Scaffold project"
  treemux-report done

Environment variables:
  JOB_ID, CALLBACK_BASE_URL, BRANCH, REPO_URL, GITHUB_TOKEN,
  VERCEL_TOKEN, GIT_USER_NAME, GIT_USER_EMAIL
"""
import argparse
import json
import os
import re
import subprocess
import urllib.request

STATE_FILE = "/tmp/.treemux-state.json"
WORK_DIR = "/workspace"


def _env(key, default=""):
    return (os.environ.get(key) or default).strip()


def _log(msg):
    print("[treemux-report] %s" % msg, flush=True)


def _post(path, body):
    base = _env("CALLBACK_BASE_URL")
    if not base:
        _log("no CALLBACK_BASE_URL, skipping POST %s" % path)
        return
    url = base.rstrip("/") + path
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=15)
        _log("POST %s ok" % path)
    except Exception as e:
        _log("POST %s error: %s" % (path, e))


def _load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {}


def _save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)


def _git_commit_and_push(message):
    """Stage all, commit, push --force."""
    branch = _env("BRANCH", "main")
    repo_url = _env("REPO_URL")
    github_token = _env("GITHUB_TOKEN")

    if not repo_url or not github_token:
        _log("no REPO_URL or GITHUB_TOKEN, skipping git push")
        return

    push_url = repo_url.replace(
        "https://", "https://x-access-token:%s@" % github_token
    )

    try:
        subprocess.run(
            ["git", "remote", "set-url", "origin", push_url],
            cwd=WORK_DIR, capture_output=True,
        )
        subprocess.run(
            ["git", "add", "-A"],
            cwd=WORK_DIR, check=True, capture_output=True,
        )
        subprocess.run(
            ["git", "commit", "-m", message[:72], "--allow-empty"],
            cwd=WORK_DIR, check=True, capture_output=True,
        )
        subprocess.run(
            ["git", "push", "--force", "-u", "origin", branch],
            cwd=WORK_DIR, check=True, capture_output=True, timeout=120,
        )
        _log("pushed: %s" % message[:72])
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or b"").decode(errors="replace").strip()
        _log("git error: %s stderr=%s" % (e, stderr))
        _post("/v1.0/log/error", {
            "jobId": _env("JOB_ID"),
            "error": "git push failed: %s" % e,
            "stderr": stderr,
            "phase": "git_push",
        })


def _trigger_vercel_deploy():
    """Trigger a Vercel deployment for the current branch."""
    vercel_token = _env("VERCEL_TOKEN")
    repo_url = _env("REPO_URL")
    branch = _env("BRANCH", "main")

    if not vercel_token or not repo_url:
        return

    m = re.match(r"https://github\.com/([^/]+)/([^/]+?)(?:\.git)?$", repo_url)
    if not m:
        _log("cannot parse repo_url for Vercel: %s" % repo_url)
        return

    org, repo_name = m.group(1), m.group(2)
    payload = json.dumps({
        "name": repo_name,
        "target": "production",
        "gitSource": {
            "type": "github",
            "org": org,
            "repo": repo_name,
            "ref": branch,
        },
    }).encode()

    try:
        req = urllib.request.Request(
            "https://api.vercel.com/v13/deployments",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + vercel_token,
            },
            method="POST",
        )
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read())
        url = data.get("url", "")
        if url and not url.startswith("http"):
            url = "https://" + url
        _log("Vercel deployment triggered: %s" % url)
        _post("/v1.0/log/deployment", {"jobId": _env("JOB_ID"), "url": url})
    except Exception as e:
        _log("Vercel deploy trigger failed: %s" % e)


def cmd_start(args):
    """Agent reports: here's my idea and plan."""
    job_id = _env("JOB_ID")
    branch = _env("BRANCH", "main")
    idea = args.idea
    steps = args.steps or []

    state = {
        "idea": idea,
        "totalSteps": len(steps),
        "planSteps": steps,
    }
    _save_state(state)

    _post("/v1.0/log/start", {
        "jobId": job_id,
        "idea": idea,
        "temperature": 50,
        "risk": 50,
        "branch": branch,
        "totalSteps": len(steps),
        "planSteps": steps,
    })
    _log("started: %s (%d steps)" % (idea, len(steps)))


def cmd_step(args):
    """Agent reports: finished a step."""
    job_id = _env("JOB_ID")
    branch = _env("BRANCH", "main")
    state = _load_state()
    total_steps = state.get("totalSteps", 0)
    step_index = args.index
    summary = args.summary

    # Git commit + push
    _git_commit_and_push("Step %s: %s" % (step_index, summary))

    # Callback
    _post("/v1.0/log/step", {
        "jobId": job_id,
        "stepIndex": step_index,
        "totalSteps": total_steps,
        "done": False,
        "summary": summary,
    })

    # Push notification
    _post("/v1.0/log/push", {
        "jobId": job_id,
        "stepIndex": step_index,
        "branch": branch,
        "summary": summary,
    })

    # Trigger Vercel deploy
    _trigger_vercel_deploy()

    _log("step %s/%s: %s" % (step_index, total_steps, summary))


def cmd_done(args):
    """Agent reports: all done."""
    job_id = _env("JOB_ID")
    branch = _env("BRANCH", "main")
    repo_url = _env("REPO_URL")
    state = _load_state()
    idea = state.get("idea", "")

    # Read pitch from PITCH.md
    pitch_path = os.path.join(WORK_DIR, "PITCH.md")
    pitch = ""
    if os.path.exists(pitch_path):
        with open(pitch_path) as f:
            pitch = f.read().strip()
        _log("read PITCH.md (%d chars)" % len(pitch))
    else:
        pitch = "Built a production-ready app: %s" % idea
        _log("no PITCH.md found, using fallback pitch")

    # Final git commit + push
    _git_commit_and_push("Final: complete build")

    # Done callback
    _post("/v1.0/log/done", {
        "jobId": job_id,
        "repoUrl": repo_url or "",
        "idea": idea,
        "pitch": pitch,
        "success": True,
        "error": None,
        "branch": branch,
    })

    # Mark state as done
    state["done"] = True
    _save_state(state)

    _log("done!")


def main():
    parser = argparse.ArgumentParser(
        prog="treemux-report",
        description="Agent progress reporting tool",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # start
    p_start = sub.add_parser("start", help="Report idea and plan")
    p_start.add_argument("--idea", required=True, help="The idea being built")
    p_start.add_argument("--steps", nargs="+", required=True, help="Plan step labels")

    # step
    p_step = sub.add_parser("step", help="Report step completion")
    p_step.add_argument("--index", type=int, required=True, help="Step index (1-based)")
    p_step.add_argument("--summary", required=True, help="Step summary")

    # done
    sub.add_parser("done", help="Report completion")

    args = parser.parse_args()

    if args.command == "start":
        cmd_start(args)
    elif args.command == "step":
        cmd_step(args)
    elif args.command == "done":
        cmd_done(args)


if __name__ == "__main__":
    main()
