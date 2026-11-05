#!/usr/bin/env python3
"""Genera el sitio multipágina (index, partes/, articulos/, buscar.html, data/search-index.json)
a partir de tools/fuente.md (texto del Word) y tools/template.html.
Uso (desde la raíz del proyecto):  python3 tools/build.py"""
import re, html, json, shutil, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = (ROOT / "tools/fuente.md").read_text(encoding="utf-8").split("\n")
TPL = (ROOT / "tools/template.html").read_text(encoding="utf-8")

ABBR = {"CIE-10-ES": "Clasificación Internacional de Enfermedades, 10.ª revisión, Modificación Clínica (España)",
        "CIE-O": "Clasificación Internacional de Enfermedades para Oncología", "OMS": "Organización Mundial de la Salud",
        "RGPD": "Reglamento General de Protección de Datos", "VIH": "Virus de la inmunodeficiencia humana",
        "SIDA": "Síndrome de inmunodeficiencia adquirida", "SIRS": "Síndrome de respuesta inflamatoria sistémica",
        "LADA": "Diabetes autoinmune latente del adulto", "SNC": "Sistema nervioso central",
        "INE": "Instituto Nacional de Estadística", "EPOC": "Enfermedad pulmonar obstructiva crónica",
        "HPB": "Hiperplasia prostática benigna"}
TOKEN = re.compile(r"(?P<code>\b[A-Z]\d{2}(?:\.[0-9A-Z]{1,5}|\.-)?-?|\bM-\d{4}/\d{1,2})|(?P<abbr>\b(?:%s)\b)"
                   % "|".join(map(re.escape, sorted(ABBR, key=len, reverse=True))))
CALLOUT = {"Nota sobre los códigos": "note", "Fuente de la información": "note", "Idea clave": "key",
           "Regla fundamental": "key", "Ejemplo": "example", "Ejemplo ilustrativo": "example",
           "Caso ilustrativo": "example", "Precaución": "warn", "Importante": "warn", "Precisión terminológica": "warn"}
ORDERED_H4 = {"Procedimiento de codificación de un diagnóstico", "Método de búsqueda"}
esc = html.escape

def enhance(t, seen):
    if seen is None: return t
    def rep(m):
        if m.group("code"): return f'<code class="cie-code">{m.group("code")}</code>'
        k = m.group("abbr")
        if k in seen: return k
        seen.add(k); return f'<abbr title="{esc(ABBR[k])}">{k}</abbr>'
    return TOKEN.sub(rep, t)

def inline(s, seen=None):
    """Markdown mínimo (rachas de asteriscos) -> HTML con <strong>/<em>/<code>/<abbr>."""
    out, st, pos = [], [False, False], 0
    def setst(nb, ni):
        if (nb, ni) == tuple(st): return
        if st[1]: out.append("</em>")
        if st[0]: out.append("</strong>")
        if nb: out.append("<strong>")
        if ni: out.append("<em>")
        st[0], st[1] = nb, ni
    for m in re.finditer(r"\*+", s):
        out.append(enhance(esc(s[pos:m.start()]), seen)); pos = m.end(); n = len(m.group())
        runs = [3, 2] if (n == 5 and st[0] and st[1]) else [2, 3] if n == 5 else [n]
        for r in runs:
            if r == 1: setst(st[0], not st[1])
            elif r == 2: setst(not st[0], st[1])
            else: setst(not st[0], not st[1])
    out.append(enhance(esc(s[pos:]), seen)); setst(False, False)
    return "".join(out)

def plain(s): return re.sub(r"\*+", "", s).strip()
def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower().translate(str.maketrans("áéíóúñü", "aeiounu"))).strip("-")
def cells(row): return [c.strip() for c in row.strip().strip("|").split("|")]

