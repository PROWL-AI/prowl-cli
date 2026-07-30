import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { run } from "../src/index.js";
import { EXIT } from "../src/errors.js";

// Build a mock fetch that emulates the MCP Streamable HTTP handshake + a tool call.
function mockMcp({ toolPayload, status = 200 } = {}) {
  let calls = 0;
  return async (url, opts) => {
    calls++;
    const body = JSON.parse(opts.body);
    const headers = new Map([["content-type", "application/json"], ["mcp-session-id", "sess-1"]]);
    const mkRes = (obj, st = 200) => ({ status: st, ok: st < 400, headers: { get: (k) => headers.get(k.toLowerCase()) }, text: async () => JSON.stringify(obj), json: async () => obj });
    if (body.method === "initialize") return mkRes({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "prowl" } } });
    if (body.method === "notifications/initialized") return mkRes({}, 202);
    if (body.method === "tools/call") {
      if (status !== 200) return mkRes({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "boom" } }, status);
      return mkRes({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: JSON.stringify(toolPayload) }] } });
    }
    return mkRes({}, 400);
  };
}

test("help with no args, exit 0", async () => {
  const r = await run([]);
  assert.equal(r.code, EXIT.OK);
  assert.match(r.out, /USAGE/);
});

test("unknown command exits USAGE(2)", async () => {
  const r = await run(["frobnicate"]);
  assert.equal(r.code, EXIT.USAGE);
});

test("tools list --json returns parsed payload via mocked MCP", async () => {
  const fetchImpl = mockMcp({ toolPayload: { tools: ["a", "b"], count: 385 } });
  const r = await run(["tools", "list", "--json", "--key", "prowl_test"], { fetchImpl });
  assert.equal(r.code, EXIT.OK);
  const parsed = JSON.parse(r.out);
  assert.equal(parsed.count, 385);
  assert.deepEqual(parsed.tools, ["a", "b"]);
});

test("tools search without query is USAGE(2)", async () => {
  const r = await run(["tools", "search", "--json", "--key", "prowl_test"], { fetchImpl: mockMcp({ toolPayload: {} }) });
  assert.equal(r.code, EXIT.USAGE);
});

test("call --params invalid json is USAGE(2)", async () => {
  const r = await run(["call", "extract_domain_from_url", "--params", "{bad", "--key", "prowl_test"], { fetchImpl: mockMcp({ toolPayload: {} }) });
  assert.equal(r.code, EXIT.USAGE);
});

test("analyze bad tier is USAGE(2)", async () => {
  const r = await run(["analyze", "competitors of stripe.com", "--tier", "ultra", "--key", "prowl_test"], { fetchImpl: mockMcp({ toolPayload: {} }) });
  assert.equal(r.code, EXIT.USAGE);
});

test("401 maps to AUTH(3) with --json error envelope", async () => {
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const res = { status: body.method === "initialize" ? 401 : 401, ok: false, headers: { get: () => "application/json" }, text: async () => JSON.stringify({ error: { message: "no" } }), json: async () => ({}) };
    return res;
  };
  const r = await run(["tools", "list", "--json", "--key", "prowl_bad"], { fetchImpl });
  assert.equal(r.code, EXIT.AUTH);
  const env = JSON.parse(r.out);
  assert.equal(env.error.code, EXIT.AUTH);
});

test("auth status without key, --json", async () => {
  const prev = process.env.PROWL_API_KEY; delete process.env.PROWL_API_KEY;
  try {
    const r = await run(["auth", "status", "--json"]);
    assert.equal(r.code, EXIT.OK);
    assert.equal(JSON.parse(r.out).authenticated, false);
  } finally { if (prev !== undefined) process.env.PROWL_API_KEY = prev; }
});

test("version matches the package manifest", async () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const r = await run(["version"]);
  assert.equal(r.out, pkg.version);
});

test("help advertises the current tool count and every command", async () => {
  const r = await run([]);
  assert.equal(r.code, EXIT.OK);
  assert.match(r.out, /408 market-intelligence tools/);
  for (const cmd of ["auth", "tools", "call", "analyze", "wallet", "version"]) {
    assert.match(r.out, new RegExp(`^\\s+${cmd}\\b`, "m"), `help omits "${cmd}"`);
  }
});
