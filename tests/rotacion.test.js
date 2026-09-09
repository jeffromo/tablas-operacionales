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

test('ventana de descanso: quien cierra 20:00 no toma el 05:00 del día siguiente', () => {
  // 2 turnos: uno a las 05:00 y uno a las 20:00. Resultado determinista trazado:
  //   día 1: U1→05:00, U2→20:00
  //   día 2: U2 queda bloqueada por descanso (<10 h desde el cierre de 20:00)
  //          para el turno de las 05:00, así que ese turno lo toma U1.
  // Aserciones incondicionales (sin `if` que pueda volver el test vacuo):
  const pool = ['U1', 'U2'];
  const horas = ['05:00', '20:00'];
  const dias = semana([horas, horas]);
  const asig = generarSemanaRuta({ poolUnidades: pool, diasSemana: dias, indisponibilidad: sinIndisponibilidad });
  const d1 = asig.filter(a => a.fecha === '2026-09-01');
  const d2 = asig.filter(a => a.fecha === '2026-09-02');
  const cierreTardioD1 = d1.find(a => a.turnoIndex === 1)?.unidadId;
  const tempranoD2 = d2.find(a => a.turnoIndex === 0)?.unidadId;
  // (1) cobertura de ambos turnos clave
  assert.ok(cierreTardioD1, 'el turno de las 20:00 del día 1 debe estar cubierto');
  assert.ok(tempranoD2, 'el turno de las 05:00 del día 2 debe estar cubierto');
  // (2) regla de descanso >=10 h: el que cerró 20:00 el día 1 NO toma el 05:00 del día 2
  assert.notEqual(tempranoD2, cierreTardioD1,
    'quien cerró a las 20:00 no debe tomar el turno de las 05:00 del día siguiente (<10 h de descanso)');
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