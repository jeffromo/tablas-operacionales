// Paso 2: forma piscinas semanales de unidades por ruta.
// Tamaño de piscina ∝ demanda de la ruta; el orden cíclico de unidades
// rota cada semana para que las unidades pasen por todas las rutas.
export function repartirPiscinas({ rutas, unidades, nSemanas, demandaRuta }) {
  const S = unidades.length;
  const ids = unidades.map(u => u.id);
  const idsRuta = rutas.map(r => r.id);
  const demanda = idsRuta.map(id => demandaRuta[id] || 0);
  const totalDemanda = demanda.reduce((a, b) => a + b, 0);

  // Tamaño base proporcional, nunca menor que la demanda diaria de la ruta.
  // (Si la flota no alcanza — totalDemanda > S — se reparte proporcionalmente sin el piso de demanda.)
  let tamaños = demanda.map(d =>
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

  const paso = Math.max(1, Math.ceil(S / Math.max(1, nSemanas)));
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