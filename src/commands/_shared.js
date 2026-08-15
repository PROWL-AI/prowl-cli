import { McpClient, toolJson, toolText } from "../mcp.js";
import { compact } from "../args.js";
import { CliError, EXIT } from "../errors.js";

/**
 * Map a tool's "Error: …" string onto an exit code.
 *
 * Several Prowl tools report failure as ordinary result text rather than as an
 * MCP error. Rendered as-is that prints a failure and exits 0, so a CI step that
 * branches on the exit code treats a blocked call as a success. The two cases a
 * script acts on differently — no key, no money — get their own codes.
 */
function classify(text) {
  if (/insufficient\s+wallet\s+balance|insufficient\s+credits|top\s+up/i.test(text)) return EXIT.BALANCE;
  if (/authenticated\s+prowl\s+account|api\s+key|unauthorized|not\s+authenticated/i.test(text)) return EXIT.AUTH;
  return EXIT.RUNTIME;
}

/** Call one MCP tool and render it for the active output mode. */
export async function runTool(ctx, name, params = {}, { timeoutMs } = {}) {
  const client = ctx.client || new McpClient(ctx.key, { fetchImpl: ctx.fetchImpl, timeoutMs });
  const result = await client.callTool(name, compact(params), { timeoutMs });
  const text = toolText(result);
  if (/^\s*Error:/.test(text)) throw new CliError(text.trim(), classify(text));
  return ctx.json ? toolJson(result) : text;
}

/** Require a positional argument, failing as usage rather than as a server error. */
export function need(args, index, usage) {
  const v = args._[index];
  if (!v) throw new CliError(`usage: ${usage}`, EXIT.USAGE);
  return v;
}

/** Require a flag whose value must be one of a fixed set. */
export function oneOf(value, allowed, flag) {
  if (value === undefined) return undefined;
  if (value === true || !allowed.includes(String(value))) {
    throw new CliError(`--${flag} must be one of ${allowed.join("|")}`, EXIT.USAGE);
  }
  return String(value);
}
