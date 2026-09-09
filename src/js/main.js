import { cargarEstado } from './state.js';
import { renderRutas } from './views/rutaView.js';
import { renderUnidades } from './views/unidadView.js';
import { renderGenerar } from './views/generarView.js';
import { renderResultado } from './views/resultadoView.js';

const VISTAS = { rutas: renderRutas, unidades: renderUnidades, generar: renderGenerar, resultado: renderResultado };

cargarEstado();
const contenido = document.getElementById('contenido');
document.getElementById('tabs').addEventListener('click', e => {
  const tab = e.target.dataset.tab;
  if (!tab) return;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('activo', b === e.target));
  contenido.replaceChildren();
  VISTAS[tab](contenido);
});
VISTAS.rutas(contenido);