/** Motor de búsqueda: indexa secciones, códigos CIE, etiquetas y títulos; puntúa por campo, tolera prefijos y erratas. */
export const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const STOP = new Set("de la el en y a los las del un una por con para se que o al lo es su sus como mas no si ni pero entre sobre este esta estos estas ese esa u e".split(" "));
const rawTokens = (s) => norm(s).match(/[a-z0-9]+(?:[.\-][a-z0-9]+)*/g) || [];
export const stem = (t) => (/^[a-z]+$/.test(t) ? (t.length > 4 && t.endsWith("es") ? t.slice(0, -2) : t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t) : t);
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
export function loadIndex(root = "") {
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
export function parseQuery(q) {
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

export function search(ix, p) {
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

export function didYouMean(ix, p, unmatched) {
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
export function snippet(ix, secIdx, p, len = 240) {
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
export function suggest(ix, q, limit = 8) {
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
export function getRecent() { try { return JSON.parse(localStorage.getItem("cie.recent")) || []; } catch { return []; } }
export function addRecent(q) {
  try { localStorage.setItem("cie.recent", JSON.stringify([q, ...getRecent().filter((x) => x !== q)].slice(0, 6))); } catch { /* ignorar */ }
}
