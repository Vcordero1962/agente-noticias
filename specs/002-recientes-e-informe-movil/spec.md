# Spec 002 — Lo más reciente primero y botón de informe visible en el móvil

## Origen
Comentarios de la usuaria final (usa el celular). Pide tres cosas:
1. Ver primero lo más reciente.
2. No ver noticias del mes pasado.
3. Ver el botón de crear informe en cuanto marca casillas (hoy no lo encuentra).

## Requisitos funcionales
- **RF1 Orden estricto** de las candidatas: día de publicación descendente → `publicadaEn`
  (hora) descendente → número de medios distintos descendente → orden de entrada. Las que no
  tienen fecha van al final y se rotulan «fecha sin confirmar».
- **RF2 Ventana de fechas.** `filtrarPorVentana(lista, ventana, ahora)` es una función pura.
  En `hoy`, `24h` y `7d` solo se muestra lo que cae dentro de la ventana. Las candidatas sin
  fecha solo aparecen en `todas`, al final. Si se ocultan, un aviso dice «N más antiguas y M
  sin fecha ocultas · Ver todas». Las fechas son locales (`aFecha`, `desplazarISO`,
  `diasEntre`); nunca `toISOString()`.
- **RF3 Barra de informe siempre visible** cuando hay candidatas: fija abajo (sticky) con
  `safe-area-inset-bottom`, botón de 48 px de alto «📄 Crear informe (N)», deshabilitado con
  N = 0, y el mensaje «Marca ☑ al menos una noticia para crear el informe».
  `textoBarraSeleccion(total, ocultas)` es una función pura que devuelve el texto.
- **RF4 Prueba a 360 px** en el navegador integrado: 8 candidatas sintéticas en un
  `localStorage` de prueba que se borra al terminar; sin scroll horizontal; capturas
  guardadas como evidencia. Además, confirmación de la usuaria en su teléfono.

## Requisitos no funcionales
- Sin dependencias ni build; la lógica en el dominio puro (`js/candidatas.js`), la interfaz
  solo pinta.
- Esquema `diario-candidatas-movil:v1` sin cambios.
- Ningún fichero supera 1000 líneas.
- Solo variables CSS actuales (`--panel`, `--acento`, `--texto`, `--panel-borde`); sin colores
  nuevos.

## Cambio de tests existentes (motivado)
- `test/candidatas.test.js:181` («más medios distintos primero, aunque sea más antigua»)
  codifica el orden por nº de medios por delante de la fecha. Contradice RF1 (la fecha manda,
  los medios solo desempatan), así que se reescribe: una candidata más reciente con un solo
  medio va antes que una más antigua con varios.
- `test/candidatas.test.js:294` («sin fecha va a sinFecha en toda ventana» / se muestra
  siempre) contradice RF2: las sin fecha solo se muestran en `todas`. Se ajusta al nuevo
  contrato, conservando que `clasificarPorFecha` las separa.
Los dos cambios son consecuencia directa de las peticiones de la usuaria, no una relajación
de las pruebas.

## Nota H4 (anotada, sin tarea)
GDELT entrega `seendate` (momento de indexación), no la fecha de publicación. Rotularlo con
exactitud exige un campo nuevo en el esquema y permiso del dueño. Queda fuera de esta spec.

## Criterio de terminado
T-R0 a T-R4 en `[x]`, `node --test "test/**/*.test.js"` en verde y confirmación de la usuaria.
