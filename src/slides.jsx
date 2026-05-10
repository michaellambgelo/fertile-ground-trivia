import React, { useState, useEffect, useRef, useCallback } from 'react';
import { broadcast, useBroadcast } from './broadcast.js';

// ============================================================
// DESIGN SYSTEM — Theme-neutral scaffold; clone via /new-trivia-deck and override PALETTE
// ============================================================
const TYPE_SCALE = {
  display: 132,   // hero numerals
  title: 88,      // section / round titles
  subtitle: 56,   // q-numbers, secondary headers
  body: 36,       // question prompts
  meta: 34,       // labels, eyebrows
  small: 30,      // captions, footers
};

const SPACING = {
  paddingTop: 100,
  paddingBottom: 90,
  paddingX: 120,
  titleGap: 48,
  itemGap: 28,
};

// Default tweaks — overridden by the runtime tweaks panel
const DEFAULTS = {
  accent: "accent-red",       // accent-blue | accent-green | accent-red | accent-gold
  showStars: false,
  showQNumbers: true,
  showTimer: false,
  timerSeconds: 60,
};

const ACCENTS = {
  "accent-blue":  { hex: "#1f4e96", glow: "rgba(31, 78, 150, 0.32)", name: "BLUE" },
  "accent-green": { hex: "#1a6f3c", glow: "rgba(26, 111, 60, 0.32)", name: "GREEN" },
  "accent-red":   { hex: "#e73826", glow: "rgba(231, 56, 38, 0.35)", name: "RED" },
  "accent-gold":  { hex: "#a67510", glow: "rgba(166, 117, 16, 0.32)", name: "GOLD" },
};

const PALETTE = {
  ink: "#fafaf7",            // off-white slide background (was deep slate)
  inkDeep: "#f3f1ec",        // slightly tinted surface (alt panel)
  paper: "#0e1c3a",          // dark navy text (was warm cream)
  paperDim: "#5b6577",        // muted secondary text
  rust: "#e73826",           // scorer accent red
  gold: "#a32519",           // scorer accent dim red
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
// BACKGROUND ATMOSPHERE — BackdropField + vignette + halftone
// Theme-neutral atmospherics. Themes that want a starfield, snowfall,
// embers, or any other dot-pattern can keep BackdropField on; themes
// where the dot pattern reads off-theme should leave showStars off.
// ============================================================
function BackdropField({ visible = true, density = 1 }) {
  // Pre-rendered dot positions (deterministic) for performance & no flicker
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
      background: "radial-gradient(ellipse at center, transparent 55%, rgba(14, 28, 58, 0.12) 100%)",
    }} />
  );
}

function SlideAtmosphere({ tweaks, accent, variant = "dark" }) {
  // variant: "dark" (default), "paper" (cream)
  return (
    <>
      {variant === "dark" && tweaks.showStars && <BackdropField visible={tweaks.showStars} />}
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

function AccentBar({ accentHex, length = 540, thickness = 14 }) {
  // Glowing accent divider — minimal horizontal bar with a small diamond
  // ornament centered on top. Theme-neutral by default; themes that want a
  // hilt, sword silhouette, wand, or other ornament should swap this
  // component or extend it via props.
  const ornament = thickness * 1.4;
  return (
    <div style={{ position: "relative", width: length, height: ornament, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: length, height: thickness,
        background: accentHex,
        boxShadow: `0 0 18px ${accentHex}, 0 0 36px ${accentHex}`,
        borderRadius: thickness,
        opacity: 0.85,
      }} />
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        width: ornament, height: ornament,
        transform: "translate(-50%, -50%) rotate(45deg)",
        background: accentHex,
        boxShadow: `0 0 10px ${accentHex}`,
      }} />
    </div>
  );
}