# ---------- bloques ----------
_doc_title, C_LABEL, C_TITLE, C_SUB, C_STATS = [l for l in SRC[:12] if l.strip()][:5]
blocks, i = [], 0
while i < len(SRC):
    l = SRC[i]
    if l.startswith("|"):
        j = i
        while j < len(SRC) and SRC[j].startswith("|"): j += 1
        blocks.append(("table", SRC[i:j])); i = j; continue
    if l.startswith("- "): blocks.append(("li", l[2:]))
    elif (m := re.match(r"(#{1,3}) (.+)", l)): blocks.append((f"h{len(m.group(1))}", m.group(2)))
    elif l.strip(): blocks.append(("p", l))
    i += 1
blocks = blocks[blocks.index(("h1", "Presentación")):]

intro, parts, cur_part, cur_art = [], [], None, None
for kind, val in blocks:
    if kind == "h1" and val.startswith("Parte"):
        n = re.match(r"Parte (\d+)\. (.+)", val)
        cur_part = {"n": n.group(1), "title": n.group(2), "arts": []}; parts.append(cur_part); cur_art = None
    elif kind == "h2" and cur_part is not None:
        n = re.match(r"(\d+)\.(\d+) (.+)", val)
        cur_art = {"p": n.group(1), "n": n.group(2), "title": n.group(3), "blocks": []}; cur_part["arts"].append(cur_art)
    elif cur_art is not None: cur_art["blocks"].append((kind, val))
    elif kind != "h1": intro.append((kind, val))

all_arts = {f'{a["p"]}.{a["n"]}': a for p in parts for a in p["arts"]}
ordered = [a for p in parts for a in p["arts"]]
for a in ordered:
    a["key"] = f'{a["p"]}.{a["n"]}'
    a["file"] = f'articulos/{a["p"]}-{a["n"]}-{slug(a["title"])}.html'
    a["part"] = parts[int(a["p"]) - 1]
    meta, tags, summary, see, body = None, [], "", [], []
    for kind, val in a["blocks"]:
        if kind == "p" and val.startswith("**Categoría"):
            m = re.match(r"\*\*Categoría: \*\*(.+?)\*\*\s+·\s+Etiquetas: \*\*(.+)$", val); meta = (m.group(1).strip(), m.group(2).strip())
        elif kind == "p" and val.startswith("**#"): tags = re.findall(r"#(\w+)", val)
        elif kind == "p" and val.startswith("**Resumen"): summary = re.sub(r"^\*\*Resumen\.\s*\*\*", "", val).strip()
        elif kind == "p" and val.startswith("**Véase también"): see = [x.strip() for x in re.sub(r"^\*\*Véase también: \*\*", "", val).split("·")]
        else: body.append((kind, val))
    a.update(meta=meta, tags=tags, summary=summary, see=see, body=body)

R = "@@ROOT@@"
def href(a): return f'{R}{a["file"]}'
def phref(p): return f'{R}partes/parte-{p["n"]}.html'
def strip_tags(h): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()
def short(t, n=170):
    t = plain(t)
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"

# ---------- render ----------
def render_table(rows, caption, seen, tid, as_dl):
    hdr, body = cells(rows[0]), [cells(r) for r in rows[2:]]
    if as_dl:
        items = "".join(f'<div class="glossary__item"><dt>{plain(r[0])}</dt><dd>{inline(r[1], seen)}</dd></div>' for r in body)
        return f'<dl class="glossary">{items}</dl>'
    th = "".join(f'<th scope="col">{plain(h) or "<span class=sr-only>Concepto</span>"}</th>' for h in hdr)
    trs = []
    for r in body:
        tds = [f'<th scope="row">{inline(c, seen)}</th>' if k == 0 and c.startswith("**") and c.endswith("**") and c.count("**") == 2
               else f"<td>{inline(c, seen)}</td>" for k, c in enumerate(r)]
        trs.append(f'<tr>{"".join(tds)}</tr>')
    return (f'<div class="table-wrap" role="region" aria-labelledby="{tid}" tabindex="0"><table class="data-table">'
            f'<caption id="{tid}" class="sr-only">{esc(caption)}</caption><thead><tr>{th}</tr></thead>'
            f'<tbody>{"".join(trs)}</tbody></table></div>')

