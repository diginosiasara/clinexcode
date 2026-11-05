/** Lector de voz (Web Speech API): reproductor accesible para cualquier página.
 *  Lee códigos CIE, siglas y tablas de forma comprensible; barra de posición, saltos por bloque y sección, atajos. */
import { announce } from "./announcer.js";
import { store } from "./storage.js";

const FILL = {
  play: "M8 5v14l11-7z", pause: "M7 5h4v14H7zM13 5h4v14h-4z",
  prev: "M6 5h2v14H6zM20 5v14L9 12z", next: "M16 5h2v14h-2zM4 5l11 7L4 19z", stop: "M6 6h12v12H6z",
};
const icon = (n) => `<svg class="icon icon--fill" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${FILL[n]}"/></svg>`;
const ICON_OPTS = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
const $ = (s) => document.querySelector(`[data-js="${s}"]`);
const SKIP = "[data-reader-skip], .sr-only, [aria-hidden='true'], [hidden], nav, .pager, .breadcrumb, .toc";

/* ---------- Texto hablable: códigos, siglas y símbolos ---------- */
const ACR = { "CIE-10-ES": "C I E diez E S", "CIE-O": "C I E O", CIE: "C I E", OMS: "O M S", RGPD: "R G P D", VIH: "V I H", SNC: "S N C", INE: "I N E", HPB: "H P B" };
const ACR_RE = new RegExp("\\b(?:" + Object.keys(ACR).sort((a, b) => b.length - a.length).map((k) => k.replace(/-/g, "\\-")).join("|") + ")\\b", "g");
const spell = (s) => s.split("").join(" ");
export function speakable(t) {
  return t
    .replace(ACR_RE, (m) => ACR[m])
    .replace(/\bM-(\d{4})\/(\d{1,2})/g, (m, a, b) => `M ${spell(a)} barra ${spell(b)}`)
    .replace(/\b([A-Z]\d{2}(?:\.[0-9A-Z]+)?)\s?[–-]\s?([A-Z]\d{2})\b/g, "$1 a $2")
    .replace(/\b([A-Z])(\d{2})(?:\.([0-9A-Z]{1,6}|-))?(-)?(?![\w])/g, (m, l, n, rest, dash) =>
      `${l} ${n}` + (rest ? (rest === "-" ? " punto guion" : " punto " + spell(rest)) : "") + (dash ? " guion" : ""))
    .replace(/Excluye([12])/g, "Excluye $1")
    .replace(/p\. ?ej\./gi, "por ejemplo").replace(/\bn\.º/gi, "número")
    .replace(/→/g, " lleva a ").replace(/×/g, " por ").replace(/%/g, " por ciento ").replace(/≥/g, " mayor o igual que ").replace(/≤/g, " menor o igual que ")
    .replace(/·/g, ", ").replace(/[–—]/g, ", ").replace(/\//g, ", ")
    .replace(/\s{2,}/g, " ").trim();
}
// Fragmentos cortos: evita el corte de las voces del navegador en textos largos
function chunk(text) {
  if (text.length <= 220) return [text];
  const parts = text.replace(/([.!?;:])\s+/g, "$1\u0001").split("\u0001"), out = []; let buf = "";
  parts.forEach((p) => { if (buf && (buf + " " + p).length > 220) { out.push(buf); buf = p; } else buf = buf ? buf + " " + p : p; });
  if (buf) out.push(buf);
  return out;
}
// Texto de un elemento: separa bloques en línea (píldoras, botones…) y omite lo decorativo (aria-hidden)
function textOf(el) {
  let s = "";
  for (const n of el.childNodes) {
    if (n.nodeType === 3) s += n.nodeValue;
    else if (n.nodeType === 1 && !n.matches("[aria-hidden='true']")) { const t = textOf(n); s += getComputedStyle(n).display === "inline" ? t : ` ${t} `; }
  }
  return s;
}
function collect(root) {
  const out = [];
  root.querySelectorAll("h1, h2, h3, h4, p, li, dt, dd, tr").forEach((el) => {
    if (el.closest(SKIP) || !el.getClientRects().length) return;
    if (el.matches("li, p") && el.closest("td, th")) return;
    if (el.matches("tr") && el.closest("thead")) return;
    let text;
    if (el.matches("tr")) {   // fila de tabla: «Columna: valor. Columna: valor.»
      const hdr = [...(el.closest("table").tHead?.rows[0]?.cells || [])].map((c) => textOf(c).trim());
      text = [...el.cells].map((c, i) => { const v = textOf(c).replace(/\s+/g, " ").trim(); return hdr[i] && !/^concepto$/i.test(hdr[i]) ? `${hdr[i]}: ${v}` : v; }).join(". ");
    } else {
      text = textOf(el).replace(/\s+/g, " ").trim();
      if (el.matches("ol > li")) text = `${[...el.parentElement.children].indexOf(el) + 1}. ${text}`;
    }
    if (!text) return;
    const heading = el.matches("h1, h2, h3, h4"), say = speakable(text) + (heading ? "." : "");
    out.push({ el, text, heading, chunks: chunk(say) });
  });
  return out;
}

export function initReader() {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return; // sin soporte: no se muestran controles
  const synth = speechSynthesis, panel = $("reader");
  if (!panel) return;
  const pos = $("reader-pos"), now = $("reader-now"), seek = $("reader-seek"), opts = $("reader-options"), optsBtn = $("reader-opts-toggle");
  const btnPrev = $("reader-prev"), btnToggle = $("reader-toggle"), btnNext = $("reader-next"), btnStop = $("reader-stop");
  const secPrev = $("reader-sec-prev"), secNext = $("reader-sec-next"), rateSel = $("reader-rate"), voiceSel = $("reader-voice");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let blocks = [], bi = 0, token = 0, root = null, opener = null, marked = null, paused = false, utt = null, seekTimer;

  btnPrev.innerHTML = icon("prev"); btnNext.innerHTML = icon("next"); btnStop.innerHTML = icon("stop"); optsBtn.innerHTML = ICON_OPTS;
  const setToggle = (state) => { btnToggle.innerHTML = icon(state); btnToggle.setAttribute("aria-label", state === "pause" ? "Pausar lectura" : "Reanudar lectura"); };
  setToggle("pause");

  // Mantiene el contenido visible sobre el reproductor
  if ("ResizeObserver" in window) new ResizeObserver(() => document.body.style.setProperty("--reader-h", panel.offsetHeight + "px")).observe(panel);

  // Preferencias recordadas
  const savedRate = store.get("cie.rate"); if (savedRate) rateSel.value = savedRate;
  function loadVoices() {
    const es = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
    voiceSel.replaceChildren(...es.map((v) => { const o = document.createElement("option"); o.value = v.name; o.textContent = `${v.name} (${v.lang})`; return o; }));
    const saved = store.get("cie.voice"); if (saved && es.some((v) => v.name === saved)) voiceSel.value = saved;
    voiceSel.closest("label").hidden = es.length < 2;   // solo se muestra si hay donde elegir
  }
  loadVoices(); synth.addEventListener?.("voiceschanged", loadVoices);

  function mark(el) {
    marked?.classList.remove("is-reading-now"); marked = el; if (!el) return;
    el.classList.add("is-reading-now");
    const r = el.getBoundingClientRect(), bottom = innerHeight - (panel.offsetHeight + 24);
    if (r.top < 100 || r.bottom > bottom) el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }
  function ui() {
    pos.textContent = `${bi + 1} / ${blocks.length}`;
    now.textContent = blocks[bi]?.text || "";
    seek.max = String(blocks.length); seek.value = String(bi + 1);
    seek.setAttribute("aria-valuetext", `Bloque ${bi + 1} de ${blocks.length}`);
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
    setTimeout(next, 40);   // margen tras cancel(): algunos navegadores pierden el primer fragmento si se encadena de inmediato
  }
  function start(target, btn) {
    stop(true);
    root = target; opener = btn; blocks = collect(target); bi = 0;
    if (!blocks.length) { announce("No hay texto para leer en esta página"); return; }
    target.classList.add("is-reading"); panel.hidden = false; document.body.classList.add("has-reader");
    announce(`Lectura iniciada: ${target.querySelector("h1")?.textContent || document.title}`);
    btnToggle.focus(); speak(0);
  }
  function stop(silent) { token++; synth.cancel(); paused = false; setToggle("pause"); if (!silent) finish("Lectura detenida"); else cleanup(); }
  function cleanup() { mark(null); root?.classList.remove("is-reading"); panel.classList.remove("is-speaking"); panel.hidden = true; document.body.classList.remove("has-reader"); root = null; }
  function finish(msg) { token++; synth.cancel(); cleanup(); announce(msg); opener?.focus(); opener = null; }
  function togglePause() {
    if (paused) { synth.resume(); paused = false; setToggle("pause"); panel.classList.add("is-speaking"); announce("Lectura reanudada"); }
    else { synth.pause(); paused = true; setToggle("play"); panel.classList.remove("is-speaking"); announce("Lectura en pausa"); }
  }
  const jumpSection = (dir) => {
    const heads = blocks.map((b, i) => (b.heading ? i : -1)).filter((i) => i >= 0);
    const target = dir > 0 ? heads.find((i) => i > bi) : [...heads].reverse().find((i) => i < bi);
    if (target != null) speak(target);
  };

  btnToggle.addEventListener("click", togglePause);
  btnPrev.addEventListener("click", () => speak(bi - 1));
  btnNext.addEventListener("click", () => speak(bi + 1));
  btnStop.addEventListener("click", () => stop(false));
  secPrev.addEventListener("click", () => jumpSection(-1));
  secNext.addEventListener("click", () => jumpSection(1));
  optsBtn.addEventListener("click", () => { const open = opts.hidden; opts.hidden = !open; optsBtn.setAttribute("aria-expanded", String(open)); });
  seek.addEventListener("input", () => { clearTimeout(seekTimer); seekTimer = setTimeout(() => { if (root) speak(Number(seek.value) - 1); }, 250); });
  rateSel.addEventListener("change", () => { store.set("cie.rate", rateSel.value); if (root && !paused) speak(bi); });
  voiceSel.addEventListener("change", () => { store.set("cie.voice", voiceSel.value); if (root && !paused) speak(bi); });

  // Atajos dentro del reproductor
  panel.addEventListener("keydown", (e) => {
    if (e.target.matches("select")) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (e.target === seek) return;            // la barra usa sus propias flechas
      e.preventDefault(); const dir = e.key === "ArrowRight" ? 1 : -1;
      if (e.shiftKey) jumpSection(dir); else speak(bi + dir);
    } else if (e.key === " " && e.target === seek) { e.preventDefault(); togglePause(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root && !document.querySelector('[data-js="drawer"][data-open]')) { stop(false); return; }
    // Alt + L: escuchar esta página / pausar / reanudar
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "l") { e.preventDefault(); if (root) togglePause(); else start(target(), null); }
  });
  // «Leer desde aquí»: clic en un párrafo mientras se lee
  document.addEventListener("click", (e) => {
    if (!root || !root.contains(e.target) || e.target.closest("a, button, summary, input, select") || String(getSelection())) return;
    const i = blocks.findIndex((b) => b.el.contains(e.target)); if (i >= 0) speak(i);
  });
  addEventListener("pagehide", () => synth.cancel());

  // Botón de inicio: en artículos junto al título; en el resto de páginas, al principio del contenido
  const target = () => document.querySelector('[data-js="entry"]') || document.getElementById("contenido");
  const mkBtn = (label, onClick) => {
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn btn--cta";
    btn.innerHTML = `${icon("play")}<span>${label}</span>`; btn.addEventListener("click", () => onClick(btn)); return btn;
  };
  const tools = document.querySelector('[data-js="entry-tools"]');
  if (tools) tools.append(mkBtn("Escuchar artículo", (b) => start(target(), b)));
  else {
    const main = document.getElementById("contenido");
    if (main) { const bar = document.createElement("div"); bar.className = "listen-bar"; bar.setAttribute("data-reader-skip", ""); bar.append(mkBtn("Escuchar esta página", (b) => start(main, b))); main.prepend(bar); }
  }
}
