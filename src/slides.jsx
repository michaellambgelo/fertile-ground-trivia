import React, { useState, useEffect, useRef, useCallback } from 'react';
import { broadcast, useBroadcast } from './broadcast.js';

// ============================================================
// DESIGN SYSTEM — Retro pulp / vintage poster, saber-blue accent
// ============================================================
const TYPE_SCALE = {
  display: 132,   // hero numerals
  title: 88,      // section / round titles
  subtitle: 56,   // q-numbers, secondary headers
  body: 36,       // question prompts
  meta: 28,       // labels, eyebrows
  small: 24,      // captions, footers
};

const SPACING = {
  paddingTop: 100,
  paddingBottom: 90,
  paddingX: 120,
  titleGap: 48,
  itemGap: 28,
};

// Default palette — overridden by Tweaks
const DEFAULTS = {
  accent: "saber-blue",       // saber-blue | saber-green | saber-red | saber-gold
  showStars: true,
  showQNumbers: true,
  showTimer: false,
  timerSeconds: 30,
};

const ACCENTS = {
  "saber-blue":  { hex: "#5BC8FF", glow: "rgba(91, 200, 255, 0.55)", name: "BLUE" },
  "saber-green": { hex: "#7CFF8A", glow: "rgba(124, 255, 138, 0.55)", name: "GREEN" },
  "saber-red":   { hex: "#FF5A5A", glow: "rgba(255, 90, 90, 0.6)",   name: "RED" },
  "saber-gold":  { hex: "#FFC857", glow: "rgba(255, 200, 87, 0.55)", name: "GOLD" },
};

const PALETTE = {
  ink: "#0B0E1A",            // deep space navy-black
  inkDeep: "#06080F",
  paper: "#F2E9D8",          // cream pulp paper
  paperDim: "#D8CDB6",
  rust: "#B14A2A",            // pulp-poster rust
  gold: "#E0A93B",            // crawl gold (always available as secondary)
};

// ============================================================
// SHARED STYLE OBJECTS
// ============================================================
const slideBase = {
  width: "100%",
  height: "100%",
  position: "relative",
  overflow: "hidden",
  fontFamily: "'Inter', system-ui, sans-serif",
  color: PALETTE.paper,
  background: PALETTE.ink,
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
};

const displayFont = "'Oswald', 'Bebas Neue', Impact, sans-serif";

// ============================================================
// BACKGROUND ATMOSPHERE — Starfield + vignette + halftone
// ============================================================
function Starfield({ visible = true, density = 1 }) {
  // Pre-rendered star positions (deterministic) for performance & no flicker
  const stars = React.useMemo(() => {
    const arr = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const count = Math.round(220 * density);
    for (let i = 0; i < count; i++) {
      arr.push({
        x: rnd() * 100,
        y: rnd() * 100,
        s: rnd() * 1.6 + 0.4,
        o: rnd() * 0.6 + 0.25,
        tw: rnd() > 0.85,
      });
    }
    return arr;
  }, [density]);

  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      opacity: visible ? 1 : 0, transition: "opacity 600ms ease",
    }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="none">
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x * 19.2}
            cy={s.y * 10.8}
            r={s.s}
            fill={PALETTE.paper}
            opacity={s.o}
          >
            {s.tw && (
              <animate
                attributeName="opacity"
                values={`${s.o};${s.o * 0.2};${s.o}`}
                dur={`${2 + (i % 5)}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
        ))}
      </svg>
    </div>
  );
}

function HalftoneOverlay({ opacity = 0.05 }) {
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage: `radial-gradient(${PALETTE.paper} 1px, transparent 1px)`,
      backgroundSize: "8px 8px",
      mixBlendMode: "overlay",
      opacity,
    }} />
  );
}

function GrainOverlay({ opacity = 0.18 }) {
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      opacity,
      backgroundImage:
        `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.85  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
      mixBlendMode: "overlay",
    }} />
  );
}

function Vignette() {
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)",
    }} />
  );
}

function SlideAtmosphere({ tweaks, accent, variant = "dark" }) {
  // variant: "dark" (default), "paper" (cream)
  return (
    <>
      {variant === "dark" && tweaks.showStars && <Starfield visible={tweaks.showStars} />}
      {variant === "dark" && <HalftoneOverlay opacity={0.04} />}
      <GrainOverlay opacity={variant === "paper" ? 0.25 : 0.16} />
      {variant === "dark" && <Vignette />}
    </>
  );
}

