/** Punto de entrada: inicializa cada módulo. La lógica vive en js/modules/. */
import { initAnnouncer } from "./modules/announcer.js";
import { initPrefs } from "./modules/prefs.js";
import { initNav } from "./modules/nav.js";
import { initFilter } from "./modules/filter.js";
import { initReader } from "./modules/reader.js";

initAnnouncer();
initPrefs();
initNav();
initFilter();
initReader();
