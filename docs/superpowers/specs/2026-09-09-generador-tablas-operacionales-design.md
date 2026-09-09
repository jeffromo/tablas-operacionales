# Diseño: Generador de Tablas Operacionales de Transporte Público

**Fecha:** 2026-09-09
**Estado:** Diseño aprobado por el usuario (pendiente plan de implementación)

## 1. Problema

Generar las tablas operacionales mensuales de una empresa de transporte público: qué unidad (bus) cubre cada turno de cada ruta en cada día del mes. Hoy el operador lo hace manualmente (ver `ROTACION DEL 31 AGO AL 06 SEP 2026.pdf`), lo que no escala con la flota y hace difícil garantizar equidad.

## 2. Requisitos funcionales

1. Número ilimitado de unidades de transporte.
2. Número ilimitado de rutas.
3. Cada ruta define sus turnos (horarios de salida) por tipo de día (ej. Lunes–Sábado vs Domingo pueden tener turnos distintos).
4. Cada turno tiene punto de partida fijo: punto INICIO o punto FIN de la ruta. La proporción de turnos por punto es configurable (ej. 80% inicio / 20% fin, o 100% en uno solo).
5. El recorrido de un bus es **ida y vuelta al mismo punto**: el bus termina su turno donde empezó.
6. Todas las rutas operan todos los días; la "concurrencia" (peso) de una ruta se materializa en su cantidad de turnos/día → las rutas concurridas llevan más buses.
7. Las unidades **rotan entre rutas** (asignación por bloques semanales) y **rotan entre horarios** dentro de su ruta (avance gradual turno a turno, sin saltos bruscos tipo 21:00 → 4:50 al día siguiente).
8. **Equidad mensual**: todas las unidades trabajan aproximadamente la misma cantidad de días en el mes. Si una ruta tiene más unidades en su piscina que turnos/día, las unidades alternan días de descanso equitativamente.
9. Excepciones: unidades indisponibles por rango de fechas (mantenimiento).
10. Validación automática: ningún turno vacío; reporte de días trabajados por unidad (mín/máx/promedio).
11. Salida: archivo Excel (.xlsx) con una hoja por ruta en el formato del PDF de referencia, más hoja resumen.
12. Configuración persistente en el navegador y exportable/importable como JSON.

## 3. Fuera de alcance (v1)

- Optimizador con solver (ILP): el enfoque determinista con pase de corrección es suficiente; la estructura deja crecer a un híbrido después.
- Costos, conductores/choferes, kilometraje, consumo: solo se programa la unidad (bus).
- Multiusuario / servidor: la app corre local en el navegador.
- Generación de PDF imprimible (se puede agregar después; v1 solo Excel).

## 4. Modelo de datos

### Ruta
```
Ruta {
  id: string
  nombre: string                    // "CAUPICHO"
  gruposDia: [                      // uno o más grupos
    {
      nombre: "Lunes-Sábado",       // etiqueta
      dias: [1,2,3,4,5,6],          // 0=domingo .. 6=sábado
      turnos: [
        { hora: "04:50", punto: "INICIO" | "FIN" }
      ]
    }
  ]
  peso: number (opcional, informativo/prioridad)
}
```

### Unidad
```
Unidad {
  id: string                        // "1664"
  indisponibilidades: [ { desde: date, hasta: date } ]
}
```

### Configuración de generación
```
ConfigGeneracion {
  mes: number, anio: number
}
```

### Resultado
```
AsignacionDia { fecha: date, rutaId: string, turnoIndex: number, unidadId: string|null }
PlanMes { asignaciones: AsignacionDia[], metricas: MetricasEquidad[], advertencias: string[] }
```

## 5. Algoritmo (Enfoque A: determinista con pase de corrección)

### Paso 1 — Expansión de mes
Para cada fecha del mes: determinar tipo de día → conjunto de turnos vigentes por ruta. Resultado: demanda diaria = lista de turnos (ruta, hora, punto) a cubrir ese día.

### Paso 2 — Reparto semanal de flota (asignación unidad→ruta)
- La primera semana usa el orden natural de las unidades.
- Tamaño de piscina por ruta ∝ turnos/día de esa ruta (reparto proporcional; el residuo se asigna a las rutas con mayor demanda primero).
- Cada unidad trabaja toda la semana en la piscina asignada.
- Semana siguiente: las piscinas rotan (las unidades avanzan al siguiente grupo de rutas en orden cíclico), de modo que en el mes todas las unidades pasen por rutas de demanda alta y baja.

### Paso 3 — Rotación de horarios dentro de la piscina
- Turnos de la piscina ordenados por hora. Cada unidad toma un turno el día D y avanza a un turno posterior el día D+1 (avance gradual, patrón +1 turno/día como el PDF de referencia).
- Si la piscina tiene más unidades que turnos/día: los turnos del día se cubren rotando entre todas las unidades de la piscina (unas unidades descansan hoy, otras mañana, alternancia equitativa determinista).
- Restricción anti-salto: si la unidad cerró tarde (últimos turnos), su siguiente turno debe ser temprano-medio del día siguiente, no el más temprano posible; se prefiere el avance mínimo que respete una ventana de descanso mínima (parámetro interno, ej. 10 horas entre cierre y siguiente salida).

