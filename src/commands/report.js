import { CliError, EXIT } from "../errors.js";
import { LONG_TIMEOUT_MS } from "../mcp.js";
import { intFlag, strFlag } from "../args.js";
import { need, oneOf, runTool } from "./_shared.js";

export const ARTIFACT_TYPES = ["infographic", "pdf", "pptx", "audio", "video"];
export const THEMES = ["prowl", "prowl-gold", "prowl-light"];
export const EXPORT_FORMATS = ["markdown", "html"];

/**
 * Build an artifact from the report cached against a session.
 *
 * Both this and `export` need a prior `prowl analyze` (or a finished
 * `prowl session start`) on the SAME `--session`; without one the server has no
 * report to work from and says so.
 */
export async function artifactCmd(args, ctx) {
  const type = need(args, 0, `prowl artifact <${ARTIFACT_TYPES.join("|")}> [--theme ${THEMES.join("|")}] [--session <id>]`);
  if (!ARTIFACT_TYPES.includes(type)) {
    throw new CliError(`unknown artifact type "${type}" — one of ${ARTIFACT_TYPES.join(", ")}`, EXIT.USAGE);
  }
  return runTool(
    ctx,
    "prowl_generate_artifact",
    {
      artifact_type: type,
      theme: oneOf(args.theme, THEMES, "theme"),
      session_id: strFlag(args, "session"),
    },
    // Video and audio renders are minutes of work, not seconds.
    { timeoutMs: LONG_TIMEOUT_MS },
  );
}

export async function exportCmd(args, ctx) {
  return runTool(
    ctx,
    "prowl_export_report",
    {
      format: oneOf(args.format, EXPORT_FORMATS, "format"),
      // Named `--server-path` rather than `--out` on purpose: the MCP tool writes
      // on the Prowl server and returns that absolute path, which on the hosted
      // endpoint is not a file the caller can open. `--out` would read as "write
      // it here" and quietly not. For a local copy, redirect the report itself:
      //   prowl session get <id> > report.md
      filepath: strFlag(args, "server-path"),
      session_id: strFlag(args, "session"),
    },
    { timeoutMs: LONG_TIMEOUT_MS },
  );
}

export async function statsCmd(args, ctx) {
  return runTool(ctx, "prowl_get_stats", { session_id: strFlag(args, "session") });
}

export async function errorsCmd(args, ctx) {
  return runTool(ctx, "prowl_get_error_feed", {
    hours: intFlag(args, "hours"),
    source: strFlag(args, "source"),
    tool_name: strFlag(args, "tool"),
    error_class: strFlag(args, "class"),
    severity: strFlag(args, "severity"),
    limit: intFlag(args, "limit"),
    offset: intFlag(args, "offset"),
  });
}

export async function playbooksCmd(_args, ctx) {
  return runTool(ctx, "prowl_list_playbooks", {});
}
