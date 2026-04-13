# 001 — TypeScript Port + Browser App + CLI (TDD)

- **Status:** Active
- **Created:** 2026-04-13
- **Owner:** John

## Context

`apple-health-gpt` is a 1,713-line Python tool that streams Apple Health's 200MB / 6M-record `export.xml` into 7 LLM-ready markdown files (parses in ~36s, ~50MB RAM). It works, but has three limitations blocking open-source adoption:

1. **Python install friction** — non-dev users can't easily run it.
2. **Manual upload** — current flow is "run CLI → drag 7 files into ChatGPT" which is clunky.
3. **No browser option** — the most privacy-respecting UX (upload zip, get files, nothing leaves the device) doesn't exist.

This plan ports the tool to TypeScript as **`openhealth`**, with three delivery surfaces that share one pure-TS core library:

- **`@openhealth/core`** — isomorphic parse/aggregate/write library (Node, Bun, browser).
- **`@openhealth/cli`** — the existing CLI behavior, single-binary installable.
- **`openhealth.app`** — static website, zero-server, processes `export.zip` 100% client-side, downloads the 7 markdown files (or one bundled file), with a QR-code handoff so the iPhone can beam the zip directly to your desktop browser.

Plus upload-friction fixes that don't need code changes in the pipeline, only new output modes:

- **`--bundle`** — concat the 7 files into a single `openhealth.md` with H1 section breaks (drop one file instead of seven).
- **`--clipboard`** — write the bundle directly to the system clipboard; paste into any chat.
- **Claude Projects / ChatGPT-pinned-file workflow** — upload the bundle once, reuse across conversations (README instruction, no code).

Everything is TDD: every module lands with tests first, fixtures committed, CI gates green before merge.

---

## Recommendations (opinionated defaults — flag to override)

| Decision | Pick | Why |
|---|---|---|
| Runtime | **Bun** primary, **Node 22+** supported | Bun I/O is ~2× faster on big XML; `bun build --compile` → single binary; Node support keeps npm audience. |
| Package manager | **pnpm workspaces** | Bun workspaces are rougher; pnpm is the monorepo default and works for all three packages. |
| XML parsing | **`saxes`** | Pure-TS streaming SAX. Isomorphic (Node + browser). Direct analogue to Python `iterparse`. `fast-xml-parser` would OOM. |
| Zip extraction | **`fflate`** | Streaming, isomorphic, ~13KB. Unzips in a Web Worker without blocking UI. |
| CLI parsing | **`node:util parseArgs`** | Zero deps, matches "simple as possible." |
| Test runner | **`vitest`** | Isomorphic (can test browser + node), watch mode, snapshot support for markdown outputs. |
| Browser build | **Vite** | Static site, one command, WASM-ready if needed, Workers-ready out of the box. |
| E2E browser | **Playwright** | Can drive real file uploads; works for P2P-transfer testing. |
| License | **MIT** | Adoption default. |
| Repo | **New: `~/workspace/openhealth/`** | Python project stays as-is for now (archive reference). |
| Distribution | `npm i -g @openhealth/cli` + `brew install openhealth` (tap) + GitHub Release binaries (macOS arm64/x64, Linux x64) + `openhealth.app` static site + WebRTC signaling relay on **Deno Deploy**. |

---

## Repo layout (pnpm monorepo)

