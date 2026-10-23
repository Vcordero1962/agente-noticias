/*
 * Dominio puro de las noticias candidatas del agente de búsqueda.
 * Sin DOM, sin red y sin reloj: testeable en Node.
 *
 * Aquí NO se comprueba nada contra la web: eso lo hace
 * tools/agente-noticias/verificar.js. Este módulo solo EXIGE que la verificación
 * conste, para que una candidata sin comprobar no llegue nunca a un informe
 * (docs/constitution.md, "Prohibido inventar").
 */

function esTextoNoVacio(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

function esUrlHttp(valor) {
  return typeof valor === 'string' && /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(valor.trim());
}

// YYYY-MM-DD que existe en el calendario (rechaza 2026-02-31). Solo valida el texto.
function esFechaISO(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia;
}

function normalizarMedio(medio) {
  return typeof medio === 'string' ? medio.trim().toLowerCase() : '';
}

/**
 * Valida una candidata y devuelve una copia normalizada. No modifica la entrada.
 * Acumula todos los motivos de rechazo, no solo el primero.
 * @returns {{ valida: boolean, motivos: string[], limpia?: Object }}
 */
function validarCandidata(candidata) {
  if (!candidata || typeof candidata !== 'object' || Array.isArray(candidata)) {
    return { valida: false, motivos: ['La candidata debe ser un objeto.'] };
  }

  const motivos = [];
  const titular = esTextoNoVacio(candidata.titular) ? candidata.titular.trim() : '';
  const medio = esTextoNoVacio(candidata.medio) ? candidata.medio.trim() : '';
  const url = esUrlHttp(candidata.url) ? candidata.url.trim() : '';

  if (!titular) motivos.push('Falta el titular.');
  if (!medio) motivos.push('Falta el nombre del medio.');
  if (!url) motivos.push('Falta la URL o no empieza por http:// o https://.');

  const v = candidata.verificacion;
  if (!v || typeof v !== 'object') {
    motivos.push('No consta la verificación de la URL.');
  } else {
    if (v.estado !== 'ok') motivos.push('La verificación de la URL no tiene estado "ok".');
    if (!esUrlHttp(v.urlFinal)) motivos.push('La verificación no registra la URL final.');
    if (!esTextoNoVacio(v.tituloPagina)) motivos.push('La verificación no registra el título de la página.');
    if (typeof v.comprobadaEn !== 'number' || !Number.isFinite(v.comprobadaEn)) {
      motivos.push('La verificación no registra cuándo se comprobó.');
    }
  }

  const traeFecha = candidata.fechaPublicacion !== undefined && candidata.fechaPublicacion !== null;
  if (traeFecha && !esFechaISO(candidata.fechaPublicacion)) {
    motivos.push('La fecha de publicación no es una fecha válida YYYY-MM-DD.');
  }

  const traeInstante = candidata.publicadaEn !== undefined && candidata.publicadaEn !== null;
  if (traeInstante && !(typeof candidata.publicadaEn === 'number' && Number.isFinite(candidata.publicadaEn))) {
    motivos.push('La fecha de publicación (instante) no es un número válido.');
  }

  if (motivos.length > 0) return { valida: false, motivos };

  const limpia = {
    id: esTextoNoVacio(candidata.id) ? candidata.id.trim() : url,
    titular,
    medio,
    url,
    extracto: typeof candidata.extracto === 'string' ? candidata.extracto.trim() : '',
    tambienEn: Array.isArray(candidata.tambienEn)
      ? candidata.tambienEn
          .filter((o) => o && esTextoNoVacio(o.medio) && esUrlHttp(o.url))
          .map((o) => ({ medio: o.medio.trim(), url: o.url.trim() }))
      : [],
    verificacion: {
      estado: v.estado,
      urlFinal: v.urlFinal.trim(),
      tituloPagina: v.tituloPagina.trim(),
      comprobadaEn: v.comprobadaEn,
    },
  };
  if (traeFecha) limpia.fechaPublicacion = candidata.fechaPublicacion;
  if (traeInstante) limpia.publicadaEn = candidata.publicadaEn;

  return { valida: true, motivos: [], limpia };
}

/**
 * Separa un lote en candidatas válidas (normalizadas) y descartadas con su motivo.
 * @returns {{ validas: Object[], descartadas: { candidata: *, motivos: string[] }[] }}
 */
function filtrarValidas(lote) {
  const validas = [];
  const descartadas = [];
  if (!Array.isArray(lote)) return { validas, descartadas };

  for (const candidata of lote) {
    const r = validarCandidata(candidata);
    if (r.valida) validas.push(r.limpia);
    else descartadas.push({ candidata, motivos: r.motivos });
  }
  return { validas, descartadas };
}

/**
 * Cuenta los medios distintos que recogen el hecho: el medio de la candidata más los
 * de `tambienEn`. Es la única señal de repercusión que usa el orden: se puede comprobar.
 */
function contarFuentes(candidata) {
  if (!candidata || typeof candidata !== 'object') return 0;
  const medios = new Set();
  const propio = normalizarMedio(candidata.medio);
  if (propio) medios.add(propio);
  if (Array.isArray(candidata.tambienEn)) {
    for (const otro of candidata.tambienEn) {
      const m = normalizarMedio(otro && otro.medio);
      if (m) medios.add(m);
    }
  }
  return medios.size;
}

/**
 * Ordena por número de medios distintos (desc), luego por fecha (más reciente primero;
 * sin fecha al final) y, en empate, conserva el orden de entrada. No muta la entrada
 * ni añade campos: no afirma ninguna "repercusión" que no pueda demostrar.
 */
function ordenarCandidatas(lista) {
  if (!Array.isArray(lista)) return [];
  const fechaDe = (c) => (c && esFechaISO(c.fechaPublicacion) ? c.fechaPublicacion : '');
  const instanteDe = (c) => (c && Number.isFinite(c.publicadaEn) ? c.publicadaEn : -Infinity);

  return lista
    .map((candidata, indice) => ({ candidata, indice }))
    .sort((a, b) => {
      const porFuentes = contarFuentes(b.candidata) - contarFuentes(a.candidata);
      if (porFuentes !== 0) return porFuentes;
      const fa = fechaDe(a.candidata);
      const fb = fechaDe(b.candidata);
      if (fa !== fb) return fa < fb ? 1 : -1;
      const ia = instanteDe(a.candidata);
      const ib = instanteDe(b.candidata);
      if (ia !== ib) return ib - ia;
      return a.indice - b.indice;
    })
    .map((o) => o.candidata);
}

/**
 * Devuelve solo las candidatas marcadas (por id), en el orden de la lista y sin repetir.
 * Revalida cada una: una candidata sin verificación nunca llega al informe, aunque
 * esté marcada.
 */
function seleccionarParaInforme(lista, ids) {
  if (!Array.isArray(lista) || !Array.isArray(ids)) return [];
  const marcados = new Set(ids.filter(esTextoNoVacio).map((id) => id.trim()));
  const vistos = new Set();
  const elegidas = [];

  for (const candidata of lista) {
    const r = validarCandidata(candidata);
    if (!r.valida) continue;
    const { id } = r.limpia;
    if (marcados.has(id) && !vistos.has(id)) {
      vistos.add(id);
      elegidas.push(r.limpia);
    }
  }
  return elegidas;
}

/**
 * Convierte un timestamp (ms) a fecha YYYY-MM-DD en hora local (nunca toISOString).
 */
function formatearFechaLocal(timestamp) {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '';
  const d = new Date(timestamp);
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

const VENTANAS_FECHA = Object.freeze(['hoy', '24h', '7d', 'todas']);

const MS_POR_HORA = 60 * 60 * 1000;

/** Día local (YYYY-MM-DD) `n` días antes del día local de `ahora`. */
function diaLocalAtras(ahora, n) {
  const d = new Date(ahora);
  return formatearFechaLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n, 12).getTime());
}

