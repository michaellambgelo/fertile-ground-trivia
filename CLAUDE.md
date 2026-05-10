# CLAUDE.md

The theme-neutral source-of-truth for browser-only trivia presentation decks. Forked from `~/Workspace/star-wars-trivia-game` (originally handed off from Claude Design as 4 standalone files; CDN React + Babel + window globals; migrated to Vite + ES modules) and stripped of theme content. **Cloned by `/new-trivia-deck` to produce themed sibling decks at `~/Workspace/<slug>-trivia`** — don't host events from this repo directly; spin up a themed sibling instead.

## Stack

- React 18 + JSX (no TypeScript) + Vite 5
- Custom `<deck-stage>` web component (vanilla JS) for slide layout, nav, scaling, print
- ESLint 9 (flat config)

## Commands

```bash
npm run dev      # Vite dev (localhost:5173) — runs the scaffold standalone with placeholder content
npm run build    # production bundle
npm run preview  # serve built bundle
npm run lint     # ESLint
```

## Two modes: display + control

The app has two views, switched by URL hash:

- `/` (or any non-`#/control` hash) → `App.jsx` (display)
- `/#/control` → `ControlApp.jsx` (editor + presenter view)

`src/main.jsx` reads `window.location.hash` and renders the appropriate root. A `hashchange` listener triggers full reload so each mode boots cleanly.

The two windows talk via `BroadcastChannel` (channel name `trivia-scaffold` in the scaffold; the skill renames this to `<slug>-trivia` per cloned sibling so multiple decks can run side-by-side without messages crossing). See `src/broadcast.js`. Message types in use:

| type             | direction        | payload                                               |
|------------------|------------------|-------------------------------------------------------|
| `rounds:update`  | control → display | full rounds array                                     |
| `nav:next`       | control → display | —                                                     |
| `nav:prev`       | control → display | —                                                     |
| `nav:goto`       | control → display | slide index                                           |
| `slidechange`    | display → control | `{ index, total, label }`                             |
| `pictures:update`| control → display | full pastes array (10 items, each `{ dataUrl, caption, position: {x, y} }`) |
| `tiebreakers:update`| control → display | array of 3 tiebreaker prompt strings |
| `meta:update`    | control → display | full meta object (`{ title, end, show }`) |
| `timer:toggle`   | control → display | — (toggles paused on active question slide)           |
| `timer:reset`    | control → display | — (resets to full duration)                           |
| `timer:adjust`   | control → display | delta seconds (+10, -10)                              |
| `timer:state`    | display → control | `{ enabled, seconds, paused }`                        |
| `sync:request`   | control → display | — (control just mounted; display re-emits state)      |

## Architecture notes

