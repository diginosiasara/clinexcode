/** Preferencias de lectura: tema (auto/claro/oscuro) y tamaño de texto. */
import { store } from "./storage.js";
import { announce } from "./announcer.js";

const THEMES = ["auto", "light", "dark"];
const THEME_LABEL = { auto: "automático", light: "claro", dark: "oscuro" };
const THEME_ICON = { auto: "◐", light: "☀", dark: "☾" };
const root = document.documentElement;

export function initPrefs() {
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
