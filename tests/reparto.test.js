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