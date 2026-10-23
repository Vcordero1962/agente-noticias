/*
 * js/agenda-ui.js — Capa de presentación para Modo Reunión y Agenda Ejecutiva.
 * Maneja eventos del DOM, streaming de voz, cronómetro, renderizado de actas, temas e historial.
 */

const btnIniciarReunion = document.getElementById('btn-iniciar-reunion');
const btnFinalizarReunion = document.getElementById('btn-finalizar-reunion');
const btnCancelarReunion = document.getElementById('btn-cancelar-reunion');
const pulsoGrabando = document.getElementById('pulso-grabando');
const cronometroReunion = document.getElementById('reunion-cronometro');
const estadoTextoReunion = document.getElementById('reunion-estado-texto');
const badgeEstadoReunion = document.getElementById('badge-estado-reunion');
const inputTituloReunion = document.getElementById('reunion-titulo');
const inputParticipantesReunion = document.getElementById('reunion-participantes');
const textareaTranscripcion = document.getElementById('reunion-transcripcion-en-vivo');
const conteoPalabrasReunion = document.getElementById('reunion-conteo-palabras');
const btnLimpiarTranscripcion = document.getElementById('btn-limpiar-transcripcion');
const resultadoActa = document.getElementById('reunion-resultado-acta');

let grabacionReunionActiva = false;
let reunionTimerInterval = null;
let reunionSegundos = 0;
let recognitionReunion = null;
let transcripcionFinalAcumulada = '';

function formatearTiempoCronometro(segundos) {
  const mins = Math.floor(segundos / 60);
  const segs = segundos % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(segs).padStart(2, '0');
  return `${mm}:${ss}`;
}

function actualizarConteoPalabras() {
  if (!textareaTranscripcion || !conteoPalabrasReunion) return;
  const texto = textareaTranscripcion.value.trim();
  const palabras = texto ? texto.split(/\s+/).filter(Boolean).length : 0;
  conteoPalabrasReunion.textContent = `${palabras} palabra${palabras === 1 ? '' : 's'}`;
}

function iniciarCronometroReunion() {
  detenerCronometroReunion();
  reunionSegundos = 0;
  if (cronometroReunion) cronometroReunion.textContent = '00:00';
  reunionTimerInterval = setInterval(() => {
    reunionSegundos++;
    if (cronometroReunion) {
      cronometroReunion.textContent = formatearTiempoCronometro(reunionSegundos);
    }
  }, 1000);
}

function detenerCronometroReunion() {
  if (reunionTimerInterval) {
    clearInterval(reunionTimerInterval);
    reunionTimerInterval = null;
  }
}

