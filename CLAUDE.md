# CLAUDE.md

The theme-neutral source-of-truth for browser-only **pub trivia** presentation decks. Originally forked from `~/Workspace/star-wars-trivia-game` (handed off from Claude Design as 4 standalone files; migrated to Vite + ES modules) and stripped of theme content.

**Cloned by `/new-pub-trivia-deck`** to produce themed sibling decks at `~/Workspace/<slug>-trivia` — don't host events from this repo directly; spin up a themed sibling instead.

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

## Two windows: display + control

The app has two views, switched by URL hash:

- `/` (or any non-`#/control` hash) → `App.jsx` (display)
- `/#/control` → `ControlApp.jsx` (editor + presenter view)

`src/main.jsx` reads `window.location.hash` and renders the appropriate root. A `hashchange` listener triggers full reload so each mode boots cleanly.

The two windows talk via `BroadcastChannel` (channel name `pub-trivia-scaffold` in the scaffold; the skill renames this to `<slug>-trivia` per cloned sibling so multiple decks can run side-by-side without messages crossing). See `src/broadcast.js`. Message types in use:

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
- `src/rounds.js` — `DEFAULT_ROUNDS` (4 rounds × 10 questions, `n: 2..5` because slot 1 is reserved for the Picture Round) + `loadRounds`/`saveRounds`/`resetRounds`. Persists to `localStorage` under `pub-trivia-scaffold.rounds`. Also exports `DEFAULT_TIEBREAKERS` (3 sudden-death prompts) + `loadTiebreakers`/`saveTiebreakers`/`resetTiebreakers` (key `pub-trivia-scaffold.tiebreakers`). `normalizeQuestion(q)` returns the object form `{ prompt, answer?, audioUrl?, imageUrl?, videoUrl?, displayHint? }`. `recapSplitsFor` is generic across question count: `<=5` → 1 chunk, `<=10` → 2 chunks, `>10` → 3 chunks. `displayRoundNumber(rN, pictureRoundShown)` shifts trivia rounds down by 1 when the picture round is hidden, so players see 1..4 instead of 2..5 with no gap.
- `src/meta.js` — game-level meta (`title` text fields, `end` text fields, `show` toggles for prize / costume / pictureRound / tiebreakers, a `pictureRound.handoutInstruction` string, and a `display` section carrying the presentation tweaks: `accent`, `showStars`, `showQNumbers`, `showTimer`, `timerSeconds`). `loadMeta`/`saveMeta`/`resetMeta` (key `pub-trivia-scaffold.meta`). `loadMeta` merges persisted state with `DEFAULT_META` (per-section spread in `withDefaults`) so adding a new field doesn't break older saves. App.jsx loads on mount + listens for `meta:update` and derives `const tweaks = meta.display` (slides still take a `tweaks` prop). ControlApp.jsx edits buffer-and-save like rounds and broadcasts on save — the **Display** card (Edit Questions tab) edits `meta.display`; the handout instruction is read by PicturesPanel for the exported PNG. App.jsx conditionally composes Prize/Costume/PictureRound/Tiebreakers slides based on `meta.show`; if you add a new toggle, also update `buildSlideOutline()` in ControlApp.jsx to match (the `display` tweaks don't affect slide composition).
- `src/pictures.js` — picture round data layer. `DEFAULT_PICTURE_ITEMS` always points to `/images/picture-NN.png` (the predictable on-disk paths). `loadPastes`/`savePastes`/`clearPastes` manage a 10-slot paste buffer in `localStorage` (`pub-trivia-scaffold.pictures`). Paste shape: `{ dataUrl, caption, position: { x, y } }` where `x`/`y` are 0-100 percentages (default 50/50 = centered, matches `object-position: center`). `loadPastes` migrates pre-crop entries forward by defaulting missing `position`. `mergeItems(pastes)` resolves what the display actually renders: pasted data URLs win over disk paths, position falls back to centered.
- `src/handout.js` — pure-canvas PNG renderer for the picture round handout. White background, dark borders, "PICTURE ROUND" title, no recap eyebrow / no FooterBar. Geometry constants (margins, gap, grid bounds, answer-area height) mirror the slide so the same image crops the same way in both surfaces. Honors `position` via the same percentage math as `object-position`. Exports `copyHandoutToClipboard`, `downloadHandoutPng`, `downloadAllImages`. No html2canvas dependency.
- The `<img>` cells in `PictureRoundRecap` use an `onError` fallback (`PictureRecapCell` in `slides.jsx`) so missing disk-path images degrade to the "PHOTO" placeholder instead of a broken-image icon. They apply `objectPosition: ${x}% ${y}%` from the merged item position.
- `PictureCell` in `ControlApp.jsx` implements drag-to-pan via pointer events: pointer-down records the starting `position`, pointer-move translates pixel deltas into objectPosition percentage deltas (inverted — drag right reveals more of the right edge of the source). A 3px movement threshold prevents accidental drags from a click. The ↺ reset button only appears when position differs from 50/50.
- `src/QuestionSlide` (in `slides.jsx`): tracks `isActive` from `slidechange` events, holds local `seconds` + `paused` state. Only the active slide responds to timer broadcasts and emits `timer:state`. All mounted question slides see the broadcasts but only the active one acts.
- Display tweaks (accent, ambient backdrop, question numbers, timer toggle/seconds) are persisted in `meta.display` and edited from the **Display** card in ControlApp's Edit Questions tab — they buffer-and-save and broadcast via `meta:update` like every other meta field. This scaffold no longer depends on Claude Design: the old `tweaks-panel.jsx`, the floating host panel, the `useTweaks` postMessage protocol, and the `/*EDITMODE-BEGIN*/.../*EDITMODE-END*/` block in App.jsx have all been removed. App derives `const tweaks = meta.display`.
- `ROUND_ACCENTS` (in `App.jsx`, near the top) is a per-round accent rotation hook. Empty map in the scaffold; themed forks fill it in to map round number `n` → ACCENTS key. The `accentFor(n, global)` helper degrades to the global accent for any round not in the map, so the scaffold runs unchanged with the empty default. Picture round (R1) + title/rules/prize/costume/end stay on the global accent regardless of `ROUND_ACCENTS`.
- `slides.jsx` is the design system: typography scale, accents, atmospheric overlays (`BackdropField`, `HalftoneOverlay`, `GrainOverlay`, `Vignette`), and slide components. Inline styles only — no CSS files. The `AccentBar` component is a glowing horizontal bar with a centered diamond ornament (theme-neutral). Themed forks routinely replace it with a theme emblem. Likewise `BackdropField` is a random-dot pattern that reads on-theme for sci-fi / winter / embers; for most other themes, increase `HalftoneOverlay` density instead. The scaffold defaults `showStars: false` so themes opt in.
- **Visual identity is a first-class theme dimension.** Themed forks should expect to swap fonts (display + body + mono), emblem (`AccentBar` → Pokeball / Eye / Saber / etc.), and per-round accent rotation in addition to palette + copy.
- **Translucent overlays use alpha-hex on PALETTE tokens** rather than literal `rgba(...)`. Patterns like `${PALETTE.paper}1F` (12%) or `${PALETTE.paper}D9` (85%) keep Vignette, picture captions, subtle borders, and step-card tints tracking palette swaps automatically.
- All slide components stay mounted with `visibility: hidden` so input/timer/video state survives navigation.

