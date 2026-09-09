# Generador de Tablas Operacionales de Transporte

Aplicación web local que genera la tabla operacional mensual: qué unidad cubre
cada turno de cada ruta en cada día del mes, con rotación de horarios y equidad
de días trabajados.

## Uso

**Importante:** la app usa módulos ES (`type="module"`), que el navegador bloquea
por CORS si se abre `index.html` con `file://` (doble clic). Hay que servirla
con un servidor estático:

```bash
npx serve .
# y abrir la URL que indica (normalmente http://localhost:3000) en Chrome/Edge
```

1. **Rutas**: crear cada ruta, generar sus turnos por frecuencia (o editarlos
   a mano) y definir cuántos salen del punto INICIO vs FIN.
2. **Unidades**: pegar los números de unidad; opcionalmente marcar
   indisponibilidades (mantenimiento) por rango de fechas.
3. **Generar**: elegir mes y año. El motor cubre todos los turnos, rota las
   unidades entre horarios y rutas, y nivela los días trabajados (±1 día).
4. **Resultado**: revisar las tablas y descargar el Excel (.xlsx).

La configuración queda guardada en el navegador (localStorage, clave
`tablas-operacionales-v1`). Usar Exportar/Importar config (pestaña Rutas) para
respaldarla o moverla a otra computadora.

## Desarrollo

- Tests: `npm test` (suite de Node con `node --test`; requiere Node 18+).
- Estructura:
  - `index.html` — shell de la app: pestañas Rutas, Unidades, Generar, Resultado.
  - `src/estilos.css` — estilos.
  - `src/js/main.js` — arranque y navegación entre pestañas.
  - `src/js/state.js` — estado persistente en localStorage (`tablas-operacionales-v1`).
  - `src/js/views/` — interfaz: `rutaView.js`, `unidadView.js`, `generarView.js`, `resultadoView.js`.
  - `src/js/engine/` — motor de generación, sin dependencias: `fechas.js`,
    `expandir.js`, `reparto.js`, `rotacion.js`, `correccion.js`, `validar.js`, `index.js`.
  - `src/js/export/excel.js` — generación del libro .xlsx a partir del plan.
  - `vendor/xlsx.full.min.js` — SheetJS 0.20.3, incluida localmente (sin CDN).
  - `tests/` — suite de tests (`node --test`).

El motor (`src/js/engine/`) es JavaScript puro sin dependencias ni DOM, por eso
se testa directamente con Node; las vistas consumen el plan que produce.