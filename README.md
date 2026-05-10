# Trivia Scaffold

The theme-neutral source-of-truth for browser-only trivia presentation decks. **You probably don't run trivia events from this repo directly** — instead, run the [`/new-trivia-deck`](./.claude/skills/new-trivia-deck/SKILL.md) Claude Code skill to clone this scaffold into a `~/Workspace/<slug>-trivia` sibling repo and re-skin it with theme content (real questions, themed slide copy, theme palette).

The scaffold is fully runnable on its own with placeholder questions and a "GENERIC EDITION" title slide — useful for poking at the engine without a theme in the way, or just trying the format.

## Live demo

[**michaellambgelo.gitlab.io/trivia-scaffold**](https://michaellambgelo.gitlab.io/trivia-scaffold/)

Each visitor gets a fully private session — every browser stores its own rounds, picture pastes, and game meta in `localStorage`, so editing the demo doesn't affect anyone else. New sessions always boot from the placeholder defaults.

## Quick start

```bash
npm install
npm run dev      # localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve dist/ for verification
npm run lint     # ESLint
```

The deck has **two URLs** that you open in two separate browser windows on the same origin:

| URL | Mode | Where to open it |
|---|---|---|
| `http://localhost:5173/` | **Display** | The TV / projector / external screen the room watches |
| `http://localhost:5173/#/control` | **Control** | Your laptop screen — editor + presenter view |

The two windows talk live via `BroadcastChannel` (a built-in browser API; no server). Edits in the control window push to the display instantly; navigating in control drives the display.

## Presentation mode (the display window)

The display is a single-slide-at-a-time deck rendered at a fixed 1920×1080 stage. The custom `<deck-stage>` element auto-scales the stage to fit whatever window or external display you put it in, so you don't have to fiddle with browser zoom on the projector.

A typical event flows through this slide order:

1. **Title** — venue, edition, hosts, date.
2. **Rules** — five rules, theme-neutral by default.
3. **Prize** *(optional)*, **Costume Contest** *(optional)* — toggleable from Edit Questions.
4. **Round 1 (Picture Round)** — opener → instructions → intermission → recap. Always image-based; the host hands out a paper sheet generated from the Picture Round tab.
5. **Rounds 2–5** *(or however many you configure)* — each round is opener → 10 questions → intermission → recap. Question slides have a per-question countdown timer in the corner.
6. **Tiebreakers** *(optional)* — sudden-death intro + 3 tiebreaker questions for breaking ties.
7. **End** — sign-off slide while hosts tally scores.

Anything from #3 onward (prize / costume / picture round / tiebreakers) can be hidden per-event from the control window's **Edit Questions → Title Slide** card so a single deck handles "full event" and "casual game night" formats without code changes.

### Display keyboard shortcuts

If you want to drive the deck directly from the display window (no control window connected), all of these work:

- **← / →**, **Space**, **PgUp / PgDn** — previous / next slide
- **Home / End** — first / last slide
- **Number keys 1–9** — jump to slide N (10s of slides need the control window)
- **R** — reset to slide 0
- **Click left/right third of the screen** — back / forward (handy from a phone)
- **Browser Print → Save as PDF** — exports one slide per page at 1920×1080

Most events drive navigation from the control window instead, so the host can see "what's next" before the room does.

## Control mode (your laptop screen)

The control window is one tab with three tabs of its own:

### 1. Presenter tab
A live outline of every slide in the deck with the active slide highlighted. Click any row to jump the display straight to that slide. The currently-active question slide also surfaces a **timer panel**: Start/Pause, Reset, ±10s — the timer state is broadcast to the display, so the room sees the seconds ticking down on the slide while you control it from your laptop.

### 2. Edit Questions tab
Two cards at the top edit the **Title Slide** and **End Slide** strings (eyebrow, hero text, edition, hosts, date, sign-off). Below that, expandable cards per round let you edit each question. Edits are buffered locally — a "Save" button on each card pushes them to the display (and persists to `localStorage`), and a "Discard" reverts. There's also CSV/JSON import/export for bulk question editing in a spreadsheet.

The same card has the four **slide-toggle switches** that hide/show Prize, Costume Contest, Picture Round, and Tiebreakers in the deck.

### 3. Picture Round tab
The picture round (Round 1) needs ten themed images. The workflow:

1. Click a numbered cell, then **⌘V (Mac) / Ctrl+V** to paste an image from your clipboard. Drag-and-drop a file onto the cell also works. Pastes save to `localStorage` immediately, so the display updates live.
2. **Crop / re-frame** — once an image is in a cell, drag it to pan the visible crop. The ↺ button next to a cell resets the crop to centered.
3. **Copy Handout to Clipboard** — copies a 1920×1080 print-friendly PNG (white background, dark borders, "PICTURE ROUND" title) for pasting into Word / Pages / email so the room can play with paper sheets.
4. **Download Handout PNG** — same image as a file.
5. **Save Images to Disk** — downloads each pasted image with predictable names (`picture-01.png` … `picture-10.png`). Drop them into `public/images/` so the display serves them statically and you can clear the localStorage paste buffer.

## Casting the display to a TV / projector

The display is a normal web page, so **any** mechanism that gets a browser tab onto a second screen works. From least to most fiddly:

1. **HDMI cable / dock** *(most reliable)* — plug your laptop into the TV/projector, set the display to **extend** (not mirror), drag the display browser window onto the external screen, and press **F11** (or **⌃⌘F** on macOS) to fullscreen it. The control window stays on your laptop screen. The deck auto-scales to whatever resolution the external display reports.
2. **AirPlay / Apple TV** *(macOS)* — System Settings → Displays → choose your Apple TV / AirPlay-compatible TV from the "Add Display" menu. Same drag-then-fullscreen as HDMI.
3. **Chromecast / Cast-enabled TV** *(Chrome / Edge)* — open the display URL in Chrome, click the three-dot menu → **Cast…** → pick "Sources: Cast tab" and select your Chromecast. The control window can stay on your laptop in a different tab; only the cast tab streams. Note: tab casting can drop frames during heavy timer animation; HDMI is steadier for long events.
4. **Miracast / Wireless Display** *(Windows)* — Win+K → connect to your wireless display, then drag the display window onto it as in #1.
5. **OBS Browser Source** *(streaming)* — point an OBS Browser Source at the display URL at 1920×1080. Use the control window on a second monitor or the same machine. This is also a fine path if you want to record the deck.

Tip: open both URLs **before** going fullscreen on the display. Once the display is fullscreen on the external screen, the control window stays interactive on the laptop with no further fiddling.

## How themed decks are produced

The full skill source lives in this repo at [`.claude/skills/new-trivia-deck/SKILL.md`](./.claude/skills/new-trivia-deck/SKILL.md). The short version: `/new-trivia-deck "Lord of the Rings"` clones the scaffold to `~/Workspace/lotr-trivia`, swaps every theme-leak point (palette, slide copy, BroadcastChannel name, localStorage keys, package name), and re-fills `DEFAULT_ROUNDS` with real themed trivia questions. The result is a presentation-ready sibling deck after a quick review pass.

## Structure

```
src/
├── main.jsx            entry — picks display vs control by URL hash
├── App.jsx             display: slide composition + broadcast wiring
├── ControlApp.jsx      control: presenter / editor / picture round tabs
├── rounds.js           DEFAULT_ROUNDS + localStorage persistence + recapSplitsFor
├── meta.js             title/end slide text + slide visibility toggles
├── pictures.js         picture round data + paste buffer
├── handout.js          canvas-based PNG renderer for picture round handout
├── broadcast.js        BroadcastChannel helper + useBroadcast hook
├── deck-stage.js       custom element (vanilla JS)
├── slides.jsx          12 slide components + design system
└── tweaks-panel.jsx    floating tweaks panel + useTweaks hook
```

## Tweaks panel

The floating tweaks panel (bottom-right of the display window) is hidden by default. It activates when a parent window posts `__activate_edit_mode` — this is how the Claude Design host tool wires it up. Standalone, the panel won't appear unless that protocol fires.
