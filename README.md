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
   - **Edit Questions** — fill in real prompts; Save & Push to Display syncs them.
   - **Presenter** — Prev / Next / Reset, jump-to-slide via the slide list, control the question timer (pause / resume / reset / ±10s).

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
├── ControlApp.jsx      control: editor + presenter view
├── rounds.js           ROUNDS data + localStorage persistence
├── broadcast.js        BroadcastChannel helper + useBroadcast hook
├── deck-stage.js       custom element (vanilla JS)
├── slides.jsx          11 slide components + design system
└── tweaks-panel.jsx    floating tweaks panel + useTweaks hook
```

Round / question content lives in `src/rounds.js` as `DEFAULT_ROUNDS`. Edits made in the control window override the defaults via `localStorage` — they survive page reloads but stay local to the browser. To reset to defaults, click **Reset to Defaults** in the editor.

## Tweaks panel

The floating tweaks panel (bottom-right of the display window) is hidden by default. It activates when a parent window posts `__activate_edit_mode` — this is how the Claude Design host tool wires it up. Standalone, the panel won't appear unless that protocol fires.
