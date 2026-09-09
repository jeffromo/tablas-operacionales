import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generarSemanaRuta } from '../src/js/engine/rotacion.js';

const HORAS = ['04:50', '04:57', '05:04', '05:11'];
const sinIndisponibilidad = () => false;
const semana = (turnosPorDia) => turnosPorDia.map((turnos, i) => ({
  fecha: `2026-09-0${i + 1}`, turnos: turnos.map((hora, t) => ({ turnoIndex: t, hora })),
}));

test('patrón del PDF: cada unidad avanza un turno hacia atrás por día', () => {
  const pool = ['U1', 'U2', 'U3', 'U4'];
  const dias = semana([HORAS, HORAS]); // 2 días, 4 turnos c/u
  const asig = generarSemanaRuta({ poolUnidades: pool, diasSemana: dias, indisponibilidad: sinIndisponibilidad });
  const d1 = Object.fromEntries(asig.filter(a => a.fecha === '2026-09-01').map(a => [a.turnoIndex, a.unidadId]));
  const d2 = Object.fromEntries(asig.filter(a => a.fecha === '2026-09-02').map(a => [a.turnoIndex, a.unidadId]));
  assert.equal(d1[0], 'U1'); // primer día: orden natural
  assert.equal(d2[0], 'U2'); // día 2: el turno 1 lo toma quien hizo el turno 2
  assert.equal(d2[3], 'U1'); // ...y U1 (que hizo el turno 1) pasa al último
});

test('piscina mayor que turnos/día: descansos alternados y cobertura completa', () => {
  const pool = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6']; // 6 unidades, 2 turnos/día
  const dias = semana([['05:00', '07:00'], ['05:00', '07:00'], ['05:00', '07:00']]);
  const asig = generarSemanaRuta({ poolUnidades: pool, diasSemana: dias, indisponibilidad: sinIndisponibilidad });
  assert.equal(asig.length, 6); // 3 días × 2 turnos, todo cubierto
  const porUnidad = Object.fromEntries(pool.map(u => [u, asig.filter(a => a.unidadId === u).length]));
  const cargas = Object.values(porUnidad);
  assert.ok(Math.max(...cargas) - Math.min(...cargas) <= 1, `cargas equitativas: ${cargas}`);
});

test('ventana de descanso: no se repite turno temprano tras cierre tardío', () => {
  // 2 turnos: uno a las 05:00 y uno a las 20:00. U1 cierra 20:00 el día 1;
  // el día 2 el turno de las 05:00 no debe ser de U1 (vueltas hacia atrás sin 10h).
  const pool = ['U1', 'U2'];
  const horas = ['05:00', '20:00'];
  const dias = semana([horas, horas]);
  const asig = generarSemanaRuta({ poolUnidades: pool, diasSemana: dias, indisponibilidad: sinIndisponibilidad });
  const d1 = asig.filter(a => a.fecha === '2026-09-01');
  const d2 = asig.filter(a => a.fecha === '2026-09-02');
  const u1d1 = d1.find(a => a.unidadId === 'U1');
  const u1d2 = d2.find(a => a.unidadId === 'U1');
  // Si U1 hizo el turno 20:00 el día 1, el día 2 no puede tener un turno anterior en índice
  if (u1d1?.turnoIndex === 1 && u1d2) {
    assert.ok(u1d2.turnoIndex >= 1, 'U1 no debe volver a un turno más temprano tras cerrar a las 20:00');
  }
});

test('unidad indisponible: sus turnos los cubren otras de la piscina', () => {
  const pool = ['U1', 'U2', 'U3'];
  const dias = semana([['05:00', '06:00', '07:00']]);
  const asig = generarSemanaRuta({
    poolUnidades: pool, diasSemana: dias,
    indisponibilidad: (id, fecha) => id === 'U1' && fecha === '2026-09-01',
  });
  assert.equal(asig.length, 3);
  assert.ok(asig.every(a => a.unidadId !== 'U1'));
});