// ============================================================
// REUSABLE BITS
// ============================================================
function CornerMarks({ color = PALETTE.paper, label, accentHex }) {
  // Pulp-poster corner brackets + tiny label
  const c = color;
  const L = 38;
  const T = 4;
  const corner = (style) => (
    <div style={{
      position: "absolute", width: L, height: L,
      borderColor: c, borderStyle: "solid", borderWidth: 0,
      ...style,
    }} />
  );
  return (
    <>
      <div style={{ position: "absolute", top: 36, left: 36, width: L, height: L,
        borderTop: `${T}px solid ${c}`, borderLeft: `${T}px solid ${c}` }} />
      <div style={{ position: "absolute", top: 36, right: 36, width: L, height: L,
        borderTop: `${T}px solid ${c}`, borderRight: `${T}px solid ${c}` }} />
      <div style={{ position: "absolute", bottom: 36, left: 36, width: L, height: L,
        borderBottom: `${T}px solid ${c}`, borderLeft: `${T}px solid ${c}` }} />
      <div style={{ position: "absolute", bottom: 36, right: 36, width: L, height: L,
        borderBottom: `${T}px solid ${c}`, borderRight: `${T}px solid ${c}` }} />
    </>
  );
}

function FooterBar({ left, right, color = PALETTE.paper, accentHex }) {
  return (
    <div style={{
      position: "absolute", left: SPACING.paddingX, right: SPACING.paddingX, bottom: 44,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontFamily: displayFont, letterSpacing: "0.32em", fontSize: TYPE_SCALE.small,
      fontWeight: 500, color, opacity: 0.7, textTransform: "uppercase",
    }}>
      <span>{left}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: accentHex,
          boxShadow: `0 0 12px ${accentHex}` }} />
        {right}
      </span>
    </div>
  );
}

function Eyebrow({ children, accentHex }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 16,
      fontFamily: displayFont, fontWeight: 500, fontSize: TYPE_SCALE.meta,
      letterSpacing: "0.42em", textTransform: "uppercase", color: accentHex,
    }}>
      <span style={{ display: "inline-block", width: 56, height: 3, background: accentHex,
        boxShadow: `0 0 10px ${accentHex}` }} />
      {children}
    </div>
  );
}

function Saber({ accentHex, length = 540, thickness = 14, hilt = true }) {
  // Stylized lightsaber bar — original design, abstract bar + hilt rectangles
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {hilt && (
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 22, height: thickness + 18, background: "#9aa3ad",
            borderRadius: 2 }} />
          <div style={{ width: 56, height: thickness + 12, background:
            "linear-gradient(180deg, #cfd6de 0%, #6b7178 50%, #cfd6de 100%)",
            borderRadius: 2 }} />
          <div style={{ width: 14, height: thickness + 22, background: "#3d4248",
            borderRadius: 2 }} />
          <div style={{ width: 8, height: thickness + 8, background: "#1a1d22" }} />
        </div>
      )}
      <div style={{
        width: length, height: thickness,
        background: `linear-gradient(90deg, ${accentHex} 0%, #ffffff 60%, #ffffff 100%)`,
        boxShadow: `0 0 28px ${accentHex}, 0 0 56px ${accentHex}`,
        borderRadius: thickness,
      }} />
    </div>
  );
}

// ============================================================
// SLIDE: TITLE
// ============================================================
function TitleSlide({ tweaks, accent }) {
  return (
    <section data-label="01 Title">
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          textAlign: "center",
        }}>
          <Eyebrow accentHex={accent.hex}>Presented at Fertile Ground</Eyebrow>

          <div style={{
            fontFamily: displayFont, fontWeight: 700, color: PALETTE.paper,
            fontSize: 68, letterSpacing: "0.18em", marginTop: 56, marginBottom: 8,
            textShadow: `0 0 24px ${accent.glow}`,
          }}>
            MAY THE FOURTH
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 28, margin: "32px 0 28px" }}>
            <div style={{ flex: "0 0 auto", height: 2, width: 220, background: PALETTE.paper, opacity: 0.5 }} />
            <Saber accentHex={accent.hex} length={120} thickness={10} />
            <div style={{ flex: "0 0 auto", height: 2, width: 220, background: PALETTE.paper, opacity: 0.5 }} />
          </div>

          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: 220, lineHeight: 0.92,
            letterSpacing: "0.02em", color: PALETTE.paper,
            textShadow: `0 0 40px ${accent.glow}, 0 0 100px ${accent.glow}`,
          }}>
            STAR WARS
          </div>
          <div style={{
            fontFamily: displayFont, fontWeight: 600, fontSize: 92, lineHeight: 1,
            letterSpacing: "0.42em", color: accent.hex, marginTop: 12,
            textShadow: `0 0 24px ${accent.glow}`,
          }}>
            TRIVIA NIGHT
          </div>

          <div style={{
            marginTop: 88, display: "flex", alignItems: "center", gap: 22,
            fontFamily: displayFont, fontSize: TYPE_SCALE.meta, letterSpacing: "0.36em",
            textTransform: "uppercase", color: PALETTE.paperDim,
          }}>
            <span>Hosted by</span>
            <span style={{ width: 8, height: 8, background: accent.hex, borderRadius: 999,
              boxShadow: `0 0 10px ${accent.hex}` }} />
            <span style={{ color: PALETTE.paper, fontWeight: 600 }}>Jack Smith &nbsp;·&nbsp; Michael Lamb</span>
          </div>
        </div>

        <FooterBar
          left="Fertile Ground"
          right="May 4 · 2026"
          accentHex={accent.hex}
        />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: RULES
