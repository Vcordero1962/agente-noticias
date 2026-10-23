/*
 * app.js — Capa de presentación. Conecta el DOM con la lógica de diario.js.
 *
 * Todo el cálculo vive en diario.js; aquí sólo se pinta y se capturan eventos.
 */

const formulario = document.getElementById('formulario-sesion');
const campoFecha = document.getElementById('fecha');
const campoMateria = document.getElementById('materia');
const campoMinutos = document.getElementById('minutos');
const mensajeError = document.getElementById('error-formulario');
const listaSesiones = document.getElementById('lista-sesiones');
const listaVacia = document.getElementById('lista-vacia');
const botonBorrar = document.getElementById('borrar-todo');
const botonExportar = document.getElementById('exportar-datos');

let sesiones = cargarSesiones();

/** Pinta las tres tarjetas de métricas. */
function pintarMetricas() {
  document.getElementById('racha-actual').textContent = calcularRachaActual(sesiones);
  document.getElementById('racha-maxima').textContent = calcularMejorRacha(sesiones);
  document.getElementById('total-minutos').textContent = calcularMinutosTotales(sesiones);
}

/** Pinta la lista de sesiones agrupada por fecha. */
function pintarLista() {
  listaSesiones.textContent = '';
  const grupos = agruparPorFecha(sesiones);

  listaVacia.hidden = grupos.length > 0;

  for (const { fecha, items } of grupos) {
    const fechaLegible = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(aFecha(fecha));

    const titulo = document.createElement('li');
    titulo.className = 'sesion';
    if (fecha === hoyISO()) titulo.classList.add('sesion-hoy');

    const etiquetaFecha = document.createElement('span');
    etiquetaFecha.className = 'sesion-fecha';
    etiquetaFecha.textContent = fechaLegible;

    const resumen = document.createElement('span');
    resumen.className = 'sesion-materia';
    const materias = items.map((s) => s.materia);
    resumen.textContent = materias.length === 1
      ? materias[0]
      : `${items.length} sesiones: ${materias.join(', ')}`;

    const minutos = document.createElement('span');
    minutos.className = 'sesion-minutos';
    const total = calcularMinutosTotales(items);
    minutos.textContent = `${total} min`;

    titulo.append(etiquetaFecha, resumen, minutos);
    listaSesiones.append(titulo);
  }
}

/** Repinta toda la interfaz. */
function render() {
  pintarMetricas();
  pintarLista();
}

/** Muestra los errores de validación o los oculta. */
function mostrarErrores(errores) {
  if (errores.length === 0) {
    mensajeError.hidden = true;
    mensajeError.textContent = '';
    return;
  }
  mensajeError.hidden = false;
  mensajeError.textContent = errores.join(' ');
}

/** Descarga las sesiones en memoria como archivo JSON. */
function descargarRespaldo() {
  try {
    const json = JSON.stringify(serializar(sesiones), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `diario-estudio-${hoyISO()}.json`;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    mostrarErrores(['No se pudo generar la descarga en este navegador.']);
    mensajeError.scrollIntoView({ block: 'center' });
  }
}

if (formulario) {
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();

    const datos = {
      fecha: campoFecha.value,
      materia: campoMateria.value,
      minutos: campoMinutos.value,
    };

    const errores = validarSesion(datos);
    mostrarErrores(errores);
    if (errores.length > 0) return;

    sesiones = [...sesiones, crearSesion(datos)];
    guardarSesiones(sesiones);
    render();

    campoMateria.value = '';
    campoMateria.focus();
  });

  if (botonBorrar) {
    botonBorrar.addEventListener('click', () => {
      if (!sesiones.length) return;
      const confirmado = window.confirm('¿Seguro que quieres borrar todas las sesiones? Esta acción no se puede deshacer.');
      if (!confirmado) return;

      sesiones = [];
      guardarSesiones(sesiones);
      render();
    });
  }

  if (botonExportar) {
    botonExportar.addEventListener('click', descargarRespaldo);
  }

  if (campoFecha) campoFecha.value = hoyISO();
  mostrarErrores([]);
  render();
}

