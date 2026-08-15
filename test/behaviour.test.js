import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "../src/index.js";
import { EXIT } from "../src/errors.js";
import { LONG_TIMEOUT_MS, McpClient, QUICK_TIMEOUT_MS } from "../src/mcp.js";
import { render } from "../src/commands/wallet.js";
import { mockMcp, runClean } from "./_mock.js";

const KEY = ["--key", "prowl_test"];

// ── Exit codes a script branches on ───────────────────────────────

test("a tool that reports insufficient balance as TEXT still exits BALANCE(4)", async () => {
  // Several Prowl tools answer failure as ordinary result text. Rendered as-is
  // that printed the failure and exited 0, so a CI step reading the exit code
  // treated a blocked, unbilled call as a completed report.
  const fetchImpl = mockMcp({ text: "Error: Insufficient wallet balance. Top up credits at prowl.chat." });
  const r = await runClean(run, ["analyze", "q", ...KEY], { fetchImpl });
  assert.equal(r.code, EXIT.BALANCE);
});

test("a tool that reports a missing key as TEXT exits AUTH(3)", async () => {
  const fetchImpl = mockMcp({ text: "Error: reading the wallet requires an authenticated Prowl account (API key)." });
  const r = await runClean(run, ["wallet", ...KEY], { fetchImpl });
  assert.equal(r.code, EXIT.AUTH);
});

test("HTTP 401 maps to AUTH(3) with a --json envelope", async () => {
  const fetchImpl = async () => ({ status: 401, ok: false, headers: { get: () => "application/json" }, text: async () => "{}", json: async () => ({}) });
  const r = await runClean(run, ["tools", "list", "--json", "--key", "prowl_bad"], { fetchImpl });
  assert.equal(r.code, EXIT.AUTH);
  assert.equal(JSON.parse(r.out).error.code, EXIT.AUTH);
});

test("a tool this deployment does not serve names the version skew, not a fault", async () => {
  const fetchImpl = mockMcp({ error: { code: -32601, message: "Unknown tool: prowl_get_wallet" } });
  const r = await runClean(run, ["wallet", ...KEY], { fetchImpl });
  assert.equal(r.code, EXIT.RUNTIME);
  assert.match(r.err, /newer than the server/);
});

// ── Usage errors, caught before a billed round trip ───────────────

test("an unknown tier is USAGE(2) and never reaches the server", async () => {
  const fetchImpl = mockMcp({ toolPayload: {} });
  const r = await runClean(run, ["analyze", "q", "--tier", "ultra", ...KEY], { fetchImpl });
  assert.equal(r.code, EXIT.USAGE);
  assert.equal(fetchImpl.calls.length, 0);
});

test("a non-numeric --limit is USAGE(2) and never reaches the server", async () => {
  const fetchImpl = mockMcp({ toolPayload: {} });
  const r = await runClean(run, ["tools", "search", "q", "--limit", "abc", ...KEY], { fetchImpl });
  assert.equal(r.code, EXIT.USAGE);
  assert.equal(fetchImpl.calls.length, 0);
});

test("--params that is valid JSON but not an object is USAGE(2)", async () => {
  const fetchImpl = mockMcp({ toolPayload: {} });
  const r = await runClean(run, ["call", "t", "--params", "[1,2]", ...KEY], { fetchImpl });
  assert.equal(r.code, EXIT.USAGE);
  assert.equal(fetchImpl.calls.length, 0);
});

test("an unknown artifact type is USAGE(2)", async () => {
  const fetchImpl = mockMcp({ toolPayload: {} });
  const r = await runClean(run, ["artifact", "hologram", ...KEY], { fetchImpl });
  assert.equal(r.code, EXIT.USAGE);
  assert.equal(fetchImpl.calls.length, 0);
});

test("a bare sub-command that needs an id is USAGE(2)", async () => {
  const fetchImpl = mockMcp({ toolPayload: {} });
  for (const argv of [["session", "status"], ["schedule", "pause"], ["tools", "info"]]) {
    const r = await runClean(run, [...argv, ...KEY], { fetchImpl });
    assert.equal(r.code, EXIT.USAGE, `${argv.join(" ")} should be a usage error`);
  }
  assert.equal(fetchImpl.calls.length, 0);
});