/** ¿Entra en `ventana` (hoy/24h/7d)? Usa el instante si existe; si no, el día (soloDia). */
function entraEnVentana(candidata, ventana, ahora) {
  if (ventana === 'todas') return true;
  if (Number.isFinite(candidata.publicadaEn)) {
    if (ventana === 'hoy') return formatearFechaLocal(candidata.publicadaEn) === formatearFechaLocal(ahora);
    const horas = ventana === '24h' ? 24 : 24 * 7;
    return candidata.publicadaEn >= ahora - horas * MS_POR_HORA;
  }
  const dia = candidata.fechaPublicacion;
  if (ventana === 'hoy') return dia === diaLocalAtras(ahora, 0);
  const desde = diaLocalAtras(ahora, ventana === '24h' ? 1 : 7);
  return dia >= desde && dia <= diaLocalAtras(ahora, 0);
}

/**
 * Reparte las candidatas por ventana de fecha. Sin ninguna fecha fiable van a
 * `sinFecha` en cualquier ventana; nada se oculta ni se inventa. Las que solo traen día
 * se devuelven como copia con `soloDia: true`. No lee el reloj: `ahora` (ms) es parámetro.
 */
function clasificarPorFecha(lista, ventana, ahora) {
  const conteos = { hoy: 0, '24h': 0, '7d': 0, todas: 0, sinFecha: 0 };
  const resultado = { dentro: [], sinFecha: [], fuera: [], conteos };
  if (!Array.isArray(lista) || !Number.isFinite(ahora)) return resultado;
  const activa = VENTANAS_FECHA.includes(ventana) ? ventana : 'todas';

  for (const original of lista) {
    if (!original || typeof original !== 'object') continue;
    const traeInstante = Number.isFinite(original.publicadaEn);
    if (!traeInstante && !esFechaISO(original.fechaPublicacion)) {
      resultado.sinFecha.push({ ...original });
      conteos.sinFecha += 1;
      continue;
    }
    const copia = traeInstante ? { ...original } : { ...original, soloDia: true };
    conteos.todas += 1;
    for (const v of ['hoy', '24h', '7d']) {
      if (entraEnVentana(copia, v, ahora)) conteos[v] += 1;
    }
    (entraEnVentana(copia, activa, ahora) ? resultado.dentro : resultado.fuera).push(copia);
  }
  return resultado;
}

