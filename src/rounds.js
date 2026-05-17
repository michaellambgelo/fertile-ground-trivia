// Round / question content. Default values + localStorage persistence.
// Edits made in the /control window save here; both windows read from here.

const STORAGE_KEY = 'trivia-scaffold.rounds';
const TIEBREAKER_STORAGE_KEY = 'trivia-scaffold.tiebreakers';

export const TIEBREAKER_COUNT = 3;

export const DEFAULT_ROUNDS = [
  {
    n: 2, title: "Warm-Up Round",
    subtitle: "A gentle start. Easy points to set the tone.",
    kicker: "10 Questions",
    questions: Array.from({ length: 10 }, (_, i) =>
      `Placeholder question ${i + 1} for Round 2 · Warm-Up Round. Replace this with a real prompt.`
    ),
  },
  {
    n: 3, title: "Categories Round",
    subtitle: "A mix of topics — keep an open mind.",
    kicker: "10 Questions",
    questions: Array.from({ length: 10 }, (_, i) =>
      `Placeholder question ${i + 1} for Round 3 · Categories Round. Replace this with a real prompt.`
    ),
  },
  {
    n: 4, title: "Quotes & Catchphrases",
    subtitle: "Who said it — and to whom?",
    kicker: "10 Questions",
    questions: Array.from({ length: 10 }, (_, i) =>
      `Placeholder question ${i + 1} for Round 4 · Quotes & Catchphrases. Replace this with a real prompt.`
    ),
  },
  {
    n: 5, title: "Final Round",
    subtitle: "The hardest questions. For the bragging rights.",
    kicker: "10 Questions · Tiebreaker Material",
    questions: Array.from({ length: 10 }, (_, i) =>
      `Placeholder question ${i + 1} for Round 5 · Final Round. Replace this with a real prompt.`
    ),
  },
];

// Barstool mode: 12 rounds × 2 questions = 24 questions. Two teams alternate
// per question; on miss the other team gets one shot at the full point.
// Round titles suggest variety (audio, scramble, visual) so hosts have a
// menu of formats; each question can carry optional media (audioUrl,
// imageUrl, videoUrl, displayHint) via the editor.
const BARSTOOL_ROUND_TITLES = [
  { title: "Warm-Up",            subtitle: "Easy points to set the tone." },
  { title: "Categories",         subtitle: "A mix of topics — keep an open mind." },
  { title: "Audio · 5 Seconds",  subtitle: "Identify the song from a five-second clip." },
  { title: "Unscramble",         subtitle: "Jumbled letters — first to call it gets the point." },
  { title: "Visual Cues",        subtitle: "What is it? Identify the image." },
  { title: "Quotes",             subtitle: "Who said it — and from where?" },
  { title: "Year Game",          subtitle: "Within five years gets the point." },
  { title: "Standard Q&A",       subtitle: "Plain trivia. No tricks." },
  { title: "Audio · 5 Seconds",  subtitle: "Another round of five-second clips." },
  { title: "Pop Culture",        subtitle: "Movies, TV, music, internet." },
  { title: "Final Five",         subtitle: "The hardest stretch. Buckle up." },
  { title: "Lightning Round",    subtitle: "Snap answers. Move fast." },
];

export const DEFAULT_BARSTOOL_ROUNDS = BARSTOOL_ROUND_TITLES.map((meta, i) => ({
  n: i + 1,
  title: meta.title,
  subtitle: meta.subtitle,
  kicker: "2 Questions",
  questions: Array.from({ length: 2 }, (_, qi) =>
    `Placeholder question ${qi + 1} for Round ${i + 1} · ${meta.title}. Replace this with a real prompt.`
  ),
}));

// Question shape is `string` (legacy) OR
// `{ prompt, answer?, audioUrl?, imageUrl?, videoUrl?, displayHint? }`.
// normalizeQuestion always returns the object form for rendering / editing.
// Storage keeps whichever form the user wrote so legacy decks don't bloat.
export function normalizeQuestion(q) {
  if (typeof q === 'string') return { prompt: q };
  return { ...q };
}

function cloneQuestion(q) {
  return typeof q === 'string' ? q : { ...q };
}

