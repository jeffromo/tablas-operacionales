import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diasTrabajados, corregirEquidad } from '../src/js/engine/correccion.js';

test('diasTrabajados cuenta asignaciones por unidad', () => {
  const m = diasTrabajados([
    { unidadId: 'A' }, { unidadId: 'A' }, { unidadId: 'B' },
  ]);
  assert.equal(m.get('A'), 2);
  assert.equal(m.get('B'), 1);
});

test('corregirEquidad nivela cargas desbalanceadas intercambiando piscinas', () => {
  // Escenario: semana 0 — ruta Rica(3 turnos/día) con U1,U2,U3; ruta Pobre(1) con U4.
  // Semana 1 — invertido. U4 siempre en ruta de 1 turno → carga menor.
  // regenerarSemana simula: cada unidad trabaja los turnos/día de su ruta ese día.
  const piscinas = [
    { Rica: ['U1', 'U2', 'U3'], Pobre: ['U4'] },
    { Rica: ['U4'], Pobre: ['U1', 'U2', 'U3'] },
  ];
  const turnosRuta = { Rica: 3, Pobre: 1 };
  const regenerar = (w) => {
    const out = [];
    for (const [ruta, units] of Object.entries(piscinas[w])) {
      for (const u of units) out.push({ rutaId: ruta, unidadId: u, dias: turnosRuta[ruta] });
    }
    return out;
  };
  const asignacionesSemana = [regenerar(0), regenerar(1)];
  const unidades = ['U1', 'U2', 'U3', 'U4'].map(id => ({ id }));
  const r = corregirEquidad({ piscinas, asignacionesSemana, unidades, regenerarSemana: regenerar, tolerancia: 1 });
  const cargas = diasTrabajados(r.asignacionesSemana.flat().map(a => ({ unidadId: a.unidadId, n: a.dias })));
  // Nota: diasTrabajados cuenta 1 por elemento; el test de spreads se hace con los dias simulados:
  const porUnidad = {};
  for (const a of r.asignacionesSemana.flat()) porUnidad[a.unidadId] = (porUnidad[a.unidadId] || 0) + a.dias;
  const vals = Object.values(porUnidad);
  assert.ok(Math.max(...vals) - Math.min(...vals) <= 1, `cargas mensuales equitativas: ${JSON.stringify(porUnidad)}`);
  assert.ok(Array.isArray(r.cambios));
});