/**
 * Adapta una lista de candidatas verificadas al formato que espera compilarBoletin.
 * Atribuye cada dato al medio ("Según X") e incluye medio, URL final y fecha de comprobación.
 * Revalida cada candidata para que ninguna sin verificar llegue al boletín.
 */
function adaptarParaBoletin(lista) {
  if (!Array.isArray(lista)) return [];
  const adaptadas = [];

  for (const candidata of lista) {
    const r = validarCandidata(candidata);
    if (!r.valida) continue;
    const c = r.limpia;
    const fechaComprobacion = formatearFechaLocal(c.verificacion.comprobadaEn);
    const urlFinal = c.verificacion.urlFinal || c.url;
    const textoPublicacion = c.fechaPublicacion
      ? `publicada ${c.fechaPublicacion}`
      : 'sin fecha de publicación';

    const fuentesExtra = c.tambienEn.length > 0
      ? ` | También recogido en: ${c.tambienEn.map((o) => `${o.medio} (${o.url})`).join(', ')}`
      : '';

    const sintesis = c.extracto
      ? `Según ${c.medio}: «${c.extracto}»${fuentesExtra}`
      : `Sin extracto confirmado en la página (enlace comprobado en ${c.medio} el ${fechaComprobacion}).${fuentesExtra}`;

    adaptadas.push({
      titular: c.titular,
      url: urlFinal,
      categoria: `Según ${c.medio} (comprobado el ${fechaComprobacion}; ${textoPublicacion})`,
      sintesis,
    });
  }

  return adaptadas;
}

/**
 * Resume la selección para la barra del informe: `total` = marcadas válidas
 * (existentes y verificadas, vía seleccionarParaInforme) y `ocultas` = las que no están
 * entre los ids visibles por el filtro actual.
 * @returns {{ total: number, ocultas: number }}
 */
function resumenSeleccion(lista, idsMarcados, idsVisibles) {
  const elegidas = seleccionarParaInforme(lista, idsMarcados);
  const visibles = new Set(Array.isArray(idsVisibles) ? idsVisibles.filter(esTextoNoVacio).map((id) => id.trim()) : []);
  const ocultas = elegidas.filter((e) => !visibles.has(e.id)).length;
  return { total: elegidas.length, ocultas };
}