// ── The timeout that cost money ───────────────────────────────────

test("a long-running call gets a deadline longer than the work it times", () => {
  // prowl_analyze states 30s-5min for basic/deep and 5-10min for max. The CLI
  // aborted every call at 30s, so a deep run could not succeed: the client gave
  // up, the server finished, and the wallet was debited for a report nobody got.
  assert.ok(LONG_TIMEOUT_MS >= 10 * 60 * 1000, "a max-tier run can take 10 minutes");
  assert.ok(QUICK_TIMEOUT_MS < LONG_TIMEOUT_MS);
});

test("a timeout says it timed out, and that the run may still be billed", async () => {
  const client = new McpClient("prowl_test", {
    timeoutMs: 5,
    fetchImpl: (url, opts) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      }),
  });
  await assert.rejects(
    () => client.callTool("prowl_analyze", {}),
    (e) => {
      assert.equal(e.code, EXIT.NETWORK);
      assert.match(e.message, /Timed out/);
      assert.match(e.message, /may still be billed/);
      assert.match(e.message, /PROWL_TIMEOUT_MS/);
      return true;
    },
  );
});

test("PROWL_TIMEOUT_MS overrides the default", () => {
  process.env.PROWL_TIMEOUT_MS = "1234";
  try {
    assert.equal(new McpClient("k")._timeoutMs, 1234);
  } finally {
    delete process.env.PROWL_TIMEOUT_MS;
  }
});

// ── auth status, which used to report success unconditionally ─────

test("auth status with no key is AUTH(3) in text mode", async () => {
  const r = await runClean(run, ["auth", "status"]);
  assert.equal(r.code, EXIT.AUTH);
});

test("auth status with no key is a false, not a throw, under --json", async () => {
  const r = await runClean(run, ["auth", "status", "--json"]);
  assert.equal(r.code, EXIT.OK);
  assert.equal(JSON.parse(r.out).authenticated, false);
});

test("auth status does NOT claim success when the key is rejected", async () => {
  // The old implementation swallowed every failure into `catch {}` with `ok`
  // pre-set to true, and the one branch that could set it false needed a 401
  // from a URL that always 404s first. It printed "Authenticated" for a revoked
  // key, a network fault and a typo alike.
  const fetchImpl = async () => ({ status: 401, ok: false, headers: { get: () => "application/json" }, text: async () => "{}", json: async () => ({}) });
  const r = await runClean(run, ["auth", "status", "--json", "--key", "prowl_revoked"], { fetchImpl });
  assert.equal(JSON.parse(r.out).authenticated, false);
});

test("auth status reports unknown, not invalid, when the server cannot be reached", async () => {
  const fetchImpl = async () => {
    throw new Error("ECONNREFUSED");
  };
  const r = await runClean(run, ["auth", "status", "--json", "--key", "prowl_fine"], { fetchImpl });
  const out = JSON.parse(r.out);
  assert.equal(out.authenticated, null, "a network fault says nothing about the key");
});

test("auth status proves the key by making an authenticated call", async () => {
  const fetchImpl = mockMcp({ toolPayload: { total_available_usd: 17.4, entitlement: { available_execution_modes: ["basic", "deep"] } } });
  const r = await runClean(run, ["auth", "status", "--key", "prowl_good"], { fetchImpl });
  assert.equal(r.code, EXIT.OK);
  assert.equal(fetchImpl.only().name, "prowl_get_wallet");
  assert.match(r.out, /Authenticated/);
  assert.match(r.out, /\$17\.40/);
  assert.match(r.out, /basic, deep/);
});

test("auth status never prints the whole key", async () => {
  const fetchImpl = mockMcp({ toolPayload: { total_available_usd: 1 } });
  const key = "prowl_0123456789abcdef0123456789abcdef";
  const r = await runClean(run, ["auth", "status", "--key", key], { fetchImpl });
  assert.ok(!r.out.includes(key), "the full key reached stdout");
  assert.match(r.out, /…/);
});

