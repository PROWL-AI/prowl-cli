import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { run } from "../src/index.js";
import { EXIT } from "../src/errors.js";
import { API_TOOL_COUNT } from "../src/config.js";
import { mockMcp, runClean } from "./_mock.js";

test("help with no args, exit 0", async () => {
  const r = await run([]);
  assert.equal(r.code, EXIT.OK);
  assert.match(r.out, /USAGE/);
});

test("-h prints help rather than being parsed as a command", async () => {
  // `-h` did not start with `--`, so it fell through to the positional list and
  // was answered "Unknown command: -h" — while the banner advertised `-h/--help`.
  const r = await run(["-h"]);
  assert.equal(r.code, EXIT.OK);
  assert.match(r.out, /USAGE/);
});

test("unknown command exits USAGE(2)", async () => {
  const r = await run(["frobnicate"]);
  assert.equal(r.code, EXIT.USAGE);
});

test("tools list --json returns the parsed payload", async () => {
  const fetchImpl = mockMcp({ toolPayload: { categories: { seo: 98 }, total_tools: API_TOOL_COUNT } });
  const r = await runClean(run, ["tools", "list", "--json", "--key", "prowl_test"], { fetchImpl });
  assert.equal(r.code, EXIT.OK);
  assert.equal(JSON.parse(r.out).total_tools, API_TOOL_COUNT);
});

test("version matches the package manifest", async () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const r = await run(["version"]);
  assert.equal(r.out, pkg.version);
});

test("help states the catalogue count from the one place that holds it", async () => {
  const r = await run([]);
  assert.match(r.out, new RegExp(`${API_TOOL_COUNT} market data tools`));
});

test("help lists every command the CLI actually routes", async () => {
  const r = await run([]);
  const commands = ["auth", "tools", "call", "analyze", "playbooks", "session", "schedule", "artifact", "export", "stats", "errors", "wallet", "version"];
  for (const cmd of commands) {
    assert.match(r.out, new RegExp(`^\\s+${cmd}\\b`, "m"), `help omits "${cmd}"`);
  }
});

test("help warns that an unentitled tier is downgraded rather than refused", async () => {
  // The one billing surprise the CLI can prevent by saying so up front.
  const r = await run([]);
  assert.match(r.out, /NOT refused/);
  assert.match(r.out, /bills as basic/);
});

test("every routed command reaches a handler", async () => {
  // A command in the help text with no case in the switch would answer "Unknown
  // command" — the two lists are written by hand and drift apart silently.
  const fetchImpl = mockMcp({ toolPayload: {} });
  const routed = [
    ["auth", "status"],
    ["tools", "list"],
    ["call", "t"],
    ["analyze", "q"],
    ["playbooks"],
    ["session", "list"],
    ["schedule", "list"],
    ["artifact", "pdf"],
    ["export"],
    ["stats"],
    ["errors"],
    ["wallet"],
    ["version"],
  ];
  for (const argv of routed) {
    const r = await runClean(run, [...argv, "--key", "prowl_test"], { fetchImpl });
    assert.notEqual(r.code, EXIT.USAGE, `"${argv.join(" ")}" is advertised but not routed: ${r.err}`);
  }
});
