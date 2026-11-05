/** Sugerencias del buscador (patrón combobox ARIA): artículos, códigos, etiquetas y secciones; recientes al enfocar. */
import { loadIndex, suggest, getRecent } from "./search-core.js";
import { announce } from "./announcer.js";

export function initSuggest() {
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
