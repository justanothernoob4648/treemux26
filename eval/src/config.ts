import { parse } from "csv-parse/sync";
import { readFile } from "fs/promises";
import { Config, ConfigSchema, Project, ProjectSchema } from "./types.js";

export function parseConfig(raw: unknown): Config {
  return ConfigSchema.parse(raw);
}

export async function loadConfigFile(path: string): Promise<Config> {
  const content = await readFile(path, "utf-8");
  const raw = JSON.parse(content);
  return parseConfig(raw);
}

export async function loadProjects(
  projectsInput: string | Project[],
  isContent = false,
): Promise<Project[]> {
  if (Array.isArray(projectsInput)) {
    return projectsInput.map((p) => ProjectSchema.parse(p));
  }

  const content = isContent
    ? projectsInput
    : await readFile(projectsInput, "utf-8");

  if (!isContent && projectsInput.endsWith(".json")) {
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((p: unknown) => ProjectSchema.parse(p));
  }

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return (records as Record<string, string>[]).map((r) =>
    ProjectSchema.parse({
      name: r.name,
      url: r.url || undefined,
      pitch: r.pitch,
    }),
  );
}

export async function loadContext(contextPath: string): Promise<string> {
  return readFile(contextPath, "utf-8");
}