```
openhealth/
├── README.md                        # story-forward, see §Story
├── LICENSE                          # MIT
├── package.json                     # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
├── .github/workflows/
│   ├── ci.yml                       # test + typecheck + build all packages
│   └── release.yml                  # semantic-release, binaries, npm publish
├── fixtures/
│   ├── tiny.xml                     # ~20 hand-crafted records covering every record type
│   ├── edge-cases.xml               # NBSP source, humidity hundredths, SpO2 decimal, overlapping steps
│   └── expected/                    # canonical markdown outputs (snapshot targets)
└── packages/
    ├── core/                        # @openhealth/core — pure TS, isomorphic
    │   ├── src/
    │   │   ├── types.ts             # ← port of types.py
    │   │   ├── constants.ts         # ← port of constants.py (source-priority, HR zones, HK identifiers)
    │   │   ├── parser.ts            # ← port of parser.py (saxes streaming)
    │   │   ├── aggregator.ts        # ← port of aggregator.py
    │   │   ├── writers/             # one file per markdown output
    │   │   │   ├── health-profile.ts
    │   │   │   ├── weekly-summary.ts
    │   │   │   ├── workouts.ts
    │   │   │   ├── body-composition.ts
    │   │   │   ├── sleep-recovery.ts
    │   │   │   ├── cardio-fitness.ts
    │   │   │   ├── prompt.ts
    │   │   │   └── bundle.ts        # NEW: concat all 7 → openhealth.md
    │   │   ├── zip.ts               # ReadableStream → XML stream (via fflate)
    │   │   └── index.ts             # public API surface (see §Public API)
    │   ├── __tests__/
    │   │   ├── parser.test.ts
    │   │   ├── aggregator.test.ts
    │   │   ├── writers.test.ts      # snapshot-driven
    │   │   └── integration.test.ts  # fixtures/tiny.xml → assert full markdown output
    │   └── package.json
    ├── cli/                         # @openhealth/cli
    │   ├── src/
    │   │   ├── index.ts             # shebang + main()
    │   │   ├── args.ts              # parseArgs wrapper
    │   │   └── commands/
    │   │       └── generate.ts      # read export → write markdown (default & only command in v1)
    │   ├── __tests__/
    │   │   └── cli.test.ts          # spawn binary, assert file output
    │   ├── bin/openhealth           # built entrypoint for bun --compile
    │   └── package.json
    └── web/                         # openhealth.app — Vite static site
        ├── index.html
        ├── src/
        │   ├── main.ts
        │   ├── worker/
        │   │   └── process.worker.ts  # runs @openhealth/core off main thread
        │   ├── components/
        │   │   ├── DropZone.ts        # drag-and-drop zip
        │   │   ├── ProgressBar.ts     # parse progress (bytes + record count)
        │   │   ├── ResultsPanel.ts    # 7 download buttons + "Download all" + "Copy bundle"
        │   │   ├── QrHandoff.ts       # §QR Handoff — desktop shows QR, phone uploads
        │   │   └── PrivacyNote.ts     # "nothing leaves your browser" disclosure
        │   └── transfer/
        │       ├── peer.ts            # WebRTC DataChannel, see §QR Handoff
        │       └── signaling.ts       # chooses signaling strategy
        ├── __tests__/                 # Playwright component + e2e
        │   ├── upload.spec.ts
        │   └── qr-handoff.spec.ts
        └── package.json
```

---

## Public API (`@openhealth/core`)

The API a browser or CLI consumer calls. Designed as small, composable functions over streams so both surfaces reuse the same code.

```ts
// Streaming input — a Web ReadableStream (browser) or Node Readable (works in both)
import type { ReadableStream } from 'node:stream/web';

export interface ParsedData {
  workouts: Workout[];
  sleepSessions: SleepSession[];
  weightReadings: WeightReading[];
  heartRateSummaries: HeartRateSummary[];
  stepDays: StepDay[];
  distanceDays: DistanceDay[];
  // ... mirrors types.py dataclasses
}

export interface ParseOptions {
  onProgress?: (p: { bytesRead: number; recordsSeen: number }) => void;
  signal?: AbortSignal;
}

/** Parse an export.xml stream into structured data. Streaming, ~50MB RAM ceiling. */
export function parseHealthXml(
  xmlStream: ReadableStream<Uint8Array>,
  opts?: ParseOptions
): Promise<ParsedData>;

/** Parse an export.zip stream — unzips in-memory to locate export.xml, streams it through parseHealthXml. */
export function parseHealthZip(
  zipStream: ReadableStream<Uint8Array>,
  opts?: ParseOptions
): Promise<ParsedData>;

export interface WriteOptions {
  maxHr?: number;          // default 180
  dateOfBirth?: string;    // ISO date, default undefined
  now?: Date;              // injected for determinism in tests
}

export interface MarkdownOutputs {
  'health_profile.md': string;
  'weekly_summary.md': string;
  'workouts.md': string;
  'body_composition.md': string;
  'sleep_recovery.md': string;
  'cardio_fitness.md': string;
  'prompt.md': string;
}

/** Pure function: ParsedData → 7 markdown strings. No I/O. */
export function generateMarkdown(data: ParsedData, opts?: WriteOptions): MarkdownOutputs;

/** Concat 7 files into one bundled markdown with H1 section breaks. */
export function bundleMarkdown(outputs: MarkdownOutputs): string;
```

This is the contract the browser, CLI, and MCP server all share. No function in `core` touches `fs` or `process`; I/O happens only in the callers.

---

## TDD plan — order of operations

Build bottom-up. Each step is red-green-refactor. Nothing merges without tests.

