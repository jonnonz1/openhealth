# 002 — Design System

- **Status:** Active
- **Created:** 2026-04-13
- **Owner:** John

## Context

The web app needs a consistent visual identity that reinforces the product's core promise — calm, trustworthy, privacy-respecting. The structural approach is adapted from the miki.nz design system (tokens, sentence case, mono for data) but the palette is swapped to a natural sage-green that reads "health" and "organic" rather than techy or medical.

## Palette

Source: [colorhunt.co/palette/edf1d69dc08b60996640513b](https://colorhunt.co/palette/edf1d69dc08b60996640513b)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#EDF1D6` | Page background |
| `--bg-soft` | `#DCE6C4` | Soft panels, callouts (derived) |
| `--accent` | `#9DC08B` | Highlights, step numbers, soft borders |
| `--primary` | `#609966` | Primary CTAs, links |
| `--primary-hover` | `#4F8055` | Primary hover (derived) |
| `--ink-strong` | `#40513B` | Headings, emphasis, footer bg |
| `--ink` | `#4A5A42` | Body text (derived) |
| `--ink-muted` | `#6B7A61` | Secondary / meta text (derived) |
| `--surface` | `#FFFFFF` | Explicit white panels |
| `--border` | `rgba(64, 81, 59, 0.15)` | Default borders |
| `--border-strong` | `rgba(64, 81, 59, 0.30)` | Emphasised borders, inputs, dropzone |

All tokens live as CSS custom properties on `:root` in `packages/web/src/styles.css`. New colours must be added as named tokens before use.

## Typography

- **Sans:** Inter — 400 / 500 / 600 / 700 (loaded via Google Fonts).
- **Mono:** JetBrains Mono — 500 / 600 (data, filenames, measurements).
- **Sentence case** for all headings; never all-caps except for micro-labels (0.08em letter-spacing).
- H1 once per page; H2s phrased as questions where they answer a user's question (AEO win).
- Numbers, filenames, timestamps in mono.

## Component principles

- **Panel** — white surface, 12px radius, 1px `--border`, faint shadow. Default container.
- **Callout** — `--bg-soft` background, 4px `--primary` left border. Used for the privacy reassurance.
- **Dropzone** — 2px dashed `--border-strong` → `--primary` on hover; background shifts to `--bg-soft`.
- **Step list** — 2rem accent-filled circle with number, inline with copy.
- **Buttons** (future) — primary: `--ink-strong` bg, `--bg` text; soft: `--accent` bg, `--ink-strong` text.
- **Transitions** — 150ms ease-out on colour/background only. No scale, no shadow shifts. `prefers-reduced-motion` respected.

## Accessibility

- Body copy on `--bg` uses `--ink` / `--ink-strong` — contrast passes WCAG 2.2 AA.
- `--ink-muted` reserved for non-essential metadata only.
- Focus ring: 2px `--primary` with 2px offset.
- Colour never the sole carrier of meaning; always paired with text or icon.

## Verification

- Visual smoke: `pnpm -C packages/web dev` → desktop + mobile viewports look balanced, header/footer anchored, dropzone readable, steps legible.
- Contrast: run page through a WCAG checker before v1.0.0.
- Reduced motion: toggle OS setting and confirm no animations fire.