// ============================================================
function RulesSlide({ tweaks, accent }) {
  const rules = [
    { n: "I",   t: "No phones",       d: "Looking up answers will result in points being deducted at the hosts' discretion." },
    { n: "II",  t: "Spelling is forgiving",  d: "Misspellings are fine as long as the answer is unambiguous and correct." },
    { n: "III", t: "Hosts are final",   d: "Jack and Michael have the last word on every ruling. No appeals to the High Council." },
    { n: "IV",  t: "Have fun",         d: "It's a long time ago in a galaxy far, far away... You're allowed to be cheesy." },
  ];
  return (
    <section data-label="02 Rules">
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", flexDirection: "column",
        }}>
          <Eyebrow accentHex={accent.hex}>Section I</Eyebrow>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: TYPE_SCALE.title,
            letterSpacing: "0.04em", marginTop: 24, color: PALETTE.paper,
          }}>
            HOUSE RULES
          </div>
          <div style={{
            height: 4, width: 180, background: accent.hex, marginTop: 22,
            boxShadow: `0 0 16px ${accent.glow}`,
          }} />

          <div style={{
            marginTop: 64, display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "44px 80px", flex: 1,
          }}>
            {rules.map((r) => (
              <div key={r.n} style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
                <div style={{
                  fontFamily: displayFont, fontWeight: 700, fontSize: 80, lineHeight: 0.9,
                  color: accent.hex, minWidth: 96,
                  textShadow: `0 0 18px ${accent.glow}`,
                }}>
                  {r.n}
                </div>
                <div>
                  <div style={{
                    fontFamily: displayFont, fontWeight: 600, fontSize: TYPE_SCALE.subtitle,
                    letterSpacing: "0.04em", color: PALETTE.paper, marginBottom: 12,
                  }}>
                    {r.t}
                  </div>
                  <div style={{
                    fontFamily: "'Inter', sans-serif", fontWeight: 400,
                    fontSize: TYPE_SCALE.body, lineHeight: 1.35, color: PALETTE.paperDim,
                    maxWidth: 560,
                  }}>
                    {r.d}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <FooterBar left="House Rules" right="Read Before Play" accentHex={accent.hex} />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: PRIZE
// ============================================================
function PrizeSlide({ tweaks, accent }) {
  return (
    <section data-label="03 Grand Prize">
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          alignItems: "center", textAlign: "center",
        }}>
          <Eyebrow accentHex={accent.hex}>Tonight's Bounty</Eyebrow>

          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: TYPE_SCALE.title,
            color: PALETTE.paper, letterSpacing: "0.04em", marginTop: 28,
          }}>
            GRAND PRIZE
          </div>

          <div style={{
            marginTop: 56,
            border: `4px solid ${accent.hex}`,
            padding: "60px 88px",
            position: "relative",
            boxShadow: `0 0 40px ${accent.glow}, inset 0 0 40px ${accent.glow}`,
          }}>
            <div style={{
              position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
              background: PALETTE.ink, padding: "0 22px",
              fontFamily: displayFont, fontSize: TYPE_SCALE.small, letterSpacing: "0.4em",
              color: accent.hex, fontWeight: 600,
            }}>
              ★ WINNER TAKES ALL ★
            </div>

            <div style={{
              fontFamily: displayFont, fontWeight: 700, fontSize: 220, lineHeight: 1,
              color: PALETTE.paper, letterSpacing: "0.01em",
              textShadow: `0 0 32px ${accent.glow}`,
            }}>
              $100
            </div>
            <div style={{
              fontFamily: displayFont, fontWeight: 600, fontSize: TYPE_SCALE.subtitle,
              letterSpacing: "0.16em", color: accent.hex, marginTop: 16,
            }}>
              FERTILE GROUND GIFT CARD
            </div>
          </div>

          <div style={{
            marginTop: 48, fontFamily: "'Inter', sans-serif",
            fontSize: TYPE_SCALE.body, color: PALETTE.paperDim, fontStyle: "italic",
            maxWidth: 900,
          }}>
            More than enough to cover your tab tonight.
          </div>
        </div>

        <FooterBar left="Grand Prize" right="One Winning Team" accentHex={accent.hex} />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: COSTUME CONTEST
// ============================================================
function CostumeContestSlide({ tweaks, accent }) {
  const rules = [
    { n: "I",   t: "Open to All Sentients", d: "Any guest can enter — you don't need to be on a trivia team to win." },
    { n: "II",  t: "Galactic Canon",        d: "Costumes must be Star Wars themed. Original concepts welcome if the connection is clear." },
    { n: "III", t: "Hosts Decide",          d: "Jack and Michael will pick Best Overall. No appeals to the High Council." },
    { n: "IV",  t: "A Separate Bounty",     d: "One winner takes home a side prize, revealed before the trivia champion is crowned." },
  ];
  return (
    <section data-label="04 Costume Contest">
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", flexDirection: "column",
        }}>
          <Eyebrow accentHex={accent.hex}>Bonus Challenge</Eyebrow>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: TYPE_SCALE.title,
            letterSpacing: "0.04em", marginTop: 24, color: PALETTE.paper,
          }}>
            COSTUME CONTEST
          </div>
          <div style={{
            height: 4, width: 180, background: accent.hex, marginTop: 22,
            boxShadow: `0 0 16px ${accent.glow}`,
          }} />

          <div style={{
            marginTop: 64, display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "44px 80px", flex: 1,
          }}>
            {rules.map((r) => (
              <div key={r.n} style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
                <div style={{
                  fontFamily: displayFont, fontWeight: 700, fontSize: 80, lineHeight: 0.9,
                  color: accent.hex, minWidth: 96,
                  textShadow: `0 0 18px ${accent.glow}`,
                }}>
                  {r.n}
                </div>
                <div>
                  <div style={{
                    fontFamily: displayFont, fontWeight: 600, fontSize: TYPE_SCALE.subtitle,
                    letterSpacing: "0.04em", color: PALETTE.paper, marginBottom: 12,
                  }}>
                    {r.t}
                  </div>
                  <div style={{
                    fontFamily: "'Inter', sans-serif", fontWeight: 400,
                    fontSize: TYPE_SCALE.body, lineHeight: 1.35, color: PALETTE.paperDim,
                    maxWidth: 560,
                  }}>
                    {r.d}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <FooterBar left="Costume Contest" right="Judged at End of Night" accentHex={accent.hex} />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: ROUND OPENER (large numeral, theme)
// ============================================================
function RoundOpener({ number, title, subtitle, kicker, tweaks, accent, label }) {
  return (
    <section data-label={label}>
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", alignItems: "center", gap: 80,
        }}>
          {/* Massive numeral */}
          <div style={{
            position: "relative", flex: "0 0 auto",
          }}>
            <div style={{
              fontFamily: displayFont, fontWeight: 700, fontSize: 720, lineHeight: 0.78,
              color: PALETTE.paper, letterSpacing: "-0.02em",
              textShadow: `0 0 60px ${accent.glow}, 0 0 120px ${accent.glow}`,
              WebkitTextStroke: `0px ${accent.hex}`,
            }}>
              {String(number).padStart(2, "0")}
            </div>
          </div>

          {/* Right text block */}
          <div style={{ flex: 1, borderLeft: `4px solid ${accent.hex}`, paddingLeft: 56,
            boxShadow: `inset 4px 0 16px ${accent.glow}` }}>
            <div style={{
              fontFamily: displayFont, fontWeight: 500, fontSize: TYPE_SCALE.meta,
              letterSpacing: "0.42em", color: accent.hex, marginBottom: 28,
            }}>
              ROUND
            </div>
            <div style={{
              fontFamily: displayFont, fontWeight: 700, fontSize: TYPE_SCALE.title,
              color: PALETTE.paper, letterSpacing: "0.03em", lineHeight: 1.0,
              textTransform: "uppercase",
            }}>
              {title}
            </div>
            {subtitle && (
              <div style={{
                fontFamily: "'Inter', sans-serif", fontWeight: 400,
                fontSize: TYPE_SCALE.subtitle, color: PALETTE.paperDim, marginTop: 32,
                lineHeight: 1.3, maxWidth: 740,
              }}>
                {subtitle}
              </div>
            )}
            {kicker && (
              <div style={{
                marginTop: 56, display: "inline-block",
                padding: "16px 28px", border: `2px solid ${accent.hex}`,
                fontFamily: displayFont, fontSize: TYPE_SCALE.small,
                letterSpacing: "0.32em", color: accent.hex, fontWeight: 600,
              }}>
                {kicker}
              </div>
            )}
          </div>
        </div>

        <FooterBar left={`Round ${String(number).padStart(2, "0")}`} right={title} accentHex={accent.hex} />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: ROUND 1 PICTURE-ROUND INSTRUCTIONS
// ============================================================
function PictureRoundInstructions({ tweaks, accent }) {
  const steps = [
    { n: "01", t: "Form your team",   d: "Gather your group and pick a team name. Pun-heavy or theme-on-theme is encouraged." },
    { n: "02", t: "Collect your sheet", d: "One Round 1 picture sheet per team. Grab one from Jack or Michael at the host stand." },
    { n: "03", t: "Identify the images", d: "Write the name of the character, ship, planet, or scene next to each numbered image." },
    { n: "04", t: "Return your answers", d: "Hand the sheet back to the hosts before Round 2 begins." },
  ];
  return (
    <section data-label="05 Round 1 Instructions">
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 32 }}>
            <Eyebrow accentHex={accent.hex}>Round 01 · Picture Round</Eyebrow>
          </div>

          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: TYPE_SCALE.title,
            color: PALETTE.paper, letterSpacing: "0.04em", marginTop: 24, lineHeight: 1.0,
          }}>
            ON PAPER, NOT ON SCREEN
          </div>
          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: TYPE_SCALE.body,
            color: PALETTE.paperDim, marginTop: 28, maxWidth: 1200, lineHeight: 1.35,
          }}>
            This round is played from a paper sheet handed out by the hosts. Identify each image and write your answer in the space provided.
          </div>

          <div style={{
            marginTop: 56, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 28, flex: 1,
          }}>
            {steps.map((s) => (
              <div key={s.n} style={{
                border: `2px solid ${PALETTE.paper}33`,
                padding: "32px 28px", display: "flex", flexDirection: "column",
                background: "rgba(255,255,255,0.02)",
                position: "relative",
              }}>
                <div style={{
                  fontFamily: displayFont, fontSize: TYPE_SCALE.subtitle, fontWeight: 700,
                  color: accent.hex, letterSpacing: "0.06em",
                  textShadow: `0 0 14px ${accent.glow}`,
                }}>
                  {s.n}
                </div>
                <div style={{
                  height: 2, width: 56, background: accent.hex, margin: "16px 0 24px",
                }} />
                <div style={{
                  fontFamily: displayFont, fontWeight: 600, fontSize: TYPE_SCALE.body,
                  color: PALETTE.paper, letterSpacing: "0.04em", marginBottom: 16,
                  textTransform: "uppercase",
                }}>
                  {s.t}
                </div>
                <div style={{
                  fontFamily: "'Inter', sans-serif", fontSize: TYPE_SCALE.small,
                  color: PALETTE.paperDim, lineHeight: 1.4,
                }}>
                  {s.d}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 36, padding: "24px 32px",
            background: `${accent.hex}14`, border: `2px solid ${accent.hex}`,
            display: "flex", alignItems: "center", gap: 24,
          }}>
            <div style={{
              fontFamily: displayFont, fontSize: TYPE_SCALE.meta, color: accent.hex,
              letterSpacing: "0.4em", fontWeight: 700,
            }}>
              REMINDER
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif", fontSize: TYPE_SCALE.small,
              color: PALETTE.paper,
            }}>
              No phones. Spelling is forgiving — just make sure we can tell who you mean.
            </div>
          </div>
        </div>

        <FooterBar left="Round 01" right="Picture Round" accentHex={accent.hex} />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: QUESTION
