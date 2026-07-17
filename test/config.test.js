import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveKey } from "../src/config.js";

test("explicit key wins", () => {
  assert.equal(resolveKey("  prowl_explicit  "), "prowl_explicit");
});
test("env fallback", () => {
  const prev = process.env.PROWL_API_KEY;
  process.env.PROWL_API_KEY = "prowl_env";
  try { assert.equal(resolveKey(null), "prowl_env"); }
  finally { if (prev === undefined) delete process.env.PROWL_API_KEY; else process.env.PROWL_API_KEY = prev; }
});
