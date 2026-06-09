// Game-level meta: title slide text, end slide text, and which optional
// slides to include. Mirrors rounds.js pattern (defaults + localStorage
// load/save) so the control window can edit and the display window picks up
// changes via broadcast.

const STORAGE_KEY = 'pub-trivia-scaffold.meta';

export const DEFAULT_META = {
  title: {
    eyebrow: "Presented at Fertile Ground",
    hero: "WELCOME",
    edition: "GENERIC EDITION",
    hosts: "Jack Smith · Michael Lamb",
    footerDate: "May 4 · 2026",
  },
  end: {
    hero1: "THANKS FOR",
    hero2: "PLAYING.",
    subtitle: "HOSTS TALLYING SCORES · STAND BY",
  },
  show: {
    prize: true,
    costumeContest: true,
    pictureRound: true,
    tiebreakers: true,
  },
  pictureRound: {
    handoutInstruction: "Identify the character, place, ship or creature.",
  },
  // Display tweaks — global accent + atmosphere + question-slide options.
  // App.jsx derives `tweaks = meta.display`; slides consume it unchanged.
  display: {
    accent: "accent-red",
    showStars: false,
    showQNumbers: true,
    showTimer: true,
    timerSeconds: 60,
  },
};

function clone(meta) {
  return {
    title: { ...meta.title },
    end: { ...meta.end },
    show: { ...meta.show },
    pictureRound: { ...meta.pictureRound },
    display: { ...meta.display },
  };
}

// Merge persisted state with defaults so adding a new field doesn't blow up
// for users who saved meta before that field existed.
function withDefaults(parsed) {
  return {
    title: { ...DEFAULT_META.title, ...(parsed?.title || {}) },
    end: { ...DEFAULT_META.end, ...(parsed?.end || {}) },
    show: { ...DEFAULT_META.show, ...(parsed?.show || {}) },
    pictureRound: { ...DEFAULT_META.pictureRound, ...(parsed?.pictureRound || {}) },
    display: { ...DEFAULT_META.display, ...(parsed?.display || {}) },
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
