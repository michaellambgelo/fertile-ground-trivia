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
| `teams:update`   | either → other   | `{ a: { name, score }, b: { name, score } }` (barstool mode only) |
| `game:reset`     | control → display | — (clears session team state; broadcaster also `nav:goto 0`) |
| `score:awarded`  | control → display | `{ team: 'a' \| 'b', delta }` (positive deltas only; triggers bell SFX) |

## Architecture notes

- `src/main.jsx` imports `./deck-stage.js` for side effect — this registers the `<deck-stage>` custom element before React mounts.
- `src/App.jsx` composes the slide list, holds a `useRef` on the `<deck-stage>`, listens for nav/content broadcasts, and forwards `slidechange` events to the control window. Per-question `total` is `r.questions.length` (not hardcoded), so themed siblings with different question counts work without engine changes.
- `src/ControlApp.jsx` has three tabs (Presenter, Edit Questions, Picture Round). Editor edits are buffered (`dirty` flag) and only push to display when the user clicks Save.
- `src/rounds.js` — `DEFAULT_ROUNDS` (pub: 4 rounds × 10) + `DEFAULT_BARSTOOL_ROUNDS` (12 rounds × 2) + `loadRounds`/`saveRounds`/`resetRounds`. Persists to `localStorage` under `trivia-scaffold.rounds`. Also exports `DEFAULT_TIEBREAKERS` (3 sudden-death prompts) + `loadTiebreakers`/`saveTiebreakers`/`resetTiebreakers` (key `trivia-scaffold.tiebreakers`). `normalizeQuestion(q)` returns the object form `{ prompt, answer?, audioUrl?, imageUrl?, videoUrl?, displayHint? }` — questions are stored as plain strings when only `prompt` is set, and as objects when any media or answer field is filled. `recapSplitsFor` is generic across question count: `<=5` → 1 chunk, `<=10` → 2 chunks, `>10` → 3 chunks.
- `src/meta.js` — game-level meta (`mode` ('pub' | 'barstool'), `title` text fields, `end` text fields, `show` toggles for prize/costume/pictureRound/tiebreakers, `teams` default names). `loadMeta`/`saveMeta`/`resetMeta` (key `trivia-scaffold.meta`). `loadMeta` merges persisted state with `DEFAULT_META` so adding a new field doesn't break older saves. App.jsx loads on mount + listens for `meta:update`; ControlApp.jsx edits buffer-and-save like rounds and broadcasts on save. App.jsx conditionally composes Prize/Costume/PictureRound/Tiebreakers slides based on `meta.show`; if you add a new toggle, also update `buildSlideOutline()` in ControlApp.jsx to match.
- `src/teams.js` — session-only team state for barstool mode. `makeTeams(meta)` returns `{ a: { name, score: 0 }, b: { name, score: 0 } }` with names sourced from `meta.teams`. No localStorage by design — scores reset on display refresh. Held in `App.jsx` + `ControlApp.jsx` React state, synced via `teams:update` broadcasts.
- `src/bell.js` — Price-is-Right-style bell SFX synthesized with Web Audio API (no external audio file). Plays on `score:awarded` broadcasts in barstool mode. `unlockAudio()` is called from a one-shot user-gesture listener in `App.jsx` to satisfy browser autoplay policies; after that, `playBell()` can be triggered by broadcasts. Inharmonic sine partials (1047 / 1568 / 2093 / 3136 / 4186 Hz) with sharp attack + exponential decay give the classic "ding".
- `src/pictures.js` — picture round data layer. `DEFAULT_PICTURE_ITEMS` always points to `/images/picture-NN.png` (the predictable on-disk paths). `loadPastes`/`savePastes`/`clearPastes` manage a 10-slot paste buffer in `localStorage` (`trivia-scaffold.pictures`). Paste shape: `{ dataUrl, caption, position: { x, y } }` where `x`/`y` are 0-100 percentages (default 50/50 = centered, matches `object-position: center`). `loadPastes` migrates pre-crop entries forward by defaulting missing `position`. `mergeItems(pastes)` resolves what the display actually renders: pasted data URLs win over disk paths, position falls back to centered.
- `src/handout.js` — pure-canvas PNG renderer for the picture round handout. White background, dark borders, "PICTURE ROUND" title, no recap eyebrow / no FooterBar. Geometry constants (margins, gap, grid bounds, answer-area height) mirror the slide so the same image crops the same way in both surfaces. Honors `position` via the same percentage math as `object-position`. Exports `copyHandoutToClipboard`, `downloadHandoutPng`, `downloadAllImages`. No html2canvas dependency.
- The `<img>` cells in `PictureRoundRecap` use an `onError` fallback (`PictureRecapCell` in `slides.jsx`) so missing disk-path images degrade to the "PHOTO" placeholder instead of a broken-image icon. They apply `objectPosition: ${x}% ${y}%` from the merged item position.
- `PictureCell` in `ControlApp.jsx` implements drag-to-pan via pointer events: pointer-down records the starting `position`, pointer-move translates pixel deltas into objectPosition percentage deltas (inverted — drag right reveals more of the right edge of the source). A 3px movement threshold prevents accidental drags from a click. The ↺ reset button only appears when position differs from 50/50.
- `src/QuestionSlide` (in `slides.jsx`): tracks `isActive` from `slidechange` events, holds local `seconds` + `paused` state. Only the active slide responds to timer broadcasts and emits `timer:state`. All mounted question slides see the broadcasts but only the active one acts.
- `TWEAK_DEFAULTS` (in `App.jsx`) is wrapped in `/*EDITMODE-BEGIN*/ ... /*EDITMODE-END*/` markers — **do not remove**. The Claude Design host tool finds and rewrites this block on disk when a user adjusts tweaks via the panel.
- `ROUND_ACCENTS` (in `App.jsx`, below `TWEAK_DEFAULTS`) is a per-round accent rotation hook. Empty map in the scaffold; themed forks fill it in to map round number `n` → ACCENTS key (Pokemon types, LOTR houses, MCU phases, decade colors, etc.). The `accentFor(n, global)` helper degrades to the global accent for any round not in the map, so the scaffold runs unchanged with the empty default. Threading: `RoundOpener` / `QuestionSlide` / `RoundRecap` for round `n` use `accentFor(r.n, accent)`; `IntermissionSlide` previews the NEXT round's color via `accentFor(next.n, accent)`. Picture round (R1) + title/rules/prize/costume/end stay on the global accent regardless of `ROUND_ACCENTS`.
- `slides.jsx` is the design system: typography scale, accents, atmospheric overlays (`BackdropField`, `HalftoneOverlay`, `GrainOverlay`, `Vignette`), and 11 slide components. Inline styles only — no CSS files. The `AccentBar` component is a glowing horizontal bar with a centered diamond ornament (theme-neutral). Themed forks routinely replace it with a theme emblem (Pokeball for Pokemon, Eye of Sauron for LOTR, Saber for sci-fi). Likewise `BackdropField` is a random-dot pattern that reads on-theme for sci-fi / winter / embers; for most other themes, increase `HalftoneOverlay` density instead (it gives a "printed comic" texture that fits broader themes — fantasy, retro, pop-art). The scaffold defaults `showStars: false` so themes opt in.
- **Visual identity is a first-class theme dimension.** Themed forks should expect to swap fonts (display + body + mono), emblem (`AccentBar` → Pokeball / Eye / Saber / etc.), and per-round accent rotation in addition to palette + copy. The scaffold's default font pairing (Oswald + Inter) and glowing-diamond AccentBar are intentionally neutral; treating any of these as "optional polish" produces a generic-feeling deck.
- **Translucent overlays use alpha-hex on PALETTE tokens** rather than literal `rgba(...)`. Patterns like `${PALETTE.paper}1F` (12%) or `${PALETTE.paper}D9` (85%) keep Vignette, picture captions, subtle borders, and step-card tints tracking palette swaps automatically. If you add new translucency, prefer this pattern over `rgba(r, g, b, a)` so themed forks don't have to hunt down hardcoded colors.
- `tweaks-panel.jsx` owns its own postMessage host protocol (`__activate_edit_mode`, `__deactivate_edit_mode`, `__edit_mode_set_keys`). The panel won't appear standalone — it requires a parent frame to activate it. This is **not** the same channel as the BroadcastChannel above.
- All slide components stay mounted with `visibility: hidden` so input/timer/video state survives navigation.

