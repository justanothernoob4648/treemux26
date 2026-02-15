#!/usr/bin/env python3
"""Runner script that executes inside the Modal Sandbox.

Sets up the environment, configures git, builds the system prompt
with treemux-report documentation, and invokes the Claude Code CLI.
"""
import json
import os
import subprocess
import sys
import tempfile


def build_system_prompt(worker_profile):
    """Build system prompt with treemux-report tool docs and best practices."""
    profile_section = ""
    if worker_profile:
        profile_section = "\n\n## Your Profile\n\n%s\n" % worker_profile

    return """## treemux-report Tool

You have access to a `treemux-report` CLI tool for reporting your progress. You MUST use it at key milestones.

### Usage

1. **After planning** — report your idea and plan:
```bash
treemux-report start --idea "Your idea description" --steps "Step 1 label" "Step 2 label" "Step 3 label" "Step 4 label"
```

2. **After completing each step** — report progress (this commits and pushes code):
```bash
treemux-report step --index 1 --summary "Scaffold project"
```

3. **After writing PITCH.md and finishing everything** — report completion:
```bash
treemux-report done
```

### Important Rules
- Call `treemux-report start` EARLY, right after you decide what to build and have a plan.
- Call `treemux-report step` — commit early and often. Each call commits & pushes your code.
  - Your FIRST `treemux-report step` should be right after scaffolding/boilerplate is set up.
- Write a compelling pitch to `/workspace/PITCH.md` BEFORE calling `treemux-report done`.
- The pitch should be 3-5 sentences: what problem it solves, what makes it unique, why it's impressive.
- Always call `treemux-report done` when you're finished.

## Development Best Practices

### Web Projects
- Use `bun` as the package manager and runtime
- Default to **Next.js + shadcn/ui** stack (or Vite + React if more appropriate)
- **CRITICAL: All setup commands MUST be fully non-interactive (no TTY available).** Use these exact commands:
  1. Create Next.js app: `bunx create-next-app@latest . --yes --typescript --tailwind --eslint --app --src-dir --no-react-compiler --import-alias "@/*" --turbopack --use-bun`
  2. Init shadcn/ui: `bunx shadcn@latest init -d -y --force`
  3. Add components: `bunx shadcn@latest add button card input -y --overwrite`
- Install packages with `bun add <package>`
- NEVER run interactive commands. Always pass `--yes`, `-y`, `-d`, etc. to skip all prompts.

### Git
- Git is already initialized in /workspace with the remote configured.
- Do NOT run `git init` or `git remote add` — it's already done.
- `treemux-report step` handles git commit & push for you.
- If you need to commit manually for any reason: `git add -A && git commit -m "message"`

## Skills
- You have access to skills for shadcn-ui, frontend-design, vercel-react-best-practices, ai-sdk, streamdown, and find-skills.
- Refer to them when building web applications.
- When it comes to AI + webdev related things, refer to the provided vercel ai skills like ai-sdk and streamdown. There are usually good existing primitives.

## Deliverables

1. **Working code** in /workspace that builds and runs successfully
2. **PITCH.md** — A compelling elevator pitch (3-5 sentences)
3. All code committed via `treemux-report step` calls

## Verification (CRITICAL - do this before calling treemux-report done)

- **Clean install test**: Run `rm -rf node_modules && bun install && bun run build` to verify ALL dependencies are declared in package.json. If this fails, add the missing packages with `bun add <package>` and re-test. shadcn/ui often requires: `clsx`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css`, `radix-ui`.
- Verify `bun dev` starts the dev server without errors
- If possible, interact with the server APIs and do tests to verify actual functionality. Ensure correctness of communication between frontend and backend.
- Test that the core functionality works end-to-end
- Write PITCH.md with a compelling pitch
- Then call `treemux-report done`

## Working Directory

All code MUST be written in /workspace.%s""" % profile_section


