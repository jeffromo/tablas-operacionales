// Utilidades de fechas. Todas las fechas son strings 'YYYY-MM-DD' en UTC.
const MS_DIA = 86400000;

export function parse(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function fmt(date) {
  return date.toISOString().slice(0, 10);
}

export function diasDelMes(anio, mes) {
  const n = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => fmt(new Date(Date.UTC(anio, mes - 1, i + 1))));
}

export function dow(fecha) {
  return parse(fecha).getUTCDay(); // 0=domingo .. 6=sábado
}

export function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function addDias(fecha, n) {
  return fmt(new Date(parse(fecha).getTime() + n * MS_DIA));
}

// Agrupa fechas en semanas que empiezan lunes. La primera y última semana
// del mes pueden quedar parciales (incluyen los días del mes solamente).
export function semanarDias(fechas) {
  const semanas = [];
  let actual = null;
  for (const f of fechas) {
    if (!actual || dow(f) === 1) { actual = []; semanas.push(actual); }
    actual.push(f);
  }
  return semanas;
}