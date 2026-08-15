import { CliError, EXIT } from "../errors.js";
import { LONG_TIMEOUT_MS } from "../mcp.js";
import { strFlag } from "../args.js";
import { need, runTool } from "./_shared.js";

export async function callCmd(args, ctx) {
  const name = need(args, 0, "prowl call <tool_name> --params '<json>' [--session <id>]");
  let params = {};
  if (args.params !== undefined) {
    if (args.params === true) throw new CliError("--params needs a JSON value", EXIT.USAGE);
    try {
      params = JSON.parse(args.params);
    } catch {
      throw new CliError("--params must be valid JSON", EXIT.USAGE);
    }
    if (params === null || typeof params !== "object" || Array.isArray(params)) {
      throw new CliError("--params must be a JSON object, e.g. '{\"url\":\"https://example.com\"}'", EXIT.USAGE);
    }
  }
  return runTool(
    ctx,
    "prowl_call_tool",
    {
      tool_name: name,
      params,
      // Passing the session through is what lets spend and history for a batch
      // of calls be grouped and read back later; without it every call lands in
      // whatever session the transport happens to derive.
      session_id: strFlag(args, "session"),
    },
    // A single provider tool is usually fast, but scraping and AI tools are not,
    // and this call debits the wallet either way — the deadline must outlast the
    // work rather than abandon a call that is already being paid for.
    { timeoutMs: LONG_TIMEOUT_MS },
  );
}
