# Constitución del Diario de Estudio (repo público)

> Principios no negociables. Si algo del repo los contradice, gana este fichero.

## 1. Qué es
Diario de estudio, noticias, agenda y reuniones en HTML, CSS y JS puros, sin build ni
dependencias. Se abre con doble clic (`file://`) y también se publica en GitHub Pages.

- `Stack: vanilla (HTML/CSS/JS puros), repo público único (decisión del dueño, 2026-10-23)`
- **Rama principal:** `main`
- **Comando de tests:** `node --test "test/**/*.test.js"` (con comillas; nunca `node --test test/`).

## 2. Principios no negociables
- **Dependencias cero.** Sin npm, CDN, frameworks ni paso de build. Verificable: no existe
  `package.json` y `index.html` solo carga ficheros del propio repo.
- **Dominio puro en `js/`.** `diario.js`, `noticias.js`, `candidatas.js` y `agenda.js` no tocan
  el DOM, la red ni el reloj del navegador; son testeables en Node. La interfaz solo pinta.
- **Los datos viven solo en el `localStorage` del navegador**, claves `diario-*:v1`. El esquema
  no cambia sin acuerdo explícito. Al importar se fusiona, nunca se reemplaza ni se borra.
- **Prohibido inventar.** Ninguna noticia, enlace, cita, cifra ni fuente sale de la imaginación
  del sistema. La IA solo ordena lo que el código ya trajo (GDELT/RSS); todo sale
  «no comprobado» hasta que la persona abre la fuente. Un fallo de búsqueda se comunica tal cual.
- **Verde antes de cerrar.** Los tests pasan antes de dar una tarea por terminada.
- **Una tarea cada vez**, marcada `- [x]` en `tasks.md` solo cuando está verificada.
- **Nunca commits ni push sin petición del dueño.**

## 3. Excepción a "las claves viven en el servidor", solo en el navegador (D-IA-1, 2026-10-23, la autoriza el dueño)
Excepción a "las claves viven en el servidor", solo en el navegador (D-IA-1, 2026-10-23, la autoriza el dueño): cada persona puede pegar en Ajustes SU PROPIA clave de Gemini. Es opcional: sin clave la app funciona igual (GDELT/RSS, noticias "no comprobado"). Salvaguardas: a) la clave se guarda solo en localStorage['diario-clave-gemini:v1']; nunca en el repo, en el HTML generado, en la exportación ni en la URL; viaja solo en la cabecera x-goog-api-key y nunca se escribe en consola ni mensajes de error (se tapa el patrón AIza + 35 caracteres); b) aviso visible junto al campo («Tu clave queda en este navegador; quien use este teléfono puede usarla. Restríngela y ponle un tope de cuota») y botón «Borrar clave»; c) se recomienda restringir la clave a la Generative Language API y, si solo se usa desde Pages, al referrer https://vcordero1962.github.io/* (desde file:// no hay referrer), y un tope diario de cuota; d) CSP con connect-src limitado a generativelanguage.googleapis.com, api.gdeltproject.org y api.rss2json.com, sin scripts de terceros; e) lo que diga la IA no es fiable: no crea noticias, solo ordena las que el código ya trajo.
