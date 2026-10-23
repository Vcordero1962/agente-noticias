/*
 * Tests del dominio de candidatas (candidatas.js), Spec 003 · T1.
 *   node --test
 * Sin red: aquí solo se comprueba que la verificación CONSTE, no se hace.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EXPORTADAS_CANDIDATAS = [
  'validarCandidata', 'filtrarValidas', 'contarFuentes',
  'ordenarCandidatas', 'seleccionarParaInforme',
  'formatearFechaLocal', 'adaptarParaBoletin', 'resumenSeleccion',
  'interpretarOrdenVoz', 'construirConsultaGdelt', 'mapearArticulosGdelt', 'mapearItemsRss',
  'instanteDesdeGdelt', 'instanteDesdeRss',
  'estadoVisible', 'derivarDeAlmacenMovil', 'marcarAbiertaPorUsuaria',
  'VENTANAS_FECHA', 'clasificarPorFecha', 'filtrarPorVentana', 'construirUrlGdelt', 'textoFechaPublicacion', 'textoBarraSeleccion',
];

// Mismo patrón que diario.test.js: script plano evaluado con new Function.
function cargarCandidatas() {
  const ruta = path.join(__dirname, '..', 'js', 'candidatas.js');
  const codigo = fs.readFileSync(ruta, 'utf8');
  return new Function(`${codigo}\nreturn { ${EXPORTADAS_CANDIDATAS.join(', ')} };`)();
}

const c = cargarCandidatas();

// Candidata de ejemplo ya verificada. Dominio ficticio reservado (example.org).
const cand = (extra = {}) => ({
  titular: 'Titular de prueba',
  medio: 'Medio de Prueba',
  url: 'https://example.org/noticia-1',
  fechaPublicacion: '2026-10-05',
  extracto: 'Texto tomado de la página.',
  verificacion: {
    estado: 'ok',
    urlFinal: 'https://example.org/noticia-1',
    tituloPagina: 'Titular de prueba',
    comprobadaEn: 1790000000000,
  },
  ...extra,
});

describe('validarCandidata', () => {
  test('acepta una candidata verificada y la normaliza', () => {
    const r = c.validarCandidata(cand({ titular: '  Titular  ', medio: ' Medio ' }));
    assert.equal(r.valida, true);
    assert.deepEqual(r.motivos, []);
    assert.equal(r.limpia.titular, 'Titular');
    assert.equal(r.limpia.medio, 'Medio');
    assert.equal(r.limpia.id, 'https://example.org/noticia-1');
  });

  test('un id propio se conserva; sin extracto queda vacío', () => {
    const r = c.validarCandidata(cand({ id: 'abc', extracto: undefined }));
    assert.equal(r.limpia.id, 'abc');
    assert.equal(r.limpia.extracto, '');
  });

  test('rechaza sin medio', () => {
    const r = c.validarCandidata(cand({ medio: '  ' }));
    assert.equal(r.valida, false);
    assert.match(r.motivos.join(' '), /medio/i);
  });

  test('rechaza sin url o con url que no es http(s)', () => {
    assert.equal(c.validarCandidata(cand({ url: '' })).valida, false);
    assert.equal(c.validarCandidata(cand({ url: 'ftp://example.org/x' })).valida, false);
    assert.equal(c.validarCandidata(cand({ url: 'example.org/x' })).valida, false);
  });

  test('rechaza sin verificación: nunca se acepta por fe', () => {
    const sinVerif = cand();
    delete sinVerif.verificacion;
    const r = c.validarCandidata(sinVerif);
    assert.equal(r.valida, false);
    assert.match(r.motivos.join(' '), /verificaci/i);
  });

  test('rechaza cualquier estado de verificación que no sea "ok" ni "no-comprobado"', () => {
    for (const estado of ['error', 'timeout', 'sin-confirmar', 'OK', 'no comprobado', '', undefined, null]) {
      const r = c.validarCandidata(cand({ verificacion: { ...cand().verificacion, estado } }));
      assert.equal(r.valida, false, `estado ${estado} debería rechazarse`);
    }
  });

  test('acepta los dos estados honestos: "ok" (verificada) y "no-comprobado"', () => {
    for (const estado of ['ok', 'no-comprobado']) {
      const r = c.validarCandidata(cand({ verificacion: { ...cand().verificacion, estado } }));
      assert.equal(r.valida, true, `estado ${estado} debería aceptarse`);
      assert.equal(r.limpia.verificacion.estado, estado);
    }
  });

  test('conserva abiertaPorUsuariaEn si es una fecha válida y lo rechaza si no lo es', () => {
    const r = c.validarCandidata(cand({ abiertaPorUsuariaEn: '2026-10-23' }));
    assert.equal(r.limpia.abiertaPorUsuariaEn, '2026-10-23');
    assert.equal(c.validarCandidata(cand()).limpia.abiertaPorUsuariaEn, undefined);
    assert.equal(c.validarCandidata(cand({ abiertaPorUsuariaEn: '2026-02-31' })).valida, false);
  });

  test('rechaza verificación sin urlFinal, sin título de página o sin fecha de comprobación', () => {
    const v = cand().verificacion;
    assert.equal(c.validarCandidata(cand({ verificacion: { ...v, urlFinal: 'x' } })).valida, false);
    assert.equal(c.validarCandidata(cand({ verificacion: { ...v, tituloPagina: ' ' } })).valida, false);
    assert.equal(c.validarCandidata(cand({ verificacion: { ...v, comprobadaEn: 'ayer' } })).valida, false);
  });

  test('la fecha de publicación es opcional, pero si viene debe existir', () => {
    const sinFecha = cand();
    delete sinFecha.fechaPublicacion;
    assert.equal(c.validarCandidata(sinFecha).valida, true);
    assert.equal(c.validarCandidata(cand({ fechaPublicacion: '2026-02-31' })).valida, false);
    assert.equal(c.validarCandidata(cand({ fechaPublicacion: 'hoy' })).valida, false);
    assert.equal(c.validarCandidata(cand({ fechaPublicacion: '2028-02-29' })).valida, true);
  });

  test('null, texto o array no lanzan: se rechazan con motivo', () => {
    for (const malo of [null, undefined, 'texto', 42, []]) {
      const r = c.validarCandidata(malo);
      assert.equal(r.valida, false);
      assert.ok(r.motivos.length > 0);
    }
  });

  test('un objeto vacío acumula todos los motivos, no solo el primero', () => {
    const r = c.validarCandidata({});
    assert.equal(r.valida, false);
    assert.ok(r.motivos.length >= 4);
  });

  test('no modifica la candidata de entrada', () => {
    const entrada = cand({ titular: '  x  ' });
    const copia = JSON.parse(JSON.stringify(entrada));
    c.validarCandidata(entrada);
    assert.deepEqual(entrada, copia);
  });
});

describe('filtrarValidas', () => {
  test('separa válidas y descartadas, con el motivo de cada descarte', () => {
    const lote = [cand(), cand({ medio: '' }), cand({ url: 'https://example.org/n2' })];
    const r = c.filtrarValidas(lote);
    assert.equal(r.validas.length, 2);
    assert.equal(r.descartadas.length, 1);
    assert.ok(r.descartadas[0].motivos.length > 0);
  });

  test('lote vacío o que no es array: cero validas, sin lanzar', () => {
    assert.deepEqual(c.filtrarValidas([]), { validas: [], descartadas: [] });
    assert.deepEqual(c.filtrarValidas(null), { validas: [], descartadas: [] });
  });
});

describe('contarFuentes', () => {
  test('cuenta medios distintos sin distinguir mayúsculas ni espacios', () => {
    const r = c.contarFuentes(cand({
      medio: 'Medio A',
      tambienEn: [{ medio: ' medio a ', url: 'https://example.org/z' }, { medio: 'Medio B', url: 'https://example.org/y' }],
    }));
    assert.equal(r, 2);
  });

  test('sin tambienEn cuenta 1; algo que no es candidata cuenta 0', () => {
    assert.equal(c.contarFuentes(cand()), 1);
    assert.equal(c.contarFuentes(null), 0);
  });
});

describe('ordenarCandidatas', () => {
  const a = cand({ id: 'a', fechaPublicacion: '2026-10-01' });
  const b = cand({ id: 'b', fechaPublicacion: '2026-10-05' });
  const m = cand({
    id: 'm', fechaPublicacion: '2026-09-20',
    tambienEn: [{ medio: 'Otro', url: 'https://example.org/o' }],
  });

  test('RF1: la fecha manda; más reciente con 1 medio va antes que más antigua con 2', () => {
    assert.deepEqual(c.ordenarCandidatas([a, b, m]).map((x) => x.id), ['b', 'a', 'm']);
    const ids = c.ordenarCandidatas([m, b]).map((x) => x.id);
    assert.deepEqual(ids, ['b', 'm']);
  });

  test('RF1: con la misma fecha gana la de más medios', () => {
    const uno = cand({ id: 'uno', fechaPublicacion: '2026-10-05' });
    const dos = cand({
      id: 'dos', fechaPublicacion: '2026-10-05',
      tambienEn: [{ medio: 'Otro', url: 'https://example.org/o' }],
    });
    assert.deepEqual(c.ordenarCandidatas([uno, dos]).map((x) => x.id), ['dos', 'uno']);
  });

  test('RF1: la que no tiene fecha va última, aunque tenga más medios', () => {
    const sin = cand({ id: 'sin', tambienEn: [{ medio: 'Otro', url: 'https://example.org/o' }] });
    delete sin.fechaPublicacion;
    assert.deepEqual(c.ordenarCandidatas([sin, a, m]).map((x) => x.id), ['a', 'm', 'sin']);
  });

  test('sin señales, ordena por fecha (más reciente primero)', () => {
    assert.deepEqual(c.ordenarCandidatas([a, b]).map((x) => x.id), ['b', 'a']);
  });

  test('una sin fecha va al final y el empate conserva el orden de entrada', () => {
    const sinFecha = cand({ id: 's' });
    delete sinFecha.fechaPublicacion;
    const x = cand({ id: 'x', fechaPublicacion: '2026-10-05' });
    const y = cand({ id: 'y', fechaPublicacion: '2026-10-05' });
    assert.deepEqual(c.ordenarCandidatas([sinFecha, x, y]).map((r) => r.id), ['x', 'y', 's']);
  });

  test('no muta el array de entrada ni añade campos inventados', () => {
    const entrada = [a, b, m];
    const antes = JSON.stringify(entrada);
    const salida = c.ordenarCandidatas(entrada);
    assert.equal(JSON.stringify(entrada), antes);
    assert.notEqual(salida, entrada);
    assert.equal('repercusion' in salida[0], false);
  });

  test('algo que no es array devuelve []', () => {
    assert.deepEqual(c.ordenarCandidatas(null), []);
  });

  test('D-10: mismo día y medios, gana la publicadaEn más reciente; sin instante después', () => {
    const t = new Date(2026, 9, 20, 8, 0).getTime();
    const viejo = cand({ id: 'v', fechaPublicacion: '2026-10-20', publicadaEn: t });
    const nuevo = cand({ id: 'n', fechaPublicacion: '2026-10-20', publicadaEn: t + 3600000 });
    const soloDia = cand({ id: 'd', fechaPublicacion: '2026-10-20' });
    assert.deepEqual(c.ordenarCandidatas([soloDia, viejo, nuevo]).map((x) => x.id), ['n', 'v', 'd']);
  });

  test('D-10: el día más reciente manda sobre publicadaEn de otro día', () => {
    const t = new Date(2026, 9, 20, 8, 0).getTime();
    const hoyDia = cand({ id: 'h', fechaPublicacion: '2026-10-21' });
    const ayer = cand({ id: 'y', fechaPublicacion: '2026-10-20', publicadaEn: t });
    assert.deepEqual(c.ordenarCandidatas([ayer, hoyDia]).map((x) => x.id), ['h', 'y']);
  });
});

describe('clasificarPorFecha (T12)', () => {
  const H = 3600000;
  // "Ahora" local fijo: 2026-10-22 15:00 en la zona de quien ejecuta.
  const ahora = new Date(2026, 9, 22, 15, 0, 0).getTime();
  const dia = (anio, mes, d) => `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const conInstante = (id, ms) => cand({ id, publicadaEn: ms, fechaPublicacion: c.formatearFechaLocal(ms) });
  const soloDia = (id, f) => cand({ id, fechaPublicacion: f });
  const sinFecha = (id) => { const x = cand({ id }); delete x.fechaPublicacion; return x; };
  const ids = (l) => l.map((x) => x.id);

  test('VENTANAS_FECHA lista hoy, 24h, 7d y todas', () => {
    assert.deepEqual([...c.VENTANAS_FECHA], ['hoy', '24h', '7d', 'todas']);
  });

  test('24 h exactas entra; 23h59 entra; 24h01 queda fuera', () => {
    const exacta = conInstante('e', ahora - 24 * H);
    const casi = conInstante('c', ahora - 24 * H + 60000);
    const pasada = conInstante('p', ahora - 24 * H - 60000);
    const r = c.clasificarPorFecha([exacta, casi, pasada], '24h', ahora);
    assert.deepEqual(ids(r.dentro).sort(), ['c', 'e']);
    assert.deepEqual(ids(r.fuera), ['p']);
    assert.equal(r.dentro.some((x) => x.soloDia), false);
  });

  test('hoy con instante: depende del día local, no de las 24 h', () => {
    const estaManana = conInstante('m', new Date(2026, 9, 22, 0, 5).getTime());
    const anoche = conInstante('a', new Date(2026, 9, 21, 23, 55).getTime());
    const r = c.clasificarPorFecha([estaManana, anoche], 'hoy', ahora);
    assert.deepEqual(ids(r.dentro), ['m']);
    assert.deepEqual(ids(r.fuera), ['a']);
  });

  test('7d con instante: hace 7 días exactos entra, 7 días y un minuto no', () => {
    const limite = conInstante('l', ahora - 7 * 24 * H);
    const pasado = conInstante('p', ahora - 7 * 24 * H - 60000);
    const r = c.clasificarPorFecha([limite, pasado], '7d', ahora);
    assert.deepEqual(ids(r.dentro), ['l']);
    assert.deepEqual(ids(r.fuera), ['p']);
  });

  test('solo día: ayer entra en 24h marcada soloDia; anteayer no', () => {
    const ayer = soloDia('y', dia(2026, 10, 21));
    const hoy = soloDia('h', dia(2026, 10, 22));
    const antes = soloDia('a', dia(2026, 10, 20));
    const r = c.clasificarPorFecha([ayer, hoy, antes], '24h', ahora);
    assert.deepEqual(ids(r.dentro), ['y', 'h']);
    assert.equal(r.dentro.every((x) => x.soloDia === true), true);
    assert.deepEqual(ids(r.fuera), ['a']);
    assert.equal(ayer.soloDia, undefined);
  });

  test('solo día en hoy: solo el de hoy; en 7d: día >= hoy-7', () => {
    const hoy = soloDia('h', dia(2026, 10, 22));
    const ayer = soloDia('y', dia(2026, 10, 21));
    const limite = soloDia('l', dia(2026, 10, 15));
    const ocho = soloDia('o', dia(2026, 10, 14));
    assert.deepEqual(ids(c.clasificarPorFecha([hoy, ayer], 'hoy', ahora).dentro), ['h']);
    const r = c.clasificarPorFecha([limite, ocho], '7d', ahora);
    assert.deepEqual(ids(r.dentro), ['l']);
    assert.deepEqual(ids(r.fuera), ['o']);
  });

  test('hace 8 días con solo día queda fuera de 7d', () => {
    const r = c.clasificarPorFecha([soloDia('o', dia(2026, 10, 14))], '7d', ahora);
    assert.equal(r.dentro.length, 0);
    assert.equal(r.fuera.length, 1);
  });

  test('clasificarPorFecha: sin fecha (incluida la futura sin fecha) va a sinFecha, nunca a dentro ni fuera', () => {
    const futura = sinFecha('f');
    for (const v of ['hoy', '24h', '7d', 'todas', 'rara']) {
      const r = c.clasificarPorFecha([futura, sinFecha('s')], v, ahora);
      assert.deepEqual(ids(r.sinFecha), ['f', 's'], v);
      assert.equal(r.dentro.length, 0, v);
      assert.equal(r.fuera.length, 0, v);
    }
  });

  test('todas y ventana desconocida: toda candidata con fecha va a dentro', () => {
    const lista = [conInstante('a', ahora - 400 * 24 * H), soloDia('b', '2020-01-01'), sinFecha('s')];
    for (const v of ['todas', 'inventada', undefined]) {
      const r = c.clasificarPorFecha(lista, v, ahora);
      assert.deepEqual(ids(r.dentro), ['a', 'b']);
      assert.deepEqual(ids(r.sinFecha), ['s']);
      assert.equal(r.fuera.length, 0);
    }
  });

  test('no muta la lista ni las candidatas', () => {
    const lista = [soloDia('y', dia(2026, 10, 21)), conInstante('c', ahora), sinFecha('s')];
    const antes = JSON.stringify(lista);
    const r = c.clasificarPorFecha(lista, '24h', ahora);
    assert.equal(JSON.stringify(lista), antes);
    assert.notEqual(r.dentro[0], lista[0]);
  });

  test('conteos por ventana y sinFecha', () => {
    const lista = [
      conInstante('i1', ahora - 2 * H),
      conInstante('i2', ahora - 30 * H),
      conInstante('i3', ahora - 10 * 24 * H),
      soloDia('d1', dia(2026, 10, 21)),
      sinFecha('s1'),
    ];
    const r = c.clasificarPorFecha(lista, '24h', ahora);
    assert.deepEqual(r.conteos, { hoy: 1, '24h': 2, '7d': 3, todas: 4, sinFecha: 1 });
  });

  test('entrada no válida devuelve estructura vacía', () => {
    const r = c.clasificarPorFecha(null, '24h', ahora);
    assert.deepEqual(r.dentro, []);
    assert.deepEqual(r.conteos, { hoy: 0, '24h': 0, '7d': 0, todas: 0, sinFecha: 0 });
  });
});

describe('filtrarPorVentana (RF2, T-R2)', () => {
  const H = 3600000;
  const ahora = new Date(2026, 9, 23, 10).getTime();
  const conInstante = (id, ms) => cand({ id, publicadaEn: ms, fechaPublicacion: c.formatearFechaLocal(ms) });
  const soloDia = (id, f) => cand({ id, fechaPublicacion: f });
  const sinFecha = (id) => { const x = cand({ id }); delete x.fechaPublicacion; return x; };
  const ids = (l) => l.map((x) => x.id);

  test('una noticia de solo día 2026-09-23 no está en visibles en 24h ni 7d', () => {
    const vieja = soloDia('v', '2026-09-23');
    for (const v of ['24h', '7d']) {
      const r = c.filtrarPorVentana([vieja], v, ahora);
      assert.deepEqual(r.visibles, [], v);
      assert.deepEqual(ids(r.fuera), ['v'], v);
    }
  });

  test('sin fecha: ausente de visibles en hoy/24h/7d; presente y última en todas', () => {
    const lista = [sinFecha('s'), conInstante('a', ahora - H), soloDia('b', '2026-10-22')];
    for (const v of ['hoy', '24h', '7d']) {
      const r = c.filtrarPorVentana(lista, v, ahora);
      assert.equal(ids(r.visibles).includes('s'), false, v);
      assert.deepEqual(ids(r.sinFecha), ['s'], v);
    }
    for (const v of ['todas', 'rara', undefined]) {
      const r = c.filtrarPorVentana(lista, v, ahora);
      assert.deepEqual(ids(r.visibles), ['a', 'b', 's'], String(v));
      assert.deepEqual(r.fuera, [], String(v));
    }
  });

  test('conteos son números coherentes', () => {
    const lista = [conInstante('a', ahora - H), conInstante('o', ahora - 30 * 24 * H), sinFecha('s')];
    assert.deepEqual(c.filtrarPorVentana(lista, '24h', ahora).conteos, { visibles: 1, fuera: 1, sinFecha: 1 });
    assert.deepEqual(c.filtrarPorVentana(lista, 'todas', ahora).conteos, { visibles: 3, fuera: 0, sinFecha: 1 });
  });

  test('frontera de 24 h: exacta entra, 24h01 sale', () => {
    const r = c.filtrarPorVentana([conInstante('e', ahora - 24 * H), conInstante('x', ahora - 24 * H - 60000)], '24h', ahora);
    assert.deepEqual(ids(r.visibles), ['e']);
    assert.deepEqual(ids(r.fuera), ['x']);
  });

  test('frontera de 7 días: exacta entra, un minuto más sale', () => {
    const r = c.filtrarPorVentana([conInstante('e', ahora - 168 * H), conInstante('x', ahora - 168 * H - 60000)], '7d', ahora);
    assert.deepEqual(ids(r.visibles), ['e']);
    assert.deepEqual(ids(r.fuera), ['x']);
  });

  test('frontera de medianoche local en hoy', () => {
    const despues = conInstante('d', new Date(2026, 9, 23, 0, 0, 1).getTime());
    const antes = conInstante('a', new Date(2026, 9, 22, 23, 59, 59).getTime());
    const r = c.filtrarPorVentana([despues, antes], 'hoy', ahora);
    assert.deepEqual(ids(r.visibles), ['d']);
    assert.deepEqual(ids(r.fuera), ['a']);
  });

  test('no muta la entrada', () => {
    const lista = [soloDia('b', '2026-10-22'), sinFecha('s')];
    const copia = JSON.stringify(lista);
    c.filtrarPorVentana(lista, 'todas', ahora);
    c.filtrarPorVentana(lista, '24h', ahora);
    assert.equal(JSON.stringify(lista), copia);
    assert.equal(lista.length, 2);
  });

  test('null o no-array devuelve estructura vacía', () => {
    for (const x of [null, undefined, 'x', {}]) {
      const r = c.filtrarPorVentana(x, '24h', ahora);
      assert.deepEqual(r, { visibles: [], fuera: [], sinFecha: [], conteos: { visibles: 0, fuera: 0, sinFecha: 0 } });
    }
  });
});

describe('seleccionarParaInforme', () => {
  const l1 = cand({ id: '1' });
  const l2 = cand({ id: '2', url: 'https://example.org/n2' });
  const l3 = cand({ id: '3', url: 'https://example.org/n3' });

  test('devuelve solo las marcadas, en el orden de la lista', () => {
    assert.deepEqual(c.seleccionarParaInforme([l1, l2, l3], ['3', '1']).map((x) => x.id), ['1', '3']);
  });

  test('ignora ids que no existen y no duplica', () => {
    assert.deepEqual(c.seleccionarParaInforme([l1, l2], ['2', '2', 'zzz']).map((x) => x.id), ['2']);
  });

  test('sin marcadas, o sin lista, devuelve []', () => {
    assert.deepEqual(c.seleccionarParaInforme([l1, l2], []), []);
    assert.deepEqual(c.seleccionarParaInforme(null, ['1']), []);
    assert.deepEqual(c.seleccionarParaInforme([l1], null), []);
  });

  test('una candidata SIN verificación nunca llega al informe, aunque esté marcada', () => {
    const sinVerif = cand({ id: 'sv' });
    delete sinVerif.verificacion;
    const r = c.seleccionarParaInforme([l1, sinVerif], ['1', 'sv']);
    assert.deepEqual(r.map((x) => x.id), ['1']);
  });

  test('devuelve las candidatas normalizadas', () => {
    const r = c.seleccionarParaInforme([cand({ id: '1', titular: '  Con espacios  ' })], ['1']);
    assert.equal(r[0].titular, 'Con espacios');
  });
});

describe('adaptarParaBoletin (T4 · RF-1.5 y RF-3.2)', () => {
  test('formatearFechaLocal convierte timestamp en YYYY-MM-DD local y rechaza valores inválidos', () => {
    const fechaLocal = new Date(2026, 9, 18, 12, 0, 0).getTime(); // 18 oct 2026 local
    assert.equal(c.formatearFechaLocal(fechaLocal), '2026-10-18');
    assert.equal(c.formatearFechaLocal('no-es-numero'), '');
    assert.equal(c.formatearFechaLocal(NaN), '');
  });

  test('adapta candidatas verificadas incluyendo medio ("Según X"), urlFinal y fecha de comprobación', () => {
    const ts = new Date(2026, 9, 18, 9, 30, 0).getTime();
    const lista = [
      cand({
        id: '1',
        titular: 'Cumbre bilateral en El Cairo',
        medio: 'Ahram Online',
        url: 'https://ahram.org.eg/corto',
        extracto: 'Ambos ministros firmaron el acuerdo comercial.',
        verificacion: {
          estado: 'ok',
          urlFinal: 'https://english.ahram.org.eg/News/12345.aspx',
          tituloPagina: 'Cumbre bilateral en El Cairo',
          comprobadaEn: ts,
        },
      }),
    ];

    const adaptadas = c.adaptarParaBoletin(lista);
    assert.equal(adaptadas.length, 1);
    assert.equal(adaptadas[0].titular, 'Cumbre bilateral en El Cairo');
    assert.equal(adaptadas[0].url, 'https://english.ahram.org.eg/News/12345.aspx');
    assert.match(adaptadas[0].categoria, /Según Ahram Online/i);
    assert.match(adaptadas[0].categoria, /2026-10-18/);
    assert.match(adaptadas[0].sintesis, /Según Ahram Online/);
    assert.match(adaptadas[0].sintesis, /Ambos ministros firmaron el acuerdo comercial\./);
  });

  test('si el extracto está vacío, indica "Sin extracto confirmado" y nunca inventa texto', () => {
    const ts = new Date(2026, 9, 18, 9, 30, 0).getTime();
    const adaptadas = c.adaptarParaBoletin([
      cand({
        extracto: '',
        medio: 'Reuters',
        verificacion: {
          estado: 'ok',
          urlFinal: 'https://reuters.com/egipto',
          tituloPagina: 'Titular de prueba',
          comprobadaEn: ts,
        },
      }),
    ]);

    assert.equal(adaptadas.length, 1);
    assert.match(adaptadas[0].sintesis, /Sin extracto confirmado/i);
    assert.match(adaptadas[0].sintesis, /2026-10-18/);
  });

  test('descarta cualquier candidata sin verificación válida antes de pasarla al boletín', () => {
    const sinVerif = cand({ id: 'sv' });
    delete sinVerif.verificacion;
    const adaptadas = c.adaptarParaBoletin([cand({ id: 'ok1' }), sinVerif]);
    assert.equal(adaptadas.length, 1);
  });

  test('indica "publicada AAAA-MM-DD" cuando hay fecha de publicación (RF-5.4)', () => {
    const [n] = c.adaptarParaBoletin([cand({ fechaPublicacion: '2026-10-05' })]);
    assert.match(n.categoria, /publicada 2026-10-05/);
    assert.doesNotMatch(n.categoria, /sin fecha de publicación/);
  });

  test('indica "sin fecha de publicación" cuando no hay fecha y no inventa ninguna (RF-5.4)', () => {
    const sinFecha = cand({ id: 'sf' });
    delete sinFecha.fechaPublicacion;
    const [n] = c.adaptarParaBoletin([sinFecha]);
    assert.match(n.categoria, /sin fecha de publicación/);
    assert.doesNotMatch(n.categoria, /publicada \d/);
  });
});

describe('resumenSeleccion (T8 · RF-3.4)', () => {
  const lista = [cand({ id: 'a' }), cand({ id: 'b' }), cand({ id: 'c' })];

  test('cuenta las marcadas válidas y ninguna oculta si todas son visibles', () => {
    assert.deepEqual(c.resumenSeleccion(lista, ['a', 'b'], ['a', 'b', 'c']), { total: 2, ocultas: 0 });
  });

  test('las marcadas que no están en los ids visibles cuentan como ocultas', () => {
    assert.deepEqual(c.resumenSeleccion(lista, ['a', 'b', 'c'], ['a']), { total: 3, ocultas: 2 });
  });

  test('ignora ids inexistentes y duplicados', () => {
    assert.deepEqual(c.resumenSeleccion(lista, ['a', 'zzz', 'a'], ['a']), { total: 1, ocultas: 0 });
  });

  test('ignora candidatas no verificadas aunque estén marcadas', () => {
    const sinVerif = cand({ id: 'sv' });
    delete sinVerif.verificacion;
    assert.deepEqual(c.resumenSeleccion([...lista, sinVerif], ['a', 'sv'], []), { total: 1, ocultas: 1 });
  });

  test('entradas no válidas devuelven cero sin lanzar', () => {
    assert.deepEqual(c.resumenSeleccion(null, ['a'], []), { total: 0, ocultas: 0 });
    assert.deepEqual(c.resumenSeleccion(lista, null, null), { total: 0, ocultas: 0 });
    assert.deepEqual(c.resumenSeleccion(lista, ['a'], undefined), { total: 1, ocultas: 1 });
  });
});

describe('interpretarOrdenVoz (T5 · RF-3.3)', () => {
  test('reconoce "informe de la 1, la 3 y la 4" y extrae [1, 3, 4]', () => {
    const res = c.interpretarOrdenVoz('informe de la 1, la 3 y la 4');
    assert.equal(res.tipo, 'seleccionar_candidatas');
    assert.deepEqual(res.numeros, [1, 3, 4]);
  });

  test('reconoce números dichos con palabras ("informe de la uno, la tres y la cuatro")', () => {
    const res = c.interpretarOrdenVoz('Hazme el informe de la uno, la tres y la cuatro');
    assert.equal(res.tipo, 'seleccionar_candidatas');
    assert.deepEqual(res.numeros, [1, 3, 4]);
  });

  test('reconoce ordinales y variantes ("marca la primera y la tercera", "la 2 y la 5")', () => {
    assert.deepEqual(
      c.interpretarOrdenVoz('marca la primera y la tercera').numeros,
      [1, 3]
    );
    assert.deepEqual(
      c.interpretarOrdenVoz('la 2 y la 5').numeros,
      [2, 5]
    );
  });

  test('elimina duplicados manteniendo el orden de mención', () => {
    const res = c.interpretarOrdenVoz('selecciona la 3, la 1 y la 3');
    assert.equal(res.tipo, 'seleccionar_candidatas');
    assert.deepEqual(res.numeros, [3, 1]);
  });

  test('lo dictado que no sea orden devuelve tipo "ninguna" para no escribirse como noticia', () => {
    for (const frase of [
      'El canal de Suez registró un aumento del tráfico marítimo en 2026',
      'Reunión del ministro de exteriores en El Cairo',
      '',
      null,
    ]) {
      const res = c.interpretarOrdenVoz(frase);
      assert.equal(res.tipo, 'ninguna');
      assert.deepEqual(res.numeros, []);
    }
  });
});

describe('construirConsultaGdelt y mapearArticulosGdelt (Buscador directo móvil y PC)', () => {
  const AHORA_POSTERIOR = new Date(2026, 9, 20, 12).getTime();

  test('construirConsultaGdelt limpia tildes, no inyecta temas y añade filtro de idioma', () => {
    assert.equal(c.construirConsultaGdelt('Economía y Comercio Egipcio'),
      'economia comercio egipcio (sourcelang:spanish OR sourcelang:english)');
    for (const t of ['', 'Cumbre de la ONU', 'economía de Brasil']) {
      assert.doesNotMatch(c.construirConsultaGdelt(t), /egypt|\(egipto/i);
    }
    assert.equal(/[áéíóú]/i.test(c.construirConsultaGdelt('Política económica')), false);
  });

  test('mapearArticulosGdelt convierte artículos reales de GDELT en candidatas válidas sin inventar extracto', () => {
    const articulos = [
      {
        title: '  Cumbre económica en El Cairo impulsa comercio  ',
        url: 'https://es.euronews.com/2026/10/15/cumbre-el-cairo',
        domain: 'es.euronews.com',
        seendate: '20261015T083000Z',
      },
      {
        title: '   ', // inválido: sin título
        url: 'https://malo.com',
      },
    ];

    const mapeadas = c.mapearArticulosGdelt(articulos, AHORA_POSTERIOR);
    assert.equal(mapeadas.length, 1);
    assert.equal(mapeadas[0].titular, 'Cumbre económica en El Cairo impulsa comercio');
    assert.equal(mapeadas[0].medio, 'es.euronews.com');
    assert.equal(mapeadas[0].fechaPublicacion, '2026-10-15');
    assert.equal(mapeadas[0].extracto, '');
    assert.equal(c.validarCandidata(mapeadas[0]).valida, true);
    assert.equal(mapeadas[0].verificacion.estado, 'no-comprobado');
  });

  test('mapearItemsRss filtra por consulta, limpia HTML del extracto literal y genera candidatas válidas', () => {
    const items = [
      {
        title: 'Egipto inaugura nuevo corredor energético en el Canal de Suez',
        link: 'https://www.bbc.com/mundo/articles/c12345',
        pubDate: '2026-10-16 14:20:00',
        description: '<p>El gobierno de <b>Egipto</b> presentó el proyecto marítimo.</p>',
      },
      {
        title: 'Torneo de tenis en Madrid',
        link: 'https://www.bbc.com/mundo/articles/c99999',
        pubDate: '2026-10-16 15:00:00',
        description: '<p>Deportes en Europa.</p>',
      },
    ];

    const mapeadas = c.mapearItemsRss(items, 'BBC Mundo', 'Egipto Suez', AHORA_POSTERIOR);
    assert.equal(mapeadas.length, 1);
    assert.equal(mapeadas[0].medio, 'BBC Mundo');
    assert.equal(mapeadas[0].fechaPublicacion, '2026-10-16');
    assert.equal(mapeadas[0].extracto, 'El gobierno de Egipto presentó el proyecto marítimo.');
    assert.equal(c.validarCandidata(mapeadas[0]).valida, true);
    assert.equal(mapeadas[0].verificacion.estado, 'no-comprobado');
  });

  test('ningún mapeador emite estado "ok": nadie ha abierto la URL', () => {
    const g = c.mapearArticulosGdelt([{ title: 'T', url: 'https://example.org/g', domain: 'example.org' }], AHORA_POSTERIOR);
    const r = c.mapearItemsRss([{ title: 'T', link: 'https://example.org/r', description: '' }], 'Medio', '', AHORA_POSTERIOR);
    assert.equal(g.length + r.length, 2);
    for (const m of [...g, ...r]) assert.notEqual(m.verificacion.estado, 'ok');
  });
});

describe('Estado honesto de las candidatas (T-IA-1, H-A)', () => {
  const noComp = (extra = {}) => cand({ verificacion: { ...cand().verificacion, estado: 'no-comprobado' }, ...extra });

  test('estadoVisible distingue los tres estados: verificada, no comprobado y abierta por ti', () => {
    assert.equal(c.estadoVisible(cand()), 'verificada');
    assert.equal(c.estadoVisible(noComp()), 'no-comprobado');
    assert.equal(c.estadoVisible(noComp({ abiertaPorUsuariaEn: '2026-10-23' })), 'abierta-por-usuaria');
    assert.equal(c.estadoVisible(null), 'no-comprobado');
  });

  test('derivarDeAlmacenMovil muestra como no comprobado lo guardado con "ok", sin mutar el original', () => {
    const guardada = cand();
    const d = c.derivarDeAlmacenMovil(guardada);
    assert.equal(d.verificacion.estado, 'no-comprobado');
    assert.equal(guardada.verificacion.estado, 'ok');
    assert.equal(c.estadoVisible(d), 'no-comprobado');
    assert.equal(c.derivarDeAlmacenMovil(noComp()).verificacion.estado, 'no-comprobado');
    assert.equal(c.derivarDeAlmacenMovil(null), null);
  });

  test('marcarAbiertaPorUsuaria añade el campo solo a la candidata con ese id, sin tocar el resto', () => {
    const lista = [cand({ id: 'a' }), cand({ id: 'b' })];
    const nueva = c.marcarAbiertaPorUsuaria(lista, 'b', '2026-10-23');
    assert.equal(nueva[1].abiertaPorUsuariaEn, '2026-10-23');
    assert.equal(nueva[0].abiertaPorUsuariaEn, undefined);
    assert.equal(nueva[1].verificacion.estado, 'ok');
    assert.equal(lista[1].abiertaPorUsuariaEn, undefined);
    assert.deepEqual(c.marcarAbiertaPorUsuaria(lista, 'b', 'ayer'), lista);
    assert.deepEqual(c.marcarAbiertaPorUsuaria('x', 'b', '2026-10-23'), []);
  });

  test('el boletín no dice «comprobado» de una candidata no comprobada', () => {
    const [n] = c.adaptarParaBoletin([noComp({ extracto: '' })]);
    assert.match(n.categoria, /sin comprobar/i);
    assert.doesNotMatch(n.categoria, /comprobado el/);
    assert.doesNotMatch(n.sintesis, /enlace comprobado/i);
    const [v] = c.adaptarParaBoletin([cand()]);
    assert.match(v.categoria, /comprobado el/);
  });

  test('una no comprobada abierta por la usuaria lo dice en el boletín', () => {
    const [n] = c.adaptarParaBoletin([noComp({ abiertaPorUsuariaEn: '2026-10-23' })]);
    assert.match(n.categoria, /abierta por la usuaria el 2026-10-23/);
  });

  test('seleccionarParaInforme y resumenSeleccion cuentan también las no comprobadas válidas', () => {
    const lista = [noComp({ id: 'n1' }), cand({ id: 'v1' })];
    assert.equal(c.seleccionarParaInforme(lista, ['n1', 'v1']).length, 2);
    assert.deepEqual(c.resumenSeleccion(lista, ['n1', 'v1'], ['v1']), { total: 2, ocultas: 1 });
  });
});

describe('Fecha fiable (T11 · RF-5.1, D-1, D-2)', () => {
  const AHORA = new Date(2026, 9, 20, 12).getTime();
  const art = (seendate) => [{ title: 'Titular', url: 'https://example.org/a', domain: 'example.org', seendate }];
  const rss = (pubDate) => [{ title: 'Titular', link: 'https://example.org/b', pubDate, description: '' }];
  // seendate GDELT (UTC) para un instante dado.
  const aSeendate = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const diaLocal = (ms) => {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  test('instanteDesdeGdelt convierte seendate (UTC) a ms y rechaza lo inválido', () => {
    assert.equal(c.instanteDesdeGdelt('20261015T020000Z'), Date.UTC(2026, 9, 15, 2, 0, 0));
    for (const malo of ['', '20261015', '20261315T020000Z', '20261015T250000Z', null, undefined, 5]) {
      assert.equal(c.instanteDesdeGdelt(malo), null);
    }
  });

  test('instanteDesdeRss solo da instante con zona explícita', () => {
    const esperado = Date.UTC(2026, 9, 16, 14, 20, 0);
    assert.equal(c.instanteDesdeRss('2026-10-16T14:20:00Z'), esperado);
    assert.equal(c.instanteDesdeRss('2026-10-16 16:20:00+02:00'), esperado);
    assert.equal(c.instanteDesdeRss('2026-10-16T16:20:00+0200'), esperado);
    assert.equal(c.instanteDesdeRss('Fri, 16 Oct 2026 14:20:00 GMT'), esperado);
    assert.equal(c.instanteDesdeRss('Fri, 16 Oct 2026 16:20:00 +0200'), esperado);
  });

  test('instanteDesdeRss devuelve null sin zona o con basura', () => {
    for (const malo of ['2026-10-16 14:20:00', '2026-10-16', 'Fri, 16 Oct 2026 14:20:00', 'abc', '', null, undefined]) {
      assert.equal(c.instanteDesdeRss(malo), null);
    }
  });

  test('GDELT: el día es el LOCAL del instante, aunque caiga cerca de medianoche UTC', () => {
    const ms = Date.UTC(2026, 9, 15, 23, 30, 0);
    const [m] = c.mapearArticulosGdelt(art('20261015T233000Z'), AHORA);
    assert.equal(m.publicadaEn, ms);
    assert.equal(m.fechaPublicacion, diaLocal(ms));
    const [m2] = c.mapearArticulosGdelt(art('20261015T000500Z'), AHORA);
    assert.equal(m2.fechaPublicacion, diaLocal(Date.UTC(2026, 9, 15, 0, 5, 0)));
  });

  test('GDELT: seendate futura (> ahora + 10 min) se queda sin ninguna fecha, pero la candidata se conserva', () => {
    const [m] = c.mapearArticulosGdelt(art(aSeendate(AHORA + 11 * 60 * 1000)), AHORA);
    assert.ok(m);
    assert.equal(m.fechaPublicacion, undefined);
    assert.equal(m.publicadaEn, undefined);
    assert.equal('publicadaEn' in m, false);
    assert.equal('fechaPublicacion' in m, false);
  });

  test('GDELT: dentro del margen de 10 min conserva fecha e instante', () => {
    const ms = AHORA + 9 * 60 * 1000;
    const [m] = c.mapearArticulosGdelt(art(aSeendate(ms)), AHORA);
    assert.equal(m.publicadaEn, ms);
    assert.equal(m.fechaPublicacion, diaLocal(ms));
  });

  test('RSS con zona: guarda instante y día local; futura se queda sin fecha', () => {
    const ms = Date.UTC(2026, 9, 16, 14, 20, 0);
    const [m] = c.mapearItemsRss(rss('2026-10-16T14:20:00Z'), 'Medio', '', AHORA);
    assert.equal(m.publicadaEn, ms);
    assert.equal(m.fechaPublicacion, diaLocal(ms));
    const futuro = new Date(AHORA + 3600 * 1000).toISOString();
    const [f] = c.mapearItemsRss(rss(futuro), 'Medio', '', AHORA);
    assert.ok(f);
    assert.equal('publicadaEn' in f, false);
    assert.equal('fechaPublicacion' in f, false);
  });

  test('RSS sin zona: solo el día, sin instante; día posterior al local de ahora = sin fecha', () => {
    const [m] = c.mapearItemsRss(rss('2026-10-16 14:20:00'), 'Medio', '', AHORA);
    assert.equal(m.fechaPublicacion, '2026-10-16');
    assert.equal('publicadaEn' in m, false);
    const [hoy] = c.mapearItemsRss(rss('2026-10-20 23:59:00'), 'Medio', '', AHORA);
    assert.equal(hoy.fechaPublicacion, '2026-10-20');
    const [fut] = c.mapearItemsRss(rss('2026-10-21 00:01:00'), 'Medio', '', AHORA);
    assert.ok(fut);
    assert.equal('fechaPublicacion' in fut, false);
    assert.equal('publicadaEn' in fut, false);
  });

  test('validarCandidata: publicadaEn ausente o null es válida y no se copia', () => {
    for (const extra of [{}, { publicadaEn: null }, { publicadaEn: undefined }]) {
      const r = c.validarCandidata(cand(extra));
      assert.equal(r.valida, true);
      assert.equal('publicadaEn' in r.limpia, false);
    }
  });

  test('validarCandidata: publicadaEn no numérico o no finito rechaza la candidata entera', () => {
    for (const malo of ['abc', Infinity, NaN, '1790000000000']) {
      const r = c.validarCandidata(cand({ publicadaEn: malo }));
      assert.equal(r.valida, false);
      assert.ok(r.motivos.includes('La fecha de publicación (instante) no es un número válido.'));
    }
  });

  test('validarCandidata: publicadaEn válido se conserva en limpia', () => {
    const r = c.validarCandidata(cand({ publicadaEn: 1790000000000 }));
    assert.equal(r.valida, true);
    assert.equal(r.limpia.publicadaEn, 1790000000000);
  });
});


describe('construirUrlGdelt (T13, RF-5.5, D-8)', () => {
  const BASE = 'https://api.gdeltproject.org/api/v2/doc/doc?query=';

  test('conserva host, ruta y parámetros de la consulta actual', () => {
    const u = c.construirUrlGdelt('cuba', 'todas');
    assert.ok(u.startsWith(BASE + 'cuba&'));
    assert.ok(u.includes('&mode=ArtList'));
    assert.ok(u.includes('&maxrecords=12'));
    assert.ok(u.includes('&format=json'));
  });

  test('timespan según la ventana', () => {
    assert.ok(c.construirUrlGdelt('cuba', 'hoy').includes('&timespan=24h'));
    assert.ok(c.construirUrlGdelt('cuba', '24h').includes('&timespan=24h'));
    assert.ok(c.construirUrlGdelt('cuba', '7d').includes('&timespan=7d'));
  });

  test('todas y ventana desconocida no llevan timespan', () => {
    for (const v of ['todas', 'mes', '', undefined, null]) {
      assert.ok(!c.construirUrlGdelt('cuba', v).includes('timespan'));
    }
  });

  test('sort=DateDesc siempre presente', () => {
    for (const v of ['hoy', '24h', '7d', 'todas', 'xx', undefined]) {
      assert.ok(c.construirUrlGdelt('cuba', v).includes('&sort=DateDesc'));
    }
  });

  test('el tema con espacios, acentos y & va codificado', () => {
    const tema = 'Egipto & economía (Suez)';
    const u = c.construirUrlGdelt(tema, '24h');
    assert.ok(u.startsWith(BASE + encodeURIComponent(tema) + '&'));
    assert.equal(new URL(u).searchParams.get('query'), tema);
  });

  test('max: válido se respeta, inválido vuelve a 12, tope 250', () => {
    assert.ok(c.construirUrlGdelt('a', 'todas', 30).includes('&maxrecords=30&'));
    assert.ok(c.construirUrlGdelt('a', 'todas', 999).includes('&maxrecords=250&'));
    for (const malo of [0, -3, 2.5, NaN, 'abc', null, Infinity]) {
      assert.ok(c.construirUrlGdelt('a', 'todas', malo).includes('&maxrecords=12&'), String(malo));
    }
    assert.ok(c.construirUrlGdelt('a', 'todas').includes('&maxrecords=12&'));
  });
});

describe('textoFechaPublicacion (T14 · RF-5.2)', () => {
  test('con instante: día y hora en hora local', () => {
    const ms = new Date(2026, 9, 23, 7, 5).getTime();
    assert.equal(c.textoFechaPublicacion({ publicadaEn: ms, fechaPublicacion: '2026-10-23' }), '2026-10-23 07:05');
  });

  test('solo día: lo marca «(solo día)»', () => {
    assert.equal(c.textoFechaPublicacion({ fechaPublicacion: '2026-10-22' }), '2026-10-22 (solo día)');
  });

  test('sin fecha fiable o entrada rara: cadena vacía', () => {
    assert.equal(c.textoFechaPublicacion({}), '');
    assert.equal(c.textoFechaPublicacion({ fechaPublicacion: '2026-02-31' }), '');
    assert.equal(c.textoFechaPublicacion({ publicadaEn: NaN }), '');
    assert.equal(c.textoFechaPublicacion(null), '');
  });
});

describe('textoBarraSeleccion (T-R3 · RF3)', () => {
  test('con 0 marcadas pide marcar y deshabilita', () => {
    assert.deepEqual(c.textoBarraSeleccion(0, 0), {
      mensaje: 'Marca ☑ al menos una noticia para crear el informe',
      habilitado: false,
    });
  });

  test('con 1 marcada, singular', () => {
    assert.deepEqual(c.textoBarraSeleccion(1, 0), { mensaje: '1 noticia marcada', habilitado: true });
  });

  test('con N marcadas, plural', () => {
    assert.deepEqual(c.textoBarraSeleccion(3, 0), { mensaje: '3 noticias marcadas', habilitado: true });
  });

  test('con ocultas añade el texto del filtro (singular y plural)', () => {
    assert.equal(c.textoBarraSeleccion(3, 1).mensaje, '3 noticias marcadas (1 oculta por el filtro)');
    assert.equal(c.textoBarraSeleccion(3, 2).mensaje, '3 noticias marcadas (2 ocultas por el filtro)');
  });
});

describe('barra de informe: HTML y CSS (T-R3 · RF3)', () => {
  const raiz = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(raiz, 'css', 'estilos.css'), 'utf8');

  test('#acciones-candidatas no lleva el atributo hidden en index.html', () => {
    const m = /<div[^>]*id="acciones-candidatas"[^>]*>/.exec(html);
    assert.ok(m, 'no se encontró #acciones-candidatas');
    assert.doesNotMatch(m[0], /\bhidden\b/);
  });

  test('la regla .barra-seleccion-candidatas es sticky, con safe-area y sin colores sueltos', () => {
    const m = /(?:^|\n)\.barra-seleccion-candidatas\s*\{([^}]*)\}/.exec(css);
    assert.ok(m, 'no se encontró la regla');
    assert.match(m[1], /position:\s*sticky/);
    assert.match(m[1], /bottom:\s*0/);
    assert.match(m[1], /safe-area-inset-bottom/);
    assert.doesNotMatch(m[1], /#[0-9a-fA-F]{3,8}\b/);
  });
});
