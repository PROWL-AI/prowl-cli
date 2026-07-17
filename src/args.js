export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const key = a.slice(2); const eq = key.indexOf("="); if (eq >= 0) { out[key.slice(0, eq)] = key.slice(eq + 1); continue; } const next = argv[i + 1]; if (next === undefined || next.startsWith("--")) out[key] = true; else { out[key] = next; i++; } }
    else out._.push(a);
  }
  return out;
}
