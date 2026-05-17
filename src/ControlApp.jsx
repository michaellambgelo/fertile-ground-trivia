import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadRounds, saveRounds, resetRounds, DEFAULT_ROUNDS, DEFAULT_BARSTOOL_ROUNDS,
  loadTiebreakers, saveTiebreakers, resetTiebreakers, DEFAULT_TIEBREAKERS,
  buildQuestionsExport, parseImport, buildCsvTemplate, recapSplitsFor,
  normalizeQuestion, displayRoundNumber,
} from './rounds.js';
import { loadMeta, saveMeta, resetMeta, DEFAULT_META } from './meta.js';
import { makeTeams } from './teams.js';
import { loadPastes, savePastes, clearPastes, mergeItems, PICTURE_FILENAME } from './pictures.js';
import {
  copyHandoutToClipboard, downloadHandoutPng, downloadAllImages, downloadAnswersHandoutPng,
} from './handout.js';
import { broadcast, useBroadcast } from './broadcast.js';

// ============================================================
// STYLES — terminal-y panel, distinct from the show deck.
// ============================================================
const COLORS = {
  bg: '#0B0E1A',
  panel: '#11162A',
  panelAlt: '#161C36',
  text: '#F2E9D8',
  textDim: '#8A91A8',
  border: '#252B45',
  accent: '#5BC8FF',
  accentDim: 'rgba(91, 200, 255, 0.18)',
  warn: '#FFC857',
  danger: '#FF5A5A',
};

const baseStyle = {
  margin: 0, minHeight: '100vh', background: COLORS.bg, color: COLORS.text,
  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, lineHeight: 1.4,
};

// Track viewport width so layouts can stack at narrow widths (split-tab use,
// embedded views). One breakpoint at 1100px is enough — below it, two-column
// grids become single column. Inline-style architecture means no media
// queries; this hook + a `narrow` boolean is the conventional replacement.
const NARROW_BREAKPOINT = 1100;
function useNarrowLayout() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < NARROW_BREAKPOINT
  );
  useEffect(() => {
    const handler = () => setNarrow(window.innerWidth < NARROW_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return narrow;
}

// ============================================================
// CONTROL APP
// ============================================================
export default function ControlApp() {
  const [rounds, setRounds] = useState(() => loadRounds());
  const [tiebreakers, setTiebreakers] = useState(() => loadTiebreakers());
  const [meta, setMeta] = useState(() => loadMeta());
  const [pastes, setPastes] = useState(() => loadPastes());
  const [tab, setTab] = useState('present');
  const [currentSlide, setCurrentSlide] = useState({ index: 0, total: 0, label: '' });
  const [timer, setTimer] = useState({ seconds: 0, paused: false, enabled: false });
  // Session-only team state — same shape as App.jsx; synced via teams:update.
  // Names default from meta.teams; scores reset to 0 on mount and on New Game.
  const [teams, setTeams] = useState(() => makeTeams(loadMeta()));

  // Push edits to the display window.
  const commitRounds = useCallback((next) => {
    setRounds(next);
    saveRounds(next);
    broadcast('rounds:update', next);
  }, []);

  const commitTiebreakers = useCallback((next) => {
    setTiebreakers(next);
    saveTiebreakers(next);
    broadcast('tiebreakers:update', next);
  }, []);

  const commitMeta = useCallback((next) => {
    setMeta(next);
    saveMeta(next);
    broadcast('meta:update', next);
  }, []);

  const commitPastes = useCallback((next) => {
    setPastes(next);
    savePastes(next);
    broadcast('pictures:update', next);
  }, []);

  // Team state — names + scores. Control window is the primary source of
  // truth; the setup slide on the display can also push name edits via
  // teams:update, which we receive here and mirror into local state.
  const commitTeams = useCallback((next) => {
    setTeams(next);
    broadcast('teams:update', next);
  }, []);

  const adjustScore = useCallback((which, delta) => {
    setTeams((curr) => {
      const nextScore = Math.max(0, curr[which].score + delta);
      const actualDelta = nextScore - curr[which].score;
      const next = {
        ...curr,
        [which]: { ...curr[which], score: nextScore },
      };
      broadcast('teams:update', next);
      // Celebrate point awards with a bell on the display window. Only fire
      // when the score actually increased (skips corrections and the
      // clamped-at-zero case for −1 buttons).
      if (actualDelta > 0) {
        broadcast('score:awarded', { team: which, delta: actualDelta });
      }
      return next;
    });
  }, []);

  const resetScores = useCallback(() => {
    setTeams((curr) => {
      const next = { a: { ...curr.a, score: 0 }, b: { ...curr.b, score: 0 } };
      broadcast('teams:update', next);
      return next;
    });
  }, []);

  const newGame = useCallback(() => {
    const next = makeTeams(meta);
    setTeams(next);
    broadcast('teams:update', next);
    broadcast('nav:goto', 0);
  }, [meta]);

  // Listen for slide / timer state coming back from the display window.
  useBroadcast(useCallback((msg) => {
    if (msg.type === 'slidechange') setCurrentSlide(msg.payload);
    else if (msg.type === 'timer:state') setTimer(msg.payload);
    else if (msg.type === 'teams:update') setTeams(msg.payload);
  }, []));

  // On mount, ask display for current state in case it was already running.
  useEffect(() => {
    broadcast('sync:request', null);
  }, []);

  return (
    <div style={baseStyle}>
      <Header tab={tab} setTab={setTab} currentSlide={currentSlide} />
      {tab === 'present' && (
        <PresenterPanel
          currentSlide={currentSlide}
          timer={timer}
          rounds={rounds}
          tiebreakers={tiebreakers}
          meta={meta}
          teams={teams}
          commitTeams={commitTeams}
          adjustScore={adjustScore}
          resetScores={resetScores}
          newGame={newGame}
        />
      )}
      {tab === 'edit' && (
        <EditorPanel
          rounds={rounds}
          tiebreakers={tiebreakers}
          meta={meta}
          commitRounds={commitRounds}
          commitTiebreakers={commitTiebreakers}
          commitMeta={commitMeta}
        />
      )}
      {tab === 'pictures' && (
        <PicturesPanel
          pastes={pastes}
          commitPastes={commitPastes}
        />
      )}
    </div>
  );
}

// ============================================================
// HEADER
// ============================================================
function Header({ tab, setTab, currentSlide }) {
  const tabs = [
    { id: 'present', label: 'Presenter' },
    { id: 'edit', label: 'Edit Questions' },
    { id: 'pictures', label: 'Picture Round' },
  ];
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 24, padding: '14px 24px',
      borderBottom: `1px solid ${COLORS.border}`, background: COLORS.panel,
      position: 'sticky', top: 0, zIndex: 10,
      flexWrap: 'wrap', rowGap: 8,
    }}>
      <div style={{ fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
        fontSize: 12, color: COLORS.accent, whiteSpace: 'nowrap' }}>
        ★ Trivia Control
      </div>
      <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid transparent',
              background: tab === t.id ? COLORS.accentDim : 'transparent',
              color: tab === t.id ? COLORS.accent : COLORS.textDim,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
            {t.label}
          </button>
        ))}
      </nav>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center',
        fontSize: 12, color: COLORS.textDim, flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ whiteSpace: 'nowrap' }}>
          Slide{' '}
          <strong style={{ color: COLORS.text }}>
            {currentSlide.total > 0 ? currentSlide.index + 1 : '—'}
          </strong>
          {' / '}
          {currentSlide.total || '—'}
        </span>
        {currentSlide.label && (
          <span style={{ color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            · {currentSlide.label}
          </span>
        )}
      </div>
    </header>
  );
}