def main():
    if len(sys.argv) < 2:
        print("Usage: python runner.py '<context_json>'", file=sys.stderr)
        sys.exit(1)

    ctx = json.loads(sys.argv[1])
    challenge_doc = ctx["challenge_doc"]
    challenge_doc += "\nStart thinking about what to build then build it. You have full autonomy to execute."
    worker_profile = ctx.get("worker_profile", "")
    model = ctx.get("model")

    os.makedirs("/workspace", exist_ok=True)

    # ── Git setup ──
    repo_url = os.environ.get("REPO_URL", "")
    github_token = os.environ.get("GITHUB_TOKEN", "")
    branch = os.environ.get("BRANCH", "main")
    git_user_name = os.environ.get("GIT_USER_NAME", "Treemux")
    git_user_email = os.environ.get("GIT_USER_EMAIL", "treemux@treemux.dev")

    # Write .gitignore
    gitignore_path = os.path.join("/workspace", ".gitignore")
    if not os.path.exists(gitignore_path):
        with open(gitignore_path, "w") as f:
            f.write(
                "node_modules/\n"
                ".next/\n"
                "out/\n"
                "dist/\n"
                "build/\n"
                ".turbo/\n"
                ".vercel/\n"
                "*.tsbuildinfo\n"
                ".env\n"
                ".env.*\n"
                "!.env.example\n"
            )

    if repo_url and github_token:
        push_url = repo_url.replace(
            "https://", "https://x-access-token:%s@" % github_token
        )
        try:
            subprocess.run(
                ["git", "init"], cwd="/workspace", check=True, capture_output=True
            )
            subprocess.run(
                ["git", "config", "user.email", git_user_email],
                cwd="/workspace", check=True, capture_output=True,
            )
            subprocess.run(
                ["git", "config", "user.name", git_user_name],
                cwd="/workspace", check=True, capture_output=True,
            )
            subprocess.run(
                ["git", "branch", "-M", branch],
                cwd="/workspace", check=True, capture_output=True,
            )
            subprocess.run(
                ["git", "remote", "add", "origin", push_url],
                cwd="/workspace", check=True, capture_output=True,
            )
            print("Git initialized: branch=%s" % branch, file=sys.stderr)
        except subprocess.CalledProcessError as e:
            stderr = (e.stderr or b"").decode(errors="replace").strip()
            print("Git init failed: %s stderr=%s" % (e, stderr), file=sys.stderr)

    # ── Claude config ──
    claude_config_dir = os.path.expanduser("~/.claude")
    os.makedirs(claude_config_dir, exist_ok=True)
    config_path = os.path.join(claude_config_dir, "config.json")
    if not os.path.exists(config_path):
        with open(config_path, "w") as f:
            json.dump({"acceptedTos": True}, f)

    claude_json_path = os.path.expanduser("~/.claude.json")
    claude_json = {}
    if os.path.exists(claude_json_path):
        with open(claude_json_path) as f:
            claude_json = json.load(f)
    claude_json["hasCompletedOnboarding"] = True
    with open(claude_json_path, "w") as f:
        json.dump(claude_json, f)

    # ── System prompt ──
    system_prompt = build_system_prompt(worker_profile)

    prompt_fd, prompt_path = tempfile.mkstemp(suffix=".txt")
    with os.fdopen(prompt_fd, "w") as f:
        f.write(system_prompt)

    prompt_fd2, prompt_doc_path = tempfile.mkstemp(suffix=".txt")
    with os.fdopen(prompt_fd2, "w") as f:
        f.write(challenge_doc)

    print("Starting Claude CLI (prompt: %d chars)" % len(challenge_doc), file=sys.stderr)

    try:
        model_flag = f"--model {model} " if model else ""
        cmd = [
            "bash", "-c",
            "cat %s | claude -p "
            "--output-format stream-json "
            "--verbose "
            "--append-system-prompt-file %s "
            "--dangerously-skip-permissions "
            "%s" % (prompt_doc_path, prompt_path, model_flag),
        ]

        env = os.environ.copy()
        env["NO_COLOR"] = "1"

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd="/workspace",
            env=env,
            text=True,
            bufsize=1,
        )

        # Drain stderr in background
        import threading

        def _drain_stderr(proc):
            for line in proc.stderr:
                print("[claude-stderr] %s" % line, end="", file=sys.stderr)

        stderr_thread = threading.Thread(
            target=_drain_stderr, args=(process,), daemon=True
        )
        stderr_thread.start()

        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()

        process.wait()

        if process.returncode != 0:
            print(
                "Claude CLI exited with code %s" % process.returncode,
                file=sys.stderr,
            )

    finally:
        os.unlink(prompt_path)
        os.unlink(prompt_doc_path)

    print("Runner finished", file=sys.stderr)


if __name__ == "__main__":
    main()
