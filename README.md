# Trivia Scaffold

The theme-neutral source-of-truth for browser-only trivia presentation decks. **You probably don't run trivia events from this repo directly** — instead, run `/new-trivia-deck` to clone this scaffold to a `~/Workspace/<slug>-trivia` sibling and re-skin it with theme content (real questions, themed slide copy, theme palette).

The scaffold is runnable on its own (with placeholder questions and a "GENERIC EDITION" title slide) — useful for testing engine changes without a theme in the way.

## Run standalone

```bash
npm install
npm run dev      # localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve dist/ for verification
npm run lint     # ESLint
```

Open `http://localhost:5173/` for the display, `http://localhost:5173/#/control` for the editor + presenter.

## How themed decks are produced

`/new-trivia-deck "Lord of the Rings"` (or any theme + arg combination) does roughly this:

1. `cp -R ~/Workspace/trivia-scaffold ~/Workspace/lotr-trivia` (sibling at `<slug>-trivia`)
2. Disconnects the new sibling's git remote.
3. Renames `package.json` name, `BroadcastChannel` name (`trivia-scaffold` → `<slug>-trivia`), and `localStorage` keys (`trivia-scaffold.rounds` → `<slug>-trivia.rounds`, etc.) so siblings can run side-by-side without state collisions.
4. Replaces theme-leak strings in `index.html`, `src/rounds.js` (`DEFAULT_ROUNDS` + `DEFAULT_TIEBREAKERS`), `src/slides.jsx` (`PALETTE`, `TitleSlide`, `EndSlide`, `RulesSlide`, `CostumeContestSlide`, `PictureRoundInstructions`), `src/App.jsx` (`int-r1` `nextTitle`, Round 1 opener subtitle), `src/ControlApp.jsx` (`buildSlideOutline` labels), and the README/CLAUDE docs.
5. Removes `public/images/picture-*.png` so the picture round starts blank.
6. Verifies via `npm run lint` and `npm run build`.

The skill source lives at `~/.claude/skills/new-trivia-deck/SKILL.md`.

## Two windows: display + control

Open two browser windows on the same origin:

- **Display** — `http://localhost:5173/` — full-screen on the projector / TV.
- **Control** — `http://localhost:5173/#/control` — on your laptop. Has the question editor and presenter view.

The two windows talk to each other live via `BroadcastChannel` (built-in browser API, no server). Edits in the control window push to the display instantly. Navigation in the control window drives the display.

### Picture Round workflow

1. In the control window, switch to the **Picture Round** tab.
2. Click a cell, ⌘V (Mac) / Ctrl+V to paste an image from your clipboard. (Drag-drop a file works too.) Pastes go into `localStorage` so the display picks them up immediately.
3. **Crop / re-frame** — once an image is in a cell, drag it to pan the visible crop. The ↺ button resets the crop to centered.
4. **Copy Handout to Clipboard** — copies a print-friendly 1920×1080 PNG (white background, dark borders, "PICTURE ROUND" title, no recap eyebrow). Paste into Word / Pages / email.
5. **Download Handout PNG** — same image as a file.
6. **Save Images to Disk** — downloads each pasted image with predictable names (`picture-01.png` … `picture-10.png`). Drop them into `public/images/` so the display can serve them statically and you can clear the localStorage paste buffer.

### Display controls (fallback)

- **← / →**, **Space**, **PgUp / PgDn** — navigate slides
- **Home / End** — first / last slide
- **Number keys 1–9** — jump to slide N
- **R** — reset to slide 0
- **Click left / right third** — back / forward
- **Browser Print → Save as PDF** — exports one slide per page at 1920×1080

## Structure

```
src/
├── main.jsx            entry — picks display vs control by URL hash
├── App.jsx             display: slide composition + broadcast wiring
├── ControlApp.jsx      control: presenter / editor / picture round tabs
├── rounds.js           DEFAULT_ROUNDS + localStorage persistence + recapSplitsFor
├── pictures.js         picture round data + paste buffer
├── handout.js          canvas-based PNG renderer for picture round handout
├── broadcast.js        BroadcastChannel helper + useBroadcast hook
├── deck-stage.js       custom element (vanilla JS)
├── slides.jsx          12 slide components + design system
└── tweaks-panel.jsx    floating tweaks panel + useTweaks hook
```

## Tweaks panel

The floating tweaks panel (bottom-right of the display window) is hidden by default. It activates when a parent window posts `__activate_edit_mode` — this is how the Claude Design host tool wires it up. Standalone, the panel won't appear unless that protocol fires.

## History

Forked from `~/Workspace/star-wars-trivia-game`, theme-neutralized to serve as the source-of-truth for `/new-trivia-deck`. The Star Wars deck is preserved in its original location as a runnable artifact.
