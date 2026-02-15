#!/usr/bin/env npx tsx
/**
 * Deploy eval-agent to Modal.
 *
 * This script:
 * 1. Builds TypeScript
 * 2. Creates the eval-agent-code Volume on Modal
 * 3. Uploads dist/, node_modules/, and package.json to the Volume
 * 4. Verifies the deployment by listing Volume contents
 *
 * Usage: npx tsx scripts/deploy.ts
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

async function main() {
  console.log("=== Deploying eval-agent to Modal ===\n");

  // Step 1: Build TypeScript
  console.log("[1/4] Building TypeScript...");
  execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
  console.log("  Build complete.\n");

  // Step 2: Connect to Modal and create/get Volume
  console.log("[2/4] Connecting to Modal...");
  const { ModalClient } = await import("modal");
  const modal = new ModalClient();

  const codeVolume = await modal.volumes.fromName("eval-agent-code", {
    createIfMissing: true,
  });
  console.log("  Volume 'eval-agent-code' ready.\n");

  // Step 3: Upload files to Volume using a temporary sandbox
  console.log("[3/4] Uploading code to Modal Volume...");

  const app = await modal.apps.fromName("eval-agent", { createIfMissing: true });
  const image = modal.images.fromRegistry("node:22-slim");

  // Create a sandbox with the Volume mounted so we can write files to it
  const uploadSandbox = await modal.sandboxes.create(app, image, {
    command: ["sleep", "300"],
    volumes: { "/app": codeVolume },
    timeoutMs: 300_000,
  });

  try {
    // Upload package.json and package-lock.json
    await uploadFileToSandbox(uploadSandbox, ROOT, "package.json", "/app/package.json");
    await uploadFileToSandbox(uploadSandbox, ROOT, "package-lock.json", "/app/package-lock.json");

    // Upload dist/ directory
    const distFiles = getAllFiles(join(ROOT, "dist"), ROOT);
    for (const file of distFiles) {
      await uploadFileToSandbox(uploadSandbox, ROOT, file, join("/app", file));
    }
    console.log(`  Uploaded ${distFiles.length} files from dist/`);

    // Install production dependencies inside the sandbox
    console.log("  Installing production dependencies...");
    const installProcess = await uploadSandbox.exec(
      ["sh", "-c", "cd /app && npm install --omit=dev --legacy-peer-deps 2>&1 | tail -5"],
    );
    const installOutput = await streamToString(installProcess.stdout);
    console.log(`  ${installOutput.trim()}`);
    console.log("  Dependencies installed.\n");
  } finally {
    await uploadSandbox.terminate();
  }

  // Step 4: Verify
  console.log("[4/4] Verifying deployment...");
  const verifySandbox = await modal.sandboxes.create(app, image, {
    command: ["sh", "-c", "ls -la /app/ && echo '---' && ls /app/dist/sandbox/ 2>/dev/null || echo 'No sandbox entrypoints found'"],
    volumes: { "/app": codeVolume },
    timeoutMs: 30_000,
  });

  const verifyOutput = await streamToString(verifySandbox.stdout);
  console.log(verifyOutput);

  await verifySandbox.wait();

  // Verify secrets exist
  try {
    await modal.secrets.fromName("eval-agent-secrets", {
      requiredKeys: ["ANTHROPIC_API_KEY"],
    });
    console.log("  Secret 'eval-agent-secrets' found.\n");
  } catch {
    console.log("  WARNING: Secret 'eval-agent-secrets' not found!");
    console.log("  Create it at https://modal.com/secrets with keys:");
    console.log("    - ANTHROPIC_API_KEY");
    console.log("    - BROWSERBASE_API_KEY");
    console.log("    - BROWSERBASE_PROJECT_ID\n");
  }

  console.log("=== Deployment complete! ===");
  console.log("\nRun with Modal:  npx eval-agent --config ./examples/config.json");
  console.log("Run locally:     npx eval-agent --config ./examples/config.json --local");
}

function getAllFiles(dir: string, rootDir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, rootDir));
    } else {
      files.push(relative(rootDir, fullPath));
    }
  }
  return files;
}

async function uploadFileToSandbox(
  sandbox: any,
  rootDir: string,
  relativePath: string,
  destPath: string,
): Promise<void> {
  const content = readFileSync(join(rootDir, relativePath));
  // Write via exec since sandbox filesystem API is the most reliable
  const dirPath = destPath.substring(0, destPath.lastIndexOf("/"));
  await sandbox.exec(["mkdir", "-p", dirPath]);

  const file = await sandbox.open(destPath, "w");
  await file.write(content);
  await file.close();
}

async function streamToString(stream: AsyncIterable<any>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      chunks.push(chunk);
    } else if (chunk instanceof Uint8Array || chunk instanceof Buffer) {
      chunks.push(new TextDecoder().decode(chunk));
    } else if (chunk?.message) {
      chunks.push(String(chunk.message));
    } else {
      chunks.push(String(chunk));
    }
  }
  return chunks.join("");
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
