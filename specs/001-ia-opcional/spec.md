# Spec 001 — IA opcional con clave propia

## Qué debe ser verdad al terminar
1. Sin clave de Gemini la app funciona igual: GDELT/RSS y noticias «no comprobado».
2. En Ajustes la persona puede pegar SU clave; queda solo en `localStorage['diario-clave-gemini:v1']`,
   con aviso visible y botón «Borrar clave». Nunca aparece en repo, HTML generado, exportación,
   URL, consola ni errores (patrón `AIza` + 35 caracteres tapado).
3. La IA solo organiza y ordena las noticias que el código ya trajo; no crea noticias, enlaces
   ni fuentes. Su salida se trata como no fiable y se valida contra lo recibido.
4. El HTML generado para el móvil es limpio: sin claves ni datos personales.
5. H-A: una candidata queda «no comprobada» hasta que la persona abre la fuente; nunca `ok` sin abrirla.
6. CSP con `connect-src` limitado a generativelanguage.googleapis.com, api.gdeltproject.org y
   api.rss2json.com, sin scripts de terceros.
7. Un test impide que una clave `AIza…` entre al repo.

Marco: `docs/constitution.md` §3 (D-IA-1).
