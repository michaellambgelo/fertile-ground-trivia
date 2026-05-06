import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useTweaks, TweaksPanel, TweakSection,
  TweakSlider, TweakToggle, TweakRadio,
} from './tweaks-panel.jsx';
import {
  ACCENTS, TitleSlide, RulesSlide, PrizeSlide, CostumeContestSlide,
  RoundOpener, PictureRoundInstructions, IntermissionSlide, QuestionSlide,
  RoundRecap, PictureRoundRecap, TiebreakerIntroSlide, EndSlide,
} from './slides.jsx';
import { loadRounds, loadTiebreakers, recapSplitsFor } from './rounds.js';
import { loadPastes, mergeItems } from './pictures.js';
import { broadcast, useBroadcast } from './broadcast.js';

// ============================================================
// EDITMODE TWEAK DEFAULTS
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "saber-blue",
  "showStars": true,
  "showQNumbers": true,
  "showTimer": true,
  "timerSeconds": 90
}/*EDITMODE-END*/;

// ============================================================
// APP
// ============================================================
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [rounds, setRounds] = useState(() => loadRounds());
  const [pastes, setPastes] = useState(() => loadPastes());
  const [tiebreakers, setTiebreakers] = useState(() => loadTiebreakers());
  const pictureItems = mergeItems(pastes);
  const accent = ACCENTS[tweaks.accent] || ACCENTS["saber-blue"];
  const stageRef = useRef(null);

  // Receive content + nav commands from the /control window.
  useBroadcast(useCallback((msg) => {
    const stage = stageRef.current;
    if (msg.type === 'rounds:update') setRounds(msg.payload);
    else if (msg.type === 'pictures:update') setPastes(msg.payload);
    else if (msg.type === 'tiebreakers:update') setTiebreakers(msg.payload);
    else if (msg.type === 'nav:next') stage?.next();
    else if (msg.type === 'nav:prev') stage?.prev();
    else if (msg.type === 'nav:goto') stage?.goTo(msg.payload);
    else if (msg.type === 'sync:request' && stage) {
      const slide = stage.querySelector('section[data-deck-active]');
      broadcast('slidechange', describeSlide(stage, slide));
      // QuestionSlide responds with its own timer:state if it's the active slide.
    }
  }, []));

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

  // 1. Title
  slides.push(<TitleSlide key="title" tweaks={tweaks} accent={accent} />);

  // 2. Rules
  slides.push(<RulesSlide key="rules" tweaks={tweaks} accent={accent} />);

  // 3. Prize
  slides.push(<PrizeSlide key="prize" tweaks={tweaks} accent={accent} />);

  // 4. Costume Contest
  slides.push(<CostumeContestSlide key="costume" tweaks={tweaks} accent={accent} />);

  // 5. Round 1 opener
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

  // 6. Round 1 instructions
  slides.push(<PictureRoundInstructions key="r1-instr" tweaks={tweaks} accent={accent} />);

  // 7. Intermission — collect picture-round answer sheets BEFORE the recap
  // reveals them. Teases R2 (the next round after the picture-round recap).
  slides.push(
    <IntermissionSlide key="int-r1" label="Intermission · Round 01"
      nextRound={2} nextTitle="Warm-Up Round"
      tweaks={tweaks} accent={accent}
    />
  );

  // 8. Picture Round Recap — answers revealed after sheets are collected
  slides.push(
    <PictureRoundRecap
      key="r1-recap"
      items={pictureItems}
      tweaks={tweaks}
      accent={accent}
    />
  );

  // Rounds 2-5
  rounds.forEach((r, idx) => {
    slides.push(
      <RoundOpener
        key={`r${r.n}-open`}
        label={`Round 0${r.n} Opener`}
        number={r.n}
        title={r.title}
        subtitle={r.subtitle}
        kicker={r.kicker}
        tweaks={tweaks} accent={accent}
      />
    );

    r.questions.forEach((prompt, qi) => {
      slides.push(
        <QuestionSlide
          key={`r${r.n}-q${qi + 1}`}
          round={r.n}
          q={qi + 1}
          total={r.questions.length}
          prompt={prompt}
          roundTitle={r.title}
          tweaks={tweaks}
          accent={accent}
        />
      );
    });

    // Intermission BEFORE recap so teams hand in sheets before answers are
    // revealed. R2-R4 tease the next round; R5 has no next round, so it teases
    // the final tally instead.
    const next = rounds[idx + 1];
    slides.push(
      <IntermissionSlide
        key={`int-r${r.n}`}
        label={`Intermission · Round 0${r.n}`}
        nextRound={next?.n}
        nextTitle={next?.title}
        nextLabel={next ? undefined : "Final Tally · Winners Revealed"}
        tweaks={tweaks}
        accent={accent}
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
          questions={r.questions.slice(start, end)}
          startIndex={start}
          part={String.fromCharCode(65 + i)}
          tweaks={tweaks}
          accent={accent}
        />
      );
    });
  });

  // End — normal sequential close. Tiebreakers live past this slide, only
  // reached by hitting Next when there's an actual tie at the end of play.
  slides.push(<EndSlide key="end" tweaks={tweaks} accent={accent} />);

  // Tiebreakers — Final Wager (Final Jeopardy style) after the End slide.
  // Skip past these unless teams are tied; advance into them only when needed.
  slides.push(<TiebreakerIntroSlide key="tb-intro" tweaks={tweaks} accent={accent} />);
  tiebreakers.forEach((prompt, i) => {
    slides.push(
      <QuestionSlide
        key={`tb-q${i + 1}`}
        kind="tiebreaker"
        round={5}
        q={i + 1}
        total={tiebreakers.length}
        prompt={prompt}
        roundTitle="Final Wager"
        tweaks={tweaks}
        accent={accent}
      />
    );
  });

  return (
    <>
      <deck-stage ref={stageRef} width="1920" height="1080">
        {slides}
      </deck-stage>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Atmosphere">
          <TweakToggle
            label="Starfield background"
            value={tweaks.showStars}
            onChange={(v) => setTweak("showStars", v)}
          />
          <TweakRadio
            label="Accent"
            value={tweaks.accent}
            onChange={(v) => setTweak("accent", v)}
            options={[
              { value: "saber-blue",  label: "Blue" },
              { value: "saber-green", label: "Green" },
              { value: "saber-red",   label: "Red" },
              { value: "saber-gold",  label: "Gold" },
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
    </>
  );
}

function describeSlide(stage, slide, detail) {
  const total = detail?.total ?? stage.length;
  const index = detail?.index ?? stage.index;
  const label = slide?.getAttribute('data-label') || `Slide ${index + 1}`;
  return { index, total, label };
}

export default App;
