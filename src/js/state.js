const CLAVE = 'tablas-operacionales-v1';

// Normaliza rutas de configuraciones viejas o importadas: una ruta del formato
// previo a los grupos de día (con `turnos` directo) se migra a gruposDia; a
// cada grupo se le garantizan `dias` y `turnos` como arreglos.
function normalizarRutas(rutas) {
  if (!Array.isArray(rutas)) return [];
  return rutas.map(r => {
    if (!r || typeof r !== 'object') return { id: String(crypto.randomUUID()), nombre: 'Ruta sin nombre', peso: 1, gruposDia: [] };
    let grupos = Array.isArray(r.gruposDia) ? r.gruposDia : null;
    if (!grupos && Array.isArray(r.turnos)) grupos = [{ nombre: 'L-D', dias: [0,1,2,3,4,5,6], turnos: r.turnos }];
    if (!grupos) grupos = [];
    grupos = grupos.map(g => ({
      ...g,
      dias: Array.isArray(g?.dias) ? g.dias : [],
      turnos: Array.isArray(g?.turnos) ? g.turnos : [],
    }));
    return { ...r, id: r.id ?? String(crypto.randomUUID()), gruposDia: grupos };
  });
}

let estado = { rutas: [], unidades: [] };

export function cargarEstado() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      estado = { rutas: [], unidades: [], ...JSON.parse(crudo) };
      estado.rutas = normalizarRutas(estado.rutas);
    }
  } catch { /* localStorage no disponible: se usa el estado en memoria */ }
  return estado;
}

export function guardarEstado() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); }
  catch { /* modo privado: no se persiste */ }
}

export function exportarJSON() {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'configuracion-rutas.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importarJSON(file) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        estado = { rutas: [], unidades: [], ...JSON.parse(lector.result) };
        estado.rutas = normalizarRutas(estado.rutas);
        guardarEstado();
        resolve(estado);
      } catch (e) { reject(new Error('Archivo de configuración inválido')); }
    };
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.readAsText(file);
  });
}

export function estadoActual() { return estado; }