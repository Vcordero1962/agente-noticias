/*
 * Tests del título y el nombre del informe (copia pública): «Verificadas» solo si todas las
 * noticias elegidas se comprobaron de verdad. Sin red.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function cargar() {
  const codigo = fs.readFileSync(path.join(__dirname, '..', 'js', 'candidatas.js'), 'utf8');
  return new Function(`${codigo}\nreturn { contarSinComprobar, tituloInforme, nombreArchivoInforme };`)();
}

const c = cargar();

const ok = (n) => ({
  id: `https://example.org/${n}`, titular: `T${n}`, medio: 'Medio', url: `https://example.org/${n}`,
  verificacion: { estado: 'ok', urlFinal: `https://example.org/${n}`, tituloPagina: `T${n}`, comprobadaEn: 1 },
});
const sinComprobar = (n) => ({
  id: `https://example.org/${n}`, titular: `T${n}`, medio: 'Medio', url: `https://example.org/${n}`,
  verificacion: { estado: 'no-comprobado', urlFinal: `https://example.org/${n}`, tituloPagina: `T${n}`, comprobadaEn: 1 },
});

describe('informe honesto (copia pública)', () => {
  test('contarSinComprobar cuenta las que no tienen estado ok', () => {
    assert.equal(c.contarSinComprobar([ok(1), sinComprobar(2), sinComprobar(3)]), 2);
    assert.equal(c.contarSinComprobar([ok(1)]), 0);
    assert.equal(c.contarSinComprobar('no es lista'), 0);
    assert.equal(c.contarSinComprobar([null, 42]), 0);
  });

  test('«Verificadas» solo si todas están comprobadas de verdad', () => {
    assert.equal(c.tituloInforme([ok(1), ok(2)], '2026-11-06'), 'Informe de Noticias Verificadas - 2026-11-06');
    assert.equal(c.tituloInforme([], '2026-11-06'), 'Informe de Noticias Verificadas - 2026-11-06');
    assert.equal(
      c.tituloInforme([ok(1), sinComprobar(2)], '2026-11-06'),
      'Informe de Noticias - 2026-11-06 (1 con enlace sin comprobar)',
    );
    assert.doesNotMatch(c.tituloInforme([sinComprobar(1)], '2026-11-06'), /Verificadas/);
  });

  test('el nombre del fichero lleva «Verificadas» solo si todas están comprobadas', () => {
    assert.equal(c.nombreArchivoInforme([ok(1)], '2026-11-06'), 'Informe-Noticias-Verificadas-2026-11-06.doc');
    assert.equal(c.nombreArchivoInforme([ok(1), sinComprobar(2)], '2026-11-06'), 'Informe-Noticias-2026-11-06.doc');
  });
});
