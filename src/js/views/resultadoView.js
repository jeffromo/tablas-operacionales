import { estadoActual } from '../state.js';
import { descargarExcel } from '../export/excel.js';
import { semanarDias } from '../engine/fechas.js';

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

// Crea un acordeón (tarjeta con cabecera plegable) y devuelve su cuerpo.
function acordeon(titulo, resumen, abierta) {
  const acc = document.createElement('div');
  acc.className = 'tarjeta acordeon-resultado';
  acc.innerHTML = `
    <button type="button" class="cabecera-ruta" data-toggle aria-expanded="${abierta}">
      <span class="chevron" aria-hidden="true">▸</span>
      <strong data-titulo></strong>
      <span class="resumen-ruta" data-resumen></span>
    </button>
    <div data-cuerpo></div>`;
  acc.querySelector('[data-titulo]').textContent = titulo;
  acc.querySelector('[data-resumen]').textContent = resumen;
  const cuerpo = acc.querySelector('[data-cuerpo]');
  cuerpo.hidden = !abierta;
  if (abierta) acc.classList.add('abierta');
  acc.querySelector('[data-toggle]').onclick = () => {
    const nueva = cuerpo.hidden;
    cuerpo.hidden = !nueva;
    acc.classList.toggle('abierta', nueva);
    acc.querySelector('[data-toggle]').setAttribute('aria-expanded', String(nueva));
  };
  return { acc, cuerpo };
}

// Tabla operacional de UN conjunto de días (una semana) de una ruta.
function tablaSemana(diasGrupo, ruta, plan, nTurnos) {
  const fechas = diasGrupo.map(d => d.fecha);
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
    const t0 = diasGrupo.flatMap(d => d.turnos)
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
  return tabla;
}

export function renderResultado(el) {
  const est = estadoActual();
  const crudo = sessionStorage.getItem('plan-actual');
  if (!crudo) {
    el.textContent = 'Genera primero una tabla en la pestaña Generar.';
    return;
  }
  let snap;
  try {
    snap = JSON.parse(crudo);
  } catch {
    el.textContent = 'El plan guardado es inválido. Genera de nuevo la tabla.';
    return;
  }
  // Snapshot {plan, rutas} (hallazgo 5): la vista y el Excel usan las rutas
  // con las que se generó el plan, aunque el operador las edite después.
  // Compatibilidad: un snapshot viejo guardaba el plan directamente — cae al
  // estado actual.
  const esSnapshot = snap && typeof snap === 'object' && snap.plan && Array.isArray(snap.rutas);
  const plan = esSnapshot ? snap.plan : snap;
  const rutas = esSnapshot ? snap.rutas : est.rutas;
  if (!plan || !Array.isArray(plan.dias)) {
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

  // Una sección por GRUPO de día y, dentro, una sub-sección por SEMANA del
  // mes: la visualización es semana a semana (cada semana con su tabla).
  // Las fechas del plan se filtran por grupo.dias (dow) y solo cuentan para
  // el primer grupo que declara ese día, igual que turnosVigentes en el motor.
  const semanasMes = semanarDias(plan.dias.map(d => d.fecha));
  const semanaDe = new Map();
  semanasMes.forEach((fs, w) => fs.forEach(f => semanaDe.set(f, w)));

  let primerGrupo = true;
  for (const ruta of rutas) {
    for (const grupo of ruta.gruposDia) {
      const diasGrupo = plan.dias.filter(d =>
        grupo.dias.includes(d.dow) &&
        ruta.gruposDia.find(g => g.dias.includes(d.dow)) === grupo &&
        d.turnos.some(t => t.rutaId === ruta.id));
      if (!diasGrupo.length) continue;
      const fechas = diasGrupo.map(d => d.fecha);

      const nTurnos = Math.max(...diasGrupo.flatMap(d => d.turnos
        .filter(t => t.rutaId === ruta.id)
        .map(t => t.turnoIndex))) + 1;

      const { acc, cuerpo } = acordeon(
        grupo.nombre ? `${ruta.nombre} ${grupo.nombre}` : ruta.nombre,
        `${fechas.length} días · ${nTurnos} turnos`,
        primerGrupo);
      primerGrupo = false;
      el.appendChild(acc);

      // Días del grupo agrupados por semana del mes (huecos = semanas sin días).
      const porSemana = [];
      for (const d of diasGrupo) {
        const w = semanaDe.get(d.fecha);
        (porSemana[w] ||= []).push(d);
      }
      let primeraSemana = true;
      porSemana.forEach((diasSem, w) => {
        if (!diasSem) return;
        const fechasSem = diasSem.map(d => d.fecha);
        const { acc: accSem, cuerpo: cuerpoSem } = acordeon(
          `Semana ${w + 1}`,
          `${fechasSem.length} días · ${etiqueta(fechasSem[0])} – ${etiqueta(fechasSem[fechasSem.length - 1])}`,
          primeraSemana);
        primeraSemana = false;
        cuerpoSem.appendChild(tablaSemana(diasSem, ruta, plan, nTurnos));
        cuerpo.appendChild(accSem);
      });
    }
  }

  const btn = document.createElement('button');
  btn.className = 'primario';
  btn.textContent = 'Descargar Excel';
  btn.onclick = () => descargarExcel(plan, rutas, `tabla-operacional-${plan.dias[0].fecha}.xlsx`);
  el.appendChild(btn);
}