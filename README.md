# @prowl-ai/cli

**Prowl CLI** — one command-line client for the [Prowl MCP](https://prowl.chat): **408 market-intelligence tools** across 15 providers (SEO & backlinks, 60+ SERP engines, ads, web scraping, AI) plus the full Prowl research pipeline, billed pay-as-you-go from a USD wallet.

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

> Browser-based `prowl auth login` (device pairing) ships in v0.2.

## Commands

```
prowl auth status | login | logout
prowl tools list                      # 408 tools by category (free)
prowl tools search "<query>"          # semantic catalog search (free)
prowl tools info <tool_name>          # input schema + estimated cost (free)
prowl call <tool_name> --params '<json>'   # invoke one tool (wallet debit)
prowl analyze "<query>" [--tier basic|deep|max] [--playbook <id>] [--session <id>]
prowl wallet                          # wallet balance
prowl version
```

Global flags: `--json` (machine-readable, one JSON document on stdout), `--key <k>`, `-h/--help`.

## Tiers

`prowl analyze` defaults to `--tier basic`. Each tier carries a hard provider-cost cap for the run — you are never billed more than the reserved hold.

| Tier | Use for | Cost cap |
|------|---------|---------:|
| `basic` | One question, fast turnaround | $2.50 |
| `deep` | Full competitive report | $8.00 |
| `max` | Exhaustive, research-grade | $18.00 |

## Playbooks

`--playbook <id>` forces a fixed, persona-tuned report shape instead of a dynamically composed one:

`geo-visibility-audit` · `competitor-teardown` · `content-engine` · `local-and-reputation` · `mobile-aso` · `amazon-marketplace` · `idea-validation` · `channel-economics-audit`

## Exit codes

`0` ok · `1` runtime/tool error · `2` usage · `3` auth (missing/invalid key) · `4` insufficient balance · `5` network/timeout.

## Examples

```bash
prowl tools search "backlinks"
prowl tools info majestic_get_back_link_data
prowl call extract_domain_from_url --params '{"url":"https://stripe.com/pricing"}'
prowl analyze "competitors of stripe.com" --tier basic --json
prowl analyze "is there demand for an AI receipt scanner" --playbook idea-validation --tier deep
```

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
