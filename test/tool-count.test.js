import { test } from "node:test";
import assert from "node:assert/strict";
import { ALLOWED, serverCount, statedCounts, verdict } from "../scripts/check-tool-count.js";
import { API_TOOL_COUNT } from "../src/config.js";

// The parsing halves are pure, so both branches are fixtured without a network.
// `npm test` must run offline; the live comparison is `npm run check:tools`.

test("serverCount reads one number from two independent anchors", () => {
  const doc = "# Prowl MCP → 448 API tools\n\nProwl exposes 448 marketing intelligence API tools.\n";
  assert.deepEqual(serverCount(doc), { count: 448, found: [448] });
});

test("serverCount refuses to guess when the anchors disagree", () => {
  // Two numbers means the document changed under us. Picking one would be a
  // coin flip presented as a measurement.
  const doc = "→ 448 API tools\n\n408 marketing intelligence API tools\n";
  assert.equal(serverCount(doc).count, null);
});

test("serverCount reports nothing found when the document is reworded", () => {
  assert.deepEqual(serverCount("Prowl gives you lots of tools."), { count: null, found: [] });
});

test("verdict passes when every stated count is the server's", () => {
  const rows = [
    { file: "src/config.js", counts: [448] },
    { file: "README.md", counts: [448] },
  ];
  assert.equal(verdict(448, rows).ok, true);
});

test("verdict names the file and the stale number", () => {
  const v = verdict(448, [{ file: "README.md", counts: [408, 448] }]);
  assert.equal(v.ok, false);
  assert.deepEqual(v.mismatches, [{ file: "README.md", stated: [408] }]);
});

test("verdict does not flag the registered-MCP-tool count stated beside it", () => {
  assert.equal(verdict(448, [{ file: "README.md", counts: [448, ...ALLOWED] }]).ok, true);
});

test("this repository agrees with itself", () => {
  // The offline half of the guard: every surface states the same number the code
  // declares. Whether that number is the server's is `npm run check:tools`.
  const rows = statedCounts();
  assert.ok(rows.some((r) => r.file === "src/config.js"), "the declared count was not found");
  assert.equal(verdict(API_TOOL_COUNT, rows).ok, true, `surfaces disagree with API_TOOL_COUNT (${API_TOOL_COUNT}): ${JSON.stringify(verdict(API_TOOL_COUNT, rows).mismatches)}`);
});
