'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const PATRON = /AIza[0-9A-Za-z_-]{35}/;

function ficheros() {
  const salida = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'],
    { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return salida.split('\0').filter(Boolean);
}

function buscar(lista) {
  const hallados = [];
  for (const rel of lista) {
    const ruta = path.join(RAIZ, rel);
    let buf;
    try { buf = fs.readFileSync(ruta); } catch { continue; }
    if (PATRON.test(buf.toString('latin1'))) hallados.push(rel);
  }
  return hallados;
}

test('el detector reconoce una clave falsa construida en ejecución', () => {
  const falsa = 'AIza' + 'A'.repeat(35);
  assert.ok(PATRON.test(`x="${falsa}"`));
  assert.ok(!PATRON.test('AIza corta'));
});

test('ningún fichero del repo contiene una clave tipo AIza', () => {
  assert.deepEqual(buscar(ficheros()), []);
});
