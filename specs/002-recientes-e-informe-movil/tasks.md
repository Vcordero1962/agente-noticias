# Tareas — spec 002

- [x] T-R0 Spec, plan y tasks de esta funcionalidad escritos (solo documentos).
  Aceptación: los tres ficheros existen, sin marcadores de plantilla.
- [x] T-R1 Orden estricto (RF1): día desc → `publicadaEn` desc → nº de medios desc → entrada;
  sin fecha al final con «fecha sin confirmar». Reescribe el test de `test/candidatas.test.js:181`.
  Aceptación: tests nuevos del orden en verde y `node --test "test/**/*.test.js"` en verde.
- [x] T-R2 Ventana (RF2): `filtrarPorVentana` pura, aviso «N más antiguas y M sin fecha
  ocultas · Ver todas», sin `toISOString()`. Ajusta el test de `test/candidatas.test.js:294`.
  Aceptación: tests de hoy/24h/7d/todas en verde y suite completa en verde.
- [x] T-R3 Barra de informe (RF3): `textoBarraSeleccion` pura y barra sticky de 48 px con
  safe-area, deshabilitada con 0 y con su mensaje.
  Aceptación: tests de la función pura en verde, suite completa en verde.
- [ ] T-R4 Prueba a 360 px (RF4): 8 candidatas sintéticas en `localStorage` de prueba (se
  borra), sin scroll horizontal, capturas; confirmación de la usuaria en su teléfono.
  Aceptación: capturas guardadas y confirmación de la usuaria anotada.
