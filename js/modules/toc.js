/** Índice plegable «En este artículo»: recuerda si está abierto y marca la sección visible. */
import { store } from "./storage.js";

export function initToc() {
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