/**
 * Texto de fecha para la tarjeta: con instante, «AAAA-MM-DD HH:MM» en hora local;
 * con solo día, «AAAA-MM-DD (solo día)»; sin fecha fiable, cadena vacía (no se inventa nada).
 */
function textoFechaPublicacion(candidata) {
  if (!candidata || typeof candidata !== 'object') return '';
  if (Number.isFinite(candidata.publicadaEn)) {
    const d = new Date(candidata.publicadaEn);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${formatearFechaLocal(candidata.publicadaEn)} ${hh}:${mm}`;
  }
  if (esFechaISO(candidata.fechaPublicacion)) return `${candidata.fechaPublicacion} (solo día)`;
  return '';
}

const PALABRAS_NUMERO = {
  uno: 1, una: 1, primero: 1, primera: 1,
  dos: 2, segundo: 2, segunda: 2,
  tres: 3, tercero: 3, tercera: 3,
  cuatro: 4, cuarto: 4, cuarta: 4,
  cinco: 5, quinto: 5, quinta: 5,
  seis: 6, sexto: 6, sexta: 6,
  siete: 7, septimo: 7, septima: 7, séptimo: 7, séptima: 7,
  ocho: 8, octavo: 8, octava: 8,
  nueve: 9, noveno: 9, novena: 9,
  diez: 10, decimo: 10, decima: 10, décimo: 10, décima: 10,
};

/**
 * Interpreta si una frase dictada por voz es una orden de selección de candidatas
 * (p. ej. "informe de la 1, la 3 y la 4" o "marca la primera y la tercera").
 * Lo que no sea orden devuelve { tipo: 'ninguna', numeros: [] } para que nunca se
 * escriba como noticia nueva.
 */
function interpretarOrdenVoz(texto) {
  if (typeof texto !== 'string' || !texto.trim()) {
    return { tipo: 'ninguna', numeros: [] };
  }

  const limpio = texto.toLowerCase().trim();
  const tieneVerboSeleccion = /\b(?:informe|marca(?:r)?|selecciona(?:r)?|elige|elegir)\b/i.test(limpio);
  const empiezaConArticulo = /^(?:de\s+)?la\s+(?:\d+|uno|una|primera|dos|segunda|tres|tercera|cuatro|cuarta|cinco|quinta|seis|sexta|siete|s[eé]ptima|ocho|octava|nueve|novena|diez|d[eé]cima)\b/i.test(limpio);

  if (!tieneVerboSeleccion && !empiezaConArticulo) {
    return { tipo: 'ninguna', numeros: [] };
  }

  const regexTokens = /\b(\d+|uno|una|primero|primera|dos|segundo|segunda|tres|tercero|tercera|cuatro|cuarto|cuarta|cinco|quinto|quinta|seis|sexto|sexta|siete|s[eé]ptimo|s[eé]ptima|ocho|octavo|octava|nueve|noveno|novena|diez|d[eé]cimo|d[eé]cima)\b/gi;
  const vistos = new Set();
  const numeros = [];
  let match;

  while ((match = regexTokens.exec(limpio)) !== null) {
    const token = match[1].toLowerCase();
    const valor = /^\d+$/.test(token) ? parseInt(token, 10) : PALABRAS_NUMERO[token];
    if (Number.isInteger(valor) && valor >= 1 && !vistos.has(valor)) {
      vistos.add(valor);
      numeros.push(valor);
    }
  }

  if (numeros.length === 0) {
    return { tipo: 'ninguna', numeros: [] };
  }

  return { tipo: 'seleccionar_candidatas', numeros };
}

const PALABRAS_VACIAS_BUSQUEDA = new Set([
  'las', 'los', 'del', 'con', 'para', 'por', 'una', 'uno', 'unos', 'unas',
  'sobre', 'hacia', 'entre', 'desde', 'hasta', 'como', 'mas', 'pero', 'sus',
  'noticias', 'recientes', 'actualidad', 'informacion', 'ano', 'anos', 'que',
]);

/**
 * Construye una consulta compatible con el motor global de prensa GDELT DOC 2.0
 * (sin tildes ni caracteres especiales que rompan su parser booleano).
 */
function construirConsultaGdelt(tema = '') {
  const sinTildes = String(tema || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const filtroIdioma = '(sourcelang:spanish OR sourcelang:english)';

  if (!sinTildes) {
    return filtroIdioma;
  }

  const palabras = sinTildes
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !PALABRAS_VACIAS_BUSQUEDA.has(p));

  if (palabras.length === 0) {
    return filtroIdioma;
  }

  const terminos = palabras.slice(0, 4);
  return `${terminos.join(' ')} ${filtroIdioma}`;
}

const TIMESPAN_GDELT = Object.freeze({ hoy: '24h', '24h': '24h', '7d': '7d' });

/**
 * URL de GDELT DOC 2.0 con orden por fecha y ventana.
 * Función pura. `todas` y ventanas desconocidas no llevan `timespan`.
 * `max` válido = entero 1-250 (se recorta a 250); cualquier otro valor = 12.
 */
function construirUrlGdelt(tema, ventana, max = 12) {
  const n = Number.isInteger(max) && max >= 1 ? Math.min(max, 250) : 12;
  const timespan = Object.prototype.hasOwnProperty.call(TIMESPAN_GDELT, ventana)
    ? `&timespan=${TIMESPAN_GDELT[ventana]}`
    : '';
  return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(tema)}`
    + `&mode=ArtList&maxrecords=${n}&format=json&sort=DateDesc${timespan}`;
}

const MARGEN_FUTURO_MS = 10 * 60 * 1000;

/**
 * GDELT `seendate` (YYYYMMDDTHHMMSSZ, UTC) → instante en ms, o null si no es válido.
 */
function instanteDesdeGdelt(seendate) {
  if (typeof seendate !== 'string') return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate.trim());
  if (!m) return null;
  const [anio, mes, dia, hora, min, seg] = m.slice(1).map(Number);
  const ms = Date.UTC(anio, mes - 1, dia, hora, min, seg);
  const f = new Date(ms);
  const coincide = f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia
    && f.getUTCHours() === hora && f.getUTCMinutes() === min && f.getUTCSeconds() === seg;
  return coincide ? ms : null;
}

