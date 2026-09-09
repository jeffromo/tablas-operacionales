import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generaPlanMes } from '../src/js/engine/index.js';

// Datos del PDF: ruta CAUPICHO, grupo Lunes-Sábado, 25 turnos.
const HORAS = ['04:50','04:57','05:04','05:11','05:18','05:25','05:31','05:37','05:43','05:49',
  '05:55','06:01','06:07','06:13','06:19','06:25','06:31','06:39','06:47','06:55',
  '07:03','07:11','07:19','07:27','07:35'];
const UNIDADES = ['1664','1552','1529','1657','1533','1671','1700','1688','1686','1631',
  '1539','1666','1658','1634','1627','1515','1704','1633','1544','1532',
  '1540','1536','1689','1670','1518'];

test('patrón CAUPICHO: 25 unidades rotan 1 turno por día como el PDF', () => {
  const plan = generaPlanMes({
    rutas: [{
      id: 'caupicho', nombre: 'CAUPICHO', peso: 10,
      gruposDia: [{ nombre: 'L-S', dias: [1,2,3,4,5,6],
        turnos: HORAS.map(h => ({ hora: h, punto: 'INICIO' })) }],
    }],
    unidades: UNIDADES.map(id => ({ id })),
    mes: 9, anio: 2026,
  });

  const porDia = (fecha) => Object.fromEntries(
    plan.asignaciones.filter(a => a.fecha === fecha).map(a => [a.turnoIndex, a.unidadId]));

  // Primer día hábil de la semana 2: cada turno debe tomar la unidad que
  // el día anterior estaba un turno más adelante (avance -1 como el PDF).
  const d1 = porDia('2026-09-01'); // martes
  const d2 = porDia('2026-09-02'); // miércoles
  assert.equal(d1[0], '1664'); // orden natural de la flota el primer día
  for (let t = 0; t < 25; t++) {
    const esperado = t === 0 ? '1664' : UNIDADES[t];
    assert.equal(d1[t], esperado, `turno ${t + 1} día 1`);
  }
  for (let t = 0; t < 25; t++) {
    const esperado = UNIDADES[(t + 1) % 25]; // rotación -1 turno por día
    assert.equal(d2[t], esperado, `turno ${t + 1} día 2`);
  }
  assert.equal(plan.advertencias.length, 0); // cobertura total: sin problemas reales
  // Equidad perfecta: grupo L-S → septiembre 2026 tiene 26 días hábiles
  // (4 domingos sin turnos: 6, 13, 20, 27); 26 días × 25 turnos / 25 unidades
  // = 26 días trabajados por unidad.
  assert.ok(plan.resumenEquidad.includes('min 26, max 26'), `resumen de equidad: ${plan.resumenEquidad}`);
});