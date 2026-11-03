/** Navegación: menú móvil, marca de sección activa (scrollspy) y gestión del foco al saltar a un ancla. */
export function initNav() {
  const nav = document.querySelector('[data-js="site-nav"]');
  const toggle = document.querySelector('[data-js="nav-toggle"]');
  if (!nav) return;

  if (toggle) {
    toggle.hidden = false;
    const setOpen = (open) => {
      nav.toggleAttribute("data-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", () => setOpen(!nav.hasAttribute("data-open")));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.hasAttribute("data-open")) { setOpen(false); toggle.focus(); }
    });
    matchMedia("(min-width: 60.01rem)").addEventListener("change", (e) => e.matches && setOpen(false));
  }

  // Scrollspy: aria-current="location" en el enlace del artículo visible
  const links = new Map([...nav.querySelectorAll('a[href^="#"]')].map((a) => [a.getAttribute("href").slice(1), a]));
  const targets = [...links.keys()].map((id) => document.getElementById(id)).filter((el) => el && el.matches('[data-js="entry"]'));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach((a) => a.removeAttribute("aria-current"));
        links.get(en.target.id)?.setAttribute("aria-current", "location");
      }
    }, { rootMargin: "-20% 0px -70% 0px" });
    targets.forEach((t) => io.observe(t));
  }

  // Foco accesible al cambiar de ancla: el lector de pantalla anuncia el destino
  const focusTarget = () => {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!el || el.closest("[hidden]")) return;
    const heading = el.matches("h1,h2,h3,h4") ? el : el.querySelector("h1,h2,h3") || el;
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  };
  addEventListener("hashchange", focusTarget);
  if (location.hash) focusTarget();
}
