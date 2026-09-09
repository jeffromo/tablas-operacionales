import { aMinutos } from './fechas.js';

const DESCANSO_MINIMO_MIN = 600; // 10 h (spec §11)

// Paso 3: asigna unidades de una piscina a los turnos diarios de UNA ruta
// durante una semana. Determinista y con equidad de carga.
//
// Clave de selección por turno (ordenados por hora):
//   1. menos días trabajados en la semana (equidad de descansos),
//   2. avance gradual: minimiza (lastIdx - turnoIndex - 1) mod T  →  el que
//      hizo el turno t+1 ayer toma hoy el turno t (patrón del PDF),
//   3. orden cíclico de la piscina (desempate estable).
// Ventana de descanso: volver a un turno de índice menor exige >=10 h desde
// la salida anterior; si el mejor candidato la viola, se pasa al siguiente.
export function generarSemanaRuta({ poolUnidades, diasSemana, indisponibilidad }) {
  const estado = new Map(poolUnidades.map((id, i) => [id, { lastIdx: null, lastHora: null, cargas: 0, orden: i }]));
  const asignaciones = [];

  for (const { fecha, turnos } of diasSemana) {
    const T = turnos.length;
    const asignadosHoy = new Set();
    for (const t of turnos) {
      const tIdx = t.turnoIndex;
      const evaluar = (permitirRepetirHoy) => poolUnidades
        .filter(id => (permitirRepetirHoy || !asignadosHoy.has(id))
          && !indisponibilidad(id, fecha)
          && !violaDescanso(estado.get(id), tIdx, aMinutos(t.hora)))
        .map(id => {
          const e = estado.get(id);
          const avance = e.lastIdx === null ? -1 : ((e.lastIdx - tIdx - 1) % T + T) % T;
          return { id, clave: [e.cargas, avance, e.orden] };
        })
        .sort((a, b) => cmp(a.clave, b.clave));
      let candidatos = evaluar(false);
      // FIX (documento: task-4-report.md): el código verbatim del plan hacía
      // `continue` aquí, dejando el turno sin cubrir aunque hubiera unidades
      // disponibles que ya tenían un turno ese día. La regla (a) del brief
      // ("cada turno queda cubierto si hay unidades disponibles") y el test
      // "unidad indisponible" exigen cobertura; se relaja "a lo sumo un turno
      // por día" SOLO como último recurso, respetando indisponibilidad y
      // descanso mínimo.
      if (candidatos.length === 0) candidatos = evaluar(true);
      if (candidatos.length === 0) continue; // turno sin cubrir: lo reporta validar.js
      const elegido = candidatos[0].id;
      asignadosHoy.add(elegido);
      const e = estado.get(elegido);
      e.lastIdx = tIdx; e.lastHora = aMinutos(t.hora); e.cargas++;
      asignaciones.push({ fecha, turnoIndex: tIdx, unidadId: elegido });
    }
  }
  return asignaciones;
}

function violaDescanso(e, tIdx, horaMin) {
  if (e.lastIdx === null || tIdx >= e.lastIdx) return false; // avance hacia adelante: ok
  return horaMin < e.lastHora - (1440 - DESCANSO_MINIMO_MIN); // vuelta atrás exige 10h
}

function cmp(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}