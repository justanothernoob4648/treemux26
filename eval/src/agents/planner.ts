import { query } from "@anthropic-ai/claude-agent-sdk";
import type { JudgingPlan, ModelConfig } from "../types.js";
import { JudgingPlanSchema } from "../types.js";

export function buildPlannerSystemPrompt(options?: { judgeCount?: number }): string {
  const judgeCountGuideline = options?.judgeCount
    ? `- Create exactly ${options.judgeCount} judges with distinct, non-overlapping focuses`
    : `- Create 2-5 judges with distinct, non-overlapping focuses`;

  return `You are an expert evaluation designer. Given a context document describing an evaluation scenario (hackathon, startup pitch, research review, etc.), you must design an appropriate judging panel.

Your output MUST be valid JSON matching this schema:
{
  "scenario": "string — brief description of the evaluation scenario",
  "scoreScale": { "min": 1, "max": 10 },
  "scaleGuidance": "string — description of what each score range means in this context",
  "judges": [
    {
      "name": "string — short identifier like 'innovation_judge'",
      "role": "string — what this judge focuses on",
      "systemPrompt": "string — detailed instructions for this judge",
      "scoringCategories": [
        {
          "category": "string",
          "description": "string — what this category evaluates",
          "weight": number
        }
      ],
      "needsBrowser": boolean,
      "source": "auto"
    }
  ],
  "tracks": ["string"] or omit if not applicable,
  "reportConfig": {
    "feedbackTone": "encouraging" | "balanced" | "critical",
    "includeScreenshots": boolean,
    "includeTrackRecommendations": boolean
  }
}

Guidelines:
${judgeCountGuideline}
- Each judge should have 3-5 scoring categories
- Category weights within a judge should sum to 1.0
- Set needsBrowser=true for judges that need to see the live demo/website
- Set needsBrowser=false for judges that only need the pitch text and context
- Choose feedbackTone based on the scenario (hackathon=encouraging, VC=critical, etc.)
- Include tracks only if the context defines them
- The systemPrompt for each judge should be detailed: explain their persona, what to look for, how to score, and the feedback tone

Output ONLY valid JSON. No markdown, no explanation.`;
}

export async function runPlanner(
  contextDocument: string,
  models: ModelConfig,
  options?: { judgeCount?: number },
): Promise<JudgingPlan> {
  const prompt = `Here is the evaluation context document:\n\n---\n${contextDocument}\n---\n\nDesign the judging panel for this evaluation. Output ONLY valid JSON.`;

  let resultText = "";

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: buildPlannerSystemPrompt(options),
      model: models.planner,
      allowedTools: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 1,
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      resultText = message.result;
    }
  }

  const jsonMatch = resultText.match(/\{[\s\S]*\}/);
  const jsonString = jsonMatch ? jsonMatch[0] : resultText;
  const parsed = JSON.parse(jsonString);
  return JudgingPlanSchema.parse(parsed);
}
