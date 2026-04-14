# 002 — Design System

- **Status:** Active
- **Created:** 2026-04-13
- **Owner:** John

## Context

The web app needs a consistent visual identity that reinforces the product's core promise — calm, trustworthy, privacy-respecting. The structural approach is adapted from the miki.nz design system (tokens, sentence case, mono for data) but the palette uses a clean aqua/teal family that reads "fresh", "water" and "wellness" without tipping into medical clinical.

## Palette

Source: [colorhunt.co/palette/e3fdfdcbf1f5a6e3e971c9ce](https://colorhunt.co/palette/e3fdfdcbf1f5a6e3e971c9ce)

The four source swatches ladder light → deeper for page/panel/accent layers. `--primary` is derived by darkening the deepest swatch in HSL space so CTAs pass WCAG AA contrast with white text. `--ink` values share the hue but are heavily desaturated for text hierarchy.

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#E3FDFD` | Page background |
| `--bg-soft` | `#CBF1F5` | Soft panels, callouts |
| `--accent` | `#A6E3E9` | Highlights, soft borders, highlighter-style emphasis |
| `--accent-strong` | `#71C9CE` | Guide phone bezel, secondary accents |
| `--primary` | `#1A737A` | Primary CTAs, links, step badges, privacy banner (derived, passes WCAG AA on both `--bg` and `--surface`) |
| `--primary-hover` | `#125A61` | Primary hover (derived) |
| `--ink-strong` | `#0E2F32` | Headings, emphasis, footer bg (derived) |
| `--ink` | `#1F4447` | Body text (derived) |
| `--ink-muted` | `#557173` | Secondary / meta text (derived) |
| `--surface` | `#FFFFFF` | Explicit white panels |
| `--border` | `rgba(14, 47, 50, 0.12)` | Default borders |
| `--border-strong` | `rgba(14, 47, 50, 0.26)` | Emphasised borders, inputs, dropzone |

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