// ============================================================
// PRESENTER PANEL — nav + timer + slide list
// ============================================================
function PresenterPanel({
  currentSlide, timer, rounds, tiebreakers, meta,
  teams, commitTeams, adjustScore, resetScores, newGame,
}) {
  const slideList = useMemo(() => buildSlideOutline(rounds, tiebreakers, meta), [rounds, tiebreakers, meta]);
  const isBarstool = meta.mode === 'barstool';
  const narrow = useNarrowLayout();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1fr) 360px',
      gap: 16, padding: 16,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {isBarstool && (
          <ScoringCard
            teams={teams}
            commitTeams={commitTeams}
            adjustScore={adjustScore}
            resetScores={resetScores}
            newGame={newGame}
            currentSlide={currentSlide}
            rounds={rounds}
            narrow={narrow}
          />
        )}
        <NavCard currentSlide={currentSlide} slideList={slideList} narrow={narrow} />
        <TimerCard timer={timer} />
      </div>
      <SlideList slideList={slideList} currentIndex={currentSlide.index} narrow={narrow} />
    </div>
  );
}

// ============================================================
// SCORING CARD — barstool-mode only. Team names (editable), scores with
// award/correction buttons, turn indicator chip derived from the current
// slide label, host-only answer reveal, reset/new-game controls.
// ============================================================
function ScoringCard({ teams, commitTeams, adjustScore, resetScores, newGame, currentSlide, rounds, narrow }) {
  const veryNarrow = narrow && typeof window !== 'undefined' && window.innerWidth < 520;
  // Turn derivation: question label format is `R{n} Q{NN}`. Q01 → Team A,
  // Q02 → Team B. Tiebreakers + non-question slides have no turn.
  const label = currentSlide?.label || '';
  const questionMatch = label.match(/^R(\d+) Q(\d+)/);
  let turn = null;
  if (questionMatch) {
    const qNum = parseInt(questionMatch[2], 10);
    turn = qNum === 1 ? 'a' : qNum === 2 ? 'b' : null;
  }

  // Answer reveal: find the current question's `answer` field by parsing the
  // label and looking up in rounds. Shown only on the control window — never
  // broadcast or displayed on the show deck.
  let answerText = null;
  if (questionMatch) {
    const rN = parseInt(questionMatch[1], 10);
    const qIdx = parseInt(questionMatch[2], 10) - 1;
    const round = rounds.find((r) => r.n === rN);
    const q = round?.questions?.[qIdx];
    const data = q !== undefined ? normalizeQuestion(q) : null;
    answerText = data?.answer || null;
  }

  const setName = (which, value) => {
    commitTeams({ ...teams, [which]: { ...teams[which], name: value } });
  };

  return (
    <Card title="Scoring">
      {turn && (
        <div style={{
          marginBottom: 12, padding: '6px 12px',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: COLORS.accentDim, color: COLORS.accent,
          fontSize: 12, fontWeight: 600, letterSpacing: '0.18em',
          textTransform: 'uppercase', borderRadius: 999,
        }}>
          ◆ Turn: {teams[turn].name}
        </div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: veryNarrow ? '1fr' : '1fr 1fr',
        gap: 12,
      }}>
        <TeamScorePanel
          team={teams.a}
          isTurn={turn === 'a'}
          onName={(v) => setName('a', v)}
          onAdd={() => adjustScore('a', 1)}
          onSub={() => adjustScore('a', -1)}
        />
        <TeamScorePanel
          team={teams.b}
          isTurn={turn === 'b'}
          onName={(v) => setName('b', v)}
          onAdd={() => adjustScore('b', 1)}
          onSub={() => adjustScore('b', -1)}
        />
      </div>
      {answerText && (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: COLORS.panelAlt, border: `1px dashed ${COLORS.border}`,
          borderRadius: 6,
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: COLORS.textDim, marginBottom: 4 }}>
            Answer (host only)
          </div>
          <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 500 }}>{answerText}</div>
        </div>
      )}
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={resetScores} secondary>Reset Scores</Button>
        <Button onClick={newGame} secondary>New Game</Button>
      </div>
    </Card>
  );
}

