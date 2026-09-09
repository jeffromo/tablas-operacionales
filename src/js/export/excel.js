// Convierte el plan a un workbook XLSX. En navegador usa la global XLSX
// (vendor/xlsx.full.min.js cargado con <script>); en Node, require del UMD.
import { createRequire } from 'module';
import { aMinutos } from '../engine/fechas.js';

function getXLSX() {
  if (typeof globalThis.XLSX !== 'undefined') return globalThis.XLSX;
  // Node (solo tests): carga UMD vía createRequire. FIX vs brief: desde
  // src/js/export/ son TRES niveles hasta la raíz (../../ era src/).
  return createRequire(import.meta.url)('../../../vendor/xlsx.full.min.js');
}

const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

export function planAWorkbook(plan, rutas) {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();

  for (const ruta of rutas) {
    for (const grupo of ruta.gruposDia) {
      const fechas = plan.dias
        .filter(d => grupo.dias.includes(d.dow))
        .map(d => d.fecha);
      if (!fechas.length) continue;

      const filas = [];
      filas.push([`RUTA ${ruta.nombre}`, '', `OPERACIÓN ${Math.min(...grupo.turnos.map(t => aMinutos(t.hora))) / 60 | 0}H`]);
      filas.push([]);
      filas.push(['TURNO', 'HORA', 'PUNTO', ...fechas.map(f => {
        const [a, m, d] = f.split('-');
        return `${Number(d)}-${DIAS[new Date(Date.UTC(+a, +m - 1, +d)).getUTCDay()]}`;
      })]);

      const turnosUnicos = [...grupo.turnos];
      turnosUnicos.forEach((t, i) => {
        const fila = [i + 1, t.hora, t.punto];
        for (const f of fechas) {
          const a = plan.asignaciones.find(x => x.fecha === f && x.rutaId === ruta.id && x.turnoIndex === i);
          fila.push(a ? a.unidadId : '');
        }
        filas.push(fila);
      });

      const nombreHoja = `${ruta.nombre} ${grupo.nombre}`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombreHoja);
    }
  }

  const resumen = [['UNIDAD', 'DÍAS TRABAJADOS']];
  for (const m of plan.metricas) resumen.push([m.unidadId, m.diasTrabajados]);
  for (const a of plan.advertencias) resumen.push([a]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'RESUMEN');
  return wb;
}

export function descargarExcel(plan, rutas, nombreArchivo) {
  const XLSX = getXLSX();
  const wb = planAWorkbook(plan, rutas);
  XLSX.writeFile(wb, nombreArchivo || 'tabla-operacional.xlsx');
}