import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export const BASE_URL = process.env.PROWL_BASE_URL || "https://prowl.chat";
export const MCP_URL = process.env.PROWL_MCP_URL || (BASE_URL.replace(/\/$/, "") + "/mcp");
export function resolveKey(explicit) {
  if (explicit) return explicit.trim();
  if (process.env.PROWL_API_KEY) return process.env.PROWL_API_KEY.trim();
  for (const p of [join(homedir(), ".prowl", "prowl_mcp_token"), join(homedir(), ".codex", "prowl_mcp_token")]) {
    try { const v = readFileSync(p, "utf-8").trim(); if (v) return v; } catch {}
  }
  return null;
}
