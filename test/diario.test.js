/*
 * Tests de la lógica de dominio (diario.js) con el runner nativo de Node.
 *
 *   node test/diario.test.js
 *
 * Sin dependencias: solo node:test y node:assert.
 * Requiere Node 18+. No usa `npm test` porque npm está roto en este WSL (ver
 * rules/entorno-wsl.md).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EXPORTADAS = [
  'validarSesion', 'crearSesion', 'calcularRachaActual', 'calcularMejorRacha',
  'calcularMinutosTotales', 'agruparPorFecha', 'ordenarSesiones',
  'desplazarISO', 'diasEntre', 'aFecha', 'hoyISO', 'cargarSesiones', 'guardarSesiones',
  'serializar', 'analizarPaquete', 'claveSesion',
];

/*
 * diario.js es un script plano, sin `module.exports`. Lo evaluamos con
 * `new Function` en ESTE mismo realm y devolvemos sus funciones.
 *
 * Ojo: no usar `vm.runInContext` aquí. Un contexto de VM crea arrays y objetos
 * de otro realm, y `assert.deepStrictEqual` compara prototipos, así que
 * fallaría aunque los valores fuesen idénticos.
 */
function cargarDiario() {
  const ruta = path.join(__dirname, '..', 'js', 'diario.js');
  const codigo = fs.readFileSync(ruta, 'utf8');
  return new Function(`${codigo}\nreturn { ${EXPORTADAS.join(', ')} };`)();
}

const d = cargarDiario();

// Sesión de ejemplo
const s = (fecha, materia = 'JavaScript', minutos = 45) =>
  ({ id: `${fecha}-${minutos}`, fecha, materia, minutos, creadaEn: 0 });

describe('validarSesion', () => {
  test('acepta una sesión correcta', () => {
    assert.deepEqual(
      d.validarSesion({ fecha: '2026-09-29', materia: 'Python', minutos: 30 }),
      [],
    );
  });

  test('rechaza fechas futuras', () => {
    const errores = d.validarSesion(
      { fecha: '2026-09-30', materia: 'X', minutos: 10 },
      '2026-09-29',
    );
    assert.match(errores.join(' '), /futuras/);
  });

  test('acepta fechas pasadas', () => {
    const errores = d.validarSesion(
      { fecha: '2020-01-01', materia: 'X', minutos: 10 },
      '2026-09-29',
    );
    assert.deepEqual(errores, []);
  });

  test('rechaza materia vacía', () => {
    const errores = d.validarSesion({ fecha: '2026-09-29', materia: '   ', minutos: 10 });
    assert.match(errores.join(' '), /estudiaste/);
  });

  test('rechaza minutos no enteros o fuera de rango', () => {
    assert.match(d.validarSesion({ fecha: '2026-09-29', materia: 'X', minutos: 0 }).join(' '), /mayor que 0/);
    assert.match(d.validarSesion({ fecha: '2026-09-29', materia: 'X', minutos: 12.5 }).join(' '), /entero/);
    assert.match(d.validarSesion({ fecha: '2026-09-29', materia: 'X', minutos: 2000 }).join(' '), /1440/);
  });

  test('rechaza fecha ausente o mal formada', () => {
    assert.match(d.validarSesion({ fecha: '', materia: 'X', minutos: 5 }).join(' '), /obligatoria/);
    assert.match(d.validarSesion({ fecha: '29-09-2026', materia: 'X', minutos: 5 }).join(' '), /formato/);
  });

  test('rechaza fechas que no existen en el calendario como 2026-02-31 (B2/H4)', () => {
    assert.match(
      d.validarSesion({ fecha: '2026-02-31', materia: 'X', minutos: 10 }, '2026-10-18').join(' '),
      /no existe/,
    );
    assert.match(
      d.validarSesion({ fecha: '2025-02-29', materia: 'X', minutos: 10 }, '2026-10-18').join(' '),
      /no existe/,
    );
    assert.deepEqual(
      d.validarSesion({ fecha: '2024-02-29', materia: 'X', minutos: 10 }, '2026-10-18'),
      [],
    );
  });
});

describe('crearSesion', () => {
  test('normaliza los campos', () => {
    const sesion = d.crearSesion({ fecha: '2026-09-29', materia: '  Go  ', minutos: '20' });
    assert.equal(sesion.materia, 'Go');
    assert.equal(sesion.minutos, 20);
    assert.ok(sesion.id);
  });

  test('lanza si los datos no son válidos', () => {
    assert.throws(
      () => d.crearSesion({ fecha: '2026-09-29', materia: '', minutos: 10 }),
      /estudiaste/,
    );
  });
});