## PALETTE naming convention

`PALETTE.ink` is **the slide background color** and `PALETTE.paper` is **the primary text color** — regardless of which is light or which is dark. The scaffold has shipped both light-bg/dark-text (current) and dark-bg/light-text (original) under the same key names. Themed forks invert the *values* but keep the *keys*; downstream styles like `slideBase` (`color: PALETTE.paper, background: PALETTE.ink`) don't change.

This convention is non-obvious from the names alone — if you grep `PALETTE.paper` looking for "the paper-colored thing," you'll be confused. The doc comment above the PALETTE definition in `slides.jsx` reiterates this; keep it there.

## Slide outline duplication

`ControlApp.jsx`'s `buildSlideOutline()` mirrors `App.jsx`'s slide composition by hand. If you add or reorder slides in `App.jsx`, update `buildSlideOutline()` to match — otherwise the slide list in the presenter view drifts out of sync with what the display actually shows.

## Barstool mode

A second game format selected by `meta.mode = 'barstool'`. Two teams play head-to-head: each question is assigned to one team, and on a miss the other team gets one shot at the full point. 12 rounds × 2 questions = 24 questions. Pub mode (the default) is unchanged.

What barstool mode does differently:

- **First slide is `BarstoolSetupSlide`** (in `slides.jsx`) — two team-name inputs + a "Start Game" button. Inputs are controlled, broadcast `teams:update` on every keystroke; the button broadcasts `nav:next`.
- **Persistent scoreboard banner** rendered by `<BarstoolHud />` (in `slides.jsx`) inside every slide via the `<CornerMarks />` injection point. Reads `BarstoolContext` and returns `null` in pub mode, so adding it to slides is a no-op for pub-trivia decks. Sits inside each slide's natural top padding (height 88 ≤ SPACING.paddingTop 100); no slide layouts shift.
- **`BarstoolContext`** (React Context exported from `slides.jsx`) carries `{ mode, teams }`. `App.jsx` wraps the deck in a `<BarstoolContext.Provider>`; `RulesSlide` and `EndSlide` consume it to switch body copy / final scoreboard.
- **Intermissions + recaps are skipped** in barstool mode (12 of each would overwhelm 24 questions). Pub mode keeps both. Tiebreakers stay toggleable via `meta.show.tiebreakers`.
- **Question media slots** — `audioUrl` / `imageUrl` / `videoUrl` / `displayHint` are rendered in `QuestionSlide` when present. Lets one slide component cover all round types (audio clip, image identification, scramble with on-screen hint, etc.) without per-type components. `answer` is also a normalized field but rendered ONLY on the control window's `ScoringCard` for host adjudication — never on the display.
- **Scoring + turn tracking lives in the control window.** `ControlApp.jsx`'s `ScoringCard` (Presenter tab, barstool-only) shows team name fields, ±1 buttons per team, a host-only answer reveal, and Reset Scores / New Game buttons. Turn indicator is derived from the active slide's `data-label`: Q01 → Team A, Q02 → Team B.
- **Team state is session-only.** No localStorage; refreshing the display loses scores by design ("score only has to live as long as the game"). A warning chip on the setup slide says so.
- **End slide** swaps to `BarstoolEndSlide` (a final scoreboard with a winner badge) when `mode === 'barstool'`.

