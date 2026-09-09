import { estadoActual, guardarEstado, exportarJSON, importarJSON } from '../state.js';
import { aMinutos } from '../engine/fechas.js';

const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

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
    est.rutas.push({ id: crypto.randomUUID(), nombre, peso: 1,
      gruposDia: [{ nombre: 'L-D', dias: [0,1,2,3,4,5,6], turnos: [] }] });
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
  const div = document.createElement('div');
  div.className = 'tarjeta';
  div.innerHTML = `
    <div class="fila">
      <strong data-nombre></strong>
      <label>Peso <input type="number" value="${ruta.peso}" min="0" style="width:60px" data-peso></label>
      <button data-borrar>Eliminar</button>
    </div>
    <div class="fila">
      <input type="time" step="60" data-inicio value="05:00">
      <input type="time" step="60" data-fin value="21:00">
      cada <input type="number" data-frec min="1" value="7" style="width:60px"> min,
      <input type="number" data-pct min="0" max="100" value="80" style="width:60px">% desde INICIO
      <button data-gen>Generar turnos</button>
    </div>
    <table><thead><tr><th>#</th><th>Hora</th><th>Punto</th><th></th></tr></thead>
    <tbody data-turnos></tbody></table>`;
  div.querySelector('[data-nombre]').textContent = ruta.nombre;
  div.querySelector('[data-peso]').onchange = e => { ruta.peso = +e.target.value; guardarEstado(); };
  div.querySelector('[data-borrar]').onclick = () => {
    const est = estadoActual();
    est.rutas = est.rutas.filter(r => r.id !== ruta.id);
    guardarEstado(); renderRutas(el);
  };
  div.querySelector('[data-gen]').onclick = () => {
    const inicio = aMinutos(div.querySelector('[data-inicio]').value || '05:00');
    const fin = aMinutos(div.querySelector('[data-fin]').value || '21:00');
    const frec = Math.max(1, +div.querySelector('[data-frec]').value || 7);
    const pct = +div.querySelector('[data-pct]').value || 0;
    const horas = [];
    for (let m = inicio; m <= fin; m += frec) horas.push(m);
    const nInicio = Math.round(horas.length * pct / 100);
    ruta.gruposDia[0].turnos = horas.map((m, i) => ({
      hora: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      punto: i < nInicio ? 'INICIO' : 'FIN',
    }));
    guardarEstado(); renderRutas(el);
  };
  const tbody = div.querySelector('[data-turnos]');
  ruta.gruposDia[0].turnos.forEach((t, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td><td class="hora">${t.hora}</td>
      <td><select data-punto><option${t.punto === 'INICIO' ? ' selected' : ''}>INICIO</option><option${t.punto === 'FIN' ? ' selected' : ''}>FIN</option></select></td>
      <td><button data-q>✕</button></td>`;
    tr.querySelector('[data-punto]').onchange = e => { t.punto = e.target.value; guardarEstado(); };
    tr.querySelector('[data-q]').onclick = () => {
      ruta.gruposDia[0].turnos.splice(i, 1); guardarEstado(); renderRutas(el);
    };
    tbody.appendChild(tr);
  });
  return div;
}