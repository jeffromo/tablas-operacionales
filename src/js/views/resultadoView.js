import { estadoActual } from '../state.js';
import { descargarExcel } from '../export/excel.js';

const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const etiqueta = f => {
  const [a, m, d] = f.split('-');
  return `${Number(d)}-${DIAS[new Date(Date.UTC(+a, +m - 1, +d)).getUTCDay()]}`;
};

// Patrón anti-XSS: nombre de ruta, horas, puntos, ids de unidad y advertencias
// provienen del estado/JSON importado, así que todo dato se inserta con
// textContent sobre esqueletos estáticos; nada se interpola en innerHTML.
function celda(texto, clase) {
  const td = document.createElement('td');
  td.textContent = String(texto);
  if (clase) td.className = clase;
  return td;
}

export function renderResultado(el) {
  const est = estadoActual();
  const crudo = sessionStorage.getItem('plan-actual');
  if (!crudo) {
    el.textContent = 'Genera primero una tabla en la pestaña Generar.';
    return;
  }
  let plan;
  try {
    plan = JSON.parse(crudo);
  } catch {
    el.textContent = 'El plan guardado es inválido. Genera de nuevo la tabla.';
    return;
  }

  for (const a of plan.advertencias) {
    const div = document.createElement('div');
    div.className = 'advertencia';
    div.textContent = a;
    el.appendChild(div);
  }

  // Resolución T6/T7: el resumen de equidad viaja en `resumenEquidad` (no en
  // `advertencias`); se muestra como línea informativa separada.
  if (plan.resumenEquidad) {
    const linea = document.createElement('p');
    linea.className = 'resumen-equidad';
    linea.textContent = plan.resumenEquidad;
    el.appendChild(linea);
  }

  for (const ruta of est.rutas) {
    const fechas = plan.dias.filter(d => d.turnos.some(t => t.rutaId === ruta.id)).map(d => d.fecha);
    if (!fechas.length) continue;

    const titulo = document.createElement('h2');
    titulo.textContent = ruta.nombre;
    el.appendChild(titulo);

    const nTurnos = Math.max(...plan.dias.flatMap(d => d.turnos
      .filter(t => t.rutaId === ruta.id)
      .map(t => t.turnoIndex))) + 1;

    const tabla = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    for (const texto of ['TURNO', 'HORA', 'PUNTO', ...fechas.map(etiqueta)]) {
      const th = document.createElement('th');
      th.textContent = texto;
      trh.appendChild(th);
    }
    thead.appendChild(trh);

    const tbody = document.createElement('tbody');
    for (let i = 0; i < nTurnos; i++) {
      const t0 = plan.dias.flatMap(d => d.turnos)
        .find(t => t.rutaId === ruta.id && t.turnoIndex === i);
      const tr = document.createElement('tr');
      tr.append(celda(i + 1), celda(t0?.hora || '', 'hora'), celda(t0?.punto || ''));
      for (const f of fechas) {
        const a = plan.asignaciones.find(x => x.fecha === f && x.rutaId === ruta.id && x.turnoIndex === i);
        tr.append(celda(a?.unidadId ?? ''));
      }
      tbody.appendChild(tr);
    }
    tabla.append(thead, tbody);
    el.appendChild(tabla);
  }

  const btn = document.createElement('button');
  btn.className = 'primario';
  btn.textContent = 'Descargar Excel';
  btn.onclick = () => descargarExcel(plan, est.rutas, `tabla-operacional-${plan.dias[0].fecha}.xlsx`);
  el.appendChild(btn);
}