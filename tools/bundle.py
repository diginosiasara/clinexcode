"""Empaqueta js/modules/*.js (ES modules) en js/app.js, un script clásico que funciona también abriendo
los archivos con doble clic (file://), donde los navegadores bloquean los módulos. Los módulos siguen siendo
la fuente de verdad; app.js es un archivo generado."""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMPORT = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*["\']\./(?:modules/)?([\w-]+)\.js["\'];?[ \t]*$', re.M)
EXPORT = re.compile(r'^export\s+((?:async\s+)?function\s+(\w+)|const\s+(\w+)|let\s+(\w+))', re.M)

def load():
    mods = {}
    for f in [*(ROOT / "js/modules").glob("*.js"), ROOT / "js/main.js"]:
        src = f.read_text(encoding="utf-8"); name = f.stem
        deps = [m.group(2) for m in IMPORT.finditer(src)]
        mods[name] = (src, deps)
    return mods

def order(mods):
    out, seen = [], set()
    def visit(n):
        if n in seen: return
        seen.add(n)
        for d in mods[n][1]: visit(d)
        out.append(n)
    for n in sorted(mods, key=lambda x: x == "main"): visit(n)
    return out

def wrap(name, src):
    src = IMPORT.sub(lambda m: f'const {{{m.group(1).strip()}}} = __M["{m.group(2)}"];', src)
    names = [m.group(2) or m.group(3) or m.group(4) for m in EXPORT.finditer(src)]
    src = EXPORT.sub(lambda m: m.group(1), src)
    ret = f"\nreturn {{ {', '.join(names)} }};" if names else ""
    return f'/* ---- {name} ---- */\n__M["{name}"] = (() => {{\n{src.strip()}{ret}\n}})();\n'

def main():
    mods = load()
    body = "".join(wrap(n, mods[n][0]) for n in order(mods))
    out = ('/* ARCHIVO GENERADO por tools/bundle.py a partir de js/modules/*.js. No editar a mano. */\n'
           '(() => {\n"use strict";\nconst __M = {};\n' + body +
           'document.documentElement.classList.add("js", "js-ready");\n})();\n')
    (ROOT / "js/app.js").write_text(out, encoding="utf-8")
    return len(out)

if __name__ == "__main__":
    print("app.js", main(), "bytes")
