/** Historial de lectura local: marca artículos leídos en el índice y ofrece «Continuar leyendo» en el inicio. */
import { store } from "./storage.js";

const read = (key, fallback) => { try { return JSON.parse(store.get(key)) ?? fallback; } catch { return fallback; } };

export function initHistory() {
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
