# Base de conocimiento · Codificación clínica con la CIE-10-ES

Sitio estático (sin dependencias, sin build obligatorio, sin peticiones a terceros).

## Arquitectura y responsabilidades

| Capa | Archivos | Responsabilidad única |
|---|---|---|
| Contenido | `tools/fuente.md` (texto del Word) | Fuente de verdad del contenido |
| Estructura | `tools/template.html` → `index.html` | Semántica, landmarks, ARIA, metadatos |
| Presentación | `css/tokens.css` · `base.css` · `layout.css` · `components.css` · `utilities.css` · `print.css` | Valores de diseño, elementos, rejilla, componentes BEM, utilidades, impresión (`@layer` fija la cascada) |
| Comportamiento | `js/main.js` + `js/modules/*.js` · `js/theme-init.js` | Un módulo por función: preferencias, navegación, filtro/búsqueda, lector de voz, avisos |
| Recursos | `assets/` (logotipo ClinexCode en WebP con respaldo PNG, favicon, icono 192) | Imágenes optimizadas con `width`/`height` para evitar saltos de maquetación |

Regenerar el HTML tras cambiar contenido o plantilla: `python3 tools/build.py`.
Probar en local: `python3 -m http.server` y abrir `http://localhost:8000` (los módulos ES requieren HTTP, no `file://`).

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
