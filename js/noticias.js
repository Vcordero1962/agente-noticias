/*
 * Dominio puro de la función de Curador de Noticias y Generador Multiplataforma.
 * Sin DOM, sin dependencias, testeable en Node.
 */

/**
 * Valida un elemento de noticia individual.
 * @param {Object} noticia
 * @returns {{ valida: boolean, motivo?: string, limpia?: Object }}
 */
function validarNoticia(noticia) {
  if (!noticia || typeof noticia !== 'object') {
    return { valida: false, motivo: 'La noticia debe ser un objeto.' };
  }

  const titular = typeof noticia.titular === 'string' ? noticia.titular.trim() : '';
  if (!titular) {
    return { valida: false, motivo: 'El titular es obligatorio y no puede estar vacío.' };
  }

  const url = typeof noticia.url === 'string' ? noticia.url.trim() : '';
  if (!url) {
    return { valida: false, motivo: 'El enlace URL es obligatorio.' };
  }

  const esUrlValida = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url);
  if (!esUrlValida) {
    return { valida: false, motivo: 'El enlace URL debe comenzar por http:// o https:// y ser válido.' };
  }

  const sintesis = typeof noticia.sintesis === 'string' ? noticia.sintesis.trim() : '';
  const categoria = typeof noticia.categoria === 'string' && noticia.categoria.trim() 
    ? noticia.categoria.trim() 
    : 'General';

  return {
    valida: true,
    limpia: {
      titular,
      url,
      sintesis,
      categoria,
      agregadaEn: typeof noticia.agregadaEn === 'number' ? noticia.agregadaEn : Date.now()
    }
  };
}

/**
 * Compila un lote de noticias en un boletín estructurado con metadatos.
 * @param {Array} noticias - Lista de objetos noticia
 * @param {Object} [opciones] - Título, fecha o descripción del boletín
 * @returns {Object} Boletín compilado
 */
function compilarBoletin(noticias, opciones = {}) {
  if (!Array.isArray(noticias)) {
    throw new TypeError('El lote de noticias debe ser un array.');
  }

  const validas = [];
  const descartadas = [];

  for (const n of noticias) {
    const res = validarNoticia(n);
    if (res.valida) {
      validas.push(res.limpia);
    } else {
      descartadas.push({ noticia: n, motivo: res.motivo });
    }
  }

  const fechaFormateada = typeof opciones.fecha === 'string' && opciones.fecha.trim()
    ? opciones.fecha.trim()
    : new Date().toISOString().slice(0, 10);

  const tituloBoletin = typeof opciones.titulo === 'string' && opciones.titulo.trim()
    ? opciones.titulo.trim()
    : `Boletín de Noticias - ${fechaFormateada}`;

  return {
    titulo: tituloBoletin,
    fecha: fechaFormateada,
    total: validas.length,
    descartadas: descartadas.length,
    noticias: validas,
    creadoEn: Date.now()
  };
}

/**
 * Genera un archivo HTML enriquecido con MIME de Word (.doc) con estilos ejecutivos y UTF-8.
 * Abre limpiamente en Word de PC, Word Móvil, Google Docs y LibreOffice.
 * @param {Object} boletin
 * @returns {string} Contenido completo del documento Word
 */
