/*
 * candidatas-ui.js — Capa de presentación de la bandeja de candidatas.
 * Se carga después de app.js y comparte su ámbito global; sólo pinta y liga eventos.
 * La lógica vive en candidatas.js.
 */

/* --- Módulo: Bandeja de Candidatas IA + Buscador Directo Móvil --- */
const listaCandidatas = document.getElementById('lista-candidatas');
const candidatasVacio = document.getElementById('candidatas-vacio');
const candidatasDescartadasAviso = document.getElementById('candidatas-descartadas-aviso');
const insigniaConteoCandidatas = document.getElementById('insignia-conteo-candidatas');
const formCandidatas = document.getElementById('form-candidatas');
const btnInformeCandidatas = document.getElementById('btn-informe-candidatas');
const btnCopiarMdCandidatas = document.getElementById('btn-copiar-md-candidatas');
const btnDesmarcarCandidatas = document.getElementById('btn-desmarcar-candidatas');
const accionesCandidatas = document.getElementById('acciones-candidatas');
const exitoCandidatas = document.getElementById('exito-candidatas');
const inputBusquedaDirecta = document.getElementById('input-busqueda-directa');
const btnBuscarInternetAhora = document.getElementById('btn-buscar-internet-ahora');
const estadoBusquedaDirecta = document.getElementById('estado-busqueda-directa');

