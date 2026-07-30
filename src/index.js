#!/usr/bin/env node
import { parseArgs } from "./args.js";
import { resolveKey } from "./config.js";
import { CliError, EXIT } from "./errors.js";
import { toolsCmd } from "./commands/tools.js";
import { callCmd } from "./commands/call.js";
import { analyzeCmd } from "./commands/analyze.js";
import { walletCmd } from "./commands/wallet.js";
import { authCmd } from "./commands/auth.js";
import { readFileSync } from "node:fs";

// Single source of truth for the version: the package manifest that ships with
// the tarball. Hardcoding it here drifts from package.json on every release.
export const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const HELP = `prowl \u2014 CLI for the Prowl MCP (408 market-intelligence tools)

USAGE
  prowl <command> [args] [--json] [--key <prowl_...>]

COMMANDS
  auth status | login | logout
  tools list | search <query> | info <tool_name>
  call <tool_name> --params '<json>'
  analyze "<query>" [--tier basic|deep|max] [--playbook <id>] [--session <id>]
  wallet
  version

FLAGS: --json  --key <k>  -h/--help
Get a key at https://prowl.chat. Keys are billing-bearing \u2014 keep them secret.`;
export async function run(argv, { fetchImpl } = {}) {
  const args = parseArgs(argv);
  if (args.help || args.h || args._.length === 0) return { code: EXIT.OK, out: HELP };
  const ctx = { json: !!args.json, key: resolveKey(typeof args.key === "string" ? args.key : null), quiet: !!args.quiet, fetchImpl };
  const [cmd, sub] = args._;
  const rest = { ...args, _: args._.slice(cmd === "auth" || cmd === "tools" ? 2 : 1) };
  try {
    let result;
    switch (cmd) {
      case "auth": result = await authCmd(sub, rest, ctx, { fetchImpl }); break;
      case "tools": result = await toolsCmd(sub, rest, ctx); break;
      case "call": result = await callCmd(rest, ctx); break;
      case "analyze": result = await analyzeCmd(rest, ctx); break;
      case "wallet": result = await walletCmd(rest, ctx, { fetchImpl }); break;
      case "version": result = VERSION; break;
      default: return { code: EXIT.USAGE, err: `Unknown command: ${cmd}\n\n${HELP}` };
    }
    const out = ctx.json ? JSON.stringify(result) : (typeof result === "string" ? result : JSON.stringify(result, null, 2));
    return { code: EXIT.OK, out };
  } catch (e) {
    const code = e instanceof CliError ? e.code : EXIT.RUNTIME;
    if (ctx.json) return { code, out: JSON.stringify({ error: { code, message: e.message } }) };
    return { code, err: e.message };
  }
}
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) { run(process.argv.slice(2)).then(({ code, out, err }) => { if (out) process.stdout.write(out + "\n"); if (err) process.stderr.write(err + "\n"); process.exit(code); }).catch((e) => { process.stderr.write(String(e && e.message || e) + "\n"); process.exit(1); }); }
