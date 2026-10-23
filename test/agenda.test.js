const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Cargar el dominio puro agenda.js sin DOM
function cargarAgenda() {
  const ruta = path.join(__dirname, '..', 'js', 'agenda.js');
  const codigo = fs.readFileSync(ruta, 'utf8');
  return new Function(`${codigo}\nreturn { crearReunion, analizarTranscripcion, compilarActaReunion, generarInformeWordReunion, generarInformeMarkdownReunion, CLAVE_STORAGE_REUNIONES, CLAVE_STORAGE_TEMAS, cargarReuniones, guardarReuniones, agregarReunion, eliminarReunion, crearTemaAgenda, cargarTemasAgenda, guardarTemasAgenda, agregarTemaAgenda, alternarTemaAgenda, eliminarTemaAgenda };`)();
}

const a = cargarAgenda();

describe('crearReunion', () => {
  test('crea una reunión por defecto con id único y fecha', () => {
    const r = a.crearReunion({});
    assert.ok(r.id.startsWith('reunion_'));
    assert.equal(r.titulo, 'Reunión de Trabajo');
    assert.ok(Array.isArray(r.participantes));
    assert.ok(Array.isArray(r.temas));
    assert.ok(Array.isArray(r.necesidades));
    assert.ok(Array.isArray(r.acuerdos));
    assert.ok(Array.isArray(r.tareas));
  });

  test('normaliza participantes desde string separado por comas', () => {
    const r = a.crearReunion({
      titulo: 'Reunión Bilateral',
      participantes: 'Carlos, Ana Gómez, Pedro'
    });
    assert.deepEqual(r.participantes, ['Carlos', 'Ana Gómez', 'Pedro']);
    assert.equal(r.titulo, 'Reunión Bilateral');
  });
});

describe('analizarTranscripcion · Extracción de Inteligencia de Reunión', () => {
  test('extrae acuerdos, necesidades y tareas de una conversación real', () => {
    const conversacion = `
      Tratamos sobre la exportación de tabaco y café para el próximo trimestre.
      El cliente necesita con urgencia recibir las muestras antes del día 15.
      Acordamos firmar el memorando preliminar el próximo lunes en La Habana.
      Ana se encargará de preparar el informe financiero detallado.
    `;

    const res = a.analizarTranscripcion(conversacion);

    assert.ok(res.temas.length > 0, 'Debe detectar temas');
    assert.ok(res.necesidades.some(n => n.includes('necesita con urgencia')), 'Debe detectar la necesidad');
    assert.ok(res.acuerdos.some(ac => ac.includes('Acordamos firmar')), 'Debe detectar el acuerdo');
    assert.ok(res.tareas.some(t => t.accion.includes('preparar el informe')), 'Debe detectar la tarea');
    
    const tareaAna = res.tareas.find(t => t.accion.includes('preparar'));
    assert.ok(tareaAna);
    assert.equal(tareaAna.estado, 'Pendiente');
  });

  test('maneja transcripción vacía o nula sin lanzar error', () => {
    const res = a.analizarTranscripcion('');
    assert.deepEqual(res.temas, []);
    assert.deepEqual(res.necesidades, []);
    assert.deepEqual(res.acuerdos, []);
    assert.deepEqual(res.tareas, []);
  });
});

describe('compilarActaReunion', () => {
  test('compila y analiza automáticamente si la reunión incluye transcripción', () => {
    const reunion = a.compilarActaReunion({
      titulo: 'Comité de Dirección',
      transcripcion: 'Decidimos aprobar el presupuesto anual. Requerimos contratar dos técnicos.'
    });

    assert.equal(reunion.titulo, 'Comité de Dirección');
    assert.ok(reunion.acuerdos.length > 0);
    assert.ok(reunion.necesidades.length > 0);
  });
});

