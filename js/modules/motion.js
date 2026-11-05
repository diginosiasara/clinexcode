/** Movimiento sutil: barra de progreso de lectura, aparición al hacer scroll y contadores. Respeta prefers-reduced-motion. */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initMotion() {
  const bar = document.querySelector('[data-js="progress"]');
  if (bar && document.body.dataset.page === "article") {
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`; ticking = false;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
  if (reduce || !("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll(".callout, .table-wrap, .glossary, .map__part, .entry__summary, .stat").forEach((el) => { el.classList.add("reveal"); io.observe(el); });

  const counters = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    counters.unobserve(e.target);
    const end = Number(e.target.dataset.count), t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      e.target.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  document.querySelectorAll("[data-count]").forEach((el) => counters.observe(el));
}
