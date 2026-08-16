# Contributing

## The gate

```bash
npm test              # node --test, six files, offline by design
npm run check:tools   # the stated catalogue count against prowl.chat
```

`npm test` must pass with **no key and no network**. `check:tools` reaches the network
on purpose and is therefore a separate command and a separate CI job — an unreachable
server exits 0 with `UNKNOWN`, never as drift. A check that could not ask has learned
nothing, and one that reports that as a failure gets re-run rather than read.

## The rule behind most review comments

**A number or a name is fetched, not remembered.** This CLI's own banner said `408`
tools for two releases while the server served `448`; the sibling repository shipped a
tool named `prowl_get_wallet` to npm while the deployment did not register it. Both
were confident and both were wrong, and `check:tools` exists because of the first.

`API_TOOL_COUNT` in `src/config.js` is the one place the catalogue size is stated, and
CI compares it against what prowl.chat serves. Keep it that way: one place, checked.

## The command surface is a published contract

`plugins/prowl-cli` in [`PROWL-AI/prowl-skill`](https://github.com/PROWL-AI/prowl-skill)
documents this CLI, and its `scripts/check-cli.js` reads **this package's published
tarball** on every CI run — diffing the verbs in `src/index.js`'s dispatcher and the
`EXIT` map in `src/errors.js` against what that page states.

So adding, renaming or removing a verb, a flag or an exit code turns that repository's
CI red until its page is updated. That is the check working. Say so in your PR
description, and expect a matching change over there.

## Releasing

**Bump `version` in `package.json` in your PR.** A merge to `master` that changes it
cuts the tag automatically and `release.yml` does the rest; a merge that does not bump
publishes nothing. Add the matching `## vX.Y.Z` section to `CHANGELOG.md` in the same
PR — `auto-tag.yml` refuses to tag without one, because that failure lands *after* the
tag is public and the tag then looks delivered while nothing shipped.

Publishing is armed per repository: `RELEASE_ENABLED` for the GitHub release,
`PUBLISH_NPMJS` for npm, `PUBLISH_GPR` for GitHub Packages.

## Reporting a vulnerability

Not here. See [SECURITY.md](SECURITY.md) — and never paste a `prowl_...` key into an
issue or a command line you will publish: it is billing-bearing.
