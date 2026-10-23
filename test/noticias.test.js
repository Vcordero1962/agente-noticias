/*
 * Tests de la lógica de dominio de noticias (noticias.js) con el runner nativo de Node.
 *   node --test
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EXPORTADAS_NOTICIAS = [
  'validarNoticia',
  'compilarBoletin',
  'generarDocumentoWord',
  'generarDocumentoMarkdown',
  'escaparHtml'
];

function cargarNoticias() {
  const ruta = path.join(__dirname, '..', 'js', 'noticias.js');
  const codigo = fs.readFileSync(ruta, 'utf8');
  return new Function(`${codigo}\nreturn { ${EXPORTADAS_NOTICIAS.join(', ')} };`)();
}

const n = cargarNoticias();

describe('validarNoticia', () => {
  test('valida correctamente una noticia completa', () => {
    const res = n.validarNoticia({
      titular: 'Descubrimiento espacial',
      url: 'https://ejemplo.com/noticia',
      sintesis: 'Resumen de los hechos.',
      categoria: 'Ciencia'
    });

    assert.equal(res.valida, true);
    assert.equal(res.limpia.titular, 'Descubrimiento espacial');
    assert.equal(res.limpia.url, 'https://ejemplo.com/noticia');
    assert.equal(res.limpia.categoria, 'Ciencia');
  });

  test('rechaza objeto no válido o nulo', () => {
    const res1 = n.validarNoticia(null);
    assert.equal(res1.valida, false);

    const res2 = n.validarNoticia('texto');
    assert.equal(res2.valida, false);
  });

  test('rechaza titular vacío', () => {
    const res = n.validarNoticia({
      titular: '   ',
      url: 'https://ejemplo.com'
    });
    assert.equal(res.valida, false);
    assert.match(res.motivo, /titular es obligatorio/i);
  });

  test('rechaza URL sin protocolo http/https', () => {
    const res1 = n.validarNoticia({
      titular: 'Noticia de prueba',
      url: 'ftp://invalido.com'
    });
    assert.equal(res1.valida, false);

    const res2 = n.validarNoticia({
      titular: 'Noticia de prueba',
      url: 'ejemplo.com'
    });
    assert.equal(res2.valida, false);
    assert.match(res2.motivo, /http:\/\/ o https:\/\//i);
  });

  test('asigna categoría General si viene vacía', () => {
    const res = n.validarNoticia({
      titular: 'Noticia sin categoria',
      url: 'https://ejemplo.com'
    });
    assert.equal(res.valida, true);
    assert.equal(res.limpia.categoria, 'General');
  });
});

describe('compilarBoletin', () => {
  test('compila lote de 5 noticias filtrando las no válidas', () => {
    const lote = [
      { titular: 'Noticia 1', url: 'https://ejemplo.com/1' },
      { titular: 'Noticia 2', url: 'https://ejemplo.com/2' },
      { titular: 'Noticia 3', url: 'https://ejemplo.com/3' },
      { titular: 'Noticia 4', url: 'https://ejemplo.com/4' },
      { titular: 'Noticia 5', url: 'https://ejemplo.com/5' },
      { titular: '', url: 'https://invalida.com' } // inválida
    ];

    const boletin = n.compilarBoletin(lote, { titulo: 'Boletín Diario de Noticias' });
    assert.equal(boletin.titulo, 'Boletín Diario de Noticias');
    assert.equal(boletin.total, 5);
    assert.equal(boletin.descartadas, 1);
    assert.equal(boletin.noticias.length, 5);
  });

  test('lanza error si el argumento no es un array', () => {
    assert.throws(() => n.compilarBoletin(null), TypeError);
  });
});

describe('generarDocumentoWord y generarDocumentoMarkdown', () => {
  const boletinEjemplo = {
    titulo: 'Resumen Semanal',
    fecha: '2026-10-06',
    noticias: [
      {
        titular: 'Avances en IA',
        url: 'https://ia.ejemplo.com',
        sintesis: 'Nuevos modelos mejoran el razonamiento.',
        categoria: 'Tecnología'
      }
    ]
  };

  test('generarDocumentoWord produce HTML con marcado Office, UTF-8 y contenido', () => {
    const docWord = n.generarDocumentoWord(boletinEjemplo);
    assert.ok(docWord.includes('<html xmlns:o="urn:schemas-microsoft-com:office:office"'));
    assert.ok(docWord.includes('charset="utf-8"'));
    assert.ok(docWord.includes('Avances en IA'));
    assert.ok(docWord.includes('https://ia.ejemplo.com'));
    assert.ok(docWord.includes('Nuevos modelos mejoran el razonamiento.'));
  });

  test('generarDocumentoMarkdown produce texto estructurado con links', () => {
    const md = n.generarDocumentoMarkdown(boletinEjemplo);
    assert.ok(md.includes('# Resumen Semanal'));
    assert.ok(md.includes('[Avances en IA](https://ia.ejemplo.com)'));
    assert.ok(md.includes('Tecnología'));
  });
});
