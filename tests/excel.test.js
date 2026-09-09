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