// Paso 2: forma piscinas semanales de unidades por ruta.
// Dos modos:
//  - Explícito: la ruta declara `asignadas` (nº de unidades, fijo cada semana).
//    Las unidades sobrantes (suma < flota) quedan sin asignar; si la suma
//    excede la flota se recorta a lo proporcional (defensa, la UI lo bloquea).
//  - Proporcional (configs viejas sin `asignadas`): tamaño ∝ demanda.
// El orden cíclico de unidades rota cada semana con un paso igual al tamaño
// de la piscina más pequeña: así cada unidad recorre el círculo completo y
// pasa por TODAS las rutas en ceil(S / paso) semanas (garantizado cuando
// nSemanas * paso >= S; si el mes no alcanza, se usa el paso máximo posible).
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

  let tamaños;
  if (modoExplicito) {
    tamaños = explicitas;
    // Defensa: si la suma excede la flota, se recorta a lo proporcional.
    while (tamaños.reduce((a, b) => a + b, 0) > S) {
      const iMax = tamaños.reduce((mi, t, i, arr) => (t > arr[mi] ? i : mi), 0);
      tamaños[iMax]--;
    }
  } else {
    // Tamaño base proporcional, nunca menor que la demanda diaria de la ruta.
    // (Si la flota no alcanza — totalDemanda > S — se reparte proporcionalmente sin el piso de demanda.)
    tamaños = demanda.map(d =>
      totalDemanda === 0 ? Math.floor(S / idsRuta.length) : Math.max(Math.round((S * d) / totalDemanda), totalDemanda > S ? 0 : d));
    // Recorte proporcional si la flota no alcanza.
    while (tamaños.reduce((a, b) => a + b, 0) > S) {
      const iMax = tamaños.reduce((mi, t, i, arr) => (t > arr[mi] && t > (demanda[i] || 0) ? i : mi), 0);
      tamaños[iMax]--;
    }
    // Reparto del residuo (por redondeo) a las piscinas más grandes.
    while (tamaños.reduce((a, b) => a + b, 0) < S) {
      const iMin = tamaños.reduce((mi, t, i) => (t < tamaños[mi] ? i : mi), 0);
      tamaños[iMin]++;
    }
  }

  // Paso de rotación: el de la piscina más pequeña garantiza que ningún
  // segmento del círculo sea saltado; si las semanas del mes no alcanzan para
  // dar la vuelta completa, se usa el paso máximo que sí alcanza.
  const positivos = tamaños.filter(t => t > 0);
  let paso = positivos.length ? Math.min(...positivos) : 1;
  if (nSemanas * paso < S) paso = Math.max(1, Math.ceil(S / Math.max(1, nSemanas)));

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
