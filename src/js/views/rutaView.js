import { estadoActual, guardarEstado, exportarJSON, importarJSON } from '../state.js';
import { aMinutos } from '../engine/fechas.js';

// Etiquetas cortas para el selector de días (0=domingo .. 6=sábado), spec §2.3.
const DIAS_SEM = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// Rutas con el acordeón abierto (ids persisten entre re-renders de la vista).
const expandidas = new Set();

// Patrón anti-XSS: nombre de ruta, etiqueta de grupo, horas y puntos provienen
// del estado/JSON importado, así que todo dato se inserta con textContent /
// .value / .checked sobre esqueletos estáticos; nada se interpola en innerHTML.

export function renderRutas(el) {
  const est = estadoActual();
  el.innerHTML = `
    <div class="fila">
      <input id="nueva-ruta" placeholder="Nombre de la nueva ruta">
      <button class="primario" id="agregar">Agregar ruta</button>
      <button id="exportar">Exportar config</button>
      <input type="file" id="importar" accept=".json" hidden>
      <button id="importar-btn">Importar config</button>
    </div>
    <div id="lista-rutas"></div>`;
  el.querySelector('#agregar').onclick = () => {
    const nombre = el.querySelector('#nueva-ruta').value.trim();
    if (!nombre) return alert('Escribe un nombre de ruta');
    const nueva = { id: crypto.randomUUID(), nombre, peso: 1,
      gruposDia: [{ nombre: 'L-D', dias: [0,1,2,3,4,5,6], turnos: [] }] };
    est.rutas.push(nueva);
    expandidas.add(nueva.id);
    guardarEstado(); renderRutas(el);
  };
  el.querySelector('#exportar').onclick = () => exportarJSON();
  el.querySelector('#importar-btn').onclick = () => el.querySelector('#importar').click();
  el.querySelector('#importar').onchange = async e => {
    if (e.target.files[0]) { await importarJSON(e.target.files[0]); renderRutas(el); }
  };
  const lista = el.querySelector('#lista-rutas');
  for (const ruta of est.rutas) lista.appendChild(tarjetaRuta(ruta, el));
}

function tarjetaRuta(ruta, el) {
  ruta.id ??= crypto.randomUUID();
  const div = document.createElement('div');
  div.className = 'tarjeta ruta-acordeon';
  const abierta = expandidas.has(ruta.id);
  div.innerHTML = `
    <button type="button" class="cabecera-ruta" data-toggle aria-expanded="${abierta}">
      <span class="chevron" aria-hidden="true">▸</span>
      <strong data-nombre></strong>
      <span class="resumen-ruta" data-resumen></span>
    </button>
    <div data-cuerpo>
      <div class="fila">
        <label>Peso <input type="number" min="0" style="width:60px" data-peso></label>
        <button data-borrar>Eliminar</button>
      </div>
      <div data-grupos></div>
      <button data-agregar-grupo>Agregar grupo de día</button>
    </div>`;
  div.querySelector('[data-nombre]').textContent = ruta.nombre;
  const nGrupos = ruta.gruposDia.length;
  const nTurnos = ruta.gruposDia.reduce((n, g) => n + (g.turnos?.length || 0), 0);
  div.querySelector('[data-resumen]').textContent =
    `${nGrupos} ${nGrupos === 1 ? 'grupo' : 'grupos'} · ${nTurnos} turnos · peso ${Number(ruta.peso) || 0}`;
  div.querySelector('[data-peso]').value = String(Number(ruta.peso) || 0);
  const cuerpo = div.querySelector('[data-cuerpo]');
  cuerpo.hidden = !abierta;
  if (abierta) div.classList.add('abierta');
  div.querySelector('[data-toggle]').onclick = () => {
    if (expandidas.has(ruta.id)) {
      expandidas.delete(ruta.id);
      div.classList.remove('abierta');
      cuerpo.hidden = true;
      div.querySelector('[data-toggle]').setAttribute('aria-expanded', 'false');
    } else {
      expandidas.add(ruta.id);
      div.classList.add('abierta');
      cuerpo.hidden = false;
      div.querySelector('[data-toggle]').setAttribute('aria-expanded', 'true');
    }
  };
  div.querySelector('[data-peso]').onchange = e => { ruta.peso = +e.target.value; guardarEstado(); };
  div.querySelector('[data-borrar]').onclick = () => {
    const est = estadoActual();
    est.rutas = est.rutas.filter(r => r.id !== ruta.id);
    guardarEstado(); renderRutas(el);
  };
  div.querySelector('[data-agregar-grupo]').onclick = () => {
    ruta.gruposDia.push({
      nombre: `Grupo ${ruta.gruposDia.length + 1}`,
      dias: [],
      turnos: [],
    });
    guardarEstado(); renderRutas(el);
  };
  const contGrupos = div.querySelector('[data-grupos]');
  ruta.gruposDia.forEach((grupo, gi) => contGrupos.appendChild(seccionGrupo(ruta, grupo, gi, el)));
  return div;
}

