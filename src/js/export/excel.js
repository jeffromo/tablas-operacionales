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

const fmtH = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Horario de operación del grupo con formato H:MM a H:MM (ej. "04:50 a 21:00");
// un grupo sin turnos no produce Infinity (min de vacío), dice "sin turnos".
function operacion(grupo) {
  if (!grupo.turnos.length) return 'OPERACIÓN sin turnos';
  const mins = grupo.turnos.map(t => aMinutos(t.hora));
  return `OPERACIÓN ${fmtH(Math.min(...mins))} a ${fmtH(Math.max(...mins))}`;
}

// Nombres de hoja únicos y válidos para Excel (máx. 31 caracteres, sin
// []:*?/\). Dos grupos con nombre largo ya no colisionan: el repetido recibe
// sufijo -2, -3, ... con espacio garantizado para el sufijo.
function creadorNombresHoja() {
  const usados = new Set();
  return (nombre) => {
    const base = nombre.replace(/[\[\]:*?\/\\]/g, ' ').trim() || 'Hoja';
    let candidato = base.slice(0, 31);
    let n = 2;
    while (usados.has(candidato)) {
      const sufijo = `-${n}`;
      candidato = base.slice(0, 31 - sufijo.length) + sufijo;
      n++;
    }
    usados.add(candidato);
    return candidato;
  };
}

export function planAWorkbook(plan, rutas) {
  const XLSX = getXLSX();
  const wb = XLSX.utils.book_new();
  const nombreHoja = creadorNombresHoja();

  for (const ruta of rutas) {
    for (const grupo of ruta.gruposDia) {
      const fechas = plan.dias
        .filter(d => grupo.dias.includes(d.dow))
        .map(d => d.fecha);
      if (!fechas.length) continue;

      const filas = [];
      filas.push([`RUTA ${ruta.nombre}`, '', operacion(grupo)]);
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

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas),
        nombreHoja(`${ruta.nombre} ${grupo.nombre}`));
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