describe('generarInformeWordReunion y generarInformeMarkdownReunion', () => {
  const actaPrueba = {
    titulo: 'Sesión Extraordinaria de Coordinación',
    fecha: '2026-10-07',
    horaInicio: '10:00',
    horaFin: '11:30',
    participantes: ['Embajador', 'Secretario General'],
    transcripcion: 'Reunión para definir los plazos del convenio. Se acuerda mantener la reunión semanal.',
    temas: ['Plazos del nuevo convenio comercial'],
    necesidades: ['Se requiere validación consular de los certificados'],
    acuerdos: ['Se aprueba la agenda del próximo mes'],
    tareas: [{ accion: 'Enviar borrador final a los ministerios', responsable: 'Carlos', estado: 'Pendiente' }]
  };

  test('generarInformeWordReunion genera HTML con formato de Office y los 4 bloques', () => {
    const wordHtml = a.generarInformeWordReunion(actaPrueba);
    assert.ok(wordHtml.includes('xmlns:w="urn:schemas-microsoft-com:office:word"'));
    assert.ok(wordHtml.includes('INFORME Y ACTA EJECUTIVA DE REUNIÓN'));
    assert.ok(wordHtml.includes('Sesión Extraordinaria de Coordinación'));
    assert.ok(wordHtml.includes('1. Temas Principales Tratados'));
    assert.ok(wordHtml.includes('2. Necesidades y Requerimientos Planteados'));
    assert.ok(wordHtml.includes('3. Acuerdos y Decisiones Adoptadas'));
    assert.ok(wordHtml.includes('4. Análisis de Tareas y Acciones de Seguimiento'));
    assert.ok(wordHtml.includes('Enviar borrador final'));
  });

  test('generarInformeMarkdownReunion genera Markdown estructurado con tabla de tareas', () => {
    const md = a.generarInformeMarkdownReunion(actaPrueba);
    assert.ok(md.includes('# INFORME EJECUTIVO DE REUNIÓN'));
    assert.ok(md.includes('**Participantes:** Embajador, Secretario General'));
    assert.ok(md.includes('### 1. Temas Principales Tratados'));
    assert.ok(md.includes('### 3. Acuerdos y Compromisos Adoptados'));
    assert.ok(md.includes('| Tarea / Acción | Responsable | Estado |'));
    assert.ok(md.includes('Carlos'));
  });
});

describe('Persistencia de Reuniones (T4)', () => {
  function crearMockStorage(datosIniciales = {}) {
    const store = { ...datosIniciales };
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    };
  }

  test('cargarReuniones y guardarReuniones funcionan con almacenamiento simulado', () => {
    const storage = crearMockStorage();
    assert.deepEqual(a.cargarReuniones(storage), []);

    const reuniones = [
      a.crearReunion({ titulo: 'Reunión 1' }),
      a.crearReunion({ titulo: 'Reunión 2' })
    ];

    const guardado = a.guardarReuniones(reuniones, storage);
    assert.ok(guardado);

    const cargadas = a.cargarReuniones(storage);
    assert.equal(cargadas.length, 2);
    assert.equal(cargadas[0].titulo, 'Reunión 1');
  });

  test('agregarReunion y eliminarReunion mantienen inmutabilidad', () => {
    const r1 = a.crearReunion({ id: 'r_1', titulo: 'R1' });
    const r2 = a.crearReunion({ id: 'r_2', titulo: 'R2' });

    const lista1 = a.agregarReunion(r1, []);
    assert.equal(lista1.length, 1);

    const lista2 = a.agregarReunion(r2, lista1);
    assert.equal(lista2.length, 2);
    assert.equal(lista2[0].id, 'r_2'); // Añadida al inicio

    const lista3 = a.eliminarReunion('r_1', lista2);
    assert.equal(lista3.length, 1);
    assert.equal(lista3[0].id, 'r_2');
  });
});

describe('Banco de Temas Pendientes de Agenda (T4)', () => {
  function crearMockStorage(datosIniciales = {}) {
    const store = { ...datosIniciales };
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    };
  }

  test('crearTemaAgenda crea tema con campos por defecto', () => {
    const t = a.crearTemaAgenda({ texto: 'Renovación de acuerdos comerciales' });
    assert.ok(t.id.startsWith('tema_'));
    assert.equal(t.texto, 'Renovación de acuerdos comerciales');
    assert.equal(t.prioridad, 'media');
    assert.equal(t.completado, false);
  });

  test('agregarTemaAgenda, alternarTemaAgenda y eliminarTemaAgenda', () => {
    const storage = crearMockStorage();
    let temas = a.cargarTemasAgenda(storage);
    assert.deepEqual(temas, []);

    temas = a.agregarTemaAgenda({ id: 't_1', texto: 'Revisión presupuestaria', prioridad: 'alta' }, temas);
    assert.equal(temas.length, 1);
    assert.equal(temas[0].completado, false);

    // Alternar completado
    temas = a.alternarTemaAgenda('t_1', temas);
    assert.equal(temas[0].completado, true);

    // Alternar de nuevo
    temas = a.alternarTemaAgenda('t_1', temas);
    assert.equal(temas[0].completado, false);

    // Guardar y recargar
    a.guardarTemasAgenda(temas, storage);
    const recargados = a.cargarTemasAgenda(storage);
    assert.equal(recargados.length, 1);
    assert.equal(recargados[0].texto, 'Revisión presupuestaria');

    // Eliminar
    temas = a.eliminarTemaAgenda('t_1', temas);
    assert.equal(temas.length, 0);
  });
});
