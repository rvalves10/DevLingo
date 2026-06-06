import { useState, useRef, useEffect, useCallback, Component } from "react";
import { celebrate, usePyodide, looksInfinite } from "./effects";
import { AuthProvider, useAuth, authErrorMessage } from "./auth";
import { firebaseEnabled } from "./firebase";
import { awardLessonXp, levelInfo } from "./userData";
import { LESSONS, LESSON_ORDER, getLesson, firstIncompleteLesson, trailStatus } from "./lessons";

// Em produção (Vercel) usa rota relativa; em dev usa o servidor Express local.
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "" : "http://localhost:3001");

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
// Concept: "DevLingo OS" — a gamified developer terminal/IDE learning environment.
const C = {
  // backgrounds (deep OLED-ish so neon pops)
  bg: "#060910", bg2: "#0c1120", bg3: "#121a2e", bg4: "#1b2538",
  border: "#22304a", borderSoft: "#1a2440",
  text: "#eaf0fb", text2: "#8a99b8", text3: "#516084",
  // brand
  green: "#00e5a0", greenDim: "#00b87d", greenDark: "#023a28",
  cyan: "#38e0ff", purple: "#a78bfa", purpleDim: "#7c5cf0",
  amber: "#ffb000", red: "#ff4d6d", orange: "#ff8c42",
  // glow tokens
  glowGreen: "0 0 24px rgba(0,229,160,0.30)",
  glowCyan: "0 0 22px rgba(56,224,255,0.28)",
  glowPurple: "0 0 22px rgba(167,139,250,0.32)",
  glowAmber: "0 0 22px rgba(255,176,0,0.28)",
};

// type scale + fonts
const FONT = {
  display: "'Space Grotesk', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const S = {
  app: { background: C.bg, minHeight: "100dvh", fontFamily: FONT.body, color: C.text, position: "relative", overflowX: "hidden" },
  topbar: { display: "flex", alignItems: "center", gap: 14, padding: "14px 24px", background: "rgba(12,17,32,0.72)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 20 },
  card: { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 },
  tag: { fontSize: 10, fontWeight: 600, letterSpacing: "1.6px", color: C.green, textTransform: "uppercase", marginBottom: 4, fontFamily: FONT.mono },
  title: { fontSize: 21, fontWeight: 600, color: C.text, lineHeight: 1.25, marginBottom: 6, fontFamily: FONT.display, letterSpacing: "-0.3px" },
  btnGreen: { background: C.green, color: "#04130d", border: "none", borderRadius: 11, padding: "10px 20px", fontFamily: FONT.display, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: C.glowGreen },
  btnOutline: { background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 14px", color: C.text2, fontSize: 13, fontFamily: FONT.body, cursor: "pointer" },
  btnPurple: { background: `linear-gradient(135deg, ${C.purpleDim}, ${C.purple})`, border: "none", borderRadius: 11, padding: "9px 20px", color: "#fff", fontFamily: FONT.display, fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: C.glowPurple },
};

// ─── HOOKS ───────────────────────────────────────────────────────────────────

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

// Animated count-up. Respects reduced motion (jumps to final value).
function useCountUp(target, duration = 1100) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? target : 0
  );
  useEffect(() => {
    if (reduced) {
      const id = requestAnimationFrame(() => setVal(target));
      return () => cancelAnimationFrame(id);
    }
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return val;
}

// ─── ICONS (SVG, Lucide-style — no emoji as structural icons) ─────────────────

const ICON_PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  trail: <><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></>,
  sparkles: <><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" /></>,
  award: <><circle cx="12" cy="8" r="6" /><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1" /></>,
  flame: <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></>,
  zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>,
  heart: <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></>,
  check: <><polyline points="20 6 9 17 4 12" /></>,
  play: <><polygon points="6 3 20 12 6 21 6 3" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  arrowLeft: <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  terminal: <><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>,
  trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>,
  barChart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>,
  bulb: <><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></>,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  bot: <><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="6" r="2" /><path d="M12 8v3" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" /></>,
  layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  bug: <><path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path d="M9 7.13V6a3 3 0 1 1 6 0v1.13" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z" /><path d="M12 12v8" /><path d="M6 13H2" /><path d="M22 13h-4" /><path d="m6 9-3-1" /><path d="m21 8-3 1" /></>,
  brackets: <><path d="M8 3H5a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-3" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  function: <><path d="M9 17c0 1-1 2-2.5 2S4 18 4 17s.5-7 1-9 1.5-3 3-3 2 1 2 2" /><line x1="6" y1="11" x2="13" y2="11" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
};

// Iniciais a partir do nome (ou e-mail) para o avatar.
function initialsOf(value) {
  if (!value) return "EU";
  const base = value.split("@")[0].trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// Últimos 7 dias para o calendário de streak (hoje no fim).
function lastSevenDays(streak) {
  const names = ["D", "S", "T", "Q", "Q", "S", "S"];
  const today = new Date();
  const arr = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date(today);
    d.setDate(today.getDate() - k);
    arr.push({ label: names[d.getDay()], isToday: k === 0, active: k < streak });
  }
  return arr;
}

function Icon({ name, size = 18, strokeWidth = 1.9, style, fill = "none" }) {
  const p = ICON_PATHS[name];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: "block", ...style }} aria-hidden="true">
      {p}
    </svg>
  );
}

// ─── GLOBAL STYLES (fonts, scanlines, grid, glow, motion, a11y) ───────────────

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

      * { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }
      body { background: ${C.bg}; }
      textarea, input { color-scheme: dark; }

      /* Ambient grid + scanlines layer */
      .dl-fx::before {
        content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image:
          linear-gradient(${C.border}22 1px, transparent 1px),
          linear-gradient(90deg, ${C.border}22 1px, transparent 1px);
        background-size: 44px 44px;
        mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%);
        -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%);
      }
      .dl-fx::after {
        content: ""; position: fixed; inset: 0; z-index: 1; pointer-events: none;
        background: repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px);
        opacity: 0.35; mix-blend-mode: overlay;
      }
      .dl-orb { position: fixed; border-radius: 50%; filter: blur(70px); z-index: 0; pointer-events: none; opacity: 0.5; }

      /* keyframes */
      @keyframes dl-blink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
      @keyframes dl-dots { 0%,60%,100% { opacity: 0.2; transform: translateY(0) } 30% { opacity: 1; transform: translateY(-3px) } }
      @keyframes dl-float { 0%,100% { transform: translate(0,0) } 50% { transform: translate(18px,-22px) } }
      @keyframes dl-float2 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(-20px,16px) } }
      @keyframes dl-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes dl-pop { 0% { transform: scale(0.8); opacity: 0 } 60% { transform: scale(1.06) } 100% { transform: scale(1); opacity: 1 } }
      @keyframes dl-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,229,160,0.32) } 50% { box-shadow: 0 0 0 6px rgba(0,229,160,0) } }
      @keyframes dl-scan-move { from { transform: translateY(-100%) } to { transform: translateY(100%) } }
      @keyframes dl-shimmer { from { background-position: -200% 0 } to { background-position: 200% 0 } }
      @keyframes dl-spin { to { transform: rotate(360deg) } }
      @keyframes dl-boot-bar { from { width: 0% } to { width: 100% } }

      .dl-rise { animation: dl-rise 0.45s ease-out both; }
      .dl-pop { animation: dl-pop 0.4s cubic-bezier(.34,1.56,.64,1) both; }
      .dl-blink { animation: dl-blink 1s step-end infinite; }
      .dl-pulse { animation: dl-pulse 2.4s ease-out infinite; }

      .dl-press { transition: transform 0.12s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease; }
      .dl-press:active { transform: scale(0.96); }

      .dl-link { transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.2s ease, transform 0.12s ease; }

      /* focus visibility for keyboard users */
      :focus-visible { outline: 2px solid ${C.cyan}; outline-offset: 2px; border-radius: 6px; }
      button, [role="button"], a { -webkit-tap-highlight-color: transparent; }

      ::selection { background: rgba(0,229,160,0.28); color: #fff; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: ${C.text3}; }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
        .dl-fx::before, .dl-fx::after, .dl-orb { display: none; }
      }
    `}</style>
  );
}

// Ambient floating glow orbs (decorative; hidden under reduced motion via CSS)
function Ambient() {
  return (
    <>
      <div className="dl-orb" style={{ width: 340, height: 340, top: -80, left: -60, background: "radial-gradient(circle, rgba(0,229,160,0.5), transparent 70%)", animation: "dl-float 16s ease-in-out infinite" }} />
      <div className="dl-orb" style={{ width: 300, height: 300, top: 200, right: -80, background: "radial-gradient(circle, rgba(124,92,240,0.45), transparent 70%)", animation: "dl-float2 19s ease-in-out infinite" }} />
      <div className="dl-orb" style={{ width: 260, height: 260, bottom: -60, left: "40%", background: "radial-gradient(circle, rgba(56,224,255,0.3), transparent 70%)", animation: "dl-float 22s ease-in-out infinite" }} />
    </>
  );
}

// blinking terminal cursor
function Cursor({ color = C.green }) {
  return <span className="dl-blink" style={{ display: "inline-block", width: 9, height: "1.05em", background: color, marginLeft: 4, verticalAlign: "text-bottom", borderRadius: 1, boxShadow: `0 0 8px ${color}` }} />;
}

// stat pill used in topbars
function StatPill({ icon, value, label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "7px 13px", fontSize: 13 }}>
      <span style={{ color, display: "flex" }}><Icon name={icon} size={15} fill={icon === "heart" || icon === "flame" ? "currentColor" : "none"} /></span>
      <span style={{ fontFamily: FONT.mono, fontWeight: 700, color: C.text }}>{value}</span>
      <span style={{ color: C.text2, fontSize: 12 }}>{label}</span>
    </div>
  );
}

// progress bar with glow
function Bar({ pct, color = C.green, glow = true, height = 8 }) {
  return (
    <div style={{ height, background: C.bg4, borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}aa, ${color})`, borderRadius: 99, boxShadow: glow ? `0 0 12px ${color}88` : "none", transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

