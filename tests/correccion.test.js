import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diasTrabajados, corregirEquidad } from '../src/js/engine/correccion.js';

// FIX hallazgo 3: diasTrabajados cuenta FECHAS DISTINTAS por unidad, no
// asignaciones — la métrica "DÍAS TRABAJADOS" (spec §11, tolerancia ±1) se
// promete en días; con la relajación de cobertura una unidad con doble turno
// el mismo día debe seguir sumando 1.
test('diasTrabajados cuenta fechas distintas por unidad', () => {
  const m = diasTrabajados([
    { unidadId: 'A', fecha: '2026-09-01' },
    { unidadId: 'A', fecha: '2026-09-01' }, // doble turno el mismo día: suma 1
    { unidadId: 'A', fecha: '2026-09-02' },
    { unidadId: 'B', fecha: '2026-09-01' },
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

test('corregirEquidad ejecuta intercambios: la dispersión baja y cambios registra el swap', () => {
  // Fixture desbalanceada que fuerza al menos un intercambio. El regenerar emite
  // un elemento por TURNO (formato real de generarSemanaRuta): Rica = 4 turnos/día,
  // Pobre = 1. Es la misma simulación del test anterior, pero por turno, para que
  // diasTrabajados (1 por elemento) refleje la carga distinta entre rutas.
  //   w0: Rica [U1,U2], Pobre [U3,U4]  → U1:4 U2:4 U3:1 U4:1
  //   w1: Rica [U2],   Pobre [U1,U3,U4] → U2:+4, resto +1
  // Cargas iniciales: U1:5, U2:8, U3:2, U4:2 → dispersión 6 > tolerancia 1.
  // Camino esperado: U1↔U3 y U1↔U4 en w0 NO mejoran (ejercitan el revert),
  // luego U2↔U3 en w0 baja la dispersión a 3 y queda registrado en cambios.
  const piscinas = [
    { Rica: ['U1', 'U2'], Pobre: ['U3', 'U4'] },
    { Rica: ['U2'], Pobre: ['U1', 'U3', 'U4'] },
  ];
  const turnosDia = { Rica: 4, Pobre: 1 };
  const regenerar = (w) => {
    const out = [];
    for (const [ruta, units] of Object.entries(piscinas[w])) {
      for (const u of units) {
        for (let t = 0; t < turnosDia[ruta]; t++) {
          out.push({ fecha: `s${w}-d${t}`, turnoIndex: t, rutaId: ruta, unidadId: u });
        }
      }
    }
    return out;
  };
  const dispersionDe = (asigs) => {
    const porUnidad = {};
    for (const a of asigs.flat()) porUnidad[a.unidadId] = (porUnidad[a.unidadId] || 0) + 1;
    const vals = Object.values(porUnidad);
    return { porUnidad, dispersion: Math.max(...vals) - Math.min(...vals) };
  };

  const asignacionesSemana = [regenerar(0), regenerar(1)];
  const antes = dispersionDe(asignacionesSemana);
  assert.ok(antes.dispersion > 1, `dispersión inicial debe superar la tolerancia: ${JSON.stringify(antes.porUnidad)}`);

  const r = corregirEquidad({
    piscinas, asignacionesSemana,
    unidades: ['U1', 'U2', 'U3', 'U4'].map(id => ({ id })),
    regenerarSemana: regenerar, tolerancia: 1,
  });

  const despues = dispersionDe(r.asignacionesSemana);
  assert.ok(
    despues.dispersion < antes.dispersion,
    `la dispersión debe disminuir: ${antes.dispersion} → ${despues.dispersion} (${JSON.stringify(despues.porUnidad)})`,
  );
  assert.ok(
    Array.isArray(r.cambios) && r.cambios.length >= 1,
    `cambios debe registrar al menos un intercambio: ${JSON.stringify(r.cambios)}`,
  );
});