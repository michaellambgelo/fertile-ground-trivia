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

## Two modes: display + control

The app has two views, switched by URL hash:

- `/` (or any non-`#/control` hash) → `App.jsx` (display)
- `/#/control` → `ControlApp.jsx` (editor + presenter view)

`src/main.jsx` reads `window.location.hash` and renders the appropriate root. A `hashchange` listener triggers full reload so each mode boots cleanly.

The two windows talk via `BroadcastChannel` (channel name `star-wars-trivia`). See `src/broadcast.js` for the helper. Message types in use:

| type             | direction        | payload                                               |
|------------------|------------------|-------------------------------------------------------|
| `rounds:update`  | control → display | full rounds array                                     |
| `nav:next`       | control → display | —                                                     |
| `nav:prev`       | control → display | —                                                     |
| `nav:goto`       | control → display | slide index                                           |
| `slidechange`    | display → control | `{ index, total, label }`                             |
| `pictures:update`| control → display | full pastes array (10 items, each `{ dataUrl, caption, position: {x, y} }`) |
| `timer:toggle`   | control → display | — (toggles paused on active question slide)           |
| `timer:reset`    | control → display | — (resets to full duration)                           |
| `timer:adjust`   | control → display | delta seconds (+10, -10)                              |
| `timer:state`    | display → control | `{ enabled, seconds, paused }`                        |
| `sync:request`   | control → display | — (control just mounted; display re-emits state)      |

## Architecture notes

- `src/main.jsx` imports `./deck-stage.js` for side effect — this registers the `<deck-stage>` custom element before React mounts.
- `src/App.jsx` composes the slide list, holds a `useRef` on the `<deck-stage>`, listens for nav/content broadcasts, and forwards `slidechange` events to the control window.
- `src/ControlApp.jsx` has two tabs (Presenter, Edit Questions). Editor edits are buffered (`dirty` flag) and only push to display when the user clicks Save.
- `src/rounds.js` — `DEFAULT_ROUNDS` + `loadRounds`/`saveRounds`/`resetRounds`. Persists to `localStorage` under `star-wars-trivia.rounds`.
- `src/pictures.js` — picture round data layer. `DEFAULT_PICTURE_ITEMS` always points to `/images/picture-NN.png` (the predictable on-disk paths). `loadPastes`/`savePastes`/`clearPastes` manage a 10-slot paste buffer in `localStorage` (`star-wars-trivia.pictures`). Paste shape: `{ dataUrl, caption, position: { x, y } }` where `x`/`y` are 0-100 percentages (default 50/50 = centered, matches `object-position: center`). `loadPastes` migrates pre-crop entries forward by defaulting missing `position`. `mergeItems(pastes)` resolves what the display actually renders: pasted data URLs win over disk paths, position falls back to centered.
- `src/handout.js` — pure-canvas PNG renderer for the picture round handout. White background, dark borders, "PICTURE ROUND" title, no recap eyebrow / no FooterBar. Geometry constants (margins, gap, grid bounds, answer-area height) mirror the slide so the same image crops the same way in both surfaces. Honors `position` via the same percentage math as `object-position`. Exports `copyHandoutToClipboard`, `downloadHandoutPng`, `downloadAllImages`. No html2canvas dependency.
- The `<img>` cells in `PictureRoundRecap` use an `onError` fallback (`PictureRecapCell` in `slides.jsx`) so missing disk-path images degrade to the "PHOTO" placeholder instead of a broken-image icon. They apply `objectPosition: ${x}% ${y}%` from the merged item position.
- `PictureCell` in `ControlApp.jsx` implements drag-to-pan via pointer events: pointer-down records the starting `position`, pointer-move translates pixel deltas into objectPosition percentage deltas (inverted — drag right reveals more of the right edge of the source). A 3px movement threshold prevents accidental drags from a click. The ↺ reset button only appears when position differs from 50/50.
- `src/QuestionSlide` (in `slides.jsx`): tracks `isActive` from `slidechange` events, holds local `seconds` + `paused` state. Only the active slide responds to timer broadcasts and emits `timer:state`. All 40 mounted question slides see the broadcasts but only the active one acts.
- `TWEAK_DEFAULTS` (in `App.jsx`) is wrapped in `/*EDITMODE-BEGIN*/ ... /*EDITMODE-END*/` markers — **do not remove**. The Claude Design host tool finds and rewrites this block on disk when a user adjusts tweaks via the panel.
- `slides.jsx` is the design system: typography scale, accents, atmospheric overlays (Starfield, Halftone, Vignette), and 11 slide components. Inline styles only — no CSS files.
- `tweaks-panel.jsx` owns its own postMessage host protocol (`__activate_edit_mode`, `__deactivate_edit_mode`, `__edit_mode_set_keys`). The panel won't appear standalone — it requires a parent frame to activate it. This is **not** the same channel as the BroadcastChannel above.
- All slide components stay mounted with `visibility: hidden` so input/timer/video state survives navigation.

## Slide outline duplication

`ControlApp.jsx`'s `buildSlideOutline()` mirrors `App.jsx`'s slide composition by hand. If you add or reorder slides in `App.jsx`, update `buildSlideOutline()` to match — otherwise the slide list in the presenter view drifts out of sync with what the display actually shows.

## Lint warnings

`npm run lint` exits clean (zero errors) but reports ~9 warnings in handoff design code (unused destructured props, empty catches in deck-stage). These are intentional design-system extension points or defensive code. Don't suppress globally; address case-by-case if cleanup is desired.

## Content

`DEFAULT_ROUNDS` in `src/rounds.js` ships with placeholder strings (40 questions across 4 themed rounds). Real content can be entered through the `/#/control` editor (saved to `localStorage`) or by editing `DEFAULT_ROUNDS` directly. Total slide count: ~59 (title, rules, prize, costume contest, R1 opener, R1 instructions, intermission, then for each of rounds 2–5: opener + 10 questions + recap + (intermission unless final), then end).

## What this project is NOT

- Not deployed anywhere yet (no GitHub Pages / Firebase config).
- Not tested (no test framework set up).
- Not using TypeScript by intent — keep it JSX.