## PALETTE naming convention

`PALETTE.ink` is **the slide background color** and `PALETTE.paper` is **the primary text color** — regardless of which is light or which is dark. The scaffold has shipped both light-bg/dark-text (current) and dark-bg/light-text under the same key names. Themed forks invert the *values* but keep the *keys*; downstream styles like `slideBase` (`color: PALETTE.paper, background: PALETTE.ink`) don't change.

## Slide outline duplication

`ControlApp.jsx`'s `buildSlideOutline()` mirrors `App.jsx`'s slide composition by hand. If you add or reorder slides in `App.jsx`, update `buildSlideOutline()` to match — otherwise the slide list in the presenter view drifts out of sync with what the display actually shows.

## Anchor strings the skill replaces

`/new-pub-trivia-deck` finds and replaces the following exact strings via the Edit tool. **Don't edit these casually** — changes here will silently break the skill until SKILL.md is updated to match.

| File | Anchor (scaffold value) | Slot |
|---|---|---|
| `index.html` | `<title>Trivia Night · Fertile Ground</title>` | `<title>` |
| `src/broadcast.js` | `'pub-trivia-scaffold'` (CHANNEL_NAME) | BroadcastChannel name |
| `src/rounds.js` | `'pub-trivia-scaffold.rounds'` / `'pub-trivia-scaffold.tiebreakers'` | localStorage keys |
| `src/rounds.js` | `'pub-trivia-scaffold/questions'` | export type |
| `src/rounds.js` | `'Not a Pub Trivia Scaffold questions export'` | parseQuestionsImport error |
| `src/rounds.js` | full `DEFAULT_ROUNDS` array | round content |
| `src/rounds.js` | full `DEFAULT_TIEBREAKERS` array | tiebreaker content |
| `src/pictures.js` | `'pub-trivia-scaffold.pictures'` | localStorage key |
| `src/meta.js` | `'pub-trivia-scaffold.meta'` | localStorage key |
| `src/meta.js` `DEFAULT_META.title` | `eyebrow`, `hero`, `edition`, `hosts`, `footerDate` | title slide defaults — host can override at runtime via Edit Questions tab |
| `src/meta.js` `DEFAULT_META.end` | `hero1`, `hero2`, `subtitle` | end slide defaults — host can override at runtime |
| `src/slides.jsx` | full `PALETTE` object values (keys stay) | palette |
| `src/slides.jsx` TitleSlide | `TRIVIA NIGHT` (92px tagline, hardcoded) — the WELCOME / EDITION strings now live in `meta.js` defaults | title slide |
| `src/slides.jsx` RulesSlide | rules I–IV `d` text | rules |
| `src/slides.jsx` CostumeContestSlide | rule I–IV body copy | costume contest |
| `src/slides.jsx` PictureRoundInstructions | step 03 `d` text | picture-round instructions |
| `src/slides.jsx` `AccentBar` | optional rename + visual swap (rename hits 3 sites: definition + 2 call sites) | divider component |
| `src/slides.jsx` `BackdropField` | optional rename if a theme metaphor fits ("Snowfall", "Embers", "Dust") | atmospheric component |
| `src/slides.jsx` `ACCENTS` values | tune `hex`/`glow` per theme; keys (`accent-blue` etc.) stay verbatim | picker color tuning |
| `src/App.jsx` | Round 1 opener subtitle | picture-round flavor |
| `src/App.jsx` | `nextTitle="Warm-Up Round"` | int-r1 next-round teaser (matches Round 2 title) |
| `src/ControlApp.jsx` | `label="Accent (global)"` (Display card `Segmented`) | accent picker label |
| `src/ControlApp.jsx` | `label="Ambient backdrop"` (Display card `Toggle`) | backdrop toggle label |
| `src/meta.js` `DEFAULT_META.display` | `accent` value (default key) and `showStars` (true if theme suits a backdrop, false otherwise) — values only, keep the `accent-*` keys in sync with `ACCENTS` | runtime defaults |
| `src/ControlApp.jsx` | `'Thanks for Playing'` (fallback in `buildSlideOutline` when `meta.end.hero1`+`hero2` are blank) | end-slide outline label fallback |
| `src/ControlApp.jsx` | `\`trivia-questions-${date}.json\`` | export filename |
| `package.json` | `"pub-trivia-scaffold"` (name) | package name |
| `vite.config.js` | `base: '/pub-trivia-scaffold/'` | GitLab Pages subpath base |