- `src/main.jsx` imports `./deck-stage.js` for side effect — this registers the `<deck-stage>` custom element before React mounts.
- `src/App.jsx` composes the slide list, holds a `useRef` on the `<deck-stage>`, listens for nav/content broadcasts, and forwards `slidechange` events to the control window. Per-question `total` is `r.questions.length` (not hardcoded), so themed siblings with different question counts work without engine changes.
- `src/ControlApp.jsx` has three tabs (Presenter, Edit Questions, Picture Round). Editor edits are buffered (`dirty` flag) and only push to display when the user clicks Save.
- `src/rounds.js` — `DEFAULT_ROUNDS` + `loadRounds`/`saveRounds`/`resetRounds`. Persists to `localStorage` under `trivia-scaffold.rounds`. Also exports `DEFAULT_TIEBREAKERS` (3 sudden-death prompts) + `loadTiebreakers`/`saveTiebreakers`/`resetTiebreakers` (key `trivia-scaffold.tiebreakers`). `recapSplitsFor` is generic across question count: `<=5` → 1 chunk, `<=10` → 2 chunks, `>10` → 3 chunks.
- `src/meta.js` — game-level meta (`title` text fields, `end` text fields, `show` toggles for prize/costume/pictureRound/tiebreakers). `loadMeta`/`saveMeta`/`resetMeta` (key `trivia-scaffold.meta`). `loadMeta` merges persisted state with `DEFAULT_META` so adding a new field doesn't break older saves. App.jsx loads on mount + listens for `meta:update`; ControlApp.jsx edits buffer-and-save like rounds and broadcasts on save. App.jsx conditionally composes Prize/Costume/PictureRound/Tiebreakers slides based on `meta.show`; if you add a new toggle, also update `buildSlideOutline()` in ControlApp.jsx to match.
- `src/pictures.js` — picture round data layer. `DEFAULT_PICTURE_ITEMS` always points to `/images/picture-NN.png` (the predictable on-disk paths). `loadPastes`/`savePastes`/`clearPastes` manage a 10-slot paste buffer in `localStorage` (`trivia-scaffold.pictures`). Paste shape: `{ dataUrl, caption, position: { x, y } }` where `x`/`y` are 0-100 percentages (default 50/50 = centered, matches `object-position: center`). `loadPastes` migrates pre-crop entries forward by defaulting missing `position`. `mergeItems(pastes)` resolves what the display actually renders: pasted data URLs win over disk paths, position falls back to centered.
- `src/handout.js` — pure-canvas PNG renderer for the picture round handout. White background, dark borders, "PICTURE ROUND" title, no recap eyebrow / no FooterBar. Geometry constants (margins, gap, grid bounds, answer-area height) mirror the slide so the same image crops the same way in both surfaces. Honors `position` via the same percentage math as `object-position`. Exports `copyHandoutToClipboard`, `downloadHandoutPng`, `downloadAllImages`. No html2canvas dependency.
- The `<img>` cells in `PictureRoundRecap` use an `onError` fallback (`PictureRecapCell` in `slides.jsx`) so missing disk-path images degrade to the "PHOTO" placeholder instead of a broken-image icon. They apply `objectPosition: ${x}% ${y}%` from the merged item position.
- `PictureCell` in `ControlApp.jsx` implements drag-to-pan via pointer events: pointer-down records the starting `position`, pointer-move translates pixel deltas into objectPosition percentage deltas (inverted — drag right reveals more of the right edge of the source). A 3px movement threshold prevents accidental drags from a click. The ↺ reset button only appears when position differs from 50/50.
- `src/QuestionSlide` (in `slides.jsx`): tracks `isActive` from `slidechange` events, holds local `seconds` + `paused` state. Only the active slide responds to timer broadcasts and emits `timer:state`. All mounted question slides see the broadcasts but only the active one acts.
- `TWEAK_DEFAULTS` (in `App.jsx`) is wrapped in `/*EDITMODE-BEGIN*/ ... /*EDITMODE-END*/` markers — **do not remove**. The Claude Design host tool finds and rewrites this block on disk when a user adjusts tweaks via the panel.
- `slides.jsx` is the design system: typography scale, accents, atmospheric overlays (`BackdropField`, `HalftoneOverlay`, `GrainOverlay`, `Vignette`), and 11 slide components. Inline styles only — no CSS files. The `AccentBar` component is a glowing horizontal bar with a centered diamond ornament (theme-neutral). Themed siblings may rename it (e.g. `Saber` for sci-fi, `Blade` for fantasy, `Wand` for magic) and override its visual — keep in sync at all 3 references (definition + 2 call sites in `TitleSlide` and `IntermissionSlide`). Likewise `BackdropField` is a deterministic dot pattern that can read as starfield / snowfall / embers / dust; the scaffold defaults `showStars: false` so themes opt in.
- `tweaks-panel.jsx` owns its own postMessage host protocol (`__activate_edit_mode`, `__deactivate_edit_mode`, `__edit_mode_set_keys`). The panel won't appear standalone — it requires a parent frame to activate it. This is **not** the same channel as the BroadcastChannel above.
- All slide components stay mounted with `visibility: hidden` so input/timer/video state survives navigation.

## Slide outline duplication

`ControlApp.jsx`'s `buildSlideOutline()` mirrors `App.jsx`'s slide composition by hand. If you add or reorder slides in `App.jsx`, update `buildSlideOutline()` to match — otherwise the slide list in the presenter view drifts out of sync with what the display actually shows.

## Anchor strings the skill replaces

`/new-trivia-deck` finds and replaces the following exact strings via the Edit tool. **Don't edit these casually** — changes here will silently break the skill until SKILL.md is updated to match.

