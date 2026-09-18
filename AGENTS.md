# AGENTS.md

Instructions for an AI agent working in this repository. `CONTRIBUTING.md` is the human
version and takes precedence where the two ever disagree; this file exists because the
[agent-plugins.org](https://agent-plugins.org) convention expects it at the repository root
and because an agent reads first and asks second.

## What this is

`@prowl-ai/cli` — the command-line client for the [Prowl MCP](https://prowl.chat). One
endpoint, 444 market-intelligence tools, billed pay-as-you-go from a USD wallet. Node, ESM,
no build step: `src/` is what ships.

## The gate, before you claim anything

```bash
npm test              # node --test, offline BY DESIGN — no key, no network
npm run check:tools   # the stated catalogue count against what prowl.chat serves
```

`npm test` must pass with no API key and no network. `check:tools` deliberately reaches the
network and is a separate command and a separate CI job; an unreachable server exits 0 with
`UNKNOWN`, never as drift. **A check that could not ask has learned nothing, and one that
reports that as a failure gets re-run instead of read.**

## The rule behind most review comments

**A number or a name is fetched, not remembered.** This CLI's banner said `408` tools for
two releases while the server served `448`, and in September 2026 it said `448` while the
server served `444` — twice confident, twice wrong. `API_TOOL_COUNT` in `src/config.js` is
the one place the catalogue size is stated; the README and `package.json` description repeat
it and `check:tools` compares all three against the server. Keep it one place, checked.

The same trap has a second door: CI runs on push, and this number drifts because the
**server** moves, not because the repository does. That is why the workflow also runs on a
weekly schedule — a quiet repository must still notice.

## The command surface is a published contract

`plugins/prowl-cli` in [`PROWL-AI/prowl-skill`](https://github.com/PROWL-AI/prowl-skill)
documents this CLI, and its `scripts/check-cli.js` reads **this package's published tarball**
on every CI run, diffing the verbs in `src/index.js`'s dispatcher and the `EXIT` map in
`src/errors.js` against what that page states.

So adding, renaming or removing a verb, a flag or an exit code turns that repository's CI red
until its page is updated. That is the check working, not a nuisance. Say so in the PR
description and expect a matching change over there.

## Releasing

Bump `version` in `package.json` **in the same PR**, with a matching `## vX.Y.Z` section in
`CHANGELOG.md`. A merge to `master` that changes the version cuts the tag automatically and
`release.yml` publishes; a merge that does not bump publishes nothing.

## What not to do

- Do not hardcode a tool count, a tool name or an endpoint anywhere but its one source.
- Do not make `npm test` need the network or a key — that is the property that makes it
  runnable by anyone, including you.
- Do not print, log or commit an API key. The CLI reads `PROWL_API_KEY` from the
  environment and nothing here should ever echo it.
