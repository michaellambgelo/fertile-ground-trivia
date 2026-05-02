import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadRounds, saveRounds, resetRounds, DEFAULT_ROUNDS } from './rounds.js';
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

// ============================================================
// CONTROL APP
// ============================================================
export default function ControlApp() {
  const [rounds, setRounds] = useState(() => loadRounds());
  const [tab, setTab] = useState('present');
  const [currentSlide, setCurrentSlide] = useState({ index: 0, total: 0, label: '' });
  const [timer, setTimer] = useState({ seconds: 0, paused: false, enabled: false });

  // Push edits to the display window.
  const commitRounds = useCallback((next) => {
    setRounds(next);
    saveRounds(next);
    broadcast('rounds:update', next);
  }, []);

  // Listen for slide / timer state coming back from the display window.
  useBroadcast(useCallback((msg) => {
    if (msg.type === 'slidechange') setCurrentSlide(msg.payload);
    else if (msg.type === 'timer:state') setTimer(msg.payload);
  }, []));

  // On mount, ask display for current state in case it was already running.
  useEffect(() => {
    broadcast('sync:request', null);
  }, []);

  return (
    <div style={baseStyle}>
      <Header tab={tab} setTab={setTab} currentSlide={currentSlide} />
      {tab === 'present' ? (
        <PresenterPanel
          currentSlide={currentSlide}
          timer={timer}
          rounds={rounds}
        />
      ) : (
        <EditorPanel
          rounds={rounds}
          commitRounds={commitRounds}
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
  ];
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 24, padding: '14px 24px',
      borderBottom: `1px solid ${COLORS.border}`, background: COLORS.panel,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
        fontSize: 12, color: COLORS.accent }}>
        ★ Trivia Control
      </div>
      <nav style={{ display: 'flex', gap: 4 }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid transparent',
              background: tab === t.id ? COLORS.accentDim : 'transparent',
              color: tab === t.id ? COLORS.accent : COLORS.textDim,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
            {t.label}
          </button>
        ))}
      </nav>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center',
        fontSize: 12, color: COLORS.textDim }}>
        <span>
          Slide{' '}
          <strong style={{ color: COLORS.text }}>
            {currentSlide.total > 0 ? currentSlide.index + 1 : '—'}
          </strong>
          {' / '}
          {currentSlide.total || '—'}
        </span>
        {currentSlide.label && (
          <span style={{ color: COLORS.text }}>· {currentSlide.label}</span>
        )}
      </div>
    </header>
  );
}

// ============================================================
// PRESENTER PANEL — nav + timer + slide list
// ============================================================
function PresenterPanel({ currentSlide, timer, rounds }) {
  const slideList = useMemo(() => buildSlideOutline(rounds), [rounds]);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, padding: 16,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <NavCard currentSlide={currentSlide} slideList={slideList} />
        <TimerCard timer={timer} />
      </div>
      <SlideList slideList={slideList} currentIndex={currentSlide.index} />
    </div>
  );
}

function NavCard({ currentSlide, slideList }) {
  const goPrev = () => broadcast('nav:prev', null);
  const goNext = () => broadcast('nav:next', null);
  const goReset = () => broadcast('nav:goto', 0);
  const current = slideList[currentSlide.index];
  const next = slideList[currentSlide.index + 1];

  return (
    <Card title="Navigation">
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={goPrev}>← Previous</Button>
        <Button onClick={goNext} primary>Next →</Button>
        <Button onClick={goReset} secondary>Reset to Title</Button>
      </div>
      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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

function SlideList({ slideList, currentIndex }) {
  return (
    <Card title={`Slide List (${slideList.length})`} compact>
      <div style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', margin: '-12px -16px',
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
function EditorPanel({ rounds, commitRounds }) {
  const [draft, setDraft] = useState(rounds);
  const [dirty, setDirty] = useState(false);

  // If the persisted rounds change externally (e.g. another window saved), pull them in
  // — but only when not editing.
  useEffect(() => {
    if (!dirty) setDraft(rounds);
  }, [rounds, dirty]);

  const update = (path, value) => {
    setDirty(true);
    setDraft((d) => {
      const next = d.map((r) => ({ ...r, questions: [...r.questions] }));
      const [ri, field, qi] = path;
      if (field === 'questions') next[ri].questions[qi] = value;
      else next[ri][field] = value;
      return next;
    });
  };

  const save = () => { commitRounds(draft); setDirty(false); };
  const revert = () => { setDraft(rounds); setDirty(false); };
  const reset = () => {
    if (!confirm('Reset all questions to the original placeholders? This will discard your edits.')) return;
    resetRounds();
    setDraft(loadRounds());
    setDirty(false);
    commitRounds(loadRounds());
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', position: 'sticky', top: 60, zIndex: 5,
        background: COLORS.bg, padding: '8px 0',
      }}>
        <Button onClick={save} primary disabled={!dirty}>Save & Push to Display</Button>
        <Button onClick={revert} disabled={!dirty}>Revert</Button>
        <Button onClick={reset} secondary>Reset to Defaults</Button>
        {dirty && <span style={{ color: COLORS.warn, fontSize: 12 }}>Unsaved changes</span>}
      </div>
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
            <Field
              key={qi}
              label={`Q${qi + 1}`}
              value={q}
              onChange={(v) => update([ri, 'questions', qi], v)}
              multiline
              compact
            />
          ))}
        </Card>
      ))}
    </div>
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
function buildSlideOutline(rounds) {
  const list = [
    { key: 'title', label: 'Title — May the Fourth' },
    { key: 'rules', label: 'House Rules' },
    { key: 'prize', label: 'Grand Prize — $100 Gift Card' },
    { key: 'costume', label: 'Costume Contest' },
    { key: 'r1-open', label: 'Round 1 Opener — Picture Round' },
    { key: 'r1-instr', label: 'Round 1 Instructions' },
    { key: 'int-r2', label: 'Intermission · Before Round 2' },
  ];
  rounds.forEach((r, idx) => {
    list.push({ key: `r${r.n}-open`, label: `Round ${r.n} Opener — ${r.title}` });
    r.questions.forEach((prompt, qi) => {
      list.push({
        key: `r${r.n}-q${qi + 1}`,
        label: `Round ${r.n} · Question ${qi + 1} / 10`,
        detail: prompt,
      });
    });
    list.push({ key: `r${r.n}-recap`, label: `Round ${r.n} Recap — ${r.title}` });
    if (idx < rounds.length - 1) {
      const next = rounds[idx + 1];
      list.push({ key: `int-${next.n}`, label: `Intermission · Before Round ${next.n}` });
    }
  });
  list.push({ key: 'end', label: 'End — May the Force Be With You' });
  return list;
}

// Make DEFAULT_ROUNDS importable for fallback rendering during initial load.
export { DEFAULT_ROUNDS };
