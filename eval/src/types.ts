import { z } from "zod";

// ─── Input Types ───

export const ProjectSchema = z.object({
  name: z.string(),
  url: z.string().url().optional(),
  idea: z.string().optional(),
  pitch: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CustomJudgeInputSchema = z.object({
  name: z.string(),
  context: z.string(),
  needsBrowser: z.boolean(),
});
export type CustomJudgeInput = z.infer<typeof CustomJudgeInputSchema>;

export const OutlierConfigSchema = z.object({
  globalThreshold: z.number().default(1.5),
  dimensionalThreshold: z.number().default(2.0),
  minQualityPercentile: z.number().min(0).max(100).default(50),
  maxRecommended: z.number().positive().default(10),
  diversityWeight: z.number().min(0).max(1).default(0.3),
});
export type OutlierConfig = z.infer<typeof OutlierConfigSchema>;

export const ConcurrencyConfigSchema = z.object({
  maxConcurrentBrowsers: z.number().positive().default(5),
  maxConcurrentApiCalls: z.number().positive().default(10),
  maxConcurrentProjects: z.number().positive().default(3),
  judgeTimeoutMs: z.number().positive().default(180_000),
});
export type ConcurrencyConfig = z.infer<typeof ConcurrencyConfigSchema>;

export const ModelConfigSchema = z.object({
  planner: z.string().default("claude-sonnet-4-5-20250929"),
  research: z.string().default("claude-sonnet-4-5-20250929"),
  judges: z.string().default("claude-sonnet-4-5-20250929"),
  reportWriter: z.string().default("claude-opus-4-6"),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const DeliveryWebhookConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});
export type DeliveryWebhookConfig = z.infer<typeof DeliveryWebhookConfigSchema>;

export const ModalConfigSchema = z.object({
  appName: z.string().default("eval-agent"),
  imageName: z.string().optional(),
  volumeCleanupDays: z.number().positive().default(7),
});
export type ModalConfig = z.infer<typeof ModalConfigSchema>;

export const ConfigSchema = z.object({
  context: z.string(),
  projects: z.union([z.string(), z.array(ProjectSchema)]),
  custom_judges: z.array(CustomJudgeInputSchema).optional(),
  output_dir: z.string(),
  outlierConfig: OutlierConfigSchema.optional(),
  concurrency: ConcurrencyConfigSchema.optional(),
  models: ModelConfigSchema.optional(),
  judgeWeights: z.record(z.string(), z.number()).optional(),
  deliveryWebhook: DeliveryWebhookConfigSchema.optional(),
  modal: ModalConfigSchema.optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

// ─── Planner Output Types ───

export const ScoringCategorySchema = z.object({
  category: z.string(),
  description: z.string(),
  weight: z.number().positive(),
});
export type ScoringCategory = z.infer<typeof ScoringCategorySchema>;

export const ReportConfigSchema = z.object({
  feedbackTone: z.enum(["encouraging", "balanced", "critical"]),
  includeScreenshots: z.boolean(),
  includeTrackRecommendations: z.boolean(),
});
export type ReportConfig = z.infer<typeof ReportConfigSchema>;

export const JudgeSpecSchema = z.object({
  name: z.string(),
  role: z.string(),
  systemPrompt: z.string(),
  scoringCategories: z.array(ScoringCategorySchema),
  needsBrowser: z.boolean(),
  source: z.enum(["auto", "persona"]),
});
export type JudgeSpec = z.infer<typeof JudgeSpecSchema>;

export const JudgingPlanSchema = z.object({
  scenario: z.string(),
  scoreScale: z.object({ min: z.literal(1), max: z.literal(10) }),
  scaleGuidance: z.string(),
  judges: z.array(JudgeSpecSchema),
  tracks: z.array(z.string()).optional(),
  reportConfig: ReportConfigSchema,
});
export type JudgingPlan = z.infer<typeof JudgingPlanSchema>;

// ─── Judge Output Types ───

export const CategoryScoreSchema = z.object({
  category: z.string(),
  score: z.number().min(1).max(10),
  weight: z.number().positive(),
  reasoning: z.string(),
});
export type CategoryScore = z.infer<typeof CategoryScoreSchema>;

export const FeedbackSchema = z.object({
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
  summary: z.string(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

export const ImprovementPrioritySchema = z.object({
  area: z.string(),
  impact: z.enum(["high", "medium", "low"]),
  currentState: z.string(),
  targetState: z.string(),
});

export const FeedbackSignalSchema = z.object({
  improvementPriorities: z.array(ImprovementPrioritySchema),
  keyDifferentiators: z.array(z.string()),
  dealBreakers: z.array(z.string()),
});
export type FeedbackSignal = z.infer<typeof FeedbackSignalSchema>;

export const TrackRecommendationSchema = z.object({
  track: z.string(),
  fit: z.enum(["strong", "moderate", "weak"]),
  reasoning: z.string(),
});

export const ResourceAccessibilitySchema = z.enum([
  "fully_accessible",
  "partially_accessible",
  "inaccessible",
]);

export const JudgeResultSchema = z.object({
  projectName: z.string(),
  judgeName: z.string(),
  scores: z.array(CategoryScoreSchema),
  feedback: FeedbackSchema,
  feedbackSignal: FeedbackSignalSchema,
  resourceAccessible: ResourceAccessibilitySchema,
  resourceNotes: z.string().optional(),
  trackRecommendations: z.array(TrackRecommendationSchema).optional(),
  screenshots: z.array(z.string()).optional(),
});
export type JudgeResult = z.infer<typeof JudgeResultSchema>;

// ─── Computed Types (orchestrator produces these) ───

export type ProjectScores = {
  projectName: string;
  judgeResults: JudgeResult[];
  overallScores: Record<string, number>;
  normalizedScores: Record<string, number>;
  compositeScore: number;
};

// ─── Outlier Analysis ───

export type GlobalOutlier = {
  projectName: string;
  compositeScore: number;
  percentile: number;
};

export type DimensionalOutlier = {
  projectName: string;
  dimension: string;
  score: number;
  zScore: number;
};

export type UniqueProfile = {
  projectName: string;
  distinctiveness: number;
  description: string;
};

export type RecommendedOutlier = {
  projectName: string;
  selectionReason: string;
  outlierTypes: ("global" | "dimensional" | "unique")[];
};

export type OutlierPatterns = {
  commonStrengths: string[];
  commonWeaknesses: string[];
  differentiatingFactors: string[];
};

export type OutlierAnalysis = {
  globalOutliers: GlobalOutlier[];
  dimensionalOutliers: DimensionalOutlier[];
  uniqueProfiles: UniqueProfile[];
  recommended: RecommendedOutlier[];
  patterns: OutlierPatterns;
  noOutliersDetected: boolean;
};

// ─── Evaluation Results ───

export type EvaluationResults = {
  plan: JudgingPlan;
  projectResults: Map<string, JudgeResult[]>;
  projectScores: ProjectScores[];
  rankings: ProjectScores[];
  outliers: OutlierAnalysis;
  reports: {
    deepReports: Map<string, string>;
    summary: string;
  };
};

// ─── Progress Events ───

export type ProgressEvent =
  | { type: "planning"; message: string }
  | { type: "researching"; judgeName: string; message: string }
  | { type: "evaluating"; projectName: string; projectIndex: number; totalProjects: number }
  | { type: "judge_started"; projectName: string; judgeName: string }
  | { type: "judge_completed"; projectName: string; judgeName: string; overallScore: number }
  | { type: "judge_failed"; projectName: string; judgeName: string; error: string }
  | { type: "computing"; message: string }
  | { type: "reporting"; projectName: string }
  | { type: "complete"; message: string };
