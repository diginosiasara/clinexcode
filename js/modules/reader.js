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
    const heading = el.matches("h1, h2, h3, h4");
    out.push({ el, text, heading, lvl: heading ? Number(el.tagName[1]) : 9, chunks: chunk(speakable(text) + (heading ? "." : "")) });
  });
  return out;
}
const textBlocks = (txt) => txt.split(/\n+/).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean)
  .map((text) => ({ el: null, text, heading: false, lvl: 9, chunks: chunk(speakable(text)) }));

export function initReader() {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return; // sin soporte: no se muestran controles
  const synth = speechSynthesis, panel = $("reader");
  if (!panel) return;
  const pos = $("reader-pos"), now = $("reader-now"), seek = $("reader-seek"), opts = $("reader-options"), optsBtn = $("reader-opts-toggle");
  const btnPrev = $("reader-prev"), btnToggle = $("reader-toggle"), btnNext = $("reader-next"), btnStop = $("reader-stop");
  const secPrev = $("reader-sec-prev"), secNext = $("reader-sec-next"), pickChip = $("reader-pick"), cont = $("reader-cont");
  const rateSel = $("reader-rate"), voiceSel = $("reader-voice");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Estado: blocks = todo lo leíble; [lo, hi) = rango que se está leyendo (sección, desde un punto, selección o todo)
  let blocks = [], lo = 0, hi = 0, bi = 0, token = 0, root = null, opener = null, marked = null, paused = false, utt = null, seekTimer;
  let picking = false, pickRoot = null, pickBlocks = [], pi = -1, hint = null;
  const pickBtns = [pickChip];

  btnPrev.innerHTML = icon("prev"); btnNext.innerHTML = icon("next"); btnStop.innerHTML = icon("stop"); optsBtn.innerHTML = ICON_OPTS;
  const setToggle = (state) => { btnToggle.innerHTML = icon(state); btnToggle.setAttribute("aria-label", state === "pause" ? "Pausar lectura" : "Reanudar lectura"); };
  setToggle("pause");
  if ("ResizeObserver" in window) new ResizeObserver(() => document.body.style.setProperty("--reader-h", panel.offsetHeight + "px")).observe(panel);

  // Preferencias recordadas
  const savedRate = store.get("cie.rate"); if (savedRate) rateSel.value = savedRate;
  cont.checked = store.get("cie.cont") === "1";
  cont.addEventListener("change", () => store.set("cie.cont", cont.checked ? "1" : "0"));
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
    pos.textContent = `${bi - lo + 1} / ${hi - lo}`;
    now.textContent = blocks[bi]?.text || "";
    seek.min = String(lo + 1); seek.max = String(Math.max(lo + 1, hi)); seek.value = String(bi + 1);
    seek.setAttribute("aria-valuetext", `Bloque ${bi - lo + 1} de ${hi - lo}`);
    btnPrev.disabled = bi <= lo; btnNext.disabled = bi >= hi - 1;
  }

  function speak(i) {
    const my = ++token; synth.cancel();
    if (paused) { synth.resume(); paused = false; setToggle("pause"); }
    if (i >= hi) {
      if (cont.checked && hi < blocks.length) hi = blocks.length;          // seguir con el resto
      else return finish(hi < blocks.length ? "Sección terminada" : "Lectura terminada");
    }
    bi = Math.max(lo, i); const b = blocks[bi]; mark(b.el); ui(); panel.classList.add("is-speaking");
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
  /** Inicia la lectura. opts: { blocks, from, to, quiet } */
  function start(target, btn, o = {}) {
    exitPick(); stop(true);
    root = target; opener = btn; blocks = o.blocks || collect(target);
    lo = o.from || 0; hi = o.to ?? blocks.length; bi = lo;
    if (!blocks.length || lo >= hi) { announce("No hay texto para leer aquí"); return; }
    if (!o.quiet) target.classList.add("is-reading");
    panel.hidden = false; document.body.classList.add("has-reader");
    announce(`Lectura iniciada: ${o.label || target.querySelector("h1")?.textContent || document.title}`);
    btnToggle.focus(); speak(lo);
  }
  function stop(silent) { token++; synth.cancel(); paused = false; setToggle("pause"); if (!silent) finish("Lectura detenida"); else cleanup(); }
  function cleanup() { mark(null); root?.classList.remove("is-reading"); panel.classList.remove("is-speaking"); panel.hidden = true; document.body.classList.remove("has-reader"); root = null; }
  function finish(msg) { token++; synth.cancel(); cleanup(); announce(msg); (opener && document.contains(opener) ? opener : null)?.focus(); opener = null; }
  function togglePause() {
    if (paused) { synth.resume(); paused = false; setToggle("pause"); panel.classList.add("is-speaking"); announce("Lectura reanudada"); }
    else { synth.pause(); paused = true; setToggle("play"); panel.classList.remove("is-speaking"); announce("Lectura en pausa"); }
  }
  const jumpSection = (dir) => {
    const heads = blocks.map((b, i) => (b.heading && i >= lo && i < hi ? i : -1)).filter((i) => i >= 0);
    const t = dir > 0 ? heads.find((i) => i > bi) : [...heads].reverse().find((i) => i < bi);
    if (t != null) speak(t);
  };
  const target = () => document.querySelector('[data-js="entry"]') || document.getElementById("contenido");

  /* ---------- Elegir qué leer ---------- */
  // 1) Sección: desde un encabezado hasta el siguiente de su nivel o superior
  function readSection(headingEl, btn) {
    const rt = target(), bl = collect(rt), s = bl.findIndex((b) => b.el === headingEl);
    if (s < 0) return;
    let e = bl.findIndex((b, i) => i > s && b.heading && b.lvl <= bl[s].lvl); if (e < 0) e = bl.length;
    start(rt, btn, { blocks: bl, from: s, to: e, label: headingEl.textContent.trim() });
  }
  // 2) Modo «Elegir qué leer»: clic o ↑ ↓ + Intro sobre el párrafo deseado
  const setPicked = (i) => {
    pickBlocks[pi]?.el.classList.remove("is-picked"); pi = i;
    if (i >= 0) { const el = pickBlocks[i].el; el.classList.add("is-picked"); el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" }); }
  };
  function enterPick(btn) {
    if (picking) return exitPick("Modo elegir desactivado");
    pickRoot = target(); pickBlocks = collect(pickRoot); picking = true; pi = -1;
    pickRoot.classList.add("is-picking"); pickBtns.forEach((b) => b.setAttribute("aria-pressed", "true"));
    hint = document.createElement("p"); hint.className = "pick-hint"; hint.textContent = "Pulsa el párrafo desde el que quieres escuchar · ↑ ↓ e Intro · Esc para salir"; document.body.append(hint);
    announce("Modo elegir activado. Pulsa el párrafo desde el que quieres escuchar, o usa las flechas arriba y abajo e Intro. Esc para salir.");
  }
  function exitPick(msg) {
    if (!picking) return;
    picking = false; setPicked(-1); pickRoot?.classList.remove("is-picking"); pickBtns.forEach((b) => b.setAttribute("aria-pressed", "false")); hint?.remove(); hint = null;
    if (msg) announce(msg);
  }
  function pickStart(i) { const bl = pickBlocks, rt = pickRoot; exitPick(); start(rt, null, { blocks: bl, from: i }); }
  document.addEventListener("click", (e) => {
    if (!picking || e.target.closest("a, button, summary, input, select, label, .reader")) return;
    const i = pickBlocks.findIndex((b) => b.el.contains(e.target));
    if (i >= 0) { e.preventDefault(); e.stopPropagation(); pickStart(i); }
  }, true);
  // 3) Selección de texto
  const selBtn = document.createElement("button");
  selBtn.type = "button"; selBtn.className = "selection-listen"; selBtn.hidden = true; selBtn.innerHTML = `${icon("play")}<span>Escuchar selección</span>`;
  document.body.append(selBtn);
  let selTimer;
  const selText = () => { const s = getSelection(), m = document.getElementById("contenido"); return s && s.rangeCount && m && m.contains(s.anchorNode) && m.contains(s.focusNode) ? s.toString().trim() : ""; };
  function updateSel() {
    const txt = selText();
    if (txt.length < 8 || picking) { selBtn.hidden = true; return; }
    const r = getSelection().getRangeAt(0).getBoundingClientRect();
    if (!r.width && !r.height) { selBtn.hidden = true; return; }
    selBtn.hidden = false;
    selBtn.style.top = `${Math.max(8, Math.min(innerHeight - 64, r.bottom + 8))}px`;
    selBtn.style.left = `${Math.max(8, Math.min(innerWidth - selBtn.offsetWidth - 8, r.left))}px`;
  }
  const readSelection = () => { const txt = selText(); if (txt.length < 3) return; selBtn.hidden = true; start(target(), null, { blocks: textBlocks(txt), quiet: true, label: "texto seleccionado" }); };
  document.addEventListener("selectionchange", () => { clearTimeout(selTimer); selTimer = setTimeout(updateSel, 250); });
  addEventListener("scroll", () => { selBtn.hidden = true; }, { passive: true });
  selBtn.addEventListener("pointerdown", (e) => e.preventDefault());
  selBtn.addEventListener("click", readSelection);

  /* ---------- Controles ---------- */
  btnToggle.addEventListener("click", togglePause);
  btnPrev.addEventListener("click", () => speak(bi - 1));
  btnNext.addEventListener("click", () => speak(bi + 1));
  btnStop.addEventListener("click", () => stop(false));
  secPrev.addEventListener("click", () => jumpSection(-1));
  secNext.addEventListener("click", () => jumpSection(1));
  pickChip.addEventListener("click", () => enterPick());
  optsBtn.addEventListener("click", () => { const open = opts.hidden; opts.hidden = !open; optsBtn.setAttribute("aria-expanded", String(open)); });
  seek.addEventListener("input", () => { clearTimeout(seekTimer); seekTimer = setTimeout(() => { if (root) speak(Number(seek.value) - 1); }, 250); });
  rateSel.addEventListener("change", () => { store.set("cie.rate", rateSel.value); if (root && !paused) speak(bi); });
  voiceSel.addEventListener("change", () => { store.set("cie.voice", voiceSel.value); if (root && !paused) speak(bi); });

  panel.addEventListener("keydown", (e) => {
    if (e.target.matches("select, input[type=checkbox]")) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (e.target === seek) return;            // la barra usa sus propias flechas
      e.preventDefault(); const dir = e.key === "ArrowRight" ? 1 : -1;
      if (e.shiftKey) jumpSection(dir); else speak(bi + dir);
    } else if (e.key === " " && e.target === seek) { e.preventDefault(); togglePause(); }
  });
  document.addEventListener("keydown", (e) => {
    const drawerOpen = document.querySelector('[data-js="drawer"][data-open]');
    if (picking && !e.target.closest("input, select, textarea")) {
      if (e.key === "Escape") { e.preventDefault(); exitPick("Modo elegir desactivado"); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "j" || e.key === "k") {
        e.preventDefault(); const d = e.key === "ArrowDown" || e.key === "j" ? 1 : -1;
        setPicked(pi < 0 ? (d > 0 ? 0 : pickBlocks.length - 1) : Math.max(0, Math.min(pickBlocks.length - 1, pi + d))); return;
      }
      if (e.key === "Enter" && pi >= 0) { e.preventDefault(); pickStart(pi); return; }
    }
    if (e.key === "Escape" && root && !drawerOpen) { stop(false); return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "l") { e.preventDefault(); if (root) togglePause(); else start(target(), null); }   // Alt + L: página / pausa
      if (k === "s" && selText().length >= 3) { e.preventDefault(); readSelection(); }             // Alt + S: selección
    }
  });
  // «Leer desde aquí»: clic en un párrafo mientras se lee (si cae fuera del rango, se amplía hasta el final)
  document.addEventListener("click", (e) => {
    if (picking || !root || !root.contains(e.target) || e.target.closest("a, button, summary, input, select") || String(getSelection())) return;
    const i = blocks.findIndex((b) => b.el && b.el.contains(e.target));
    if (i < 0) return;
    if (i < lo || i >= hi) { lo = i; hi = blocks.length; }
    speak(i);
  });
  addEventListener("pagehide", () => synth.cancel());

  /* ---------- Botones de inicio ---------- */
  const mkBtn = (cls, html, onClick) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.innerHTML = html; b.addEventListener("click", () => onClick(b)); return b; };
  const listen = (label, getRoot) => mkBtn("btn btn--cta", `${icon("play")}<span>${label}</span>`, (b) => start(getRoot(), b));
  const pick = () => { const b = mkBtn("btn", "<span>Elegir qué leer</span>", () => enterPick()); b.setAttribute("aria-pressed", "false"); pickBtns.push(b); return b; };
  const tools = document.querySelector('[data-js="entry-tools"]');
  if (tools) tools.append(listen("Escuchar artículo", target), pick());
  else {
    const main = document.getElementById("contenido");
    if (main) { const bar = document.createElement("div"); bar.className = "listen-bar"; bar.setAttribute("data-reader-skip", ""); bar.style.gap = "0.5rem"; bar.style.flexWrap = "wrap"; bar.append(listen("Escuchar esta página", () => main), pick()); main.prepend(bar); }
  }
  // Un botón «Escuchar» por sección (se coloca junto al encabezado, sin alterar su texto)
  document.querySelectorAll(".entry__body h2, .presentation h2, .presentation h3").forEach((h) => {
    const wrap = document.createElement("div"); wrap.className = "section-head";
    const name = h.textContent.trim();
    const btn = mkBtn("section-listen", `${icon("play")}<span>Escuchar</span>`, (b) => readSection(h, b));
    btn.setAttribute("aria-label", `Escuchar la sección: ${name}`);
    h.replaceWith(wrap); wrap.append(h, btn);
  });
}