function iniciarReunion() {
  if (grabacionReunionActiva) return;
  grabacionReunionActiva = true;

  if (btnIniciarReunion) btnIniciarReunion.hidden = true;
  if (btnFinalizarReunion) btnFinalizarReunion.hidden = false;
  if (btnCancelarReunion) btnCancelarReunion.hidden = false;
  if (pulsoGrabando) pulsoGrabando.hidden = false;
  if (badgeEstadoReunion) {
    badgeEstadoReunion.textContent = '🔴 En Grabación';
    badgeEstadoReunion.style.borderColor = '#e5484d';
    badgeEstadoReunion.style.color = '#ff6b6b';
  }
  if (estadoTextoReunion) {
    estadoTextoReunion.textContent = 'Escuchando la reunión de forma continua... Hablen con naturalidad.';
  }

  iniciarCronometroReunion();

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    if (!recognitionReunion) {
      recognitionReunion = new SpeechRecognition();
      recognitionReunion.lang = 'es-ES';
      recognitionReunion.continuous = true;
      recognitionReunion.interimResults = true;

      recognitionReunion.onresult = (evento) => {
        let interimTranscript = '';
        for (let i = evento.resultIndex; i < evento.results.length; ++i) {
          if (evento.results[i].isFinal) {
            const fragmentoFinal = evento.results[i][0].transcript.trim();
            if (fragmentoFinal) {
              const comando = fragmentoFinal.toLowerCase();
              if (comando.includes('finalizar reunión') || comando.includes('terminar reunión')) {
                finalizarReunion(true);
                return;
              }
              transcripcionFinalAcumulada += (transcripcionFinalAcumulada ? ' ' : '') + fragmentoFinal;
            }
          } else {
            interimTranscript += evento.results[i][0].transcript;
          }
        }

        if (textareaTranscripcion) {
          const textoCompleto = transcripcionFinalAcumulada + (interimTranscript ? ' ' + interimTranscript : '');
          textareaTranscripcion.value = textoCompleto;
          actualizarConteoPalabras();
          textareaTranscripcion.scrollTop = textareaTranscripcion.scrollHeight;
        }
      };

      recognitionReunion.onerror = (e) => {
        console.warn('Aviso en escucha de reunión:', e.error);
        if (e.error === 'not-allowed') {
          grabacionReunionActiva = false;
          if (estadoTextoReunion) estadoTextoReunion.textContent = '⚠️ Permiso de micrófono no concedido.';
          finalizarReunion(false);
        }
      };

      recognitionReunion.onend = () => {
        if (grabacionReunionActiva) {
          try {
            recognitionReunion.start();
          } catch (err) {
            // Ignorar reintento concurrente
          }
        }
      };
    }

    try {
      recognitionReunion.start();
    } catch (e) {
      console.warn('Reconocimiento en marcha:', e);
    }
  } else {
    if (estadoTextoReunion) {
      estadoTextoReunion.textContent = '🎙️ Escriba o pegue la transcripción en la caja inferior (Navegador sin Web Speech directo).';
    }
  }
}

function finalizarReunion(generarActa = true) {
  grabacionReunionActiva = false;
  detenerCronometroReunion();

  if (recognitionReunion) {
    try {
      recognitionReunion.stop();
    } catch {}
  }

  if (btnIniciarReunion) btnIniciarReunion.hidden = false;
  if (btnFinalizarReunion) btnFinalizarReunion.hidden = true;
  if (btnCancelarReunion) btnCancelarReunion.hidden = true;
  if (pulsoGrabando) pulsoGrabando.hidden = true;
  if (badgeEstadoReunion) {
    badgeEstadoReunion.textContent = '🟢 Finalizada';
    badgeEstadoReunion.style.borderColor = '#10b981';
    badgeEstadoReunion.style.color = '#10b981';
  }
  if (estadoTextoReunion) {
    estadoTextoReunion.textContent = `Reunión finalizada. Duración: ${formatearTiempoCronometro(reunionSegundos)}.`;
  }

  actualizarConteoPalabras();

  if (!generarActa) return;

  const textoTranscrito = textareaTranscripcion ? textareaTranscripcion.value.trim() : '';
  const titulo = (inputTituloReunion && inputTituloReunion.value.trim()) || 'Reunión de Trabajo';
  const participantesRaw = inputParticipantesReunion ? inputParticipantesReunion.value : '';
  const duracionTexto = `${Math.max(1, Math.ceil(reunionSegundos / 60))} min`;

  if (typeof crearReunion === 'function' && typeof analizarTranscripcion === 'function' && typeof compilarActaReunion === 'function') {
    const reunion = crearReunion({
      titulo,
      duracion: duracionTexto,
      participantes: participantesRaw,
      transcripcion: textoTranscrito
    });
    const analisis = analizarTranscripcion(textoTranscrito);
    const acta = compilarActaReunion({
      ...reunion,
      temas: analisis.temas,
      necesidades: analisis.necesidades,
      acuerdos: analisis.acuerdos,
      tareas: analisis.tareas
    });

    if (resultadoActa) {
      mostrarActaEnPantalla(acta);
    }

    if (typeof agregarReunion === 'function' && typeof guardarReuniones === 'function') {
      reunionesGuardadas = agregarReunion(acta, reunionesGuardadas);
      guardarReuniones(reunionesGuardadas);
      if (typeof renderHistorialReuniones === 'function') {
        renderHistorialReuniones();
      }
    }
  }
}