const CLAVE_CANDIDATAS_MOVIL = 'diario-candidatas-movil:v1';
const FUENTES_RSS_MOVIL = [
  { medio: 'BBC Mundo', url: 'https://feeds.bbci.co.uk/mundo/rss.xml' },
  { medio: 'France 24 Español', url: 'https://www.france24.com/es/rss' },
  { medio: 'El País Internacional', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada' },
  { medio: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
];

let candidatasOrdenadas = [];
// lo que muestra el filtro (dentro de la ventana + sin fecha fiable), con la
// numeración visible que usa la voz. La ventana elegida NO se guarda.
let candidatasVisibles = [];
let ventanaFecha = '24h';

function cargarCandidatasCombinadas() {
  const desdeArchivo = typeof candidatas_busqueda !== 'undefined' && Array.isArray(candidatas_busqueda)
    ? candidatas_busqueda
    : [];
  let desdeMovil = [];
  try {
    const crudo = localStorage.getItem(CLAVE_CANDIDATAS_MOVIL);
    if (crudo) {
      const parsed = JSON.parse(crudo);
      if (Array.isArray(parsed)) desdeMovil = parsed;
    }
  } catch {
    desdeMovil = [];
  }

  // Combinar sin duplicar por URL
  const vistas = new Set();
  const combinadas = [];
  for (const c of [...desdeMovil, ...desdeArchivo]) {
    if (!c || !c.url || vistas.has(c.url)) continue;
    vistas.add(c.url);
    combinadas.push(c);
  }
  return combinadas;
}

function mostrarExitoCandidatas(mensaje) {
  if (!exitoCandidatas) return;
  exitoCandidatas.textContent = mensaje;
  exitoCandidatas.hidden = false;
  setTimeout(() => {
    exitoCandidatas.hidden = true;
  }, 4000);
}

// las marcas viven en un Set de ids, no en el DOM.
const idsMarcadosCandidatas = new Set();

function obtenerCandidatasElegidas() {
  return seleccionarParaInforme(candidatasOrdenadas, Array.from(idsMarcadosCandidatas));
}

// Marca por número visible (data-numero) para la voz; devuelve true si existía esa fila.
function marcarCandidataPorNumero(numero) {
  const idx = numero - 1;
  if (idx < 0 || idx >= candidatasVisibles.length) return false;
  const id = candidatasVisibles[idx].id;
  idsMarcadosCandidatas.add(id);
  document.querySelectorAll('.candidata-checkbox').forEach((cb) => {
    if (cb.value === id) cb.checked = true;
  });
  return true;
}

function actualizarBotonCandidatas() {
  const idsVisibles = candidatasVisibles.map((c) => c.id);
  const { total, ocultas } = resumenSeleccion(candidatasOrdenadas, Array.from(idsMarcadosCandidatas), idsVisibles);
  const deshabilitar = total === 0;
  const spanOcultas = document.getElementById('ocultas-candidatas');
  if (spanOcultas) {
    spanOcultas.textContent = `(${ocultas} oculta${ocultas === 1 ? '' : 's'} por el filtro)`;
    spanOcultas.hidden = ocultas === 0;
  }
  if (accionesCandidatas) {
    accionesCandidatas.hidden = deshabilitar;
  }
  const contador = document.getElementById('contador-candidatas');
  if (contador) {
    contador.textContent = `${total} seleccionada${total === 1 ? '' : 's'}`;
  }
  if (btnInformeCandidatas) {
    btnInformeCandidatas.disabled = deshabilitar;
  }
  if (btnCopiarMdCandidatas) {
    btnCopiarMdCandidatas.disabled = deshabilitar;
  }
}

async function buscarNoticiasEnVivoNavegador(temaOpcional) {
  const tema = (typeof temaOpcional === 'string' && temaOpcional.trim())
    ? temaOpcional.trim()
    : (inputBusquedaDirecta ? inputBusquedaDirecta.value.trim() : '');

  if (!tema) {
    if (estadoBusquedaDirecta) {
      estadoBusquedaDirecta.textContent = 'Escribe un tema para buscar noticias.';
    }
    return;
  }

  if (btnBuscarInternetAhora) {
    btnBuscarInternetAhora.disabled = true;
    btnBuscarInternetAhora.textContent = '⏳ Buscando en prensa...';
  }
  if (estadoBusquedaDirecta) {
    estadoBusquedaDirecta.textContent = `⏳ Consultando índices de prensa internacional sobre "${tema}"...`;
  }

  const nuevasCandidatas = [];
  const ahora = Date.now();

  try {
    // 1. Consulta a GDELT DOC 2.0 Global News API (CORS abierto, sin claves)
    const queryGdelt = construirConsultaGdelt(tema);
    const urlGdelt = construirUrlGdelt(queryGdelt, ventanaFecha);

    const promesasRss = FUENTES_RSS_MOVIL.map((f) =>
      fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(f.url)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => (data && Array.isArray(data.items)
          ? mapearItemsRss(data.items, f.medio, tema, ahora)
          : []))
        .catch(() => [])
    );

    const promesaGdelt = fetch(urlGdelt)
      .then(async (r) => {
        if (!r.ok) return [];
        const txt = await r.text();
        if (!txt.trim().startsWith('{')) return [];
        const data = JSON.parse(txt);
        return mapearArticulosGdelt(data.articles || [], ahora);
      })
      .catch(() => []);

    const [listaGdelt, ...listasRss] = await Promise.all([promesaGdelt, ...promesasRss]);

    for (const lista of listasRss) {
      nuevasCandidatas.push(...lista);
    }
    nuevasCandidatas.push(...listaGdelt);

    // Si el filtro temático en RSS no arrojó coincidencias y GDELT estuvo limitado, mostrar titulares internacionales recientes del RSS
    if (nuevasCandidatas.length === 0) {
      const respaldoRss = await Promise.all(
        FUENTES_RSS_MOVIL.slice(0, 2).map((f) =>
          fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(f.url)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => (data && Array.isArray(data.items)
              ? mapearItemsRss(data.items.slice(0, 5), f.medio, '', ahora)
              : []))
            .catch(() => [])
        )
      );
      for (const lista of respaldoRss) {
        nuevasCandidatas.push(...lista);
      }
    }

    const { validas } = filtrarValidas(nuevasCandidatas);
    const ordenadas = ordenarCandidatas(validas);

    if (ordenadas.length > 0) {
      try {
        localStorage.setItem(CLAVE_CANDIDATAS_MOVIL, JSON.stringify(ordenadas));
      } catch {
        // Ignorar si localStorage está lleno
      }
      if (typeof renderBandejaCandidatas === 'function') {
        renderBandejaCandidatas();
      }
      if (estadoBusquedaDirecta) {
        estadoBusquedaDirecta.textContent = `✅ Se encontraron ${ordenadas.length} noticias reales en prensa internacional sobre "${tema}". Marca las que quieras incluir en tu informe.`;
      }
    } else if (estadoBusquedaDirecta) {
      estadoBusquedaDirecta.textContent = `⚠️ No se pudieron recuperar noticias nuevas sobre "${tema}" en este momento (verifica tu conexión a internet o intenta de nuevo en unos segundos).`;
    }
  } catch (err) {
    if (estadoBusquedaDirecta) {
      estadoBusquedaDirecta.textContent = `⚠️ Error de red al consultar prensa internacional: comprueba tu conexión a internet.`;
    }
  } finally {
    if (btnBuscarInternetAhora) {
      btnBuscarInternetAhora.disabled = false;
      btnBuscarInternetAhora.textContent = '🔎 Buscar en Internet Ahora';
    }
  }
}

