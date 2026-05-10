---
name: new-trivia-deck
description: Scaffold a new themed trivia deck by cloning ~/Workspace/trivia-scaffold to a new ~/Workspace/<slug>-trivia sibling repo and re-skinning end-to-end with real themed content (questions, slide copy, palette). Use for any new theme (e.g. "Lord of the Rings", "90s Movies", "Marvel Cinematic Universe"). Accepts theme, questions-per-round, and rounds as positional args, or interviews for any missing.
argument-hint: [theme] [questions-per-round] [rounds]
---

Scaffold a new themed trivia deck by cloning the theme-neutral `~/Workspace/trivia-scaffold` to a new sibling repo and re-skinning every theme-leak point with **real themed content** — actual trivia questions, themed slide copy, themed palette. The engine is content-agnostic; the scaffold ships with generic "Trivia Night" copy that this skill replaces.

The result is a presentation-ready deck the user can boot with `npm run dev` and run an event with after a quick review pass.

## Prerequisite

`~/Workspace/trivia-scaffold` must exist as the theme-neutral source repo. If it doesn't, stop and tell the user — the scaffold is a one-time setup separate from this skill.

Inputs: `$ARGUMENTS` is `[theme] [questions-per-round] [rounds]`. Theme may be quoted ("Lord of the Rings"). Questions-per-round and rounds are integers. Defaults: 10 and 4.

## Steps

### 1. Resolve inputs and target path

Parse `$ARGUMENTS`. For each missing arg, ask the user:

- **theme** (no default) — free-text, e.g. "Lord of the Rings", "90s Movies".
- **questions-per-round** (default `10`) — int ≥ 1. Same value for every round.
- **rounds** (default `4`) — int ≥ 1. Numbered starting at **2** (Round 1 is the fixed picture round).

Auto-derive the target sibling path: `~/Workspace/<slug>-trivia` where `<slug>` is the theme slugified — lowercase, alphanumerics-and-hyphens, with **acronym short-forms when natural**:

| Theme | Slug |
|---|---|
| Lord of the Rings | `lotr` |
| Marvel Cinematic Universe | `mcu` |
| 90s Movies | `90s-movies` |
| Star Trek TNG | `star-trek-tng` |
| Harry Potter | `hp` (or `harry-potter` if the user prefers) |

Final path examples: `~/Workspace/lotr-trivia`, `~/Workspace/mcu-trivia`, `~/Workspace/90s-movies-trivia`.

Confirm parsed inputs and target path with the user before any destructive action. Example:

> Generating "Lord of the Rings" trivia at `~/Workspace/lotr-trivia` (4 rounds × 10 questions). Continue?

If the target path already exists, stop and ask: delete it, pick a different slug, or abort. Never overwrite without explicit confirmation.

### 2. Propose sub-themes

Propose 2–3 sub-theme sets covering varied facets (characters, geography, quotes, deep lore, etc.). Show them via `AskUserQuestion` with the recommended set first. User accepts or overrides freely.

### 3. Propose palette

Propose 2–3 palette options matching the theme's mood. Each option specifies hex values for the six `PALETTE` keys: `ink`, `inkDeep`, `paper`, `paperDim`, `rust`, `gold`. Show them via `AskUserQuestion` with previews. **Do not rename palette keys** — the scaffold references each by name.

### 4. Clone the scaffold

```bash
cp -R ~/Workspace/trivia-scaffold ~/Workspace/<slug>-trivia
cd ~/Workspace/<slug>-trivia
git remote remove origin 2>/dev/null || true
```

Carries scaffold's git history; disconnects from any remote so the new sibling doesn't accidentally push to the scaffold's origin.

### 5. Re-skin internals (no theme content)

Rename identifiers so the new sibling can run side-by-side with other decks on `localhost:5173` without `localStorage` collisions or `BroadcastChannel` cross-talk.