The internal `ACCENTS` keys (`accent-blue`, `accent-green`, `accent-red`, `accent-gold`) are **not** theme-content anchors — they're internal preset color identifiers, not user-visible (the Display card picker label says "Accent (global)" with options "Blue / Green / Red / Gold"). Renaming the keys requires updating `ACCENTS` (in `slides.jsx`), `meta.js`'s `DEFAULT_META.display.accent`, the `ACCENTS[tweaks.accent] || ACCENTS["accent-red"]` fallback in `App.jsx`, and the `Segmented` `options` array in `ControlApp.jsx`'s Display card — keep them in sync if you do rename.

## Lint warnings

`npm run lint` exits clean (zero errors) but reports ~6 warnings in handoff design code (unused destructured props in `slides.jsx`, empty catches in `deck-stage.js`). These are intentional design-system extension points and defensive code. Don't suppress globally; address case-by-case if cleanup is desired.

## Content (scaffold defaults)

`DEFAULT_ROUNDS` ships with 4 generic rounds × 10 placeholder strings each, plus 3 placeholder tiebreakers. Slide count: ~64 (title, rules, prize, costume contest, R1 opener+instructions+intermission+recap, then for R2–R5: opener + 10 questions + intermission + recap, then tiebreaker intro + 3 tiebreaker question slides + end). Themed siblings replace question content but keep the same shape.

`QuestionSlide` accepts a `kind` prop (`"round"` default, `"tiebreaker"` for sudden death). Tiebreaker variant changes the header text from "ROUND XX · QUESTION YY · OF ZZ" to "TIEBREAKER · QUESTION YY · OF ZZ", changes the FooterBar to "Sudden Death" / "Tiebreaker YY / ZZ", and uses `data-label="TIEBREAKER YY"` so `App.jsx`'s slidechange regex (`/^(R\d+ Q\d+|TIEBREAKER \d+)/`) keeps the timer enabled on tiebreaker slides like it does on regular question slides.

## Deploy

Auto-deploys to GitLab Pages via `.gitlab-ci.yml` on every push to `main`. Subpath base is `/pub-trivia-scaffold/` (set in `vite.config.js`); image fallbacks in `src/pictures.js` use `import.meta.env.BASE_URL` so they resolve in both dev (`/`) and prod (`/pub-trivia-scaffold/`).

The repo was historically hosted at `gitlab.com/michaellambgelo/trivia-scaffold`; on the split the GitLab project was renamed to `pub-trivia-scaffold` (live URL: `https://michaellambgelo.gitlab.io/pub-trivia-scaffold/`). The `voidnet` remote was likewise renamed.

Each visitor's browser gets its own isolated `localStorage` — the `/#/control` route is intentionally ungated because writes only land in the visitor's own browser, and every fresh session loads `DEFAULT_*` content. Themed siblings cloned by `/new-pub-trivia-deck` need their own `base`, BroadcastChannel name, and `.gitlab-ci.yml`.

## What this project is NOT

- Not a runnable themed deck — `/new-pub-trivia-deck` produces those.
- Not tested (no test framework set up).
- Not using TypeScript by intent — keep it JSX.
