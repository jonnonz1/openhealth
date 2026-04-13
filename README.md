# openhealth

> Your Apple Health data, finally readable by an LLM.

Your iPhone has been collecting millions of data points about how you sleep, train, and recover — and not a single app lets a chatbot look at them. `openhealth` turns your Apple Health export into seven concise markdown files any LLM can reason about, so you can get a real weekly coaching session from ChatGPT or Claude using your own data instead of vibes.

No account. No server. No telemetry. Your data, your AI coach.

- **Repo:** <https://github.com/jonnonz1/openhealth>
- **Status:** Pre-alpha — scaffolding complete, functional port in progress. Track the build in [`specs/`](specs/).
- **License:** MIT

---

## Why this exists

Apple's Health app is the richest personal dataset most people own, and it's trapped inside a 200 MB `export.xml` that no existing app will open. You can export it, but nothing reads it. That's the gap `openhealth` fills: parse the export, distill it into markdown a language model can actually ingest, and hand you files that drop straight into ChatGPT or Claude.

A reference implementation in Python has been in personal use for months — parsing ~3.3 million records in roughly 36 seconds at about 50 MB peak RAM, and producing seven tidy markdown files. This project is the open-source TypeScript port of that tool, plus a browser app and a phone-to-desktop handoff flow that non-developers can actually use.

---

## How it works

### 1. Export your data from the iPhone Health app

1. Open the **Health** app on your iPhone.
2. Tap your **profile icon** in the top-right corner.
3. Scroll to the bottom and tap **Export All Health Data**. This takes a minute or two — it's a big file.
4. Save the resulting `export.zip` somewhere convenient (Files, iCloud, or AirDrop to your Mac).

### 2. Hand the zip to `openhealth`

Pick whichever delivery surface you prefer:

