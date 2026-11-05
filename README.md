# Base de conocimiento · Codificación clínica con la CIE-10-ES

**Autoría:** Sara Lopez Figueredo Sainz · **Patente de:** Diginosia.com · © 2026. Todos los derechos reservados.

Sitio estático (sin dependencias, sin build obligatorio, sin peticiones a terceros).

## Arquitectura y responsabilidades

| Capa | Archivos | Responsabilidad única |
|---|---|---|
| Contenido | `tools/fuente.md` (texto del Word) | Fuente de verdad |
| Estructura | `tools/template.html` + `tools/build.py` → `index.html`, `buscar.html`, `partes/*.html`, `articulos/*.html`, `data/search-index.js` | Una página por artículo y por parte; semántica, landmarks, ARIA, metadatos |
| Presentación | `css/tokens` · `base` · `layout` · `components` · `pages` · `motion` · `utilities` · `print` | Capas `@layer` en este orden; valores solo en `tokens.css` |
| Comportamiento | `js/main.js` + `js/modules/` (se empaquetan en `js/app.js`) (`nav`, `header`, `prefs`, `search`, `reader`, `motion`, `history`, `announcer`, `storage`) | Un módulo por función; cada uno ignora las páginas donde no aplica |
| Recursos | `assets/` | Logotipo ClinexCode (WebP + PNG), favicon e icono |

Regenerar todo tras cambiar contenido o plantilla: `python3 tools/build.py`.
Abrir en local: basta con abrir `index.html` (doble clic); también funciona con cualquier servidor (`python3 -m http.server`).
`js/app.js` y `data/search-index.js` son archivos **generados** (script clásico + índice como script) para que todo funcione desde `file://`, donde los navegadores bloquean los módulos ES y `fetch`. La fuente de verdad del código está en `js/modules/`; tras editarlo, ejecuta `python3 tools/build.py`.

## Navegación y cabecera
- **Índice**: cajón que aparece y desaparece (botón «Índice», `Esc`, clic fuera), con foco atrapado, bloqueo de scroll y la parte actual desplegada. Sin JavaScript se muestra como bloque normal.
- **Cabecera móvil**: una sola fila de 60 px (índice · logo · buscar · ajustes); búsqueda y ajustes se abren como paneles y la barra se oculta al bajar y reaparece al subir.
- **Menús plegables**: el índice se organiza por partes (`<details>`) con botón «Plegar todo / Desplegar todo», y cada artículo tiene un índice propio «En este artículo» que se pliega, recuerda su estado y marca la sección visible.
- **Búsqueda e indexación**: `build.py` genera `data/search-index.js` con el contenido dividido por **secciones** (cada una con su encabezado y ancla), más los **códigos CIE** de cada artículo, etiquetas, categoría y parte. El navegador construye el índice invertido al cargarlo.
  - Relevancia ponderada por campo (título > código > etiqueta > encabezado > texto) con IDF; un resultado por artículo con enlaces directos a las secciones coincidentes y fragmento resaltado.
  - Coincidencia por prefijo (`E11` → E11.9…), plurales y tildes normalizados, tolerancia a erratas («¿Quisiste decir…?»), frases exactas `"…"`, exclusión `-palabra`, filtros `tag:`, `parte:`, `cat:` y facetas con contadores.
  - Si ningún artículo contiene todos los términos, se muestran las coincidencias parciales.
  - Sugerencias mientras se escribe en la cabecera (patrón combobox: flechas, Enter, Esc), búsquedas recientes y atajo `/`.

