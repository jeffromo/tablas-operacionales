import { estadoActual, guardarEstado } from '../state.js';
import { generaPlanMes } from '../engine/index.js';
import { expandirMes } from '../engine/expandir.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Patrón anti-XSS: los mensajes incorporan datos controlados por el usuario
// (nombre de ruta) o texto externo (e.message), así que se insertan vía
// textContent, nunca interpolados en innerHTML.
function aviso(contenedor, mensaje) {
  const div = document.createElement('div');
  div.className = 'advertencia';
  div.textContent = mensaje;
  contenedor.replaceChildren(div);
}

export function renderGenerar(el) {
  const est = estadoActual();
  const hoy = new Date();
  // Esqueleto estático: sin datos variables interpolados en innerHTML.
  el.innerHTML = `
    <div class="fila">
      <select id="mes"></select>
      <input id="anio" type="number" style="width:90px">
      <button class="primario" id="generar">Generar tabla</button>
    </div>
    <div id="chequeo"></div>`;

  const selMes = el.querySelector('#mes');
  MESES.forEach((nombre, i) => {
    const opt = document.createElement('option');
    opt.value = String(i + 1);
    opt.textContent = nombre;
    if (i + 1 === hoy.getMonth() + 1) opt.selected = true;
    selMes.appendChild(opt);
  });
  el.querySelector('#anio').value = String(hoy.getFullYear());

  el.querySelector('#generar').onclick = () => {
    const mes = +selMes.value;
    const anio = +el.querySelector('#anio').value;
    const chequeo = el.querySelector('#chequeo');
    if (!est.rutas.length) return aviso(chequeo, 'Configura al menos una ruta.');
    if (!est.unidades.length) return aviso(chequeo, 'Agrega al menos una unidad.');
    for (const ruta of est.rutas) {
      const dias = expandirMes({ rutas: [ruta], mes, anio });
      const vacios = dias.filter(d => d.dow !== null && d.turnos.length === 0).length;
      if (vacios === dias.length) {
        return aviso(chequeo, `La ruta ${ruta.nombre} no tiene turnos configurados.`);
      }
    }
    try {
      const plan = generaPlanMes({ rutas: est.rutas, unidades: est.unidades, mes, anio });
      sessionStorage.setItem('plan-actual', JSON.stringify(plan));
      guardarEstado();
      document.querySelector('[data-tab="resultado"]').click();
    } catch (e) {
      aviso(chequeo, `Error al generar: ${e.message}`);
    }
  };
}