function TeamScorePanel({ team, isTurn, onName, onAdd, onSub }) {
  return (
    <div style={{
      padding: 12, borderRadius: 8,
      border: `1px solid ${isTurn ? COLORS.accent : COLORS.border}`,
      background: isTurn ? COLORS.accentDim : COLORS.panel,
    }}>
      <input
        type="text"
        value={team.name}
        onChange={(e) => onName(e.target.value)}
        maxLength={32}
        style={{
          width: '100%', padding: '6px 8px', marginBottom: 8,
          background: COLORS.bg, color: COLORS.text,
          border: `1px solid ${COLORS.border}`, borderRadius: 6,
          fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          fontFamily: 'Oswald, sans-serif', fontSize: 36, fontWeight: 700,
          color: COLORS.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          minWidth: 48,
        }}>
          {team.score}
        </div>
        <Button onClick={onAdd} primary>+1</Button>
        <Button onClick={onSub} secondary>−1</Button>
      </div>
    </div>
  );
}

function NavCard({ currentSlide, slideList, narrow }) {
  const goPrev = () => broadcast('nav:prev', null);
  const goNext = () => broadcast('nav:next', null);
  const goReset = () => broadcast('nav:goto', 0);
  const current = slideList[currentSlide.index];
  const next = slideList[currentSlide.index + 1];
  // Side-by-side Now / Up Next when there's room; stack vertically below
  // ~520px (very-narrow). The parent breakpoint covers the typical case.
  const veryNarrow = narrow && typeof window !== 'undefined' && window.innerWidth < 520;

  return (
    <Card title="Navigation">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={goPrev}>← Previous</Button>
        <Button onClick={goNext} primary>Next →</Button>
        <Button onClick={goReset} secondary>Reset to Title</Button>
      </div>
      <div style={{
        marginTop: 18, display: 'grid',
        gridTemplateColumns: veryNarrow ? '1fr' : '1fr 1fr',
        gap: 14,
      }}>
        <PreviewBlock label="Now" slide={current} accent />
        <PreviewBlock label="Up Next" slide={next} />
      </div>
    </Card>
  );
}

function PreviewBlock({ label, slide, accent = false }) {
  return (
    <div style={{
      padding: 12, borderRadius: 8,
      border: `1px solid ${accent ? COLORS.accent : COLORS.border}`,
      background: accent ? COLORS.accentDim : COLORS.panel,
    }}>
      <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
        color: accent ? COLORS.accent : COLORS.textDim, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>
        {slide ? slide.label : '—'}
      </div>
      {slide?.detail && (
        <div style={{ marginTop: 6, fontSize: 12, color: COLORS.textDim,
          maxHeight: 80, overflow: 'hidden' }}>
          {slide.detail}
        </div>
      )}
    </div>
  );
}

function TimerCard({ timer }) {
  return (
    <Card title="Timer">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <div style={{
          fontFamily: 'Oswald, system-ui, sans-serif', fontSize: 64, fontWeight: 700,
          color: timer.enabled ? (timer.seconds <= 10 ? COLORS.danger : COLORS.accent) : COLORS.textDim,
          lineHeight: 1,
        }}>
          {timer.enabled ? `${timer.seconds}s` : 'OFF'}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textDim }}>
          {timer.enabled ? (timer.paused ? 'Paused' : 'Running') : 'Timer disabled in tweaks panel'}
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => broadcast('timer:toggle', null)} disabled={!timer.enabled}>
          {timer.paused ? 'Resume' : 'Pause'}
        </Button>
        <Button onClick={() => broadcast('timer:reset', null)} disabled={!timer.enabled}>
          Reset
        </Button>
        <Button onClick={() => broadcast('timer:adjust', -10)} disabled={!timer.enabled} secondary>
          −10s
        </Button>
        <Button onClick={() => broadcast('timer:adjust', 10)} disabled={!timer.enabled} secondary>
          +10s
        </Button>
      </div>
    </Card>
  );
}