| File | Find | Replace |
|---|---|---|
| `package.json` | `"name": "trivia-scaffold"` | `"name": "<slug>-trivia"` |
| `src/broadcast.js` | `CHANNEL_NAME = 'trivia-scaffold'` | `'<slug>-trivia'` |
| `src/rounds.js` | `STORAGE_KEY = 'trivia-scaffold.rounds'` | `'<slug>-trivia.rounds'` |
| `src/rounds.js` | `TIEBREAKER_STORAGE_KEY = 'trivia-scaffold.tiebreakers'` | `'<slug>-trivia.tiebreakers'` |
| `src/rounds.js` | `QUESTIONS_EXPORT_TYPE = 'trivia-scaffold/questions'` | `'<slug>-trivia/questions'` |
| `src/rounds.js` | `'Not a Trivia Scaffold questions export (wrong "type").'` (in `parseQuestionsImport`) | `'Not a <Theme> Trivia questions export (wrong "type").'` |
| `src/pictures.js` | `STORAGE_KEY = 'trivia-scaffold.pictures'` | `'<slug>-trivia.pictures'` |
| `src/meta.js` | `STORAGE_KEY = 'trivia-scaffold.meta'` | `'<slug>-trivia.meta'` |
| `src/ControlApp.jsx` | `a.download = \`trivia-questions-${date}.json\`` | `\`<slug>-trivia-questions-${date}.json\`` |

### 6. Re-skin theme content

Generate real themed content for every theme-leak point. Use the Edit tool with verbatim string matches against the scaffold's anchor strings.

#### `index.html`
- `<title>Trivia Night · Fertile Ground</title>` → `<title><Theme> Trivia · Fertile Ground</title>`. Preserve the `· Fertile Ground` suffix (venue, not theme).
- Optionally update the inline CSS `background:`, `color:`, and `::selection` hex codes to match the new `PALETTE` (cosmetic — the page only flashes these for ~1 frame before React mounts).

#### `src/rounds.js`
Replace the `DEFAULT_ROUNDS` array with `<rounds>` round objects, numbered `n: 2 .. rounds + 1`. Use this shape:

```js
{
  n: <n>, title: "<SubTheme>",
  subtitle: "<one-sentence flavour for the sub-theme>",
  kicker: "<questionsPerRound> Questions",
  questions: [
    "Real trivia question 1...",
    "Real trivia question 2...",
    // ... <questionsPerRound> total
  ],
}
```

The **last** round's `kicker` is `"<questionsPerRound> Questions · Tiebreaker Material"`.

