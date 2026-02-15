export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function stddev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const squaredDiffs = values.map((v) => (v - m) ** 2);
  return Math.sqrt(mean(squaredDiffs));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeScores(
  judgeScores: Record<string, number[]>,
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const [judge, scores] of Object.entries(judgeScores)) {
    if (scores.length <= 1) {
      result[judge] = [...scores];
      continue;
    }
    const sd = stddev(scores);
    if (sd === 0) {
      result[judge] = [...scores];
      continue;
    }
    const m = mean(scores);
    result[judge] = scores.map((score) => {
      const z = (score - m) / sd;
      return clamp(5.5 + z * 1.5, 1, 10);
    });
  }
  return result;
}