// Un grupo de día: selector de días (checkboxes), renombrado, borrado (si
// queda >1), generador por frecuencia y turnos manuales — todo sobre el grupo
// concreto de la sección, no sobre gruposDia[0] (spec §2.3, §7).
function seccionGrupo(ruta, grupo, gi, el) {
  const sec = document.createElement('div');
  sec.className = 'tarjeta';
  sec.innerHTML = `
    <div class="fila">
      <input type="text" data-nombre-grupo style="width:180px">
      <button data-borrar-grupo hidden>Borrar grupo</button>
    </div>
    <div class="fila" data-dias></div>
    <div class="fila">
      <input type="time" step="60" data-inicio value="05:00">
      <input type="time" step="60" data-fin value="21:00">
      cada <input type="number" data-frec min="1" value="7" style="width:60px"> min,
      <input type="number" data-pct min="0" max="100" value="80" style="width:60px">% desde INICIO
      <button data-gen>Generar turnos</button>
    </div>
    <div class="fila">
      <input type="time" step="60" data-hora-nueva>
      <select data-punto-nuevo><option>INICIO</option><option>FIN</option></select>
      <button data-agregar-turno>Agregar turno</button>
    </div>
    <table><thead><tr><th>#</th><th>Hora</th><th>Punto</th><th></th></tr></thead>
    <tbody data-turnos></tbody></table>`;

  // Renombrado de etiqueta del grupo.
  const inpNombre = sec.querySelector('[data-nombre-grupo]');
  inpNombre.value = grupo.nombre || '';
  inpNombre.onchange = e => {
    const v = e.target.value.trim();
    if (v) grupo.nombre = v;
    guardarEstado(); renderRutas(el);
  };

  // Borrado de grupo: solo si queda más de uno.
  const btnBorrarGrupo = sec.querySelector('[data-borrar-grupo]');
  if (ruta.gruposDia.length > 1) {
    btnBorrarGrupo.hidden = false;
    btnBorrarGrupo.onclick = () => {
      ruta.gruposDia.splice(gi, 1);
      guardarEstado(); renderRutas(el);
    };
  }

  // Selector de días: checkboxes 0=domingo .. 6=sábado.
  const contDias = sec.querySelector('[data-dias]');
  DIAS_SEM.forEach((etq, dow) => {
    const label = document.createElement('label');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.dataset.dow = String(dow);
    chk.checked = grupo.dias.includes(dow);
    chk.onchange = () => {
      grupo.dias = [...contDias.querySelectorAll('[data-dow]')]
        .filter(c => c.checked)
        .map(c => +c.dataset.dow)
        .sort((a, b) => a - b);
      guardarEstado(); renderRutas(el);
    };
    label.append(chk, document.createTextNode(etq));
    contDias.appendChild(label);
  });

  // Generador por frecuencia: aplica a ESTE grupo.
  sec.querySelector('[data-gen]').onclick = () => {
    const inicio = aMinutos(sec.querySelector('[data-inicio]').value || '05:00');
    const fin = aMinutos(sec.querySelector('[data-fin]').value || '21:00');
    const frec = Math.max(1, Math.round(+sec.querySelector('[data-frec]').value || 7));
    const pct = Math.min(100, Math.max(0, +sec.querySelector('[data-pct]').value || 0));
    const horas = [];
    for (let m = inicio; m <= fin; m += frec) horas.push(m);
    const nInicio = Math.round(horas.length * pct / 100);
    grupo.turnos = horas.map((m, i) => ({
      hora: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      punto: i < nInicio ? 'INICIO' : 'FIN',
    }));
    guardarEstado(); renderRutas(el);
  };

  // Turno manual: validación mínima HH:MM antes de push.
  sec.querySelector('[data-agregar-turno]').onclick = () => {
    const hora = sec.querySelector('[data-hora-nueva]').value || '';
    if (!/^\d{2}:\d{2}$/.test(hora)) return alert('Escribe una hora con formato HH:MM');
    grupo.turnos.push({ hora, punto: sec.querySelector('[data-punto-nuevo]').value });
    guardarEstado(); renderRutas(el);
  };

  const tbody = sec.querySelector('[data-turnos]');
  grupo.turnos.forEach((t, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td></td><td class="hora" data-hora></td>
      <td><select data-punto><option>INICIO</option><option>FIN</option></select></td>
      <td><button data-q>✕</button></td>`;
    tr.querySelector('td').textContent = i + 1;
    tr.querySelector('[data-hora]').textContent = t.hora;
    tr.querySelector('[data-punto]').value = t.punto === 'FIN' ? 'FIN' : 'INICIO';
    tr.querySelector('[data-punto]').onchange = e => { t.punto = e.target.value; guardarEstado(); };
    tr.querySelector('[data-q]').onclick = () => {
      grupo.turnos.splice(i, 1); guardarEstado(); renderRutas(el);
    };
    tbody.appendChild(tr);
  });
  return sec;
}