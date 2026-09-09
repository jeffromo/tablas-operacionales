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
    // Guardia de cobertura (spec §5 Paso 4): un swap que mejore equidad pero
    // deje turnos descubiertos se rechaza. La demanda ya está calculada aquí.
    demanda: turnosPorSemanaRuta,
  });
  asignacionesSemana = corregido.asignacionesSemana;

  const asignaciones = asignacionesSemana.flat();                        // Paso 5
  // FIX vs decisión de Task 6: validar.js devuelve el resumen informativo de
  // equidad en el campo aditivo `resumenEquidad` (ya no en `advertencias`);
  // hay que propagarlo al plan para que los consumidores puedan leerlo.
  const { metricas, advertencias, resumenEquidad } = validar({ dias, asignaciones, unidades });
  // Modo explícito con flota sobrante: avisar las unidades que no operan.
  const todasExplicitas = rutas.length > 0 && rutas.every(r => Number.isFinite(+r.asignadas) && +r.asignadas > 0);
  if (todasExplicitas) {
    const suma = rutas.reduce((n, r) => n + Math.floor(+r.asignadas), 0);
    const ociosas = unidades.length - suma;
    if (ociosas > 0) {
      advertencias.push(`${ociosas} ${ociosas === 1 ? 'unidad queda' : 'unidades quedan'} sin asignar a ninguna ruta (no operan en el mes).`);
    }
    // Límite matemático: para que TODAS las unidades pasen por una ruta en el
    // mes hace falta semanas × asignadas >= flota (una ruta con 1 unidad y
    // flota de 20 solo puede ser recorrida por 5 unidades en 5 semanas —
    // capacidad, no un defecto del algoritmo).
    for (const ruta of rutas) {
      const a = Math.floor(+ruta.asignadas);
      if (semanas.length * a < unidades.length) {
        advertencias.push(`Con ${a} ${a === 1 ? 'unidad asignada' : 'unidades asignadas'}, la ruta ${ruta.nombre} no alcanza para que todos los buses la recorran en el mes (hacen falta ${Math.ceil(unidades.length / semanas.length)} o más).`);
      }
    }
  }
  return { dias, asignaciones, metricas, advertencias, resumenEquidad, piscinas: corregido.piscinas };
}