// Round / question content. Default values + localStorage persistence.
// Edits made in the /control window save here; both windows read from here.

const STORAGE_KEY = 'star-wars-trivia.rounds';
const TIEBREAKER_STORAGE_KEY = 'star-wars-trivia.tiebreakers';

export const TIEBREAKER_COUNT = 3;

export const DEFAULT_ROUNDS = [
  {
    n: 2, title: "Original Trilogy",
    subtitle: "Episodes IV, V, and VI — the films that started it all.",
    kicker: "10 Questions",
    questions: Array.from({ length: 10 }, (_, i) =>
      `Question ${i + 1} for Round 2 · Original Trilogy. Replace this placeholder with your real prompt.`
    ),
  },
  {
    n: 3, title: "Prequel Era",
    subtitle: "The Republic, the Jedi Council, and the rise of the Empire.",
    kicker: "10 Questions",
    questions: Array.from({ length: 10 }, (_, i) =>
      `Question ${i + 1} for Round 3 · Prequel Era. Replace this placeholder with your real prompt.`
    ),
  },
  {
    n: 4, title: "Quotes & Catchphrases",
    subtitle: "Who said it — and to whom?",
    kicker: "10 Questions",
    questions: Array.from({ length: 10 }, (_, i) =>
      `Question ${i + 1} for Round 4 · Quotes & Catchphrases. Replace this placeholder with your real prompt.`
    ),
  },
  {
    n: 5, title: "Deep Cuts",
    subtitle: "For the diehards. Spinoffs, side characters, and obscure lore.",
    kicker: "10 Questions · Tiebreaker Material",
    questions: Array.from({ length: 10 }, (_, i) =>
      `Question ${i + 1} for Round 5 · Deep Cuts. Replace this placeholder with your real prompt.`
    ),
  },
];

function clone(rounds) {
  return rounds.map((r) => ({ ...r, questions: [...r.questions] }));
}

export function loadRounds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to defaults
  }
  return clone(DEFAULT_ROUNDS);
}

export function saveRounds(rounds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds));
}

export function resetRounds() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---- Tiebreakers ---------------------------------------------------------
// Sudden-death questions used after the final round when teams are tied.
// 3 placeholders by default; editable via the control window's editor.

export const DEFAULT_TIEBREAKERS = Array.from({ length: TIEBREAKER_COUNT }, (_, i) =>
  `Tiebreaker question ${i + 1}. Replace this placeholder with your real prompt.`
);

export function loadTiebreakers() {
  try {
    const raw = localStorage.getItem(TIEBREAKER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === TIEBREAKER_COUNT) return parsed;
    }
  } catch {
    // fall through
  }
  return [...DEFAULT_TIEBREAKERS];
}

export function saveTiebreakers(tiebreakers) {
  localStorage.setItem(TIEBREAKER_STORAGE_KEY, JSON.stringify(tiebreakers));
}

export function resetTiebreakers() {
  localStorage.removeItem(TIEBREAKER_STORAGE_KEY);
}
