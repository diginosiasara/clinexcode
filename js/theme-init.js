/* Script bloqueante y mínimo: aplica tema y tamaño de texto antes del primer pintado (evita parpadeo). */
(function () {
  var d = document.documentElement;
  d.classList.add("js");
  try {
    var t = localStorage.getItem("cie.theme"), f = localStorage.getItem("cie.fs");
    if (t === "light" || t === "dark") d.setAttribute("data-theme", t);
    if (f) d.setAttribute("data-fs", f);
  } catch (e) { /* almacenamiento no disponible: se usan los valores del sistema */ }
})();
