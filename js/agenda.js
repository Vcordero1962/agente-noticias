/*
 * js/agenda.js — Dominio puro de Gestión de Reuniones y Agenda Ejecutiva.
 * Sin DOM, sin dependencias, 100% testeable en Node.
 */

function escaparHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Crea una estructura de reunión validada.
 */
function crearReunion(datos = {}) {
  const ahora = new Date();
  const fechaHoy = datos.fecha || ahora.toISOString().split('T')[0];
  const horaActual = datos.horaInicio || ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  let participantes = [];
  if (Array.isArray(datos.participantes)) {
    participantes = datos.participantes.map(p => String(p).trim()).filter(Boolean);
  } else if (typeof datos.participantes === 'string') {
    participantes = datos.participantes.split(',').map(p => p.trim()).filter(Boolean);
  }

  const id = datos.id || `reunion_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const titulo = typeof datos.titulo === 'string' && datos.titulo.trim()
    ? datos.titulo.trim()
    : 'Reunión de Trabajo';

  const transcripcion = typeof datos.transcripcion === 'string' ? datos.transcripcion.trim() : '';

  return {
    id,
    titulo,
    fecha: fechaHoy,
    horaInicio: horaActual,
    horaFin: datos.horaFin || '',
    participantes,
    transcripcion,
    temas: Array.isArray(datos.temas) ? datos.temas : [],
    necesidades: Array.isArray(datos.necesidades) ? datos.necesidades : [],
    acuerdos: Array.isArray(datos.acuerdos) ? datos.acuerdos : [],
    tareas: Array.isArray(datos.tareas) ? datos.tareas : [],
    creadaEn: typeof datos.creadaEn === 'number' ? datos.creadaEn : Date.now()
  };
}

/**
 * Analiza la transcripción continua para extraer automáticamente:
 * - Temas tratados
 * - Necesidades y requerimientos
 * - Acuerdos adoptados
 * - Tareas y acciones de seguimiento
 */
function analizarTranscripcion(transcripcion = '') {
  if (typeof transcripcion !== 'string' || !transcripcion.trim()) {
    return {
      temas: [],
      necesidades: [],
      acuerdos: [],
      tareas: []
    };
  }

  // Dividir en oraciones o frases clave
  const oraciones = transcripcion
    .split(/(?<=[.?!;])\s+|\n+/)
    .map(o => o.trim())
    .filter(o => o.length > 5);

  const temas = [];
  const necesidades = [];
  const acuerdos = [];
  const tareas = [];

  const patronNecesidad = /(?:necesita|necesitamos|hace falta|requiere|requerimos|solicita|solicitamos|pide|piden|es necesario|urgente|demanda|prioridad)/i;
  const patronAcuerdo = /(?:acordamos|se acuerda|acuerdo|quedamos en|decidimos|se decide|compromiso|aprobado|se aprueba|definido|concluido|pactado)/i;
  const patronTarea = /(?:tarea|encargar|encarga|preparar|enviar|revisar|elaborar|entregar|coordinar|hacer seguimiento|responsable|asignado)/i;
  const patronTema = /(?:sobre|tema|respecto a|tratamos|hablamos de|analizamos|punto|en cuanto a)/i;

  oraciones.forEach(oracion => {
    let categorizada = false;

    if (patronAcuerdo.test(oracion)) {
      acuerdos.push(oracion);
      categorizada = true;
    }

    if (patronNecesidad.test(oracion)) {
      necesidades.push(oracion);
      categorizada = true;
    }

    if (patronTarea.test(oracion)) {
      // Intentar extraer responsable si se detecta nombre o pronombre
      let responsable = 'Equipo';
      const matchResp = oracion.match(/(?:responsable|encargado|encargada|asigna a|para)\s+([A-ZÁÉÍÓÚ][a-záéíóúñ]+)/);
      if (matchResp) {
        responsable = matchResp[1];
      }
      tareas.push({
        accion: oracion,
        responsable,
        estado: 'Pendiente'
      });
      categorizada = true;
    }

    if (patronTema.test(oracion) && !categorizada) {
      temas.push(oracion);
      categorizada = true;
    }
  });

  // Si no se extrajeron temas explícitos, usar las primeras oraciones como síntesis de temas
  if (temas.length === 0 && oraciones.length > 0) {
    temas.push(oraciones[0]);
    if (oraciones.length > 1 && !acuerdos.includes(oraciones[1]) && !necesidades.includes(oraciones[1])) {
      temas.push(oraciones[1]);
    }
  }

  return {
    temas: [...new Set(temas)],
    necesidades: [...new Set(necesidades)],
    acuerdos: [...new Set(acuerdos)],
    tareas
  };
}

/**
 * Compila una reunión completa procesando su transcripción si no tenía análisis previo.
 */
function compilarActaReunion(datosReunion) {
  const reunion = crearReunion(datosReunion);

  if (reunion.transcripcion && (!reunion.temas.length && !reunion.acuerdos.length && !reunion.necesidades.length && !reunion.tareas.length)) {
    const analizado = analizarTranscripcion(reunion.transcripcion);
    reunion.temas = analizado.temas;
    reunion.necesidades = analizado.necesidades;
    reunion.acuerdos = analizado.acuerdos;
    reunion.tareas = analizado.tareas;
  }

  return reunion;
}

/**
 * Genera documento oficial en Microsoft Word (.doc con XML HTML Office).
 */
function generarInformeWordReunion(acta) {
  const a = compilarActaReunion(acta);
  const participantesTexto = a.participantes.length > 0
    ? a.participantes.map(escaparHtml).join(', ')
    : 'No especificados';

  const temasHtml = a.temas.length > 0
    ? `<ul>${a.temas.map(t => `<li>${escaparHtml(t)}</li>`).join('')}</ul>`
    : '<p><em>Sin temas específicos registrados.</em></p>';

  const necesidadesHtml = a.necesidades.length > 0
    ? `<ul>${a.necesidades.map(n => `<li>${escaparHtml(n)}</li>`).join('')}</ul>`
    : '<p><em>No se formularon requerimientos especiales.</em></p>';

  const acuerdosHtml = a.acuerdos.length > 0
    ? `<ol>${a.acuerdos.map(ac => `<li><strong>Acuerdo:</strong> ${escaparHtml(ac)}</li>`).join('')}</ol>`
    : '<p><em>No se registraron acuerdos explícitos.</em></p>';

  const tareasFilas = a.tareas.length > 0
    ? a.tareas.map(t => `
      <tr>
        <td style="padding: 6px; border: 1px solid #ccc;">${escaparHtml(t.accion)}</td>
        <td style="padding: 6px; border: 1px solid #ccc; text-align: center;">${escaparHtml(t.responsable || 'Equipo')}</td>
        <td style="padding: 6px; border: 1px solid #ccc; text-align: center;">${escaparHtml(t.estado || 'Pendiente')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="3" style="padding: 6px; border: 1px solid #ccc; text-align: center;"><em>No hay tareas asignadas.</em></td></tr>';

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <title>Acta de Reunión — ${escaparHtml(a.titulo)}</title>
  <style>
    body {
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      margin: 2.5cm;
    }
    h1 {
      font-size: 18pt;
      color: #0d47a1;
      border-bottom: 2px solid #0d47a1;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    h2 {
      font-size: 13pt;
      color: #1565c0;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 4px;
      margin-top: 18px;
    }
    .metadatos {
      background-color: #f5f7fa;
      border-left: 4px solid #0d47a1;
      padding: 10px 14px;
      margin-bottom: 20px;
    }
    .metadatos p {
      margin: 4px 0;
      font-size: 10pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 10pt;
    }
    th {
      background-color: #0d47a1;
      color: #ffffff;
      padding: 8px;
      border: 1px solid #0d47a1;
      text-align: left;
    }
    ul, ol {
      padding-left: 20px;
    }
    li {
      margin-bottom: 6px;
    }
    .transcripcion {
      background-color: #fafafa;
      border: 1px solid #eee;
      padding: 10px;
      font-size: 9.5pt;
      color: #555;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h1>INFORME Y ACTA EJECUTIVA DE REUNIÓN</h1>

  <div class="metadatos">
    <p><strong>Asunto / Título:</strong> ${escaparHtml(a.titulo)}</p>
    <p><strong>Fecha:</strong> ${escaparHtml(a.fecha)} | <strong>Horario:</strong> ${escaparHtml(a.horaInicio)}${a.horaFin ? ' - ' + escaparHtml(a.horaFin) : ''}</p>
    <p><strong>Participantes:</strong> ${participantesTexto}</p>
  </div>

  <h2>1. Temas Principales Tratados</h2>
  ${temasHtml}

  <h2>2. Necesidades y Requerimientos Planteados</h2>
  ${necesidadesHtml}

  <h2>3. Acuerdos y Decisiones Adoptadas</h2>
  ${acuerdosHtml}

  <h2>4. Análisis de Tareas y Acciones de Seguimiento</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 60%;">Tarea / Acción</th>
        <th style="width: 25%; text-align: center;">Responsable</th>
        <th style="width: 15%; text-align: center;">Estado</th>
      </tr>
    </thead>
    <tbody>
      ${tareasFilas}
    </tbody>
  </table>

  ${a.transcripcion ? `
    <h2>Anexo: Registro Literal de la Conversación</h2>
    <div class="transcripcion">${escaparHtml(a.transcripcion)}</div>
  ` : ''}
</body>
</html>`;
}

/**
 * Genera el informe estructurado en formato Markdown (GFM).
 */
function generarInformeMarkdownReunion(acta) {
  const a = compilarActaReunion(acta);
  const participantesTexto = a.participantes.length > 0
    ? a.participantes.join(', ')
    : 'No especificados';

  let md = `# INFORME EJECUTIVO DE REUNIÓN: ${a.titulo}\n\n`;
  md += `**Fecha:** ${a.fecha} | **Hora:** ${a.horaInicio}${a.horaFin ? ' - ' + a.horaFin : ''}\n`;
  md += `**Participantes:** ${participantesTexto}\n\n`;
  md += `---\n\n`;

  md += `### 1. Temas Principales Tratados\n`;
  if (a.temas.length > 0) {
    a.temas.forEach(t => { md += `- ${t}\n`; });
  } else {
    md += `_Sin temas específicos registrados._\n`;
  }
  md += `\n`;

  md += `### 2. Necesidades y Requerimientos Planteados\n`;
  if (a.necesidades.length > 0) {
    a.necesidades.forEach(n => { md += `- ⚠️ ${n}\n`; });
  } else {
    md += `_No se formularon requerimientos especiales._\n`;
  }
  md += `\n`;

  md += `### 3. Acuerdos y Compromisos Adoptados\n`;
  if (a.acuerdos.length > 0) {
    a.acuerdos.forEach((ac, idx) => { md += `${idx + 1}. ✅ **${ac}**\n`; });
  } else {
    md += `_No se registraron acuerdos explícitos._\n`;
  }
  md += `\n`;

  md += `### 4. Análisis de Tareas y Plan de Acción\n`;
  if (a.tareas.length > 0) {
    md += `| Tarea / Acción | Responsable | Estado |\n`;
    md += `| :--- | :---: | :---: |\n`;
    a.tareas.forEach(t => {
      md += `| ${t.accion.replace(/\|/g, '-')} | ${t.responsable || 'Equipo'} | ${t.estado || 'Pendiente'} |\n`;
    });
  } else {
    md += `_No hay tareas asignadas._\n`;
  }
  md += `\n`;

  if (a.transcripcion) {
    md += `---\n\n`;
    md += `### Anexo: Transcripción de la Reunión\n`;
    md += `> ${a.transcripcion.replace(/\n/g, '\n> ')}\n`;
  }

  return md;
}

/* --- Persistencia y Banco de Temas de Agenda --- */
const CLAVE_STORAGE_REUNIONES = 'diario-agenda:v1';
const CLAVE_STORAGE_TEMAS = 'diario-temas-agenda:v1';

/**
 * Carga las reuniones guardadas.
 */
function cargarReuniones(almacenamiento = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!almacenamiento) return [];
  try {
    const raw = almacenamiento.getItem(CLAVE_STORAGE_REUNIONES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Guarda las reuniones en almacenamiento.
 */
function guardarReuniones(reuniones, almacenamiento = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!almacenamiento || !Array.isArray(reuniones)) return false;
  try {
    almacenamiento.setItem(CLAVE_STORAGE_REUNIONES, JSON.stringify(reuniones));
    return true;
  } catch {
    return false;
  }
}

/**
 * Agrega una reunión al historial (al inicio) de forma inmutable.
 */
function agregarReunion(reunion, listaExistente = []) {
  if (!reunion || typeof reunion !== 'object') return [...listaExistente];
  return [reunion, ...listaExistente];
}

/**
 * Elimina una reunión del historial por ID de forma inmutable.
 */
function eliminarReunion(id, listaExistente = []) {
  if (!id) return [...listaExistente];
  return listaExistente.filter(r => r.id !== id);
}

/**
 * Crea una entrada para el banco de temas pendientes a llevar a reuniones.
 */
function crearTemaAgenda(datos = {}) {
  const id = datos.id || `tema_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const texto = typeof datos.texto === 'string' && datos.texto.trim()
    ? datos.texto.trim()
    : (typeof datos.tema === 'string' ? datos.tema.trim() : 'Tema sin título');
  const prioridad = ['alta', 'media', 'baja'].includes(datos.prioridad) ? datos.prioridad : 'media';
  const responsable = typeof datos.responsable === 'string' ? datos.responsable.trim() : '';
  const completado = Boolean(datos.completado);
  const fecha = datos.fecha || new Date().toISOString().split('T')[0];

  return {
    id,
    texto,
    prioridad,
    responsable,
    completado,
    fecha
  };
}

/**
 * Carga los temas pendientes de la agenda.
 */
function cargarTemasAgenda(almacenamiento = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!almacenamiento) return [];
  try {
    const raw = almacenamiento.getItem(CLAVE_STORAGE_TEMAS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Guarda los temas de la agenda en almacenamiento.
 */
function guardarTemasAgenda(temas, almacenamiento = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!almacenamiento || !Array.isArray(temas)) return false;
  try {
    almacenamiento.setItem(CLAVE_STORAGE_TEMAS, JSON.stringify(temas));
    return true;
  } catch {
    return false;
  }
}

/**
 * Agrega un nuevo tema a la lista de temas pendientes.
 */
function agregarTemaAgenda(nuevoTema, listaExistente = []) {
  const item = crearTemaAgenda(nuevoTema);
  return [item, ...listaExistente];
}

/**
 * Alterna el estado de completado de un tema por ID.
 */
function alternarTemaAgenda(id, listaExistente = []) {
  return listaExistente.map(item => {
    if (item.id === id) {
      return { ...item, completado: !item.completado };
    }
    return item;
  });
}

/**
 * Elimina un tema por ID.
 */
function eliminarTemaAgenda(id, listaExistente = []) {
  return listaExistente.filter(item => item.id !== id);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escaparHtml,
    crearReunion,
    analizarTranscripcion,
    compilarActaReunion,
    generarInformeWordReunion,
    generarInformeMarkdownReunion,
    CLAVE_STORAGE_REUNIONES,
    CLAVE_STORAGE_TEMAS,
    cargarReuniones,
    guardarReuniones,
    agregarReunion,
    eliminarReunion,
    crearTemaAgenda,
    cargarTemasAgenda,
    guardarTemasAgenda,
    agregarTemaAgenda,
    alternarTemaAgenda,
    eliminarTemaAgenda
  };
}
