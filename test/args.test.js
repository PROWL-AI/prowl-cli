import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/args.js";

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