def render_blocks(bl, seen, art_title, hlevel, as_dl=False, ids=None):
    out, k, tcount, h4, ordered_list = [], 0, 0, art_title, False
    while k < len(bl):
        kind, val = bl[k]
        if kind == "li":
            items = []
            while k < len(bl) and bl[k][0] == "li": items.append(bl[k][1]); k += 1
            tag = "ol" if ordered_list else "ul"
            out.append(f'<{tag} class="prose-list">' + "".join(f"<li>{inline(x, seen)}</li>" for x in items) + f"</{tag}>")
            continue
        if kind == "h3":
            h4, ordered_list = val, val in ORDERED_H4
            hid = ""
            if ids is not None:
                base = "sec-" + slug(val); n, i = base, 2
                while n in ids: n, i = f"{base}-{i}", i + 1
                ids[n] = val; hid = f' id="{n}"'
            out.append(f"<h{hlevel}{hid}>{esc(val)}</h{hlevel}>")
        elif kind == "table":
            tcount += 1
            cap = f"{art_title}: {h4}" if h4 != art_title else f"{art_title} (tabla {tcount})"
            out.append(render_table(val, cap, seen, f"cap-{slug(art_title)}-{tcount}", as_dl))
        elif kind == "p":
            m = re.match(r"\*\*(.+?)\.\s*\*\*(.*)$", val)
            if m and m.group(1) in CALLOUT:
                out.append(f'<div class="callout callout--{CALLOUT[m.group(1)]}" role="note"><p><strong class="callout__label">{esc(m.group(1))}.</strong> {inline(m.group(2).strip(), seen)}</p></div>')
            else: out.append(f"<p>{inline(val, seen)}</p>")
        k += 1
    return "\n".join(out)

def render_article(a):
    seen, ids = set(), {}
    hashtags = "".join(f'<li><a class="hashtag" href="{R}buscar.html?tag={esc(x.lower())}" aria-label="Buscar artículos con la etiqueta {esc(x)}">#{esc(x)}</a></li>' for x in a["tags"])
    links = "".join(f'<li><a href="{href(all_arts[s.split(" ")[0]])}">{esc(s)}</a></li>' for s in a["see"] if s.split(" ")[0] in all_arts)
    rel = f'<footer class="entry__footer" data-reader-skip><h2 class="entry__related-title">Véase también</h2><ul class="related-list">{links}</ul></footer>' if links else ""
    gl = a["title"] in ("Glosario", "Preguntas frecuentes")
    a["ids"] = ids
    return f'''<article id="articulo" class="entry" data-js="entry" aria-labelledby="articulo-titulo">
<header class="entry__header">
<p class="entry__num"><span class="sr-only">Artículo </span>{a["key"]}</p>
<h1 id="articulo-titulo" class="entry__title" data-js="entry-title" data-num="{a["key"]}">{esc(a["title"])}</h1>
<dl class="entry__meta"><div><dt>Categoría</dt><dd>{esc(a["meta"][0])}</dd></div><div><dt>Etiquetas</dt><dd>{esc(a["meta"][1])}</dd></div></dl>
<ul class="hashtags" aria-label="Hashtags del artículo" data-reader-skip>{hashtags}</ul>
<div class="entry__tools" data-js="entry-tools" data-reader-skip></div>
</header>
<p class="entry__summary"><strong class="entry__summary-label">Resumen.</strong> {inline(a["summary"], seen)}</p>
<div class="entry__body prose">
{render_blocks(a["body"], seen, a["title"], 2, gl, ids)}
</div>
{rel}
</article>'''

def toc_html(ids):
    if len(ids) < 2: return ""
    lis = "".join(f'<li><a class="toc__link" href="#{k}">{esc(v)}</a></li>' for k, v in ids.items())
    return (f'<details class="toc" data-js="toc"><summary class="toc__summary">En este artículo <span class="toc__count">{len(ids)} secciones</span></summary>'
            f'<nav aria-label="En este artículo"><ol class="toc__list">{lis}</ol></nav></details>')

