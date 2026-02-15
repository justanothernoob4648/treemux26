import { z } from "zod";
import type { Project } from "../types.js";

const BuildResultSchema = z.object({
  url: z.string(),
  idea: z.string(),
  pitch: z.string(),
});

export const IncomingWebhookSchema = z.object({
  evaluator: z.object({
    counter: z.number().positive(),
    criteria: z.string(),
    role: z.string(),
  }),
  builds: z.array(BuildResultSchema).min(1),
});

export type IncomingWebhook = z.infer<typeof IncomingWebhookSchema>;

export function transformBuildsToProjects(
  builds: z.infer<typeof BuildResultSchema>[],
): Project[] {
  return builds.map((build, i) => ({
    name: `project-${i + 1}`,
    url: build.url,
    idea: build.idea,
    pitch: build.pitch,
  }));
}

export function buildContextDocument(evaluator: {
  counter: number;
  criteria: string;
  role: string;
}): string {
  return `## Evaluation Scenario
You are designing judges for a hackathon evaluation.

## Evaluator Role
${evaluator.role}

## Judging Criteria
${evaluator.criteria}

## Technical Details
- All projects have deployed web applications that should be evaluated via browser
- Projects include both an original idea description and an AI-generated pitch
- Generate exactly ${evaluator.counter} judges for this evaluation
- Each judge must have needsBrowser=true since all projects have live deployments`;
}
