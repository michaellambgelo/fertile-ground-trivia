import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useTweaks, TweaksPanel, TweakSection,
  TweakSlider, TweakToggle, TweakRadio,
} from './tweaks-panel.jsx';
import {
  ACCENTS, TitleSlide, RulesSlide, PrizeSlide, CostumeContestSlide,
  RoundOpener, PictureRoundInstructions, IntermissionSlide, QuestionSlide,
  RoundRecap, PictureRoundRecap, TiebreakerIntroSlide, EndSlide,
  BarstoolSetupSlide, BarstoolContext,
} from './slides.jsx';
import { loadRounds, loadTiebreakers, recapSplitsFor, normalizeQuestion } from './rounds.js';
import { loadPastes, mergeItems } from './pictures.js';
import { loadMeta } from './meta.js';
import { makeTeams } from './teams.js';
import { playBell, unlockAudio } from './bell.js';
import { broadcast, useBroadcast } from './broadcast.js';

// ============================================================
// EDITMODE TWEAK DEFAULTS
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "accent-red",
  "showStars": false,
  "showQNumbers": true,
  "showTimer": true,
  "timerSeconds": 60
}/*EDITMODE-END*/;

// ============================================================
// PER-ROUND ACCENT ROTATION
// ============================================================
// Theme hook: themed forks fill in `ROUND_ACCENTS` to give each question
// round its own accent color (Pokemon types, LOTR houses, MCU phases, etc.).
// Map round number `n` (matches `DEFAULT_ROUNDS[i].n`, starts at 2) to an
// ACCENTS key. Round 1 (picture round) + title/rules/prize/costume/end use
// the global accent from TWEAK_DEFAULTS. Intermissions preview the NEXT
// round's accent. Empty map (scaffold default) → no rotation; the global
// accent is used everywhere.
const ROUND_ACCENTS = {
  // 2: "accent-red",
  // 3: "accent-blue",
  // 4: "accent-green",
  // 5: "accent-gold",
};
function accentFor(n, global) {
  return ACCENTS[ROUND_ACCENTS[n]] || global;
}

