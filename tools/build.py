#!/usr/bin/env python3
"""Genera index.html a partir de tools/fuente.md (texto del Word) y tools/template.html.
Uso (desde la raíz del proyecto):  python3 tools/build.py"""
import re, html, pathlib

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
aid = lambda a: f'articulo-{a["p"]}-{a["n"]}'

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

def render_blocks(bl, seen, art_title, hlevel, as_dl=False):
    out, k, tcount, h4, ordered = [], 0, 0, art_title, False
    while k < len(bl):
        kind, val = bl[k]
        if kind == "li":
            items = []
            while k < len(bl) and bl[k][0] == "li": items.append(bl[k][1]); k += 1
            tag = "ol" if ordered else "ul"
            out.append(f'<{tag} class="prose-list">' + "".join(f"<li>{inline(x, seen)}</li>" for x in items) + f"</{tag}>")
            continue
        if kind == "h3":
            h4, ordered = val, val in ORDERED_H4
            out.append(f"<h{hlevel}>{esc(val)}</h{hlevel}>")
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
    seen, key = set(), f'{a["p"]}.{a["n"]}'
    meta, tags, summary, see, body = None, [], "", [], []
    for kind, val in a["blocks"]:
        if kind == "p" and val.startswith("**Categoría"):
            m = re.match(r"\*\*Categoría: \*\*(.+?)\*\*\s+·\s+Etiquetas: \*\*(.+)$", val); meta = (m.group(1).strip(), m.group(2).strip())
        elif kind == "p" and val.startswith("**#"): tags = re.findall(r"#(\w+)", val)
        elif kind == "p" and val.startswith("**Resumen"): summary = re.sub(r"^\*\*Resumen\.\s*\*\*", "", val).strip()
        elif kind == "p" and val.startswith("**Véase también"): see = [x.strip() for x in re.sub(r"^\*\*Véase también: \*\*", "", val).split("·")]
        else: body.append((kind, val))
    hashtags = "".join(f'<li><span class="hashtag" data-js="hashtag" data-tag="{esc(x.lower())}">#{esc(x)}</span></li>' for x in tags)
    rel = ""
    if see:
        links = "".join(f'<li><a href="#{aid(all_arts[s.split(" ")[0]])}">{esc(s)}</a></li>' for s in see if s.split(" ")[0] in all_arts)
        rel = f'<footer class="entry__footer" data-reader-skip><h4 class="entry__related-title">Véase también</h4><ul class="related-list">{links}</ul></footer>'
    gl = a["title"] in ("Glosario", "Preguntas frecuentes")
    return f'''<article id="{aid(a)}" class="entry" data-js="entry" data-category="{esc(meta[0])}" data-tags="{esc(' '.join(x.lower() for x in tags))}" aria-labelledby="{aid(a)}-titulo">
<header class="entry__header">
<p class="entry__num"><span class="sr-only">Artículo </span>{key}</p>
<h3 id="{aid(a)}-titulo" class="entry__title">{esc(a["title"])}</h3>
<dl class="entry__meta"><div><dt>Categoría</dt><dd>{esc(meta[0])}</dd></div><div><dt>Etiquetas</dt><dd>{esc(meta[1])}</dd></div></dl>
<ul class="hashtags" aria-label="Hashtags del artículo" data-reader-skip>{hashtags}</ul>
<div class="entry__tools" data-js="entry-tools" data-reader-skip></div>
</header>
<p class="entry__summary"><strong class="entry__summary-label">Resumen.</strong> {inline(summary, seen)}</p>
<div class="entry__body prose">
{render_blocks(body, seen, a["title"], 4, gl)}
</div>
{rel}
</article>'''

nav = ['<li><a class="site-nav__link" href="#presentacion">Presentación</a></li>']
mapa = []
for p in parts:
    lis = "".join(f'<li><a class="site-nav__link" href="#{aid(a)}"><span class="site-nav__num">{a["p"]}.{a["n"]}</span> {esc(a["title"])}</a></li>' for a in p["arts"])
    nav.append(f'<li class="site-nav__part" data-js="nav-part"><a class="site-nav__part-link" href="#parte-{p["n"]}">{p["n"]}. {esc(p["title"])}</a><ol class="site-nav__list">{lis}</ol></li>')
    mlis = "".join(f'<li><a href="#{aid(a)}"><span class="map__num">{a["p"]}.{a["n"]}</span> {esc(a["title"])}</a></li>' for a in p["arts"])
    mapa.append(f'<li class="map__part"><h4 class="map__title"><a href="#parte-{p["n"]}">{p["n"]}. {esc(p["title"])}</a></h4><ul class="map__list">{mlis}</ul></li>')

intro_html, seen0, skip = [], set(), False
for kind, val in intro:
    if kind == "h3" and val == "Mapa de contenidos":
        intro_html.append(f'<h3 id="mapa">Mapa de contenidos</h3><ol class="map">{"".join(mapa)}</ol>'); skip = True
    elif kind == "table" and skip: continue
    else: intro_html.append(render_blocks([(kind, val)], seen0, "Presentación", 3))
intro_html = re.sub(r'</ul>\s*<ul class="prose-list">', "", "\n".join(intro_html))

parts_html = "\n".join(
    f'<section id="parte-{p["n"]}" class="part" data-js="part" aria-labelledby="parte-{p["n"]}-titulo">\n'
    f'<h2 id="parte-{p["n"]}-titulo" class="part__title"><span class="part__num">Parte {p["n"]}</span> {esc(p["title"])}</h2>\n'
    + "\n".join(render_article(a) for a in p["arts"]) + "\n</section>" for p in parts)

words = plain(C_TITLE).split()
h1 = esc(" ".join(words[:-1])) + f' <span class="hero__accent">{esc(words[-1])}</span>'
n_art = sum(len(p["arts"]) for p in parts)
n_anx = sum(len(p["arts"]) for p in parts if p["title"].lower().startswith("anexo"))
page = (TPL.replace("{{H1}}", h1).replace("{{N_ART}}", str(n_art)).replace("{{N_PARTES}}", str(len(parts)))
        .replace("{{N_ANEXOS}}", str(n_anx)).replace("{{TITULO}}", esc(plain(C_TITLE))).replace("{{ETIQUETA}}", esc(plain(C_LABEL).capitalize()))
        .replace("{{SUBTITULO}}", esc(plain(C_SUB))).replace("{{STATS}}", esc(plain(C_STATS)))
        .replace("{{NAV}}", "\n".join(nav)).replace("{{INTRO}}", intro_html).replace("{{PARTES}}", parts_html))
(ROOT / "index.html").write_text(page, encoding="utf-8")
print("OK", sum(len(p["arts"]) for p in parts), "artículos,", len(parts), "partes,", len(page), "bytes")