def nav_html(cur):
    """cur: ('home',) | ('search',) | ('part', n) | ('art', key)"""
    cp = cur[1] if cur[0] == "part" else (all_arts[cur[1]]["p"] if cur[0] == "art" else None)
    def link(h, label, is_cur): return f'<a class="site-nav__link" href="{h}"' + (' aria-current="page"' if is_cur else "") + f">{label}</a>"
    out = ['<ol class="site-nav__parts">', f'<li>{link(R + "index.html", "Inicio", cur[0] == "home")}</li>', f'<li>{link(R + "buscar.html", "Buscar y etiquetas", cur[0] == "search")}</li>']
    for p in parts:
        lis = f'<li>{link(phref(p), "Vista general de la parte", cur == ("part", p["n"]))}</li>'
        for a in p["arts"]:
            label = '<span class="site-nav__num">' + a["key"] + "</span> " + esc(a["title"])
            lis += f'<li>{link(href(a), label, cur == ("art", a["key"]))}</li>'
        out.append(f'<li class="site-nav__part"><details{" open" if p["n"] == cp else ""}><summary class="site-nav__summary">{p["n"]}. {esc(p["title"])}</summary><ol class="site-nav__list">{lis}</ol></details></li>')
    out.append("</ol>")
    return "\n".join(out)

def breadcrumb(items):
    lis = "".join(f'<li><a href="{h}">{esc(t)}</a></li>' if h else f'<li aria-current="page">{esc(t)}</li>' for h, t in items)
    return f'<nav class="breadcrumb" aria-label="Ruta de navegación"><ol>{lis}</ol></nav>'

def pager(a):
    i = ordered.index(a); prev = ordered[i - 1] if i else None; nxt = ordered[i + 1] if i < len(ordered) - 1 else None
    def l(x, cls, label, rel):
        if not x: return "<span></span>"
        return f'<a class="pager__link pager__link--{cls}" href="{href(x)}" rel="{rel}"><span class="pager__label">{label}</span><span class="pager__title"><span class="pager__num">{x["key"]}</span> {esc(x["title"])}</span></a>'
    return f'<nav class="pager" aria-label="Navegación entre artículos">{l(prev, "prev", "← Anterior", "prev")}{l(nxt, "next", "Siguiente →", "next")}</nav>'

def cards(arts):
    lis = ""
    for a in arts:
        lis += (f'<li class="card"><p class="card__top"><span class="entry__num">{a["key"]}</span><span class="pill">{esc(a["meta"][0])}</span></p>'
                f'<h2 class="card__title"><a class="card__link" href="{href(a)}">{esc(a["title"])}</a></h2><p class="card__text">{esc(short(a["summary"]))}</p></li>')
    return f'<ol class="cards">{lis}</ol>'

N_ART, N_PARTES = len(ordered), len(parts)
N_ANX = sum(len(p["arts"]) for p in parts if p["title"].lower().startswith("anexo"))
words = plain(C_TITLE).split()
H1 = esc(" ".join(words[:-1])) + f' <span class="hero__accent">{esc(words[-1])}</span>'