function SlideList({ slideList, currentIndex, narrow }) {
  // When stacked under the other Presenter cards, cap the slide list at a
  // shorter height so it doesn't dominate the viewport (still scrolls).
  const maxHeight = narrow ? 480 : 'calc(100vh - 180px)';
  return (
    <Card title={`Slide List (${slideList.length})`} compact>
      <div style={{ maxHeight, overflowY: 'auto', margin: '-12px -16px',
        padding: '4px 0' }}>
        {slideList.map((s, i) => {
          const isCurrent = i === currentIndex;
          return (
            <button key={s.key} onClick={() => broadcast('nav:goto', i)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 16px', border: 0, background: isCurrent ? COLORS.accentDim : 'transparent',
                color: isCurrent ? COLORS.accent : COLORS.text,
                fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
                borderLeft: `3px solid ${isCurrent ? COLORS.accent : 'transparent'}`,
              }}>
              <span style={{ color: COLORS.textDim, marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ============================================================
// EDITOR PANEL — long form, edit metadata + questions
// ============================================================
function EditorPanel({ rounds, tiebreakers, meta, commitRounds, commitTiebreakers, commitMeta }) {
  const [draft, setDraft] = useState(rounds);
  const [draftTiebreakers, setDraftTiebreakers] = useState(tiebreakers);
  const [draftMeta, setDraftMeta] = useState(meta);
  const [dirty, setDirty] = useState(false);
  const [csvImport, setCsvImport] = useState(null);
  const fileInputRef = useRef(null);

  // If the persisted data changes externally (e.g. another window saved), pull
  // it in — but only when not editing, to avoid clobbering in-flight edits.
  useEffect(() => {
    if (!dirty) setDraft(rounds);
  }, [rounds, dirty]);
  useEffect(() => {
    if (!dirty) setDraftTiebreakers(tiebreakers);
  }, [tiebreakers, dirty]);
  useEffect(() => {
    if (!dirty) setDraftMeta(meta);
  }, [meta, dirty]);

  const cloneQ = (q) => (typeof q === 'string' ? q : { ...q });

  const update = (path, value) => {
    setDirty(true);
    setDraft((d) => {
      const next = d.map((r) => ({ ...r, questions: r.questions.map(cloneQ) }));
      const [ri, field, qi] = path;
      if (field === 'questions') next[ri].questions[qi] = value;
      else next[ri][field] = value;
      return next;
    });
  };

  // Per-question field update that handles the dual string/object shape.
  // If the only non-empty field is `prompt`, the question stays as a plain
  // string (legacy-light). Any media or answer turns it into an object.
  const updateQuestion = (ri, qi, field, value) => {
    setDirty(true);
    setDraft((d) => {
      const next = d.map((r) => ({ ...r, questions: r.questions.map(cloneQ) }));
      const current = normalizeQuestion(next[ri].questions[qi]);
      const merged = { ...current, [field]: value };
      // Strip empty string fields so the object form stays clean.
      Object.keys(merged).forEach((k) => {
        if (merged[k] === '' || merged[k] === undefined) delete merged[k];
      });
      const hasMedia = !!(merged.answer || merged.audioUrl || merged.imageUrl || merged.videoUrl || merged.displayHint);
      next[ri].questions[qi] = hasMedia ? merged : (merged.prompt || '');
      return next;
    });
  };

  const updateTiebreaker = (i, value) => {
    setDirty(true);
    setDraftTiebreakers((tb) => tb.map((t, idx) => (idx === i ? value : t)));
  };

  const updateMeta = (section, field, value) => {
    setDirty(true);
    setDraftMeta((m) => ({ ...m, [section]: { ...m[section], [field]: value } }));
  };

  const setMode = (nextMode) => {
    setDirty(true);
    setDraftMeta((m) => ({ ...m, mode: nextMode }));
  };

  const applyBarstoolDefaults = () => {
    if (!confirm('Replace current rounds with the barstool defaults (12 rounds × 2 questions)? Unsaved edits to rounds will be lost.')) return;
    setDraft(DEFAULT_BARSTOOL_ROUNDS.map((r) => ({ ...r, questions: [...r.questions] })));
    setDirty(true);
  };

  const save = () => {
    commitRounds(draft);
    commitTiebreakers(draftTiebreakers);
    commitMeta(draftMeta);
    setDirty(false);
  };
  const revert = () => {
    setDraft(rounds);
    setDraftTiebreakers(tiebreakers);
    setDraftMeta(meta);
    setDirty(false);
  };
  const reset = () => {
    if (!confirm('Reset all questions, tiebreakers, and slide settings to the original placeholders? This will discard your edits.')) return;
    resetRounds();
    resetTiebreakers();
    resetMeta();
    const freshRounds = loadRounds();
    const freshTiebreakers = loadTiebreakers();
    const freshMeta = loadMeta();
    setDraft(freshRounds);
    setDraftTiebreakers(freshTiebreakers);
    setDraftMeta(freshMeta);
    setDirty(false);
    commitRounds(freshRounds);
    commitTiebreakers(freshTiebreakers);
    commitMeta(freshMeta);
  };

  const downloadFile = (filename, contents, mime) => {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onExport = () => {
    const payload = buildQuestionsExport(draft, draftTiebreakers);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`trivia-questions-${date}.json`, JSON.stringify(payload, null, 2), 'application/json');
  };

  const onDownloadTemplate = () => {
    downloadFile('trivia-questions-template.csv', buildCsvTemplate(), 'text/csv');
  };

  const onImportClick = () => fileInputRef.current?.click();

  const onImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = parseImport(reader.result, file.name);
        if (result.kind === 'json') {
          setDraft(result.rounds);
          setDraftTiebreakers(result.tiebreakers);
          setDirty(true);
        } else {
          setCsvImport({ categories: result.categories, buckets: result.buckets });
        }
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }
    };
    reader.onerror = () => alert('Could not read file.');
    reader.readAsText(file);
  };

  const applyCsvMapping = (mapping) => {
    const { buckets } = csvImport;
    const nextRounds = draft.map((r) => {
      const cat = mapping[`r${r.n}`];
      if (!cat || !buckets[cat]) return r;
      return { ...r, questions: [...buckets[cat]] };
    });
    let nextTb = draftTiebreakers;
    if (mapping.tb && buckets[mapping.tb]) {
      const src = buckets[mapping.tb];
      nextTb = draftTiebreakers.map((t, i) => (src[i] !== undefined ? src[i] : t));
    }
    setDraft(nextRounds);
    setDraftTiebreakers(nextTb);
    setDirty(true);
    setCsvImport(null);
  };

  // Cmd/Ctrl+S → Save & Push (only when there are unsaved edits).
  const trySaveRef = useRef(() => {});
  trySaveRef.current = () => { if (dirty) save(); };
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key !== 's' && e.key !== 'S') return;
      e.preventDefault();
      trySaveRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', position: 'sticky', top: 60, zIndex: 5,
        background: COLORS.bg, padding: '8px 0',
        flexWrap: 'wrap', rowGap: 8,
      }}>
        <Button onClick={save} primary disabled={!dirty}>Save & Push to Display</Button>
        <Button onClick={revert} disabled={!dirty}>Revert</Button>
        <Button onClick={reset} secondary>Reset to Defaults</Button>
        <span style={{ width: 1, height: 24, background: COLORS.border, margin: '0 4px' }} />
        <Button onClick={onExport}>Export</Button>
        <Button onClick={onImportClick}>Import…</Button>
        <Button onClick={onDownloadTemplate} secondary>CSV Template</Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json,text/csv,.csv"
          onChange={onImportFile}
          style={{ display: 'none' }}
        />
        {dirty && <span style={{ color: COLORS.warn, fontSize: 12 }}>Unsaved changes</span>}
      </div>

      <Card title="Game Mode">
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 10 }}>
          Pub trivia = teams play on paper sheets, hosts grade per round. Barstool = two teams play head-to-head, alternating turns, miss → other team can steal for the full point.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ModeRadio
            label="Pub trivia"
            value="pub"
            current={draftMeta.mode}
            onChange={setMode}
            hint="4 rounds × 10 questions"
          />
          <ModeRadio
            label="Barstool"
            value="barstool"
            current={draftMeta.mode}
            onChange={setMode}
            hint="12 rounds × 2 questions"
          />
        </div>
        {draftMeta.mode === 'barstool' && (
          <>
            <div style={{
              marginTop: 14, padding: '10px 12px',
              background: COLORS.panelAlt, border: `1px dashed ${COLORS.border}`,
              borderRadius: 6, fontSize: 12, color: COLORS.textDim,
            }}>
              Current rounds: {draft.length} × {draft[0]?.questions.length ?? 0} questions.
              {' '}
              <button
                onClick={applyBarstoolDefaults}
                style={{
                  border: 0, background: 'transparent', color: COLORS.accent,
                  textDecoration: 'underline', cursor: 'pointer', padding: 0,
                  fontFamily: 'inherit', fontSize: 12,
                }}
              >
                Reset rounds to barstool defaults (12 × 2)
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field
                label="Team 1"
                value={draftMeta.teams?.a ?? 'Team 1'}
                onChange={(v) => updateMeta('teams', 'a', v)}
                compact
              />
              <Field
                label="Team 2"
                value={draftMeta.teams?.b ?? 'Team 2'}
                onChange={(v) => updateMeta('teams', 'b', v)}
                compact
              />
              <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 6 }}>
                These names are the default for new games. Hosts can also rename teams on the setup slide; that change syncs back here automatically.
              </div>
            </div>
          </>
        )}
      </Card>

      <Card title="Slides to Include">
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>
          Toggle off any optional slides this game won&apos;t use. Hidden slides are skipped in the deck and the slide outline.
        </div>
        <Toggle
          label="Prize slide"
          value={draftMeta.show.prize}
          onChange={(v) => updateMeta('show', 'prize', v)}
        />
        <Toggle
          label="Costume contest"
          value={draftMeta.show.costumeContest}
          onChange={(v) => updateMeta('show', 'costumeContest', v)}
        />
        <Toggle
          label="Picture round (R1 opener + instructions + intermission + recap)"
          value={draftMeta.show.pictureRound}
          onChange={(v) => updateMeta('show', 'pictureRound', v)}
        />
        <Toggle
          label="Tiebreakers (intro + 3 sudden-death questions)"
          value={draftMeta.show.tiebreakers}
          onChange={(v) => updateMeta('show', 'tiebreakers', v)}
        />
      </Card>

      <Card title="Title Slide">
        <Field label="Eyebrow" value={draftMeta.title.eyebrow} onChange={(v) => updateMeta('title', 'eyebrow', v)} />
        <Field label="Hero" value={draftMeta.title.hero} onChange={(v) => updateMeta('title', 'hero', v)} />
        <Field label="Edition" value={draftMeta.title.edition} onChange={(v) => updateMeta('title', 'edition', v)} />
        <Field label="Hosts" value={draftMeta.title.hosts} onChange={(v) => updateMeta('title', 'hosts', v)} />
        <Field label="Footer" value={draftMeta.title.footerDate} onChange={(v) => updateMeta('title', 'footerDate', v)} />
      </Card>

      <Card title="End Slide">
        <Field label="Line 1" value={draftMeta.end.hero1} onChange={(v) => updateMeta('end', 'hero1', v)} />
        <Field label="Line 2" value={draftMeta.end.hero2} onChange={(v) => updateMeta('end', 'hero2', v)} />
        <Field label="Subtitle" value={draftMeta.end.subtitle} onChange={(v) => updateMeta('end', 'subtitle', v)} />
      </Card>

      {draft.map((r, ri) => (
        <Card key={r.n} title={`Round ${r.n}`}>
          <Field label="Title" value={r.title} onChange={(v) => update([ri, 'title'], v)} />
          <Field label="Subtitle" value={r.subtitle} onChange={(v) => update([ri, 'subtitle'], v)} multiline />
          <Field label="Kicker" value={r.kicker} onChange={(v) => update([ri, 'kicker'], v)} />
          <div style={{ marginTop: 14, fontSize: 11, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: COLORS.textDim }}>
            Questions
          </div>
          {r.questions.map((q, qi) => (
            <QuestionEditor
              key={qi}
              index={qi}
              question={q}
              onChange={(field, value) => updateQuestion(ri, qi, field, value)}
            />
          ))}
        </Card>
      ))}
      <Card title="Tiebreakers — Final Wager">
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>
          Used after the final round if teams are tied. Tied teams wager from their score, then write an answer — Final Jeopardy style. Up to three questions.
        </div>
        {draftTiebreakers.map((t, i) => (
          <Field
            key={i}
            label={`TB${i + 1}`}
            value={t}
            onChange={(v) => updateTiebreaker(i, v)}
            multiline
            compact
          />
        ))}
      </Card>
      {csvImport && (
        <CsvImportModal
          csvImport={csvImport}
          rounds={draft}
          onApply={applyCsvMapping}
          onCancel={() => setCsvImport(null)}
        />
      )}
    </div>
  );
}