// ============================================================
// APP
// ============================================================
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [rounds, setRounds] = useState(() => loadRounds());
  const [pastes, setPastes] = useState(() => loadPastes());
  const [tiebreakers, setTiebreakers] = useState(() => loadTiebreakers());
  const [meta, setMeta] = useState(() => loadMeta());
  // Session-only team state. Lost on refresh by design — names + scores live
  // only as long as the current game.
  const [teams, setTeams] = useState(() => makeTeams(meta));
  const pictureItems = mergeItems(pastes);
  const accent = ACCENTS[tweaks.accent] || ACCENTS["accent-red"];
  const stageRef = useRef(null);

  // Broadcast team-state changes (typed-in name on setup slide, or any other
  // local change). Control window subscribes to keep its scoring UI in sync.
  const onTeamsChange = useCallback((next) => {
    setTeams(next);
    broadcast('teams:update', next);
  }, []);

  // Receive content + nav commands from the /control window.
  useBroadcast(useCallback((msg) => {
    const stage = stageRef.current;
    if (msg.type === 'rounds:update') setRounds(msg.payload);
    else if (msg.type === 'pictures:update') setPastes(msg.payload);
    else if (msg.type === 'tiebreakers:update') setTiebreakers(msg.payload);
    else if (msg.type === 'meta:update') setMeta(msg.payload);
    else if (msg.type === 'teams:update') setTeams(msg.payload);
    else if (msg.type === 'game:reset') setTeams(makeTeams(meta));
    else if (msg.type === 'score:awarded') playBell();
    else if (msg.type === 'nav:next') stage?.next();
    else if (msg.type === 'nav:prev') stage?.prev();
    else if (msg.type === 'nav:goto') stage?.goTo(msg.payload);
    else if (msg.type === 'sync:request' && stage) {
      const slide = stage.querySelector('section[data-deck-active]');
      broadcast('slidechange', describeSlide(stage, slide));
      broadcast('teams:update', teams);
      // QuestionSlide responds with its own timer:state if it's the active slide.
    }
  }, [meta, teams]));

  // Unlock the audio context on the first user gesture so later
  // `score:awarded` broadcasts (which arrive without a user gesture on this
  // window) can play the bell. Browsers gate audio on user interaction.
  useEffect(() => {
    const handler = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  // Forward slide changes to the /control window.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handler = (e) => {
      broadcast('slidechange', describeSlide(stage, e.detail.slide, e.detail));
      // Clear timer state when leaving any non-question slide so control's
      // timer card shows OFF instead of stale numbers. Question slides
      // (regular rounds + tiebreakers) keep the timer; everything else clears.
      const label = e.detail.slide?.getAttribute('data-label') || '';
      if (!/^(R\d+ Q\d+|TIEBREAKER \d+)/.test(label)) {
        broadcast('timer:state', { enabled: false, seconds: 0, paused: false });
      }
    };
    stage.addEventListener('slidechange', handler);
    return () => stage.removeEventListener('slidechange', handler);
  }, []);

  const slides = [];
  const isBarstool = meta.mode === 'barstool';

  // 0. Barstool setup slide — only in barstool mode, always first.
  if (isBarstool) {
    slides.push(
      <BarstoolSetupSlide
        key="setup"
        tweaks={tweaks}
        accent={accent}
        teams={teams}
        onTeamsChange={onTeamsChange}
      />
    );
  }

  // 1. Title
  slides.push(<TitleSlide key="title" tweaks={tweaks} accent={accent} title={meta.title} />);

  // 2. Rules
  slides.push(<RulesSlide key="rules" tweaks={tweaks} accent={accent} />);

  // 3. Prize (toggleable)
  if (meta.show.prize) {
    slides.push(<PrizeSlide key="prize" tweaks={tweaks} accent={accent} />);
  }

  // 4. Costume Contest (toggleable)
  if (meta.show.costumeContest) {
    slides.push(<CostumeContestSlide key="costume" tweaks={tweaks} accent={accent} />);
  }

  // 5-8. Picture Round (toggleable as a unit: opener + instructions + intermission + recap)
  if (meta.show.pictureRound) {
    slides.push(
      <RoundOpener
        key="r1-open"
        label="05 Round 1 Opener"
        number={1}
        title="Picture Round"
        subtitle="A page of images. Played from a paper sheet handed out by the hosts."
        kicker="On Paper"
        tweaks={tweaks} accent={accent}
      />
    );
    slides.push(<PictureRoundInstructions key="r1-instr" tweaks={tweaks} accent={accent} />);
    slides.push(
      <IntermissionSlide key="int-r1" label="Intermission · Round 01"
        nextRound={2} nextTitle="Warm-Up Round"
        tweaks={tweaks} accent={accent}
      />
    );
    slides.push(
      <PictureRoundRecap
        key="r1-recap"
        items={pictureItems}
        tweaks={tweaks}
        accent={accent}
      />
    );
  }

  // Rounds 2-5 — each round picks up its own accent from ROUND_ACCENTS
  // (empty map = degrade to the global accent).
  rounds.forEach((r, idx) => {
    const roundAccent = accentFor(r.n, accent);
    slides.push(
      <RoundOpener
        key={`r${r.n}-open`}
        label={`Round 0${r.n} Opener`}
        number={r.n}
        title={r.title}
        subtitle={r.subtitle}
        kicker={r.kicker}
        tweaks={tweaks} accent={roundAccent}
      />
    );

    r.questions.forEach((q, qi) => {
      const data = normalizeQuestion(q);
      slides.push(
        <QuestionSlide
          key={`r${r.n}-q${qi + 1}`}
          round={r.n}
          q={qi + 1}
          total={r.questions.length}
          prompt={data.prompt}
          answer={data.answer}
          audioUrl={data.audioUrl}
          imageUrl={data.imageUrl}
          videoUrl={data.videoUrl}
          displayHint={data.displayHint}
          roundTitle={r.title}
          tweaks={tweaks}
          accent={roundAccent}
        />
      );
    });

    // Pub mode wraps each round with intermission + recap slides. In barstool
    // mode with 12 rounds × 2 questions, 12 intermissions/recaps would
    // overwhelm the deck — they're skipped entirely. Tied games still resolve
    // through the toggleable tiebreaker cluster after the End slide.
    if (!isBarstool) {
      // Intermission BEFORE recap so teams hand in sheets before answers are
      // revealed. R2-R4 tease the next round; R5 has no next round, so it teases
      // the final tally instead. Intermission previews the NEXT round's accent.
      const next = rounds[idx + 1];
      const intermissionAccent = next ? accentFor(next.n, accent) : roundAccent;
      slides.push(
        <IntermissionSlide
          key={`int-r${r.n}`}
          label={`Intermission · Round 0${r.n}`}
          nextRound={next?.n}
          nextTitle={next?.title}
          nextLabel={next ? undefined : "Final Tally · Winners Revealed"}
          tweaks={tweaks}
          accent={intermissionAccent}
        />
      );

      // Recap slides per round. Most rounds split 5+5; round 5's prompts run
      // long enough that 5-per-slide gets cramped, so it splits 3+3+4.
      const recapSplits = recapSplitsFor(r);
      recapSplits.forEach(([start, end], i) => {
        slides.push(
          <RoundRecap
            key={`r${r.n}-recap-${String.fromCharCode(97 + i)}`}
            round={r.n}
            roundTitle={r.title}
            questions={r.questions.slice(start, end).map((q) => normalizeQuestion(q).prompt)}
            startIndex={start}
            part={String.fromCharCode(65 + i)}
            tweaks={tweaks}
            accent={roundAccent}
          />
        );
      });
    }
  });

  // End — normal sequential close. Tiebreakers live past this slide, only
  // reached by hitting Next when there's an actual tie at the end of play.
  slides.push(<EndSlide key="end" tweaks={tweaks} accent={accent} end={meta.end} />);

  // Tiebreakers — Final Wager (Final Jeopardy style) after the End slide.
  // Skip past these unless teams are tied; advance into them only when needed.
  if (meta.show.tiebreakers) {
    slides.push(<TiebreakerIntroSlide key="tb-intro" tweaks={tweaks} accent={accent} />);
    tiebreakers.forEach((q, i) => {
      const data = normalizeQuestion(q);
      slides.push(
        <QuestionSlide
          key={`tb-q${i + 1}`}
          kind="tiebreaker"
          round={5}
          q={i + 1}
          total={tiebreakers.length}
          prompt={data.prompt}
          answer={data.answer}
          audioUrl={data.audioUrl}
          imageUrl={data.imageUrl}
          videoUrl={data.videoUrl}
          displayHint={data.displayHint}
          roundTitle="Final Wager"
          tweaks={tweaks}
          accent={accent}
        />
      );
    });
  }

  return (
    <BarstoolContext.Provider value={{ mode: meta.mode, teams }}>
      <deck-stage ref={stageRef} width="1920" height="1080">
        {slides}
      </deck-stage>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Atmosphere">
          <TweakToggle
            label="Ambient backdrop"
            value={tweaks.showStars}
            onChange={(v) => setTweak("showStars", v)}
          />
          <TweakRadio
            label="Accent"
            value={tweaks.accent}
            onChange={(v) => setTweak("accent", v)}
            options={[
              { value: "accent-blue",  label: "Blue" },
              { value: "accent-green", label: "Green" },
              { value: "accent-red",   label: "Red" },
              { value: "accent-gold",  label: "Gold" },
            ]}
          />
        </TweakSection>

        <TweakSection title="Question slides">
          <TweakToggle
            label="Show question numbers"
            value={tweaks.showQNumbers}
            onChange={(v) => setTweak("showQNumbers", v)}
          />
          <TweakToggle
            label="Show timer"
            value={tweaks.showTimer}
            onChange={(v) => setTweak("showTimer", v)}
          />
          {tweaks.showTimer && (
            <TweakSlider
              label="Timer seconds"
              min={15} max={90} step={5}
              value={tweaks.timerSeconds}
              onChange={(v) => setTweak("timerSeconds", v)}
            />
          )}
        </TweakSection>
      </TweaksPanel>
    </BarstoolContext.Provider>
  );
}

function describeSlide(stage, slide, detail) {
  const total = detail?.total ?? stage.length;
  const index = detail?.index ?? stage.index;
  const label = slide?.getAttribute('data-label') || `Slide ${index + 1}`;
  return { index, total, label };
}

export default App;
