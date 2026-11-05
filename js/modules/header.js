/** Cabecera: paneles de búsqueda y ajustes en móvil (patrón de divulgación) y ocultación al bajar el scroll. */
const $ = (s) => document.querySelector(s);

export function initHeader() {
  const header = $('[data-js="site-header"]');
  const sBtn = $('[data-js="search-toggle"]'), sPanel = $('[data-js="search-panel"]');
  const pBtn = $('[data-js="prefs-toggle"]'), pPanel = $('[data-js="toolbar"]');
  if (!header || !sBtn || !pBtn) return;
  const mobile = matchMedia("(max-width: 47.99rem)");
  sBtn.hidden = false; pBtn.hidden = false;
  const pairs = [[sBtn, sPanel], [pBtn, pPanel]];

  function set(btn, panel, open, focus = true) {
    panel.toggleAttribute("data-open", open); btn.setAttribute("aria-expanded", String(open));
    if (open && focus) (panel.querySelector("input, button:not([hidden])") || panel).focus();
    if (open) header.classList.remove("is-hidden");
  }
  function closeAll(except) { pairs.forEach(([b, p]) => { if (b !== except && p.hasAttribute("data-open")) set(b, p, false, false); }); }

  pairs.forEach(([btn, panel]) => {
    btn.addEventListener("click", () => { const open = !panel.hasAttribute("data-open"); closeAll(btn); set(btn, panel, open); });
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape" && mobile.matches && panel.hasAttribute("data-open")) { set(btn, panel, false, false); btn.focus(); } });
  });
  document.addEventListener("pointerdown", (e) => { if (mobile.matches && !header.contains(e.target)) closeAll(); });
  mobile.addEventListener("change", () => closeAll());

  // Ocultar al bajar, mostrar al subir (solo móvil); nunca con foco o paneles abiertos
  let lastY = scrollY, ticking = false;
  const locked = () => header.contains(document.activeElement) && document.activeElement !== document.body
    || header.querySelector('[aria-expanded="true"]') || document.documentElement.classList.contains("is-locked");
  addEventListener("scroll", () => {
    if (!mobile.matches || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY, dy = y - lastY;
      if (y < 80 || dy < -6 || locked()) header.classList.remove("is-hidden");
      else if (dy > 6) header.classList.add("is-hidden");
      lastY = y; ticking = false;
    });
  }, { passive: true });
  header.addEventListener("focusin", () => header.classList.remove("is-hidden"));
}