| Surface | Command / action | Best for |
|---|---|---|
| **CLI** | `openhealth ~/export.zip -o ./output` | Developers, scripting, cron jobs |
| **Web** | Drop the zip on [openhealth.app](https://openhealth.app) | Non-developers, zero install |
| **Phone handoff** | Scan a QR on desktop; send the zip from iPhone over WebRTC | Skipping AirDrop + Finder friction |

All three paths run the exact same parser — the browser version is not a "lite" version. Nothing is uploaded to any server; every byte is processed locally in the CLI, the browser tab, or (for the handoff) a direct peer-to-peer WebRTC connection between your two devices.

### 3. Drop the markdown into your LLM

You get seven small markdown files designed to be pasted or uploaded into an LLM chat:

| File | Contains |
|---|---|
| `health_profile.md` | Baselines, data sources, long-term averages, weight history |
| `weekly_summary.md` | Current week plus a 4-week rolling comparison with week-over-week deltas |
| `workouts.md` | Detailed workout log for the last 4 weeks (HR, duration, distance, energy) |
| `body_composition.md` | Weight trend (6 months), recent readings, weekly nutrition averages |
| `sleep_recovery.md` | Nightly sleep stages, 8-week averages, HRV / resting HR / SpO2 trends |
| `cardio_fitness.md` | Running log (3 months), HR-zone distribution, walking-speed trends |
| `prompt.md` | A ready-to-paste system prompt that frames the other six files as coaching input |

There's also a `--bundle` mode that concatenates all seven into one `openhealth.md` with section breaks — useful when a chat model accepts one file better than seven.

### 4. Have a conversation

Open ChatGPT, Claude, or your tool of choice, paste the prompt from `prompt.md`, attach the other six files, and ask questions like:

- *"What's changed in my sleep quality over the last month?"*
- *"Is my running volume ramping safely for the marathon block?"*
- *"My resting HR is 6 bpm higher this week — what in the data would explain it?"*

Because the markdown is distilled, not raw, the model can reason over months of data without hitting token limits or drowning in noise.

---

## Privacy model

Privacy isn't a feature; it's the architecture.

- **No upload.** The CLI never makes a network call. The web app never posts your file anywhere — every byte is parsed inside your browser tab using client-side JavaScript. Open DevTools and watch the Network panel.
- **No server processing.** There is no backend that could see your data, because there is no backend. The only server component is a ~30-line WebSocket relay used to establish a peer-to-peer WebRTC connection during the phone-to-desktop handoff. The relay sees only the WebRTC handshake (small JSON), never the file bytes.
- **No analytics, no telemetry, no third-party scripts.** Not even a pageview counter.
- **Open source.** Everything runs in code you can read at <https://github.com/jonnonz1/openhealth> under the MIT license.
- **Reproducible.** `pnpm install && pnpm -C packages/web build && pnpm -C packages/web preview` spins up a byte-identical local copy of the hosted site.

---

## Repo layout

```
openhealth/
├── packages/
│   ├── core/     — @openhealth/core — isomorphic parser, aggregator, writers (Node, Bun, browser)
│   ├── cli/      — @openhealth/cli — Bun-compiled single-binary CLI
│   └── web/      — openhealth.app — Vite static site with drag-and-drop + QR handoff
├── fixtures/     — hand-crafted tiny XML inputs + expected markdown snapshots
├── specs/        — design docs (001 = master plan, 002 = design system)
├── CONTRIBUTING.md — how to contribute, conventions, TDD rules
└── README.md
```

---

## Quick start (development)

Requires **Node 22+**, **pnpm 9+**, and — for building the CLI binary — **[Bun](https://bun.sh)**.

```bash
# Install dependencies once
pnpm install

# Run all tests
pnpm test

# TDD watch mode
pnpm test:watch

# Typecheck the whole workspace
pnpm typecheck

# Preview the static site (hot reload)
pnpm -C packages/web dev

# Build the CLI as a single native binary
pnpm -C packages/cli build
./packages/cli/bin/openhealth --version
```

### Using the CLI

```bash
# From the zip (typical)
openhealth ~/Downloads/export.zip -o ./output

# From an extracted directory
openhealth ~/workspace/apple_health_export -o ./output

# Single-file bundle (drop into a chat in one go)
openhealth ~/Downloads/export.zip --bundle -o ./output

# Straight to your clipboard
openhealth ~/Downloads/export.zip --clipboard
```

> The CLI is currently a stub that responds to `--version`. The pipeline lands alongside the parser in step 11 of [spec 001](specs/001-initial-plan.md).

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (ES2022, strict) | Shared core between Node, Bun, and the browser |
| Runtime (CLI) | Bun primary, Node 22+ supported | `bun build --compile` produces a standalone binary |
| XML parsing | `saxes` (streaming SAX) | ~50 MB RAM ceiling on a 200 MB export — tree-builders like `fast-xml-parser` would OOM |
| Zip extraction | `fflate` | Streaming, isomorphic, ~13 KB |
| CLI args | `node:util parseArgs` | Zero deps |
| Tests | `vitest` + `happy-dom` | Isomorphic; ≥90% coverage gate on `@openhealth/core` |
| Web build | Vite | Static output, Web Workers, no framework lock-in |
| Hosting | Deno Deploy | Static site + WebRTC signaling relay on one host |

Design system: sage-green palette (`#EDF1D6 / #9DC08B / #609966 / #40513B`), Inter + JetBrains Mono — see [spec 002](specs/002-design-system.md).

---

## Roadmap

Numbered as in [`specs/001-initial-plan.md`](specs/001-initial-plan.md):

- [x] **Step 1.** Repo scaffold (pnpm workspace, tsconfig, vitest, smoke tests)
- [ ] **Step 2.** Fixtures — hand-crafted `tiny.xml` + expected snapshots from the Python reference
- [ ] **Step 3.** Port `types.ts` (dataclasses → interfaces)
- [ ] **Step 4.** Port `constants.ts` (HK identifiers, source priority, HR zones)
- [ ] **Step 5.** Port `parser.ts` (streaming SAX)
- [ ] **Step 6.** Port `aggregator.ts` (weekly / monthly rollups)
- [ ] **Step 7.** Port writers (one file per markdown output)
- [ ] **Step 8.** `bundle.ts` — concat into one file
- [ ] **Step 9.** `zip.ts` — isomorphic unzip via `fflate`
- [ ] **Step 10.** End-to-end integration test
- [ ] **Step 11.** CLI wiring (`--bundle`, `--clipboard`, `--max-hr`, `-o`)
- [ ] **Step 12.** Web app pipeline wiring (Worker-based processing, live result panel)
- [ ] **Step 13.** QR handoff flow (WebRTC + Deno Deploy signaling relay)

Out of scope for v1: Apple Health import, non-Apple sources (Garmin, Whoop), multi-user, any auth.

---

## Contributing

Issues and pull requests welcome at <https://github.com/jonnonz1/openhealth>. The project follows strict TDD — every implementation PR must land with a failing test first. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the short list of conventions.

## Credits

Built on the back of a private Python tool (`apple-health-gpt`) that's been the author's personal weekly-review workflow for months. The behavioural quirks that the TypeScript port must preserve (non-breaking-space source names, humidity hundredths, sleep-boundary dedup, etc.) are documented in [`specs/001-initial-plan.md`](specs/001-initial-plan.md).

## License

MIT — see [LICENSE](LICENSE).
