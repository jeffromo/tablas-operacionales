import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repartirPiscinas } from '../src/js/engine/reparto.js';

const unidades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(id => ({ id }));

test('reparte proporcionalmente y cubre toda la flota cada semana', () => {
  const rutas = [{ id: 'A' }, { id: 'B' }];
  const demanda = { A: 6, B: 2 }; // 6/10 y 2/10 de la flota aprox.
  const piscinas = repartirPiscinas({ rutas, unidades, nSemanas: 4, demandaRuta: demanda });
  assert.equal(piscinas.length, 4);
  for (const semana of piscinas) {
    const todas = [...semana.A, ...semana.B];
    assert.equal(new Set(todas).size, 10);          // sin repetidos ni faltantes
    assert.ok(semana.A.length >= 6, 'piscina A >= demanda 6');
    assert.ok(semana.B.length >= 2, 'piscina B >= demanda 2');
  }
});

test('las piscinas rotan entre semanas (una unidad no queda fija en una ruta)', () => {
  const rutas = [{ id: 'A' }, { id: 'B' }];
  const demanda = { A: 6, B: 2 };
  const piscinas = repartirPiscinas({ rutas, unidades, nSemanas: 4, demandaRuta: demanda });
  const cambio = piscinas.some(w => !w.A.includes('1')) // '1' empieza en A
    ? piscinas.filter(w => w.B.includes('1')).length
    : 0;
  assert.ok(cambio > 0, 'la unidad 1 debe visitar otra ruta en alguna semana');
});

test('flota insuficiente: piscinas por demanda aunque excedan la flota', () => {
  const rutas = [{ id: 'A' }, { id: 'B' }];
  const demanda = { A: 8, B: 4 }; // suma 12 > 10 unidades
  const pocas = unidades.slice(0, 6);
  const piscinas = repartirPiscinas({ rutas, unidades: pocas, nSemanas: 2, demandaRuta: demanda });
  assert.equal(piscinas[0].A.length, 8 - 4); // se recorta proporcionalmente: A queda con lo disponible
  assert.equal(piscinas[0].A.length + piscinas[0].B.length, 6); // toda la flota asignada
});

// Modelo nuevo: tamaños de piscina EXPLÍCITOS por ruta (ruta.asignadas).
test('piscinas explícitas: tamaños fijos por ruta y unidades sobrantes ociosas', () => {
  const rutas = [{ id: 'A', asignadas: 4 }, { id: 'B', asignadas: 3 }, { id: 'C', asignadas: 3 }];
  const piscinas = repartirPiscinas({ rutas, unidades, nSemanas: 5, demandaRuta: { A: 8, B: 4, C: 4 } });
  assert.equal(piscinas.length, 5);
  for (const semana of piscinas) {
    assert.equal(semana.A.length, 4);  // fijo, ignorando la demanda
    assert.equal(semana.B.length, 3);
    assert.equal(semana.C.length, 3);
  }
  // Sobra 1 unidad (suma 10 = flota aquí): sin repetidos.
  for (const semana of piscinas) {
    const todas = [...semana.A, ...semana.B, ...semana.C];
    assert.equal(new Set(todas).size, 10);
  }
});

test('piscinas explícitas menores que la flota: el resto queda sin asignar', () => {
  const rutas = [{ id: 'A', asignadas: 2 }, { id: 'B', asignadas: 2 }];
  const piscinas = repartirPiscinas({ rutas, unidades, nSemanas: 4, demandaRuta: { A: 3, B: 3 } });
  for (const semana of piscinas) {
    const todas = [...semana.A, ...semana.B];
    assert.equal(todas.length, 4);                 // solo 6 de 10 operan
    assert.equal(new Set(todas).size, 4);
  }
});

test('piscinas explícitas: TODAS las unidades pasan por TODAS las rutas en el mes', () => {
  const rutas = [{ id: 'A', asignadas: 4 }, { id: 'B', asignadas: 3 }, { id: 'C', asignadas: 3 }];
  const piscinas = repartirPiscinas({ rutas, unidades, nSemanas: 5, demandaRuta: { A: 8, B: 4, C: 4 } });
  for (const id of ['1', '5', '10']) {
    const rutasVisitadas = new Set();
    for (const semana of piscinas) {
      for (const [rutaId, pool] of Object.entries(semana)) {
        if (pool.includes(id)) rutasVisitadas.add(rutaId);
      }
    }
    assert.deepEqual([...rutasVisitadas].sort(), ['A', 'B', 'C'],
      `la unidad ${id} debe visitar todas las rutas`);
  }
});

test('piscinas explícitas que exceden la flota: recorte defensivo proporcional', () => {
  const rutas = [{ id: 'A', asignadas: 8 }, { id: 'B', asignadas: 4 }]; // 12 > 10
  const piscinas = repartirPiscinas({ rutas, unidades, nSemanas: 4, demandaRuta: { A: 6, B: 2 } });
  for (const semana of piscinas) {
    assert.equal(semana.A.length + semana.B.length, 10);
    assert.equal(new Set([...semana.A, ...semana.B]).size, 10);
  }
});

test('diseño balanceado: cuando el mes no alcanza para el ciclo, cada unidad visita el máximo de rutas', () => {
  // 7/5/4/3/1 con flota de 20: imposible que las 20 unidades pasen por R4 y
  // R5 (semanas × asignadas < flota). El diseño codicioso debe maximizar.
  const rutas = [7, 5, 4, 3, 1].map((a, i) => ({ id: `R${i + 1}`, asignadas: a }));
  const u20 = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1) }));
  const piscinas = repartirPiscinas({ rutas, unidades: u20, nSemanas: 5, demandaRuta: {} });
  assert.equal(piscinas.length, 5);
  for (const semana of piscinas) {
    [7, 5, 4, 3, 1].forEach((a, i) => assert.equal(semana[`R${i + 1}`].length, a));
    const todas = Object.values(semana).flat();
    assert.equal(new Set(todas).size, 20);          // sin repetidos ni faltantes
  }
  const cobertura = u20.map(() => new Set());
  piscinas.forEach(semana => {
    for (const [rid, pool] of Object.entries(semana)) {
      for (const id of pool) cobertura[+id - 1].add(rid);
    }
  });
  const nRutas = cobertura.map(s => s.size);
  assert.ok(Math.min(...nRutas) >= 3, 'cada unidad visita al menos 3 rutas');
  const promedio = nRutas.reduce((a, b) => a + b, 0) / 20;
  assert.ok(promedio >= 3.8, `promedio de rutas visitadas ${promedio} >= 3.8`);
});