// ─── SHARED NAV ────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 20px 18px", borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
      <div style={{ width: 38, height: 38, background: `linear-gradient(135deg, ${C.greenDim}, ${C.green})`, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", color: "#04130d", boxShadow: C.glowGreen }}>
        <Icon name="terminal" size={20} strokeWidth={2.4} />
      </div>
      <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 17, color: C.text, letterSpacing: "-0.5px" }}>Dev<span style={{ color: C.green }}>Lingo</span></span>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <div onClick={onClick} role="button" tabIndex={0} aria-current={active ? "page" : undefined}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="dl-link"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", fontSize: 14, color: active ? C.green : C.text2, cursor: "pointer", borderLeft: active ? `2px solid ${C.green}` : "2px solid transparent", background: active ? "rgba(0,229,160,0.07)" : "transparent", fontWeight: active ? 600 : 400 }}>
      <Icon name={icon} size={17} /> {label}
    </div>
  );
}

function NavSection({ label }) {
  return <div style={{ padding: "16px 20px 5px", fontSize: 10, fontWeight: 600, letterSpacing: "1.6px", color: C.text3, textTransform: "uppercase", fontFamily: FONT.mono }}>{label}</div>;
}

function Sidebar({ screen, setScreen, user, userData, logout }) {
  const displayName = user?.displayName || user?.email || "João Silva";
  const lv = levelInfo(userData?.xp ?? 840);
  return (
    <nav style={{ background: "rgba(12,17,32,0.6)", backdropFilter: "blur(10px)", borderRight: `1px solid ${C.border}`, padding: "20px 0", display: "flex", flexDirection: "column", gap: 3, position: "sticky", top: 0, height: "100dvh" }}>
      <Logo />
      <NavSection label="// aprender" />
      <NavItem icon="dashboard" label="Dashboard" active={screen === "dashboard"} onClick={() => setScreen("dashboard")} />
      <NavItem icon="trail" label="Trilhas" active={screen === "lesson"} onClick={() => setScreen("lesson")} />
      <NavItem icon="sparkles" label="Tutor IA" active={screen === "tutor"} onClick={() => setScreen("tutor")} />
      <NavSection label="// progresso" />
      <NavItem icon="award" label="Perfil & Conquistas" active={screen === "profile"} onClick={() => setScreen("profile")} />
      <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: FONT.display, flexShrink: 0 }}>{initialsOf(displayName)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
            <div style={{ fontSize: 11, color: C.text2, fontFamily: FONT.mono }}>Nível {lv.level} · {lv.title}</div>
          </div>
          {logout && (
            <button onClick={logout} aria-label="Sair" title="Sair" className="dl-press" style={{ background: "transparent", border: "none", color: C.text3, cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}><Icon name="logout" size={16} /></button>
          )}
        </div>
      </div>
    </nav>
  );
}

