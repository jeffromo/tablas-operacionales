import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diasDelMes, dow, aMinutos, semanarDias } from '../src/js/engine/fechas.js';

test('diasDelMes: septiembre 2026 tiene 30 días empezando martes 1', () => {
  const dias = diasDelMes(2026, 9);
  assert.equal(dias.length, 30);
  assert.equal(dias[0], '2026-09-01');
  assert.equal(dow(dias[0]), 2); // martes
});

test('aMinutos convierte HH:MM a minutos desde medianoche', () => {
  assert.equal(aMinutos('04:50'), 290);
  assert.equal(aMinutos('21:00'), 1260);
});

test('semanarDias agrupa por semana lunes-domingo', () => {
  // sep 2026: 1 mar .. 30 mié
  const semanas = semanarDias(diasDelMes(2026, 9));
  assert.equal(semanas.length, 5);
  assert.equal(semanas[0][0], '2026-09-01'); // mar
  assert.equal(semanas[0].length, 6);        // mar..dom
  assert.equal(semanas[1][0], '2026-09-07'); // lunes
});