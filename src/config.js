import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const BASE_URL = process.env.PROWL_BASE_URL || "https://prowl.chat";
export const MCP_URL = process.env.PROWL_MCP_URL || BASE_URL.replace(/\/$/, "") + "/mcp";

// Single source of truth for the version: the manifest that ships in the
// tarball. Read here rather than in each consumer so `prowl version`, the
// `--help` banner and the MCP `clientInfo` can never disagree — clientInfo was
// pinned at "0.1.0" through the 0.1.1 release for exactly that reason.
export const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// The catalogue size, stated in one place. It is a server-side fact, so nothing
// here can keep it true on its own — `npm run check:tools` compares it against
// what prowl.chat serves, and CI fails the build when they part. The repository
// said 408 for two releases while the server served 448; a number restated in
// prose with nothing checking it is a number that will drift.
export const API_TOOL_COUNT = 444;

/**
 * Resolve the API key from, in order: an explicit `--key`, `PROWL_API_KEY`, and
 * the two token files a Prowl install may have written.
 */
export function resolveKey(explicit) {
  if (explicit) return explicit.trim();
  if (process.env.PROWL_API_KEY) return process.env.PROWL_API_KEY.trim();
  for (const p of [join(homedir(), ".prowl", "prowl_mcp_token"), join(homedir(), ".codex", "prowl_mcp_token")]) {
    try {
      const v = readFileSync(p, "utf-8").trim();
      if (v) return v;
    } catch {}
  }
  return null;
}