/**
 * Fecha RSS → instante en ms SOLO si trae zona explícita (Z, GMT, UTC, ±hh:mm o ±hhmm) y hora.
 * Sin zona devuelve null: no se adivina la zona del medio.
 */
function instanteDesdeRss(texto) {
  if (typeof texto !== 'string') return null;
  let t = texto.trim();
  if (!/\d{1,2}:\d{2}/.test(t)) return null;
  if (!/(?:Z|GMT|UTC)$/i.test(t) && !/[+-]\d{2}:?\d{2}$/.test(t)) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})[T\s]+(.+)$/.exec(t);
  if (iso) {
    t = `${iso[1]}T${iso[2].replace(/\s+/g, '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')}`;
  }
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Decide la fecha de una candidata: día LOCAL (nunca toISOString) e instante opcional.
 * Una fecha futura (instante > ahora+10 min, o día local posterior al de `ahora`)
 * no es fiable: se devuelve sin fecha.
 */
function resolverFecha(instante, diaTexto, ahora) {
  const tieneInstante = typeof instante === 'number' && Number.isFinite(instante);
  if (tieneInstante) {
    if (instante > ahora + MARGEN_FUTURO_MS) return {};
    return { fechaPublicacion: formatearFechaLocal(instante), publicadaEn: instante };
  }
  if (esFechaISO(diaTexto)) {
    if (diaTexto > formatearFechaLocal(ahora)) return {};
    return { fechaPublicacion: diaTexto };
  }
  return {};
}

/**
 * Convierte la lista de artículos reales devuelta por GDELT DOC 2.0 en candidatas
 * normalizadas y validadas (sin inventar extracto cuando el índice solo aporta titular/URL).
 */
