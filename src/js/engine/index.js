import { expandirMes } from './expandir.js';
import { repartirPiscinas } from './reparto.js';
import { generarSemanaRuta } from './rotacion.js';
import { corregirEquidad } from './correccion.js';
import { validar } from './validar.js';
import { semanarDias, dow } from './fechas.js';

// Orquestador de los 5 pasos.
export function generaPlanMes({ rutas, unidades, mes, anio }) {
  const dias = expandirMes({ rutas, mes, anio });                       // Paso 1
  const semanas = semanarDias(dias.map(d => d.fecha));

  // Demanda representativa por ruta: máx. turnos en un día del mes.
  const demandaRuta = {};
  for (const ruta of rutas) demandaRuta[ruta.id] = 0;
  for (const d of dias) {
    const porRuta = {};
    for (const t of d.turnos) porRuta[t.rutaId] = (porRuta[t.rutaId] || 0) + 1;
    for (const [id, n] of Object.entries(porRuta)) demandaRuta[id] = Math.max(demandaRuta[id], n);
  }

  const piscinas0 = repartirPiscinas({ rutas, unidades, nSemanas: semanas.length, demandaRuta }); // Paso 2

  const indisponibilidadDe = new Map(unidades.map(u => [u.id, u.indisponibilidades || []]));
  const esIndisponible = (unidadId, fecha) =>
    (indisponibilidadDe.get(unidadId) || []).some(r => fecha >= r.desde && fecha <= r.hasta);

  const turnosPorSemanaRuta = semanas.map(diasSem => {
    const mapa = {};
    for (const ruta of rutas) mapa[ruta.id] = [];
    for (const fecha of diasSem) {
      const d = dias.find(x => x.fecha === fecha);
      for (const t of d.turnos) mapa[t.rutaId].push({ fecha, turnoIndex: t.turnoIndex, hora: t.hora, rutaNombre: t.rutaNombre, punto: t.punto });
    }
    return mapa;
  });

  const regenerarSemana = (w) => {
    const out = [];
    for (const ruta of rutas) {
      const diasSem = turnosPorSemanaRuta[w][ruta.id]
        .reduce((acc, t) => { (acc[t.fecha] ||= []).push(t); return acc; }, {});
      const asigns = generarSemanaRuta({
        poolUnidades: piscinas0[w][ruta.id],
        diasSemana: Object.keys(diasSem).sort().map(f => ({ fecha: f, turnos: diasSem[f] })),
        indisponibilidad: esIndisponible,
      });
      for (const a of asigns) out.push({ ...a, rutaId: ruta.id });
    }
    return out;
  };

  let asignacionesSemana = semanas.map((_, w) => regenerarSemana(w));   // Paso 3
  const corregido = corregirEquidad({                                    // Paso 4
    piscinas: piscinas0, asignacionesSemana, unidades,
    regenerarSemana, tolerancia: 1,
  });
  asignacionesSemana = corregido.asignacionesSemana;

  const asignaciones = asignacionesSemana.flat();                        // Paso 5
  const { metricas, advertencias } = validar({ dias, asignaciones, unidades });
  return { dias, asignaciones, metricas, advertencias, piscinas: corregido.piscinas };
}