HERO = f'''<section id="inicio" class="hero" aria-labelledby="titulo-principal">
  <div class="hero__bg hero__bg--grid paper-grid" aria-hidden="true"></div>
  <div class="hero__bg hero__bg--ruled ruled" aria-hidden="true"></div>
  <div class="hero__grid">
    <div class="hero__main">
      <p class="hero__label"><span class="hero__label-line" aria-hidden="true"></span>{esc(plain(C_LABEL).capitalize())}<span class="pill pill--amber">CIE-10-ES</span></p>
      <h1 id="titulo-principal" class="hero__title">{H1}</h1>
      <p class="hero__lead">{esc(plain(C_SUB))}</p>
      <div class="hero__actions">
        <a class="btn btn--dark" href="{href(ordered[0])}"><span>Empezar a leer</span><span class="btn__arrow" aria-hidden="true">→</span></a>
        <a class="btn" href="#mapa">Mapa de contenidos</a>
      </div>
      <dl class="hero__stats">
        <div class="stat"><dt>Artículos</dt><dd data-count="{N_ART}">{N_ART}</dd></div>
        <div class="stat"><dt>Partes</dt><dd data-count="{N_PARTES}">{N_PARTES}</dd></div>
        <div class="stat stat--ok"><dt>Anexos</dt><dd data-count="{N_ANX}">{N_ANX}</dd></div>
      </dl>
    </div>
    <div class="hero__aside">
      <p class="handwritten note note--alerta" aria-hidden="true">Revisar Excluye1</p>
      <p class="handwritten note note--cie" aria-hidden="true">¿Lateralidad D/I?</p>
      <figure class="logo-card">
        <picture class="logo-card__plate"><source srcset="{R}assets/logo-clinexcode.webp" type="image/webp">
        <img class="logo-card__logo" src="{R}assets/logo-clinexcode.png" width="900" height="645" alt="ClinexCode: conocimiento que conecta, precisión que transforma" decoding="async" fetchpriority="high"></picture>
        <span class="stamp" aria-hidden="true">CIE-10-ES ✓</span>
      </figure>
    </div>
  </div>
  <p class="hero__strip">{esc(plain(C_STATS))}</p>
</section>
<aside class="resume" data-js="resume" data-total="{N_ART}" aria-label="Continuar leyendo" hidden>
  <p class="resume__text"><span class="resume__label">Continuar leyendo</span> <a class="resume__link" data-js="resume-link" href="#"></a></p>
  <p class="resume__count mono-label" data-js="resume-count"></p>
</aside>'''

def mapa_html():
    items = []
    for p in parts:
        mlis = "".join(f'<li><a href="{href(a)}"><span class="map__num">{a["key"]}</span> {esc(a["title"])}</a></li>' for a in p["arts"])
        items.append(f'<li class="map__part"><h4 class="map__title"><a href="{phref(p)}">{p["n"]}. {esc(p["title"])}</a></h4><ul class="map__list">{mlis}</ul></li>')
    return f'<h3 id="mapa">Mapa de contenidos</h3><ol class="map">{"".join(items)}</ol>'

def intro_html():
    out, seen0, skip = [], set(), False
    for kind, val in intro:
        if kind == "h3" and val == "Mapa de contenidos": out.append(mapa_html()); skip = True
        elif kind == "table" and skip: continue
        else: out.append(render_blocks([(kind, val)], seen0, "Presentación", 3))
    return re.sub(r'</ul>\s*<ul class="prose-list">', "", "\n".join(out))

for d in ("articulos", "partes", "data"):
    shutil.rmtree(ROOT / d, ignore_errors=True); (ROOT / d).mkdir()
for f in ROOT.glob("*.html"): f.unlink()

def write(path, root, page, title, desc, main, cur, og="article"):
    t = (TPL.replace("{{TITLE}}", esc(title)).replace("{{DESC}}", esc(desc)).replace("{{OGTYPE}}", og).replace("{{PAGE}}", page)
         .replace("{{ETIQUETA}}", esc(plain(C_LABEL).capitalize())).replace("{{N_ART}}", str(N_ART)).replace("{{N_PARTES}}", str(N_PARTES))
         .replace("{{NAV}}", nav_html(cur)).replace("{{MAIN}}", main).replace("@@ROOT@@", root))
    (ROOT / path).write_text(t, encoding="utf-8")

write("index.html", "", "home", f"{plain(C_TITLE)} · ClinexCode", plain(C_SUB),
      HERO + f'\n<section id="presentacion" class="presentation" aria-labelledby="presentacion-titulo"><h2 id="presentacion-titulo" class="part__title">Presentación</h2>\n{intro_html()}</section>', ("home",), "website")
for p in parts:
    pi = p["arts"]; n = len(pi)
    main = (breadcrumb([(R + "index.html", "Inicio"), (None, f'Parte {p["n"]}')]) +
            f'<header class="page-head"><h1 class="part__title"><span class="part__num">Parte {p["n"]}</span> {esc(p["title"])}</h1><p class="page-head__meta mono-label">{n} {"artículo" if n == 1 else "artículos"}</p></header>\n{cards(pi)}')
    write(f'partes/parte-{p["n"]}.html', "../", "part", f'Parte {p["n"]}. {p["title"]} · ClinexCode', f'{p["title"]}: {n} artículos de la base de conocimiento de codificación clínica.', main, ("part", p["n"]), "website")