function mapearArticulosGdelt(articulos, ahora = Date.now()) {
  if (!Array.isArray(articulos)) return [];
  const ahoraEf = typeof ahora === 'number' && Number.isFinite(ahora) ? ahora : Date.now();
  const vistasUrl = new Set();
  const vistosTitulares = new Set();
  const resultado = [];

  for (const art of articulos) {
    if (!art || typeof art !== 'object') continue;
    const titular = esTextoNoVacio(art.title) ? art.title.replace(/\s+/g, ' ').trim() : '';
    const url = esUrlHttp(art.url) ? art.url.trim() : '';
    if (!titular || !url) continue;

    const claveTitular = titular.toLowerCase();
    if (vistasUrl.has(url) || vistosTitulares.has(claveTitular)) continue;

    let medio = esTextoNoVacio(art.domain) ? art.domain.trim() : '';
    if (!medio) {
      try {
        medio = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        medio = 'Prensa internacional';
      }
    }

    const instante = instanteDesdeGdelt(art.seendate);
    let diaTexto;
    if (instante === null && typeof art.seendate === 'string' && /^\d{8}T/.test(art.seendate)) {
      diaTexto = `${art.seendate.slice(0, 4)}-${art.seendate.slice(4, 6)}-${art.seendate.slice(6, 8)}`;
    }
    const { fechaPublicacion, publicadaEn } = resolverFecha(instante, diaTexto, ahoraEf);

    const candidata = {
      id: url,
      titular,
      medio,
      url,
      extracto: '',
      verificacion: {
        estado: 'ok',
        urlFinal: url,
        tituloPagina: titular,
        comprobadaEn: ahoraEf,
      },
    };
    if (fechaPublicacion) candidata.fechaPublicacion = fechaPublicacion;
    if (publicadaEn !== undefined) candidata.publicadaEn = publicadaEn;

    const validada = validarCandidata(candidata);
    if (validada.valida) {
      vistasUrl.add(url);
      vistosTitulares.add(claveTitular);
      resultado.push(validada.limpia);
    }
  }

  return resultado;
}

/**
 * Convierte items RSS (de api.rss2json.com) en candidatas verificadas con su extracto
 * literal tomado del feed del medio, filtrando opcionalmente por palabras clave del tema.
 */
function mapearItemsRss(items, medioPorDefecto = 'Prensa internacional', temaFiltro = '', ahora = Date.now()) {
  if (!Array.isArray(items)) return [];
  const ahoraEf = typeof ahora === 'number' && Number.isFinite(ahora) ? ahora : Date.now();

  const palabrasFiltro = String(temaFiltro || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 4 && !PALABRAS_VACIAS_BUSQUEDA.has(p));

  const resultado = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const titular = esTextoNoVacio(item.title) ? item.title.replace(/\s+/g, ' ').trim() : '';
    const url = esUrlHttp(item.link) ? item.link.trim() : '';
    if (!titular || !url) continue;

    const descLimpia = typeof item.description === 'string'
      ? item.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    if (palabrasFiltro.length > 0) {
      const textoCompleto = `${titular} ${descLimpia}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const coincideAlguna = palabrasFiltro.some((p) => textoCompleto.includes(p));
      if (!coincideAlguna) continue;
    }

    const instante = instanteDesdeRss(item.pubDate);
    let diaTexto;
    if (instante === null && typeof item.pubDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.pubDate.trim())) {
      diaTexto = item.pubDate.trim().slice(0, 10);
    }
    const { fechaPublicacion, publicadaEn } = resolverFecha(instante, diaTexto, ahoraEf);

    const candidata = {
      id: url,
      titular,
      medio: esTextoNoVacio(medioPorDefecto) ? medioPorDefecto.trim() : 'Prensa internacional',
      url,
      extracto: descLimpia.slice(0, 280),
      verificacion: {
        estado: 'ok',
        urlFinal: url,
        tituloPagina: titular,
        comprobadaEn: ahoraEf,
      },
    };
    if (fechaPublicacion) candidata.fechaPublicacion = fechaPublicacion;
    if (publicadaEn !== undefined) candidata.publicadaEn = publicadaEn;

    const validada = validarCandidata(candidata);
    if (validada.valida) {
      resultado.push(validada.limpia);
    }
  }

  return resultado;
}




