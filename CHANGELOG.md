# Changelog

## v0.3.0 – 2026-09-29

Real-world market data from the shell. The catalogue moved and so did the words for it;
the banner and the tier line now say what the server serves.

### Changed

- **`prowl --help` and the package describe 444 market data tools.** `API_TOOL_COUNT`
  in `src/config.js` was 448; `prowl.chat/mcp/skill.md` serves `→ 444 API tools`
  (read 2026-09-29, `npm run check:tools` → *OK: 444 tools; 3 file(s) agree*). The
  noun follows the product's positioning: "market data tools" replaces
  "market-intelligence tools" in the banner, `package.json` and the README, which
  also names the current provider count (17) and SearchAPI engine count (102, not
  "60+").
- **The basic tier's provider-cost cap is $5.00, not $2.50.** The banner and the README
  quoted $2.50, a figure the server stopped using on 2026-09-27 when the basic cap grew
  by the report reserve it had been missing. Deep ($8.00) and max ($18.00) were right.
  The banner and README now also state the wallet hold per run – $15, $24 and $54 –
  which is the figure a wallet actually sees.

### Fixed

- **`check:tools` reads the hosted document in either wording.** Its second anchor
  matched only `<n> marketing intelligence API tools`; it now also accepts
  `<n> market data tools`, and the repository's own stated-count pattern accepts the
  same pair, so a stale figure written in the new wording is still caught. Both
  wordings are fixtured in `test/tool-count.test.js`.

## v0.2.1 — 2026-08-16

Release plumbing, and one thing that should never have been in the tarball.

### Fixed

- **`scripts/` no longer ships.** `files` listed it, so every install of this package
  carried `scripts/check-tool-count.js` — a development check with nothing at runtime
  reading it. `bin` is `src/index.js`; the script was dead weight in every consumer's
  `node_modules`.

### Changed

- **One release workflow instead of two publishers racing on one event.**
  `publish-npmjs.yml` and `publish-gpr.yml` both fired on `release: published`, which
  meant a human had to cut the GitHub release by hand first, and neither carried any
  of the guards a publish needs. `release.yml` replaces both: a `v*` tag runs the full
  CI suite **as a dependency** (so a red suite can actually stop a publish), checks the
  tag against `package.json`, extracts this section into the GitHub release, publishes
  with `--provenance`, skips cleanly when the version is already on the registry
  instead of dying on a 403, and then **polls the registry** — the read replica lags,
  so *published* is a claim until it is served.

  GitHub Packages is kept and gated behind a new `PUBLISH_GPR` variable. It previously
  published on every release with no flag at all. Whether anyone consumes the package
  from GPR could not be established, and removing a channel because you could not look
  is not the same as knowing it is unused.

- **`auto-tag.yml`**: a push to `master` whose version has no matching `v*` tag cuts
  the tag, which starts the release. A merge that does not bump the version publishes
  nothing — the decision to release stays a reviewed edit to one line. It refuses to
  tag a version with no CHANGELOG section, and warns when `TAG_PAT` is unset, because
  GitHub will not start a workflow from a tag pushed with `GITHUB_TOKEN`.

### Added

- `CONTRIBUTING.md` and `SECURITY.md`. A `prowl_` key is billing-bearing, and the
  security page leads with that.

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