function cancelarReunion() {
  grabacionReunionActiva = false;
  detenerCronometroReunion();
  if (recognitionReunion) {
    try { recognitionReunion.stop(); } catch {}
  }
  if (btnIniciarReunion) btnIniciarReunion.hidden = false;
  if (btnFinalizarReunion) btnFinalizarReunion.hidden = true;
  if (btnCancelarReunion) btnCancelarReunion.hidden = true;
  if (pulsoGrabando) pulsoGrabando.hidden = true;
  if (badgeEstadoReunion) {
    badgeEstadoReunion.textContent = '⚪ En espera';
    badgeEstadoReunion.style.borderColor = 'var(--panel-borde)';
    badgeEstadoReunion.style.color = 'var(--texto-tenue)';
  }
  if (estadoTextoReunion) {
    estadoTextoReunion.textContent = 'Reunión descartada.';
  }
}

function mostrarActaEnPantalla(acta) {
  if (!resultadoActa) return;
  resultadoActa.hidden = false;

  const htmlTemas = acta.temas.length > 0
    ? `<ul class="lista-temas-acta">${acta.temas.map(t => `<li contenteditable="true" title="Haz clic para editar"><strong>${escaparHtml(t.titulo)}:</strong> <span>${escaparHtml(t.detalle)}</span></li>`).join('')}</ul>`
    : '<ul class="lista-temas-acta"><li contenteditable="true">Punto general tratado en la reunión.</li></ul>';

  const htmlNecesidades = acta.necesidades.length > 0
    ? `<ul class="lista-necesidades-acta">${acta.necesidades.map(n => `<li contenteditable="true" title="Haz clic para editar">${escaparHtml(n)}</li>`).join('')}</ul>`
    : '<ul class="lista-necesidades-acta"><li contenteditable="true">Sin requerimientos críticos registrados.</li></ul>';

  const htmlAcuerdos = acta.acuerdos.length > 0
    ? `<ul class="lista-acuerdos-acta">${acta.acuerdos.map(a => `<li contenteditable="true" title="Haz clic para editar">${escaparHtml(a)}</li>`).join('')}</ul>`
    : '<ul class="lista-acuerdos-acta"><li contenteditable="true">Se mantiene seguimiento ordinario.</li></ul>';

  const htmlTareas = acta.tareas.length > 0
    ? `<ul class="lista-tareas-acta">${acta.tareas.map(t => `<li contenteditable="true" title="Haz clic para editar"><strong>${escaparHtml(t.responsable)}:</strong> <span>${escaparHtml(t.accion)}</span></li>`).join('')}</ul>`
    : '<ul class="lista-tareas-acta"><li contenteditable="true"><strong>Equipo:</strong> <span>Revisión de acuerdos.</span></li></ul>';

  resultadoActa.innerHTML = `
    <div class="acta-tarjeta">
      <div class="acta-cabecera">
        <div>
          <h3 contenteditable="true" id="acta-titulo-editable" title="Haz clic para cambiar título">📋 Acta Ejecutiva: ${escaparHtml(acta.titulo)}</h3>
          <p class="subtitulo-modulo">Fecha: ${escaparHtml(acta.fecha)} | Duración: ${escaparHtml(acta.duracion)} | Participantes: ${escaparHtml(acta.participantes.join(', ') || 'Equipo de trabajo')}</p>
          <span class="acta-editable-hint">✏️ <em>Puedes hacer clic en cualquier punto del acta para corregirlo o añadir notas antes de exportar.</em></span>
        </div>
      </div>

      <div class="acta-seccion">
        <h4>📌 1. Principales Temas Tratados</h4>
        ${htmlTemas}
      </div>

      <div class="acta-seccion">
        <h4>💡 2. Necesidades y Requerimientos Planteados</h4>
        ${htmlNecesidades}
      </div>

      <div class="acta-seccion">
        <h4>🤝 3. Acuerdos Tomados</h4>
        ${htmlAcuerdos}
      </div>

      <div class="acta-seccion">
        <h4>✅ 4. Tareas y Acciones de Seguimiento</h4>
        ${htmlTareas}
      </div>

      <div class="acciones-noticias" style="margin-top: 1.2rem;">
        <button type="button" id="btn-descargar-acta-word" class="btn-accion">📄 Descargar Acta en Word (.doc)</button>
        <button type="button" id="btn-imprimir-acta-pdf" class="btn-accion">🖨️ Guardar PDF / Imprimir Acta</button>
        <button type="button" id="btn-copiar-acta-md" class="btn-accion secundario">📋 Copiar Acta en Markdown</button>
      </div>
      <p class="mensaje-exito" id="aviso-acta-exito" role="status" hidden></p>
    </div>
  `;

  function recopilarActaDesdeDOM() {
    const tituloEl = document.getElementById('acta-titulo-editable');
    const tituloFinal = tituloEl ? tituloEl.textContent.replace(/^📋\s*Acta Ejecutiva:\s*/i, '').trim() : acta.titulo;

    const temas = Array.from(resultadoActa.querySelectorAll('.lista-temas-acta li'))
      .map(li => li.textContent.trim())
      .filter(Boolean);

    const necesidades = Array.from(resultadoActa.querySelectorAll('.lista-necesidades-acta li'))
      .map(li => li.textContent.trim())
      .filter(Boolean);

    const acuerdos = Array.from(resultadoActa.querySelectorAll('.lista-acuerdos-acta li'))
      .map(li => li.textContent.trim())
      .filter(Boolean);

    const tareas = Array.from(resultadoActa.querySelectorAll('.lista-tareas-acta li'))
      .map(li => {
        const texto = li.textContent.trim();
        const partes = texto.split(':');
        if (partes.length > 1) {
          return { responsable: partes[0].trim(), accion: partes.slice(1).join(':').trim(), estado: 'Pendiente' };
        }
        return { responsable: 'Equipo', accion: texto, estado: 'Pendiente' };
      })
      .filter(t => t.accion);

    return {
      ...acta,
      titulo: tituloFinal || acta.titulo,
      temas,
      necesidades,
      acuerdos,
      tareas
    };
  }

  const avisoActa = document.getElementById('aviso-acta-exito');
  function mostrarAvisoActa(mensaje) {
    if (!avisoActa) return;
    avisoActa.textContent = mensaje;
    avisoActa.hidden = false;
    setTimeout(() => { avisoActa.hidden = true; }, 3000);
  }

  const btnDescargarActaWord = document.getElementById('btn-descargar-acta-word');
  if (btnDescargarActaWord && typeof generarInformeWordReunion === 'function') {
    btnDescargarActaWord.addEventListener('click', () => {
      const actaFresca = recopilarActaDesdeDOM();
      const contenidoWord = generarInformeWordReunion(actaFresca);
      const blob = new Blob(['\ufeff', contenidoWord], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `Acta-${actaFresca.titulo.replace(/[\s/\\:]+/g, '_')}-${actaFresca.fecha}.doc`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      mostrarAvisoActa('📄 Documento Word del acta descargado con éxito.');
    });
  }

  const btnImprimirActaPdf = document.getElementById('btn-imprimir-acta-pdf');
  if (btnImprimirActaPdf) {
    btnImprimirActaPdf.addEventListener('click', () => {
      window.print();
    });
  }

  const btnCopiarActaMd = document.getElementById('btn-copiar-acta-md');
  if (btnCopiarActaMd && typeof generarInformeMarkdownReunion === 'function') {
    btnCopiarActaMd.addEventListener('click', async () => {
      const actaFresca = recopilarActaDesdeDOM();
      const md = generarInformeMarkdownReunion(actaFresca);
      try {
        await navigator.clipboard.writeText(md);
        mostrarAvisoActa('📋 Acta copiada al portapapeles en formato Markdown.');
        btnCopiarActaMd.textContent = '✅ ¡Acta Copiada!';
        setTimeout(() => { btnCopiarActaMd.textContent = '📋 Copiar Acta en Markdown'; }, 2000);
      } catch {
        mostrarAvisoActa('No se pudo copiar automáticamente.');
      }
    });
  }
}

if (btnIniciarReunion) btnIniciarReunion.addEventListener('click', iniciarReunion);
if (btnFinalizarReunion) btnFinalizarReunion.addEventListener('click', () => finalizarReunion(true));
if (btnCancelarReunion) btnCancelarReunion.addEventListener('click', cancelarReunion);

if (textareaTranscripcion) {
  textareaTranscripcion.addEventListener('input', () => {
    transcripcionFinalAcumulada = textareaTranscripcion.value;
    actualizarConteoPalabras();
  });
}

if (btnLimpiarTranscripcion) {
  btnLimpiarTranscripcion.addEventListener('click', () => {
    if (textareaTranscripcion) textareaTranscripcion.value = '';
    transcripcionFinalAcumulada = '';
    actualizarConteoPalabras();
  });
}

/* --- Banco de Temas y Gestión de Agenda --- */
const formNuevoTema = document.getElementById('form-nuevo-tema-agenda');
const inputNuevoTema = document.getElementById('input-nuevo-tema');
const selectPrioridadTema = document.getElementById('select-prioridad-tema');
const listaTemasAgenda = document.getElementById('lista-temas-agenda');
const conteoTemasAgenda = document.getElementById('conteo-temas-agenda');
const listaHistorialReuniones = document.getElementById('lista-historial-reuniones');
const conteoHistorialReuniones = document.getElementById('conteo-historial-reuniones');
const historialReunionesVacio = document.getElementById('historial-reuniones-vacio');

let temasAgenda = typeof cargarTemasAgenda === 'function' ? cargarTemasAgenda() : [];
let reunionesGuardadas = typeof cargarReuniones === 'function' ? cargarReuniones() : [];

function renderTemasAgenda() {
  if (!listaTemasAgenda) return;
  listaTemasAgenda.innerHTML = '';

  const pendientes = temasAgenda.filter(t => !t.completado).length;
  if (conteoTemasAgenda) {
    conteoTemasAgenda.textContent = `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`;
  }

  if (temasAgenda.length === 0) {
    const li = document.createElement('li');
    li.className = 'vacio-mini';
    li.textContent = 'No hay temas pendientes en la agenda. Añade los asuntos que debes tratar.';
    listaTemasAgenda.appendChild(li);
    return;
  }

  temasAgenda.forEach(tema => {
    const li = document.createElement('li');
    li.className = `tema-item ${tema.completado ? 'completado' : ''}`;

    const cuerpo = document.createElement('div');
    cuerpo.className = 'tema-cuerpo';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(tema.completado);
    checkbox.setAttribute('aria-label', `Marcar tema ${tema.texto} como completado`);
    checkbox.addEventListener('change', () => {
      temasAgenda = alternarTemaAgenda(tema.id, temasAgenda);
      guardarTemasAgenda(temasAgenda);
      renderTemasAgenda();
    });

    const badge = document.createElement('span');
    badge.className = `tema-prioridad ${tema.prioridad}`;
    badge.textContent = tema.prioridad;

    const spanTexto = document.createElement('span');
    spanTexto.textContent = tema.texto;

    cuerpo.append(checkbox, badge, spanTexto);

    const acciones = document.createElement('div');
    acciones.className = 'tema-acciones';

    if (!tema.completado) {
      const btnLlevar = document.createElement('button');
      btnLlevar.type = 'button';
      btnLlevar.className = 'btn-tema';
      btnLlevar.style.padding = '0.2rem 0.5rem';
      btnLlevar.style.fontSize = '0.78rem';
      btnLlevar.textContent = '📌 Tratar en reunión';
      btnLlevar.title = 'Añadir como punto a tratar en la transcripción/notas de la reunión';
      btnLlevar.addEventListener('click', () => {
        if (textareaTranscripcion) {
          const prefijo = textareaTranscripcion.value ? '\n\n' : '';
          textareaTranscripcion.value += `${prefijo}[Tema de Agenda a Tratar]: ${tema.texto}`;
          transcripcionFinalAcumulada = textareaTranscripcion.value;
          actualizarConteoPalabras();
          textareaTranscripcion.focus();
        }
      });
      acciones.appendChild(btnLlevar);
    }

    const btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'btn-eliminar-noticia';
    btnEliminar.innerHTML = '&times;';
    btnEliminar.title = 'Eliminar tema de la agenda';
    btnEliminar.addEventListener('click', () => {
      temasAgenda = eliminarTemaAgenda(tema.id, temasAgenda);
      guardarTemasAgenda(temasAgenda);
      renderTemasAgenda();
    });

    acciones.appendChild(btnEliminar);
    li.append(cuerpo, acciones);
    listaTemasAgenda.appendChild(li);
  });
}

function renderHistorialReuniones() {
  if (!listaHistorialReuniones) return;
  listaHistorialReuniones.innerHTML = '';

  if (conteoHistorialReuniones) {
    conteoHistorialReuniones.textContent = reunionesGuardadas.length;
  }

  if (reunionesGuardadas.length === 0) {
    if (historialReunionesVacio) historialReunionesVacio.hidden = false;
    return;
  }

  if (historialReunionesVacio) historialReunionesVacio.hidden = true;

  reunionesGuardadas.forEach(reunion => {
    const li = document.createElement('li');
    li.className = 'tarjeta-reunion-historial';

    const info = document.createElement('div');
    info.className = 'reunion-info-historial';

    const titulo = document.createElement('h4');
    titulo.textContent = `📋 ${reunion.titulo || 'Reunión sin título'}`;

    const meta = document.createElement('p');
    meta.className = 'reunion-meta-historial';
    const partesMeta = [
      reunion.fecha ? `📅 ${reunion.fecha}` : '',
      reunion.duracion ? `⏱️ ${reunion.duracion}` : '',
      reunion.participantes && reunion.participantes.length > 0 ? `👥 ${reunion.participantes.join(', ')}` : ''
    ].filter(Boolean);
    meta.textContent = partesMeta.join(' | ');

    info.append(titulo, meta);

    const acciones = document.createElement('div');
    acciones.className = 'tema-acciones';

    const btnVer = document.createElement('button');
    btnVer.type = 'button';
    btnVer.className = 'btn-tema';
    btnVer.textContent = '👁️ Ver Acta';
    btnVer.addEventListener('click', () => {
      mostrarActaEnPantalla(reunion);
      if (resultadoActa) resultadoActa.scrollIntoView({ behavior: 'smooth' });
    });

    const btnWord = document.createElement('button');
    btnWord.type = 'button';
    btnWord.className = 'btn-tema';
    btnWord.textContent = '📄 Word';
    btnWord.addEventListener('click', () => {
      if (typeof generarInformeWordReunion === 'function') {
        const contenidoWord = generarInformeWordReunion(reunion);
        const blob = new Blob(['\ufeff', contenidoWord], { type: 'application/msword;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `Acta-${(reunion.titulo || 'Reunion').replace(/[\s/\\:]+/g, '_')}-${reunion.fecha}.doc`;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
    });

    const btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'btn-eliminar-noticia';
    btnEliminar.innerHTML = '&times;';
    btnEliminar.title = 'Eliminar del historial';
    btnEliminar.addEventListener('click', () => {
      reunionesGuardadas = eliminarReunion(reunion.id, reunionesGuardadas);
      guardarReuniones(reunionesGuardadas);
      renderHistorialReuniones();
    });

    acciones.append(btnVer, btnWord, btnEliminar);
    li.append(info, acciones);
    listaHistorialReuniones.appendChild(li);
  });
}

if (formNuevoTema) {
  formNuevoTema.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = inputNuevoTema ? inputNuevoTema.value.trim() : '';
    if (!texto) return;

    const prioridad = selectPrioridadTema ? selectPrioridadTema.value : 'media';
    temasAgenda = agregarTemaAgenda({ texto, prioridad }, temasAgenda);
    guardarTemasAgenda(temasAgenda);
    renderTemasAgenda();

    if (inputNuevoTema) {
      inputNuevoTema.value = '';
      inputNuevoTema.focus();
    }
  });
}

renderTemasAgenda();
renderHistorialReuniones();
