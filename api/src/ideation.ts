/**
 * Ideation module: taskDescription + workerProfiles → OpenRouter → structured ideas.
 * Single run, outputs N ideas (one per worker) with risk and temperature.
 */

import type { IdeationIdea } from "./types.ts";
import { log } from "./logger.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const IDEATION_MODEL = "google/gemma-2-9b-it"; // cheap, fast

const MAX_TOKENS_IDEATION = 1024;

export interface IdeationInput {
  taskDescription: string;
  workerDescriptions: string[];
}

/**
 * Call OpenRouter once to generate exactly `workerDescriptions.length` ideas.
 * Returns array of { idea, risk, temperature } with risk/temp in 0–100.
 */
export async function ideate(input: IdeationInput): Promise<IdeationIdea[]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    log.error("OPENROUTER_API_KEY not set");
    throw new Error("OPENROUTER_API_KEY required");
  }

  const workerCount = input.workerDescriptions.length;
  const workerSummary = input.workerDescriptions
    .map((d, i) => `Worker ${i + 1}: ${d}`)
    .join("\n");

  const systemPrompt = `You are an ideation engine for any kind of professional or task. Given a task and worker profiles, output exactly one idea per worker as a JSON array. No markdown, no explanation, only valid JSON.
Each item must have: "idea" (string: concrete idea with a short implementation plan), "risk" (number 0-100), "temperature" (number 0-100).
Output exactly ${workerCount} items. Keep each idea and plan extensive for a hackathon. Make sure that the final JSON is valid and do not contain any trailing commas or other formatting issues.`;

  const userPrompt = `Task: ${input.taskDescription}

${workerSummary}

Respond with a JSON array of exactly ${workerCount} objects: [{ "idea": "...", "risk": 0-100, "temperature": 0-100 }, ...]`;

  log.ideation("Calling OpenRouter (single call, constrained output)...");
  const start = Date.now();

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://epoch.local",
    },
    body: JSON.stringify({
      model: IDEATION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: MAX_TOKENS_IDEATION,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    log.error("OpenRouter error: " + res.status + " " + text);
    throw new Error(`OpenRouter failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  const tokens = data.usage?.total_tokens;

  log.ideation("OpenRouter responded in " + (Date.now() - start) + "ms, tokens ~" + (tokens ?? "?"));

  if (!content) {
    log.error("Empty response from OpenRouter");
    throw new Error("Empty ideation response");
  }

  const parsed = parseIdeationJson(content, workerCount);
  log.ideation("Parsed " + parsed.length + " ideas");
  parsed.forEach((p, i) => {
    log.ideation("  [" + (i + 1) + "] risk=" + p.risk + " temp=" + p.temperature + " idea=" + p.idea);
  });
  return parsed;
}

function parseIdeationJson(raw: string, expectedLength: number): IdeationIdea[] {
  let text = raw;
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (jsonMatch) text = jsonMatch[0];

  const arr = JSON.parse(text) as unknown[];
  if (!Array.isArray(arr)) throw new Error("Ideation response is not an array");

  const out: IdeationIdea[] = [];
  for (let i = 0; i < expectedLength; i++) {
    const item = arr[i];
    if (!item || typeof item !== "object") {
      out.push({
        idea: "Fallback: build a simple Next.js landing page for the task.",
        risk: 50,
        temperature: 50,
      });
      continue;
    }
    const obj = item as Record<string, unknown>;
    out.push({
      idea: String(obj.idea ?? "Build a Next.js app for the task."),
      risk: clampNum(Number(obj.risk), 0, 100),
      temperature: clampNum(Number(obj.temperature), 0, 100),
    });
  }
  return out;
}

function clampNum(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return (min + max) / 2;
  return Math.max(min, Math.min(max, Math.round(n)));
}
