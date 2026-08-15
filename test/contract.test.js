import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "../src/index.js";
import { EXIT } from "../src/errors.js";
import { mockMcp, runClean } from "./_mock.js";

const KEY = ["--key", "prowl_test"];

/**
 * The MCP tools this CLI invokes, and what each command must send.
 *
 * Every name here is registered by the server (`mcp_server/tools.py`,
 * `session_tools.py`); every parameter key is that tool's own signature. This
 * table is the CLI↔server contract, and each row is asserted below against the
 * request the CLI actually put on the wire — the class of bug that shipped is a
 * command that looks right and sends a key the server ignores.
 */
const CONTRACT = [
  { argv: ["tools", "list"], tool: "prowl_list_tools", args: {} },
  { argv: ["tools", "list", "--category", "seo", "--limit", "5", "--offset", "10"], tool: "prowl_list_tools", args: { category: "seo", limit: 5, offset: 10 } },
  { argv: ["tools", "list", "--names"], tool: "prowl_list_tools", args: { names: true } },
  { argv: ["tools", "search", "backlinks"], tool: "prowl_search_tools", args: { query: "backlinks" } },
  { argv: ["tools", "search", "ads", "--provider", "SpyFu", "--limit", "3"], tool: "prowl_search_tools", args: { query: "ads", provider: "SpyFu", limit: 3 } },
  { argv: ["tools", "info", "majestic_get_back_link_data"], tool: "prowl_tool_info", args: { tool_name: "majestic_get_back_link_data" } },
  { argv: ["playbooks"], tool: "prowl_list_playbooks", args: {} },

  // The parameter is `execution_mode`. A client sending `tier` has it ignored
  // and gets a basic run back under a deep label — billed as basic, reported as
  // deep. The skill documented `tier` for two releases.
  { argv: ["analyze", "q"], tool: "prowl_analyze", args: { query: "q", execution_mode: "basic" } },
  {
    argv: ["analyze", "q", "--tier", "deep", "--playbook", "idea-validation", "--session", "s1"],
    tool: "prowl_analyze",
    args: { query: "q", execution_mode: "deep", playbook_id: "idea-validation", session_id: "s1" },
  },

  { argv: ["call", "extract_domain_from_url", "--params", '{"url":"https://x.com"}'], tool: "prowl_call_tool", args: { tool_name: "extract_domain_from_url", params: { url: "https://x.com" } } },
  { argv: ["call", "t", "--session", "s2"], tool: "prowl_call_tool", args: { tool_name: "t", params: {}, session_id: "s2" } },

  { argv: ["session", "start", "q", "--tier", "max", "--title", "T"], tool: "prowl_start_session", args: { query: "q", execution_mode: "max", title: "T" } },
  { argv: ["session", "status", "s3"], tool: "prowl_session_status", args: { session_id: "s3" } },
  { argv: ["session", "get", "s4", "--messages"], tool: "prowl_get_session", args: { session_id: "s4", include_messages: true } },
  { argv: ["session", "list", "--limit", "2"], tool: "prowl_list_sessions", args: { limit: 2 } },
  { argv: ["session", "reset", "s5"], tool: "prowl_reset_session", args: { session_id: "s5" } },

  { argv: ["schedule", "create", "q", "--cadence", "weekly", "--tier", "deep", "--hour", "9"], tool: "prowl_schedule_create", args: { query: "q", cadence: "weekly", execution_mode: "deep", run_at_hour: 9 } },
  { argv: ["schedule", "list"], tool: "prowl_schedule_list", args: {} },
  { argv: ["schedule", "pause", "j1"], tool: "prowl_schedule_pause", args: { job_id: "j1" } },
  { argv: ["schedule", "resume", "j1"], tool: "prowl_schedule_resume", args: { job_id: "j1" } },
  { argv: ["schedule", "cancel", "j1"], tool: "prowl_schedule_cancel", args: { job_id: "j1" } },

  { argv: ["artifact", "pdf", "--theme", "prowl-gold", "--session", "s6"], tool: "prowl_generate_artifact", args: { artifact_type: "pdf", theme: "prowl-gold", session_id: "s6" } },
  { argv: ["export", "--format", "html"], tool: "prowl_export_report", args: { format: "html" } },
  { argv: ["export", "--server-path", "/tmp/r.md"], tool: "prowl_export_report", args: { filepath: "/tmp/r.md" } },

  { argv: ["stats", "--session", "s7"], tool: "prowl_get_stats", args: { session_id: "s7" } },
  { argv: ["errors", "--hours", "6", "--tool", "serpapi_x", "--severity", "alert"], tool: "prowl_get_error_feed", args: { hours: 6, tool_name: "serpapi_x", error_class: undefined, severity: "alert" } },
  { argv: ["wallet"], tool: "prowl_get_wallet", args: {} },
];

for (const row of CONTRACT) {
  test(`\`prowl ${row.argv.join(" ")}\` calls ${row.tool} with the documented params`, async () => {
    const fetchImpl = mockMcp({ toolPayload: { ok: true } });
    const r = await runClean(run, [...row.argv, ...KEY], { fetchImpl });
    assert.equal(r.code, EXIT.OK, r.err);
    const call = fetchImpl.only();
    assert.equal(call.name, row.tool);
    const expected = Object.fromEntries(Object.entries(row.args).filter(([, v]) => v !== undefined));
    assert.deepEqual(call.args, expected);
  });
}

test("an omitted flag is not sent as null", async () => {
  const fetchImpl = mockMcp({ toolPayload: {} });
  await runClean(run, ["tools", "search", "q", ...KEY], { fetchImpl });
  assert.deepEqual(Object.keys(fetchImpl.only().args), ["query"]);
});

test("the client identifies itself with the shipped version", async () => {
  const { VERSION } = await import("../src/config.js");
  const seen = [];
  const inner = mockMcp({ toolPayload: {} });
  const fetchImpl = async (url, opts) => {
    seen.push(JSON.parse(opts.body));
    return inner(url, opts);
  };
  await runClean(run, ["tools", "list", ...KEY], { fetchImpl });
  const init = seen.find((b) => b.method === "initialize");
  assert.equal(init.params.clientInfo.version, VERSION, "clientInfo.version drifted from package.json");
});
