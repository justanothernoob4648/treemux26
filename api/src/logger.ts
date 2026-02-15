/**
 * Colored terminal logging for Treemux (chalk).
 */

import chalk from "chalk";

const tag = (label: string, color: typeof chalk.cyan) => (msg: string) => color(`[${label}]`) + " " + msg;

export const log = {
  treemux: (msg: string, ...args: unknown[]) => console.log(tag("treemux", chalk.magenta)(msg), ...args),
  ideation: (msg: string, ...args: unknown[]) => console.log(tag("ideation", chalk.blue)(msg), ...args),
  server: (msg: string, ...args: unknown[]) => console.log(tag("server", chalk.green)(msg), ...args),
  obs: (msg: string, ...args: unknown[]) => console.log(tag("obs", chalk.cyan)(msg), ...args),
  github: (msg: string, ...args: unknown[]) => console.log(tag("github", chalk.yellow)(msg), ...args),
  vercel: (msg: string, ...args: unknown[]) => console.log(tag("vercel", chalk.hex("#0070f3"))(msg), ...args),
  spawn: (msg: string, ...args: unknown[]) => console.log(tag("spawn", chalk.gray)(msg), ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(chalk.yellow("⚠"), msg, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(chalk.red("✗"), msg, ...args),
};
