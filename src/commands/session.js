import { CliError, EXIT } from "../errors.js";
import { McpClient, toolJson, toolText } from "../mcp.js";
import { intFlag, strFlag, compact } from "../args.js";
import { need, oneOf, runTool } from "./_shared.js";
import { TIERS } from "./analyze.js";

const DEFAULT_INTERVAL_S = 10;

export async function sessionCmd(sub, args, ctx) {
  if (sub === "start") {
    const query = need(args, 0, 'prowl session start "<query>" [--tier basic|deep|max] [--title <t>] [--watch]');
    const params = {
      query,
      execution_mode: oneOf(args.tier, TIERS, "tier") || "basic",
      title: strFlag(args, "title"),
    };
    if (!args.watch) return runTool(ctx, "prowl_start_session", params);
    return watch(ctx, params, args);
  }

  if (sub === "status") {
    const id = need(args, 0, "prowl session status <session_id>");
    return runTool(ctx, "prowl_session_status", { session_id: id });
  }

  if (sub === "get") {
    const id = need(args, 0, "prowl session get <session_id> [--messages]");
    return runTool(ctx, "prowl_get_session", {
      session_id: id,
      include_messages: args.messages === true || args.messages === "true" ? true : undefined,
    });
  }

  if (sub === "list") {
    return runTool(ctx, "prowl_list_sessions", { limit: intFlag(args, "limit"), offset: intFlag(args, "offset") });
  }

  if (sub === "reset") {
    return runTool(ctx, "prowl_reset_session", { session_id: args._[0] });
  }

  throw new CliError("usage: prowl session <start|status|get|list|reset>", EXIT.USAGE);
}

/**
 * Start a run and poll until it settles.
 *
 * This is the shape a CI step wants and the reason the async tools exist: a
 * `deep` or `max` run outlives most client deadlines, so blocking on
 * `prowl analyze` risks paying for a report the client abandons. Here the run is
 * detached server-side from the first call, so a lost poll costs nothing — the
 * session id is printed before any waiting begins and the report stays
 * retrievable with `prowl session get`.
 */
async function watch(ctx, params, args) {
  const intervalS = intFlag(args, "interval", DEFAULT_INTERVAL_S);
  if (intervalS < 1) throw new CliError("--interval must be at least 1 second", EXIT.USAGE);
  const client = new McpClient(ctx.key, { fetchImpl: ctx.fetchImpl });

  const started = await client.callTool("prowl_start_session", compact(params));
  const startedText = toolText(started);
  if (/^\s*Error:/.test(startedText)) throw new CliError(startedText.trim(), EXIT.RUNTIME);
  const startedJson = toolJson(started);
  const id = typeof startedJson === "object" && startedJson ? startedJson.session_id : null;
  if (!id) throw new CliError(`Could not read a session_id from the start response:\n${startedText}`, EXIT.RUNTIME);

  // Printed before the first sleep, on stderr so it never pollutes a `--json`
  // document being piped somewhere. If the poll loop dies, the caller still has
  // the id of a run that is being billed.
  if (!ctx.quiet) process.stderr.write(`session ${id} started; polling every ${intervalS}s (the run continues if this exits)\n`);

  for (;;) {
    const status = await client.callTool("prowl_session_status", { session_id: id });
    const json = toolJson(status);
    const state = typeof json === "object" && json ? json.status : null;
    if (state && state !== "running" && state !== "pending" && state !== "queued") {
      if (state === "failed") throw new CliError(`Session ${id} failed: ${toolText(status)}`, EXIT.RUNTIME);
      return ctx.json ? json : toolText(status);
    }
    if (!ctx.quiet && typeof json === "object" && json && json.progress != null) {
      process.stderr.write(`  ${state || "running"} ${Math.round(Number(json.progress) * 100)}%\n`);
    }
    await sleep(intervalS * 1000);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