Mode-aware slides today: `RulesSlide`, `QuestionSlide` (via media props), `EndSlide`. Adding new mode-aware slides: read `useContext(BarstoolContext)` and branch on `mode`. Adding new persistent-on-every-slide UI (e.g. a timer banner): mirror the `<BarstoolHud />` pattern — add a sibling-of-`<CornerMarks />` component that reads context and returns `null` in pub mode.

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
| `src/meta.js` `DEFAULT_META.mode` | `'pub'` (default). Themed siblings shipping in barstool format should set `'barstool'` AND swap `DEFAULT_ROUNDS` with `DEFAULT_BARSTOOL_ROUNDS` content | game format |
| `src/meta.js` `DEFAULT_META.teams` | `'Team 1'` / `'Team 2'` — themed siblings can ship in-theme defaults (e.g. `'House Atreides'` / `'House Harkonnen'`) | barstool team-name defaults |
| `src/rounds.js` | full `DEFAULT_BARSTOOL_ROUNDS` array (12 rounds × 2 questions) | barstool round content (only when shipping a barstool-mode theme) |
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

`npm run lint` exits clean (zero errors) but reports ~8 warnings in handoff design code (unused destructured props, empty catches in deck-stage, one `react-refresh/only-export-components` from `slides.jsx` exporting `BarstoolContext` alongside components). These are intentional design-system extension points, defensive code, or co-located context. Don't suppress globally; address case-by-case if cleanup is desired.

