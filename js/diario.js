/*
 * diario.js — Lógica de dominio del Diario de Estudio.
 *
 * Sin dependencias, sin DOM, sin efectos secundarios de red.
 * Todo se persiste en localStorage bajo la clave 'diario-estudio:v1'.
 *
 * Regla clave: un día cuenta para la racha si tiene AL MENOS una sesión,
 * sin importar cuántos minutos se hayan estudiado.
 */

const CLAVE_ALMACEN = 'diario-estudio:v1';
const VERSION_PAQUETE = 1;

/** Devuelve la fecha de hoy en formato YYYY-MM-DD (hora local, no UTC). */
function hoyISO() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** Convierte 'YYYY-MM-DD' a un Date local a medianoche. */
function aFecha(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

/** Devuelve 'YYYY-MM-DD' desplazado `dias` desde `iso` (puede ser negativo). */
function desplazarISO(iso, dias) {
  const fecha = aFecha(iso);
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Días transcurridos entre dos fechas ISO (b - a). */
function diasEntre(aISO, bISO) {
  const ms = aFecha(bISO).getTime() - aFecha(aISO).getTime();
  return Math.round(ms / 86400000);
}

/** Ordena sesiones por fecha descendente y, a igual fecha, más recientes primero. */
function ordenarSesiones(sesiones) {
  return [...sesiones].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    return b.creadaEn - a.creadaEn;
  });
}

/** Conjunto de fechas (Set) con al menos una sesión. */
function fechasConSesion(sesiones) {
  return new Set(sesiones.map((s) => s.fecha));
}

/**
 * Racha actual: días consecutivos con sesión que terminan hoy o ayer.
 * Si la última sesión es de hace más de un día, la racha es 0.
 */
function calcularRachaActual(sesiones, hoy = hoyISO()) {
  const fechas = fechasConSesion(sesiones);
  if (fechas.size === 0) return 0;

  const ultima = [...fechas].sort().at(-1);
  const desfase = diasEntre(ultima, hoy);

  // La racha sigue viva solo si estudiaste hoy o ayer.
  if (desfase > 1) return 0;

  let racha = 1;
  let cursor = ultima;
  while (fechas.has(desplazarISO(cursor, -1))) {
    cursor = desplazarISO(cursor, -1);
    racha += 1;
  }
  return racha;
}

/**
 * Mejor racha: la racha más larga alcanzada históricamente,
 * sin importar si sigue viva. Calcula recorriendo todas las días con sesión.
 */
function calcularMejorRacha(sesiones) {
  const fechas = [...fechasConSesion(sesiones)].sort();
  if (fechas.length === 0) return 0;

  let mejor = 1;
  let actual = 1;

  for (let i = 1; i < fechas.length; i += 1) {
    if (diasEntre(fechas[i - 1], fechas[i]) === 1) {
      actual += 1;
      mejor = Math.max(mejor, actual);
    } else {
      actual = 1;
    }
  }
  return mejor;
}

/** Suma total de minutos estudiados. */
function calcularMinutosTotales(sesiones) {
  return sesiones.reduce((total, s) => total + s.minutos, 0);
}

/** Agrupa las sesiones por fecha, para mostrarlas agrupadas en la lista. */
function agruparPorFecha(sesiones) {
  const mapa = new Map();
  for (const sesion of ordenarSesiones(sesiones)) {
    if (!mapa.has(sesion.fecha)) {
      mapa.set(sesion.fecha, []);
    }
    mapa.get(sesion.fecha).push(sesion);
  }
  return [...mapa.entries()].map(([fecha, items]) => ({ fecha, items }));
}

/** Valida una sesión antes de guardarla. Devuelve un array de errores (vacío = válida). */
function validarSesion({ fecha, materia, minutos }, hoy = hoyISO()) {
  const errores = [];

  if (!fecha) {
    errores.push('La fecha es obligatoria.');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    errores.push('La fecha no tiene un formato válido.');
  } else if (Number.isNaN(aFecha(fecha).getTime()) || desplazarISO(fecha, 0) !== fecha) {
    errores.push('La fecha no existe.');
  } else if (diasEntre(fecha, hoy) < 0) {
    errores.push('No puedes registrar sesiones en fechas futuras.');
  }

  if (!materia || !materia.trim()) {
    errores.push('Indica qué estudiaste.');
  } else if (materia.trim().length > 80) {
    errores.push('El nombre no puede superar los 80 caracteres.');
  }

  const n = Number(minutos);
  if (!Number.isInteger(n) || n < 1) {
    errores.push('Los minutos deben ser un número entero mayor que 0.');
  } else if (n > 1440) {
    errores.push('Una sesión no puede superar los 1440 minutos (24 h).');
  }

  return errores;
}

/** Crea una sesión normalizada. Lanza si los datos no son válidos. */
function crearSesion({ fecha, materia, minutos }) {
  const errores = validarSesion({ fecha, materia, minutos });
  if (errores.length > 0) {
    throw new Error(errores.join(' '));
  }
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fecha,
    materia: materia.trim(),
    minutos: Number(minutos),
    creadaEn: Date.now(),
  };
}

