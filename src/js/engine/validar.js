import { diasTrabajados } from './correccion.js';

export function validar({ dias, asignaciones, unidades }) {
  const advertencias = [];
  const asignados = new Set(asignaciones.map(a => `${a.fecha}|${a.rutaId}|${a.turnoIndex}`));

  for (const d of dias) {
    for (const t of d.turnos) {
      if (!asignados.has(`${d.fecha}|${t.rutaId}|${t.turnoIndex}`)) {
        advertencias.push(`${d.fecha}: turno ${t.turnoIndex + 1} de ruta ${t.rutaNombre} (${t.hora}) sin cubrir — flota insuficiente o unidades indisponibles`);
      }
    }
  }

  const cargas = diasTrabajados(asignaciones);
  const metricas = unidades
    .map(u => ({ unidadId: u.id, diasTrabajados: cargas.get(u.id) || 0 }))
    .sort((a, b) => a.unidadId.localeCompare(b.unidadId, undefined, { numeric: true }));

  // FIX vs brief: el resumen de equidad es informativo, no un problema; el código
  // verbatim lo empujaba a `advertencias` SIEMPRE que hubiera unidades, de modo
  // que `generaPlanMes` nunca devolvía `advertencias: []` y contradecía su propio
  // test (assert plan.advertencias.length === 0 con cobertura total). Se devuelve
  // como campo propio `resumenEquidad` y `advertencias` queda solo con problemas.
  let resumenEquidad = null;
  if (metricas.length) {
    const vals = metricas.map(m => m.diasTrabajados);
    resumenEquidad = `Equidad: min ${Math.min(...vals)}, max ${Math.max(...vals)}, promedio ${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)} días`;
  }
  return { metricas, advertencias, resumenEquidad };
}