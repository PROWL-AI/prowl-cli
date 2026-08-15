import { LONG_TIMEOUT_MS } from "../mcp.js";
import { strFlag } from "../args.js";
import { need, oneOf, runTool } from "./_shared.js";

export const TIERS = ["basic", "deep", "max"];

export async function analyzeCmd(args, ctx) {
  const query = need(args, 0, 'prowl analyze "<query>" [--tier basic|deep|max] [--playbook <id>] [--session <id>]');
  const tier = oneOf(args.tier, TIERS, "tier") || "basic";
  return runTool(
    ctx,
    "prowl_analyze",
    {
      query,
      // The server parameter is `execution_mode`. `--tier` is the CLI's word for
      // it because that is what the pricing page calls it; the mapping happens
      // here, once. A client that sent `tier` would have it ignored and get a
      // basic run back under a deep label.
      execution_mode: tier,
      playbook_id: strFlag(args, "playbook"),
      session_id: strFlag(args, "session"),
    },
    { timeoutMs: LONG_TIMEOUT_MS },
  );
}
