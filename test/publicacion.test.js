const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const PROHIBIDO = /315282490104|estado-agente|perfil-egipto|temas-egipto|asistente-facturacion|Egipto|Egypt|AIza[0-9A-Za-z_-]{20,}/;

function ficheros() {
  const lista = [path.join(RAIZ, 'index.html')];
  const dirs = [['js', '.js'], ['css', '.css'], ['datos', '.js']];
  for (const [dir, ext] of dirs) {
    const ruta = path.join(RAIZ, dir);
    if (!fs.existsSync(ruta)) continue;
    for (const f of fs.readdirSync(ruta)) {
      if (f.endsWith(ext)) lista.push(path.join(ruta, f));
    }
  }
  return lista;
}

describe('publicacion: nada privado en la copia publica', () => {
  for (const f of ficheros()) {
    test(`sin contenido privado: ${path.relative(RAIZ, f)}`, () => {
      const m = PROHIBIDO.exec(fs.readFileSync(f, 'utf8'));
      assert.equal(m, null, `Contenido prohibido "${m && m[0]}" en ${f}`);
    });
  }

  test('no existen ficheros ni carpetas privadas', () => {
    assert.equal(fs.existsSync(path.join(RAIZ, 'config', 'perfil-egipto.json')), false);
    assert.equal(fs.existsSync(path.join(RAIZ, 'datos', 'estado-agente.js')), false);
    assert.equal(fs.existsSync(path.join(RAIZ, 'tools')), false);
  });

  test('#input-busqueda-directa tiene value vacio', () => {
    const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    const tag = html.match(/<input\b[^>]*id="input-busqueda-directa"[^>]*>/);
    assert.ok(tag, 'no se encontro #input-busqueda-directa');
    assert.match(tag[0], /\bvalue=""/);
  });
});