// ============================================================
// SLIDE: TITLE
// ============================================================
function TitleSlide({ tweaks, accent, title }) {
  const t = title || {};
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
          {t.eyebrow && <Eyebrow accentHex={accent.hex}>{t.eyebrow}</Eyebrow>}

          {t.hero && (
            <div style={{
              fontFamily: displayFont, fontWeight: 700, color: PALETTE.paper,
              fontSize: 68, letterSpacing: "0.18em", marginTop: 56, marginBottom: 8,
              textShadow: `0 0 24px ${accent.glow}`,
            }}>
              {t.hero}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 28, margin: "32px 0 28px" }}>
            <div style={{ flex: "0 0 auto", height: 2, width: 220, background: PALETTE.paper, opacity: 0.5 }} />
            <AccentBar accentHex={accent.hex} length={120} thickness={10} />
            <div style={{ flex: "0 0 auto", height: 2, width: 220, background: PALETTE.paper, opacity: 0.5 }} />
          </div>

          {t.edition && (
            <div style={{
              fontFamily: displayFont, fontWeight: 700, fontSize: 220, lineHeight: 0.92,
              letterSpacing: "0.02em", color: PALETTE.paper,
              textShadow: `0 0 40px ${accent.glow}, 0 0 100px ${accent.glow}`,
            }}>
              {t.edition}
            </div>
          )}
          <div style={{
            fontFamily: displayFont, fontWeight: 600, fontSize: 92, lineHeight: 1,
            letterSpacing: "0.42em", color: accent.hex, marginTop: 12,
            textShadow: `0 0 24px ${accent.glow}`,
          }}>
            TRIVIA NIGHT
          </div>

          {t.hosts && (
            <div style={{
              marginTop: 88, display: "flex", alignItems: "center", gap: 22,
              fontFamily: displayFont, fontSize: TYPE_SCALE.meta, letterSpacing: "0.36em",
              textTransform: "uppercase", color: PALETTE.paperDim,
            }}>
              <span>Hosted by</span>
              <span style={{ width: 8, height: 8, background: accent.hex, borderRadius: 999,
                boxShadow: `0 0 10px ${accent.hex}` }} />
              <span style={{ color: PALETTE.paper, fontWeight: 600 }}>{t.hosts}</span>
            </div>
          )}
        </div>

        <FooterBar
          left="Fertile Ground"
          right={t.footerDate || ""}
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
    { n: "II",  t: "Spelling is best attempt",  d: "Misspellings are fine as long as the answer is unambiguous and correct." },
    { n: "III", t: "Hosts are final",   d: "The hosts have the last word on every ruling. No appeals." },
    { n: "IV",  t: "Have fun",         d: "Lean in, get into it, and don't take any single question too seriously." },
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
    { n: "I",   t: "Open to All Guests",    d: "Any guest can enter — you don't need to be on a trivia team to win." },
    { n: "II",  t: "On-Theme Costumes",     d: "Costumes must fit tonight's theme. Original concepts welcome if the connection is clear." },
    { n: "III", t: "Hosts Decide",          d: "The hosts will pick Best Overall. No appeals." },
    { n: "IV",  t: "A Separate Prize",      d: "One winner takes home a side prize, revealed before the trivia champion is crowned." },
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
    { n: "03", t: "Identify the images", d: "Write your answer in the space provided next to each numbered image." },
    { n: "04", t: "Return your answers", d: "Hand the sheet back to the hosts before Round 2 begins." },
  ];
  return (
    <section data-label="05 Round 1 Instructions">
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px 130px`,
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
              No phones. Spelling is best attempt — just make sure we can tell who you mean.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: QUESTION
// ============================================================
function QuestionSlide({ round, q, total, prompt, roundTitle, tweaks, accent, kind = "round" }) {
  const isTiebreaker = kind === "tiebreaker";
  const [seconds, setSeconds] = useState(tweaks.timerSeconds || 60);
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

  // Reset state AND broadcast the fresh value in one effect on activation.
  // The broadcast must use `fresh` directly rather than reading `seconds` from
  // a separate effect — `seconds` may still hold a stale value from this
  // slide's previous mount until the next render lands, which would briefly
  // leak that stale value to the control window.
  useEffect(() => {
    if (!isActive) return;
    const fresh = tweaks.timerSeconds || 60;
    setSeconds(fresh);
    setPaused(false);
    broadcast('timer:state', { enabled: !!tweaks.showTimer, seconds: fresh, paused: false });
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
      setSeconds(tweaks.timerSeconds || 60);
      setPaused(false);
    } else if (msg.type === 'timer:adjust') {
      setSeconds((s) => Math.max(0, s + msg.payload));
    } else if (msg.type === 'sync:request') {
      broadcast('timer:state', { enabled: !!tweaks.showTimer, seconds, paused });
    }
  }, [isActive, tweaks.timerSeconds, tweaks.showTimer, seconds, paused]));

  // Push tick / pause changes to the control window. isActive deliberately
  // omitted from deps — the activation broadcast lives in the reset effect
  // above (which sends the fresh value); duplicating it here would re-broadcast
  // stale `seconds` and reintroduce the flicker.
  useEffect(() => {
    if (!isActive) return;
    broadcast('timer:state', { enabled: !!tweaks.showTimer, seconds, paused });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, paused, tweaks.showTimer]);

  const dataLabel = isTiebreaker
    ? `TIEBREAKER ${String(q).padStart(2, "0")}`
    : `R${round} Q${String(q).padStart(2, "0")}`;

  return (
    <section data-label={dataLabel}>
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
                {isTiebreaker ? "TIEBREAKER" : `ROUND ${String(round).padStart(2, "0")}`}
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
          left={isTiebreaker ? "Final Wager" : `Round ${String(round).padStart(2, "0")}`}
          right={isTiebreaker
            ? `Tiebreaker ${String(q).padStart(2, "0")} / ${String(total).padStart(2, "0")}`
            : `Question ${String(q).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
          accentHex={accent.hex}
        />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: ROUND RECAP — single column of 5 questions
// One round produces two of these slides (questions 1–5, then 6–10) so
// each prompt can wrap fully without being truncated.
// ============================================================
function RoundRecap({ round, roundTitle, questions, tweaks, accent, startIndex = 0, part = "A" }) {
  const start = startIndex + 1;
  const end = startIndex + questions.length;
  return (
    <section data-label={`R${round} Recap ${part}`}>
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
              QUESTIONS {String(start).padStart(2, "0")}–{String(end).padStart(2, "0")}
            </div>
          </div>

          <div style={{ height: 4, width: 180, background: accent.hex, marginTop: 20,
            boxShadow: `0 0 14px ${accent.glow}` }} />

          <div style={{
            marginTop: 28, flex: 1, display: "flex", flexDirection: "column",
            gap: 12, overflow: "hidden",
          }}>
            {questions.map((q, i) => (
              <div key={i} style={{
                display: "flex", gap: 24, alignItems: "baseline",
                paddingBottom: 10, borderBottom: `1px solid ${PALETTE.paper}1A`,
                minWidth: 0,
              }}>
                <div style={{
                  fontFamily: displayFont, fontWeight: 700, fontSize: 40,
                  color: accent.hex, letterSpacing: "0.04em", minWidth: 60,
                  textShadow: `0 0 10px ${accent.glow}`,
                  flex: "0 0 auto",
                }}>
                  {String(startIndex + i + 1).padStart(2, "0")}
                </div>
                <div style={{
                  fontFamily: "'Inter', sans-serif", fontSize: 32, lineHeight: 1.28,
                  color: PALETTE.paper, fontWeight: 400,
                  flex: 1, minWidth: 0, maxWidth: 1600,
                }}>
                  {q}
                </div>
              </div>
            ))}
          </div>

        </div>

        <FooterBar
          left={`Round ${String(round).padStart(2, "0")} · Recap ${part}`}
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
function IntermissionSlide({ nextRound, nextTitle, nextLabel, tweaks, accent, label }) {
  const upNextText = nextLabel || `Round ${String(nextRound).padStart(2, "0")} · ${nextTitle}`;
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
            fontFamily: displayFont, fontWeight: 700, fontSize: 160, lineHeight: 1.05,
            color: accent.hex, letterSpacing: "0.04em", marginTop: 24,
            textShadow: `0 0 50px ${accent.glow}`,
          }}>
            SUBMIT.
          </div>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: 160, lineHeight: 1.05,
            color: PALETTE.paper, letterSpacing: "0.04em",
            textShadow: `0 0 40px ${accent.glow}`,
          }}>
            STRETCH.
          </div>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: 160, lineHeight: 1.05,
            color: PALETTE.paper, letterSpacing: "0.04em",
            textShadow: `0 0 40px ${accent.glow}`,
          }}>
            REFILL.
          </div>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: 160, lineHeight: 1.05,
            color: PALETTE.paper, letterSpacing: "0.04em",
            textShadow: `0 0 40px ${accent.glow}`,
          }}>
            REGROUP.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 36 }}>
            <div style={{ height: 2, width: 180, background: PALETTE.paper, opacity: 0.4 }} />
            <AccentBar accentHex={accent.hex} length={120} thickness={10} />
            <div style={{ height: 2, width: 180, background: PALETTE.paper, opacity: 0.4 }} />
          </div>

          <div style={{
            marginTop: 36, fontFamily: displayFont, fontSize: TYPE_SCALE.subtitle,
            color: PALETTE.paperDim, letterSpacing: "0.16em",
          }}>
            Up next · {upNextText}
          </div>
        </div>
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
          background: "linear-gradient(180deg, transparent, rgba(14, 28, 58, 0.85))",
          fontFamily: "'Inter', sans-serif", fontSize: 28, fontWeight: 500,
          color: "#fafaf7", letterSpacing: "0.02em",
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
// SLIDE: TIEBREAKER INTRO — Final Wager rules (Final Jeopardy style)
// ============================================================
function TiebreakerIntroSlide({ tweaks, accent }) {
  const rules = [
    { n: "I",   t: "Place Your Wager",       d: "Each tied team secretly writes a wager from 0 up to their total score before the question is read." },
    { n: "II",  t: "One Question, One Answer", d: "Hosts read the prompt. Each team writes one answer on their sheet. No conferring." },
    { n: "III", t: "Reveal & Adjust",         d: "Correct answers add the wager to your score. Wrong answers subtract it. Highest total wins." },
    { n: "IV",  t: "Up to Three Tries",       d: "Still tied after wagers are settled? We play again with a new question — up to a maximum of three." },
  ];
  return (
    <section data-label="Tiebreakers · Final Wager">
      <div style={slideBase}>
        <SlideAtmosphere tweaks={tweaks} accent={accent} />
        <CornerMarks accentHex={accent.hex} />

        <div style={{
          padding: `${SPACING.paddingTop}px ${SPACING.paddingX}px ${SPACING.paddingBottom}px`,
          height: "100%", display: "flex", flexDirection: "column",
        }}>
          <Eyebrow accentHex={accent.hex}>Round 05 · Final Wager</Eyebrow>
          <div style={{
            fontFamily: displayFont, fontWeight: 700, fontSize: TYPE_SCALE.title,
            letterSpacing: "0.04em", marginTop: 24, color: PALETTE.paper,
          }}>
            TIEBREAKERS
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

        <FooterBar left="Final Wager" accentHex={accent.hex} />
      </div>
    </section>
  );
}

