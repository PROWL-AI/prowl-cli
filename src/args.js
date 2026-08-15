import { CliError, EXIT } from "./errors.js";

/**
 * Parse `--flag`, `--flag value`, `--flag=value`, `-h` and positionals.
 *
 * `-h` used to fall through to the positional list, so the `-h/--help` the
 * banner advertised was parsed as a command and answered "Unknown command: -h".
 */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h") {
      out.help = true;
      continue;
    }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const eq = key.indexOf("=");
      if (eq >= 0) {
        out[key.slice(0, eq)] = key.slice(eq + 1);
        continue;
      }
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

/**
 * Read a flag that must be a whole number.
 *
 * `--limit` reaching the server as the string "abc" is rejected there as a
 * validation error costing a round trip and reading like a server fault; and a
 * bare `--limit` (value `true`) would silently become 1. Both are usage errors,
 * so they are named as usage errors here.
 */
export function intFlag(args, name, fallback = undefined) {
  const raw = args[name];
  if (raw === undefined) return fallback;
  if (raw === true) throw new CliError(`--${name} needs a number`, EXIT.USAGE);
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new CliError(`--${name} must be a whole number, got ${JSON.stringify(String(raw))}`, EXIT.USAGE);
  return n;
}

/** Read a flag that must carry a string value, not stand bare. */
export function strFlag(args, name, fallback = undefined) {
  const raw = args[name];
  if (raw === undefined) return fallback;
  if (raw === true) throw new CliError(`--${name} needs a value`, EXIT.USAGE);
  return String(raw);
}

/** Drop `undefined` entries so an omitted flag never reaches the server as null. */
export function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
