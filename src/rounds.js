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

// Recap slide chunking — most rounds split into 5+5, round 5's longer prompts
// split into 3+3+4 so each slide stays readable. Returns [[start, end], ...]
// half-open ranges into the round's questions array.
export function recapSplitsFor(round) {
  if (round.n === 5) return [[0, 3], [3, 6], [6, 10]];
  return [[0, 5], [5, 10]];
}

// ---- Export / import ------------------------------------------------------
// Round content + tiebreakers serialize to a single JSON file so a host can
// back up before clicking Reset, restore after a wipe, or move questions
// between machines. Pictures intentionally not included — they're handled
// by the Save Images to Disk flow on the Picture Round panel.

export const QUESTIONS_EXPORT_TYPE = 'star-wars-trivia/questions';
export const QUESTIONS_EXPORT_VERSION = 1;

export function buildQuestionsExport(rounds, tiebreakers) {
  return {
    type: QUESTIONS_EXPORT_TYPE,
    version: QUESTIONS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    rounds: clone(rounds),
    tiebreakers: [...tiebreakers],
  };
}

export function parseQuestionsImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Expected a JSON object at the top level.');
  }
  if (data.type !== QUESTIONS_EXPORT_TYPE) {
    throw new Error('Not a Star Wars Trivia questions export (wrong "type").');
  }
  if (!Array.isArray(data.rounds) || data.rounds.length === 0) {
    throw new Error('"rounds" must be a non-empty array.');
  }
  data.rounds.forEach((r, i) => {
    const where = `Round ${i + 1}`;
    if (!r || typeof r !== 'object') throw new Error(`${where}: not an object.`);
    if (typeof r.n !== 'number') throw new Error(`${where}: missing numeric "n".`);
    if (typeof r.title !== 'string') throw new Error(`${where}: missing "title".`);
    if (typeof r.subtitle !== 'string') throw new Error(`${where}: missing "subtitle".`);
    if (typeof r.kicker !== 'string') throw new Error(`${where}: missing "kicker".`);
    if (!Array.isArray(r.questions) || !r.questions.every((q) => typeof q === 'string')) {
      throw new Error(`${where}: "questions" must be an array of strings.`);
    }
  });
  if (!Array.isArray(data.tiebreakers) || !data.tiebreakers.every((t) => typeof t === 'string')) {
    throw new Error('"tiebreakers" must be an array of strings.');
  }
  if (data.tiebreakers.length !== TIEBREAKER_COUNT) {
    throw new Error(`"tiebreakers" must contain exactly ${TIEBREAKER_COUNT} entries.`);
  }
  return {
    rounds: data.rounds.map((r) => ({ ...r, questions: [...r.questions] })),
    tiebreakers: [...data.tiebreakers],
  };
}
