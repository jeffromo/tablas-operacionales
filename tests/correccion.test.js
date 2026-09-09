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

// FIX hallazgo 4 (spec §5 Paso 4): un swap puede mejorar la equidad pero dejar
// turnos descubiertos (flota justa + indisponibilidades); corregirEquidad debe
// rechazarlo cuando recibe la demanda de la semana.
test('corregirEquidad rechaza un swap que mejoraria equidad pero degradaria cobertura', () => {
  // Escenario (3 fechas: w0 = [f0,f1], w1 = [f2]; demanda A=2 turnos/fecha, B=1):
  //   U0 indisponible todo el mes; U2 indisponible en f2.
  //   w0: A [U1,U2] cubierta, B [U3] cubierta.
  //   w1: A [U1,U2] → t0=U1, t1 DESCUBIERTO; B [U4,U0] → U4.
  // Días trabajados (fechas distintas): U1:3, U2:2, U3:2, U4:1
  // → dispersión 2 > tolerancia 1: el pase intenta swaps.
  // El swap U1(A,w1) ↔ U0(B,w1) dejaría U1:2,U2:2,U3:2,U4:1
  // → dispersión 1 (¡mejora la equidad!) pero A f2 con t0 y t1 descubiertos:
  // cobertura 1 → 2. El guardia debe rechazarlo.
  const disponible = (u, fecha) => u !== 'U0' && !(fecha === 'f2' && u === 'U2');
  const demanda = {
    0: { A: [{ fecha: 'f0', turnoIndex: 0 }, { fecha: 'f0', turnoIndex: 1 },
             { fecha: 'f1', turnoIndex: 0 }, { fecha: 'f1', turnoIndex: 1 }],
         B: [{ fecha: 'f0', turnoIndex: 0 }, { fecha: 'f1', turnoIndex: 0 }] },
    1: { A: [{ fecha: 'f2', turnoIndex: 0 }, { fecha: 'f2', turnoIndex: 1 }],
         B: [{ fecha: 'f2', turnoIndex: 0 }] },
  };
  const fechasDe = { 0: ['f0', 'f1'], 1: ['f2'] };
  const turnosDe = { A: 2, B: 1 };

  // Simula generarSemanaRuta: por fecha, turnos → unidades disponibles de la
  // piscina en orden; si no alcanzan, quedan descubiertos.
  const crearSim = (piscinas) => {
    const regenerar = (w) => {
      const out = [];
      for (const [ruta, units] of Object.entries(piscinas[w])) {
        for (const fecha of fechasDe[w]) {
          let asignados = 0;
          for (const u of units) {
            if (asignados >= turnosDe[ruta]) break;
            if (!disponible(u, fecha)) continue;
            out.push({ fecha, rutaId: ruta, turnoIndex: asignados, unidadId: u });
            asignados++;
          }
        }
      }
      return out;
    };
    return { piscinas, regenerar, asignacionesSemana: [regenerar(0), regenerar(1)] };
  };
  const sinCubrirDe = (regs, dem) => {
    const cub = new Set(regs.map(a => `${a.rutaId}|${a.fecha}|${a.turnoIndex}`));
    let n = 0;
    for (const [rid, ts] of Object.entries(dem))
      for (const t of ts)
        if (!cub.has(`${rid}|${t.fecha}|${t.turnoIndex}`)) n++;
    return n;
  };
  const unidades = ['U0', 'U1', 'U2', 'U3', 'U4'].map(id => ({ id }));

  const piscinas = [
    { A: ['U1', 'U2'], B: ['U3'] },
    { A: ['U1', 'U2'], B: ['U4', 'U0'] },
  ];
  const sim = crearSim(piscinas);
  assert.equal(sinCubrirDe(sim.asignacionesSemana[1], demanda[1]), 1,
    'estado inicial: 1 turno descubierto en la semana 1');
  const cargasIniciales = [...diasTrabajados(sim.asignacionesSemana.flat()).values()];
  assert.ok(Math.max(...cargasIniciales) - Math.min(...cargasIniciales) >= 2,
    `dispersión inicial ${Math.max(...cargasIniciales) - Math.min(...cargasIniciales)} supera la tolerancia: el pase intenta swaps`);

  const r = corregirEquidad({
    piscinas: sim.piscinas, asignacionesSemana: sim.asignacionesSemana, unidades,
    regenerarSemana: sim.regenerar, tolerancia: 1, demanda,
  });

  // El swap que mejoraba equidad fue rechazado...
  assert.equal(r.cambios.length, 0, `cambios: ${JSON.stringify(r.cambios)}`);
  // ...la cobertura no bajó...
  assert.equal(sinCubrirDe(r.asignacionesSemana[1], demanda[1]), 1,
    'la cobertura no debe degradarse');
  // ...y las piscinas quedaron como estaban (swap revertido).
  assert.deepEqual(r.piscinas[1].A, ['U1', 'U2']);
  assert.deepEqual(r.piscinas[1].B, ['U4', 'U0']);

  // Contrafactual: sin el guardia (sin demanda) el MISMO swap se acepta
  // (dispersión 2 → 1) dejando 2 turnos descubiertos — exactamente lo que el
  // guardia impide.
  const clon = structuredClone(piscinas);
  const sim2 = crearSim(clon);
  const r2 = corregirEquidad({
    piscinas: sim2.piscinas, asignacionesSemana: sim2.asignacionesSemana,
    unidades, regenerarSemana: sim2.regenerar, tolerancia: 1,
  });
  assert.equal(r2.cambios.length, 1, 'sin demanda el swap mejoraría equidad y se aceptaría');
  assert.equal(sinCubrirDe(r2.asignacionesSemana[1], demanda[1]), 2,
    'sin guardia la cobertura caería: 2 turnos descubiertos');
});