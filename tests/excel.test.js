import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('../vendor/xlsx.full.min.js');
import { generaPlanMes } from '../src/js/engine/index.js';
import { planAWorkbook } from '../src/js/export/excel.js';

test('planAWorkbook genera una hoja por ruta y hoja RESUMEN con celdas correctas', () => {
  const rutas = [{ id: 'A', nombre: 'BASTION', peso: 1,
    gruposDia: [{ nombre: 'L-D', dias: [0,1,2,3,4,5,6], turnos: [{ hora: '05:00', punto: 'INICIO' }] }] }];
  const plan = generaPlanMes({
    rutas, unidades: ['1','2','3'].map(id => ({ id })), mes: 9, anio: 2026,
  });
  const wb = planAWorkbook(plan, rutas);
  assert.ok(wb.SheetNames.includes('BASTION L-D'));
  assert.ok(wb.SheetNames.includes('RESUMEN'));
  const hoja = wb.Sheets['BASTION L-D'];
  assert.equal(XLSX.utils.sheet_to_json(hoja, { header: 1 })[2][0], 'TURNO');
  const resumen = XLSX.utils.sheet_to_json(wb.Sheets.RESUMEN, { header: 1 });
  assert.ok(resumen.flat().includes('1664') || resumen.flat().some(c => String(c).match(/^(1|2|3)$/)),
    'el resumen lista las unidades');
});

// FIX hallazgo 6: slice(0,31) colisionaba y no filtraba []:*?/\ — dos grupos
// con el mismo nombre largo producían una sola hoja (SheetJS la renombra o
// pisa) y nombres inválidos para Excel.
test('nombres de hoja sanitizados, ≤31 y únicos ante colisión', () => {
  const nombreLargo = 'GRUPO CON NOMBRE MUY LARGO [1]:*?';
  const rutas = [{ id: 'A', nombre: 'Ruta/X', peso: 1, gruposDia: [
    { nombre: nombreLargo, dias: [1], turnos: [{ hora: '05:00', punto: 'INICIO' }] },
    { nombre: nombreLargo, dias: [2], turnos: [{ hora: '06:00', punto: 'FIN' }] },
  ]}];
  const plan = {
    dias: [{ fecha: '2026-09-07', dow: 1 }, { fecha: '2026-09-08', dow: 2 }],
    asignaciones: [], metricas: [], advertencias: [],
  };
  const wb = planAWorkbook(plan, rutas);
  const hojas = wb.SheetNames.filter(n => n !== 'RESUMEN');
  assert.equal(hojas.length, 2, 'una hoja por grupo');
  assert.equal(new Set(hojas).size, 2, 'sin colisiones de nombre');
  for (const n of hojas) {
    assert.ok(n.length <= 31, `"${n}" debe tener ≤ 31 caracteres`);
    assert.ok(!/[\[\]:*?\/\\]/.test(n), `"${n}" no debe tener caracteres inválidos de Excel`);
  }
});

// FIX hallazgo 6: grupo sin turnos producía "OPERACIÓN 0H" (min de vacío →
// Infinity) y "4H" truncaba "04:50". Ahora H:MM a H:MM y caso vacío manejado.
test('operación del grupo con formato H:MM a H:MM', () => {
  const rutas = [{ id: 'A', nombre: 'BASTION', peso: 1, gruposDia: [
    { nombre: 'L-D', dias: [1,2,3,4,5,6],
      turnos: [{ hora: '04:50', punto: 'INICIO' }, { hora: '21:00', punto: 'FIN' }] },
  ]}];
  const plan = { dias: [{ fecha: '2026-09-07', dow: 1 }], asignaciones: [], metricas: [], advertencias: [] };
  const wb = planAWorkbook(plan, rutas);
  const filas = XLSX.utils.sheet_to_json(wb.Sheets['BASTION L-D'], { header: 1 });
  assert.equal(filas[0][2], 'OPERACIÓN 04:50 a 21:00');
});

test('grupo sin turnos produce operación "sin turnos", no Infinity', () => {
  const rutas = [{ id: 'A', nombre: 'BASTION', peso: 1, gruposDia: [
    { nombre: 'DOM', dias: [0], turnos: [] }]}];
  const plan = { dias: [{ fecha: '2026-09-06', dow: 0 }], asignaciones: [], metricas: [], advertencias: [] };
  const wb = planAWorkbook(plan, rutas);
  const filas = XLSX.utils.sheet_to_json(wb.Sheets['BASTION DOM'], { header: 1 });
  assert.equal(filas[0][2], 'OPERACIÓN sin turnos');
  assert.ok(!filas.flat().some(c => String(c).includes('Infinity')), 'sin Infinity');
});