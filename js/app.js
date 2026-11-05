/* ARCHIVO GENERADO por tools/bundle.py a partir de js/modules/*.js. No editar a mano. */
(() => {
"use strict";
const __M = {};
/* ---- search-core ---- */
__M["search-core"] = (() => {
/** Motor de búsqueda: indexa secciones, códigos CIE, etiquetas y títulos; puntúa por campo, tolera prefijos y erratas. */
const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const STOP = new Set("de la el en y a los las del un una por con para se que o al lo es su sus como mas no si ni pero entre sobre este esta estos estas ese esa u e".split(" "));
const rawTokens = (s) => norm(s).match(/[a-z0-9]+(?:[.\-][a-z0-9]+)*/g) || [];
const stem = (t) => (/^[a-z]+$/.test(t) ? (t.length > 4 && t.endsWith("es") ? t.slice(0, -2) : t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t) : t);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let min = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur[j] = v; if (v < min) min = v;
    }
    if (min > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/* ---------- Índice ---------- */
let loading;
function loadIndex(root = "") {
  loading ??= new Promise((resolve, reject) => {
    if (window.CIE_INDEX) return resolve(window.CIE_INDEX);
    const el = document.createElement("script");
    el.src = root + "data/search-index.js";
    el.onload = () => (window.CIE_INDEX ? resolve(window.CIE_INDEX) : reject(new Error("índice vacío")));
    el.onerror = () => reject(new Error("no se pudo cargar el índice"));
    document.head.append(el);
  }).then(build);
  loading.catch(() => { loading = undefined; });   // permite reintentar
  return loading;
}
function build({ docs, secs }) {
  const docP = new Map(), secP = new Map(), surf = new Map();
  const add = (m, t, k, w) => { let x = m.get(t); if (!x) m.set(t, (x = new Map())); x.set(k, (x.get(k) || 0) + w); };
  const toks = (s) => rawTokens(s).map((r) => { const t = stem(r); if (!surf.has(t)) surf.set(t, r); return t; });
  docs.forEach((d, i) => {
    d.nt = norm(d.t); d.nc = norm(d.c); d.ng = d.g.map(norm); d.secs = [];
    toks(d.t).forEach((t) => add(docP, t, i, 8));                                   // título
    d.k.forEach((k) => toks(k).forEach((t) => add(docP, t, i, 7)));                 // códigos CIE
    d.g.forEach((g) => toks(g).forEach((t) => add(docP, t, i, 6)));                 // etiquetas
    toks(d.c + " " + d.id).forEach((t) => add(docP, t, i, 2));                      // categoría y número
  });
  secs.forEach((s, i) => {
    s.n = norm(s.x); docs[s.d].secs.push(i);
    toks(s.h).forEach((t) => add(secP, t, i, 4));                                   // encabezado de sección
    toks(s.x).forEach((t) => add(secP, t, i, 1));                                   // cuerpo
  });
  const vocab = new Set([...docP.keys(), ...secP.keys()]), df = new Map();
  vocab.forEach((t) => { const set = new Set(docP.get(t)?.keys() || []); secP.get(t)?.forEach((_, s) => set.add(secs[s].d)); df.set(t, set.size); });
  return { docs, secs, docP, secP, df, surf, vocab: [...vocab] };
}

/* ---------- Consulta ---------- */
function parseQuery(q) {
  const p = { raw: [], terms: [], phrases: [], excl: [], exclPhrases: [], tag: "", parte: "", cat: "" };
  const re = /(-?)"([^"]+)"|(\S+)/g; let m;
  while ((m = re.exec(q))) {
    if (m[2]) { (m[1] ? p.exclPhrases : p.phrases).push(norm(m[2]).trim()); continue; }
    const w = m[3], kv = w.match(/^(tag|parte|cat):(.+)$/i);
    if (kv) { p[kv[1].toLowerCase()] = norm(kv[2]).replace(/^#/, ""); continue; }
    if (w.startsWith("-") && w.length > 1) { p.excl.push(...rawTokens(w.slice(1)).map(stem)); continue; }
    p.raw.push(...rawTokens(w));
  }
  const content = p.raw.filter((r) => !STOP.has(r));
  p.terms = [...new Set((content.length ? content : p.raw).map(stem))];
  return p;
}
function matches(ix, term) {
  const m = new Map();
  if (ix.docP.has(term) || ix.secP.has(term)) m.set(term, 1);
  if (term.length >= 2) { let n = 0; for (const v of ix.vocab) if (v !== term && v.startsWith(term)) { m.set(v, 0.7); if (++n >= 60) break; } }
  if (!m.size && term.length >= 5) { const max = term.length >= 8 ? 2 : 1; for (const v of ix.vocab) if (lev(term, v, max) <= max) m.set(v, 0.5); }
  return m;
}

function search(ix, p) {
  const { docs, secs } = ix, N = docs.length;
  const info = p.terms.map((t) => ({ t, m: matches(ix, t) }));
  const unmatched = info.filter((i) => !i.m.size).map((i) => i.t);
  const excluded = new Set();
  p.excl.forEach((t) => { ix.docP.get(t)?.forEach((_, d) => excluded.add(d)); ix.secP.get(t)?.forEach((_, s) => excluded.add(secs[s].d)); });
  p.exclPhrases.forEach((ph) => secs.forEach((s) => { if (s.n.includes(ph)) excluded.add(s.d); }));

  const run = (mode) => {
    const ds = new Map(), ss = new Map(), hit = new Map();
    const mark = (d, ti) => { let h = hit.get(d); if (!h) hit.set(d, (h = new Set())); h.add(ti); };
    info.forEach((it, ti) => it.m.forEach((f, tok) => {
      const idf = Math.log(1 + N / (ix.df.get(tok) || 1));
      ix.docP.get(tok)?.forEach((w, d) => { ds.set(d, (ds.get(d) || 0) + f * idf * (1 + Math.log(w))); mark(d, ti); });
      ix.secP.get(tok)?.forEach((w, s) => { ss.set(s, (ss.get(s) || 0) + f * idf * (1 + Math.log(w))); mark(secs[s].d, ti); });
    }));
    const out = [];
    docs.forEach((d, di) => {
      if (excluded.has(di)) return;
      if (p.terms.length) { const h = hit.get(di); if (!h || (mode === "and" && h.size < p.terms.length)) return; }
      if (p.tag && !d.ng.includes(p.tag)) return;
      let bonus = 0;
      for (const ph of p.phrases) { if (d.nt.includes(ph) || d.secs.some((s) => secs[s].n.includes(ph))) bonus += 6; else return; }
      const ranked = d.secs.map((s) => [s, ss.get(s) || 0]).sort((a, b) => b[1] - a[1]);
      const rest = ranked.slice(1).reduce((a, r) => a + r[1], 0);
      out.push({ d: di, score: (ds.get(di) || 0) + (ranked[0]?.[1] || 0) + Math.min(3, rest * 0.25) + bonus,
                 secs: p.terms.length ? ranked.filter((r) => r[1] > 0).slice(0, 3) : ranked.slice(0, 1) });
    });
    return out.sort((a, b) => b.score - a.score || a.d - b.d);
  };
  let base = run("and"), partial = false;
  if (!base.length && p.terms.length > 1) { base = run("or"); partial = base.length > 0; }
  const results = base.filter((r) => (!p.parte || String(docs[r.d].p) === p.parte) && (!p.cat || docs[r.d].nc.includes(p.cat)));
  return { results, base, partial, unmatched };
}

function didYouMean(ix, p, unmatched) {
  if (!unmatched.length) return "";
  let changed = false;
  const words = p.raw.map((r) => {
    const st = stem(r); if (!unmatched.includes(st) || st.length < 4) return r;
    let best = null, bd = 3, bf = -1;
    for (const v of ix.vocab) { const d = lev(st, v, 2); const f = ix.df.get(v); if (d < bd || (d === bd && f > bf)) { best = v; bd = d; bf = f; } }
    if (best && bd <= 2) { changed = true; return ix.surf.get(best) || best; }
    return r;
  });
  return changed ? words.join(" ") : "";
}

/** Fragmento con las coincidencias resaltadas: { pre, text, ranges, post } */
function snippet(ix, secIdx, p, len = 240) {
  const s = ix.secs[secIdx], pats = [...p.terms.map(esc), ...p.phrases.map((x) => esc(x).replace(/\s+/g, "\\s+"))];
  const re = pats.length ? new RegExp("\\b(?:" + pats.join("|") + ")[a-z0-9]*", "g") : null;
  const first = re ? s.n.search(re) : -1;
  let start = first > 80 ? first - 80 : 0;
  if (start > 0) { const sp = s.x.indexOf(" ", start); if (sp > 0 && sp < first) start = sp + 1; }
  let end = Math.min(s.x.length, start + len); if (end < s.x.length) { const sp = s.x.lastIndexOf(" ", end); if (sp > start) end = sp; }
  const ranges = []; const win = s.n.slice(start, end);
  if (re) { let m; re.lastIndex = 0; while ((m = re.exec(win))) { ranges.push([m.index, m.index + m[0].length]); if (!m[0].length) re.lastIndex++; } }
  return { pre: start > 0, text: s.x.slice(start, end), ranges, post: end < s.x.length };
}

/* ---------- Sugerencias ---------- */
function suggest(ix, q, limit = 8) {
  const n = norm(q.trim()).replace(/^#/, ""); if (!n) return [];
  const out = [], room = () => out.length < limit - 1, { docs, secs } = ix;
  docs.map((d) => ({ d, r: d.nt.startsWith(n) ? 0 : d.nt.split(/\s+/).some((w) => w.startsWith(n)) ? 1 : d.nt.includes(n) ? 2 : 9 }))
    .filter((x) => x.r < 9).sort((a, b) => a.r - b.r).slice(0, 4).forEach((x) => room() && out.push({ type: "Artículo", label: `${x.d.id} ${x.d.t}`, url: x.d.u }));
  if (/^[a-z]\d/.test(n)) {
    const seen = new Set();
    docs.forEach((d) => d.k.forEach((k) => { if (norm(k).startsWith(n) && !seen.has(k) && seen.size < 4) { seen.add(k); room() && out.push({ type: "Código", label: k, url: "buscar.html?q=" + encodeURIComponent(k) }); } }));
  }
  const tags = new Map(); docs.forEach((d) => d.g.forEach((g) => tags.set(norm(g), g)));
  [...tags].filter(([k]) => k.startsWith(n)).slice(0, 3).forEach(([k, g]) => room() && out.push({ type: "Etiqueta", label: "#" + g, url: "buscar.html?tag=" + encodeURIComponent(k) }));
  secs.filter((s) => s.h && norm(s.h).includes(n)).slice(0, 3).forEach((s) => room() && out.push({ type: "Sección", label: `${s.h} · ${docs[s.d].t}`, url: docs[s.d].u + "#" + s.a }));
  out.push({ type: "Buscar", label: `Buscar «${q.trim()}»`, url: "buscar.html?q=" + encodeURIComponent(q.trim()) });
  return out;
}

/* ---------- Búsquedas recientes ---------- */
function getRecent() { try { return JSON.parse(localStorage.getItem("cie.recent")) || []; } catch { return []; } }
function addRecent(q) {
  try { localStorage.setItem("cie.recent", JSON.stringify([q, ...getRecent().filter((x) => x !== q)].slice(0, 6))); } catch { /* ignorar */ }
}
return { norm, stem, loadIndex, parseQuery, search, didYouMean, snippet, suggest, getRecent, addRecent };
})();
/* ---- announcer ---- */
__M["announcer"] = (() => {
/** Región aria-live para avisar de cambios dinámicos a lectores de pantalla. */
let region, timer;
function initAnnouncer() { region = document.querySelector('[data-js="announcer"]'); }
function announce(message) {
  if (!region) return;
  clearTimeout(timer);
  region.textContent = "";
  timer = setTimeout(() => { region.textContent = message; }, 60); // el vaciado previo fuerza la relectura
}
return { initAnnouncer, announce };
})();
/* ---- suggest ---- */
__M["suggest"] = (() => {
/** Sugerencias del buscador (patrón combobox ARIA): artículos, códigos, etiquetas y secciones; recientes al enfocar. */
const {loadIndex, suggest, getRecent} = __M["search-core"];
const {announce} = __M["announcer"];

function initSuggest() {
  const input = document.querySelector('[data-js="search-input"]');
  const form = input?.closest("form");
  if (!input || !form) return;
  const root = document.body.dataset.root || "";
  const list = document.createElement("ul");
  list.id = "sugerencias"; list.className = "suggest"; list.setAttribute("role", "listbox"); list.setAttribute("aria-label", "Sugerencias de búsqueda"); list.hidden = true;
  form.append(list);
  input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-controls", list.id);
  let items = [], active = -1, ix = null, timer, noteTimer;

  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
  const setActive = (i) => {
    active = (i + items.length) % items.length;
    [...list.children].forEach((li, k) => li.setAttribute("aria-selected", String(k === active)));
    input.setAttribute("aria-activedescendant", `sg-${active}`);
    list.children[active].scrollIntoView({ block: "nearest" });
  };
  function show(arr, note) {
    items = arr; list.replaceChildren();
    arr.forEach((it, i) => {
      const li = document.createElement("li"); li.id = `sg-${i}`; li.setAttribute("role", "option"); li.setAttribute("aria-selected", "false");
      const t = document.createElement("span"); t.className = "suggest__type"; t.textContent = it.type;
      const l = document.createElement("span"); l.className = "suggest__label"; l.textContent = it.label;
      li.append(t, l); li.addEventListener("click", () => go(it)); list.append(li);
    });
    list.hidden = !arr.length; input.setAttribute("aria-expanded", String(!!arr.length)); active = -1; input.removeAttribute("aria-activedescendant");
    clearTimeout(noteTimer);
    if (arr.length) noteTimer = setTimeout(() => announce(`${arr.length} ${arr.length === 1 ? "sugerencia" : "sugerencias"}${note || ". Usa las flechas arriba y abajo"}`), 500);
  }
  const go = (it) => { location.href = (it.abs ? "" : root) + it.url; };

  async function update() {
    const q = input.value;
    if (!q.trim()) {
      show(getRecent().slice(0, 5).map((r) => ({ type: "Reciente", label: r, url: "buscar.html?q=" + encodeURIComponent(r) })), " recientes");
      return;
    }
    try { ix ||= await loadIndex(root); } catch { return; }
    if (input.value === q) show(suggest(ix, q));
  }
  input.addEventListener("focus", () => { loadIndex(root).then((x) => { ix = x; }).catch(() => {}); update(); });
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 120); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (list.hidden) { update(); return; }
      e.preventDefault(); setActive(active + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter" && active >= 0) { e.preventDefault(); go(items[active]); }
    else if (e.key === "Escape") { if (!list.hidden) { e.preventDefault(); e.stopPropagation(); close(); } else if (input.value) input.value = ""; }
    else if (e.key === "Tab") close();
  });
  list.addEventListener("pointerdown", (e) => e.preventDefault());   // evita perder el foco al pulsar una opción
  input.addEventListener("blur", () => setTimeout(close, 120));
  document.addEventListener("click", (e) => { if (!form.contains(e.target)) close(); });

  // Atajo «/» para ir al buscador (abre el panel en móvil)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, textarea, select, [contenteditable]")) return;
    e.preventDefault();
    if (!input.offsetParent) document.querySelector('[data-js="search-toggle"]')?.click();
    input.focus(); input.select();
  });
}
return { initSuggest };
})();
/* ---- nav ---- */
__M["nav"] = (() => {
/** Cajón del índice: aparece y desaparece, con foco atrapado, Esc, clic fuera y bloqueo de scroll. */
const $ = (s, c = document) => c.querySelector(s);

function initNav() {
  const drawer = $('[data-js="drawer"]'), toggle = $('[data-js="nav-toggle"]');
  const closeBtn = $('[data-js="nav-close"]'), backdrop = $('[data-js="nav-backdrop"]');
  if (!drawer || !toggle || !closeBtn) return;
  const root = document.documentElement;
  [toggle, closeBtn, backdrop].forEach((el) => { if (el) el.hidden = false; });
  drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-modal", "true"); drawer.setAttribute("aria-labelledby", "drawer-title");
  drawer.inert = true;
  let lastFocus = null;
  const isOpen = () => drawer.hasAttribute("data-open");

  function open() {
    if (isOpen()) return;
    lastFocus = document.activeElement;
    drawer.inert = false; drawer.setAttribute("data-open", ""); toggle.setAttribute("aria-expanded", "true"); root.classList.add("is-locked");
    const current = $('[aria-current="page"]', drawer);
    (current || closeBtn).focus({ preventScroll: true });
    current?.scrollIntoView({ block: "center" });
  }
  function close(returnFocus = true) {
    if (!isOpen()) return;
    drawer.removeAttribute("data-open"); drawer.inert = true; toggle.setAttribute("aria-expanded", "false"); root.classList.remove("is-locked");
    if (returnFocus) (lastFocus && document.contains(lastFocus) ? lastFocus : toggle).focus();
  }

  toggle.addEventListener("click", () => (isOpen() ? close() : open()));
  closeBtn.addEventListener("click", () => close());
  backdrop?.addEventListener("click", () => close());
  drawer.addEventListener("click", (e) => { const a = e.target.closest("a"); if (a) close(false); });
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const f = [...drawer.querySelectorAll("a[href], button:not([hidden]), summary")].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $('[data-js="skip-index"]')?.addEventListener("click", (e) => { e.preventDefault(); open(); });
  addEventListener("pageshow", (e) => { if (e.persisted) close(false); });

  // Foco accesible al saltar a un ancla de la misma página (p. ej. #mapa)
  const focusTarget = () => {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!el) return;
    const h = el.matches("h1,h2,h3,h4") ? el : el.querySelector("h1,h2,h3") || el;
    h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true });
  };
  addEventListener("hashchange", focusTarget);
}
return { initNav };
})();
/* ---- motion ---- */
__M["motion"] = (() => {
/** Movimiento sutil: barra de progreso de lectura, aparición al hacer scroll y contadores. Respeta prefers-reduced-motion. */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function initMotion() {
  const bar = document.querySelector('[data-js="progress"]');
  if (bar && document.body.dataset.page === "article") {
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`; ticking = false;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
  if (reduce || !("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll(".callout, .table-wrap, .glossary, .map__part, .entry__summary, .stat").forEach((el) => { el.classList.add("reveal"); io.observe(el); });

  const counters = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    counters.unobserve(e.target);
    const end = Number(e.target.dataset.count), t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      e.target.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  document.querySelectorAll("[data-count]").forEach((el) => counters.observe(el));
}
return { initMotion };
})();
/* ---- search ---- */
__M["search"] = (() => {
/** Página de resultados: consulta el índice (?q= ?tag= ?parte= ?cat=), muestra facetas, secciones coincidentes y fragmentos resaltados. */
const {loadIndex, parseQuery, search, snippet, didYouMean, getRecent, addRecent, norm} = __M["search-core"];

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const url = (o) => { const u = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => v && u.set(k, v)); const s = u.toString(); return "buscar.html" + (s ? "?" + s : ""); };

async function initSearch() {
  const host = document.querySelector('[data-js="results"]');
  if (!host) return;
  const $ = (s) => host.querySelector(`[data-js="${s}"]`);
  const status = $("results-status"), filters = $("results-filters"), facets = $("results-facets"), hint = $("results-hint"), list = $("results-list");
  const browser = $("tag-browser"), tagList = $("tag-list"), recent = $("recent"), recentList = $("recent-list");
  const root = document.body.dataset.root || "";
  const params = new URLSearchParams(location.search);
  const cur = { q: (params.get("q") || "").trim(), tag: (params.get("tag") || "").trim().toLowerCase(), parte: (params.get("parte") || "").trim(), cat: (params.get("cat") || "").trim() };
  const input = document.querySelector('[data-js="search-input"]');
  if (input && cur.q) input.value = cur.q;

  let ix;
  try { ix = await loadIndex(root); }
  catch { status.textContent = "No se pudo cargar el índice de búsqueda (data/search-index.js). Comprueba que la carpeta data/ está junto a index.html."; return; }

  // Filtros activos, cada uno con enlace para quitarlo
  const chip = (label, drop) => { const a = el("a", "", label + " ✕"); a.href = url({ ...cur, [drop]: "" }); a.setAttribute("aria-label", "Quitar filtro " + label); filters.append(a); };
  if (cur.q) chip(`«${cur.q}»`, "q");
  if (cur.tag) chip(`#${cur.tag}`, "tag");
  if (cur.parte) chip(`Parte ${cur.parte}`, "parte");
  if (cur.cat) chip(cur.cat, "cat");

  const p = parseQuery(cur.q);
  p.tag = cur.tag || p.tag; p.parte = cur.parte || p.parte; p.cat = norm(cur.cat) || p.cat;

  // Pantalla inicial: etiquetas y búsquedas recientes
  if (!p.terms.length && !p.phrases.length && !p.tag && !p.parte && !p.cat) {
    const counts = new Map();
    ix.docs.forEach((d) => d.g.forEach((t) => { const k = t.toLowerCase(), c = counts.get(k) || { label: t, n: 0 }; c.n++; counts.set(k, c); }));
    [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).forEach(([k, c]) => {
      const li = el("li"), a = el("a", "hashtag", "#" + c.label); a.href = url({ tag: k }); a.append(el("small", "", String(c.n))); li.append(a); tagList.append(li);
    });
    browser.hidden = false;
    const rec = getRecent();
    if (rec.length) { rec.forEach((r) => { const li = el("li"), a = el("a", "hashtag", r); a.href = url({ q: r }); li.append(a); recentList.append(li); }); recent.hidden = false; }
    status.textContent = "Escribe un término en el buscador o elige una etiqueta.";
    return;
  }

  const { results, base, partial, unmatched } = search(ix, p);
  document.title = `Buscar: ${[cur.q, cur.tag && "#" + cur.tag].filter(Boolean).join(" ")} · ClinexCode`;

  // Facetas (contadores calculados antes de aplicar parte y categoría)
  const facet = (label, key, values, activeKey) => {
    if (values.size < 2 && !cur[key]) return;
    const wrap = el("div", "facet"); wrap.append(el("span", "facet__label mono-label", label));
    [...values.entries()].sort((a, b) => b[1].n - a[1].n || String(a[0]).localeCompare(String(b[0]))).forEach(([k, v]) => {
      const active = String(cur[key]).toLowerCase() === String(k).toLowerCase(), a = el("a", "facet__link", `${v.label} (${v.n})`);
      a.href = url({ ...cur, [key]: active ? "" : String(k) }); if (active) a.setAttribute("aria-current", "true"); wrap.append(a);
    });
    facets.append(wrap);
  };
  const byPart = new Map(), byCat = new Map();
  base.forEach(({ d }) => {
    const dd = ix.docs[d], a = byPart.get(dd.p) || { label: `Parte ${dd.p}`, n: 0 }; a.n++; byPart.set(dd.p, a);
    const c = byCat.get(dd.c) || { label: dd.c, n: 0 }; c.n++; byCat.set(dd.c, c);
  });
  if (base.length) { facet("Parte", "parte", byPart); facet("Categoría", "cat", byCat); }

  // Resultados
  results.forEach(({ secs }, i) => {
    const d = ix.docs[results[i].d], li = el("li", "card"), top = el("p", "card__top");
    top.append(el("span", "entry__num", d.id), el("span", "pill", d.c));
    const h = el("h2", "card__title"), a = el("a", "card__link", d.t); a.href = root + d.u; h.append(a);
    const sn = snippet(ix, (secs[0] || [d.secs[0]])[0], p), tx = el("p", "card__text");
    if (sn.pre) tx.append("… ");
    let pos = 0; sn.ranges.forEach(([s, e]) => { tx.append(sn.text.slice(pos, s), el("mark", "", sn.text.slice(s, e))); pos = e; });
    tx.append(sn.text.slice(pos) + (sn.post ? "…" : ""));
    li.append(top, h, tx);
    const withH = secs.map(([s]) => ix.secs[s]).filter((s) => s.h);
    if (withH.length) {
      const ul = el("ul", "card__sections"); ul.setAttribute("aria-label", "Secciones con coincidencias");
      withH.forEach((s) => { const l = el("li"), sa = el("a", "", s.h); sa.href = `${root}${d.u}#${s.a}`; l.append(sa); ul.append(l); });
      li.append(ul);
    }
    list.append(li);
  });

  const n = results.length;
  status.textContent = n ? `${n} ${n === 1 ? "resultado" : "resultados"}` : "Sin resultados. Prueba con otro término o quita los filtros.";
  if (partial && n) { hint.textContent = "Ningún artículo contiene todos los términos: se muestran los que coinciden con alguno."; hint.hidden = false; }
  const dym = didYouMean(ix, p, unmatched);
  if (dym && (!n || partial)) {
    hint.hidden = false; hint.textContent = (hint.textContent ? hint.textContent + " " : "") + "¿Quisiste decir ";
    const a = el("a", "", dym); a.href = url({ ...cur, q: dym }); hint.append(a, "?");
  }
  if (n && cur.q) addRecent(cur.q);
}
return { initSearch };
})();
/* ---- storage ---- */
__M["storage"] = (() => {
/** Acceso seguro a localStorage (puede estar bloqueado). */
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignorar */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignorar */ } },
};
return { store };
})();
/* ---- reader ---- */
__M["reader"] = (() => {
/** Lector de voz (Web Speech API): reproductor accesible para cualquier página.
 *  Lee códigos CIE, siglas y tablas de forma comprensible; barra de posición, saltos por bloque y sección, atajos. */
const {announce} = __M["announcer"];
const {store} = __M["storage"];

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
function speakable(t) {
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

function initReader() {
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
return { speakable, initReader };
})();
/* ---- toc ---- */
__M["toc"] = (() => {
/** Índice plegable «En este artículo»: recuerda si está abierto y marca la sección visible. */
const {store} = __M["storage"];

function initToc() {
  const toc = document.querySelector('[data-js="toc"]');
  if (!toc) return;
  const saved = store.get("cie.toc");
  toc.open = saved ? saved === "1" : matchMedia("(min-width: 64rem)").matches;
  toc.querySelector("summary").addEventListener("click", () => setTimeout(() => store.set("cie.toc", toc.open ? "1" : "0"), 0));

  const links = new Map([...toc.querySelectorAll("a[href^='#']")].map((a) => [a.getAttribute("href").slice(1), a]));
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => a.removeAttribute("aria-current"));
    links.get(e.target.id)?.setAttribute("aria-current", "location");
  }), { rootMargin: "-15% 0px -75% 0px" });
  links.forEach((_, id) => { const h = document.getElementById(id); if (h) io.observe(h); });
}
return { initToc };
})();
/* ---- header ---- */
__M["header"] = (() => {
/** Cabecera: paneles de búsqueda y ajustes en móvil (patrón de divulgación) y ocultación al bajar el scroll. */
const $ = (s) => document.querySelector(s);

function initHeader() {
  const header = $('[data-js="site-header"]');
  const sBtn = $('[data-js="search-toggle"]'), sPanel = $('[data-js="search-panel"]');
  const pBtn = $('[data-js="prefs-toggle"]'), pPanel = $('[data-js="toolbar"]');
  if (!header || !sBtn || !pBtn) return;
  const mobile = matchMedia("(max-width: 47.99rem)");
  sBtn.hidden = false; pBtn.hidden = false;
  const pairs = [[sBtn, sPanel], [pBtn, pPanel]];

  function set(btn, panel, open, focus = true) {
    panel.toggleAttribute("data-open", open); btn.setAttribute("aria-expanded", String(open));
    if (open && focus) (panel.querySelector("input, button:not([hidden])") || panel).focus();
    if (open) header.classList.remove("is-hidden");
  }
  function closeAll(except) { pairs.forEach(([b, p]) => { if (b !== except && p.hasAttribute("data-open")) set(b, p, false, false); }); }

  pairs.forEach(([btn, panel]) => {
    btn.addEventListener("click", () => { const open = !panel.hasAttribute("data-open"); closeAll(btn); set(btn, panel, open); });
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape" && mobile.matches && panel.hasAttribute("data-open")) { set(btn, panel, false, false); btn.focus(); } });
  });
  document.addEventListener("pointerdown", (e) => { if (mobile.matches && !header.contains(e.target)) closeAll(); });
  mobile.addEventListener("change", () => closeAll());

  // Ocultar al bajar, mostrar al subir (solo móvil); nunca con foco o paneles abiertos
  let lastY = scrollY, ticking = false;
  const locked = () => header.contains(document.activeElement) && document.activeElement !== document.body
    || header.querySelector('[aria-expanded="true"]') || document.documentElement.classList.contains("is-locked");
  addEventListener("scroll", () => {
    if (!mobile.matches || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY, dy = y - lastY;
      if (y < 80 || dy < -6 || locked()) header.classList.remove("is-hidden");
      else if (dy > 6) header.classList.add("is-hidden");
      lastY = y; ticking = false;
    });
  }, { passive: true });
  header.addEventListener("focusin", () => header.classList.remove("is-hidden"));
}
return { initHeader };
})();
/* ---- prefs ---- */
__M["prefs"] = (() => {
/** Preferencias de lectura: tema (auto/claro/oscuro) y tamaño de texto. */
const {store} = __M["storage"];
const {announce} = __M["announcer"];

const THEMES = ["auto", "light", "dark"];
const THEME_LABEL = { auto: "automático", light: "claro", dark: "oscuro" };
const THEME_ICON = { auto: "◐", light: "☀", dark: "☾" };
const root = document.documentElement;

function initPrefs() {
  const toolbar = document.querySelector('[data-js="toolbar"]');
  const themeBtn = document.querySelector('[data-js="theme-toggle"]');
  const icon = document.querySelector('[data-js="theme-icon"]');
  const down = document.querySelector('[data-js="font-down"]');
  const up = document.querySelector('[data-js="font-up"]');
  if (!toolbar || !themeBtn || !down || !up) return;
  [themeBtn, down, up].forEach((b) => { b.hidden = false; });

  const currentTheme = () => root.getAttribute("data-theme") || "auto";
  const currentFs = () => Number(root.getAttribute("data-fs") ?? 1);

  function renderTheme() {
    const t = currentTheme();
    icon.textContent = THEME_ICON[t];
    themeBtn.setAttribute("aria-label", `Tema de color: ${THEME_LABEL[t]}. Pulsa para cambiar`);
  }
  themeBtn.addEventListener("click", () => {
    const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
    if (next === "auto") { root.removeAttribute("data-theme"); store.remove("cie.theme"); }
    else { root.setAttribute("data-theme", next); store.set("cie.theme", next); }
    renderTheme(); announce(`Tema ${THEME_LABEL[next]}`);
  });

  function setFs(n) {
    const v = Math.min(3, Math.max(0, n));
    root.setAttribute("data-fs", String(v)); store.set("cie.fs", String(v));
    down.disabled = v === 0; up.disabled = v === 3;
    announce(`Tamaño de texto ${["pequeño", "normal", "grande", "muy grande"][v]}`);
  }
  down.addEventListener("click", () => setFs(currentFs() - 1));
  up.addEventListener("click", () => setFs(currentFs() + 1));
  down.disabled = currentFs() === 0; up.disabled = currentFs() === 3;
  renderTheme();
}
return { initPrefs };
})();
/* ---- accordion ---- */
__M["accordion"] = (() => {
/** Botón «Plegar todo / Desplegar todo» para las partes del índice. */
const {announce} = __M["announcer"];

function initAccordion() {
  const nav = document.querySelector('[data-js="site-nav"]');
  if (!nav) return;
  const details = [...nav.querySelectorAll("details")];
  if (details.length < 2) return;
  const bar = document.createElement("div"); bar.className = "site-nav__tools";
  const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn";
  const sync = () => { btn.textContent = details.every((d) => d.open) ? "Plegar todo" : "Desplegar todo"; };
  btn.addEventListener("click", () => {
    const open = !details.every((d) => d.open);
    details.forEach((d) => { d.open = open; }); sync();
    announce(open ? "Todas las partes desplegadas" : "Todas las partes plegadas");
  });
  details.forEach((d) => d.addEventListener("toggle", sync));
  sync(); bar.append(btn); nav.prepend(bar);
}
return { initAccordion };
})();
/* ---- history ---- */
__M["history"] = (() => {
/** Historial de lectura local: marca artículos leídos en el índice y ofrece «Continuar leyendo» en el inicio. */
const {store} = __M["storage"];

const read = (key, fallback) => { try { return JSON.parse(store.get(key)) ?? fallback; } catch { return fallback; } };

function initHistory() {
  const path = location.pathname, seen = new Set(read("cie.seen", []));
  if (document.body.dataset.page === "article") {
    const t = document.querySelector('[data-js="entry-title"]');
    if (t) {
      seen.add(path); store.set("cie.seen", JSON.stringify([...seen]));
      store.set("cie.last", JSON.stringify({ path, title: t.textContent, num: t.dataset.num }));
    }
  }
  document.querySelectorAll('[data-js="site-nav"] a[href]').forEach((a) => {
    if (a.hasAttribute("aria-current") || !seen.has(new URL(a.href).pathname)) return;
    a.classList.add("is-seen");
    const s = document.createElement("span"); s.className = "sr-only"; s.textContent = " (leído)"; a.append(s);
  });
  const box = document.querySelector('[data-js="resume"]');
  const last = read("cie.last", null);
  if (box && last && last.path !== path) {
    const link = box.querySelector('[data-js="resume-link"]');
    link.href = last.path; link.textContent = `${last.num} ${last.title}`;
    box.querySelector('[data-js="resume-count"]').textContent = `${seen.size} de ${box.dataset.total} artículos leídos`;
    box.hidden = false;
  }
}
return { initHistory };
})();
/* ---- main ---- */
__M["main"] = (() => {
/** Punto de entrada: inicializa cada módulo. La lógica vive en js/modules/. Cada módulo ignora las páginas donde no aplica. */
const {initAnnouncer} = __M["announcer"];
const {initPrefs} = __M["prefs"];
const {initNav} = __M["nav"];
const {initHeader} = __M["header"];
const {initSearch} = __M["search"];
const {initSuggest} = __M["suggest"];
const {initReader} = __M["reader"];
const {initMotion} = __M["motion"];
const {initHistory} = __M["history"];
const {initAccordion} = __M["accordion"];
const {initToc} = __M["toc"];

initAnnouncer();
initPrefs();
initNav();
initHeader();
initSearch();
initSuggest();
initReader();
initMotion();
initHistory();
initAccordion();
initToc();
})();
document.documentElement.classList.add("js", "js-ready");
})();