describe('calcularRachaActual', () => {
  test('sin sesiones es 0', () => {
    assert.equal(d.calcularRachaActual([], '2026-09-29'), 0);
  });

  test('un día cuenta aunque sean pocos minutos', () => {
    assert.equal(d.calcularRachaActual([s('2026-09-29', 'X', 1)], '2026-09-29'), 1);
  });

  test('varios días consecutivos suman', () => {
    const sesiones = [s('2026-09-27'), s('2026-09-28'), s('2026-09-29')];
    assert.equal(d.calcularRachaActual(sesiones, '2026-09-29'), 3);
  });

  test('sigue viva si la última sesión fue ayer', () => {
    const sesiones = [s('2026-09-27'), s('2026-09-28')];
    assert.equal(d.calcularRachaActual(sesiones, '2026-09-29'), 2);
  });

  test('se rompe si la última sesión fue hace más de un día', () => {
    const sesiones = [s('2026-09-20'), s('2026-09-21')];
    assert.equal(d.calcularRachaActual(sesiones, '2026-09-29'), 0);
  });

  test('un hueco rompe la racha', () => {
    // 25, 26 y 29: el 27-28 faltan, así que solo cuenta el 29.
    const sesiones = [s('2026-09-25'), s('2026-09-26'), s('2026-09-29')];
    assert.equal(d.calcularRachaActual(sesiones, '2026-09-29'), 1);
  });

  test('cuenta un salto de mes correctamente', () => {
    const sesiones = [s('2026-08-30'), s('2026-08-31'), s('2026-09-01')];
    assert.equal(d.calcularRachaActual(sesiones, '2026-09-01'), 3);
  });

  test('cuenta un año bisiesto correctamente', () => {
    // 2024 es bisiesto: 28 feb -> 29 feb -> 1 mar son 3 días seguidos.
    const sesiones = [s('2024-02-28'), s('2024-02-29'), s('2024-03-01')];
    assert.equal(d.calcularRachaActual(sesiones, '2024-03-01'), 3);
  });

  test('varias sesiones el mismo día no inflan la racha', () => {
    const sesiones = [s('2026-09-28'), s('2026-09-29', 'A'), s('2026-09-29', 'B'), s('2026-09-29', 'C')];
    assert.equal(d.calcularRachaActual(sesiones, '2026-09-29'), 2);
  });
});

describe('calcularMejorRacha', () => {
  test('sin sesiones es 0', () => {
    assert.equal(d.calcularMejorRacha([]), 0);
  });

  test('una sola sesión es 1', () => {
    assert.equal(d.calcularMejorRacha([s('2020-01-01')]), 1);
  });

  test('guarda el máximo histórico aunque la racha esté rota', () => {
    // Racha larga antigua (5 días) + racha actual corta (2 días).
    const sesiones = [
      s('2020-01-01'), s('2020-01-02'), s('2020-01-03'), s('2020-01-04'), s('2020-01-05'),
      s('2026-09-28'), s('2026-09-29'),
    ];
    assert.equal(d.calcularMejorRacha(sesiones), 5);
  });

  test('ignora el orden de entrada de las sesiones', () => {
    const sesiones = [s('2026-09-29'), s('2026-09-27'), s('2026-09-28')];
    assert.equal(d.calcularMejorRacha(sesiones), 3);
  });

  test('no une rachas separadas por un hueco', () => {
    const sesiones = [s('2026-01-01'), s('2026-01-02'), s('2026-06-01')];
    assert.equal(d.calcularMejorRacha(sesiones), 2);
  });

  test('racha actual y mejor racha coinciden en la máxima teórica', () => {
    const sesiones = [s('2026-09-27'), s('2026-09-28'), s('2026-09-29')];
    assert.equal(d.calcularMejorRacha(sesiones), d.calcularRachaActual(sesiones, '2026-09-29'));
  });
});

describe('calcularMinutosTotales', () => {
  test('suma todas las sesiones', () => {
    const sesiones = [s('2026-09-27', 'A', 30), s('2026-09-28', 'B', 45), s('2026-09-29', 'C', 15)];
    assert.equal(d.calcularMinutosTotales(sesiones), 90);
  });

  test('sin sesiones es 0', () => {
    assert.equal(d.calcularMinutosTotales([]), 0);
  });
});

