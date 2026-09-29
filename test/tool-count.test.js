import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("serverCount reads the market-data wording the hosted document moved to", () => {
  // 2026-09 repositioning: the opening paragraph says "market data tools" and the
  // heading keeps "→ <n> API tools". Both anchors must still find the one figure.
  const doc = "## Tools (23 registered tools — 21 logical + 2 legacy aliases → 444 API tools)\n\nProwl exposes **444 market data tools** across 17 providers.\n";
  assert.deepEqual(serverCount(doc), { count: 444, found: [444] });
  assert.deepEqual(serverCount("444 market-data API tools, → 444 API tools"), { count: 444, found: [444] });
});

test("serverCount still refuses to guess across the two wordings", () => {
  const doc = "→ 444 API tools\n\n448 market data tools\n";
  assert.deepEqual(serverCount(doc), { count: null, found: [444, 448] });
});

test("statedCounts finds a count in the old and the new prose alike", () => {
  // A stale figure written in the new wording must not slip past the check just
  // because the phrase between the number and "tools" changed.
  const root = mkdtempSync(join(tmpdir(), "prowl-cli-count-"));
  try {
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "config.js"), "export const API_TOOL_COUNT = 444;\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ description: "444 market data tools across 17 providers" }));
    writeFileSync(join(root, "README.md"), "**448 market-intelligence tools** · 408 market-data tools · 102 SearchAPI engines · 17 providers\n");
    assert.deepEqual(statedCounts(root), [
      { file: "src/config.js", counts: [444] },
      { file: "package.json", counts: [444] },
      { file: "README.md", counts: [408, 448] },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