1. **Scaffold repo** — pnpm workspace, tsconfig, vitest, CI skeleton. Commit smoke test that imports `@openhealth/core` and fails loudly.
2. **Fixtures first** — port `fixtures/tiny.xml` by hand covering every HK record type the Python parser touches (~20 records). Run Python once against this fixture to produce `fixtures/expected/*.md` — these become snapshot targets.
3. **`types.ts`** — port dataclasses → interfaces. Type-only, no tests needed beyond `tsc --noEmit`.
4. **`constants.ts`** — port magic strings, source-priority order, HR zones, HK identifiers. Unit tests verifying source-priority ordering and HR-zone boundaries match Python.
5. **`parser.ts`** — hardest module. Red-green per record type:
   - Test: "given XML with one Workout record, returns one Workout." → implement minimal saxes handler.
   - Test: source name with `\xa0` normalizes. → add `normalizeSource()`.
   - Test: humidity `"7100 %"` → `71`. → add unit conversions.
   - Test: SpO2 `"0.96"` → `96`.
   - Test: overlapping iPhone + Watch steps → picks Watch (higher daily total). → add per-source accumulator dedup.
   - Test: Withings + MyFitnessPal same-date same-weight → one reading. → add weight dedup.
   - Test: sleep sessions cross 6am boundary correctly. → add night-boundary logic.
   - Test: source-priority sleep dedup (Watch > AutoSleep > Withings > other).
   - Memory test: parse `fixtures/tiny.xml` 1000× in a loop → heap doesn't grow monotonically (proves streaming correctness).
6. **`aggregator.ts`** — pure functions over `ParsedData`. Each rollup (weekly, monthly, 4-week rolling) gets its own test with hand-crafted input arrays.
7. **`writers/*.ts`** — snapshot tests against `fixtures/expected/*.md`. One writer per file, each one red-green independently. Injected `now: Date` for determinism.
8. **`bundle.ts`** — simple concat test; assert section boundaries are valid markdown H1.
9. **`zip.ts`** — isomorphic unzip via `fflate`. Test streams a tiny in-memory zip (Node Buffer → ReadableStream) through the pipeline.
10. **Integration test** — `fixtures/tiny.xml` → `parseHealthXml` → `generateMarkdown` → snapshot-match `fixtures/expected/*.md` byte-for-byte.
11. **`@openhealth/cli`** — wraps core. Flags: `--bundle`, `--clipboard`, `--max-hr`, `-o`. Tests spawn the built binary (via `execa`) against fixtures, assert written files match snapshots.
12. **`@openhealth/web`** — Vite app. Unit tests for components. Playwright e2e: upload fixture zip via drag-and-drop, assert all 7 download buttons appear with correct content. Worker isolation test: UI stays responsive during parse.
13. **QR handoff flow** — see §QR Handoff below. Tested end-to-end with Playwright driving two browser contexts.

Coverage gate: **≥90% line coverage on `@openhealth/core`**. CLI + web carry lighter gates because most logic lives in core.

---

## QR Handoff (the "upload from phone" flow)

**Problem**: the `export.zip` is generated on iPhone. Transferring to a desktop browser typically means AirDrop → Finder → drag-into-browser. Annoying.

**Solution**: desktop browser shows a QR code. iPhone scans → opens a lightweight uploader page in mobile Safari → sends the file over WebRTC DataChannel directly to the desktop browser. Desktop processes it client-side, downloads results.

**Architecture** (fully client-side, one static site, one tiny signaling server):

```
Desktop Browser                 Signaling                    iPhone Browser
───────────────                 (WebSocket)                  ──────────────
  generate sessionId  ─────→  openhealth.app/ws  ←─────  scan QR, open URL
  render QR with URL           relays SDP offer/answer +   /r/:sessionId
                               ICE candidates (no file
  establish WebRTC ◄────────── data, just metadata)  ──────→ establish WebRTC
  receive zip over DC ◄══════════════════════════════════════ send zip over DC
  parse in-browser (Worker)                                   show "done" toast
  offer 7 MD downloads
```

- **QR payload**: `https://openhealth.app/r/<sessionId>` — a 16-byte random session id.
- **Signaling**: a ~30-line WebSocket relay on **Deno Deploy** — native WebSocket support, same host as the static site, one deploy pipeline for both. The only server-side component; it never sees the file, only tiny WebRTC handshake JSON. Free tier is ample for this traffic shape.
- **Transfer**: WebRTC DataChannel, chunked at 16KB, ~5–15 seconds for a 30MB zip on home Wi-Fi.
- **Fallback**: if WebRTC fails (corporate NAT, etc.), show "transfer failed — drop the zip on this page instead."