function CsvImportModal({ csvImport, rounds, onApply, onCancel }) {
  const { categories, buckets } = csvImport;
  const [mapping, setMapping] = useState(() => {
    const init = { tb: '' };
    rounds.forEach((r, idx) => {
      init[`r${r.n}`] = categories[idx] || '';
    });
    return init;
  });
  const setSlot = (key, value) => setMapping((m) => ({ ...m, [key]: value }));
  const totalAssigned = Object.values(mapping).filter(Boolean).length;

  const slots = [
    ...rounds.map((r) => ({ key: `r${r.n}`, label: `Round ${r.n} — ${r.title || '(untitled)'}` })),
    { key: 'tb', label: `Tiebreakers (uses first 3 questions)` },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      padding: 24,
    }}>
      <div style={{
        background: COLORS.panel, color: COLORS.text, border: `1px solid ${COLORS.border}`,
        borderRadius: 10, width: 'min(640px, 100%)', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${COLORS.border}`,
          fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
        }}>
          CSV Import — Pick a Round for Each Category
        </div>
        <div style={{ padding: '14px 18px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: COLORS.textDim }}>
            Found {categories.length} {categories.length === 1 ? 'category' : 'categories'}: {' '}
            {categories.map((c) => `${c} (${buckets[c].length})`).join(', ')}.
            Rounds you don&apos;t map stay as they are.
          </div>
          {slots.map((s) => (
            <label key={s.key} style={{
              display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, alignItems: 'center',
            }}>
              <span style={{ fontSize: 13 }}>{s.label}</span>
              <select
                value={mapping[s.key]}
                onChange={(e) => setSlot(s.key, e.target.value)}
                style={{
                  padding: '6px 8px', background: COLORS.bg, color: COLORS.text,
                  border: `1px solid ${COLORS.border}`, borderRadius: 6,
                  fontFamily: 'inherit', fontSize: 13,
                }}
              >
                <option value="">(keep current)</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c} ({buckets[c].length})</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div style={{
          padding: '12px 18px', borderTop: `1px solid ${COLORS.border}`,
          display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: COLORS.textDim, marginRight: 'auto' }}>
            {totalAssigned === 0 ? 'No slots mapped yet.' : `${totalAssigned} ${totalAssigned === 1 ? 'slot' : 'slots'} will be replaced.`}
          </span>
          <Button onClick={onCancel} secondary>Cancel</Button>
          <Button onClick={() => onApply(mapping)} primary disabled={totalAssigned === 0}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PICTURES PANEL — paste images, preview, export to clipboard / disk
// ============================================================
function PicturesPanel({ pastes, commitPastes }) {
  const [focusedCell, setFocusedCell] = useState(null);
  const [status, setStatus] = useState('');
  const items = useMemo(() => mergeItems(pastes), [pastes]);

  const setStatusFlash = useCallback((msg) => {
    setStatus(msg);
    setTimeout(() => setStatus((s) => (s === msg ? '' : s)), 2400);
  }, []);

  const handlePaste = useCallback((i, e) => {
    const clipItems = e.clipboardData?.items || [];
    for (const item of clipItems) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = () => {
          // Reset crop position when a new image lands so old framing
          // doesn't carry over to the new picture.
          const next = pastes.map((p, idx) =>
            idx === i ? { ...p, dataUrl: reader.result, position: { x: 50, y: 50 } } : p
          );
          commitPastes(next);
          setStatusFlash(`Pasted into cell ${String(i + 1).padStart(2, '0')}`);
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  }, [pastes, commitPastes, setStatusFlash]);

  const handleDrop = useCallback((i, e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = pastes.map((p, idx) =>
        idx === i ? { ...p, dataUrl: reader.result, position: { x: 50, y: 50 } } : p
      );
      commitPastes(next);
      setStatusFlash(`Loaded image into cell ${String(i + 1).padStart(2, '0')}`);
    };
    reader.readAsDataURL(file);
  }, [pastes, commitPastes, setStatusFlash]);

  const setCellPosition = useCallback((i, position) => {
    const next = pastes.map((p, idx) =>
      idx === i ? { ...p, position } : p
    );
    commitPastes(next);
  }, [pastes, commitPastes]);

  const clearCell = (i) => {
    const next = pastes.map((p, idx) =>
      idx === i ? { dataUrl: null, caption: null, position: { x: 50, y: 50 } } : p
    );
    commitPastes(next);
  };

  const clearAll = () => {
    if (!confirm('Clear all pasted pictures? This will reset every cell.')) return;
    clearPastes();
    commitPastes(loadPastes());
    setStatusFlash('All pastes cleared');
  };

  const onCopy = async () => {
    try {
      await copyHandoutToClipboard(items);
      setStatusFlash('Handout copied to clipboard');
    } catch (e) {
      setStatusFlash(`Copy failed: ${e.message}`);
    }
  };

  const onDownload = async () => {
    try {
      await downloadHandoutPng(items);
      setStatusFlash('Handout PNG downloaded');
    } catch (e) {
      setStatusFlash(`Download failed: ${e.message}`);
    }
  };

  const onSaveImages = async () => {
    try {
      const count = await downloadAllImages(items);
      if (count === 0) setStatusFlash('No images to save — paste some first');
      else setStatusFlash(`Downloaded ${count} image${count === 1 ? '' : 's'} → drop into public/images/`);
    } catch (e) {
      setStatusFlash(`Save failed: ${e.message}`);
    }
  };

  const onDownloadAnswers = async () => {
    try {
      await downloadAnswersHandoutPng();
      setStatusFlash('Answers handout downloaded — photocopy one per team per round');
    } catch (e) {
      setStatusFlash(`Download failed: ${e.message}`);
    }
  };

  // Cmd/Ctrl+S → Save Images to Disk (the labeled "Save" action on this tab).
  const onSaveImagesRef = useRef(onSaveImages);
  onSaveImagesRef.current = onSaveImages;
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key !== 's' && e.key !== 'S') return;
      e.preventDefault();
      onSaveImagesRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Picture Round — paste images, then export">
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 14 }}>
          Click a cell to focus it, then ⌘V (Mac) / Ctrl+V to paste an image. Or drag-drop a file.
          Once an image is in a cell, <strong>drag the image</strong> to crop / re-frame it; the ↺ button resets the crop.
          Pastes live in <code>localStorage</code>; click <strong>Save Images to Disk</strong> when done
          to download them as <code>{PICTURE_FILENAME(0)}</code> … and drop them into <code>public/images/</code>.
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12,
          aspectRatio: `${1920 - 160} / ${1080 - 300}`,
        }}>
          {pastes.map((p, i) => (
            <PictureCell
              key={i}
              i={i}
              dataUrl={p.dataUrl}
              fallbackSrc={items[i].src}
              isPasted={items[i].isPasted}
              position={items[i].position}
              focused={focusedCell === i}
              onFocus={() => setFocusedCell(i)}
              onPaste={(e) => handlePaste(i, e)}
              onDrop={(e) => handleDrop(i, e)}
              onClear={() => clearCell(i)}
              onPositionChange={(pos) => setCellPosition(i, pos)}
            />
          ))}
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={onCopy} primary>Copy Handout to Clipboard</Button>
          <Button onClick={onDownload}>Download Handout PNG</Button>
          <Button onClick={onSaveImages}>Save Images to Disk</Button>
          <Button onClick={onDownloadAnswers}>Download Answers Handout</Button>
          <Button onClick={clearAll} secondary>Clear All</Button>
          {status && (
            <span style={{ marginLeft: 8, fontSize: 12, color: COLORS.accent }}>
              {status}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

function PictureCell({
  i, dataUrl, fallbackSrc, isPasted, position, focused,
  onFocus, onPaste, onDrop, onClear, onPositionChange,
}) {
  const ref = useRef(null);
  const [diskFailed, setDiskFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const showSrc = dataUrl || (!diskFailed ? fallbackSrc : null);
  const isPositioned = (position?.x ?? 50) !== 50 || (position?.y ?? 50) !== 50;

  // Drag-to-pan: when an image is loaded, holding pointer down and dragging
  // shifts the visible crop. We translate pixel deltas into objectPosition
  // percentage deltas, inverted (drag right = show more of the right edge).
  const onPointerDown = (e) => {
    if (!showSrc) return;          // empty cell: leave click→focus behavior alone
    if (e.button !== 0) return;    // left click only
    e.preventDefault();
    const rect = ref.current.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startPos = { x: position?.x ?? 50, y: position?.y ?? 50 };
    let moved = false;
    const onMove = (e2) => {
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;  // ignore tiny jitters
      moved = true;
      setDragging(true);
      const nx = clamp(startPos.x - (dx / rect.width) * 100, 0, 100);
      const ny = clamp(startPos.y - (dy / rect.height) * 100, 0, 100);
      onPositionChange({ x: nx, y: ny });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      onFocus={onFocus}
      onClick={() => ref.current?.focus()}
      onPaste={onPaste}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
      style={{
        position: 'relative', aspectRatio: '1 / 1', borderRadius: 6,
        border: `2px solid ${focused ? COLORS.accent : COLORS.border}`,
        background: COLORS.bg, overflow: 'hidden',
        cursor: showSrc ? (dragging ? 'grabbing' : 'grab') : 'pointer',
        outline: 'none', userSelect: 'none', touchAction: 'none',
      }}
    >
      {showSrc ? (
        <img
          src={showSrc}
          alt={`Picture ${i + 1}`}
          draggable={false}
          onError={() => { if (!isPasted) setDiskFailed(true); }}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            objectPosition: `${position?.x ?? 50}% ${position?.y ?? 50}%`,
            pointerEvents: 'none',  // pointer events go to the cell so drag works
          }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: COLORS.textDim, fontSize: 11,
          letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>
          {focused ? 'Paste image' : 'Empty'}
        </div>
      )}
      <div style={{
        position: 'absolute', top: 6, left: 6,
        width: 28, height: 28, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 12, fontWeight: 700,
        background: COLORS.accent, color: COLORS.bg, borderRadius: 4,
        fontFamily: 'Oswald, sans-serif', pointerEvents: 'none',
      }}>
        {String(i + 1).padStart(2, '0')}
      </div>
      {showSrc && isPositioned && (
        <button
          type="button"
          title="Reset crop"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onPositionChange({ x: 50, y: 50 });
          }}
          style={{
            position: 'absolute', top: 6, right: 34, width: 22, height: 22,
            border: 0, borderRadius: 4, background: COLORS.panelAlt, color: COLORS.text,
            fontSize: 12, lineHeight: '20px', cursor: 'pointer',
          }}
        >↺</button>
      )}
      {dataUrl && (
        <button
          type="button"
          title="Clear cell"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          style={{
            position: 'absolute', top: 6, right: 6, width: 22, height: 22,
            border: 0, borderRadius: 4, background: COLORS.danger, color: '#fff',
            fontSize: 14, lineHeight: '20px', cursor: 'pointer',
          }}
        >×</button>
      )}
      {isPasted && (
        <div style={{
          position: 'absolute', bottom: 4, right: 6, fontSize: 9,
          letterSpacing: '0.18em', textTransform: 'uppercase', color: COLORS.warn,
          textShadow: '0 1px 2px rgba(0,0,0,0.6)', pointerEvents: 'none',
        }}>
          Pasted
        </div>
      )}
    </div>
  );
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ============================================================
// QUESTION EDITOR — prompt + answer always visible; media fields collapse
// behind a toggle so the round panel stays scannable. Hidden fields keep any
// values they had (no destructive collapse).
// ============================================================
function QuestionEditor({ index, question, onChange }) {
  const data = normalizeQuestion(question);
  const hasMedia = !!(data.audioUrl || data.imageUrl || data.videoUrl || data.displayHint);
  const [expanded, setExpanded] = useState(hasMedia);
  return (
    <div style={{
      marginTop: 8, padding: '8px 0', borderTop: `1px solid ${COLORS.border}`,
    }}>
      <Field
        label={`Q${index + 1}`}
        value={data.prompt || ''}
        onChange={(v) => onChange('prompt', v)}
        multiline
        compact
      />
      <Field
        label="Answer"
        value={data.answer || ''}
        onChange={(v) => onChange('answer', v)}
        compact
      />
      <div style={{ marginTop: 4, marginLeft: 92 }}>
        <button
          onClick={() => setExpanded((x) => !x)}
          style={{
            border: 0, background: 'transparent', color: COLORS.textDim,
            fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.12em',
            textTransform: 'uppercase', cursor: 'pointer', padding: '2px 0',
          }}
        >
          {expanded ? '▾ Hide media' : `▸ Media${hasMedia ? ' (set)' : ''}`}
        </button>
      </div>
      {expanded && (
        <>
          <Field label="Hint" value={data.displayHint || ''} onChange={(v) => onChange('displayHint', v)} compact />
          <Field label="Audio" value={data.audioUrl || ''} onChange={(v) => onChange('audioUrl', v)} compact />
          <Field label="Image" value={data.imageUrl || ''} onChange={(v) => onChange('imageUrl', v)} compact />
          <Field label="Video" value={data.videoUrl || ''} onChange={(v) => onChange('videoUrl', v)} compact />
        </>
      )}
    </div>
  );
}

// ModeRadio — visual radio for Pub vs Barstool. Keeps state lifted (current +
// onChange come from the editor's draft).
function ModeRadio({ label, value, current, onChange, hint }) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      style={{
        flex: 1, padding: '10px 14px', borderRadius: 8, textAlign: 'left',
        border: `1px solid ${selected ? COLORS.accent : COLORS.border}`,
        background: selected ? COLORS.accentDim : COLORS.panel,
        color: selected ? COLORS.accent : COLORS.text,
        fontFamily: 'inherit', cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
        {label}
      </div>
      {hint && (
        <div style={{ marginTop: 4, fontSize: 11, color: COLORS.textDim }}>
          {hint}
        </div>
      )}
    </button>
  );
}

// ============================================================
// PRIMITIVES
// ============================================================
function Card({ title, children, compact = false }) {
  return (
    <section style={{
      background: COLORS.panel, border: `1px solid ${COLORS.border}`,
      borderRadius: 10, padding: compact ? '12px 16px' : 16,
    }}>
      {title && (
        <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: COLORS.textDim, marginBottom: 12 }}>
          {title}
        </div>
      )}
      {children}
    </section>
  );
}

function Button({ children, onClick, primary = false, secondary = false, disabled = false }) {
  const bg = disabled ? COLORS.panelAlt : (primary ? COLORS.accent : (secondary ? 'transparent' : COLORS.panelAlt));
  const color = disabled ? COLORS.textDim : (primary ? COLORS.bg : COLORS.text);
  const border = secondary ? `1px solid ${COLORS.border}` : '1px solid transparent';
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '8px 14px', borderRadius: 6, border, background: bg, color,
      fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      {children}
    </button>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 12, marginTop: 10,
      cursor: 'pointer', userSelect: 'none',
    }}>
      <span style={{
        position: 'relative', width: 36, height: 20, flex: '0 0 auto',
        background: value ? COLORS.accent : COLORS.border, borderRadius: 999,
        transition: 'background 120ms ease',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: COLORS.bg,
          transition: 'left 120ms ease',
        }} />
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        />
      </span>
      <span style={{ fontSize: 13, color: COLORS.text }}>{label}</span>
    </label>
  );
}

function Field({ label, value, onChange, multiline = false, compact = false }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <label style={{
      display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, alignItems: 'start',
      marginTop: compact ? 6 : 10,
    }}>
      <span style={{ paddingTop: 8, fontSize: 12, color: COLORS.textDim,
        fontVariantNumeric: 'tabular-nums' }}>
        {label}
      </span>
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={multiline ? 2 : undefined}
        style={{
          width: '100%', padding: '8px 10px',
          background: COLORS.bg, color: COLORS.text,
          border: `1px solid ${COLORS.border}`, borderRadius: 6,
          fontFamily: 'inherit', fontSize: 13, lineHeight: 1.4, resize: multiline ? 'vertical' : 'none',
        }}
      />
    </label>
  );
}

// ============================================================
// SLIDE OUTLINE — mirrors the composition in App.jsx so the control window
// can show a meaningful slide list and previews without rendering the slides.
// Keep this in sync with App.jsx's slide composition.
// ============================================================
function buildSlideOutline(rounds, tiebreakers = [], meta = DEFAULT_META) {
  const isBarstool = meta.mode === 'barstool';
  const titleEdition = meta.title?.edition || DEFAULT_META.title.edition;
  const endLines = `${meta.end?.hero1 || ''} ${meta.end?.hero2 || ''}`.trim();
  const list = [];
  if (isBarstool) {
    list.push({ key: 'setup', label: 'Setup — Team Names + Start' });
  }
  list.push(
    { key: 'title', label: `Title — ${titleEdition}` },
    { key: 'rules', label: isBarstool ? 'Rules — Head-to-Head + Steal' : 'House Rules' },
  );
  if (meta.show?.prize ?? true) {
    list.push({ key: 'prize', label: 'Grand Prize — $100 Gift Card' });
  }
  if (meta.show?.costumeContest ?? true) {
    list.push({ key: 'costume', label: 'Costume Contest' });
  }
  if (meta.show?.pictureRound ?? true) {
    list.push(
      { key: 'r1-open', label: 'Round 1 Opener — Picture Round' },
      { key: 'r1-instr', label: 'Round 1 Instructions' },
      { key: 'int-r1', label: 'Intermission · Round 1 (collect sheets)' },
      { key: 'r1-recap', label: 'Picture Round Recap (5×2 grid)' },
    );
  }
  const pictureRoundShown = meta.show?.pictureRound ?? true;
  rounds.forEach((r) => {
    const displayN = displayRoundNumber(r.n, meta.mode, pictureRoundShown);
    list.push({ key: `r${r.n}-open`, label: `Round ${displayN} Opener — ${r.title}` });
    r.questions.forEach((q, qi) => {
      const data = normalizeQuestion(q);
      list.push({
        key: `r${r.n}-q${qi + 1}`,
        label: `Round ${displayN} · Question ${qi + 1} / ${r.questions.length}`,
        detail: data.prompt,
      });
    });
    // Pub mode wraps each round with intermission + recap. Barstool skips both.
    if (!isBarstool) {
      list.push({
        key: `int-r${r.n}`,
        label: `Intermission · Round ${displayN} (collect sheets)`,
      });
      recapSplitsFor(r).forEach(([start, end], i) => {
        const part = String.fromCharCode(65 + i);
        const range = `Q${String(start + 1).padStart(2, '0')}–${String(end).padStart(2, '0')}`;
        list.push({
          key: `r${r.n}-recap-${String.fromCharCode(97 + i)}`,
          label: `Round ${displayN} Recap ${part} — ${range}`,
        });
      });
    }
  });
  list.push({
    key: 'end',
    label: isBarstool ? 'End — Final Scoreboard' : `End — ${endLines || 'Thanks for Playing'}`,
  });
  if (meta.show?.tiebreakers ?? true) {
    list.push({ key: 'tb-intro', label: 'Tiebreakers — Final Wager (only if tied)' });
    tiebreakers.forEach((prompt, i) => {
      list.push({
        key: `tb-q${i + 1}`,
        label: `Tiebreaker · Question ${i + 1} / ${tiebreakers.length}`,
        detail: prompt,
      });
    });
  }
  return list;
}

// Make defaults importable for fallback rendering during initial load.
export { DEFAULT_ROUNDS, DEFAULT_TIEBREAKERS };
