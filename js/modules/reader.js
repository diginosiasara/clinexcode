/** Lector de voz (Web Speech API): lee un artículo en voz alta con pausa, parada, velocidad y resaltado. */
import { announce } from "./announcer.js";

export function initReader() {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return; // sin soporte: no se muestran controles
  const synth = speechSynthesis;
  const panel = document.querySelector('[data-js="reader"]');
  const status = document.querySelector('[data-js="reader-status"]');
  const pauseBtn = document.querySelector('[data-js="reader-pause"]');
  const stopBtn = document.querySelector('[data-js="reader-stop"]');
  const rateSel = document.querySelector('[data-js="reader-rate"]');
  let queue = [], index = 0, article = null, current = null, opener = null;

  const pickVoice = () => synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("es")) || null;

  function collect(art) {
    const items = [];
    art.querySelectorAll("h3, h4, p, li, dt, dd, tr").forEach((el) => {
      if (el.closest("[data-reader-skip]") || el.closest(".sr-only")) return;
      if (el.matches("li, p") && el.closest("td, th")) return;
      const text = el.matches("tr") ? [...el.cells].map((c) => c.textContent.trim()).join(". ") : el.textContent.replace(/\s+/g, " ").trim();
      if (text) items.push({ el, text });
    });
    return items;
  }
  function mark(el) { current?.classList.remove("is-reading-now"); current = el; el?.classList.add("is-reading-now"); }
  function setStatus(t) { status.textContent = t; }

  function speakNext() {
    if (index >= queue.length) return finish("Lectura terminada");
    const { el, text } = queue[index];
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES"; u.voice = pickVoice(); u.rate = Number(rateSel.value);
    u.onstart = () => { mark(el); };
    u.onend = () => { index++; speakNext(); };
    u.onerror = (e) => { if (e.error !== "canceled" && e.error !== "interrupted") finish("Error del lector de voz"); };
    synth.speak(u);
  }
  function start(art, btn) {
    stop(true);
    article = art; opener = btn; queue = collect(art); index = 0;
    art.classList.add("is-reading"); panel.hidden = false;
    pauseBtn.textContent = "Pausar"; setStatus(`Leyendo: ${art.querySelector("h3").textContent}`);
    announce("Lectura iniciada"); speakNext();
  }
  function stop(silent) {
    synth.cancel(); mark(null); article?.classList.remove("is-reading"); article = null;
    if (!silent) finish("Lectura detenida");
  }
  function finish(msg) {
    mark(null); article?.classList.remove("is-reading"); article = null; panel.hidden = true; announce(msg); opener?.focus(); opener = null;
  }

  pauseBtn.addEventListener("click", () => {
    if (synth.paused) { synth.resume(); pauseBtn.textContent = "Pausar"; announce("Lectura reanudada"); }
    else { synth.pause(); pauseBtn.textContent = "Reanudar"; announce("Lectura en pausa"); }
  });
  stopBtn.addEventListener("click", () => stop(false));
  rateSel.addEventListener("change", () => { if (article) { synth.cancel(); speakNext(); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && article) stop(false); });
  addEventListener("beforeunload", () => synth.cancel());

  document.querySelectorAll('[data-js="entry-tools"]').forEach((box) => {
    const art = box.closest('[data-js="entry"]');
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn btn--cta"; btn.textContent = "🔊 Escuchar artículo";
    btn.setAttribute("aria-label", `Escuchar en voz alta: ${art.querySelector("h3").textContent}`);
    btn.addEventListener("click", () => start(art, btn));
    box.append(btn);
  });
}
