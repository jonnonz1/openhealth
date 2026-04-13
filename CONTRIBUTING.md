# Contributing to openhealth

Thanks for your interest in improving `openhealth`. This project aims to stay small, legible, and trustworthy — please read this file before opening a PR.

## Ground rules

1. **TDD, always.** Every implementation PR lands with a failing test first. Snapshot tests for markdown writers, unit tests for parsers and aggregators. No test, no merge.
2. **Simple over clever.** Zero deps > few deps > many deps. `node:util parseArgs` over `commander`. Streaming SAX over tree-building XML parsers. Add a dependency only when it clearly earns its weight.
3. **Clean interfaces.** `@openhealth/core` exposes small, composable functions over streams. No `fs` / `process` calls inside `core` — I/O lives in callers only.
4. **Privacy is architecture, not a feature.** No telemetry, no analytics, no outbound network calls from `core` or `web`. Ever.
5. **Docblocks on functions, minimal inline comments.** Names carry the *what*; comments explain only the non-obvious *why*.
6. **Sentence case headings, no emojis** in code, comments, commits, or docs.

## Repo layout

```
packages/core   — parser, aggregator, writers (isomorphic)
packages/cli    — Bun-compiled CLI
packages/web    — Vite static site
fixtures/       — tiny XML + expected markdown snapshots
specs/          — design docs (read 001 and 002 before non-trivial changes)
```

## Local setup

Requires **Node 22+**, **pnpm 9+**, and — for building the CLI binary — **[Bun](https://bun.sh)**.

```bash
pnpm install
pnpm test           # run everything
pnpm test:watch     # TDD loop
pnpm typecheck
pnpm -C packages/web dev
```

## Running against real data

Never commit real health exports. The `.gitignore` blocks `export.zip`, `export.xml`, `apple_health_export/`, and `output/` — keep it that way.

For local testing against your own export, drop the zip anywhere outside the repo and pass its path to the CLI, or drop it into the local dev server at `pnpm -C packages/web dev`.

## Commit messages

- Conventional-commits style is welcome but not enforced: `feat: …`, `fix: …`, `docs: …`, `test: …`, `refactor: …`.
- Keep the subject under 72 characters. Body explains the *why*, not the *what*.
- No co-author trailers or tool attributions.

## Pull requests

- One logical change per PR. Split large refactors.
- CI must be green (typecheck, tests, coverage gate on `@openhealth/core`).
- If you change parser or writer behaviour, regenerate `fixtures/expected/*.md` from the Python reference implementation and include the diff in the PR description.
- Link the issue or spec section you're addressing.

## Spec-first changes

Non-trivial features or architecture changes should land a spec in `specs/` first (pattern: `NNN-short-title.md`). Discuss in an issue, then PR the spec, then PR the implementation.

## Reporting security issues

See [`SECURITY.md`](SECURITY.md). Please do not open a public issue for suspected vulnerabilities.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
