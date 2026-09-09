// Paso 2: forma piscinas semanales de unidades por ruta.
// Dos modos:
//  - Explícito: la ruta declara `asignadas` (nº de unidades, fijo cada semana).
//    Las unidades sobrantes (suma < flota) quedan sin asignar; si la suma
//    excede la flota se recorta a lo proporcional (defensa, la UI lo bloquea).
//  - Proporcional (configs viejas sin `asignadas`): tamaño ∝ demanda.
//
// Estrategia de rotación, en orden de preferencia:
//  1. Círculo con paso = piscina más pequeña: cada unidad recorre el círculo
//     completo y pasa por TODAS las rutas en ceil(S / paso) semanas
//     (garantizado cuando nSemanas × paso >= S).
//  2. Si el mes no alcanza para el ciclo completo, el círculo dejaría unidades
//     clavadas en las primeras rutas: se usa un diseño balanceado codicioso —
//     cada semana cada unidad trabaja la ruta que MENOS ha visitado, y
//     descansan las de menos días acumulados. No garantiza cobertura total
//     (cuando semanas × asignadas < flota es matemáticamente imposible), pero
//     sí aprovecha todos los cupos y reparte las rutas al máximo.
function porCirculo({ ids, idsRuta, tamaños, nSemanas, paso }) {
  const S = ids.length;
  return Array.from({ length: nSemanas }, (_, w) => {
    const offset = (w * paso) % S;
    const semana = {};
    let acum = 0;
    for (let i = 0; i < idsRuta.length; i++) {
      semana[idsRuta[i]] = Array.from({ length: tamaños[i] }, (_, j) =>
        ids[(offset + acum + j) % S]);
      acum += tamaños[i];
    }
    return semana;
  });
}

function porBalance({ ids, idsRuta, tamaños, nSemanas }) {
  const S = ids.length;
  const aTrabajar = tamaños.reduce((a, b) => a + b, 0);
  const visitas = ids.map(() => idsRuta.map(() => 0));   // visitas[u][j]
  const total = ids.map(() => 0);
  return Array.from({ length: nSemanas }, () => {
    // Trabajan las unidades con menos días acumulados (el descanso rota).
    const trabajadores = ids.map((_, u) => u)
      .sort((a, b) => total[a] - total[b] || a - b)
      .slice(0, aTrabajar);
    const pendiente = tamaños.slice();
    const semana = Object.fromEntries(idsRuta.map(id => [id, []]));
    for (const u of trabajadores) {
      // Cada unidad toma la ruta con cupo libre que menos ha visitado.
      let mejor = -1;
      for (let j = 0; j < idsRuta.length; j++) {
        if (pendiente[j] > 0 && (mejor === -1 || visitas[u][j] < visitas[u][mejor])) mejor = j;
      }
      semana[idsRuta[mejor]].push(ids[u]);
      pendiente[mejor]--;
      visitas[u][mejor]++;
      total[u]++;
    }
    return semana;
  });
}

export function repartirPiscinas({ rutas, unidades, nSemanas, demandaRuta }) {
  const S = unidades.length;
  const ids = unidades.map(u => u.id);
  const idsRuta = rutas.map(r => r.id);
  const demanda = idsRuta.map(id => demandaRuta[id] || 0);
  const totalDemanda = demanda.reduce((a, b) => a + b, 0);

  // Tamaños explícitos solo si TODAS las rutas declaran `asignadas`.
  const explicitas = idsRuta.map(id => {
    const ruta = rutas.find(r => r.id === id);
    const a = +ruta?.asignadas;
    return Number.isFinite(a) && a > 0 ? Math.floor(a) : null;
  });
  const modoExplicito = S > 0 && idsRuta.length > 0 && explicitas.every(t => t !== null);

  if (modoExplicito) {
    const tamaños = explicitas.slice();
    // Defensa: si la suma excede la flota, se recorta a lo proporcional.
    while (tamaños.reduce((a, b) => a + b, 0) > S) {
      const iMax = tamaños.reduce((mi, t, i, arr) => (t > arr[mi] ? i : mi), 0);
      tamaños[iMax]--;
    }
    const positivos = tamaños.filter(t => t > 0);
    const tMin = positivos.length ? Math.min(...positivos) : 1;
    if (nSemanas * tMin >= S) {
      return porCirculo({ ids, idsRuta, tamaños, nSemanas, paso: tMin });
    }
    return porBalance({ ids, idsRuta, tamaños, nSemanas });
  }

  // Modo proporcional (configs viejas): círculo con paso = piscina mínima.
  let tamaños = demanda.map(d =>
    totalDemanda === 0 ? Math.floor(S / idsRuta.length) : Math.max(Math.round((S * d) / totalDemanda), totalDemanda > S ? 0 : d));
  while (tamaños.reduce((a, b) => a + b, 0) > S) {
    const iMax = tamaños.reduce((mi, t, i, arr) => (t > arr[mi] && t > (demanda[i] || 0) ? i : mi), 0);
    tamaños[iMax]--;
  }
  while (tamaños.reduce((a, b) => a + b, 0) < S) {
    const iMin = tamaños.reduce((mi, t, i) => (t < tamaños[mi] ? i : mi), 0);
    tamaños[iMin]++;
  }
  const positivos = tamaños.filter(t => t > 0);
  let paso = positivos.length ? Math.min(...positivos) : 1;
  if (nSemanas * paso < S) paso = Math.max(1, Math.ceil(S / Math.max(1, nSemanas)));
  return porCirculo({ ids, idsRuta, tamaños, nSemanas, paso });
}