/** Carga las sesiones desde localStorage. Tolera datos corruptos. */
function cargarSesiones() {
  try {
    const crudo = localStorage.getItem(CLAVE_ALMACEN);
    if (!crudo) return [];
    const datos = JSON.parse(crudo);
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

/** Persiste las sesiones en localStorage. */
function guardarSesiones(sesiones) {
  localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(sesiones));
}

/**
 * Empaqueta las sesiones en el formato de exportación.
 * Copia las sesiones tal cual: no recalcula rachas ni minutos.
 */
function serializar(sesiones) {
  return {
    version: VERSION_PAQUETE,
    sesiones: sesiones.map((sesion) => ({ ...sesion })),
  };
}

/** Clave de identidad de una sesión: misma fecha, misma materia y mismos minutos. */
function claveSesion(sesion) {
  if (!sesion || typeof sesion !== 'object' || Array.isArray(sesion)) return '';
  const { fecha, materia, minutos } = sesion;
  return `${fecha}|${String(materia ?? '').trim()}|${Number(minutos)}`;
}

/**
 * Analiza el texto de un archivo exportado y lo clasifica, sin escribir nada.
 *
 * Devuelve { validas, rechazadas, duplicadas, error }:
 *   - validas:    sesiones del archivo que se pueden importar.
 *   - rechazadas: [{ sesion, motivo }] por datos inválidos (validarSesion).
 *   - duplicadas: identicas a `existentes` o repetidas dentro del propio archivo.
 *   - error:      motivo por el que el paquete entero se descarta, o null.
 */
function analizarPaquete(texto, existentes = [], ahora = Date.now()) {
  const resultado = { validas: [], rechazadas: [], duplicadas: [], error: null };

  let paquete;
  try {
    paquete = JSON.parse(texto);
  } catch {
    resultado.error = 'El archivo no es un JSON legible.';
    return resultado;
  }

  if (paquete === null || typeof paquete !== 'object' || Array.isArray(paquete)) {
    resultado.error = 'El archivo no tiene el formato esperado de un respaldo del diario.';
    return resultado;
  }

  if (paquete.version !== VERSION_PAQUETE) {
    resultado.error = `La versión del archivo es la ${String(paquete.version)} y esta app solo entiende la versión ${VERSION_PAQUETE}.`;
    return resultado;
  }

  if (!Array.isArray(paquete.sesiones)) {
    resultado.error = 'El archivo no contiene la lista de sesiones.';
    return resultado;
  }

  const existentesLimpias = Array.isArray(existentes)
    ? existentes.filter((e) => e && typeof e === 'object' && !Array.isArray(e))
    : [];
  const vistos = new Set(existentesLimpias.map(claveSesion));

  const idsEnUso = new Set(existentesLimpias.map((e) => e.id));

  paquete.sesiones.forEach((sesion, indice) => {
    if (sesion === null || typeof sesion !== 'object' || Array.isArray(sesion)) {
      resultado.rechazadas.push({ sesion, motivo: 'No es una sesión válida.' });
      return;
    }

    const motivosTipo = [];
    if (typeof sesion.fecha !== 'string') motivosTipo.push('La fecha debe ser un texto con formato YYYY-MM-DD.');
    if (typeof sesion.materia !== 'string') motivosTipo.push('La materia debe ser un texto.');
    if (typeof sesion.minutos !== 'number') motivosTipo.push('Los minutos deben ser un número.');
    if (motivosTipo.length > 0) {
      resultado.rechazadas.push({ sesion, motivo: motivosTipo.join(' ') });
      return;
    }

    const errores = validarSesion(sesion);
    if (errores.length > 0) {
      resultado.rechazadas.push({ sesion, motivo: errores.join(' ') });
      return;
    }

    const normalizada = {
      id: sesion.id,
      fecha: sesion.fecha,
      materia: sesion.materia.trim(),
      minutos: sesion.minutos,
      creadaEn: sesion.creadaEn,
    };

    const clave = claveSesion(normalizada);
    if (vistos.has(clave)) {
      resultado.duplicadas.push(sesion);
      return;
    }

    normalizada.id = idParaImportada(sesion.id, idsEnUso, ahora, indice);
    normalizada.creadaEn = Number.isFinite(sesion.creadaEn) ? sesion.creadaEn : ahora;

    vistos.add(clave);
    idsEnUso.add(normalizada.id);
    resultado.validas.push(normalizada);
  });

  return resultado;
}

/** Id para una sesión importada: conserva el original si es texto útil y libre; si no, genera uno. */
function idParaImportada(idOriginal, idsEnUso, ahora, indice) {
  if (typeof idOriginal === 'string' && idOriginal.trim() !== '' && !idsEnUso.has(idOriginal)) {
    return idOriginal;
  }
  let id = `importada-${ahora}-${indice}`;
  while (idsEnUso.has(id)) id += '-1';
  return id;
}
