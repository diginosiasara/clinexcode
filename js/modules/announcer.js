/** Región aria-live para avisar de cambios dinámicos a lectores de pantalla. */
let region, timer;
export function initAnnouncer() { region = document.querySelector('[data-js="announcer"]'); }
export function announce(message) {
  if (!region) return;
  clearTimeout(timer);
  region.textContent = "";
  timer = setTimeout(() => { region.textContent = message; }, 60); // el vaciado previo fuerza la relectura
}