docs, secs = [], []
for a in ordered:
    art = render_article(a)
    main = (breadcrumb([(R + "index.html", "Inicio"), (phref(a["part"]), f'Parte {a["p"]}: {a["part"]["title"]}'), (None, f'{a["key"]} {a["title"]}')]) + "\n" + toc_html(a["ids"]) + "\n" + art + "\n" + pager(a))
    write(a["file"], "../", "article", f'{a["key"]} {a["title"]} · ClinexCode', short(a["summary"], 155), main, ("art", a["key"]))
    codes = sorted(set(re.findall(r'<code class="cie-code">([^<]+)</code>', art)))
    body = art.split('<div class="entry__body')[-1].split(">", 1)[1].split('<footer class="entry__footer"')[0]
    di = len(docs)
    docs.append({"id": a["key"], "u": a["file"], "t": a["title"], "p": int(a["p"]), "pt": a["part"]["title"], "c": a["meta"][0],
                 "g": a["tags"], "k": codes, "s": short(a["summary"], 200)})
    for j, piece in enumerate(re.split(r'(?=<h2 id="sec-)', body)):
        m = re.match(r'<h2 id="(sec-[^"]+)">(.*?)</h2>', piece, re.S)
        h, anc, rest = (strip_tags(m.group(2)), m.group(1), piece[m.end():]) if m else ("", "", piece)
        txt = strip_tags(rest)
        if j == 0: txt = (plain(a["summary"]) + " " + txt).strip()
        if txt or h: secs.append({"d": di, "h": h, "a": anc, "x": txt})
main = ('<header class="page-head"><h1 class="part__title">Buscar</h1></header>\n'
        '<details class="search-help"><summary class="toc__summary">Consejos de búsqueda</summary><ul class="search-help__list"><li>Varias palabras: se buscan todas (<code>sepsis neutropenia</code>); si no hay coincidencias, se muestran las parciales.</li>'
        '<li>Los códigos funcionan por prefijo: <code>E11</code> encuentra E11.9, E11.65…</li><li>Frase exacta entre comillas: <code>"lista tabular"</code>.</li>'
        '<li>Excluir una palabra: <code>-neoplasia</code>. Filtrar: <code>tag:vih</code> o <code>parte:4</code>.</li><li>Se toleran plurales, tildes y erratas leves. Pulsa <kbd>/</kbd> en cualquier página para ir al buscador.</li></ul></details>\n'
        '<div class="results" data-js="results"><p class="results__status mono-label" role="status" data-js="results-status">Cargando índice…</p>'
        '<div class="results__filters" data-js="results-filters"></div><div class="results__facets" data-js="results-facets"></div><p class="results__hint" data-js="results-hint" hidden></p><ol class="cards results__list" data-js="results-list"></ol>'
        '<section class="tag-browser" data-js="recent" aria-labelledby="recientes-titulo" hidden><h2 id="recientes-titulo" class="tag-browser__title">Búsquedas recientes</h2><ul class="hashtags" data-js="recent-list"></ul></section>'
        '<section class="tag-browser" data-js="tag-browser" aria-labelledby="etiquetas-titulo" hidden><h2 id="etiquetas-titulo" class="tag-browser__title">Etiquetas</h2><ul class="hashtags" data-js="tag-list"></ul></section></div>\n'
        '<noscript><p class="empty">La búsqueda necesita JavaScript. Usa el índice para navegar por las partes y artículos.</p></noscript>')
write("buscar.html", "", "search", "Buscar · ClinexCode", "Busca artículos, códigos y términos en la base de conocimiento de codificación clínica CIE-10-ES.", main, ("search",), "website")
(ROOT / "data/search-index.js").write_text("window.CIE_INDEX=" + json.dumps({"v": 2, "docs": docs, "secs": secs}, ensure_ascii=False, separators=(",", ":")) + ";", encoding="utf-8")
import bundle; bundle.main()
print("OK", N_ART, "artículos,", N_PARTES, "partes,", len(list(ROOT.rglob("*.html"))), "páginas HTML")