// ============================================================
// SLIDE: END
// ============================================================
function EndSlide({ tweaks, accent, end }) {
  const e = end || {};
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
          {e.hero1 && (
            <div style={{
              fontFamily: displayFont, fontWeight: 700, fontSize: 220, lineHeight: 0.9,
              color: PALETTE.paper, letterSpacing: "0.04em", marginTop: 36,
              textShadow: `0 0 50px ${accent.glow}`,
            }}>
              {e.hero1}
            </div>
          )}
          {e.hero2 && (
            <div style={{
              fontFamily: displayFont, fontWeight: 700, fontSize: 220, lineHeight: 0.9,
              color: accent.hex, letterSpacing: "0.04em",
              textShadow: `0 0 50px ${accent.glow}`,
            }}>
              {e.hero2}
            </div>
          )}

          {e.subtitle && (
            <div style={{
              marginTop: 76, fontFamily: displayFont, fontWeight: 600, fontSize: TYPE_SCALE.subtitle,
              color: PALETTE.paperDim, letterSpacing: "0.36em",
            }}>
              {e.subtitle}
            </div>
          )}
        </div>

        <FooterBar left="End of Game" right="Winner Announced Shortly" accentHex={accent.hex} />
      </div>
    </section>
  );
}

export {
  TitleSlide, RulesSlide, PrizeSlide, CostumeContestSlide, RoundOpener,
  PictureRoundInstructions, QuestionSlide, RoundRecap, PictureRoundRecap,
  IntermissionSlide, TiebreakerIntroSlide, EndSlide,
  ACCENTS, DEFAULTS, PALETTE,
};
