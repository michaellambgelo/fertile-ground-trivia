// Game-level meta: title slide text, end slide text, and which optional
// slides to include. Mirrors rounds.js pattern (defaults + localStorage
// load/save) so the control window can edit and the display window picks up
// changes via broadcast.

const STORAGE_KEY = 'trivia-scaffold.meta';

export const DEFAULT_META = {
  // 'pub' = pub-trivia (4 rounds × 10, written sheets); 'barstool' = head-to-head
  // (12 rounds × 2, two teams alternate, miss → other team gets one shot).
  mode: 'pub',
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
  // Default team names for barstool mode. Scores live in session state, not here.
  teams: {
    a: 'Team 1',
    b: 'Team 2',
  },
};

function clone(meta) {
  return {
    mode: meta.mode,
    title: { ...meta.title },
    end: { ...meta.end },
    show: { ...meta.show },
    teams: { ...meta.teams },
  };
}

// Merge persisted state with defaults so adding a new field doesn't blow up
// for users who saved meta before that field existed.
function withDefaults(parsed) {
  return {
    mode: parsed?.mode || DEFAULT_META.mode,
    title: { ...DEFAULT_META.title, ...(parsed?.title || {}) },
    end: { ...DEFAULT_META.end, ...(parsed?.end || {}) },
    show: { ...DEFAULT_META.show, ...(parsed?.show || {}) },
    teams: { ...DEFAULT_META.teams, ...(parsed?.teams || {}) },
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