## Lector de voz
Botón «Escuchar artículo» (o «Escuchar esta página» en inicio, partes y resultados) y atajo `Alt + L`. Reproductor accesible (región con nombre):
- **Controles**: pausa/reanudar, bloque anterior/siguiente, detener, **barra de posición** (control deslizante con valor textual «Bloque 3 de 24»), y panel de opciones plegable con velocidad, voz (solo si hay varias en español) y saltos de **sección**. Velocidad y voz se recuerdan.
- **Lectura comprensible**: los códigos CIE se deletrean («E11.9» → «E 11 punto 9»), se expanden siglas (CIE-10-ES, OMS, VIH…), símbolos y rangos, las listas numeradas dicen su número y las filas de tabla se leen como «Columna: valor».
- **Usabilidad**: resalta y desplaza hasta el bloque que se lee; clic en un párrafo para continuar desde ahí; fragmentos cortos para evitar cortes de voz; en móvil ocupa todo el ancho y el contenido no queda tapado.
- **Elegir qué leer**: botón «Escuchar» junto a cada sección (lee solo esa sección; opción «Seguir leyendo al terminar la sección»); modo «Elegir qué leer» (clic en un párrafo, o `↑` `↓` e `Intro`, `Esc` para salir); y botón flotante «Escuchar selección» (`Alt + S`) al seleccionar texto.
- **Atajos**: `←` `→` bloque, `Mayús + ← →` sección, `Espacio` (en la barra) pausa, `Esc` detiene y devuelve el foco al botón de inicio.
- **Accesibilidad**: los cambios de estado se anuncian por `aria-live` (no cada bloque, para no solaparse con un lector de pantalla); objetivos de 44 px, foco visible, respeta `prefers-reduced-motion`.
Los lectores de pantalla (NVDA, JAWS, VoiceOver, TalkBack) no lo necesitan: toda la página está estructurada con encabezados, regiones y tablas con cabeceras.

## Movimiento
Transiciones entre páginas (View Transitions), aparición al hacer scroll, contadores, sello y notas con vida, barra de progreso de lectura. Todo se desactiva con `prefers-reduced-motion`.

## Tema visual
Réplica del tema "Laboratorio CIE-10-ES" (expediente clínico): variables `--paper`, `--expediente`, `--ink`, `--cie`, `--alerta`, `--valida`, `--nota`, sombras de tarjeta, textura de papel cuadriculado y reglado, sello y nota manuscrita, tarjetas con barra superior, chips oscuros para códigos, píldoras, botones oscuro/fantasma/degradado y cabeceras de sección con barra. Tipografías Inter y JetBrains Mono (Google Fonts, con respaldo del sistema). Para autoalojarlas, descargar los `.woff2`, declarar `@font-face` en `css/base.css` y quitar los dos `<link>` de Google y su entrada en la CSP.
Ajustes de accesibilidad respecto al original: etiquetas mono de 11 px mínimo, grises con contraste AA y degradado del botón principal más oscuro.

## Convenciones
- **CSS**: BEM (`entry__title`, `callout--warn`); valores solo en `tokens.css`.
- **JS**: se engancha por `data-js="…"`, nunca por clases de estilo; ES modules; sin globales.
- **IDs**: `parte-N`, `articulo-N-M` (anclas estables y enlazables).

## Accesibilidad (WCAG 2.2 AA)
- Idioma `es`, enlaces de salto, landmarks (`header`, `nav`, `main`, `footer`, `search`), jerarquía h1→h4 sin saltos.
- Foco visible, foco movido al destino del ancla, `aria-current="location"` en el índice, `Esc` cierra menú y lector.
- Tablas con `caption`, `scope` y región desplazable enfocable; `abbr` en siglas; avisos con etiqueta de texto (no solo color).
- Región `aria-live` para resultados de búsqueda, cambios de tema/tamaño y estado del lector.
- Contraste ≥ 4.5:1 en claro y oscuro, `prefers-reduced-motion`, `forced-colors`, objetivos táctiles ≥ 44 px, texto escalable en `rem`.
- **Lector de voz** integrado (Web Speech API, voz en español, pausa/parada/velocidad, resaltado). Compatible con NVDA, JAWS, VoiceOver y TalkBack; todo el contenido funciona sin JavaScript.

## Rendimiento y seguridad
- Sin fuentes ni scripts externos (RGPD y velocidad), CSS en capas, JS `type=module` diferido, `theme-init.js` mínimo para evitar parpadeo.
- Política CSP por `<meta>` (`script-src 'self'`); en producción conviene enviarla como cabecera HTTP junto con compresión Brotli/gzip y caché larga para `css/` y `js/`.
