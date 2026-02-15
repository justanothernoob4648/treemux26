import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  JudgeSpec,
  JudgeResult,
  Project,
  ReportConfig,
  ModelConfig,
} from "../types.js";
import { JudgeResultSchema } from "../types.js";
import {
  createStagehandSession,
  createStagehandTools,
} from "../tools/stagehand.js";
import type { Stagehand } from "@browserbasehq/stagehand";

export function getMaxTurns(needsBrowser: boolean): number {
  return needsBrowser ? 8 : 2;
}

export function shouldCreateSession(
  needsBrowser: boolean,
  hasUrl: boolean,
  hasExternal: boolean,
): boolean {
  return needsBrowser && hasUrl && !hasExternal;
}

export function shouldCloseSession(ownsSession: boolean): boolean {
  return ownsSession;
}

export function buildJudgePrompt(
  project: Project,
  judgeSpec: JudgeSpec,
  contextDocument: string,
  scaleGuidance: string,
  reportConfig: ReportConfig,
): string {
  const categories = judgeSpec.scoringCategories
    .map((c) => `- ${c.category} (weight: ${c.weight}): ${c.description}`)
    .join("\n");

  return `You are evaluating the following project:

**Project Name:** ${project.name}
**Demo URL:** ${project.url ?? "No demo URL provided"}
${project.idea ? `**Original Idea:** ${project.idea}\n` : ""}**Pitch:** ${project.pitch}

**Evaluation Context:**
${contextDocument}

**Your Scoring Categories:**
${categories}

**Scale (1-10):**
${scaleGuidance}

**Feedback Tone:** ${reportConfig.feedbackTone}

**Instructions:**
1. ${project.url && judgeSpec.needsBrowser ? "Use the browser tools to navigate to the demo URL and thoroughly explore the project. Take screenshots of key pages." : "Evaluate based on the pitch text and context provided."}
2. Score each category from 1-10 with detailed reasoning.
3. Provide structured feedback: strengths, weaknesses, and actionable suggestions.
4. Identify improvement priorities, key differentiators, and any deal breakers.

Output ONLY valid JSON matching this exact structure:
{
  "projectName": "${project.name}",
  "judgeName": "${judgeSpec.name}",
  "scores": [
    { "category": "string", "score": number, "weight": number, "reasoning": "string" }
  ],
  "feedback": {
    "strengths": ["string"],
    "weaknesses": ["string"],
    "suggestions": ["string"],
    "summary": "string"
  },
  "feedbackSignal": {
    "improvementPriorities": [
      { "area": "string", "impact": "high|medium|low", "currentState": "string", "targetState": "string" }
    ],
    "keyDifferentiators": ["string"],
    "dealBreakers": ["string"]
  },
  "resourceAccessible": "fully_accessible" | "partially_accessible" | "inaccessible",
  "resourceNotes": "string or omit",
  "screenshots": ["string"] or omit
}`;
}

export async function runJudge(
  project: Project,
  judgeSpec: JudgeSpec,
  contextDocument: string,
  scaleGuidance: string,
  reportConfig: ReportConfig,
  models: ModelConfig,
  screenshotDir: string,
  timeoutMs: number,
  externalStagehand?: Stagehand | null,
): Promise<JudgeResult> {
  const prompt = buildJudgePrompt(project, judgeSpec, contextDocument, scaleGuidance, reportConfig);
  let stagehand: Stagehand | null = externalStagehand ?? null;
  const ownsSession = shouldCreateSession(
    judgeSpec.needsBrowser,
    Boolean(project.url),
    Boolean(externalStagehand),
  );

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const mcpServers: Record<string, ReturnType<typeof createStagehandTools>> = {};

    if (ownsSession) {
      stagehand = await createStagehandSession();
    }

    if (stagehand && judgeSpec.needsBrowser && project.url) {
      const stagehandServer = createStagehandTools(stagehand, screenshotDir);
      mcpServers["stagehand"] = stagehandServer;
    }

    let resultText = "";

    for await (const message of query({
      prompt,
      options: {
        systemPrompt: judgeSpec.systemPrompt,
        model: models.judges,
        allowedTools: judgeSpec.needsBrowser
          ? ["WebSearch", "WebFetch", "mcp__stagehand-browser__navigateTo", "mcp__stagehand-browser__observePage", "mcp__stagehand-browser__extractData", "mcp__stagehand-browser__interact", "mcp__stagehand-browser__takeScreenshot"]
          : ["WebSearch", "WebFetch"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: getMaxTurns(judgeSpec.needsBrowser),
        abortController,
        mcpServers,
      },
    })) {
      if (message.type === "result" && message.subtype === "success") {
        resultText = message.result;
      }
    }

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : resultText;
    const parsed = JSON.parse(jsonString);
    return JudgeResultSchema.parse(parsed);
  } finally {
    clearTimeout(timeout);
    if (shouldCloseSession(ownsSession) && stagehand) {
      await stagehand.close().catch(() => {});
    }
  }
}