Replace `DEFAULT_TIEBREAKERS` with **3 real themed sudden-death questions** (keep `TIEBREAKER_COUNT` as-is — it's an engine constant that controls the editor UI and import validation). Lean toward "closest answer wins" / numeric / single-fact prompts — they resolve unambiguously.

The scaffold's `recapSplitsFor` already handles any question count generically — **do not touch it**.

#### `src/meta.js` — title slide text + end slide text + slide toggles
Replace values inside `DEFAULT_META.title` and `DEFAULT_META.end`. These are the title and end slide strings that the scaffold previously hardcoded in `slides.jsx`; they now live in meta and the host can re-edit them at runtime via the **Edit Questions → Title Slide / End Slide** cards in the control window.

| Field | Anchor → replacement | Example for "Lord of the Rings" |
|---|---|---|
| `title.eyebrow` | `"Presented at Fertile Ground"` | leave as-is (venue, not theme), or `"Presented in Hobbiton"` if a fitting theme venue exists |
| `title.hero` | `"WELCOME"` (68px headline) → theme welcome line | `"WELCOME TO MIDDLE-EARTH"` |
| `title.edition` | `"GENERIC EDITION"` (220px big text) → theme name | `"LORD OF THE RINGS"` (the slide's 220px font size lives in `slides.jsx` — drop it to ~180px there if the theme name is long) |
| `title.hosts` | `"Jack Smith · Michael Lamb"` | leave as-is — host names are personal, the user edits at runtime |
| `title.footerDate` | `"May 4 · 2026"` | leave as-is — event date, the user edits at runtime |
| `end.hero1` | `"THANKS FOR"` → first half of two-line sign-off | `"THE ROAD GOES"` |
| `end.hero2` | `"PLAYING."` → second half of sign-off | `"EVER ON."` |
| `end.subtitle` | `"HOSTS TALLYING SCORES · STAND BY"` | leave as-is — generic enough across themes |

`DEFAULT_META.show` (the four optional-slide toggles — `prize`, `costumeContest`, `pictureRound`, `tiebreakers`) all stay `true`. Don't disable any here — that's a per-event host decision in the Edit Questions tab.

#### `src/slides.jsx` — palette + visible copy
Replace **values** inside `PALETTE` (keys stay verbatim).

Replace the visible text in these slide components:

| Component | Scaffold anchor → replacement | Example for "Lord of the Rings" |
|---|---|---|
| `TitleSlide` | `TRIVIA NIGHT` (92px hardcoded tagline) | leave as-is for most themes, or change to a theme tagline like `"OF MIDDLE-EARTH"` if the layout still reads well |
| `RulesSlide` | rules III + IV `d` body strings | optional theme flavor (e.g. "No appeals to the White Council") |
| `CostumeContestSlide` | rules I–IV `t` titles + `d` body | "Open to All Free Folk" / "Middle-earth Canon" / "No appeals to the White Council" / "A Separate Prize" |
| `PictureRoundInstructions` | step 03 `d`: `"Write your answer in the space provided next to each numbered image."` → theme noun list | `"Write the name of the character, place, weapon, or scene next to each numbered image."` |
| Component `AccentBar` (3 sites: definition + 2 call sites in TitleSlide & IntermissionSlide) | optional rename + visual swap | rename to `Blade` for LOTR / `Wand` for HP / `Saber` for sci-fi. The scaffold default is a clean glowing bar with a centered diamond — replace the body if the theme wants different geometry. Skip rename if no clean fit. |
| `ACCENTS` values (`hex` / `glow` per key — keys `accent-blue` / `accent-green` / `accent-red` / `accent-gold` stay) | optional tune | LOTR shifted blue→Sting-icy, green→elven-leaf, red→Mordor-flame, gold→mithril-bronze. Skip if scaffold defaults already fit. |

The `WELCOME` / `GENERIC EDITION` / `THANKS FOR` / `PLAYING.` strings have moved to `meta.js` (see above) — don't search for them in `slides.jsx`.

Do **not** touch: `TYPE_SCALE`, `SPACING`, `DEFAULTS`, `ACCENTS` (the four `saber-blue` etc. preset color identifiers — internal-only, not user-visible), font imports, `Starfield`/`HalftoneOverlay`/`GrainOverlay`/`Vignette`, or any slide-component layout.

#### `src/App.jsx`
- Round 1 opener `subtitle="A page of images. Played from a paper sheet handed out by the hosts."` → theme-flavored picture-round flavor.
- `int-r1` IntermissionSlide `nextTitle="Warm-Up Round"` → match the chosen Round 2 sub-theme title (e.g. `"The Fellowship"`).
- TweakRadio `label="Accent"` → `"<Theme-noun> accent"` if a fitting noun exists (e.g. "Blade accent"); otherwise leave as `"Accent"`.
- TweakToggle `label="Ambient backdrop"` — leave the label, but consider the underlying default (see `TWEAK_DEFAULTS` below).
- `TWEAK_DEFAULTS` (inside the `/*EDITMODE-BEGIN*/ ... /*EDITMODE-END*/` markers): you may change **values** but never the keys or the markers. Two visual decisions belong here:
  - `accent`: which preset color the deck opens with. The scaffold defaults to `"accent-blue"`. If a theme has a signature accent (LOTR → mithril, HP → emerald, MCU → cardinal), change to whichever `ACCENTS` key best fits — e.g. `"accent-gold"` for LOTR, `"accent-red"` for MCU.
  - `showStars`: whether the `BackdropField` dot pattern shows by default. The scaffold defaults to `false` — themes opt in. Turn on (`true`) only when the dot pattern reads on-theme (sci-fi starfield, snowy winter deck, ember/spark deck). Leave off for fantasy, period pieces, modern themes, etc.
- Fallback `ACCENTS[tweaks.accent] || ACCENTS["accent-blue"]` — leave the fallback key as `"accent-blue"` unless you've renamed the ACCENTS keys (which you generally shouldn't).

#### `src/ControlApp.jsx` — `buildSlideOutline()`
The Title and End outline labels are now **dynamic** — they read from `meta.title.edition` and `meta.end.hero1+hero2` respectively, so updating the values in `meta.js` (above) automatically updates the labels in the presenter view. Nothing to edit here.

The fallback `'Thanks for Playing'` literal still exists in the End-label expression for the case where both `meta.end.hero1` and `hero2` are blank. Leave the fallback — the host is unlikely to clear both fields, and a sensible fallback prevents an empty `End — ` label.

The `` `Round ${r.n} · Question ${qi + 1} / ${r.questions.length}` `` template is already generic in the scaffold — leave it.

Do **not** change any `key` values. They're identifiers used by `App.jsx` and `<deck-stage>`.

#### `README.md` and `CLAUDE.md`
- Update top-line description and any "Theme" / "Content" sections to describe the new deck.
- Preserve the architecture-notes section in `CLAUDE.md` verbatim — only change the references to the channel name, storage keys, and scaffold-vs-fork lineage. Note in CLAUDE.md that the deck was "forked from `~/Workspace/trivia-scaffold` via `/new-trivia-deck`".

### 7. Clean state

Always remove inherited image and build artifacts so the new deck starts clean:

```bash
rm -f public/images/picture-*.png
rm -rf dist
```

The scaffold should not ship picture-round images, but a stale set may exist if the scaffold was recently built or run. The PHOTO placeholder in `PictureRoundRecap` shows for any cell with no image — the user pastes their own via the Picture Round tab.

### 8. Verify

```bash
npm run lint    # expect 0 errors, ~7 pre-existing warnings (handoff design code)
npm run build   # expect success
```

Report any **new** warnings or errors beyond the pre-existing handoff ones documented in the scaffold's `CLAUDE.md`.

### 9. Print TODO + dev-server suggestion

Print to the user (do not write to a file):

```
TODO — manual review:

Picture round (Round 1) — replace the 10 images:
  Open http://localhost:5173/#/control → Picture Round tab → paste/drag in
  themed images, then click Save Images to Disk to land them at
  public/images/picture-NN.png.

Question accuracy:
  <questionsPerRound × rounds> trivia questions and 3 tiebreakers were
  generated. Spot-check them via /#/control → Edit Questions before the
  event — Claude can hallucinate on niche themes.

Visual atmospherics:
  src/slides.jsx ACCENTS values were tuned for this theme; the keys
  (accent-blue / accent-green / accent-red / accent-gold) stay verbatim.
  TWEAK_DEFAULTS.accent and showStars are set per-theme — adjust via
  the floating Tweaks panel during the show if you want different
  defaults next time. AccentBar / BackdropField visuals can be swapped
  for theme-specific decorations (sword silhouette, snowflakes, embers)
  by editing src/slides.jsx directly.
```

Then suggest the spot-check:

1. `cd ~/Workspace/<slug>-trivia && npm run dev`
2. `http://localhost:5173/#/control` — confirm slide outline shows `<rounds>` rounds × `<questionsPerRound>` questions, themed title and end strings, intermission before each recap.
3. `http://localhost:5173/` — arrow into Round 2, confirm question header (`ROUND 02 · QUESTION 01 · OF <count>`), footer, and palette match expectations.
4. Browser tab title reads `<Theme> Trivia · Fertile Ground`.

## Rules

- **Always confirm parsed inputs** (theme, counts, repo path, sub-themes, palette) before any destructive action. Avoid surprise overwrites.
- **Never edit `~/Workspace/trivia-scaffold`** as part of this skill. The scaffold is the source of truth; if it needs updates, that's a separate task.
- **Slugification**: lowercase; replace non-alphanumerics with hyphens; collapse repeats; strip leading/trailing hyphens. Special-case acronyms when natural (LOTR, MCU, NBA). Always confirm the path with the user before cloning.
- **If the target path already exists**, stop and ask the user — never delete or overwrite without explicit confirmation.
- **Do not edit engine code**: `src/main.jsx`, `src/deck-stage.js`, `src/handout.js`, `src/broadcast.js` body, `src/tweaks-panel.jsx`, `src/rounds.js`'s `recapSplitsFor` / persistence helpers / `parseQuestionsImport` validation logic, and `src/meta.js`'s `loadMeta` / `saveMeta` / `resetMeta` / `withDefaults` helpers (only `DEFAULT_META` values are theme content).
- **`App.jsx`'s `TWEAK_DEFAULTS` block**: change **values** to set per-theme defaults (e.g. `accent: "accent-gold"`, `showStars: false`), but never alter the keys, the JSON shape, or the `/*EDITMODE-BEGIN*/` and `/*EDITMODE-END*/` markers. Host tooling rewrites the block based on those markers; the values inside are the theme's runtime starting state.
- **Do not change `TIEBREAKER_COUNT`** — engine constant; controls editor UI and import validation.
- **Skill operates only on the new `~/Workspace/<slug>-trivia` directory once cloned.** Do not touch other workspace projects.
- **Hallucination disclosure**: when generating real trivia questions and tiebreakers, lean on well-trodden source material. For obscure themes, prefer "closest-answer-wins" numeric prompts (years, counts) over assertion-style trivia, and remind the user to fact-check via the manual review TODO.
