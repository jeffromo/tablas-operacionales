// Días trabajados por unidad: cuenta FECHAS DISTINTAS, no asignaciones
// (spec §5 Paso 5 y §11: la métrica "DÍAS TRABAJADOS" y la tolerancia ±1 se
// prometen en días). Con la relajación de cobertura una unidad puede cubrir
// doble turno el mismo día; eso sigue sumando 1 día.
export function diasTrabajados(asignaciones) {
  const fechas = new Map();
  for (const a of asignaciones) {
    if (!fechas.has(a.unidadId)) fechas.set(a.unidadId, new Set());
    fechas.get(a.unidadId).add(a.fecha ?? '');
  }
  return new Map([...fechas].map(([id, s]) => [id, s.size]));
}

// Paso 4: intercambia unidades entre piscinas de distintas rutas (misma semana)
// hasta que la dispersión de días trabajados en el mes quede dentro de la tolerancia.
// `regenerarSemana(w)` regenera la semana w con las piscinas actuales.
// `demanda` (opcional, estructura turnosPorSemanaRuta de index.js:
// demanda[w][rutaId] = [{fecha, turnoIndex, ...}]) habilita el guardia de
// cobertura del spec §5 Paso 4: un swap solo se acepta si NO aumenta los
// turnos descubiertos de la semana, aunque mejore la equidad.
export function corregirEquidad({ piscinas, asignacionesSemana, unidades, regenerarSemana, tolerancia = 1, maxIter = 200, demanda }) {
  // FIX vs brief: `cambios` es un array (el test exige Array.isArray(r.cambios)),
  // no un contador numérico; cada intercambio aplicado se registra como objeto.
  const cambios = [];
  const dispersion = (regs) => {
    const c = diasTrabajados(regs.flat());
    const vals = [...c.values()];
    return vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  };

  // Turnos descubiertos de la semana w: claves (rutaId|fecha|turnoIndex) de la
  // demanda que quedan sin asignación tras regenerar.
  const sinCubrir = (regs, dem) => {
    const cubiertos = new Set(regs.map(a => `${a.rutaId}|${a.fecha}|${a.turnoIndex}`));
    let n = 0;
    for (const [rutaId, turnos] of Object.entries(dem))
      for (const t of turnos)
        if (!cubiertos.has(`${rutaId}|${t.fecha}|${t.turnoIndex}`)) n++;
    return n;
  };

  // Línea base de turnos descubiertos por semana (solo con demanda): un swap
  // no puede superarla.
  const sinCubrirBase = demanda
    ? asignacionesSemana.map((regs, w) => sinCubrir(regs, demanda[w]))
    : null;

  for (let it = 0; it < maxIter; it++) {
    const antes = dispersion(asignacionesSemana);
    if (antes <= tolerancia) break;
    let mejoro = false;

    for (let w = 0; w < piscinas.length && !mejoro; w++) {
      const rutas = Object.keys(piscinas[w]);
      const demW = demanda?.[w];
      for (let i = 0; i < rutas.length && !mejoro; i++) {
        for (let j = i + 1; j < rutas.length && !mejoro; j++) {
          const A = rutas[i], B = rutas[j];
          for (const uA of [...piscinas[w][A]]) {
            for (const uB of [...piscinas[w][B]]) {
              // intercambiar uA ↔ uB entre las piscinas A y B de la semana w
              piscinas[w][A] = piscinas[w][A].map(x => (x === uA ? uB : x));
              piscinas[w][B] = piscinas[w][B].map(x => (x === uB ? uA : x));
              asignacionesSemana[w] = regenerarSemana(w);
              const descubiertos = demW ? sinCubrir(asignacionesSemana[w], demW) : 0;
              if (dispersion(asignacionesSemana) < antes &&
                  (!demW || descubiertos <= sinCubrirBase[w])) {
                cambios.push({ semana: w, rutaA: A, rutaB: B, saleA: uA, entraA: uB });
                if (demW) sinCubrirBase[w] = descubiertos;
                mejoro = true; break;
              }
              // revertir (FIX vs brief: el revert del brief reaplicaba el mismo
              // mapeo `x === uA ? uB`, que tras el intercambio ya no encuentra
              // uA y era un no-op; se aplica el mapeo inverso)
              piscinas[w][A] = piscinas[w][A].map(x => (x === uB ? uA : x));
              piscinas[w][B] = piscinas[w][B].map(x => (x === uA ? uB : x));
              asignacionesSemana[w] = regenerarSemana(w);
            }
          }
        }
      }
    }
    if (!mejoro) break; // sin mejoras posibles: queda lo mejor encontrado
  }
  return { piscinas, asignacionesSemana, cambios };
}