/** Cajón del índice: aparece y desaparece, con foco atrapado, Esc, clic fuera y bloqueo de scroll. */
const $ = (s, c = document) => c.querySelector(s);

export function initNav() {
  const drawer = $('[data-js="drawer"]'), toggle = $('[data-js="nav-toggle"]');
  const closeBtn = $('[data-js="nav-close"]'), backdrop = $('[data-js="nav-backdrop"]');
  if (!drawer || !toggle || !closeBtn) return;
  const root = document.documentElement;
  [toggle, closeBtn, backdrop].forEach((el) => { if (el) el.hidden = false; });
  drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-modal", "true"); drawer.setAttribute("aria-labelledby", "drawer-title");
  drawer.inert = true;
  let lastFocus = null;
  const isOpen = () => drawer.hasAttribute("data-open");

  function open() {
    if (isOpen()) return;
    lastFocus = document.activeElement;
    drawer.inert = false; drawer.setAttribute("data-open", ""); toggle.setAttribute("aria-expanded", "true"); root.classList.add("is-locked");
    const current = $('[aria-current="page"]', drawer);
    (current || closeBtn).focus({ preventScroll: true });
    current?.scrollIntoView({ block: "center" });
  }
  function close(returnFocus = true) {
    if (!isOpen()) return;
    drawer.removeAttribute("data-open"); drawer.inert = true; toggle.setAttribute("aria-expanded", "false"); root.classList.remove("is-locked");
    if (returnFocus) (lastFocus && document.contains(lastFocus) ? lastFocus : toggle).focus();
  }

  toggle.addEventListener("click", () => (isOpen() ? close() : open()));
  closeBtn.addEventListener("click", () => close());
  backdrop?.addEventListener("click", () => close());
  drawer.addEventListener("click", (e) => { const a = e.target.closest("a"); if (a) close(false); });
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const f = [...drawer.querySelectorAll("a[href], button:not([hidden]), summary")].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $('[data-js="skip-index"]')?.addEventListener("click", (e) => { e.preventDefault(); open(); });
  addEventListener("pageshow", (e) => { if (e.persisted) close(false); });

  // Foco accesible al saltar a un ancla de la misma página (p. ej. #mapa)
  const focusTarget = () => {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!el) return;
    const h = el.matches("h1,h2,h3,h4") ? el : el.querySelector("h1,h2,h3") || el;
    h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true });
  };
  addEventListener("hashchange", focusTarget);
}