/* --- Lógica de Interfaz: Curador de Noticias --- */
const formNoticia = document.getElementById('form-noticia');
const inputTitular = document.getElementById('noticia-titular');
const inputFuente = document.getElementById('noticia-fuente');
const inputUrl = document.getElementById('noticia-url');
const errorNoticia = document.getElementById('error-noticia');
const exitoNoticia = document.getElementById('exito-noticia');
const conteoNoticias = document.getElementById('conteo-noticias');
const listaNoticias = document.getElementById('lista-noticias');
const noticiasVacio = document.getElementById('noticias-vacio');
const accionesNoticias = document.getElementById('acciones-noticias');
const btnLimpiarLote = document.getElementById('btn-limpiar-lote');
const btnLimpiarFormNoticia = document.getElementById('btn-limpiar-form-noticia');
const btnGuardarTema = document.getElementById('btn-guardar-tema');
const btnLimpiarVoz = document.getElementById('btn-limpiar-voz');
const btnDescargarWord = document.getElementById('btn-descargar-word');
const btnImprimirPdf = document.getElementById('btn-imprimir-pdf');
const btnCopiarMd = document.getElementById('btn-copiar-md');

function limpiarFormularioNoticia() {
  if (inputTitular) inputTitular.value = '';
  if (inputFuente) inputFuente.value = '';
  if (inputUrl) inputUrl.value = '';
  if (errorNoticia) errorNoticia.hidden = true;
  if (inputTitular) inputTitular.focus();
}

let loteNoticias = [];

function cargarLoteAlmacenado() {
  try {
    const raw = localStorage.getItem('diario-noticias:v1');
    loteNoticias = raw ? JSON.parse(raw) : [];
  } catch {
    loteNoticias = [];
  }
}

function guardarLote() {
  try {
    localStorage.setItem('diario-noticias:v1', JSON.stringify(loteNoticias));
  } catch (e) {
    console.error('Error guardando noticias:', e);
  }
}

function renderNoticias() {
  conteoNoticias.textContent = String(loteNoticias.length);

  if (loteNoticias.length === 0) {
    noticiasVacio.hidden = false;
    accionesNoticias.hidden = true;
    btnLimpiarLote.hidden = true;
    listaNoticias.innerHTML = '';
    return;
  }

  noticiasVacio.hidden = true;
  accionesNoticias.hidden = false;
  btnLimpiarLote.hidden = false;

  listaNoticias.innerHTML = '';
  loteNoticias.forEach((noticia, index) => {
    const li = document.createElement('li');
    li.className = 'tarjeta-noticia';

    const cabecera = document.createElement('div');
    cabecera.className = 'tarjeta-noticia-cabecera';

    const titular = document.createElement('h4');
    titular.className = 'tarjeta-noticia-titular';
    titular.textContent = `${index + 1}. ${noticia.titular}`;

    const btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'btn-eliminar-noticia';
    btnEliminar.textContent = '✕ Quitar';
    btnEliminar.addEventListener('click', () => {
      loteNoticias.splice(index, 1);
      guardarLote();
      renderNoticias();
    });

    cabecera.appendChild(titular);
    cabecera.appendChild(btnEliminar);

    const enlace = document.createElement('a');
    enlace.className = 'tarjeta-noticia-enlace';
    enlace.href = noticia.url;
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    enlace.textContent = `[${noticia.categoria}] ${noticia.url}`;

    li.appendChild(cabecera);
    li.appendChild(enlace);

    if (noticia.sintesis) {
      const sintesis = document.createElement('p');
      sintesis.className = 'tarjeta-noticia-sintesis';
      sintesis.textContent = noticia.sintesis;
      li.appendChild(sintesis);
    }

    listaNoticias.appendChild(li);
  });
}

function mostrarAvisoExito(mensaje) {
  exitoNoticia.textContent = mensaje;
  exitoNoticia.hidden = false;
  setTimeout(() => {
    exitoNoticia.hidden = true;
  }, 4000);
}

