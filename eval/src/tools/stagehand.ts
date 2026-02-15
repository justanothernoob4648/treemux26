import { Stagehand } from "@browserbasehq/stagehand";
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function createStagehandSession(): Promise<Stagehand> {
  const modelName = (process.env.STAGEHAND_MODEL ?? "claude-3-7-sonnet-latest") as any;
  const apiKey = process.env.STAGEHAND_API_KEY ?? process.env.ANTHROPIC_API_KEY!;

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    model: {
      modelName,
      apiKey,
    },
  });
  await stagehand.init();
  return stagehand;
}

export function createStagehandTools(
  stagehand: Stagehand,
  screenshotDir: string,
) {
  let screenshotCount = 0;

  const navigateTo = tool(
    "navigateTo",
    "Navigate the browser to a URL",
    { url: z.string().url() },
    async ({ url }) => {
      const page = stagehand.context.pages()[0];
      await page.goto(url, { waitUntil: "domcontentloaded", timeoutMs: 30_000 });
      return { content: [{ type: "text" as const, text: `Navigated to ${url}` }] };
    },
  );

  const observePage = tool(
    "observePage",
    "Observe and describe what is visible on the current web page",
    {},
    async () => {
      const observations = await stagehand.observe();
      const description = observations
        .map((o) => `- ${o.description}`)
        .join("\n");
      return { content: [{ type: "text" as const, text: description || "Empty page or no observable elements." }] };
    },
  );

  const extractData = tool(
    "extractData",
    "Extract structured data from the current page using a natural language instruction",
    { instruction: z.string() },
    async ({ instruction }) => {
      const data = await stagehand.extract(instruction);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  const interact = tool(
    "interact",
    "Interact with the page: click buttons, fill forms, scroll, etc. using natural language",
    { instruction: z.string() },
    async ({ instruction }) => {
      await stagehand.act(instruction);
      return { content: [{ type: "text" as const, text: `Performed: ${instruction}` }] };
    },
  );

  const takeScreenshot = tool(
    "takeScreenshot",
    "Take a screenshot of the current page",
    {},
    async () => {
      await mkdir(screenshotDir, { recursive: true });
      screenshotCount++;
      const filename = `screenshot-${screenshotCount}.png`;
      const filepath = join(screenshotDir, filename);
      const page = stagehand.context.pages()[0];
      const buffer = await page.screenshot({ fullPage: false });
      await writeFile(filepath, buffer);
      return { content: [{ type: "text" as const, text: `Screenshot saved to ${filepath}` }] };
    },
  );

  return createSdkMcpServer({
    name: "stagehand-browser",
    tools: [navigateTo, observePage, extractData, interact, takeScreenshot],
  });
}