### Paso 4 — Pase de corrección (equidad)
- Calcular días trabajados por unidad en el mes.
- Mientras existan unidades por encima/debajo del promedio más allá de tolerancia (±1 día), intercambiar asignaciones futuras entre unidades que no violen indisponibilidades ni cobertura.
- Unidades indisponibles: sus turnos se reasignan a unidades disponibles de la misma piscina (o intercambio con otra piscina si es necesario).

### Paso 5 — Validación y métricas
- Cobertura: todo turno de todo día tiene unidad asignada; si no es posible (flota insuficiente), advertencia explícita con los turnos sin cubrir.
- Equidad: días trabajados por unidad, mín/máx/promedio y desviación.
- Saltos de horario: conteo de violaciones a la ventana de descanso.

## 6. Arquitectura de la aplicación

**Aplicación web local de una sola página** (HTML + JavaScript vanilla, ES modules), corre abriendo el archivo o servida estáticamente; sin backend.

```
/src
  index.html
  /js
    main.js          — arranque y navegación de pestañas
    state.js         — estado global (rutas, unidades, mes) + persistencia localStorage + import/export JSON
    rutaView.js      — UI pestaña Rutas (grupos de día, turnos manuales o por frecuencia)
    unidadView.js    — UI pestaña Unidades (alta, indisponibilidades)
    generarView.js   — UI pestaña Generar (mes/año, validaciones previas, ejecución)
    resultadoView.js — vista previa de tablas por ruta + descarga Excel
    /engine
      expandir.js    — Paso 1
      reparto.js     — Paso 2
      rotacion.js    — Paso 3
      correccion.js  — Paso 4
      validar.js     — Paso 5
      index.js       — generaPlanMes(config) orquestador
    /export
      excel.js       — PlanMes → .xlsx (SheetJS, incluida localmente)
    /tests
      engine.test.html  — suite de tests del motor (corre en navegador)
```

**Librería externa única:** SheetJS (xlsx.full.min.js) incluida en `/vendor`, sin dependencia de internet.

## 7. Interfaz de usuario

Pestañas: **Rutas** → **Unidades** → **Generar** → **Resultado**.

- Rutas: alta/edición; por grupo de día, crear turnos manualmente o con generador por frecuencia (hora inicio, hora fin, cada X min, % inicio/fin que se reparte entre los turnos ordenados).
- Unidades: alta rápida (pegar lista de números), indisponibilidades por rango de fechas.
- Generar: mes/año, chequeo previo (unidades suficientes vs turnos/día por ruta), botón generar.
- Resultado: vista previa de cada tabla (estilo PDF: filas = turnos con TURNO/HORA/PUNTO, columnas = días, celdas = número de unidad), resumen de equidad, botón Descargar Excel.

## 8. Salida Excel

- Hoja por ruta (+ sufijo de grupo de día si hay varios, ej. "CAUPICHO L-S", "CAUPICHO DOM").
  - Encabezado: nombre ruta, horario de operación.
  - Filas: TURNO, HORA, PUNTO, luego una columna por fecha del mes.
  - Celdas: número de unidad.
- Hoja "RESUMEN": días trabajados por unidad, cobertura, advertencias.

## 9. Manejo de errores

- Configuración inválida (ruta sin turnos en un día que opera, mes sin unidades, etc.): bloquear generación con mensaje específico.
- Flota insuficiente para cubrir la demanda: generar lo posible + advertencias listando turnos vacíos.
- localStorage no disponible (navegador en privado): la app funciona sin guardar; avisar.
- Errores inesperados del generador: nunca deben dejar turnos vacíos silenciosamente — siempre pasar por validar.js antes de mostrar el resultado.

## 10. Pruebas

- Tests unitarios del motor (expandir, reparto, rotación, corrección, validación) con casos:
  1. Ruta única con patrón idéntico al PDF (25 turnos, 25 unidades) → rotación +1/día.
  2. Dos rutas con demanda desigual → equidad mensual ±1 día.
  3. Piscina con más unidades que turnos → descansos alternados equitativos.
  4. Unidad en mantenimiento → sus turnos cubiertos, su carga compensada.
  5. Ventana de descanso mínima respetada.
  6. Flota insuficiente → advertencias correctas.
- Suite corre en navegador desde `tests/engine.test.html` (asserts simples, sin framework).
- Verificación manual: generar un mes con datos del PDF y comparar patrón contra la tabla original.

## 11. Parámetros por defecto (constantes en código, no en UI, para v1)

- Tolerancia de equidad: ±1 día trabajado entre unidades.
- Ventana mínima de descanso entre turnos de días consecutivos: 10 horas.
- Orden de rotación de piscinas entre semanas: cíclico simple por orden natural de unidades.