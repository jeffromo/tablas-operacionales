import { estadoActual, guardarEstado } from '../state.js';

export function renderUnidades(el) {
  const est = estadoActual();
  el.innerHTML = `
    <div class="fila">
      <textarea id="lote" rows="4" cols="40" placeholder="1664&#10;1552&#10;1529 (uno por línea o separados por coma)"></textarea>
      <button class="primario" id="agregar">Agregar unidades</button>
    </div>
    <div id="lista-unidades"></div>`;
  el.querySelector('#agregar').onclick = () => {
    const nums = el.querySelector('#lote').value.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (!nums.length) return alert('Pega al menos un número de unidad');
    const existentes = new Set(est.unidades.map(u => u.id));
    for (const n of nums) if (!existentes.has(n)) est.unidades.push({ id: n, indisponibilidades: [] });
    guardarEstado(); renderUnidades(el);
  };
  const lista = el.querySelector('#lista-unidades');
  const tabla = document.createElement('table');
  tabla.innerHTML = `<thead><tr><th>Unidad</th><th>Indisponibilidades (mantenimiento)</th></tr></thead><tbody></tbody>`;
  const tbody = tabla.querySelector('tbody');
  for (const u of est.unidades) tbody.appendChild(filaUnidad(u, el));
  lista.appendChild(tabla);
}

function filaUnidad(u, el) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><strong data-id></strong></td>
    <td><span data-indis></span>
      <input type="date" data-desde> <input type="date" data-hasta>
      <button data-add-indis>+ Indisponibilidad</button>
      <button data-del>Eliminar unidad</button></td>`;
  // Datos controlados por el usuario (id, fechas) se insertan solo vía textContent.
  tr.querySelector('[data-id]').textContent = u.id;
  const indis = tr.querySelector('[data-indis]');
  u.indisponibilidades.forEach((r, i) => {
    const span = document.createElement('span');
    const fechas = document.createElement('span');
    fechas.textContent = `${r.desde} → ${r.hasta} `;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.dataset.i = String(i);
    span.append(fechas, btn, document.createTextNode(' '));
    indis.appendChild(span);
  });
  tr.querySelector('[data-add-indis]').onclick = () => {
    const desde = tr.querySelector('[data-desde]').value;
    const hasta = tr.querySelector('[data-hasta]').value;
    if (!desde || !hasta) return alert('Indica ambas fechas');
    u.indisponibilidades.push({ desde, hasta });
    guardarEstado(); renderUnidades(el);
  };
  tr.querySelector('[data-del]').onclick = () => {
    const est = estadoActual();
    est.unidades = est.unidades.filter(x => x.id !== u.id);
    guardarEstado(); renderUnidades(el);
  };
  tr.addEventListener('click', e => {
    if (e.target.dataset.i !== undefined) {
      u.indisponibilidades.splice(+e.target.dataset.i, 1);
      guardarEstado(); renderUnidades(el);
    }
  });
  return tr;
}