if (formNoticia) {
  cargarLoteAlmacenado();
  renderNoticias();

  formNoticia.addEventListener('submit', (e) => {
    e.preventDefault();
    errorNoticia.hidden = true;

    const url = inputUrl.value.trim();
    if (!url) {
      errorNoticia.textContent = 'ℹ️ Para agregar directo al despacho necesitas un enlace web. Si no tienes el enlace, pulsa el botón naranja "🎯 Fijar como tema de búsqueda del Agente" para que el robot lo busque.';
      errorNoticia.hidden = false;
      return;
    }

    const candidata = {
      titular: inputTitular.value,
      url: url,
      categoria: (inputFuente && inputFuente.value.trim()) || 'General',
      sintesis: ''
    };

    const resultado = validarNoticia(candidata);
    if (!resultado.valida) {
      errorNoticia.textContent = resultado.motivo;
      errorNoticia.hidden = false;
      return;
    }

    loteNoticias.push(resultado.limpia);
    guardarLote();
    renderNoticias();

    limpiarFormularioNoticia();
  });

  if (btnGuardarTema) {
    btnGuardarTema.addEventListener('click', () => {
      const tema = inputTitular.value.trim();
      if (!tema) {
        errorNoticia.textContent = 'Escribe o dicta por voz el tema que quieres que el agente explore.';
        errorNoticia.hidden = false;
        inputTitular.focus();
        return;
      }
      errorNoticia.hidden = true;
      localStorage.setItem('diario-tema-activo', tema);
      const inputDirecto = document.getElementById('input-busqueda-directa');
      if (inputDirecto) inputDirecto.value = tema;
      const moduloCand = document.getElementById('modulo-candidatas');
      if (moduloCand) moduloCand.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (typeof buscarNoticiasEnVivoNavegador === 'function') {
        buscarNoticiasEnVivoNavegador(tema);
      } else {
        const fuente = (inputFuente && inputFuente.value.trim()) ? ` (Fuente: ${inputFuente.value.trim()})` : '';
        mostrarAvisoExito(`🎯 Tema fijado: "${tema}"${fuente}.`);
      }
    });
  }

  if (btnLimpiarFormNoticia) {
    btnLimpiarFormNoticia.addEventListener('click', limpiarFormularioNoticia);
  }

  btnLimpiarLote.addEventListener('click', () => {
    if (confirm('¿Vaciar el lote de noticias actual?')) {
      loteNoticias = [];
      guardarLote();
      renderNoticias();
    }
  });

  btnDescargarWord.addEventListener('click', () => {
    if (loteNoticias.length === 0) return;
    const boletin = compilarBoletin(loteNoticias);
    const contenidoWord = generarDocumentoWord(boletin);
    const blob = new Blob(['\ufeff', contenidoWord], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `Boletin-Noticias-${boletin.fecha}.doc`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    mostrarAvisoExito('Documento Word descargado con éxito.');
  });

  btnImprimirPdf.addEventListener('click', () => {
    if (loteNoticias.length === 0) return;
    window.print();
  });

  btnCopiarMd.addEventListener('click', async () => {
    if (loteNoticias.length === 0) return;
    const boletin = compilarBoletin(loteNoticias);
    const markdown = generarDocumentoMarkdown(boletin);
    try {
      await navigator.clipboard.writeText(markdown);
      mostrarAvisoExito('Resumen copiado al portapapeles para WhatsApp o Chat.');
    } catch {
      mostrarAvisoExito('No se pudo copiar directamente.');
    }
  });

  /* --- Reconocimiento de Voz con Micrófono --- */
  const btnMicrofono = document.getElementById('btn-microfono');
  const estadoMicrofono = document.getElementById('estado-microfono');
  const textoBtnVoz = document.getElementById('texto-btn-voz');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition && btnMicrofono) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = true;

    let grabando = false;

    recognition.onstart = () => {
      grabando = true;
      btnMicrofono.classList.add('grabando');
      textoBtnVoz.textContent = 'Escuchando tu voz...';
      estadoMicrofono.textContent = '🎙️ Habla ahora: dicta tu orden, noticia o tema...';
    };

    recognition.onresult = (evento) => {
      let transcripcion = '';
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        transcripcion += evento.results[i][0].transcript;
      }
      estadoMicrofono.textContent = `🎙️ Has dicho: "${transcripcion}"`;

      if (evento.results[0].isFinal) {
        const comando = transcripcion.toLowerCase().trim();

        if (btnLimpiarVoz) btnLimpiarVoz.hidden = false;

        const ordenCandidatas = typeof interpretarOrdenVoz === 'function'
          ? interpretarOrdenVoz(transcripcion)
          : { tipo: 'ninguna', numeros: [] };

        if (comando.includes('iniciar reunión') || comando.includes('comenzar reunión')) {
          if (typeof iniciarReunion === 'function') iniciarReunion();
          estadoMicrofono.textContent = '🎙️ Modo Reunión activado por voz.';
        } else if (comando.includes('finalizar reunión') || comando.includes('terminar reunión')) {
          if (typeof finalizarReunion === 'function') finalizarReunion();
          estadoMicrofono.textContent = '⏹️ Reunión finalizada por voz.';
        } else if (comando.includes('buscar noticias') || comando.includes('buscar en internet') || comando.includes('buscar ahora')) {
          const btnBuscarAhora = document.getElementById('btn-buscar-internet-ahora');
          if (btnBuscarAhora) btnBuscarAhora.click();
          estadoMicrofono.textContent = '🔎 Buscando noticias reales en internet...';
        } else if (comando.includes('descargar informe') || comando.includes('descargar word')) {
          btnDescargarWord.click();
        } else if (comando.includes('guardar pdf') || comando.includes('imprimir')) {
          btnImprimirPdf.click();
        } else if (comando.includes('limpiar formulario') || comando.includes('limpiar campos') || comando.includes('borrar campos') || comando.includes('borrar titular')) {
          limpiarFormularioNoticia();
          estadoMicrofono.textContent = '🧹 Campos del formulario limpiados.';
        } else if (comando.includes('limpiar lote') || comando.includes('vaciar lote')) {
          btnLimpiarLote.click();
        } else if (comando.includes('desmarcar todas') || comando.includes('desmarcar selección') || comando.includes('limpiar selección')) {
          const btnDesmarcar = document.getElementById('btn-desmarcar-candidatas');
          if (btnDesmarcar) btnDesmarcar.click();
          estadoMicrofono.textContent = '🧹 Selección de candidatas desmarcada.';
        } else if (ordenCandidatas.tipo === 'seleccionar_candidatas') {
          //  Seleccionar candidatas por número ("informe de la 1, la 3 y la 4")
          const marcadasAhora = [];
          ordenCandidatas.numeros.forEach((n) => {
            if (marcarCandidataPorNumero(n)) {
              marcadasAhora.push(n);
            }
          });
          if (typeof actualizarBotonCandidatas === 'function') {
            actualizarBotonCandidatas();
          }
          estadoMicrofono.textContent = marcadasAhora.length > 0
            ? `✅ Candidatas marcadas por voz: ${marcadasAhora.join(', ')}.`
            : `ℹ️ Se escuchó la orden (${ordenCandidatas.numeros.join(', ')}), pero no hay esas filas en la bandeja.`;
        } else if (comando.includes('generar selección') || comando.includes('informe de selección')) {
          if (btnInformeCandidatas && !btnInformeCandidatas.disabled) {
            btnInformeCandidatas.click();
          }
        } else {
          //  Lo dictado que no sea orden NUNCA se escribe como noticia en "Titular"
          estadoMicrofono.textContent = `🎙️ Escuchado: "${transcripcion.trim()}". No es una orden reconocida (no se escribe como noticia; di p. ej. "informe de la 1, la 3 y la 4").`;
        }
      }
    };

    if (btnLimpiarVoz) {
      btnLimpiarVoz.addEventListener('click', () => {
        estadoMicrofono.textContent = 'Micrófono listo. Toca para dictar el tema o una orden.';
        btnLimpiarVoz.hidden = true;
      });
    }

    recognition.onerror = (e) => {
      grabando = false;
      btnMicrofono.classList.remove('grabando');
      textoBtnVoz.textContent = 'Activar Micrófono / Orden por Voz';
      estadoMicrofono.textContent = `Aviso de micrófono: ${e.error || 'No se detectó audio'}. Toca para reintentar.`;
    };

    recognition.onend = () => {
      grabando = false;
      btnMicrofono.classList.remove('grabando');
      textoBtnVoz.textContent = 'Activar Micrófono / Orden por Voz';
    };

    btnMicrofono.addEventListener('click', () => {
      if (!grabando) {
        try {
          recognition.start();
        } catch (err) {
          console.warn('Error al iniciar reconocimiento:', err);
        }
      } else {
        recognition.stop();
      }
    });
  } else if (btnMicrofono) {
    btnMicrofono.addEventListener('click', () => {
      estadoMicrofono.textContent = 'ℹ️ Tu navegador no soporta Web Speech nativo. Puedes usar el atajo [Tecla Windows + H] para dictar por voz directamente.';
    });
  }
}
