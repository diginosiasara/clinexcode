/** Lector de voz (Web Speech API): reproductor accesible con pausa, saltos por párrafo, velocidad, voz y progreso. */
import { announce } from "./announcer.js";
import { store } from "./storage.js";

const PATHS = {
  play: "M8 5v14l11-7z", pause: "M7 5h4v14H7zM13 5h4v14h-4z",
  prev: "M6 5h2v14H6zM20 5v14L9 12z", next: "M16 5h2v14h-2zM4 5l11 7L4 19z", stop: "M6 6h12v12H6z",
};
const icon = (n) => `<svg class="icon icon--fill" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${PATHS[n]}"/></svg>`;
const $ = (s) => document.querySelector(`[data-js="${s}"]`);

export function initReader() {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return; // sin soporte: no se muestran controles
  const synth = speechSynthesis;
  const panel = $("reader"), pos = $("reader-pos"), now = $("reader-now"), fill = $("reader-fill");
  const btnPrev = $("reader-prev"), btnToggle = $("reader-toggle"), btnNext = $("reader-next"), btnStop = $("reader-stop");
  const rateSel = $("reader-rate"), voiceSel = $("reader-voice");
  if (!panel) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let blocks = [], bi = 0, token = 0, art = null, opener = null, marked = null, paused = false, utt = null;

  btnPrev.innerHTML = icon("prev"); btnNext.innerHTML = icon("next"); btnStop.innerHTML = icon("stop");
  const setToggle = (state) => {
    btnToggle.innerHTML = icon(state);
    btnToggle.setAttribute("aria-label", state === "pause" ? "Pausar lectura" : "Reanudar lectura");
  };
  setToggle("pause");

  // Preferencias recordadas
  const savedRate = store.get("cie.rate"); if (savedRate) rateSel.value = savedRate;
  function loadVoices() {
    const es = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
    voiceSel.replaceChildren(...es.map((v) => { const o = document.createElement("option"); o.value = v.name; o.textContent = `${v.name} (${v.lang})`; return o; }));
    const saved = store.get("cie.voice"); if (saved && es.some((v) => v.name === saved)) voiceSel.value = saved;
    voiceSel.closest("label").hidden = es.length < 2; // solo se muestra si hay donde elegir
  }
  loadVoices(); synth.addEventListener?.("voiceschanged", loadVoices);

  function collect(root) {
    const out = [];
    root.querySelectorAll("h1, h2, p, li, dt, dd, tr").forEach((el) => {
      if (el.closest("[data-reader-skip], .sr-only")) return;
      if (el.matches("li, p") && el.closest("td, th")) return;
      const text = el.matches("tr") ? [...el.cells].map((c) => c.textContent.trim()).join(". ") : el.textContent.replace(/\s+/g, " ").trim();
      if (text) out.push({ el, text, chunks: chunk(text) });
    });
    return out;
  }
  // Fragmentos cortos: evita el corte de las voces del navegador en textos largos
  function chunk(text) {
    if (text.length <= 220) return [text];
    const parts = text.replace(/([.!?;:])\s+/g, "$1\u0001").split("\u0001"), out = []; let buf = "";
    parts.forEach((p) => { if (buf && (buf + " " + p).length > 220) { out.push(buf); buf = p; } else buf = buf ? buf + " " + p : p; });
    if (buf) out.push(buf);
    return out;
  }

  function mark(el) {
    marked?.classList.remove("is-reading-now"); marked = el; if (!el) return;
    el.classList.add("is-reading-now");
    const r = el.getBoundingClientRect();
    if (r.top < 120 || r.bottom > innerHeight - 220) el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }
  function ui() {
    pos.textContent = `${bi + 1} / ${blocks.length}`;
    now.textContent = blocks[bi]?.text || "";
    fill.style.width = `${(bi / Math.max(1, blocks.length)) * 100}%`;
    btnPrev.disabled = bi === 0; btnNext.disabled = bi >= blocks.length - 1;
  }

  function speak(i) {
    const my = ++token; synth.cancel();
    if (paused) { synth.resume(); paused = false; setToggle("pause"); }
    if (i >= blocks.length) return finish("Lectura terminada");
    bi = Math.max(0, i); const b = blocks[bi]; mark(b.el); ui(); panel.classList.add("is-speaking");
    let ci = 0;
    const next = () => {
      if (my !== token) return;
      if (ci >= b.chunks.length) return speak(bi + 1);
      const u = (utt = new SpeechSynthesisUtterance(b.chunks[ci++]));
      const v = synth.getVoices().find((x) => x.name === voiceSel.value);
      u.lang = v ? v.lang : "es-ES"; if (v) u.voice = v; u.rate = Number(rateSel.value);
      u.onend = next;
      u.onerror = (e) => { if (my === token && e.error !== "canceled" && e.error !== "interrupted") finish("Error del lector de voz"); };
      synth.speak(u);
    };
    next();
  }
  function start(root, btn) {
    stop(true);
    art = root; opener = btn; blocks = collect(root); bi = 0;
    if (!blocks.length) return;
    root.classList.add("is-reading"); panel.hidden = false; document.body.classList.add("has-reader");
    announce(`Lectura iniciada: ${root.querySelector("h1").textContent}`);
    btnToggle.focus(); speak(0);
  }
  function stop(silent) { token++; synth.cancel(); paused = false; setToggle("pause"); if (!silent) finish("Lectura detenida"); else cleanup(); }
  function cleanup() { mark(null); art?.classList.remove("is-reading"); panel.classList.remove("is-speaking"); panel.hidden = true; document.body.classList.remove("has-reader"); art = null; }
  function finish(msg) { token++; synth.cancel(); cleanup(); announce(msg); opener?.focus(); opener = null; }

  btnToggle.addEventListener("click", () => {
    if (paused) { synth.resume(); paused = false; setToggle("pause"); panel.classList.add("is-speaking"); announce("Lectura reanudada"); }
    else { synth.pause(); paused = true; setToggle("play"); panel.classList.remove("is-speaking"); announce("Lectura en pausa"); }
  });
  btnPrev.addEventListener("click", () => speak(bi - 1));
  btnNext.addEventListener("click", () => speak(bi + 1));
  btnStop.addEventListener("click", () => stop(false));
  rateSel.addEventListener("change", () => { store.set("cie.rate", rateSel.value); if (art && !paused) speak(bi); });
  voiceSel.addEventListener("change", () => { store.set("cie.voice", voiceSel.value); if (art && !paused) speak(bi); });
  panel.addEventListener("keydown", (e) => {
    if (e.target.matches("select")) return;
    if (e.key === "ArrowLeft" && !btnPrev.disabled) { e.preventDefault(); speak(bi - 1); }
    if (e.key === "ArrowRight" && !btnNext.disabled) { e.preventDefault(); speak(bi + 1); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && art && !document.querySelector('[data-js="drawer"][data-open]')) stop(false);
  });
  // «Leer desde aquí»: clic en un párrafo mientras se lee
  document.addEventListener("click", (e) => {
    if (!art || !art.contains(e.target) || e.target.closest("a, button, summary, input, select") || String(getSelection())) return;
    const i = blocks.findIndex((b) => b.el.contains(e.target)); if (i >= 0) speak(i);
  });
  addEventListener("pagehide", () => synth.cancel());

  document.querySelectorAll('[data-js="entry-tools"]').forEach((box) => {
    const root = box.closest('[data-js="entry"]');
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn btn--cta";
    btn.innerHTML = `${icon("play")}<span>Escuchar artículo</span>`;
    btn.addEventListener("click", () => start(root, btn));
    box.append(btn);
  });
}
