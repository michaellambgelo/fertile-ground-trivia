# CLAUDE.md

Browser-only Star Wars trivia presentation deck. Originally handed off from Claude Design as 4 standalone files (CDN React + Babel + window globals); migrated to Vite + ES modules.

## Stack

- React 18 + JSX (no TypeScript) + Vite 5
- Custom `<deck-stage>` web component (vanilla JS) for slide layout, nav, scaling, print
- ESLint 9 (flat config)
- No deploy target yet

## Commands

```bash
npm run dev      # Vite dev (localhost:5173)
npm run build    # production bundle
npm run preview  # serve built bundle
npm run lint     # ESLint
```

## Architecture notes

- `src/main.jsx` imports `./deck-stage.js` for side effect — this registers the `<deck-stage>` custom element before React mounts.
- `src/App.jsx` composes the slide list and holds `ROUNDS` (content) + `TWEAK_DEFAULTS`.
- `TWEAK_DEFAULTS` is wrapped in `/*EDITMODE-BEGIN*/ ... /*EDITMODE-END*/` markers — **do not remove**. The Claude Design host tool finds and rewrites this block on disk when a user adjusts tweaks via the panel.
- `slides.jsx` is the design system: typography scale, accents, atmospheric overlays (Starfield, Halftone, Vignette), and 11 slide components. Inline styles only — no CSS files.
- `tweaks-panel.jsx` owns the postMessage host protocol (`__activate_edit_mode`, `__deactivate_edit_mode`, `__edit_mode_set_keys`). The panel won't appear standalone — it requires a parent frame to activate it.
- All slide components stay mounted with `visibility: hidden` so input/timer/video state survives navigation.

## Lint warnings

`npm run lint` exits clean (zero errors) but reports ~9 warnings in handoff design code (unused destructured props, empty catches in deck-stage). These are intentional design-system extension points or defensive code. Don't suppress globally; address case-by-case if cleanup is desired.

## Content

Trivia questions in `src/App.jsx` `ROUNDS` array are placeholder text. Real questions go there. 4 themed rounds × 10 questions = 40 question slides, plus the picture round (paper, no slides), openers, recaps, and intermissions = ~58 slides total.

## What this project is NOT

- Not deployed anywhere yet (no GitHub Pages / Firebase config).
- Not tested (no test framework set up).
- Not using TypeScript by intent — keep it JSX.