// Mobile bottom navigation (≤5 items, icon + label)
function BottomNav({ screen, setScreen }) {
  const items = [
    { id: "dashboard", icon: "dashboard", label: "Início" },
    { id: "lesson", icon: "trail", label: "Trilhas" },
    { id: "tutor", icon: "sparkles", label: "Tutor" },
    { id: "profile", icon: "award", label: "Perfil" },
  ];
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", background: "rgba(12,17,32,0.92)", backdropFilter: "blur(14px)", borderTop: `1px solid ${C.border}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
      {items.map((it) => {
        const active = screen === it.id;
        return (
          <button key={it.id} onClick={() => setScreen(it.id)} aria-current={active ? "page" : undefined}
            className="dl-press"
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0 12px", background: "transparent", border: "none", color: active ? C.green : C.text2, cursor: "pointer", minHeight: 56 }}>
            <Icon name={it.icon} size={20} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, fontFamily: FONT.body }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ setScreen, isMobile, user, userData, openLesson }) {
  const xpTotal = userData?.xp ?? 840;
  const lv = levelInfo(xpTotal);
  const xp = useCountUp(xpTotal);
  const streak = userData?.streak ?? 12;
  const lives = userData?.lives ?? 5;
  const firstName = (user?.displayName || user?.email?.split("@")[0] || "João").split(" ")[0];
  const completed = userData?.completedLessons || [];
  const badgeSet = userData ? new Set(userData.badges || []) : null;

  const trails = [
    { label: "Variáveis & Tipos", desc: "Caixas que guardam dados", status: "done", icon: "brackets" },
    { label: "Condicionais", desc: "if / else / switch", status: "done", icon: "code" },
    { label: "Loops & Iteração", desc: "for, while e trace tables", status: "active", icon: "trail" },
    { label: "Funções", desc: "Parâmetros, retorno, escopo", status: "locked", icon: "function" },
    { label: "Arrays & Objetos", desc: "Estruturas de dados básicas", status: "locked", icon: "layers" },
  ];
  // Status real da trilha (logado), derivado das lições concluídas.
  const tStatus = userData ? trailStatus(completed) : null;
  const nextLesson = firstIncompleteLesson(completed);
  const allDone = userData && completed.length >= LESSONS.length;
  const statusOf = (t) => (tStatus ? (tStatus[t.label] || "locked") : t.status);
  const lessonOfTrail = (label) => LESSONS.find((l) => l.trail === label);

  // Calendário dos últimos 7 dias para o streak
  const weekDays = lastSevenDays(streak);

  // Leaderboard com o XP real do usuário, reordenado por pontuação
  const lb = [
    { init: "AN", color: "#534AB7", name: "ana_dev", xp: 1240 },
    { init: "RM", color: "#0F6E56", name: "rodrigo_m", xp: 1090 },
    { init: "LK", color: "#854F0B", name: "lara_k", xp: 710 },
    { init: "PT", color: "#993C1D", name: "pedrot", xp: 580 },
    { init: initialsOf(firstName), color: "#3B6D11", name: "você", xp: xpTotal, me: true },
  ].sort((a, b) => b.xp - a.xp).map((r, i) => ({ ...r, pos: i + 1 }));
  return (
    <div style={{ padding: isMobile ? "20px 16px 90px" : 28, position: "relative", zIndex: 2 }}>
      {/* topbar */}
      <div className="dl-rise" style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 14, marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: C.green, letterSpacing: 1, marginBottom: 4 }}>~/devlingo $ daily --login</div>
          <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: C.text, letterSpacing: -0.6, fontFamily: FONT.display }}>Bom dia, {firstName}<Cursor /></h1>
          <p style={{ fontSize: 14, color: C.text2, marginTop: 3 }}>{streak > 1 ? `Você está há ${streak} dias seguidos. Continue assim!` : "Bem-vindo! Que tal começar uma lição hoje?"}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatPill icon="flame" value={String(streak)} label="dias" color={C.orange} />
          <StatPill icon="zap" value={xp.toLocaleString("pt-BR")} label="XP" color={C.amber} />
          <StatPill icon="heart" value={String(lives)} label="vidas" color={C.red} />
        </div>
      </div>

      {/* XP Bar */}
      <div className="dl-rise" style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: C.text2 }}>Nível {lv.level} — <span style={{ color: C.green }}>{lv.title}</span></span>
          <span style={{ fontFamily: FONT.mono, fontSize: 13, color: C.green }}>{lv.xpInto} / {lv.xpForNext} XP</span>
        </div>
        <Bar pct={lv.pct} color={C.green} />
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {[["zap", "Primeiro Código", "first-code", true], ["star", "Loop Master", "loop-master", true], ["flame", "10 dias", "streak-10", true], ["function", "Funções", "function-wizard", false], ["layers", "Arrays", "array-slayer", false]].map(([ic, b, id, demo]) => {
            const earned = badgeSet ? badgeSet.has(id) : demo;
            return (
              <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: earned ? "rgba(0,229,160,0.08)" : C.bg3, border: `1px solid ${earned ? C.greenDim : C.border}`, borderRadius: 9, padding: "5px 11px", fontSize: 11, fontWeight: 500, color: earned ? C.green : C.text2, boxShadow: earned ? "0 0 14px rgba(0,229,160,0.12)" : "none" }}>
                <Icon name={earned ? ic : "lock"} size={13} /> {b}
              </span>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 18 }}>
        {/* Trilha */}
        <div className="dl-rise" style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16, fontFamily: FONT.display }}>
            <span style={{ color: C.green }}><Icon name="trail" size={18} /></span> Trilha: Lógica de Programação
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {trails.map((t, i) => {
              const colors = { done: C.green, active: C.bg3, locked: C.bg3 };
              const borderColors = { done: C.greenDim, active: C.green, locked: C.border };
              const tagColors = { done: C.green, active: C.cyan, locked: C.text3 };
              const tagBg = { done: "rgba(0,229,160,0.1)", active: "rgba(56,224,255,0.1)", locked: C.bg4 };
              const labels = { done: "COMPLETO", active: "EM CURSO", locked: "BLOQUEADO" };
              const st = statusOf(t);
              const isActive = st === "active";
              const clickable = openLesson && (st === "active" || st === "done");
              return (
                <div key={t.label} onClick={() => { if (clickable) { const ls = lessonOfTrail(t.label); if (ls) openLesson(ls.id); } }} className="dl-link" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 6px", margin: "0 -6px", borderRadius: 8, borderBottom: i < trails.length - 1 ? `1px solid ${C.border}` : "none", cursor: clickable ? "pointer" : "default" }}>
                  <div className={isActive ? "dl-pulse" : ""} style={{ width: 40, height: 40, borderRadius: 12, background: colors[st], border: `2px solid ${borderColors[st]}`, display: "flex", alignItems: "center", justifyContent: "center", color: st === "done" ? "#04130d" : st === "active" ? C.green : C.text3, flexShrink: 0 }}>
                    <Icon name={st === "done" ? "check" : st === "active" ? "play" : "lock"} size={17} fill={st === "active" ? "currentColor" : "none"} strokeWidth={st === "done" ? 2.6 : 1.9} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.display }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>{t.desc}</div>
                  </div>
                  <span style={{ background: tagBg[st], color: tagColors[st], borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", fontFamily: FONT.mono }}>{labels[st]}</span>
                </div>
              );
            })}
          </div>
          <button onClick={() => (openLesson ? openLesson(nextLesson.id) : setScreen("lesson"))} className="dl-press" style={{ ...S.btnGreen, width: "100%", marginTop: 18, padding: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="play" size={15} fill="currentColor" /> {userData ? (allDone ? "Revisar lições" : `Continuar: ${nextLesson.trail}`) : "Continuar Loops & Iteração"}
          </button>
        </div>

        {/* Lado direito */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Próxima lição */}
          <div className="dl-rise" style={{ background: `linear-gradient(160deg, ${C.bg3}, ${C.bg2})`, border: `1px solid ${C.greenDim}`, borderRadius: 16, padding: 18, boxShadow: "0 0 30px rgba(0,229,160,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600, letterSpacing: 1, color: C.green, textTransform: "uppercase", marginBottom: 8, fontFamily: FONT.mono }}><Icon name="sparkles" size={13} /> Próxima Lição</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4, fontFamily: FONT.display }}>{nextLesson.title}</div>
            <div style={{ fontSize: 12, color: C.text2, marginBottom: 14, lineHeight: 1.6 }}>{nextLesson.challengeDesc.replace(/\*\*/g, "").replace(/`/g, "")}</div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.text3, fontFamily: FONT.mono }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={13} /> ~4 min</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="zap" size={13} /> +{nextLesson.xp} XP</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="star" size={13} /> Iniciante</span>
            </div>
          </div>

          {/* Streak */}
          <div className="dl-rise" style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ color: C.orange, display: "flex" }}><Icon name="flame" size={36} fill="currentColor" strokeWidth={1.4} /></span>
              <div>
                <strong style={{ display: "block", fontSize: 22, color: C.text, fontFamily: FONT.mono }}>{streak} {streak === 1 ? "dia" : "dias"}</strong>
                <span style={{ fontSize: 12, color: C.text2 }}>{streak > 1 ? "não desista agora!" : "comece seu streak!"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {weekDays.map((wd, i) => (
                <div key={i} style={{ flex: 1, aspectRatio: "1", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, fontFamily: FONT.mono, background: wd.isToday ? C.orange : wd.active ? "rgba(255,140,66,0.15)" : C.bg3, color: wd.isToday ? "#1a0d00" : wd.active ? C.orange : C.text3, border: `1.5px solid ${wd.isToday ? C.orange : wd.active ? "rgba(255,140,66,0.35)" : C.border}`, boxShadow: wd.isToday ? C.glowAmber : "none" }}>{wd.label}</div>
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="dl-rise" style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12, fontFamily: FONT.display }}><span style={{ color: C.amber }}><Icon name="trophy" size={16} /></span> Liga da Semana</div>
            {lb.map(r => (
              <div key={r.pos} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: r.pos < 5 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontFamily: FONT.mono, fontSize: 12, color: r.pos <= 2 ? C.amber : C.text3, width: 16, textAlign: "center" }}>{r.pos}</span>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: r.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#fff", flexShrink: 0, fontFamily: FONT.display }}>{r.init}</div>
                <span style={{ flex: 1, fontSize: 13, color: r.me ? C.green : C.text, fontWeight: r.me ? 600 : 400 }}>{r.name}</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 12, color: r.me ? C.green : C.text2 }}>{r.xp.toLocaleString("pt-BR")} xp</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LESSON ───────────────────────────────────────────────────────────────────

// Traduz erros do Python em dicas educativas para iniciantes.
function pythonErrorFeedback(error, lesson) {
  const e = error || "";
  const nameMatch = e.match(/name '([^']+)' is not defined/);
  if (nameMatch) {
    const nm = nameMatch[1];
    return { text: `O Python achou que **${nm}** é uma variável, mas ela não existe. Se era para ser um **texto**, é só colocar entre aspas: \`"${nm}"\`.`, hint: `nome = "${nm}"\nprint(nome)` };
  }
  if (/SyntaxError|IndentationError/.test(e)) {
    return { text: "Tem um **erro de sintaxe**. Confira a indentação (os espaços no início da linha) e os dois-pontos `:` no fim do `if`/`while`.", hint: lesson.placeholder };
  }
  if (/TypeError/.test(e)) {
    return { text: "**Erro de tipo** — você pode estar misturando texto com número. Confira os valores e use aspas só no que for texto.", hint: lesson.placeholder };
  }
  return { text: "Seu código deu um erro ao rodar. Leia a mensagem em vermelho acima — ela explica o que aconteceu.", hint: lesson.placeholder };
}

function Lesson({ setScreen, isMobile, onComplete, alreadyDone, lessonId }) {
  const lesson = getLesson(lessonId);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState(null);
  const [aiMsg, setAiMsg] = useState(null);
  const [hearts, setHearts] = useState([true, true, true, true, true]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(!!alreadyDone);
  const { status: pyStatus, run: pyRun } = usePyodide();

  // Simulação passo a passo (exclusiva de lições com `trace`, ex: loops)
  const trace = lesson.trace;
  const steps = trace ? trace.steps : [];
  const [stepIndex, setStepIndex] = useState(0);
  const [traceRows, setTraceRows] = useState(trace ? trace.tableRows : []);
  const activeStep = trace && stepIndex < steps.length ? steps[stepIndex] : null;
  const lessonIdx = LESSON_ORDER.indexOf(lesson.id);

  function nextStep() {
    if (!trace || stepIndex >= steps.length) return;
    const s = steps[stepIndex];
    const newRows = [...traceRows];
    if (s.row < newRows.length) {
      newRows[s.row] = { ...newRows[s.row], i: s.rI, c: s.rC, p: s.rP };
      setTraceRows(newRows);
    }
    setStepIndex(stepIndex + 1);
  }

  function loseHeart() {
    const h = [...hearts];
    for (let i = h.length - 1; i >= 0; i--) { if (h[i]) { h[i] = false; break; } }
    setHearts(h);
  }

  function onSuccess(outLines) {
    setOutput({ lines: outLines, ok: true });
    setAiMsg({ text: lesson.successMsg, hint: null });
    if (!done) { setDone(true); celebrate(); onComplete?.(lesson); }
  }

  async function runCode() {
    const c = code.trim();
    if (!c || running) return;

    if (pyStatus === "ready") {
      if (looksInfinite(c)) {
        loseHeart();
        setOutput({ lines: ["Loop infinito detectado — execução interrompida ♾"], ok: false });
        setAiMsg({ text: "Cuidado com o **loop infinito**! Garanta que a condição vire falsa em algum momento (incremente a variável).", hint: "i += 1  # dentro do loop" });
        return;
      }
      setRunning(true);
      const res = await pyRun(code);
      setRunning(false);
      if (!res.ok) {
        loseHeart();
        const errLine = (res.error || "Erro de execução").split("\n").filter(Boolean).pop();
        setOutput({ lines: [errLine], ok: false });
        setAiMsg(pythonErrorFeedback(res.error, lesson));
        return;
      }
      const outLines = res.output.split("\n").map(s => s.trimEnd()).filter(l => l !== "");
      const verdict = lesson.check(res.output, code);
      if (verdict.ok) {
        onSuccess(outLines.length ? outLines : ["✓ executado"]);
      } else {
        loseHeart();
        setOutput({ lines: outLines.length ? outLines : ["(nenhuma saída)"], ok: false });
        setAiMsg({ text: verdict.feedback, hint: verdict.hint });
      }
      return;
    }

    // Pyodide indisponível (raro)
    setOutput({ lines: ["Não consegui iniciar o Python no navegador."], ok: false });
    setAiMsg({ text: "O ambiente Python não carregou. Recarregue a página (F5) para tentar de novo.", hint: null });
  }

  function showHint() {
    setAiMsg({ text: "Um empurrãozinho 👇 — observe o **exemplo** ao lado e adapte para o desafio. A estrutura é esta:", hint: lesson.placeholder });
  }

  return (
    <div style={{ position: "relative", zIndex: 2 }}>
      {/* topbar */}
      <div style={S.topbar}>
        <button onClick={() => setScreen("dashboard")} className="dl-press" style={{ ...S.btnOutline, display: "flex", alignItems: "center", gap: 6 }} aria-label="Voltar ao dashboard"><Icon name="arrowLeft" size={15} /> {!isMobile && "Voltar"}</button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.text2 }}>{lessonIdx + 1}/{LESSONS.length}</span>
          <div style={{ flex: 1, maxWidth: 360 }}><Bar pct={Math.round(((lessonIdx + 1) / LESSONS.length) * 100)} color={C.green} height={8} /></div>
        </div>
        <div style={{ display: "flex", gap: 4 }} aria-label={`${hearts.filter(Boolean).length} vidas restantes`}>
          {hearts.map((h, i) => <span key={i} style={{ color: C.red, opacity: h ? 1 : 0.2, display: "flex" }}><Icon name="heart" size={17} fill={h ? "currentColor" : "none"} /></span>)}
        </div>
        <div style={{ background: "rgba(255,176,0,0.13)", border: `1px solid rgba(255,176,0,0.4)`, borderRadius: 20, padding: "5px 12px", fontFamily: FONT.mono, fontSize: 12, color: C.amber, fontWeight: 700 }}>+{lesson.xp} XP</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", alignItems: "start" }}>
        {/* ESQUERDA */}
        <div style={{ padding: isMobile ? "20px 16px" : 24, borderRight: isMobile ? "none" : `1px solid ${C.border}`, borderBottom: isMobile ? `1px solid ${C.border}` : "none", display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="dl-rise">
            <div style={{ ...S.tag, display: "flex", alignItems: "center", gap: 6 }}><Icon name="sparkles" size={12} /> {lesson.tag}</div>
            <div style={S.title}>{lesson.title}</div>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: renderMd(lesson.intro) }} />
          </div>

          {/* Exemplo */}
          <div className="dl-rise" style={{ background: "#080c14", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#0d1320", borderBottom: `1px solid ${C.border}`, fontFamily: FONT.mono, fontSize: 11, color: C.text3 }}>
              <Icon name="code" size={13} /> exemplo.py
            </div>
            <pre style={{ margin: 0, padding: 16, fontFamily: FONT.mono, fontSize: 13, color: C.cyan, lineHeight: 1.7, whiteSpace: "pre-wrap", overflowX: "auto" }}>{lesson.example}</pre>
          </div>

          {/* Simulação + trace (apenas lições com `trace`, ex: loops) */}
          {trace && (
            <>
              <div className="dl-rise" style={S.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.text3, textTransform: "uppercase", marginBottom: 14, fontFamily: FONT.mono }}><Icon name="target" size={13} /> Simulação Visual do Loop</div>
                {[
                  { label: "código", val: activeStep ? activeStep.code : "i = 0", hl: !!activeStep, color: C.green },
                  { label: "condição", val: activeStep ? `${activeStep.cond} → ?` : "i < 4 → ?", hl: !!activeStep, color: C.amber },
                  { label: "resultado", val: activeStep ? activeStep.result : "...", hl: activeStep && activeStep.result.includes("true"), color: C.green },
                  { label: "saída", val: activeStep ? activeStep.out : "aguardando...", hl: activeStep && activeStep.out.includes("→"), color: C.cyan },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: row.color, width: 65, textAlign: "right", flexShrink: 0, fontFamily: FONT.mono }}>{row.label}</span>
                    <div style={{ flex: 1, background: row.hl ? `rgba(0,229,160,0.06)` : C.bg3, border: `1px solid ${row.hl ? C.green : C.border}`, borderRadius: 8, padding: "8px 12px", fontFamily: FONT.mono, fontSize: 13, color: row.hl ? C.green : C.text, transition: "all 0.3s", boxShadow: row.hl ? "0 0 14px rgba(0,229,160,0.1)" : "none" }}>{row.val}</div>
                  </div>
                ))}
                <button onClick={nextStep} disabled={stepIndex >= steps.length} className="dl-press" style={{ width: "100%", marginTop: 10, background: C.bg3, border: `1.5px solid ${C.green}`, borderRadius: 9, padding: "10px 18px", color: C.green, fontSize: 13, fontFamily: FONT.display, fontWeight: 600, cursor: stepIndex >= steps.length ? "default" : "pointer", opacity: stepIndex >= steps.length ? 0.55 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Icon name={stepIndex >= steps.length ? "check" : "play"} size={15} fill={stepIndex >= steps.length ? "none" : "currentColor"} /> {stepIndex >= steps.length ? "Simulação completa" : "Próximo Passo"}
                </button>
              </div>

              <div className="dl-rise" style={S.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.text3, textTransform: "uppercase", marginBottom: 12, fontFamily: FONT.mono }}><Icon name="barChart" size={13} /> Trace Table</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT.mono, fontSize: 12 }}>
                  <thead>
                    <tr>{trace.headers.map(h => <th key={h} style={{ background: C.bg3, color: C.text3, fontWeight: 700, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", padding: "8px 10px", border: `1px solid ${C.border}`, textAlign: "center" }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {traceRows.map((r, i) => {
                      const isActive = activeStep && activeStep.row === i;
                      return (
                        <tr key={i} style={{ background: isActive ? "rgba(0,229,160,0.05)" : "transparent" }}>
                          {[r.volta, r.i, r.c, r.p].map((v, j) => <td key={j} style={{ padding: "8px 10px", border: `1px solid ${isActive ? C.greenDim : C.border}`, textAlign: "center", color: isActive ? C.green : C.text2, transition: "all 0.3s" }}>{v}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* DIREITA */}
        <div style={{ padding: isMobile ? "20px 16px 90px" : 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="dl-rise">
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600, letterSpacing: "1.5px", color: C.cyan, textTransform: "uppercase", fontFamily: FONT.mono }}><Icon name="code" size={12} /> Desafio de Código</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginTop: 4, lineHeight: 1.4, fontFamily: FONT.display }}>{lesson.challengeTitle}</div>
            <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginTop: 6 }} dangerouslySetInnerHTML={{ __html: renderMd(lesson.challengeDesc) }} />
          </div>

          {/* Editor */}
          <div className="dl-rise" style={{ background: "#080c14", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#0d1320", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", gap: 6 }}>
                {["#ff5f56", "#ffbd2e", "#27c93f"].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: FONT.mono, fontSize: 11, color: C.text3 }}>
                {(() => {
                  const st = pyStatus === "ready" ? { c: C.green, t: "python 3 · pronto", pulse: false } : pyStatus === "error" ? { c: C.text3, t: "modo offline", pulse: false } : { c: C.amber, t: "iniciando python…", pulse: true };
                  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span className={st.pulse ? "dl-blink" : ""} style={{ width: 7, height: 7, borderRadius: "50%", background: st.c, boxShadow: `0 0 8px ${st.c}` }} />{st.t}</span>;
                })()}
                <span>main.py</span>
              </div>
            </div>
            <textarea value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (code.trim()) runCode(); } }}
              placeholder={lesson.placeholder}
              style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", outline: "none", padding: 16, fontFamily: FONT.mono, fontSize: 13, color: "#e8eaf0", resize: "none", lineHeight: 1.7, minHeight: 160 }} spellCheck={false} maxLength={2000} />
            <div style={{ display: "flex", gap: 10, padding: "10px 16px", background: "#0d1320", borderTop: `1px solid ${C.border}` }}>
              <button onClick={showHint} className="dl-press" style={{ flex: 1, background: "rgba(167,139,250,0.12)", border: `1.5px solid rgba(167,139,250,0.5)`, borderRadius: 9, padding: "9px 16px", color: C.purple, fontSize: 13, fontFamily: FONT.display, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Icon name="bulb" size={15} /> Pedir dica à IA</button>
              {(() => {
                const blocked = !code.trim() || running || pyStatus === "loading";
                const label = running ? "Executando…" : pyStatus === "loading" ? "Carregando Python…" : "Executar";
                return (
                  <button onClick={runCode} disabled={blocked} className="dl-press" style={{ ...S.btnGreen, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: blocked ? 0.45 : 1, cursor: blocked ? "default" : "pointer", boxShadow: blocked ? "none" : C.glowGreen }}>
                    {running || pyStatus === "loading"
                      ? <span style={{ width: 14, height: 14, border: "2px solid rgba(4,19,13,0.35)", borderTopColor: "#04130d", borderRadius: "50%", display: "inline-block", animation: "dl-spin 0.7s linear infinite" }} />
                      : <Icon name="play" size={14} fill="currentColor" />}
                    {label}
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Output */}
          {output && (
            <div className="dl-rise" style={{ background: "#080c14", border: `1px solid ${output.ok ? C.greenDim : "rgba(255,77,109,0.4)"}`, borderRadius: 12, padding: "14px 16px", fontFamily: FONT.mono, fontSize: 13, lineHeight: 1.7 }}>
              <div style={{ color: C.text3, fontSize: 11, marginBottom: 6 }}>$ python main.py</div>
              {output.lines.map((l, i) => <div key={i} style={{ color: output.ok ? C.green : C.red }}>{output.ok ? l : `✗ ${l}`}</div>)}
              {output.ok && <div style={{ color: C.text3, marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}><Icon name="check" size={13} /> Processo encerrou normalmente.</div>}
            </div>
          )}

          {/* AI feedback */}
          {aiMsg && (
            <div className="dl-rise" style={{ ...S.card, display: "flex", gap: 12, borderColor: "rgba(167,139,250,0.3)" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg,${C.purpleDim},${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", boxShadow: C.glowPurple }}><Icon name="sparkles" size={17} /></div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, marginBottom: 4, letterSpacing: "0.5px", textTransform: "uppercase", fontFamily: FONT.mono }}>Tutor DevLingo</div>
                <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: renderMd(aiMsg.text) }} />
                {aiMsg.hint && <div style={{ marginTop: 10, background: C.bg3, borderLeft: `3px solid ${C.purple}`, padding: "9px 12px", borderRadius: "0 8px 8px 0", fontSize: 12, color: C.text2, fontFamily: FONT.mono, whiteSpace: "pre-wrap" }}>{aiMsg.hint}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Markdown rendering helper (shared, XSS-safe) ─────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function renderMd(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${C.text}">$1</strong>`)
    .replace(/`([^`]+)`/g, `<code style="background:${C.bg3};padding:1px 5px;border-radius:4px;font-family:${FONT.mono};font-size:12px;color:${C.green}">$1</code>`)
    .replace(/\n/g, "<br/>");
}

// ─── TUTOR ────────────────────────────────────────────────────────────────────

function Tutor({ setScreen, isMobile }) {
  const [messages, setMessages] = useState([{ role: "ai", text: "Olá! Sou o Tutor DevLingo. Estou aqui para te ajudar com **Loops & Iteração** — mas não vou entregar a resposta. Vou te fazer pensar até você chegar lá. 🧠\n\nQual é a sua dúvida?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const msgsRef = useRef(null);

  useEffect(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, [messages, loading]);

  const send = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    const newHistory = [...history, { role: "user", content: text }];
    setHistory(newHistory);
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages(m => [...m, { role: "ai", text: data.error || "O tutor está indisponível agora. Tente novamente em instantes." }]);
      } else {
        const reply = data.reply || "Tive um problema, tente novamente!";
        setHistory(h => [...h, { role: "assistant", content: reply }]);
        setMessages(m => [...m, { role: "ai", text: reply }]);
      }
    } catch (err) {
      console.error("Erro no chat:", err.message);
      setMessages(m => [...m, { role: "ai", text: "Não consegui falar com o tutor. Verifique sua conexão e se o servidor está no ar." }]);
    }
    setLoading(false);
  }, [history, loading]);

  const chips = [
    { icon: "bulb", t: "O que é incremento?" },
    { icon: "function", t: "Por que loop infinito?" },
    { icon: "code", t: "while vs for" },
    { icon: "barChart", t: "Como usar trace table?" },
  ];

  return (
    <div style={{ position: "relative", zIndex: 2 }}>
      <div style={S.topbar}>
        <button onClick={() => setScreen("dashboard")} className="dl-press" style={{ ...S.btnOutline, display: "flex", alignItems: "center", gap: 6 }} aria-label="Voltar"><Icon name="arrowLeft" size={15} /> {!isMobile && "Voltar"}</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${C.purpleDim},${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: C.glowPurple }}><Icon name="bot" size={19} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.display }}>Tutor DevLingo</div>
            <div style={{ fontSize: 12, color: C.text2 }}>modo socrático — nunca entrega a resposta</div>
          </div>
        </div>
        {!isMobile && <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,229,160,0.1)", border: `1px solid rgba(0,229,160,0.25)`, borderRadius: 20, padding: "5px 12px", fontSize: 12, color: C.green }}><Icon name="layers" size={13} /> Loops & Iteração</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 290px" }}>
        {/* CHAT */}
        <div style={{ borderRight: isMobile ? "none" : `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
          <div ref={msgsRef} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, minHeight: 380, maxHeight: isMobile ? "calc(100dvh - 320px)" : 520, overflowY: "auto" }}>
            {messages.map((m, i) => (
              <div key={i} className="dl-rise" style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: m.role === "ai" ? `linear-gradient(135deg,${C.purpleDim},${C.purple})` : C.bg4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#fff", flexShrink: 0 }}>{m.role === "ai" ? <Icon name="sparkles" size={15} /> : "EU"}</div>
                <div style={{ maxWidth: "82%", padding: "12px 16px", borderRadius: m.role === "ai" ? "4px 14px 14px 14px" : "14px 4px 14px 14px", fontSize: 14, lineHeight: 1.7, background: m.role === "ai" ? C.bg2 : "rgba(0,229,160,0.1)", border: `1px solid ${m.role === "ai" ? C.border : "rgba(0,229,160,0.2)"}`, color: C.text }} dangerouslySetInnerHTML={{ __html: renderMd(m.text) }} />
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg,${C.purpleDim},${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Icon name="sparkles" size={15} /></div>
                <div style={{ padding: "14px 18px", borderRadius: "4px 14px 14px 14px", background: C.bg2, border: `1px solid ${C.border}`, display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 0.2, 0.4].map((d, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.purple, display: "inline-block", animation: `dl-dots 1.2s ${d}s infinite` }} />)}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}`, background: C.bg2 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {chips.map(c => (
                <button key={c.t} onClick={() => send(c.t)} disabled={loading} className="dl-press" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.bg3, border: `1.5px solid ${C.border}`, borderRadius: 20, padding: "6px 13px", fontSize: 12, color: loading ? C.text3 : C.text2, cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1, fontFamily: FONT.body }}><Icon name={c.icon} size={13} /> {c.t}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Escreva sua dúvida..." rows={1} style={{ flex: 1, boxSizing: "border-box", background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 11, padding: "11px 14px", fontFamily: FONT.body, fontSize: 14, color: C.text, outline: "none", resize: "none", lineHeight: 1.5, minHeight: 46 }} maxLength={2000} />
              <button onClick={() => send(input)} disabled={loading || !input.trim()} className="dl-press" aria-label="Enviar" style={{ ...S.btnPurple, width: 46, height: 46, borderRadius: 11, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: (loading || !input.trim()) ? 0.4 : 1 }}><Icon name="send" size={18} /></button>
            </div>
          </div>
        </div>

        {/* LADO */}
        {!isMobile && (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.text3, textTransform: "uppercase", marginBottom: 12, fontFamily: FONT.mono }}><Icon name="target" size={13} /> Contexto</div>
              {[["trail", "Trilha", "Lógica de Programação"], ["play", "Lição", "Loops & Iteração · L3"], ["zap", "XP", "+50 XP ao concluir"]].map(([ic, l, v]) => (
                <div key={l} style={{ display: "flex", gap: 9, padding: "8px 0", borderBottom: l !== "XP" ? `1px solid ${C.border}` : "none", alignItems: "center" }}>
                  <span style={{ color: C.text3, display: "flex" }}><Icon name={ic} size={15} /></span>
                  <div><div style={{ fontSize: 11, color: C.text2 }}>{l}</div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{v}</div></div>
                </div>
              ))}
            </div>
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.text3, textTransform: "uppercase", marginBottom: 12, fontFamily: FONT.mono }}><Icon name="sparkles" size={13} /> Regras do Tutor</div>
              {["Nunca dá a resposta direta", "Explica erros com linguagem simples", "Usa exemplos do mundo real", "Celebra quando você acerta"].map(r => (
                <div key={r} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.text2, alignItems: "center" }}><span style={{ color: C.purple, display: "flex" }}><Icon name="check" size={13} /></span>{r}</div>
              ))}
            </div>
            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.text3, textTransform: "uppercase", marginBottom: 12, fontFamily: FONT.mono }}><Icon name="barChart" size={13} /> Progresso</div>
              {[["Variáveis", 100, C.green], ["Condicionais", 85, C.cyan], ["Loops", 40, C.amber], ["Funções", 0, C.text3], ["Arrays", 0, C.text3]].map(([n, p, c]) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 9 }}>
                  <span style={{ color: C.text2, width: 80, flexShrink: 0 }}>{n}</span>
                  <div style={{ flex: 1 }}><Bar pct={p} color={c} glow={p > 0} height={5} /></div>
                  <span style={{ fontFamily: FONT.mono, fontSize: 10, color: C.text3, width: 28, textAlign: "right" }}>{p}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

function Profile({ setScreen, isMobile, user, userData, logout }) {
  const xpTotal = userData?.xp ?? 840;
  const lv = levelInfo(xpTotal);
  const totalXp = useCountUp(xpTotal);
  const streak = userData?.streak ?? 12;
  const displayName = user?.displayName || user?.email || "João Silva";
  const handle = user?.email ? "@" + user.email.split("@")[0] : "@joaodev";
  const earnedSet = userData ? new Set(userData.badges || []) : null;
  const tp = userData?.topicProgress || null;
  const badges = [
    { id: "first-code", icon: "zap", name: "Primeiro Código", desc: "Completou sua primeira lição", xp: "+100 XP", demo: true },
    { id: "streak-10", icon: "flame", name: "10-Day Streak", desc: "Estudou 10 dias seguidos", xp: "+150 XP", demo: true },
    { id: "loop-master", icon: "star", name: "Loop Master", desc: "Completou o módulo de loops", xp: "+200 XP", demo: true },
    { id: "bug-hunter", icon: "bug", name: "Bug Hunter", desc: "Debugou 10 erros com a IA", xp: "+150 XP", demo: false },
    { id: "function-wizard", icon: "function", name: "Function Wizard", desc: "Completou funções", xp: "+200 XP", demo: false },
    { id: "streak-30", icon: "calendar", name: "30-Day Streak", desc: "Estudou 30 dias seguidos", xp: "+300 XP", demo: false },
    { id: "array-slayer", icon: "layers", name: "Array Slayer", desc: "Completou arrays", xp: "+200 XP", demo: false },
    { id: "liga-ouro", icon: "trophy", name: "Liga Ouro", desc: "Top 1 da liga semanal", xp: "+500 XP", demo: false },
  ].map(b => ({ ...b, earned: earnedSet ? earnedSet.has(b.id) : b.demo }));
  const earnedCount = badges.filter(b => b.earned).length;
  const mockHistory = [
    { icon: "check", type: "done", title: "Lição concluída — Condicionais", time: "Hoje, 09:14", val: "+50 XP", valColor: C.green },
    { icon: "flame", type: "streak", title: "Streak de 12 dias atingido!", time: "Hoje, 09:14", val: "+12", valColor: C.orange },
    { icon: "check", type: "done", title: "Lição concluída — Loops", time: "Ontem, 21:30", val: "+50 XP", valColor: C.green },
  ];
  // Atividade real do usuário: lições concluídas + conquistas (mais recentes primeiro).
  const history = userData
    ? [
        ...[...(userData.completedLessons || [])].reverse().map((id) => {
          const l = getLesson(id);
          return { icon: "check", type: "done", title: `Lição concluída — ${l.trail}`, time: l.tag, val: `+${l.xp} XP`, valColor: C.green };
        }),
        ...(userData.badges || []).map((bid) => {
          const b = badges.find((x) => x.id === bid);
          return { icon: "award", type: "xp", title: `Conquista: ${b ? b.name : bid}`, time: b ? b.desc : "", val: "★", valColor: C.amber };
        }),
      ]
    : mockHistory;
  const iconBg = { done: "rgba(0,229,160,0.1)", streak: "rgba(255,140,66,0.1)", xp: "rgba(255,176,0,0.1)" };
  const iconColor = { done: C.green, streak: C.orange, xp: C.amber };

  return (
    <div style={{ position: "relative", zIndex: 2 }}>
      <div style={S.topbar}>
        <button onClick={() => setScreen("dashboard")} className="dl-press" style={{ ...S.btnOutline, display: "flex", alignItems: "center", gap: 6 }} aria-label="Voltar"><Icon name="arrowLeft" size={15} /> {!isMobile && "Voltar"}</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: C.text, fontFamily: FONT.display }}>Perfil & Conquistas</span>
        {logout && <button onClick={logout} className="dl-press" style={{ ...S.btnOutline, display: "flex", alignItems: "center", gap: 6 }} aria-label="Sair"><Icon name="logout" size={14} /> {!isMobile && "Sair"}</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "300px 1fr", alignItems: "start" }}>
        {/* ESQUERDA */}
        <div style={{ padding: isMobile ? "20px 16px" : 24, borderRight: isMobile ? "none" : `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="dl-rise" style={{ ...S.card, textAlign: "center", padding: 24 }}>
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: "#fff", margin: "0 auto 12px", position: "relative", border: `3px solid ${C.bg4}`, fontFamily: FONT.display, boxShadow: "0 0 30px rgba(124,58,237,0.4)" }}>
              {initialsOf(displayName)}
              <div style={{ position: "absolute", bottom: -4, right: -4, background: C.amber, color: "#1a0d00", fontFamily: FONT.mono, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, border: `2px solid ${C.bg2}` }}>Nv.{lv.level}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 2, fontFamily: FONT.display, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
            <div style={{ fontSize: 13, color: C.text3, fontFamily: FONT.mono, marginBottom: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{handle}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[[totalXp.toLocaleString("pt-BR"), "XP Total"], [String(streak), "Streak"], [`${earnedCount}/8`, "Badges"]].map(([v, l]) => (
                <div key={l} style={{ background: C.bg3, borderRadius: 11, padding: "11px 8px", textAlign: "center" }}>
                  <div style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 700, color: C.text }}>{v}</div>
                  <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(255,176,0,0.08)", border: `1px solid rgba(255,176,0,0.2)`, borderRadius: 11, padding: 11 }}>
              <span style={{ color: C.amber, display: "flex" }}><Icon name="trophy" size={18} /></span>
              <span style={{ fontSize: 13, color: C.amber, fontWeight: 500 }}>Liga Prata · #3 da semana</span>
            </div>
          </div>

          <div className="dl-rise" style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.text3, textTransform: "uppercase", marginBottom: 12, fontFamily: FONT.mono }}><Icon name="barChart" size={13} /> XP por Tópico</div>
            {[["Variáveis", "variaveis", C.green], ["Condicionais", "condicionais", C.cyan], ["Loops", "loops", C.amber], ["Funções", "funcoes", C.purple], ["Arrays", "arrays", C.orange]].map(([n, key, c]) => {
              const mock = { variaveis: 100, condicionais: 85, loops: 40, funcoes: 0, arrays: 0 }[key];
              const p = tp ? (tp[key] || 0) : mock;
              const color = p > 0 ? c : C.text3;
              return (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 9 }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: p > 0 ? `0 0 8px ${color}` : "none" }} />
                  <span style={{ color: C.text2, width: 80, flexShrink: 0 }}>{n}</span>
                  <div style={{ flex: 1 }}><Bar pct={p} color={color} glow={p > 0} height={5} /></div>
                  <span style={{ fontFamily: FONT.mono, fontSize: 10, color: C.text3, width: 34, textAlign: "right" }}>{p}%</span>
                </div>
              );
            })}
          </div>

          <div className="dl-rise" style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ color: C.orange, display: "flex" }}><Icon name="flame" size={34} fill="currentColor" strokeWidth={1.4} /></span>
              <div><strong style={{ display: "block", fontSize: 20, color: C.text, fontFamily: FONT.mono }}>{streak} dias</strong><span style={{ fontSize: 12, color: C.text2 }}>{userData ? "Continue firme!" : "Recorde: 18 dias"}</span></div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {lastSevenDays(streak).map((wd, i) => (
                <div key={i} style={{ flex: 1, aspectRatio: "1", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, fontFamily: FONT.mono, background: wd.isToday ? C.orange : wd.active ? "rgba(255,140,66,0.15)" : C.bg3, color: wd.isToday ? "#1a0d00" : wd.active ? C.orange : C.text3, border: `1.5px solid ${wd.isToday ? C.orange : wd.active ? "rgba(255,140,66,0.35)" : C.border}`, boxShadow: wd.isToday ? C.glowAmber : "none" }}>{wd.label}</div>
              ))}
            </div>
          </div>
        </div>

        {/* DIREITA */}
        <div style={{ padding: isMobile ? "20px 16px 90px" : 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="dl-rise">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT.display }}><span style={{ color: C.amber }}><Icon name="award" size={17} /></span> Conquistas</span>
              <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.text3 }}>{earnedCount} / 8 desbloqueadas</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(auto-fill, minmax(130px,1fr))" : "repeat(auto-fill, minmax(155px,1fr))", gap: 10 }}>
              {badges.map(b => (
                <div key={b.name} className="dl-press" style={{ background: b.earned ? "rgba(0,229,160,0.04)" : C.bg2, border: `1px solid ${b.earned ? "rgba(0,229,160,0.3)" : C.border}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", opacity: b.earned ? 1 : 0.5, boxShadow: b.earned ? "0 0 20px rgba(0,229,160,0.08)" : "none", cursor: "default" }}>
                  <div style={{ width: 52, height: 52, background: b.earned ? "rgba(0,229,160,0.1)" : C.bg3, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", color: b.earned ? C.green : C.text3 }}><Icon name={b.earned ? b.icon : "lock"} size={24} fill={b.earned && (b.icon === "flame" || b.icon === "star") ? "currentColor" : "none"} /></div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: FONT.display }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.4 }}>{b.desc}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 10, color: b.earned ? C.green : C.text3 }}>{b.xp}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="dl-rise" style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 14, fontFamily: FONT.display }}><span style={{ color: C.text3 }}><Icon name="clock" size={16} /></span> Atividade Recente</div>
            {history.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "24px 16px", textAlign: "center" }}>
                <span style={{ color: C.text3 }}><Icon name="sparkles" size={26} /></span>
                <div style={{ fontSize: 13, color: C.text2 }}>Nenhuma atividade ainda.</div>
                <div style={{ fontSize: 12, color: C.text3 }}>Complete sua primeira lição para começar!</div>
              </div>
            ) : history.map((h, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: iconBg[h.type], color: iconColor[h.type], flexShrink: 0 }}><Icon name={h.icon} size={16} fill={h.icon === "flame" ? "currentColor" : "none"} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{h.title}</div>
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 1, fontFamily: FONT.mono }}>{h.time}</div>
                </div>
                <span style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: h.valColor }}>{h.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AUTH SCREEN (login / cadastro) ──────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.4 0 10.3-2.1 14-5.5l-6.5-5.3c-2 1.5-4.6 2.3-7.5 2.3-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.5 5.3c-.4.3 7-5.1 7-14.7 0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function AuthScreen() {
  const { signup, login, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState("login"); // login | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setErr(""); setBusy(true);
    try {
      if (mode === "signup") await signup(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
    } catch (e2) { setErr(authErrorMessage(e2.code)); setBusy(false); }
  }

  async function google() {
    if (busy) return;
    setErr(""); setBusy(true);
    try { await loginWithGoogle(); }
    catch (e2) { setErr(authErrorMessage(e2.code)); setBusy(false); }
  }

  const input = { width: "100%", boxSizing: "border-box", background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontFamily: FONT.body, fontSize: 14, color: C.text, outline: "none", marginBottom: 10 };

  return (
    <div className="dl-fx" style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <Ambient />
      <div className="dl-rise" style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11, marginBottom: 8 }}>
          <div style={{ width: 42, height: 42, background: `linear-gradient(135deg, ${C.greenDim}, ${C.green})`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#04130d", boxShadow: C.glowGreen }}>
            <Icon name="terminal" size={22} strokeWidth={2.4} />
          </div>
          <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 22, color: C.text }}>Dev<span style={{ color: C.green }}>Lingo</span></span>
        </div>
        <p style={{ textAlign: "center", color: C.text2, fontSize: 13, marginBottom: 22, fontFamily: FONT.mono }}>// {mode === "login" ? "acesse sua conta" : "crie sua conta gratuita"}</p>

        <form onSubmit={submit} style={{ ...S.card, padding: 24 }}>
          {mode === "signup" && (
            <input style={input} placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
          )}
          <input style={input} type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          <input style={input} type="password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required />

          {err && <div role="alert" style={{ background: "rgba(255,77,109,0.1)", border: `1px solid rgba(255,77,109,0.3)`, color: C.red, fontSize: 12.5, padding: "9px 12px", borderRadius: 8, marginBottom: 10 }}>{err}</div>}

          <button type="submit" disabled={busy} className="dl-press" style={{ ...S.btnGreen, width: "100%", padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.5 : 1, marginBottom: 14 }}>
            {busy ? <span style={{ width: 15, height: 15, border: "2px solid rgba(4,19,13,0.35)", borderTopColor: "#04130d", borderRadius: "50%", animation: "dl-spin 0.7s linear infinite" }} /> : <Icon name={mode === "login" ? "terminal" : "sparkles"} size={15} />}
            {mode === "login" ? "Entrar" : "Criar conta"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", color: C.text3, fontSize: 11, fontFamily: FONT.mono }}>
            <div style={{ flex: 1, height: 1, background: C.border }} /> ou <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          <button type="button" onClick={google} disabled={busy} className="dl-press" style={{ width: "100%", boxSizing: "border-box", background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.text, fontSize: 14, fontFamily: FONT.display, fontWeight: 600, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, opacity: busy ? 0.5 : 1 }}>
            <GoogleIcon /> Continuar com Google
          </button>
        </form>

        <p style={{ textAlign: "center", color: C.text2, fontSize: 13, marginTop: 18 }}>
          {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }} style={{ background: "none", border: "none", color: C.green, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT.body, padding: 0 }}>
            {mode === "login" ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── BOOT SCREEN (Terminal OS first-load sequence) ────────────────────────────

const BOOT_LINES = [
  "DevLingo OS v2.0 — inicializando kernel…",
  "[ OK ] módulos de ensino carregados",
  "[ OK ] tutor IA conectado",
  "[ OK ] progresso & XP sincronizados",
  "[ OK ] ambiente de código pronto",
  "> bem-vindo, dev. bons estudos!",
];

function BootScreen({ onDone }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= BOOT_LINES.length) {
      const t = setTimeout(onDone, 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown((s) => s + 1), 320);
    return () => clearTimeout(t);
  }, [shown, onDone]);

  return (
    <div role="status" aria-label="Inicializando DevLingo" style={{ position: "fixed", inset: 0, zIndex: 9999, background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT.mono }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 44, height: 44, background: `linear-gradient(135deg, ${C.greenDim}, ${C.green})`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#04130d", boxShadow: C.glowGreen }}>
            <Icon name="terminal" size={24} strokeWidth={2.4} />
          </div>
          <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 22, color: C.text, letterSpacing: "-0.5px" }}>Dev<span style={{ color: C.green }}>Lingo</span></span>
        </div>
        <div style={{ minHeight: 150 }}>
          {BOOT_LINES.slice(0, shown).map((l, i) => (
            <div key={i} className="dl-rise" style={{ fontSize: 13, color: l.startsWith("[ OK ]") ? C.green : l.startsWith(">") ? C.cyan : C.text2, marginBottom: 6, lineHeight: 1.5 }}>
              {l}{i === shown - 1 && <Cursor />}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, height: 4, background: C.bg4, borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", background: `linear-gradient(90deg, ${C.greenDim}, ${C.green})`, width: `${(shown / BOOT_LINES.length) * 100}%`, transition: "width 0.3s ease", boxShadow: C.glowGreen }} />
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

// Rede de segurança: troca qualquer "tela branca" por erro de render por uma
// mensagem amigável com botão de recarregar.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("Erro capturado pelo ErrorBoundary:", error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <>
          <GlobalStyles />
          <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, fontFamily: FONT.body, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${C.greenDim}, ${C.green})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#04130d" }}>
              <Icon name="terminal" size={26} strokeWidth={2.4} />
            </div>
            <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 20 }}>Ops, algo travou.</div>
            <div style={{ color: C.text2, fontSize: 14, maxWidth: 360, lineHeight: 1.6 }}>Tivemos um erro inesperado ao montar a tela. Recarregar costuma resolver.</div>
            <button onClick={() => window.location.reload()} className="dl-press" style={{ ...S.btnGreen, marginTop: 4 }}>Recarregar</button>
          </div>
        </>
      );
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  return (
    <>
      <GlobalStyles />
      <div className="dl-fx" style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ambient />
        <div style={{ position: "relative", zIndex: 2, width: 30, height: 30, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "dl-spin 0.8s linear infinite" }} />
      </div>
    </>
  );
}

function DevLingoApp() {
  const { user, userData, setUserData, loading, logout } = useAuth();
  const [screen, setScreen] = useState("dashboard");
  const [lessonId, setLessonId] = useState(null);
  const isMobile = useMediaQuery("(max-width: 860px)");
  const [booting, setBooting] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    try { return !sessionStorage.getItem("dl_booted"); } catch { return true; }
  });
  const finishBoot = useCallback(() => {
    try { sessionStorage.setItem("dl_booted", "1"); } catch { /* ignore */ }
    setBooting(false);
  }, []);

  const currentLessonId = lessonId || firstIncompleteLesson(userData?.completedLessons || []).id;
  const lessonDone = !!userData?.completedLessons?.includes(currentLessonId);

  const openLesson = useCallback((id) => {
    setLessonId(id || null);
    setScreen("lesson");
  }, []);

  // Salva a conclusão da lição (recebe a config da lição concluída), só na 1ª vez.
  const handleLessonComplete = useCallback(async (lesson) => {
    if (!firebaseEnabled || !user || !lesson) return; // modo demo / sem lição
    if (userData?.completedLessons?.includes(lesson.id)) return; // já concluída antes
    try {
      const updated = await awardLessonXp(user, { lessonId: lesson.id, xp: lesson.xp, topic: lesson.topic, topicPct: lesson.topicPct });
      setUserData(updated);
    } catch (e) { console.error("Erro ao salvar progresso:", e.message); }
  }, [user, userData, setUserData]);

  // Boot roda UMA vez no carregamento da página (sobre qualquer tela),
  // não depois do login — por isso vem antes dos guards de auth.
  if (booting) return (<><GlobalStyles /><BootScreen onDone={finishBoot} /></>);
  // Firebase ligado e ainda verificando a sessão → spinner
  if (firebaseEnabled && loading) return <LoadingScreen />;
  // Firebase ligado e ninguém logado → tela de login
  if (firebaseEnabled && !user) return (<><GlobalStyles /><AuthScreen /></>);
  // Logado, mas o perfil ainda está vindo do Firestore → espera (evita montar a
  // tela com dados vazios logo após o login, que era a causa do erro).
  if (firebaseEnabled && user && !userData) return <LoadingScreen />;

  const fullscreenScreens = ["lesson", "tutor"];
  const isFull = fullscreenScreens.includes(screen);

  return (
    <>
      <GlobalStyles />
      <div className="dl-fx" style={S.app}>
        <Ambient />
        {isMobile ? (
          <div style={{ position: "relative", zIndex: 2 }}>
            {screen === "dashboard" && <Dashboard setScreen={setScreen} isMobile user={user} userData={userData} openLesson={openLesson} />}
            {screen === "lesson" && <Lesson setScreen={setScreen} isMobile lessonId={currentLessonId} onComplete={handleLessonComplete} alreadyDone={lessonDone} />}
            {screen === "tutor" && <Tutor setScreen={setScreen} isMobile />}
            {screen === "profile" && <Profile setScreen={setScreen} isMobile user={user} userData={userData} logout={user ? logout : undefined} />}
            <BottomNav screen={screen} setScreen={setScreen} />
          </div>
        ) : isFull ? (
          <div style={{ position: "relative", zIndex: 2 }}>
            {screen === "lesson"
              ? <Lesson setScreen={setScreen} isMobile={false} lessonId={currentLessonId} onComplete={handleLessonComplete} alreadyDone={lessonDone} />
              : <Tutor setScreen={setScreen} isMobile={false} />}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", minHeight: "100dvh", position: "relative", zIndex: 2 }}>
            <Sidebar screen={screen} setScreen={setScreen} user={user} userData={userData} logout={user ? logout : undefined} />
            <div>
              {screen === "dashboard" && <Dashboard setScreen={setScreen} isMobile={false} user={user} userData={userData} openLesson={openLesson} />}
              {screen === "profile" && <Profile setScreen={setScreen} isMobile={false} user={user} userData={userData} logout={user ? logout : undefined} />}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function DevLingo() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DevLingoApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
