# Star Wars Trivia

A browser-only Star Wars trivia presentation deck for hosting a live trivia night. Built with React + Vite, rendered through a custom `<deck-stage>` web component that handles slide layout, navigation, scaling, and print-to-PDF.

## Run

```bash
npm install
npm run dev      # localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve dist/ for verification
npm run lint     # ESLint
```

## Two windows: display + control

Open two browser windows on the same origin:

- **Display** — `http://localhost:5173/` — full-screen on the projector / TV.
- **Control** — `http://localhost:5173/#/control` — on your laptop. Has the question editor and presenter view.

The two windows talk to each other live via `BroadcastChannel` (built-in browser API, no server). Edits in the control window push to the display instantly. Navigation in the control window drives the display.

### Live event setup

1. Open the project in your browser. By default you land on the display.
2. Open a new browser window, navigate to `#/control`, drag it to your laptop screen.
3. Drag the display window to the projector / second display, then make it fullscreen (browser fullscreen, e.g. ⌃⌘F on macOS Chrome).
4. Use the control window to:
   - **Presenter** — Prev / Next / Reset, jump-to-slide via the slide list, control the question timer (pause / resume / reset / ±10s).
   - **Edit Questions** — fill in real prompts; Save & Push to Display syncs them.
   - **Picture Round** — paste images into 10 cells, copy or download the handout PNG, save the images to disk for production deployment.

### Picture Round workflow

1. In the control window, switch to the **Picture Round** tab.
2. Click a cell, ⌘V (Mac) / Ctrl+V to paste an image from your clipboard. (Drag-drop a file works too.) Pastes go into `localStorage` so the display picks them up immediately.
3. **Crop / re-frame** — once an image is in a cell, drag it to pan the visible crop. The ↺ button resets the crop to centered.
4. **Copy Handout to Clipboard** — copies a print-friendly 1920×1080 PNG (white background, dark borders, "PICTURE ROUND" title, no recap eyebrow). Paste into Word / Pages / email.
5. **Download Handout PNG** — same image as a file.
6. **Save Images to Disk** — downloads each pasted image with predictable names (`picture-01.png` … `picture-10.png`). Drop them into `public/images/` so the display can serve them statically and you can clear the localStorage paste buffer.

The slide, the canvas handout, and the editor cell all use the same crop-position math (`object-position` percentages), so what you see in the editor is exactly what shows in the recap and on the printed sheet.

### Display controls (fallback)

Keyboard / mouse shortcuts on the display window itself, in case you don't want the control window:

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
├── rounds.js           DEFAULT_ROUNDS + localStorage persistence
├── pictures.js         picture round data + paste buffer
├── handout.js          canvas-based PNG renderer for picture round handout
├── broadcast.js        BroadcastChannel helper + useBroadcast hook
├── deck-stage.js       custom element (vanilla JS)
├── slides.jsx          12 slide components + design system
└── tweaks-panel.jsx    floating tweaks panel + useTweaks hook
```

Round / question content lives in `src/rounds.js` as `DEFAULT_ROUNDS`. Tiebreaker prompts live alongside as `DEFAULT_TIEBREAKERS` (3 sudden-death questions used after Round 5 if there's a tie). Edits made in the control window override the defaults via `localStorage` — they survive page reloads but stay local to the browser. To reset to defaults, click **Reset to Defaults** in the editor.

Picture Round images live in `public/images/picture-01.png` … `picture-10.png` once you save them. Until then, pastes in the editor are kept in `localStorage` and the display reads from there.

## Tweaks panel

The floating tweaks panel (bottom-right of the display window) is hidden by default. It activates when a parent window posts `__activate_edit_mode` — this is how the Claude Design host tool wires it up. Standalone, the panel won't appear unless that protocol fires.