function clone(rounds) {
  return rounds.map((r) => ({ ...r, questions: r.questions.map(cloneQuestion) }));
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
  `Placeholder tiebreaker ${i + 1}. Replace this with a real prompt.`
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

// Recap slide chunking — splits a round's questions into balanced chunks of
// at most 5 each. Returns [[start, end], ...] half-open ranges into the
// round's questions array. Generic across question-count so themed decks
// with different round lengths get sensible recap slides automatically.
export function recapSplitsFor(round) {
  const total = round.questions.length;
  if (total <= 5) return [[0, total]];
  if (total <= 10) {
    const half = Math.ceil(total / 2);
    return [[0, half], [half, total]];
  }
  const a = Math.ceil(total / 3);
  const b = Math.ceil((total - a) / 2);
  return [[0, a], [a, a + b], [a + b, total]];
}

// In pub mode, DEFAULT_ROUNDS numbers trivia rounds 2..5 because slot 1 is
// reserved for the Picture Round. When the host hides the picture round,
// shift the on-screen number down by 1 so players see rounds 1..4 with no
// gap. Barstool rounds already number 1..N and stay as-is.
export function displayRoundNumber(rN, mode, pictureRoundShown) {
  if (mode === 'barstool') return rN;
  return pictureRoundShown ? rN : rN - 1;
}

// ---- Export / import ------------------------------------------------------
// Round content + tiebreakers serialize to a single JSON file so a host can
// back up before clicking Reset, restore after a wipe, or move questions
// between machines. Pictures intentionally not included — they're handled
// by the Save Images to Disk flow on the Picture Round panel.

export const QUESTIONS_EXPORT_TYPE = 'trivia-scaffold/questions';
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
    throw new Error('Not a Trivia Scaffold questions export (wrong "type").');
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
    if (!Array.isArray(r.questions) || !r.questions.every((q) =>
      typeof q === 'string' ||
      (q && typeof q === 'object' && typeof q.prompt === 'string')
    )) {
      throw new Error(`${where}: "questions" must be an array of strings or { prompt, ... } objects.`);
    }
  });
  if (!Array.isArray(data.tiebreakers) || !data.tiebreakers.every((t) => typeof t === 'string')) {
    throw new Error('"tiebreakers" must be an array of strings.');
  }
  if (data.tiebreakers.length !== TIEBREAKER_COUNT) {
    throw new Error(`"tiebreakers" must contain exactly ${TIEBREAKER_COUNT} entries.`);
  }
  return {
    rounds: clone(data.rounds),
    tiebreakers: [...data.tiebreakers],
  };
}

// ---- CSV writer template + import ---------------------------------------
// Hosts hand off `buildCsvTemplate()` to writers; the writer fills "category"
// + "question" cells (answers go in a separate, secret doc), and on import the
// host maps each discovered category to a round.

export function buildCsvTemplate() {
  // Comment lines must stay in a single spreadsheet cell when the writer
  // opens the CSV in Numbers/Excel. Any line that has a comma or a quote
  // gets wrapped + escaped so it doesn't spill into column B.
  const csvComment = (line) =>
    line.includes(',') || line.includes('"')
      ? `"${line.replace(/"/g, '""')}"`
      : line;
  const comments = [
    '# TRIVIA QUESTIONS — WRITER TEMPLATE',
    '',
    '# Replace the categories and questions below with your own.',
    '# Rows that share a category become one trivia round at import time.',
    '# DO NOT write answers in this file — share answers with the host privately.',
    '# If a question contains a comma, wrap the whole question in double quotes.',
    '',
  ].map(csvComment);
  const body = [
    'category,question',
    'Category 1,Question 1',
    'Category 1,Question 2',
    'Category 1,Question 3',
    'Category 2,Question 1',
    'Category 2,Question 2',
    '',
  ];
  return [...comments, ...body].join('\n');
}

function parseCsvRows(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; continue; }
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { cur.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; continue; }
    field += ch;
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

export function parseQuestionsCsv(text) {
  const rows = parseCsvRows(text)
    .filter((r) => !(r.length === 1 && r[0].trim() === ''))
    .filter((r) => !(r[0] && r[0].trim().startsWith('#')));
  if (rows.length === 0) {
    throw new Error('CSV is empty after stripping comments and blank lines.');
  }
  const header = rows[0].map((c) => c.trim().toLowerCase());
  if (header[0] !== 'category' || header[1] !== 'question') {
    throw new Error('CSV header must be "category,question" on the first non-comment row.');
  }
  const buckets = {};
  const order = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const cat = (r[0] || '').trim();
    const q = (r[1] || '').trim();
    if (!cat || !q) continue;
    if (!(cat in buckets)) { buckets[cat] = []; order.push(cat); }
    buckets[cat].push(q);
  }
  if (order.length === 0) {
    throw new Error('No question rows found. Add at least one row with a category and a question.');
  }
  return { categories: order, buckets };
}

export function parseImport(text, filename = '') {
  const lower = filename.toLowerCase();
  const startsObj = /^\s*\{/.test(text);
  const isJsonByName = lower.endsWith('.json');
  const isCsvByName = lower.endsWith('.csv');
  if (isCsvByName && !isJsonByName) {
    return { kind: 'csv', ...parseQuestionsCsv(text) };
  }
  if (isJsonByName || startsObj) {
    return { kind: 'json', ...parseQuestionsImport(text) };
  }
  return { kind: 'csv', ...parseQuestionsCsv(text) };
}
