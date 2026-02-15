import { query } from "@anthropic-ai/claude-agent-sdk";
import { createHash } from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { JudgeSpec, CustomJudgeInput, ModelConfig } from "../types.js";
import { JudgeSpecSchema } from "../types.js";

const CACHE_DIR = ".cache/personas";

function cacheKey(input: CustomJudgeInput): string {
  const hash = createHash("sha256")
    .update(`${input.name}:${input.context}`)
    .digest("hex")
    .slice(0, 16);
  return `${input.name.toLowerCase().replace(/\s+/g, "-")}-${hash}.json`;
}

async function readCache(input: CustomJudgeInput): Promise<JudgeSpec | null> {
  try {
    const path = join(CACHE_DIR, cacheKey(input));
    const content = await readFile(path, "utf-8");
    return JudgeSpecSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
}

async function writeCache(input: CustomJudgeInput, spec: JudgeSpec): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, cacheKey(input));
  await writeFile(path, JSON.stringify(spec, null, 2));
}

const RESEARCH_SYSTEM_PROMPT = `You are a deep research agent. Given a person's name and context, research them thoroughly and build a detailed judge persona specification.

Use web search to find:
- Their professional background and expertise
- Published opinions, blog posts, talks, interviews
- Investment thesis or evaluation criteria they've expressed
- What they value and what they criticize
- Their communication style and personality

Then synthesize a JudgeSpec as valid JSON:
{
  "name": "string — identifier like 'persona_firstname_lastname'",
  "role": "string — their evaluator persona",
  "systemPrompt": "string — detailed prompt that makes an LLM behave like this person when evaluating. Include their background, what they care about, how they'd judge, their tone, specific things they'd look for based on their known preferences",
  "scoringCategories": [
    { "category": "string", "description": "string", "weight": number }
  ],
  "needsBrowser": boolean,
  "source": "persona"
}

Category weights should sum to 1.0. Create 3-5 categories reflecting what this person would actually care about based on your research.

Output ONLY valid JSON at the end of your response, after a line containing just "---JSON---".`;

function extractJson(text: string): Record<string, unknown> | null {
  // Try ---JSON--- marker first
  const jsonMarker = "---JSON---";
  const jsonStart = text.indexOf(jsonMarker);
  const searchText = jsonStart >= 0
    ? text.slice(jsonStart + jsonMarker.length).trim()
    : text;

  // Try to find a JSON object (greedy match from first { to last })
  const firstBrace = searchText.indexOf("{");
  const lastBrace = searchText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  const candidate = searchText.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    // Try removing markdown code fences
    const cleaned = candidate.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export async function researchPerson(
  input: CustomJudgeInput,
  models: ModelConfig,
): Promise<JudgeSpec> {
  const cached = await readCache(input);
  if (cached) return cached;

  const prompt = `Research this person and build a judge persona:\n\nName: ${input.name}\nContext: ${input.context}\nNeeds browser: ${input.needsBrowser}\n\nSearch the web thoroughly, then output the JudgeSpec JSON.`;

  let resultText = "";

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      model: models.research,
      allowedTools: ["WebSearch", "WebFetch"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 10,
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      resultText = message.result;
    }
  }

  const parsed = extractJson(resultText);
  if (!parsed) {
    // Retry with a direct JSON extraction prompt
    let retryText = "";
    for await (const message of query({
      prompt: `Extract the JudgeSpec JSON object from this text. Output ONLY valid JSON, nothing else:\n\n${resultText}`,
      options: {
        model: models.research,
        allowedTools: [],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 1,
      },
    })) {
      if (message.type === "result" && message.subtype === "success") {
        retryText = message.result;
      }
    }
    const retryParsed = extractJson(retryText);
    if (!retryParsed) {
      throw new Error(`Failed to extract JSON from research for ${input.name}`);
    }
    const spec = JudgeSpecSchema.parse({
      ...retryParsed,
      needsBrowser: input.needsBrowser,
      source: "persona",
    });
    await writeCache(input, spec);
    return spec;
  }

  const spec = JudgeSpecSchema.parse({
    ...parsed,
    needsBrowser: input.needsBrowser,
    source: "persona",
  });

  await writeCache(input, spec);
  return spec;
}

export async function researchAll(
  customJudges: CustomJudgeInput[],
  models: ModelConfig,
  onProgress?: (name: string, message: string) => void,
): Promise<JudgeSpec[]> {
  const results = await Promise.all(
    customJudges.map(async (input) => {
      onProgress?.(input.name, `Researching ${input.name}...`);
      const spec = await researchPerson(input, models);
      onProgress?.(input.name, `Completed research on ${input.name}`);
      return spec;
    }),
  );
  return results;
}