// ============================================================
function QuestionSlide({ round, q, total, prompt, roundTitle, tweaks, accent }) {
  const [seconds, setSeconds] = useState(tweaks.timerSeconds || 30);
  const [paused, setPaused] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const ref = useRef(null);

  // Track whether this slide is the active one in <deck-stage>.
  // deck-stage sets data-deck-active on the active <section> and dispatches a
  // bubbling, composed `slidechange` event we can listen for on document.
  useEffect(() => {
    const mySection = ref.current?.closest('section');
    if (!mySection) return;
    setIsActive(mySection.hasAttribute('data-deck-active'));
    const handler = (e) => setIsActive(e.detail.slide === mySection);
    document.addEventListener('slidechange', handler);
    return () => document.removeEventListener('slidechange', handler);
  }, []);

  // Reset to full duration (and unpause) when this slide becomes active or
  // timer settings change.
  useEffect(() => {
    if (isActive) {
      setSeconds(tweaks.timerSeconds || 30);
      setPaused(false);
    }
  }, [isActive, tweaks.timerSeconds, tweaks.showTimer]);

  // Tick down once per second while active, enabled, not paused, and > 0.
  useEffect(() => {
    if (!tweaks.showTimer || !isActive || paused || seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [tweaks.showTimer, isActive, paused, seconds]);

  // Respond to control-window commands (only the active slide acts).
  useBroadcast(useCallback((msg) => {
    if (!isActive) return;
    if (msg.type === 'timer:toggle') setPaused((p) => !p);
    else if (msg.type === 'timer:reset') {
      setSeconds(tweaks.timerSeconds || 30);
      setPaused(false);
    } else if (msg.type === 'timer:adjust') {
      setSeconds((s) => Math.max(0, s + msg.payload));
    } else if (msg.type === 'sync:request') {
      broadcast('timer:state', { enabled: !!tweaks.showTimer, seconds, paused });
    }
  }, [isActive, tweaks.timerSeconds, tweaks.showTimer, seconds, paused]));

  // Push timer state to the control window whenever it changes.
  useEffect(() => {
    if (!isActive) return;
    broadcast('timer:state', { enabled: !!tweaks.showTimer, seconds, paused });
  }, [isActive, seconds, paused, tweaks.showTimer]);

  return (
    <section data-label={`R${round} Q${String(q).padStart(2, "0")}`}>
      <div style={slideBase} ref={ref}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", flexDirection: "column",
        }}>
          {/* Header strip */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            paddingBottom: 28, borderBottom: `2px solid ${PALETTE.paper}22`,
          }}>
            {tweaks.showQNumbers ? (
              <div style={{
                fontFamily: displayFont, fontWeight: 600, fontSize: TYPE_SCALE.meta,
                letterSpacing: "0.42em", color: accent.hex,
              }}>
                ROUND {String(round).padStart(2, "0")}
                <span style={{ color: PALETTE.paperDim, margin: "0 18px" }}>·</span>
                QUESTION {String(q).padStart(2, "0")}
                <span style={{ color: PALETTE.paperDim, margin: "0 18px" }}>·</span>
                <span style={{ color: PALETTE.paperDim }}>OF {String(total).padStart(2, "0")}</span>
              </div>
            ) : (
              <div style={{
                fontFamily: displayFont, fontWeight: 600, fontSize: TYPE_SCALE.meta,
                letterSpacing: "0.42em", color: accent.hex,
              }}>
                {roundTitle}
              </div>
            )}
            {!tweaks.showTimer && (
              <div style={{
                fontFamily: displayFont, fontWeight: 600, fontSize: TYPE_SCALE.meta,
                letterSpacing: "0.42em", color: PALETTE.paperDim,
              }}>
                {roundTitle}
              </div>
            )}
          </div>

          {/* Big numeral + prompt */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 72, marginTop: 32,
          }}>
            <div style={{ flex: "0 0 auto", position: "relative" }}>
              <div style={{
                fontFamily: displayFont, fontWeight: 700, fontSize: 520, lineHeight: 0.82,
                color: "transparent",
                WebkitTextStroke: `3px ${accent.hex}`,
                letterSpacing: "-0.02em",
                filter: `drop-shadow(0 0 24px ${accent.glow})`,
              }}>
                {String(q).padStart(2, "0")}
              </div>
              <div style={{
                position: "absolute", top: 20, left: 26,
                fontFamily: displayFont, fontWeight: 700, fontSize: 520, lineHeight: 0.82,
                color: `${PALETTE.paper}10`, letterSpacing: "-0.02em",
              }}>
                {String(q).padStart(2, "0")}
              </div>
            </div>

            <div style={{ flex: 1, paddingLeft: 56, borderLeft: `4px solid ${accent.hex}`,
              boxShadow: `inset 4px 0 12px ${accent.glow}` }}>
              <div style={{
                fontFamily: displayFont, fontSize: TYPE_SCALE.meta, fontWeight: 500,
                letterSpacing: "0.42em", color: accent.hex, marginBottom: 28,
                textShadow: `0 0 8px ${accent.glow}`,
              }}>
                ★ QUESTION
              </div>
              <div style={{
                fontFamily: "'Inter', sans-serif", fontWeight: 500,
                fontSize: 64, lineHeight: 1.18, color: PALETTE.paper,
                letterSpacing: "-0.005em",
                textWrap: "pretty",
              }}>
                {prompt}
              </div>
            </div>
          </div>

          {/* Timer placeholder when on */}
          {tweaks.showTimer && (
            <div style={{
              position: "absolute", right: SPACING.paddingX, top: SPACING.paddingTop - 12,
              fontFamily: displayFont, fontWeight: 700, fontSize: 88,
              color: accent.hex, letterSpacing: "0.04em",
              textShadow: `0 0 18px ${accent.glow}`,
            }}>
              {seconds}s
            </div>
          )}
        </div>

        <FooterBar
          left={`Round ${String(round).padStart(2, "0")}`}
          right={`Question ${String(q).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
          accentHex={accent.hex}
        />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: ROUND RECAP — 2 columns of 5
// ============================================================
function RoundRecap({ round, roundTitle, questions, tweaks, accent }) {
  const left = questions.slice(0, 5);
  const right = questions.slice(5, 10);
  return (
    <section data-label={`R${round} Recap`}>
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <Eyebrow accentHex={accent.hex}>End of Round {String(round).padStart(2, "0")}</Eyebrow>
              <div style={{
                fontFamily: displayFont, fontWeight: 700, fontSize: TYPE_SCALE.title,
                color: PALETTE.paper, letterSpacing: "0.03em", marginTop: 22,
                textTransform: "uppercase",
              }}>
                Recap · {roundTitle}
              </div>
            </div>
            <div style={{
              fontFamily: displayFont, fontWeight: 600, fontSize: TYPE_SCALE.meta,
              letterSpacing: "0.4em", color: PALETTE.paperDim,
            }}>
              ALL 10 QUESTIONS
            </div>
          </div>

          <div style={{ height: 4, width: 180, background: accent.hex, marginTop: 20,
            boxShadow: `0 0 14px ${accent.glow}` }} />

          <div style={{
            marginTop: 36, flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr",
            gridAutoRows: "min-content",
            gap: "14px 56px", alignContent: "start", overflow: "hidden",
          }}>
            {questions.map((q, i) => (
              <div key={i} style={{
                display: "flex", gap: 22, alignItems: "baseline",
                paddingBottom: 12, borderBottom: `1px solid ${PALETTE.paper}1A`,
                minWidth: 0,
              }}>
                <div style={{
                  fontFamily: displayFont, fontWeight: 700, fontSize: 40,
                  color: accent.hex, letterSpacing: "0.04em", minWidth: 58,
                  textShadow: `0 0 10px ${accent.glow}`,
                  flex: "0 0 auto",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{
                  fontFamily: "'Inter', sans-serif", fontSize: 24, lineHeight: 1.28,
                  color: PALETTE.paper, fontWeight: 400,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden", flex: 1, minWidth: 0,
                }}>
                  {q}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 18, fontFamily: displayFont, fontSize: TYPE_SCALE.small,
            color: PALETTE.paperDim, letterSpacing: "0.32em", textTransform: "uppercase",
          }}>
            Hand answer sheets to the hosts before we move on.
          </div>
        </div>

        <FooterBar
          left={`Round ${String(round).padStart(2, "0")} · Recap`}
          right={roundTitle}
          accentHex={accent.hex}
        />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: INTERMISSION
// ============================================================
function IntermissionSlide({ nextRound, nextTitle, tweaks, accent, label }) {
  return (
    <section data-label={label}>
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          alignItems: "center", textAlign: "center",
        }}>
          <Eyebrow accentHex={accent.hex}>Intermission</Eyebrow>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: 200, lineHeight: 1.05,
            color: PALETTE.paper, letterSpacing: "0.04em", marginTop: 28,
            textShadow: `0 0 40px ${accent.glow}`,
          }}>
            STRETCH.
          </div>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: 200, lineHeight: 1.05,
            color: accent.hex, letterSpacing: "0.04em",
            textShadow: `0 0 40px ${accent.glow}`,
          }}>
            REFILL.
          </div>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: 200, lineHeight: 1.05,
            color: PALETTE.paper, letterSpacing: "0.04em",
            textShadow: `0 0 40px ${accent.glow}`,
          }}>
            REGROUP.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 48 }}>
            <div style={{ height: 2, width: 180, background: PALETTE.paper, opacity: 0.4 }} />
            <Saber accentHex={accent.hex} length={120} thickness={10} />
            <div style={{ height: 2, width: 180, background: PALETTE.paper, opacity: 0.4 }} />
          </div>

          <div style={{
            marginTop: 48, fontFamily: displayFont, fontSize: TYPE_SCALE.subtitle,
            color: PALETTE.paperDim, letterSpacing: "0.16em",
          }}>
            Up next · Round {String(nextRound).padStart(2, "0")} · {nextTitle}
          </div>
        </div>

        <FooterBar left="Intermission" right={`Up Next · Round ${String(nextRound).padStart(2, "0")}`} accentHex={accent.hex} />
      </div>
    </section>
  );
}

function PictureRecapCell({ item, index, accent }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [item.src]);
  const showImage = item.src && !failed;
  // The cell IS the photo box. Fixed aspect matches the canvas handout cell
  // so the same objectPosition produces the same visible crop on both. The
  // answer line that lives under each cell on the canvas is intentionally
  // omitted on screen — it's only useful where contestants are writing.
  return (
    <div style={{
      aspectRatio: "316 / 220",
      position: "relative",
      background: `${PALETTE.paper}06`,
      border: `2px solid ${accent.hex}33`,
      borderRadius: 4,
      overflow: "hidden",
    }}>
      {showImage ? (
        <img
          src={item.src}
          alt={item.caption || `Picture ${index + 1}`}
          onError={() => setFailed(true)}
          style={{
            width: "100%", height: "100%", objectFit: "cover", display: "block",
            objectPosition: `${item.position?.x ?? 50}% ${item.position?.y ?? 50}%`,
          }}
        />
      ) : (
        <div style={{
          position: "absolute", inset: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `2px dashed ${PALETTE.paper}22`,
          borderRadius: 2,
        }}>
          <div style={{
            fontFamily: displayFont, fontSize: TYPE_SCALE.meta, fontWeight: 500,
            color: PALETTE.paperDim, letterSpacing: "0.36em", opacity: 0.55,
          }}>
            PHOTO
          </div>
        </div>
      )}
      <div style={{
        position: "absolute", top: 12, left: 12,
        width: 56, height: 56,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: displayFont, fontWeight: 700, fontSize: 30,
        color: PALETTE.ink, background: accent.hex,
        boxShadow: `0 0 18px ${accent.glow}`,
        borderRadius: 4, letterSpacing: "0.02em",
      }}>
        {String(index + 1).padStart(2, "0")}
      </div>
      {item.caption && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "10px 14px",
          background: `linear-gradient(180deg, transparent, ${PALETTE.ink}cc)`,
          fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 500,
          color: PALETTE.paper, letterSpacing: "0.02em",
        }}>
          {item.caption}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SLIDE: PICTURE ROUND RECAP
// 5×2 grid for discussing picture round answers + serves as the print
// design for the paper handout. Cells are placeholder boxes when item.src
// is null; render an <img> when src is present.
// ============================================================
function PictureRoundRecap({ items, tweaks, accent }) {
  return (
    <section data-label="Picture Round Recap">
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", flexDirection: "column",
        }}>
          <Eyebrow accentHex={accent.hex}>Round 01 · Recap</Eyebrow>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: TYPE_SCALE.title,
            letterSpacing: "0.04em", marginTop: 24, color: PALETTE.paper,
          }}>
            PICTURE ROUND
          </div>
          <div style={{
            height: 4, width: 180, background: accent.hex, marginTop: 22,
            boxShadow: `0 0 16px ${accent.glow}`,
          }} />

          <div style={{
            marginTop: 24, fontFamily: "'Inter', sans-serif", fontStyle: "italic",
            fontSize: TYPE_SCALE.body, color: PALETTE.paperDim, maxWidth: 1200,
          }}>
            Identify the character or creature.
          </div>

          <div style={{
            marginTop: 32, display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 24,
          }}>
            {items.map((item, i) => (
              <PictureRecapCell key={i} item={item} index={i} accent={accent} />
            ))}
          </div>
        </div>

        <FooterBar
          left="Picture Round · Recap"
          right={`${items.length} Photos · Discuss Answers`}
          accentHex={accent.hex}
        />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: END
// ============================================================
function EndSlide({ tweaks, accent }) {
  return (
    <section data-label="End">
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          alignItems: "center", textAlign: "center",
        }}>
          <Eyebrow accentHex={accent.hex}>End of Game</Eyebrow>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: 220, lineHeight: 0.9,
            color: PALETTE.paper, letterSpacing: "0.04em", marginTop: 36,
            textShadow: `0 0 50px ${accent.glow}`,
          }}>
            MAY THE FORCE
          </div>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: 220, lineHeight: 0.9,
            color: accent.hex, letterSpacing: "0.04em",
            textShadow: `0 0 50px ${accent.glow}`,
          }}>
            BE WITH YOU.
          </div>

          <div style={{
            marginTop: 76, fontFamily: displayFont, fontWeight: 600, fontSize: TYPE_SCALE.subtitle,
            color: PALETTE.paperDim, letterSpacing: "0.36em",
          }}>
            HOSTS TALLYING SCORES · STAND BY
          </div>
        </div>

        <FooterBar left="End of Game" right="Winner Announced Shortly" accentHex={accent.hex} />
      </div>
    </section>
  );
}

export {
  TitleSlide, RulesSlide, PrizeSlide, CostumeContestSlide, RoundOpener,
  PictureRoundInstructions, QuestionSlide, RoundRecap, PictureRoundRecap,
  IntermissionSlide, EndSlide,
  ACCENTS, DEFAULTS, PALETTE,
};
