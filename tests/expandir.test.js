import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandirMes, turnosVigentes } from '../src/js/engine/expandir.js';

const rutas = [{
  id: 'r1', nombre: 'CAUPICHO', peso: 10,
  gruposDia: [
    { nombre: 'L-S', dias: [1, 2, 3, 4, 5, 6], turnos: [{ hora: '04:50', punto: 'INICIO' }, { hora: '04:57', punto: 'INICIO' }] },
    { nombre: 'DOM', dias: [0], turnos: [{ hora: '05:00', punto: 'FIN' }] },
  ],
}];

test('turnosVigentes devuelve los del grupo que incluye el día de semana', () => {
  assert.equal(turnosVigentes(rutas[0], 3).length, 2); // miércoles → L-S
  assert.equal(turnosVigentes(rutas[0], 0).length, 1); // domingo
});

test('expandirMes: 2026-09 con 1 ruta de 2 turnos L-S y 1 turno domingo', () => {
  const dias = expandirMes({ rutas, mes: 9, anio: 2026 });
  assert.equal(dias.length, 30);
  const mar = dias.find(d => d.fecha === '2026-09-01');
  assert.equal(mar.turnos.length, 2);
  assert.equal(mar.turnos[0].turnoIndex, 0);
  assert.equal(mar.turnos[0].hora, '04:50');
  const dom = dias.find(d => d.fecha === '2026-09-06');
  assert.equal(dom.turnos.length, 1);
  assert.equal(dom.turnos[0].punto, 'FIN');
});

test('expandirMes ordena los turnos por hora', () => {
  const rutasDesorden = [{
    id: 'r2', nombre: 'X', gruposDia: [{ nombre: 'T', dias: [1, 2, 3, 4, 5, 6, 0], turnos: [{ hora: '06:00', punto: 'INICIO' }, { hora: '05:00', punto: 'INICIO' }] }],
  }];
  const dias = expandirMes({ rutas: rutasDesorden, mes: 9, anio: 2026 });
  assert.equal(dias[0].turnos[0].hora, '05:00');
});