describe('utilidades de fecha', () => {
  test('desplazarISO suma y resta días', () => {
    assert.equal(d.desplazarISO('2026-09-29', 1), '2026-09-30');
    assert.equal(d.desplazarISO('2026-09-01', -1), '2026-08-31');
  });

  test('desplazarISO cruza el año', () => {
    assert.equal(d.desplazarISO('2026-12-31', 1), '2027-01-01');
  });

  test('diasEntre cuenta la distancia', () => {
    assert.equal(d.diasEntre('2026-09-27', '2026-09-29'), 2);
    assert.equal(d.diasEntre('2026-09-29', '2026-09-27'), -2);
  });

  test('agruparPorFecha crea un grupo por día', () => {
    const sesiones = [s('2026-09-28'), s('2026-09-29', 'A'), s('2026-09-29', 'B')];
    const grupos = d.agruparPorFecha(sesiones);
    assert.equal(grupos.length, 2);
    assert.equal(grupos[0].fecha, '2026-09-29');
    assert.equal(grupos[0].items.length, 2);
  });
});

describe('serializar', () => {
  test('devuelve la versión del formato', () => {
    assert.equal(d.serializar([]).version, 1);
  });

  test('sin sesiones devuelve el paquete vacío', () => {
    assert.deepEqual(d.serializar([]), { version: 1, sesiones: [] });
  });

  test('conserva el orden y los campos de las sesiones', () => {
    const sesiones = [
      s('2026-09-28', 'Go', 30),
      s('2026-09-29', 'JavaScript', 45),
      s('2026-09-27', 'Python', 15),
    ];
    assert.deepEqual(d.serializar(sesiones).sesiones, sesiones);
  });

  test('no recalcula nada: copia tal cual', () => {
    // Minutos y campos tal cual, sin totals ni rachas añadidos.
    const sesiones = [s('2026-09-29', 'Rust', 90)];
    assert.deepEqual(Object.keys(d.serializar(sesiones).sesiones[0]).sort(),
      ['creadaEn', 'fecha', 'id', 'materia', 'minutos']);
  });

  test('copia las sesiones: mutar el paquete no toca el original', () => {
    const sesiones = [s('2026-09-29', 'Go', 30)];
    const paquete = d.serializar(sesiones);
    paquete.sesiones[0].minutos = 999;
    assert.equal(sesiones[0].minutos, 30);
  });
});

/** Empaqueta sesiones en el texto JSON que produciría un archivo exportado. */
const paquete = (sesiones) => JSON.stringify(d.serializar(sesiones));

describe('analizarPaquete', () => {
  test('acepta un paquete válido y devuelve sus sesiones', () => {
    const sesiones = [s('2020-01-01', 'Go', 30), s('2020-01-02', 'Rust', 45)];
    const r = d.analizarPaquete(paquete(sesiones));
    assert.equal(r.error, null);
    assert.equal(r.rechazadas.length, 0);
    assert.equal(r.duplicadas.length, 0);
    assert.deepEqual(r.validas, sesiones);
  });

  test('no escribe nada: es solo análisis', () => {
    // Devuelve sesiones pero no muta la lista de existentes que se le pasa.
    const existentes = [s('2020-01-01', 'Go', 30)];
    d.analizarPaquete(paquete([s('2020-01-05', 'Go', 15)]), existentes);
    assert.equal(existentes.length, 1);
  });

  test('rechaza JSON ilegible con motivo', () => {
    const r = d.analizarPaquete('{ esto no es json');
    assert.match(r.error, /JSON/);
    assert.equal(r.validas.length, 0);
  });

  test('rechaza un JSON que no es un objeto', () => {
    assert.match(d.analizarPaquete('42').error, /formato/);
    assert.match(d.analizarPaquete('[1,2,3]').error, /formato/);
  });

  test('rechaza una versión distinta de 1', () => {
    const r = d.analizarPaquete(JSON.stringify({ version: 2, sesiones: [] }));
    assert.match(r.error, /versión/);
    assert.equal(r.validas.length, 0);
  });

  test('rechaza cuando sesiones no es un array', () => {
    const r = d.analizarPaquete(JSON.stringify({ version: 1, sesiones: 42 }));
    assert.match(r.error, /sesiones/);
    assert.equal(r.validas.length, 0);
  });

  test('rechaza una sesión con fecha futura y deja pasar el resto', () => {
    const manana = d.desplazarISO(d.hoyISO(), 1);
    const texto = paquete([s('2020-01-01', 'Go', 30), s(manana, 'Futuro', 10)]);
    const r = d.analizarPaquete(texto);
    assert.equal(r.error, null);
    assert.equal(r.validas.length, 1);
    assert.equal(r.rechazadas.length, 1);
    assert.match(r.rechazadas[0].motivo, /futuras/);
  });

  test('rechaza datos inválidos con el motivo de validarSesion', () => {
    const texto = paquete([
      { fecha: '2020-01-01', materia: '  ', minutos: 30 },
      { fecha: '2020-01-02', materia: 'Go', minutos: 0 },
      s('2020-01-03', 'Go', 30),
    ]);
    const r = d.analizarPaquete(texto);
    assert.equal(r.validas.length, 1);
    assert.match(r.rechazadas[0].motivo, /estudiaste/);
    assert.match(r.rechazadas[1].motivo, /mayor que 0/);
  });

  test('descarta duplicados dentro del propio archivo, dejando una', () => {
    const texto = paquete([
      s('2020-01-01', 'Go', 30),
      s('2020-01-01', 'Go', 30),
      s('2020-01-02', 'Rust', 45),
    ]);
    const r = d.analizarPaquete(texto);
    assert.equal(r.validas.length, 2);
    assert.equal(r.duplicadas.length, 1);
  });

  test('descarta lo que ya existe, sin borrarlo', () => {
    const existentes = [s('2020-01-01', 'Go', 30)];
    const texto = paquete([s('2020-01-01', 'Go', 30), s('2020-01-02', 'Rust', 45)]);
    const r = d.analizarPaquete(texto, existentes);
    assert.equal(r.validas.length, 1);
    assert.equal(r.validas[0].fecha, '2020-01-02');
    assert.equal(r.duplicadas.length, 1);
    assert.equal(existentes.length, 1);
  });

  test('el mismo archivo importado dos veces no duplica nada la segunda', () => {
    const texto = paquete([s('2020-01-01', 'Go', 30)]);
    const existentes = [...d.analizarPaquete(texto).validas];
    const segunda = d.analizarPaquete(texto, existentes);
    assert.equal(segunda.validas.length, 0);
    assert.equal(segunda.duplicadas.length, 1);
  });

  test('el mismo día con distinta materia o minutos no es duplicado', () => {
    const texto = paquete([
      s('2020-01-01', 'Go', 30),
      s('2020-01-01', 'Rust', 30),
      s('2020-01-01', 'Go', 60),
    ]);
    assert.equal(d.analizarPaquete(texto).validas.length, 3);
  });

  test('un paquete vacío es válido y no da error', () => {
    const r = d.analizarPaquete(paquete([]));
    assert.equal(r.error, null);
    assert.deepEqual(r.validas, []);
  });
});

