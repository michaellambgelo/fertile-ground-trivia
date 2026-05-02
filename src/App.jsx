import {
  useTweaks, TweaksPanel, TweakSection,
  TweakSlider, TweakToggle, TweakRadio,
} from './tweaks-panel.jsx';
import {
  ACCENTS, TitleSlide, RulesSlide, PrizeSlide, RoundOpener,
  PictureRoundInstructions, IntermissionSlide, QuestionSlide,
  RoundRecap, EndSlide,
} from './slides.jsx';

// ============================================================
// CONTENT — placeholder questions, easy to swap later
// ============================================================
const ROUNDS = [
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
  const accent = ACCENTS[tweaks.accent] || ACCENTS["saber-blue"];

  const slides = [];

  // 1. Title
  slides.push(<TitleSlide key="title" tweaks={tweaks} accent={accent} />);

  // 2. Rules
  slides.push(<RulesSlide key="rules" tweaks={tweaks} accent={accent} />);

  // 3. Prize
  slides.push(<PrizeSlide key="prize" tweaks={tweaks} accent={accent} />);

  // 4. Round 1 opener
  slides.push(
    <RoundOpener
      key="r1-open"
      label="04 Round 1 Opener"
      number={1}
      title="Picture Round"
      subtitle="A galaxy of faces, ships, and places. Played from a paper sheet handed out by the hosts."
      kicker="On Paper"
      tweaks={tweaks} accent={accent}
    />
  );

  // 5. Round 1 instructions
  slides.push(<PictureRoundInstructions key="r1-instr" tweaks={tweaks} accent={accent} />);

  // 6. Intermission to Round 2
  slides.push(
    <IntermissionSlide key="int-r2" label="06 Intermission · Before R2"
      nextRound={2} nextTitle="Original Trilogy"
      tweaks={tweaks} accent={accent}
    />
  );

  // Rounds 2-5
  ROUNDS.forEach((r, idx) => {
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
    if (idx < ROUNDS.length - 1) {
      const next = ROUNDS[idx + 1];
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
      <deck-stage width="1920" height="1080">
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

export default App;
