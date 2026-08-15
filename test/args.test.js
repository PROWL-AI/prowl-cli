import { test } from "node:test";
import assert from "node:assert/strict";
import { compact, intFlag, parseArgs, strFlag } from "../src/args.js";
import { EXIT } from "../src/errors.js";

test("positionals and flags", () => {
  const a = parseArgs(["tools", "search", "backlinks", "--json", "--key", "prowl_x"]);
  assert.deepEqual(a._, ["tools", "search", "backlinks"]);
  assert.equal(a.json, true);
  assert.equal(a.key, "prowl_x");
});

test("--flag=value form", () => {
  const a = parseArgs(["analyze", "q", "--tier=deep"]);
  assert.equal(a.tier, "deep");
  assert.deepEqual(a._, ["analyze", "q"]);
});

test("boolean flag at end", () => {
  const a = parseArgs(["wallet", "--json"]);
  assert.equal(a.json, true);
});

test("-h sets help instead of becoming a positional", () => {
  const a = parseArgs(["-h"]);
  assert.equal(a.help, true);
  assert.deepEqual(a._, []);
});

test("intFlag returns the fallback when absent", () => {
  assert.equal(intFlag({}, "limit", 50), 50);
  assert.equal(intFlag({}, "limit"), undefined);
});

test("intFlag rejects a non-number as a usage error", () => {
  assert.throws(() => intFlag({ limit: "abc" }, "limit"), (e) => e.code === EXIT.USAGE);
  assert.throws(() => intFlag({ limit: "1.5" }, "limit"), (e) => e.code === EXIT.USAGE);
});

test("intFlag rejects a bare flag rather than reading it as 1", () => {
  // `--limit` with no value parses to `true`, and Number(true) is 1 — a silent
  // page size of one instead of the error the caller needs.
  assert.throws(() => intFlag({ limit: true }, "limit"), (e) => e.code === EXIT.USAGE);
});

test("strFlag rejects a bare flag", () => {
  assert.equal(strFlag({ session: "s1" }, "session"), "s1");
  assert.throws(() => strFlag({ session: true }, "session"), (e) => e.code === EXIT.USAGE);
});

test("compact drops undefined so an omitted flag is never sent", () => {
  assert.deepEqual(compact({ a: 1, b: undefined, c: null, d: false }), { a: 1, c: null, d: false });
});
