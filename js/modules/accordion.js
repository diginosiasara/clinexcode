/** Botón «Plegar todo / Desplegar todo» para las partes del índice. */
import { announce } from "./announcer.js";

export function initAccordion() {
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