describe('analizarPaquete — tipos y normalización', () => {
  const AHORA = 1000;
  const buena = () => s('2020-01-05', 'Rust', 20);
  const analizar = (sesiones, existentes = []) =>
    d.analizarPaquete(JSON.stringify({ version: 1, sesiones }), existentes, AHORA);

  test('materia numérica no lanza, se rechaza y las demás entran', () => {
    const r = analizar([{ ...s('2020-01-01'), materia: 42 }, buena()]);
    assert.equal(r.rechazadas.length, 1);
    assert.match(r.rechazadas[0].motivo, /materia debe ser un texto/);
    assert.equal(r.validas.length, 1);
  });

  test('materia null u objeto no lanza y se rechaza', () => {
    const r = analizar([
      { ...s('2020-01-01'), materia: null },
      { ...s('2020-01-02'), materia: {} },
      buena(),
    ]);
    assert.equal(r.rechazadas.length, 2);
    for (const x of r.rechazadas) assert.match(x.motivo, /materia debe ser un texto/);
    assert.equal(r.validas.length, 1);
  });

  test('fecha numérica o array no lanza y se rechaza', () => {
    const r = analizar([
      { ...s('2020-01-01'), fecha: 20200101 },
      { ...s('2020-01-01'), fecha: ['2020-01-01'] },
    ]);
    assert.equal(r.rechazadas.length, 2);
    for (const x of r.rechazadas) assert.match(x.motivo, /fecha debe ser un texto/);
  });

  test('minutos como texto se rechaza y el total sigue siendo número', () => {
    const r = analizar([{ ...s('2020-01-01'), minutos: '30' }, buena()]);
    assert.equal(r.rechazadas.length, 1);
    assert.match(r.rechazadas[0].motivo, /minutos deben ser un número/);
    assert.equal(typeof d.calcularMinutosTotales(r.validas), 'number');
  });

  test('minutos booleano se rechaza', () => {
    const r = analizar([{ ...s('2020-01-01'), minutos: true }]);
    assert.equal(r.rechazadas.length, 1);
    assert.match(r.rechazadas[0].motivo, /minutos deben ser un número/);
  });

  test('un objeto vacío acumula los tres motivos en orden', () => {
    const r = analizar([{}]);
    assert.equal(
      r.rechazadas[0].motivo,
      'La fecha debe ser un texto con formato YYYY-MM-DD. La materia debe ser un texto. Los minutos deben ser un número.',
    );
  });

  test('una fecha inexistente se rechaza y el 29 de febrero bisiesto entra', () => {
    const r = analizar([
      { ...s('2020-01-01'), fecha: '2020-02-30' },
      { ...s('2024-02-29') },
    ]);
    assert.equal(r.rechazadas.length, 1);
    assert.match(r.rechazadas[0].motivo, /no existe/);
    assert.equal(r.validas.length, 1);
    assert.equal(r.validas[0].fecha, '2024-02-29');
  });

  test('los campos extra se descartan', () => {
    const r = analizar([{ ...buena(), extra: 'x', otro: 1 }]);
    assert.deepEqual(Object.keys(r.validas[0]).sort(), ['creadaEn', 'fecha', 'id', 'materia', 'minutos']);
  });

  test('la materia se recorta y detecta duplicados contra existentes', () => {
    const r = analizar([{ ...s('2020-01-01', '  Go  ', 30) }]);
    assert.equal(r.validas[0].materia, 'Go');
    const r2 = analizar([{ ...s('2020-01-01', '  Go  ', 30) }], [s('2020-01-01', 'Go', 30)]);
    assert.equal(r2.validas.length, 0);
    assert.equal(r2.duplicadas.length, 1);
  });

  test('un id de texto y un creadaEn numérico válidos se conservan', () => {
    const r = analizar([{ ...buena(), id: 'mio', creadaEn: 55 }]);
    assert.equal(r.validas[0].id, 'mio');
    assert.equal(r.validas[0].creadaEn, 55);
  });

  test('sin id, id vacío o id numérico se genera uno con su índice', () => {
    const sinId = { ...s('2020-01-01') };
    delete sinId.id;
    const r = analizar([sinId, { ...s('2020-01-02'), id: '' }, { ...s('2020-01-03'), id: 7 }]);
    assert.deepEqual(r.validas.map((x) => x.id), ['importada-1000-0', 'importada-1000-1', 'importada-1000-2']);
  });

  test('creadaEn ausente, texto o null se sustituye por ahora', () => {
    const sinCreada = { ...s('2020-01-01') };
    delete sinCreada.creadaEn;
    const r = analizar([
      sinCreada,
      { ...s('2020-01-02'), creadaEn: 'ayer' },
      { ...s('2020-01-03'), creadaEn: null },
    ]);
    assert.deepEqual(r.validas.map((x) => x.creadaEn), [1000, 1000, 1000]);
  });

  test('un id ya existente se regenera y existentes no cambia', () => {
    const existentes = [{ id: 'x1', fecha: '2019-01-01', materia: 'A', minutos: 5, creadaEn: 0 }];
    const copia = JSON.parse(JSON.stringify(existentes));
    const r = analizar([{ ...s('2020-01-01'), id: 'x1' }], existentes);
    assert.equal(r.validas.length, 1);
    assert.notEqual(r.validas[0].id, 'x1');
    assert.deepEqual(existentes, copia);
  });

  test('el mismo id dos veces en el archivo: entran ambas, la segunda con id generado', () => {
    const r = analizar([
      { ...s('2020-01-01'), id: 'dup' },
      { ...s('2020-01-02'), id: 'dup' },
    ]);
    assert.equal(r.validas.length, 2);
    assert.equal(r.validas[0].id, 'dup');
    assert.equal(r.validas[1].id, 'importada-1000-1');
  });

  test('una inválida por tipo no impide las demás y no hay error global', () => {
    const r = analizar([{ ...s('2020-01-01'), materia: 1 }, buena(), s('2020-01-06', 'Go', 10)]);
    assert.equal(r.error, null);
    assert.equal(r.rechazadas.length, 1);
    assert.equal(r.validas.length, 2);
  });

  test('sin pasar ahora, creadaEn generado está entre antes y después', () => {
    const sinCreada = { ...buena() };
    delete sinCreada.creadaEn;
    const antes = Date.now();
    const r = d.analizarPaquete(JSON.stringify({ version: 1, sesiones: [sinCreada] }));
    const despues = Date.now();
    assert.ok(r.validas[0].creadaEn >= antes && r.validas[0].creadaEn <= despues);
  });

  test('claveSesion y analizarPaquete toleran null o valores inválidos en existentes sin lanzar (H5)', () => {
    assert.equal(d.claveSesion(null), '');
    assert.equal(d.claveSesion(undefined), '');
    const r = analizar([buena()], [null, undefined, 42, s('2020-01-01', 'Go', 30)]);
    assert.equal(r.error, null);
    assert.equal(r.validas.length, 1);
  });
});

