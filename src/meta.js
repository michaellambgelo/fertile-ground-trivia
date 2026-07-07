// Game-level meta: title slide text, end slide text, and which optional
// slides to include. Mirrors rounds.js pattern (defaults + localStorage
// load/save) so the control window can edit and the display window picks up
// changes via broadcast.

import { PICTURE_FITS, PICTURE_ASPECTS } from './pictures.js';

const STORAGE_KEY = 'pub-trivia-scaffold.meta';

export const DEFAULT_META = {
  title: {
    eyebrow: "Presented at Fertile Ground",
    // Optional secondary line between the eyebrow and the edition name.
    // Blank by default — the design leads with the edition hero. Slides
    // uppercase via CSS, so store display case here.
    hero: "",
    edition: "Taproom Trivia",
    // Gold line under the edition hero. Defaults follow the trivia-scorer
    // production naming ("Fertile Ground Taproom Trivia" → Summer Series /
    // Autumn Series); hosts append the event number per night ("Summer
    // Series #2").
    tagline: "Summer Series",
    hosts: "Jack Smith · Michael Lamb",
    footerDate: "July 7 · 2026",
  },
  end: {
    hero1: "Thanks For",
    hero2: "Playing.",
    subtitle: "Hosts Tallying Scores · Stand By",
  },
  // Next-event announcement slide (after End, before tiebreakers).
  nextEvent: {
    eyebrow: "Before You Go",
    hero: "Next Trivia Night",
    date: "TBA",
    venue: "Fertile Ground",
    detail: "Same teams welcome back. Bring a friend.",
  },
  show: {
    prize: true,
    costumeContest: true,
    pictureRound: true,
    tiebreakers: true,
    nextEvent: true,
  },
  pictureRound: {
    instruction: "Identify the character, place, ship or creature.",
    // How picture cells render: "cover" crops images to fill, "contain"
    // letterboxes the whole image (e.g. a flag round). `aspect` is a key into
    // PICTURE_ASPECTS. Both are runtime-editable in the Picture Round card.
    fit: "cover",
    aspect: "316 / 220",
  },
  // Display tweaks — question-slide options.
  // App.jsx derives `tweaks = meta.display`; slides consume it unchanged.
  display: {
    showQNumbers: true,
    showTimer: true,
    timerSeconds: 60,
  },
};

function clone(meta) {
  return {
    title: { ...meta.title },
    end: { ...meta.end },
    nextEvent: { ...meta.nextEvent },
    show: { ...meta.show },
    pictureRound: { ...meta.pictureRound },
    display: { ...meta.display },
  };
}

// Merge persisted state with defaults so adding a new field doesn't blow up
// for users who saved meta before that field existed.
function withDefaults(parsed) {
  // `display` picks known keys explicitly (instead of a blind spread) so
  // saves from before the accent/showStars removal come back clean.
  const display = parsed?.display || {};
  return {
    title: { ...DEFAULT_META.title, ...(parsed?.title || {}) },
    end: { ...DEFAULT_META.end, ...(parsed?.end || {}) },
    nextEvent: { ...DEFAULT_META.nextEvent, ...(parsed?.nextEvent || {}) },
    show: { ...DEFAULT_META.show, ...(parsed?.show || {}) },
    // Explicit, validated pick (like `display`) so a renamed/removed preset
    // degrades to the default instead of breaking the cell layout.
    pictureRound: {
      // Renamed from `handoutInstruction` — it now drives both the handout and
      // the recap slide. Fall back to the old key so saved decks keep their text.
      instruction:
        parsed?.pictureRound?.instruction
        ?? parsed?.pictureRound?.handoutInstruction
        ?? DEFAULT_META.pictureRound.instruction,
      fit: PICTURE_FITS.includes(parsed?.pictureRound?.fit)
        ? parsed.pictureRound.fit
        : DEFAULT_META.pictureRound.fit,
      aspect: PICTURE_ASPECTS[parsed?.pictureRound?.aspect]
        ? parsed.pictureRound.aspect
        : DEFAULT_META.pictureRound.aspect,
    },
    display: {
      showQNumbers: display.showQNumbers ?? DEFAULT_META.display.showQNumbers,
      showTimer: display.showTimer ?? DEFAULT_META.display.showTimer,
      timerSeconds: display.timerSeconds ?? DEFAULT_META.display.timerSeconds,
    },
  };
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return withDefaults(JSON.parse(raw));
  } catch {
    // fall through to defaults
  }
  return clone(DEFAULT_META);
}

export function saveMeta(meta) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

export function resetMeta() {
  localStorage.removeItem(STORAGE_KEY);
}