**Honest tradeoff**: the signaling relay makes this not-quite-zero-backend. If pure-static is a hard requirement, the alternative is manual drag-and-drop only (no QR). I'd argue the relay is worth it — it's public, metadata-only, and the file never leaves the two browsers.

**Alternative considered and rejected**: push everything to `postMessage` over a shared URL fragment. Works for tiny data, not 30MB.

---

## Upload-friction fixes (the original question, fully answered)

Ranked by impact for your use case (John, using Claude + ChatGPT):

| Option | Effort | Win |
|---|---|---|
| **`--bundle` flag** — one `openhealth.md` instead of 7 files | Tiny (1 writer) | Drop one file, not seven. Fits in a single message for chat models. Ship immediately. |
| **`openhealth.app` website with drop-zone + "Copy bundle" button** | Medium (whole web package) | Non-dev users, zero install. Single-button copy→paste into ChatGPT. |
| **Claude Projects integration** | Doc-only | Upload the bundle once into a Claude Project, reuse across convos. README instruction, no code. |
| **`--clipboard` flag** — writes bundle to system clipboard | Tiny | `openhealth ~/export.zip --clipboard` → paste anywhere. Uses `clipboardy` (Node) or `navigator.clipboard` (browser). |
| **ChatGPT Custom GPT with Action** | Punt | Requires public API + auth. Not worth the complexity for a personal tool; exclude from v1. |

**v1 set**: `--bundle`, `--clipboard`, web app with "Copy bundle" button, README docs for Claude Projects / ChatGPT-pinned-file workflows.

---

## Story / positioning (README lead)

Headline: **"Your Apple Health data, finally readable by an LLM."**

Lead (draft):

> You've been wearing an Apple Watch for years. Inside your iPhone, in a file Apple won't let you open, are six million data points about how you've slept, trained, and recovered — and not a single app lets an LLM look at it.
>
> `openhealth` is a TypeScript tool that turns your Health export into seven markdown files a chatbot can actually read. Run it on the command line, or drop the zip into your browser at `openhealth.app` — nothing leaves your device, and your phone can beam the export straight to your desktop with a QR scan.
>
> No account. No server. No telemetry. Your data, your AI coach.

Shipping pieces for the story:
- 30-second demo GIF of drag → download in the browser.
- 15-second demo of phone-QR → desktop handoff.
- A "what's in the export" explainer — show people what Apple has been collecting.
- Launch HN with title: "Show HN: openhealth — turn your Apple Health export into markdown for LLMs (client-side)."

---

## Critical files to port (authoritative list)

| TS target | Python source | LOC | Notes |
|---|---|---|---|
| `packages/core/src/types.ts` | `apple_health_gpt/types.py` | 143 | Dataclasses → interfaces. Straightforward. |
| `packages/core/src/constants.ts` | `apple_health_gpt/constants.py` | 187 | HK identifiers, source priority, HR zones. Copy values verbatim. |
| `packages/core/src/parser.ts` | `apple_health_gpt/parser.py` | 432 | Hardest. iterparse → saxes. Memory discipline critical. |
| `packages/core/src/aggregator.ts` | `apple_health_gpt/aggregator.py` | 377 | Pure transforms — easy port once types land. |
| `packages/core/src/writers/*` | `apple_health_gpt/writers.py` | 502 | Split one-per-file. Snapshot-tested. |
| `packages/cli/src/index.ts` | `apple_health_gpt/cli.py` | 66 | Add `--bundle` and `--clipboard` flags. |

---

## Verification (how we know it's done)

1. `pnpm test` is green across all packages, ≥90% coverage on core.
2. `pnpm -C packages/cli build && ./packages/cli/bin/openhealth fixtures/tiny.xml -o /tmp/out` produces 7 markdown files byte-identical to the Python tool's output against the same fixture.
3. Running the real export (`~/workspace/apple_health_export`) through both tools produces diff-clean markdown. (Acceptance check — one-time, run by hand before v1.0.0.)
4. Browser: load `openhealth.app`, drop `export.zip`, receive 7 files within 60s on a mid-range laptop. UI never freezes (Workers). DevTools memory stays under 200MB.
5. QR handoff: on desktop browser, scan QR with iPhone, upload zip from phone, receive MD files on desktop. Tested on home Wi-Fi and on hotspot.
6. `npx @openhealth/cli --help` and `brew install openhealth/tap/openhealth` both work on a clean macOS machine.

---

## Out of scope for v1

- Apple Health *import* (writing back to the export format).
- Historical backfill / diff between two exports.
- Non-Apple sources (Garmin, Whoop) — core is designed to allow them via additional parsers later.
- Multi-user support.
- Any auth, accounts, or cloud storage.
