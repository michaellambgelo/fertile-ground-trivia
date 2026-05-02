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

## Controls

- **← / →**, **Space**, **PgUp / PgDn** — navigate slides
- **Home / End** — first / last slide
- **Number keys 1–9** — jump to slide N
- **R** — reset to slide 0
- **Click left / right third** — back / forward
- **Browser Print → Save as PDF** — exports one slide per page at 1920×1080

## Structure

```
src/
├── main.jsx            entry — registers <deck-stage>, mounts App
├── App.jsx             slide composition; ROUNDS content; TWEAK_DEFAULTS
├── deck-stage.js       custom element (vanilla JS)
├── slides.jsx          11 slide components + design system (ACCENTS, PALETTE)
└── tweaks-panel.jsx    floating control panel + useTweaks hook
```

Trivia content lives in the `ROUNDS` array in `src/App.jsx`. Currently placeholder text — swap in real questions.

## Tweaks panel

The floating tweaks panel (bottom-right) is hidden by default. It activates when a parent window posts `__activate_edit_mode` — this is how the Claude Design host tool wires it up. Standalone, the panel won't appear unless that protocol fires.