| File | Anchor (scaffold value) | Slot |
|---|---|---|
| `index.html` | `<title>Trivia Night · Fertile Ground</title>` | `<title>` |
| `src/broadcast.js` | `'trivia-scaffold'` (CHANNEL_NAME) | BroadcastChannel name |
| `src/rounds.js` | `'trivia-scaffold.rounds'` / `'trivia-scaffold.tiebreakers'` | localStorage keys |
| `src/rounds.js` | `'trivia-scaffold/questions'` | export type |
| `src/rounds.js` | `'Not a Trivia Scaffold questions export'` | parseQuestionsImport error |
| `src/rounds.js` | full `DEFAULT_ROUNDS` array | round content |
| `src/rounds.js` | full `DEFAULT_TIEBREAKERS` array | tiebreaker content |
| `src/pictures.js` | `'trivia-scaffold.pictures'` | localStorage key |
| `src/meta.js` | `'trivia-scaffold.meta'` | localStorage key |
| `src/meta.js` `DEFAULT_META.title` | `eyebrow`, `hero` (was `WELCOME`), `edition` (was `GENERIC EDITION`), `hosts`, `footerDate` | title slide defaults — host can override at runtime via Edit Questions tab |
| `src/meta.js` `DEFAULT_META.end` | `hero1` (was `THANKS FOR`), `hero2` (was `PLAYING.`), `subtitle` | end slide defaults — host can override at runtime |
| `src/slides.jsx` | full `PALETTE` object values (keys stay) | palette |
| `src/slides.jsx` TitleSlide | `TRIVIA NIGHT` (92px tagline, hardcoded) — the WELCOME / EDITION strings now live in `meta.js` defaults | title slide |
| `src/slides.jsx` RulesSlide | rules III + IV `d` text | rules |
| `src/slides.jsx` CostumeContestSlide | rule I–IV body copy | costume contest |
| `src/slides.jsx` PictureRoundInstructions | step 03 `d` text | picture-round instructions |
| `src/slides.jsx` `AccentBar` | optional rename + visual swap (rename hits 3 sites: definition + 2 call sites) | divider component |
| `src/slides.jsx` `BackdropField` | optional rename if a theme metaphor fits ("Snowfall", "Embers", "Dust") | atmospheric component |
| `src/slides.jsx` `ACCENTS` values | tune `hex`/`glow` per theme; keys (`accent-blue` etc.) stay verbatim | picker color tuning |
| `src/App.jsx` | Round 1 opener subtitle | picture-round flavor |
| `src/App.jsx` | `nextTitle="Warm-Up Round"` | int-r1 next-round teaser (matches Round 2 title) |
| `src/App.jsx` | `label="Accent"` (in TweakRadio) | accent picker label |
| `src/App.jsx` | `label="Ambient backdrop"` (in TweakToggle) | backdrop toggle label |
| `src/App.jsx` `TWEAK_DEFAULTS` | `accent` value (default key) and `showStars` (true if theme suits a backdrop, false otherwise) — values only, do **not** alter the keys or the `EDITMODE-BEGIN/END` markers | runtime defaults |
| `src/ControlApp.jsx` | `'Thanks for Playing'` (fallback in `buildSlideOutline` when `meta.end.hero1`+`hero2` are blank) | end-slide outline label fallback |
| `src/ControlApp.jsx` | `\`trivia-questions-${date}.json\`` | export filename |
| `package.json` | `"trivia-scaffold"` (name) | package name |

The internal `ACCENTS` keys (`accent-blue`, `accent-green`, `accent-red`, `accent-gold`) are **not** theme-content anchors — they're internal preset color identifiers, not user-visible (the picker label says "Accent" with options "Blue / Green / Red / Gold"). Renaming the keys requires updating both `ACCENTS`, `App.jsx`'s `TWEAK_DEFAULTS.accent` (inside the EDITMODE block), the `ACCENTS[tweaks.accent] || ACCENTS["accent-blue"]` fallback, and the `TweakRadio` `options` array — keep them in sync if you do rename.

## Lint warnings

`npm run lint` exits clean (zero errors) but reports ~7 warnings in handoff design code (unused destructured props, empty catches in deck-stage). These are intentional design-system extension points or defensive code. Don't suppress globally; address case-by-case if cleanup is desired.

## Content (scaffold defaults)

`DEFAULT_ROUNDS` ships with 4 generic rounds × 10 placeholder strings each, plus 3 placeholder tiebreakers. Slide count: ~64 (title, rules, prize, costume contest, R1 opener+instructions+intermission+recap, then for R2–R5: opener + 10 questions + intermission + recap, then tiebreaker intro + 3 tiebreaker question slides + end). Themed siblings replace question content but keep the same shape.

`QuestionSlide` accepts a `kind` prop (`"round"` default, `"tiebreaker"` for sudden death). Tiebreaker variant changes the header text from "ROUND XX · QUESTION YY · OF ZZ" to "TIEBREAKER · QUESTION YY · OF ZZ", changes the FooterBar to "Sudden Death" / "Tiebreaker YY / ZZ", and uses `data-label="TIEBREAKER YY"` so `App.jsx`'s slidechange regex (`/^(R\d+ Q\d+|TIEBREAKER \d+)/`) keeps the timer enabled on tiebreaker slides like it does on regular question slides.

## Deploy

Auto-deploys to GitLab Pages on `gitlab.voidnet.dev` via `.gitlab-ci.yml` on every push to `main`. Subpath base is `/trivia-scaffold/` (set in `vite.config.js`); image fallbacks in `src/pictures.js` use `import.meta.env.BASE_URL` so they resolve in both dev (`/`) and prod (`/trivia-scaffold/`).

Each visitor's browser gets its own isolated `localStorage` — the `/#/control` route is intentionally ungated because writes only land in the visitor's own browser, and every fresh session loads `DEFAULT_*` content. Themed siblings cloned by `/new-trivia-deck` need their own `base`, BroadcastChannel name, and `.gitlab-ci.yml` (the skill should mirror this pattern when next updated).

## What this project is NOT

- Not a runnable themed deck — `/new-trivia-deck` produces those.
- Not tested (no test framework set up).
- Not using TypeScript by intent — keep it JSX.
