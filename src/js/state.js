const CLAVE = 'tablas-operacionales-v1';

let estado = { rutas: [], unidades: [] };

export function cargarEstado() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) estado = { rutas: [], unidades: [], ...JSON.parse(crudo) };
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
        guardarEstado();
        resolve(estado);
      } catch (e) { reject(new Error('Archivo de configuración inválido')); }
    };
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.readAsText(file);
  });
}

export function estadoActual() { return estado; }