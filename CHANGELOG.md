# Changelog

## v0.2.0 — 2026-08-15

Audited command by command against the running server. Six of the findings cost
money or lie to the caller; the rest is the coverage that was missing.

### Fixed

- **`analyze` aborted at 30s and the wallet was still debited.** `prowl_analyze`
  states 30 seconds to 5 minutes, and up to 10 for `--tier max`; the client
  timeout was 30 seconds for every call. `prowl analyze --tier deep` could not
  succeed — the CLI gave up, the server ran to completion, and the run was
  billed for a report nobody received. Long calls now get 15 minutes, overridable
  with `PROWL_TIMEOUT_MS`, and a timeout says so rather than reporting a network
  fault: it names the deadline and warns that the run may still be billed.

- **`prowl wallet` could not have worked.** It called
  `GET /api/v1/wallet/balance`, which returns **404** — the route is
  `/api/v1/wallet`. That route sits behind a **JWT** decoder, and a `prowl_` API
  key is not a JWT, so the correct URL would have returned 401; no REST endpoint
  on the server accepts an API key at all. And the response carries
  `subscription_balance_usd` / `extra_balance_usd` / `total_available_usd`, not
  the `balance_usd` / `key_label` the renderer read. The 404 branch printed
  "endpoint not available on this deployment yet", which read as a server
  limitation and was the CLI calling the wrong URL with the wrong credential.
  It now calls `prowl_get_wallet` over MCP, which is the only surface a key can
  reach.

- **`prowl auth status` reported success unconditionally.** Every failure was
  swallowed by a bare `catch {}` with `ok` pre-set to `true`, and the one branch
  that could set it false needed a 401 from a URL that always 404s first. A
  revoked key printed "Authenticated". It now proves the key by making an
  authenticated call, distinguishes *rejected* (exit 3) from *could not tell*
  (network fault), and reports the balance and the modes the key can run.

- **The catalogue count said 408; the server serves 448.** It sat in
  `package.json`, the README and the `--help` banner, and a test pinned the
  wrong number so the suite defended the drift. The count now lives once, in
  `src/config.js`, and `npm run check:tools` compares it against
  `prowl.chat/mcp/skill.md` as its own CI step — an unreachable server is
  reported as *unknown*, never as a mismatch.

- **`-h` was answered "Unknown command: -h"** while the banner advertised
  `-h/--help`; it did not start with `--`, so it fell through to the positionals.

- **The MCP `clientInfo.version` was pinned at `0.1.0`** through the 0.1.1
  release. It is read from the manifest now, like `prowl version` and the banner.

- **A tool that reports failure as text exited 0.** Several Prowl tools answer
  `Error: Insufficient wallet balance …` as an ordinary result; the CLI rendered
  it and returned success, so a CI step branching on the exit code treated a
  blocked call as a finished report. Those are mapped onto `4` (balance) and `3`
  (auth) now.

### Added

- **Full coverage of the MCP surface** — the CLI reached 6 of the 21 logical
  tools. New: `playbooks`, `session start|status|get|list|reset` (with
  `--watch` to poll a detached run, which is the right shape for CI),
  `schedule create|list|pause|resume|cancel`, `artifact`, `export`, `stats`,
  `errors`.

- **Parameters that were unreachable.** `tools list` takes `--category`,
  `--names`, `--limit`, `--offset` — the server returns category *counts* by
  default and the CLI had no way to ask for names. `tools search` takes
  `--category`, `--provider`, `--limit`, `--offset`; `call` takes `--session`.

- **The subscription gate is stated.** `--tier deep` needs an Exploit+
  subscription and `--tier max` a Blackops+ one, and a key without it is **not
  refused** — the run resolves to `basic` and bills as basic. `prowl wallet`
  names the modes a key can actually run, before the spend.

- Flag validation as usage errors before any billed round trip: a bad `--tier`,
  a non-numeric `--limit`, a bare `--limit` (which used to become `1`), a
  `--params` that is valid JSON but not an object, an unknown artifact type.

- `--quiet`, and `PROWL_TIMEOUT_MS`.

### Changed

- The test suite went from 15 checks to 77. Most of it is a contract table: every
  command asserted against the MCP tool name and parameter keys it puts on the
  wire, because the bug class here is a command that looks right and sends a key
  the server ignores.

## v0.1.1 — 2026-08-14

- Fixed the tool count in `prowl --help`; single-sourced the version.

## v0.1.0 — 2026-08-14

- First release: a thin MCP client (`auth`, `tools`, `call`, `analyze`, `wallet`).
