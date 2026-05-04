import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadRounds, saveRounds, resetRounds, DEFAULT_ROUNDS,
  loadTiebreakers, saveTiebreakers, resetTiebreakers, DEFAULT_TIEBREAKERS,
  buildQuestionsExport, parseQuestionsImport, recapSplitsFor,
} from './rounds.js';
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

// ============================================================
// CONTROL APP
// ============================================================
export default function ControlApp() {
  const [rounds, setRounds] = useState(() => loadRounds());
  const [tiebreakers, setTiebreakers] = useState(() => loadTiebreakers());
  const [pastes, setPastes] = useState(() => loadPastes());
  const [tab, setTab] = useState('present');
  const [currentSlide, setCurrentSlide] = useState({ index: 0, total: 0, label: '' });
  const [timer, setTimer] = useState({ seconds: 0, paused: false, enabled: false });

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

  const commitPastes = useCallback((next) => {
    setPastes(next);
    savePastes(next);
    broadcast('pictures:update', next);
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
      {tab === 'present' && (
        <PresenterPanel
          currentSlide={currentSlide}
          timer={timer}
          rounds={rounds}
          tiebreakers={tiebreakers}
        />
      )}
      {tab === 'edit' && (
        <EditorPanel
          rounds={rounds}
          tiebreakers={tiebreakers}
          commitRounds={commitRounds}
          commitTiebreakers={commitTiebreakers}
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
function PresenterPanel({ currentSlide, timer, rounds, tiebreakers }) {
  const slideList = useMemo(() => buildSlideOutline(rounds, tiebreakers), [rounds, tiebreakers]);

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
function EditorPanel({ rounds, tiebreakers, commitRounds, commitTiebreakers }) {
  const [draft, setDraft] = useState(rounds);
  const [draftTiebreakers, setDraftTiebreakers] = useState(tiebreakers);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef(null);

  // If the persisted data changes externally (e.g. another window saved), pull
  // it in — but only when not editing, to avoid clobbering in-flight edits.
  useEffect(() => {
    if (!dirty) setDraft(rounds);
  }, [rounds, dirty]);
  useEffect(() => {
    if (!dirty) setDraftTiebreakers(tiebreakers);
  }, [tiebreakers, dirty]);

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

  const updateTiebreaker = (i, value) => {
    setDirty(true);
    setDraftTiebreakers((tb) => tb.map((t, idx) => (idx === i ? value : t)));
  };

  const save = () => {
    commitRounds(draft);
    commitTiebreakers(draftTiebreakers);
    setDirty(false);
  };
  const revert = () => {
    setDraft(rounds);
    setDraftTiebreakers(tiebreakers);
    setDirty(false);
  };
  const reset = () => {
    if (!confirm('Reset all questions and tiebreakers to the original placeholders? This will discard your edits.')) return;
    resetRounds();
    resetTiebreakers();
    const freshRounds = loadRounds();
    const freshTiebreakers = loadTiebreakers();
    setDraft(freshRounds);
    setDraftTiebreakers(freshTiebreakers);
    setDirty(false);
    commitRounds(freshRounds);
    commitTiebreakers(freshTiebreakers);
  };

  const onExport = () => {
    const payload = buildQuestionsExport(draft, draftTiebreakers);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `star-wars-trivia-questions-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onImportClick = () => fileInputRef.current?.click();

  const onImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { rounds: nextRounds, tiebreakers: nextTb } = parseQuestionsImport(reader.result);
        setDraft(nextRounds);
        setDraftTiebreakers(nextTb);
        setDirty(true);
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }
    };
    reader.onerror = () => alert('Could not read file.');
    reader.readAsText(file);
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
      }}>
        <Button onClick={save} primary disabled={!dirty}>Save & Push to Display</Button>
        <Button onClick={revert} disabled={!dirty}>Revert</Button>
        <Button onClick={reset} secondary>Reset to Defaults</Button>
        <span style={{ width: 1, height: 24, background: COLORS.border, margin: '0 4px' }} />
        <Button onClick={onExport}>Export</Button>
        <Button onClick={onImportClick}>Import…</Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={onImportFile}
          style={{ display: 'none' }}
        />
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
function buildSlideOutline(rounds, tiebreakers = []) {
  const list = [
    { key: 'title', label: 'Title — May the Fourth' },
    { key: 'rules', label: 'House Rules' },
    { key: 'prize', label: 'Grand Prize — $100 Gift Card' },
    { key: 'costume', label: 'Costume Contest' },
    { key: 'r1-open', label: 'Round 1 Opener — Picture Round' },
    { key: 'r1-instr', label: 'Round 1 Instructions' },
    { key: 'r1-recap', label: 'Picture Round Recap (5×2 grid)' },
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
    recapSplitsFor(r).forEach(([start, end], i) => {
      const part = String.fromCharCode(65 + i);
      const range = `Q${String(start + 1).padStart(2, '0')}–${String(end).padStart(2, '0')}`;
      list.push({
        key: `r${r.n}-recap-${String.fromCharCode(97 + i)}`,
        label: `Round ${r.n} Recap ${part} — ${range}`,
      });
    });
    if (idx < rounds.length - 1) {
      const next = rounds[idx + 1];
      list.push({ key: `int-${next.n}`, label: `Intermission · Before Round ${next.n}` });
    }
  });
  list.push({ key: 'end', label: 'End — May the Force Be With You' });
  // Tiebreakers live past the End slide and are only reached if needed.
  list.push({ key: 'tb-intro', label: 'Tiebreakers — Final Wager (only if tied)' });
  tiebreakers.forEach((prompt, i) => {
    list.push({
      key: `tb-q${i + 1}`,
      label: `Tiebreaker · Question ${i + 1} / ${tiebreakers.length}`,
      detail: prompt,
    });
  });
  return list;
}

// Make defaults importable for fallback rendering during initial load.
export { DEFAULT_ROUNDS, DEFAULT_TIEBREAKERS };
