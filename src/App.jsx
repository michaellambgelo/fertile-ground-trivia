import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useTweaks, TweaksPanel, TweakSection,
  TweakSlider, TweakToggle, TweakRadio,
} from './tweaks-panel.jsx';
import {
  ACCENTS, TitleSlide, RulesSlide, PrizeSlide, CostumeContestSlide,
  RoundOpener, PictureRoundInstructions, IntermissionSlide, QuestionSlide,
  RoundRecap, PictureRoundRecap, EndSlide,
} from './slides.jsx';
import { loadRounds } from './rounds.js';
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
  "timerSeconds": 120
}/*EDITMODE-END*/;

// ============================================================
// APP
// ============================================================
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [rounds, setRounds] = useState(() => loadRounds());
  const [pastes, setPastes] = useState(() => loadPastes());
  const pictureItems = mergeItems(pastes);
  const accent = ACCENTS[tweaks.accent] || ACCENTS["saber-blue"];
  const stageRef = useRef(null);

  // Receive content + nav commands from the /control window.
  useBroadcast(useCallback((msg) => {
    const stage = stageRef.current;
    if (msg.type === 'rounds:update') setRounds(msg.payload);
    else if (msg.type === 'pictures:update') setPastes(msg.payload);
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
      // timer card shows OFF instead of stale numbers.
      const label = e.detail.slide?.getAttribute('data-label') || '';
      if (!/^R\d+ Q\d+/.test(label)) {
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
      subtitle="A galaxy of faces, ships, and places. Played from a paper sheet handed out by the hosts."
      kicker="On Paper"
      tweaks={tweaks} accent={accent}
    />
  );

  // 6. Round 1 instructions
  slides.push(<PictureRoundInstructions key="r1-instr" tweaks={tweaks} accent={accent} />);

  // 7. Picture Round Recap — discussed right after the picture round, before R2
  slides.push(
    <PictureRoundRecap
      key="r1-recap"
      items={pictureItems}
      tweaks={tweaks}
      accent={accent}
    />
  );

  // 8. Intermission to Round 2
  slides.push(
    <IntermissionSlide key="int-r2" label="08 Intermission · Before R2"
      nextRound={2} nextTitle="Original Trilogy"
      tweaks={tweaks} accent={accent}
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
          total={10}
          prompt={prompt}
          roundTitle={r.title}
          tweaks={tweaks}
          accent={accent}
        />
      );
    });

    slides.push(
      <RoundRecap
        key={`r${r.n}-recap`}
        round={r.n}
        roundTitle={r.title}
        questions={r.questions}
        tweaks={tweaks}
        accent={accent}
      />
    );

    // Intermission after rounds 2, 3, 4 (not after final round)
    if (idx < rounds.length - 1) {
      const next = rounds[idx + 1];
      slides.push(
        <IntermissionSlide
          key={`int-${next.n}`}
          label={`Intermission · Before R${next.n}`}
          nextRound={next.n}
          nextTitle={next.title}
          tweaks={tweaks}
          accent={accent}
        />
      );
    }
  });

  // End
  slides.push(<EndSlide key="end" tweaks={tweaks} accent={accent} />);

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
            label="Saber accent"
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
              min={15} max={120} step={5}
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