// ── Wallet rendering ──────────────────────────────────────────────

test("wallet names the modes the key can run and what a blocked tier becomes", () => {
  const out = render({
    subscription_balance_usd: 12.4,
    extra_balance_usd: 5,
    total_available_usd: 17.4,
    entitlement: { available_execution_modes: ["basic"], downgraded_modes: { deep: "basic", max: "basic" } },
  });
  assert.match(out, /\$17\.40 available/);
  assert.match(out, /--tier deep would run as basic/);
  assert.match(out, /--tier max would run as basic/);
});

test("wallet surfaces a key cap that sits below the balance", () => {
  const out = render({
    total_available_usd: 100,
    subscription_balance_usd: 0,
    extra_balance_usd: 100,
    key_limits: { total_spend_limit_usd: 5, allowed_categories: ["seo"], denied_categories: [] },
  });
  assert.match(out, /total \$5\.00/);
  assert.match(out, /refused while the wallet still has funds/);
  assert.match(out, /only seo/);
});

// ── session --watch, the shape a CI step wants ─────────────────────

test("session start --watch polls until the run leaves the in-progress states", async () => {
  const states = ["running", "running", "completed"];
  let poll = 0;
  const calls = [];
  const mk = (obj) => ({
    status: 200,
    ok: true,
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? "application/json" : "sess-1") },
    text: async () => JSON.stringify(obj),
    json: async () => obj,
  });
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === "initialize") return mk({ jsonrpc: "2.0", id: body.id, result: {} });
    if (body.method === "notifications/initialized") return mk({});
    calls.push(body.params.name);
    const payload =
      body.params.name === "prowl_start_session"
        ? { session_id: "s-42", status: "running" }
        : { session_id: "s-42", status: states[Math.min(poll++, states.length - 1)], progress: 0.5, report: "done" };
    return mk({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: JSON.stringify(payload) }] } });
  };
  const r = await runClean(run, ["session", "start", "q", "--watch", "--interval", "1", "--json", "--quiet", ...KEY], { fetchImpl });
  assert.equal(r.code, EXIT.OK);
  assert.equal(calls[0], "prowl_start_session");
  assert.ok(calls.slice(1).every((c) => c === "prowl_session_status"));
  assert.equal(JSON.parse(r.out).status, "completed");
});

test("session start --watch surfaces a failed run as a non-zero exit", async () => {
  const mk = (obj) => ({
    status: 200,
    ok: true,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(obj),
    json: async () => obj,
  });
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === "initialize") return mk({ jsonrpc: "2.0", id: body.id, result: {} });
    if (body.method === "notifications/initialized") return mk({});
    const payload = body.params.name === "prowl_start_session" ? { session_id: "s-9", status: "running" } : { session_id: "s-9", status: "failed", error: "provider down" };
    return mk({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: JSON.stringify(payload) }] } });
  };
  const r = await runClean(run, ["session", "start", "q", "--watch", "--interval", "1", "--quiet", ...KEY], { fetchImpl });
  assert.equal(r.code, EXIT.RUNTIME);
  assert.match(r.err, /failed/);
});

test("session start --watch stops on an unrecognised state rather than polling forever", async () => {
  const mk = (obj) => ({ status: 200, ok: true, headers: { get: () => "application/json" }, text: async () => JSON.stringify(obj), json: async () => obj });
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === "initialize") return mk({ jsonrpc: "2.0", id: body.id, result: {} });
    if (body.method === "notifications/initialized") return mk({});
    const payload = body.params.name === "prowl_start_session" ? { session_id: "s-1", status: "running" } : { session_id: "s-1", status: "not_found" };
    return mk({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: JSON.stringify(payload) }] } });
  };
  const r = await runClean(run, ["session", "start", "q", "--watch", "--interval", "1", "--quiet", ...KEY], { fetchImpl });
  assert.equal(r.code, EXIT.OK);
  assert.match(r.out, /not_found/);
});
