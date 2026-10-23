# Plan — spec 002

## Enfoque
Todo el comportamiento nuevo va en funciones puras de `js/candidatas.js` (testeables en Node);
`js/candidatas-ui.js` y el CSS solo pintan. Se parte del `clasificarPorFecha` existente.

## Piezas
1. **Orden (RF1):** `ordenarCandidatas` pasa a comparar día desc, `publicadaEn` desc, nº de
   medios desc y, por último, el índice de entrada (orden estable). Sin fecha al final, con
   rótulo «fecha sin confirmar» en la tarjeta.
2. **Ventana (RF2):** nueva `filtrarPorVentana(lista, ventana, ahora)` apoyada en
   `clasificarPorFecha`; devuelve `{ visibles, fuera, sinFecha, conteos }`. El aviso
   «N más antiguas y M sin fecha ocultas · Ver todas» cambia la ventana a `todas`.
3. **Barra (RF3):** `textoBarraSeleccion(total, ocultas)` pura; la interfaz pinta una barra
   `position: sticky; bottom: 0` con `padding-bottom: env(safe-area-inset-bottom)`, botón
   `min-height: 48px`, `disabled` con 0 marcadas. Colores solo con las variables actuales.
4. **Verificación (RF4):** prueba a 360 px con 8 candidatas sintéticas en un `localStorage` de
   prueba (se borra), capturas, y confirmación de la usuaria.

## Orden de trabajo
Test primero en cada tarea; los dos tests existentes (:181 y :294) se cambian en T-R1 y T-R2
respectivamente, con el motivo de la spec. Esquema `diario-candidatas-movil:v1` intacto.

## Riesgos
- La ventana `24h` con fecha solo de día: se aplica la regla ya existente de
  `clasificarPorFecha`, sin inventar horas.
- Cambiar el orden altera lo que la usuaria ya ve: se avisa en el informe de la tarea.
