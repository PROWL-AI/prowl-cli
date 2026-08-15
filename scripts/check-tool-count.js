#!/usr/bin/env node
/**
 * Does this CLI still state the number of tools the server actually serves?
 *
 * It did not. `@prowl-ai/cli` shipped 0.1.0 and 0.1.1 saying **408** while
 * prowl.chat served **448** — the count sat in `package.json`, the README and
 * the `--help` banner with nothing tying it to the source, and a test pinned the
 * wrong number so the suite defended the drift. The sibling `prowl-skill`
 * repository grew this check for the same reason; the CLI never got it, and the
 * CLI is where the stale number survived.
 *
 * The number now lives in exactly one place in the source (`API_TOOL_COUNT` in
 * `src/config.js`); this compares that against what the server publishes.
 *
 * Deliberately outside `npm test`, which must run offline. CI runs it as its own
 * step, and a network failure is reported as *unknown* rather than as a mismatch
 * — a check that cannot reach the server has learned nothing, and saying
 * otherwise trains people to ignore it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE = "https://prowl.chat/mcp/skill.md";

/**
 * The server's own figure, from the hosted skill document.
 *
 * Two independent anchors, because a document that reworded one of them should
 * make this say so rather than silently stop finding anything.
 */
export function serverCount(text) {
  const found = new Set();
  for (const re of [/→\s*(\d{2,5})\s+API\s+tools/gi, /\b(\d{2,5})\s+marketing[\s-]intelligence\s+API\s+tools/gi]) {
    let m;
    while ((m = re.exec(text)) !== null) found.add(Number(m[1]));
  }
  const list = [...found].sort((a, b) => a - b);
  return { count: list.length === 1 ? list[0] : null, found: list };
}

/**
 * Every count this package states to a user, and where.
 *
 * `src/config.js` is the single source the code reads; `package.json` and the
 * README are prose a human wrote. All three are checked, because the drift that
 * shipped lived in prose while the code was never wrong — there was no code.
 */
export function statedCounts(root = ROOT) {
  const out = [];
  const push = (file, counts) => {
    const uniq = [...new Set(counts)].sort((a, b) => a - b);
    if (uniq.length) out.push({ file, counts: uniq });
  };

  const config = readFileSync(join(root, "src", "config.js"), "utf8");
  const declared = config.match(/API_TOOL_COUNT\s*=\s*(\d{2,5})/);
  if (!declared) throw new Error("src/config.js no longer declares API_TOOL_COUNT — re-anchor this check rather than trusting the last known number.");
  push("src/config.js", [Number(declared[1])]);

  for (const rel of ["package.json", "README.md"]) {
    const text = readFileSync(join(root, rel), "utf8");
    const counts = [];
    for (const re of [/\b(\d{2,5})\s+(?:market-intelligence\s+)?(?:API\s+)?tools?\b/gi, /\b(\d{2,5})-tool\b/gi, /tools-(\d{2,5})-/g]) {
      let m;
      while ((m = re.exec(text)) !== null) counts.push(Number(m[1]));
    }
    push(rel, counts);
  }
  return out;
}

/**
 * `23` is the count of MCP tools the server registers — a different number,
 * stated deliberately beside the catalogue figure. A check that flagged it would
 * be wrong on every run.
 */
export const ALLOWED = [23];

export function verdict(server, rows, allowed = ALLOWED) {
  const ok = new Set([server, ...allowed]);
  const mismatches = [];
  for (const row of rows) {
    const bad = row.counts.filter((c) => !ok.has(c));
    if (bad.length) mismatches.push({ file: row.file, stated: bad });
  }
  return { ok: mismatches.length === 0, mismatches };
}

async function main() {
  let text;
  try {
    const res = await fetch(SOURCE, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    process.stdout.write(`UNKNOWN: could not reach ${SOURCE} — ${e.message}\n`);
    process.exit(0);
  }

  const { count, found } = serverCount(text);
  if (count === null) {
    process.stdout.write(
      `FAIL: could not read one count from ${SOURCE}; anchors matched ${JSON.stringify(found)}.\n` +
        "The document was reworded — re-anchor serverCount() rather than trusting the last known number.\n",
    );
    process.exit(1);
  }

  const rows = statedCounts();
  const v = verdict(count, rows);
  if (v.ok) {
    process.stdout.write(`OK: ${SOURCE} serves ${count} tools; ${rows.length} file(s) agree.\n`);
    process.exit(0);
  }
  process.stdout.write(`FAIL: ${SOURCE} serves ${count} tools, and these files say otherwise:\n`);
  for (const m of v.mismatches) process.stdout.write(`  ${m.file}: ${m.stated.join(", ")}\n`);
  process.stdout.write("Update src/config.js (API_TOOL_COUNT) and the prose in the same change.\n");
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
