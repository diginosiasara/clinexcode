/** Búsqueda de texto y filtro por hashtag sobre los artículos ya presentes en el DOM (sin duplicar datos). */
import { announce } from "./announcer.js";

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

export function initFilter() {
  const input = $('[data-js="search-input"]');
  const form = $('[data-js="search-form"]');
  const bar = $('[data-js="filter-bar"]'), barText = $('[data-js="filter-text"]'), clearBtn = $('[data-js="filter-clear"]');
  const empty = $('[data-js="empty"]'), intro = $('[data-js="intro"]');
  const entries = $$('[data-js="entry"]').map((el) => ({ el, text: norm(el.textContent), tags: el.dataset.tags.split(" ") }));
  const parts = $$('[data-js="part"]');
  const navLinks = $$('[data-js="site-nav"] a[href^="#articulo"]');
  const state = { q: "", tag: "" };

  // Los hashtags estáticos pasan a ser botones (mejora progresiva)
  const tagButtons = $$('[data-js="hashtag"]').map((span) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = span.className; b.textContent = span.textContent;
    b.dataset.tag = span.dataset.tag; b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", `Filtrar por la etiqueta ${span.textContent.slice(1)}`);
    span.replaceWith(b);
    b.addEventListener("click", () => { state.tag = state.tag === b.dataset.tag ? "" : b.dataset.tag; apply(true); });
    return b;
  });

  function apply(announceResult) {
    const q = norm(state.q.trim());
    let visible = 0;
    for (const e of entries) {
      const show = (!q || e.text.includes(q)) && (!state.tag || e.tags.includes(state.tag));
      e.el.hidden = !show; if (show) visible++;
    }
    parts.forEach((p) => { p.hidden = !p.querySelector('[data-js="entry"]:not([hidden])'); });
    navLinks.forEach((a) => {
      const hide = document.getElementById(a.hash.slice(1))?.hidden;
      a.parentElement.hidden = !!hide;
    });
    $$('[data-js="nav-part"]').forEach((li) => { li.hidden = !li.querySelector("li:not([hidden])"); });
    const active = !!(q || state.tag);
    if (intro) intro.hidden = active;
    bar.hidden = !active; empty.hidden = !(active && visible === 0);
    tagButtons.forEach((b) => b.setAttribute("aria-pressed", String(!!state.tag && b.dataset.tag === state.tag)));
    const crit = [q && `«${state.q.trim()}»`, state.tag && `#${state.tag}`].filter(Boolean).join(" y ");
    const msg = active ? `${visible} ${visible === 1 ? "artículo" : "artículos"} para ${crit}` : "Filtros quitados: se muestran los 35 artículos";
    barText.textContent = active ? msg : "";
    if (announceResult || active) announce(msg);
  }

  let timer;
  input?.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { state.q = input.value; apply(false); }, 200); });
  input?.addEventListener("keydown", (e) => { if (e.key === "Escape" && input.value) { input.value = ""; state.q = ""; apply(true); } });
  form?.addEventListener("submit", (e) => { e.preventDefault(); state.q = input.value; apply(true); $('#contenido')?.focus({ preventScroll: false }); });
  clearBtn?.addEventListener("click", () => { state.q = ""; state.tag = ""; if (input) input.value = ""; apply(true); input?.focus(); });

  // Si se enlaza a un artículo oculto por un filtro, se quitan los filtros
  addEventListener("hashchange", () => {
    const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t?.closest("[hidden]")) clearBtn.click();
  });
}
