# @prowl-ai/cli

**Prowl CLI** — one command-line client for the [Prowl MCP](https://prowl.chat): **448 market-intelligence tools** across 15 providers (SEO & backlinks, 60+ SERP engines, ads, web scraping, AI) plus the full Prowl research pipeline, billed pay-as-you-go from a USD wallet.

[![npm](https://img.shields.io/npm/v/@prowl-ai/cli?style=flat-square)](https://www.npmjs.com/package/@prowl-ai/cli)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

```bash
npm install -g @prowl-ai/cli
```

## Authenticate

Prowl API keys (`prowl_...`) are **billing-bearing** — every metered call debits your USD wallet. Keep them secret.

Generate a key at [prowl.chat](https://prowl.chat) (MCP Home → API keys), then provide it via any of:

```bash
export PROWL_API_KEY=prowl_...
# or
prowl tools list --key prowl_...
# or a token file
mkdir -p ~/.prowl && printf %s 'prowl_...' > ~/.prowl/prowl_mcp_token && chmod 600 ~/.prowl/prowl_mcp_token
```

`prowl auth status` proves the key by making an authenticated call and reports the balance and the execution modes it can run. Browser-based `prowl auth login` (device pairing) is not implemented yet.

## Commands

Every command maps to one MCP tool; the CLI covers all 21 the server registers.

```
CATALOGUE (free)
  prowl tools list [--category <c>] [--names] [--limit n] [--offset n]
  prowl tools search "<query>" [--category <c>] [--provider <p>] [--limit n] [--offset n]
  prowl tools info <tool_name>
  prowl playbooks

RESEARCH (debits the wallet)
  prowl call <tool_name> --params '<json>' [--session <id>]
  prowl analyze "<query>" [--tier basic|deep|max] [--playbook <id>] [--session <id>]
  prowl session start "<query>" [--tier <t>] [--title <s>] [--watch] [--interval <s>]
  prowl session status <id> | get <id> [--messages] | list | reset [<id>]

SCHEDULES (each run debits the wallet)
  prowl schedule create "<query>" [--cadence <c>] [--tier <t>] [--playbook <id>]
                                  [--trigger interval|webhook] [--hour 0-23]
  prowl schedule list | pause <job_id> | resume <job_id> | cancel <job_id>

OUTPUT (debits the wallet; needs a report on the same --session)
  prowl artifact <infographic|pdf|pptx|audio|video> [--theme <t>] [--session <id>]
  prowl export [--format markdown|html] [--session <id>]

ACCOUNT (free)
  prowl auth status | login | logout
  prowl wallet
  prowl stats [--session <id>]
  prowl errors [--hours n] [--tool <name>] [--severity <s>] [--limit n]
  prowl version
```

Global flags: `--json` (machine-readable, one JSON document on stdout), `--key <k>`, `--quiet`, `-h/--help`.

Environment: `PROWL_API_KEY`, `PROWL_BASE_URL`, `PROWL_MCP_URL`, `PROWL_TIMEOUT_MS`.

Recommended flow: `tools search` → `tools info` (check the cost) → `call`. Reach for `analyze` when the goal is a full report rather than one data point. Pass a stable `--session <id>` across consecutive calls to keep the report cache, history and spend scoped to one investigation — `artifact` and `export` read the report cached against that session.

## Tiers, and the downgrade that is not a refusal

`analyze` defaults to `--tier basic`. Each tier carries a hard provider-cost cap for the run — you are never billed more than the reserved hold.

| Tier | Use for | Cost cap | Requires |
|------|---------|---------:|----------|
| `basic` | One question, fast turnaround | $2.50 | — |
| `deep` | Full competitive report | $8.00 | Exploit+ subscription |
| `max` | Exhaustive, research-grade | $18.00 | Blackops+ subscription |

**A key without the subscription is not refused.** It is downgraded to `basic`, and the run executes and bills as `basic`. That is the right behaviour for the run and the wrong thing to learn afterwards, so check first:

```bash
prowl wallet          # names the modes this key can actually run
```

## Long runs

`analyze` blocks for 30 seconds to 5 minutes (`max`: up to 10). The CLI waits up to 15 minutes, overridable with `PROWL_TIMEOUT_MS`.

For CI, prefer the async form — the run is detached server-side from the first call, so a lost connection costs nothing:

```bash
prowl session start "competitors of stripe.com" --tier deep --watch
```

Without `--watch` it returns a `session_id` immediately; poll it with `prowl session status <id>` and read the report with `prowl session get <id>`.

## Playbooks

`--playbook <id>` forces a fixed, persona-tuned report shape instead of a dynamically composed one:

`geo-visibility-audit` · `competitor-teardown` · `content-engine` · `local-and-reputation` · `mobile-aso` · `amazon-marketplace` · `idea-validation` · `channel-economics-audit`

`prowl playbooks` (free) prints what each one covers.

## Exit codes

`0` ok · `1` runtime/tool error · `2` usage · `3` auth (missing/invalid key) · `4` insufficient balance · `5` network/timeout.

`3` means ask for a key, `4` means stop and report the balance rather than retrying, `5` is the only one worth a retry. A tool that reports failure as text (`Error: Insufficient wallet balance …`) is mapped onto the same codes rather than printed as a success.

## Examples

```bash
prowl tools search "backlinks" --limit 5
prowl tools info majestic_get_back_link_data
prowl call extract_domain_from_url --params '{"url":"https://stripe.com/pricing"}'
prowl analyze "competitors of stripe.com" --tier basic --json
prowl analyze "is there demand for an AI receipt scanner" --playbook idea-validation --tier deep
prowl session start "teardown of vercel.com" --tier deep --watch
prowl artifact pdf --session my-run
prowl wallet --json
```

## Keeping the tool count honest

The catalogue size is declared once, in `src/config.js`. `npm run check:tools` compares it against what `prowl.chat/mcp/skill.md` publishes and fails CI when they part; an unreachable server is reported as *unknown*, never as a mismatch. This package said 408 for two releases while the server served 448 — the number was prose with nothing checking it.

## Install from GitHub Packages

This package is also published to the GitHub Packages npm registry under the `PROWL-AI` org. To install from there, point the `@prowl-ai` scope at GitHub Packages and authenticate with a token that has `read:packages`:

```
# .npmrc
@prowl-ai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
npm install -g @prowl-ai/cli --registry=https://npm.pkg.github.com
```

The default install (`npm install -g @prowl-ai/cli`) uses the public npmjs.org registry and needs no auth.

## See also

- **[prowl-skill](https://github.com/PROWL-AI/prowl-skill)** — installable Claude Code / Codex plugin (MCP config + `/prowl:*` skill).
- **[prowl.chat/mcp/skill.md](https://prowl.chat/mcp/skill.md)** — full tool reference.

Requires Node.js >= 18. MIT licensed. Source: https://github.com/PROWL-AI/prowl-cli
