/** Página de resultados: consulta el índice (?q= ?tag= ?parte= ?cat=), muestra facetas, secciones coincidentes y fragmentos resaltados. */
import { loadIndex, parseQuery, search, snippet, didYouMean, getRecent, addRecent, norm } from "./search-core.js";

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const url = (o) => { const u = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => v && u.set(k, v)); const s = u.toString(); return "buscar.html" + (s ? "?" + s : ""); };

export async function initSearch() {
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
