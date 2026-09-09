import { diasDelMes, dow, aMinutos } from './fechas.js';

// Turnos vigentes de una ruta para un día de semana (0=dom..6=sáb).
// Si dos grupos incluyen el mismo día, gana el primero declarado.
export function turnosVigentes(ruta, diaSemana) {
  const grupo = ruta.gruposDia.find(g => g.dias.includes(diaSemana));
  return grupo ? grupo.turnos : [];
}

// Paso 1: expande el mes en días con su demanda concreta de turnos.
export function expandirMes({ rutas, mes, anio }) {
  return diasDelMes(anio, mes).map(fecha => {
    const d = dow(fecha);
    const turnos = [];
    for (const ruta of rutas) {
      turnosVigentes(ruta, d)
        .slice()
        .sort((a, b) => aMinutos(a.hora) - aMinutos(b.hora))
        .forEach((t, i) => turnos.push({
          rutaId: ruta.id, rutaNombre: ruta.nombre,
          turnoIndex: i, hora: t.hora, punto: t.punto,
        }));
    }
    return { fecha, dow: d, turnos };
  });
}