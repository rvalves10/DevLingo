// ─── Celebration + Python runtime helpers for DevLingo ────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";

const BRAND_COLORS = ["#00e5a0", "#38e0ff", "#a78bfa", "#ffb000"];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Confetti burst (center + both corners). Skipped under reduced motion.
export function fireConfetti() {
  if (prefersReducedMotion()) return;
  confetti({ particleCount: 90, spread: 72, origin: { y: 0.6 }, colors: BRAND_COLORS, disableForReducedMotion: true });
  setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: BRAND_COLORS }), 140);
  setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: BRAND_COLORS }), 140);
}

// Synthesized "level up" arpeggio via Web Audio (no audio asset needed).
export function playLevelUp() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio not available — ignore */
  }
}

export function celebrate() {
  fireConfetti();
  playLevelUp();
}

// ─── Pyodide (real Python in the browser via WebAssembly) ─────────────────────
const PYODIDE_VERSION = "v0.26.4";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;
let pyodidePromise = null; // module-level singleton so we load it once

function loadPyodideOnce() {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = new Promise((resolve, reject) => {
    if (window.loadPyodide) {
      window.loadPyodide({ indexURL: PYODIDE_URL }).then(resolve).catch(reject);
      return;
    }
    const script = document.createElement("script");
    script.src = `${PYODIDE_URL}pyodide.js`;
    script.onload = () => {
      window.loadPyodide({ indexURL: PYODIDE_URL }).then(resolve).catch(reject);
    };
    script.onerror = () => reject(new Error("Falha ao baixar o Pyodide"));
    document.head.appendChild(script);
  });
  return pyodidePromise;
}

// Lazily loads Pyodide and exposes a `run(code)` that captures stdout/stderr.
export function usePyodide() {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const pyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadPyodideOnce()
      .then((py) => { if (!cancelled) { pyRef.current = py; setStatus("ready"); } })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const run = useCallback(async (code) => {
    const py = pyRef.current;
    if (!py) throw new Error("Pyodide ainda não está pronto");
    let out = "";
    py.setStdout({ batched: (s) => { out += s + "\n"; } });
    py.setStderr({ batched: (s) => { out += s + "\n"; } });
    try {
      await py.runPythonAsync(code);
      return { ok: true, output: out };
    } catch (err) {
      return { ok: false, output: out, error: String(err?.message || err) };
    }
  }, []);

  return { status, run };
}

// Cheap static guard against the classic infinite-loop mistake, so we never
// freeze the main thread running unbounded `while` loops in Pyodide.
export function looksInfinite(code) {
  if (!/\bwhile\b/.test(code)) return false;
  if (/\bbreak\b/.test(code)) return false;
  // `while True:` with no break is definitely infinite
  if (/\bwhile\s+True\s*:/.test(code)) return true;
  // a while loop with no counter mutation (i += 1 / i = i + 1) is very likely infinite
  const hasMutation = /[-+*]=/.test(code) || /\b(\w+)\s*=\s*\1\s*[-+]/.test(code);
  return !hasMutation;
}
