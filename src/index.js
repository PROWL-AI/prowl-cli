#!/usr/bin/env node
import { parseArgs } from "./args.js";
import { API_TOOL_COUNT, resolveKey, VERSION } from "./config.js";
import { CliError, EXIT } from "./errors.js";
import { toolsCmd } from "./commands/tools.js";
import { callCmd } from "./commands/call.js";
import { analyzeCmd } from "./commands/analyze.js";
import { walletCmd } from "./commands/wallet.js";
import { authCmd } from "./commands/auth.js";
import { sessionCmd } from "./commands/session.js";
import { scheduleCmd } from "./commands/schedule.js";
import { artifactCmd, errorsCmd, exportCmd, playbooksCmd, statsCmd } from "./commands/report.js";

export { VERSION };

const HELP = `prowl — CLI for the Prowl MCP (${API_TOOL_COUNT} market-intelligence tools)

USAGE
  prowl <command> [args] [--json] [--key <prowl_...>]

CATALOGUE (free)
  tools list [--category <c>] [--names] [--limit n] [--offset n]
  tools search "<query>" [--category <c>] [--provider <p>] [--limit n] [--offset n]
  tools info <tool_name>
  playbooks

RESEARCH (debits the wallet)
  call <tool_name> --params '<json>' [--session <id>]
  analyze "<query>" [--tier basic|deep|max] [--playbook <id>] [--session <id>]
  session start "<query>" [--tier <t>] [--title <s>] [--watch] [--interval <s>]
  session status <id> | get <id> [--messages] | list | reset [<id>]

SCHEDULES (each run debits the wallet)
  schedule create "<query>" [--cadence <c>] [--tier <t>] [--playbook <id>]
                            [--trigger interval|webhook] [--hour 0-23]
  schedule list [--limit n] [--offset n]
  schedule pause <job_id> | resume <job_id> | cancel <job_id>

OUTPUT (debits the wallet; needs a report on the same --session)
  artifact <infographic|pdf|pptx|audio|video> [--theme <t>] [--session <id>]
  export [--format markdown|html] [--session <id>]

ACCOUNT (free)
  auth status | login | logout
  wallet
  stats [--session <id>]
  errors [--hours n] [--tool <name>] [--severity <s>] [--limit n]
  version

FLAGS: --json  --key <k>  --quiet  -h/--help
ENV:   PROWL_API_KEY  PROWL_BASE_URL  PROWL_MCP_URL  PROWL_TIMEOUT_MS

TIERS: basic caps provider cost at $2.50, deep at $8.00, max at $18.00.
       deep needs an Exploit+ subscription and max a Blackops+ one; without it
       the run is NOT refused — it executes and bills as basic. Check first
       with \`prowl wallet\`, which names the modes your key can actually run.

Get a key at https://prowl.chat. Keys are billing-bearing — keep them secret.`;

/** Commands whose second positional is a sub-command, not an argument. */
const SUBCOMMANDED = new Set(["auth", "tools", "session", "schedule"]);

export async function run(argv, { fetchImpl } = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    return { code: EXIT.USAGE, err: e.message };
  }
  if (args.help || args._.length === 0) return { code: EXIT.OK, out: HELP };

  const [cmd, sub] = args._;
  const ctx = {
    json: !!args.json,
    key: resolveKey(typeof args.key === "string" ? args.key : null),
    quiet: !!args.quiet,
    fetchImpl,
  };
  const rest = { ...args, _: args._.slice(SUBCOMMANDED.has(cmd) ? 2 : 1) };

  try {
    let result;
    switch (cmd) {
      case "auth":
        result = await authCmd(sub, rest, ctx);
        break;
      case "tools":
        result = await toolsCmd(sub, rest, ctx);
        break;
      case "session":
        result = await sessionCmd(sub, rest, ctx);
        break;
      case "schedule":
        result = await scheduleCmd(sub, rest, ctx);
        break;
      case "call":
        result = await callCmd(rest, ctx);
        break;
      case "analyze":
        result = await analyzeCmd(rest, ctx);
        break;
      case "playbooks":
        result = await playbooksCmd(rest, ctx);
        break;
      case "artifact":
        result = await artifactCmd(rest, ctx);
        break;
      case "export":
        result = await exportCmd(rest, ctx);
        break;
      case "stats":
        result = await statsCmd(rest, ctx);
        break;
      case "errors":
        result = await errorsCmd(rest, ctx);
        break;
      case "wallet":
        result = await walletCmd(rest, ctx);
        break;
      case "version":
        result = VERSION;
        break;
      default:
        return { code: EXIT.USAGE, err: `Unknown command: ${cmd}\n\n${HELP}` };
    }
    const out = ctx.json ? JSON.stringify(result) : typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return { code: EXIT.OK, out };
  } catch (e) {
    const code = e instanceof CliError ? e.code : EXIT.RUNTIME;
    if (ctx.json) return { code, out: JSON.stringify({ error: { code, message: e.message } }) };
    return { code, err: e.message };
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run(process.argv.slice(2))
    .then(({ code, out, err }) => {
      if (out) process.stdout.write(out + "\n");
      if (err) process.stderr.write(err + "\n");
      process.exit(code);
    })
    .catch((e) => {
      process.stderr.write(String((e && e.message) || e) + "\n");
      process.exit(1);
    });
}