function generarDocumentoWord(boletin) {
  if (!boletin || !Array.isArray(boletin.noticias)) {
    throw new TypeError('Se requiere un boletín válido con array de noticias.');
  }

  const itemsIndice = boletin.noticias.map((n, i) => `
    <li style="margin-bottom: 6px;">
      <a href="#noticia-${i + 1}" style="color: #0b57d0; text-decoration: none; font-weight: 500;">
        ${i + 1}. ${escaparHtml(n.titular)}
      </a>
      <span style="color: #666; font-size: 0.85em;"> — [${escaparHtml(n.categoria)}]</span>
    </li>
  `).join('');

  const bloquesNoticias = boletin.noticias.map((n, i) => `
    <div id="noticia-${i + 1}" style="margin-top: 24px; padding: 16px; border: 1px solid #e0e0e0; border-left: 4px solid #0b57d0; background-color: #fafafa; page-break-inside: avoid;">
      <h3 style="margin-top: 0; margin-bottom: 8px; color: #1f1f1f; font-size: 14pt;">
        ${i + 1}. ${escaparHtml(n.titular)}
      </h3>
      <p style="margin: 4px 0 12px 0; font-size: 9pt; color: #666;">
        <strong>Categoría:</strong> ${escaparHtml(n.categoria)} | 
        <strong>Fuente / Enlace:</strong> <a href="${escaparHtml(n.url)}" style="color: #0b57d0;">${escaparHtml(n.url)}</a>
      </p>
      <div style="font-size: 11pt; line-height: 1.5; color: #222; margin-top: 10px;">
        ${n.sintesis ? `<p style="margin: 0; white-space: pre-wrap;">${escaparHtml(n.sintesis)}</p>` : '<em>(Sin síntesis redactada)</em>'}
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escaparHtml(boletin.titulo)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: Calibri, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #111;
      margin: 36pt;
    }
    h1 {
      color: #0b57d0;
      font-size: 20pt;
      border-bottom: 2px solid #0b57d0;
      padding-bottom: 6px;
      margin-bottom: 4px;
    }
    .metadatos {
      color: #555;
      font-size: 10pt;
      margin-bottom: 20px;
    }
    .sumario {
      background-color: #f0f4f9;
      border: 1px solid #d3e3fd;
      border-radius: 4px;
      padding: 14px 18px;
      margin-bottom: 24px;
    }
    .sumario h2 {
      margin-top: 0;
      font-size: 12pt;
      color: #041e49;
    }
  </style>
</head>
<body>
  <h1>${escaparHtml(boletin.titulo)}</h1>
  <div class="metadatos">
    <strong>Fecha:</strong> ${escaparHtml(boletin.fecha)} | 
    <strong>Artículos recopilados:</strong> ${boletin.noticias.length} | 
    <strong>Generado para:</strong> PC y Celular
  </div>

  <div class="sumario">
    <h2>Sumario Ejecutivo</h2>
    <ul style="margin: 0; padding-left: 20px;">
      ${itemsIndice || '<li>No hay noticias compiladas.</li>'}
    </ul>
  </div>

  <h2>Desarrollo de las Noticias</h2>
  ${bloquesNoticias || '<p>No hay artículos en este boletín.</p>'}

  <hr style="margin-top: 36px; border: 0; border-top: 1px solid #ccc;">
  <p style="font-size: 8pt; color: #888; text-align: center;">
    Generado automáticamente por Mi Diario de Estudio · Compatible con PC, Móvil, Microsoft Word y Google Docs
  </p>
</body>
</html>`;
}

/**
 * Genera el boletín en formato Markdown para compartir por WhatsApp o chat de agentes.
 * @param {Object} boletin
 * @returns {string} Texto en Markdown limpio
 */
function generarDocumentoMarkdown(boletin) {
  if (!boletin || !Array.isArray(boletin.noticias)) {
    throw new TypeError('Se requiere un boletín válido con array de noticias.');
  }

  let md = `# ${boletin.titulo}\n`;
  md += `**Fecha:** ${boletin.fecha} | **Total:** ${boletin.noticias.length} noticias\n\n`;
  md += `## Sumario\n`;
  
  boletin.noticias.forEach((n, i) => {
    md += `${i + 1}. [${n.titular}](${n.url}) (${n.categoria})\n`;
  });

  md += `\n---\n\n## Detalle de Noticias\n\n`;

  boletin.noticias.forEach((n, i) => {
    md += `### ${i + 1}. ${n.titular}\n`;
    md += `* **Categoría:** ${n.categoria}\n`;
    md += `* **Fuente:** ${n.url}\n\n`;
    md += `${n.sintesis ? n.sintesis : '*(Sin síntesis redactada)*'}\n\n`;
  });

  return md;
}

/**
 * Escapa caracteres HTML para evitar inyección o formato roto.
 * @param {string} str
 * @returns {string}
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