## Content (scaffold defaults)

`DEFAULT_ROUNDS` ships with 4 generic rounds × 10 placeholder strings each, plus 3 placeholder tiebreakers. Pub-mode slide count: ~64 (title, rules, prize, costume contest, R1 opener+instructions+intermission+recap, then for R2–R5: opener + 10 questions + intermission + recap, then tiebreaker intro + 3 tiebreaker question slides + end). Themed siblings replace question content but keep the same shape.

`DEFAULT_BARSTOOL_ROUNDS` ships with 12 rounds × 2 placeholder strings each (24 questions total). Barstool-mode slide count: ~42 (setup, title, rules, prize, costume contest, optional picture-round cluster, then 12× (opener + 2 questions), end, optional tiebreakers — no intermissions/recaps). Both round shapes ship in the scaffold; `meta.mode` chooses which.

`QuestionSlide` accepts a `kind` prop (`"round"` default, `"tiebreaker"` for sudden death). Tiebreaker variant changes the header text from "ROUND XX · QUESTION YY · OF ZZ" to "TIEBREAKER · QUESTION YY · OF ZZ", changes the FooterBar to "Sudden Death" / "Tiebreaker YY / ZZ", and uses `data-label="TIEBREAKER YY"` so `App.jsx`'s slidechange regex (`/^(R\d+ Q\d+|TIEBREAKER \d+)/`) keeps the timer enabled on tiebreaker slides like it does on regular question slides.

## Deploy

Auto-deploys to GitLab Pages via `.gitlab-ci.yml` on every push to `main`. Canonical home is `gitlab.com/michaellambgelo/trivia-scaffold`; live URL: `https://michaellambgelo.gitlab.io/trivia-scaffold/`. (A secondary `voidnet` remote at `gitlab.voidnet.dev/michaellamb-dev/trivia-scaffold` is kept for archival; pushes do not auto-mirror.) Subpath base is `/trivia-scaffold/` (set in `vite.config.js`); image fallbacks in `src/pictures.js` use `import.meta.env.BASE_URL` so they resolve in both dev (`/`) and prod (`/trivia-scaffold/`).

Each visitor's browser gets its own isolated `localStorage` — the `/#/control` route is intentionally ungated because writes only land in the visitor's own browser, and every fresh session loads `DEFAULT_*` content. Themed siblings cloned by `/new-trivia-deck` need their own `base`, BroadcastChannel name, and `.gitlab-ci.yml` (the skill should mirror this pattern when next updated).

## What this project is NOT

- Not a runnable themed deck — `/new-trivia-deck` produces those.
- Not tested (no test framework set up).
- Not using TypeScript by intent — keep it JSX.
