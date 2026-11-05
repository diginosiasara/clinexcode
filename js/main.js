/** Punto de entrada: inicializa cada módulo. La lógica vive en js/modules/. Cada módulo ignora las páginas donde no aplica. */
import { initAnnouncer } from "./modules/announcer.js";
import { initPrefs } from "./modules/prefs.js";
import { initNav } from "./modules/nav.js";
import { initHeader } from "./modules/header.js";
import { initSearch } from "./modules/search.js";
import { initSuggest } from "./modules/suggest.js";
import { initReader } from "./modules/reader.js";
import { initMotion } from "./modules/motion.js";
import { initHistory } from "./modules/history.js";
import { initAccordion } from "./modules/accordion.js";
import { initToc } from "./modules/toc.js";

initAnnouncer();
initPrefs();
initNav();
initHeader();
initSearch();
initSuggest();
initReader();
initMotion();
initHistory();
initAccordion();
initToc();