if (btnBuscarInternetAhora) {
  btnBuscarInternetAhora.addEventListener('click', () => {
    buscarNoticiasEnVivoNavegador();
  });
}
if (inputBusquedaDirecta) {
  inputBusquedaDirecta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarNoticiasEnVivoNavegador();
    }
  });
}

if (listaCandidatas) {
  function renderBandejaCandidatas() {
    const loteEntrada = cargarCandidatasCombinadas();
    const { validas, descartadas } = filtrarValidas(loteEntrada);
    candidatasOrdenadas = ordenarCandidatas(validas);

    if (insigniaConteoCandidatas) {
      insigniaConteoCandidatas.textContent = `${candidatasOrdenadas.length} verificada${candidatasOrdenadas.length === 1 ? '' : 's'}`;
    }

    if (candidatasDescartadasAviso) {
      if (descartadas.length > 0) {
        candidatasDescartadasAviso.hidden = false;
        candidatasDescartadasAviso.textContent = `🛡️ Se descartaron ${descartadas.length} candidata${descartadas.length === 1 ? '' : 's'} por no superar la verificación obligatoria.`;
      } else {
        candidatasDescartadasAviso.hidden = true;
      }
    }

    candidatasVacio.hidden = candidatasOrdenadas.length > 0;
    pintarBandejaCandidatas();
  }

  // reparte por la ventana elegida y pinta sin nueva petición.
  const ETIQUETA_VENTANA = { hoy: 'Hoy', '24h': 'Últimas 24 h', '7d': '7 días', todas: 'Todas' };
  const NOMBRE_VENTANA = { hoy: 'hoy', '24h': 'las últimas 24 h', '7d': 'los últimos 7 días' };
  const listaSinFecha = document.getElementById('lista-sin-fecha-candidatas');
  const detallesSinFecha = document.getElementById('sin-fecha-candidatas');
  const resumenSinFecha = document.getElementById('resumen-sin-fecha-candidatas');
  const avisoFuera = document.getElementById('aviso-fuera-candidatas');
  const textoFuera = document.getElementById('texto-fuera-candidatas');
  const btnVerTodas = document.getElementById('btn-ver-todas-candidatas');
  const avisoVentana = document.getElementById('aviso-ventana-candidatas');
  const filtroFecha = document.getElementById('filtro-fecha-candidatas');

  function pintarBandejaCandidatas() {
    const { dentro, sinFecha, fuera, conteos } = clasificarPorFecha(candidatasOrdenadas, ventanaFecha, Date.now());
    candidatasVisibles = [...dentro, ...sinFecha];

    filtroFecha.querySelectorAll('input[name="ventana-fecha"]').forEach((radio) => {
      radio.checked = radio.value === ventanaFecha;
    });
    filtroFecha.querySelectorAll('[data-ventana]').forEach((span) => {
      span.textContent = `${ETIQUETA_VENTANA[span.dataset.ventana]} (${conteos[span.dataset.ventana]})`;
    });

    if (candidatasOrdenadas.length > 0 && dentro.length === 0 && ventanaFecha !== 'todas') {
      const otras = VENTANAS_FECHA.filter((v) => v !== ventanaFecha)
        .map((v) => `${ETIQUETA_VENTANA[v]}: ${conteos[v]}`).join(' · ');
      avisoVentana.textContent = `0 en ${NOMBRE_VENTANA[ventanaFecha]} · ${otras}`;
      avisoVentana.hidden = false;
    } else {
      avisoVentana.textContent = '';
      avisoVentana.hidden = true;
    }

    listaCandidatas.textContent = '';
    dentro.forEach((c, i) => listaCandidatas.appendChild(crearTarjetaCandidata(c, i + 1)));

    listaSinFecha.textContent = '';
    sinFecha.forEach((c, i) => listaSinFecha.appendChild(crearTarjetaCandidata(c, dentro.length + i + 1)));
    resumenSinFecha.textContent = `Sin fecha fiable (${sinFecha.length})`;
    detallesSinFecha.hidden = sinFecha.length === 0;

    textoFuera.textContent = `${fuera.length} más ${fuera.length === 1 ? 'antigua oculta' : 'antiguas ocultas'} por este filtro ·`;
    avisoFuera.hidden = fuera.length === 0;

    actualizarBotonCandidatas();
  }

  filtroFecha.addEventListener('change', (e) => {
    if (!VENTANAS_FECHA.includes(e.target.value)) return;
    ventanaFecha = e.target.value;
    pintarBandejaCandidatas();
  });

  btnVerTodas.addEventListener('click', () => {
    ventanaFecha = 'todas';
    pintarBandejaCandidatas();
    const radioTodas = filtroFecha.querySelector('input[value="todas"]');
    if (radioTodas) radioTodas.focus();
  });

  function crearTarjetaCandidata(c, numero) {
      const li = document.createElement('li');
      li.className = 'tarjeta-noticia tarjeta-candidata';

      const cabecera = document.createElement('div');
      cabecera.className = 'tarjeta-noticia-cabecera';

      const label = document.createElement('label');
      label.className = 'candidata-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'candidata-checkbox';
      checkbox.value = c.id;
      checkbox.dataset.numero = String(numero);
      checkbox.checked = idsMarcadosCandidatas.has(c.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) idsMarcadosCandidatas.add(c.id);
        else idsMarcadosCandidatas.delete(c.id);
        actualizarBotonCandidatas();
      });

      const titular = document.createElement('h4');
      titular.className = 'tarjeta-noticia-titular';
      titular.textContent = `${numero}. ${c.titular}`;

      label.append(checkbox, titular);
      cabecera.appendChild(label);

      // Metadatos: medio ("Según X"), fecha de publicación, repercusión (si hay >1 medio) y estado de verificación
      const meta = document.createElement('div');
      meta.className = 'candidata-meta';

      const badgeMedio = document.createElement('span');
      badgeMedio.className = 'candidata-badge-medio';
      badgeMedio.textContent = `Según ${c.medio}`;
      meta.appendChild(badgeMedio);

      const textoFecha = textoFechaPublicacion(c);
      if (textoFecha) {
        const spanFecha = document.createElement('span');
        spanFecha.className = 'candidata-fecha';
        spanFecha.textContent = `Publicación: ${textoFecha}`;
        meta.appendChild(spanFecha);
      }

      const numFuentes = contarFuentes(c);
      if (numFuentes > 1) {
        const badgeFuentes = document.createElement('span');
        badgeFuentes.className = 'insignia-modulo candidata-repercusion';
        badgeFuentes.textContent = `📊 ${numFuentes} medios`;
        meta.appendChild(badgeFuentes);
      }

      const fechaComprobacion = formatearFechaLocal(c.verificacion.comprobadaEn);
      const badgeVerificacion = document.createElement('span');
      badgeVerificacion.className = 'candidata-estado-verificacion';
      badgeVerificacion.textContent = `🔗 Enlace comprobado (${fechaComprobacion})`;
      meta.appendChild(badgeVerificacion);

      // Enlace clicable a la URL final comprobada
      const urlFinal = c.verificacion.urlFinal || c.url;
      const enlace = document.createElement('a');
      enlace.className = 'tarjeta-noticia-enlace';
      enlace.href = urlFinal;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.textContent = urlFinal;

      li.append(cabecera, meta, enlace);

      // Extracto literal o aviso honesto de "sin confirmar contenido"
      const extracto = document.createElement('p');
      if (c.extracto) {
        extracto.className = 'tarjeta-noticia-sintesis';
        extracto.textContent = `«${c.extracto}» — según ${c.medio}`;
      } else {
        extracto.className = 'tarjeta-noticia-sintesis candidata-sin-extracto';
        extracto.textContent = '⚠️ Sin extracto literal confirmado en la página descargada (posible muro de pago o resumen omitido por seguridad).';
      }
      li.appendChild(extracto);

      // Si otros medios recogen el mismo hecho (tambienEn), mostrar enlaces clicables
      if (Array.isArray(c.tambienEn) && c.tambienEn.length > 0) {
        const bloqueTambien = document.createElement('div');
        bloqueTambien.className = 'candidata-tambien-en';
        const etq = document.createElement('span');
        etq.textContent = 'También recogido en: ';
        bloqueTambien.appendChild(etq);

        c.tambienEn.forEach((otro, idx) => {
          if (idx > 0) bloqueTambien.appendChild(document.createTextNode(' · '));
          const aOtro = document.createElement('a');
          aOtro.href = otro.url;
          aOtro.target = '_blank';
          aOtro.rel = 'noopener noreferrer';
          aOtro.className = 'tarjeta-noticia-enlace';
          aOtro.textContent = otro.medio;
          bloqueTambien.appendChild(aOtro);
        });

        li.appendChild(bloqueTambien);
      }

      return li;
  }

  formCandidatas.addEventListener('submit', (e) => {
    e.preventDefault();
    // «Crear informe» solo abre la vista previa; no descarga.
    abrirVistaPreviaInforme();
  });

  /* --- Vista previa del informe --- */
  const seccionVistaPrevia = document.getElementById('vista-previa-informe');
  const resumenVistaPrevia = document.getElementById('resumen-vista-previa');
  const ocultasVistaPrevia = document.getElementById('ocultas-vista-previa');
  const listaVistaPrevia = document.getElementById('lista-vista-previa');
  const avisoVistaPrevia = document.getElementById('aviso-vista-previa');
  const btnDescargarVistaPrevia = document.getElementById('btn-descargar-vista-previa');
  const btnCopiarVistaPrevia = document.getElementById('btn-copiar-vista-previa');
  const btnCerrarVistaPrevia = document.getElementById('btn-cerrar-vista-previa');
  let elegidasVistaPrevia = [];

  function construirBoletinCandidatas(elegidas) {
    return compilarBoletin(adaptarParaBoletin(elegidas), {
      fecha: hoyISO(),
      titulo: `Informe de Noticias Verificadas - ${hoyISO()}`,
    });
  }

  // El aviso no desaparece solo: se queda hasta que otra acción lo sustituya o se cierre.
  function avisarVistaPrevia(mensaje) {
    avisoVistaPrevia.textContent = mensaje;
    avisoVistaPrevia.hidden = false;
  }

  function lineaVistaPrevia(clase, texto) {
    const span = document.createElement('span');
    span.className = clase;
    span.textContent = texto;
    return span;
  }

  function abrirVistaPreviaInforme() {
    const elegidas = obtenerCandidatasElegidas();
    if (elegidas.length === 0 || !seccionVistaPrevia) return;
    elegidasVistaPrevia = elegidas;

    const idsVisibles = candidatasVisibles.map((c) => c.id);
    const { total, ocultas } = resumenSeleccion(candidatasOrdenadas, Array.from(idsMarcadosCandidatas), idsVisibles);
    resumenVistaPrevia.textContent = `${total} noticia${total === 1 ? '' : 's'} en el informe.`;
    ocultasVistaPrevia.textContent = `(${ocultas} oculta${ocultas === 1 ? '' : 's'} por el filtro)`;
    ocultasVistaPrevia.hidden = ocultas === 0;

    listaVistaPrevia.textContent = '';
    elegidas.forEach((c) => {
      const li = document.createElement('li');
      li.className = 'vista-previa-item';
      const urlFinal = (c.verificacion && c.verificacion.urlFinal) || c.url;
      const comprobada = c.verificacion ? formatearFechaLocal(c.verificacion.comprobadaEn) : '';
      li.appendChild(lineaVistaPrevia('vista-previa-titular', c.titular));
      li.appendChild(lineaVistaPrevia('vista-previa-dato', `Medio: ${c.medio}`));
      li.appendChild(lineaVistaPrevia('vista-previa-dato', `URL: ${urlFinal}`));
      li.appendChild(lineaVistaPrevia('vista-previa-dato', `Publicada: ${c.fechaPublicacion || 'sin fecha'}`));
      li.appendChild(lineaVistaPrevia('vista-previa-dato', `Comprobada: ${comprobada || 'sin fecha'}`));
      listaVistaPrevia.appendChild(li);
    });

    avisoVistaPrevia.textContent = '';
    avisoVistaPrevia.hidden = true;
    seccionVistaPrevia.hidden = false;
    seccionVistaPrevia.scrollIntoView({ behavior: 'smooth', block: 'start' });
    seccionVistaPrevia.focus({ preventScroll: true });
  }

  if (btnCerrarVistaPrevia) {
    btnCerrarVistaPrevia.addEventListener('click', () => {
      seccionVistaPrevia.hidden = true;
      elegidasVistaPrevia = [];
      avisoVistaPrevia.hidden = true;
      btnInformeCandidatas.focus();
    });
  }

  if (btnDescargarVistaPrevia) {
    btnDescargarVistaPrevia.addEventListener('click', () => {
    if (elegidasVistaPrevia.length === 0) return;
    const boletin = construirBoletinCandidatas(elegidasVistaPrevia);
    const contenidoWord = generarDocumentoWord(boletin);
    const blob = new Blob(['\ufeff', contenidoWord], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `Informe-Noticias-Verificadas-${boletin.fecha}.doc`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    avisarVistaPrevia('Informe Word (.doc) generado con las noticias de la vista previa. Revisa la carpeta de descargas.');
    });
  }

  async function copiarInformeCandidatas(elegidas, avisar) {
    if (elegidas.length === 0) return;
    const markdown = generarDocumentoMarkdown(construirBoletinCandidatas(elegidas));
    try {
      await navigator.clipboard.writeText(markdown);
      avisar('Informe copiado al portapapeles para WhatsApp o celular.');
    } catch {
      avisar('No se pudo copiar automáticamente al portapapeles.');
    }
  }

  if (btnCopiarVistaPrevia) {
    btnCopiarVistaPrevia.addEventListener('click', () => copiarInformeCandidatas(elegidasVistaPrevia, avisarVistaPrevia));
  }

  if (btnCopiarMdCandidatas) {
    btnCopiarMdCandidatas.addEventListener('click', () => {
      copiarInformeCandidatas(obtenerCandidatasElegidas(), mostrarExitoCandidatas);
    });
  }

  if (btnDesmarcarCandidatas) {
    btnDesmarcarCandidatas.addEventListener('click', () => {
      idsMarcadosCandidatas.clear();
      document.querySelectorAll('.candidata-checkbox').forEach((cb) => {
        cb.checked = false;
      });
      actualizarBotonCandidatas();
    });
  }

  renderBandejaCandidatas();
}
