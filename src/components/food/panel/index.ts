/**
 * ═══════════════════════════════════════════════════════════════════
 *  PIEZAS VISUALES DEL PANEL DE FOOD.BOOKEA — el índice
 * ═══════════════════════════════════════════════════════════════════
 *
 * Todo lo que las pantallas del panel (/food/negocio/**) comparten
 * visualmente vive acá. Las pantallas de la fase 2 (Reservas,
 * Clientes, Rendimiento, Promociones, Perfil) importan de ESTE índice
 * y no re-inventan tarjetas ni gráficos. Los tamaños y colores base
 * salen de `@/components/panel/sistema` (el sistema de paneles de todo
 * el sitio); acá solo se arma la anatomía propia de FOOD.
 *
 * QUÉ EXPORTA CADA UNO
 *
 * — TarjetaPanel (server-safe) ......... la tarjeta con encabezado:
 *     { kicker?, titulo?, accion?, notaDemo?, children, className? }
 * — EncabezadoPagina (server-safe) ..... título+bajada de una pantalla:
 *     { titulo, descripcion?, acciones?, className? }
 * — KpiCard (cliente) .................. métrica grande animada:
 *     { rotulo, valor, formato? "entero"|"colones"|"porcentaje",
 *       delta?, notaDelta?, detalle?, icono?, className? }
 * — GraficoArea (cliente) .............. área/línea SVG con crosshair:
 *     { puntos: {etiqueta,valor}[], serie, color?, alto?,
 *       formatearValor?, formatearTick?, className? }
 * — GraficoBarras (cliente) ............ barras SVG con hover por slot:
 *     { barras: {etiqueta,valor,destacada?}[], serie, color?, alto?,
 *       formatearValor?, formatearTick?, className? }
 * — GraficoRendimiento (cliente) ....... la serie diaria con pestañas
 *     [Reservas][Personas][Check-ins]: { serie: PuntoDia[], alto?,
 *       className? }
 * — MapaCalor (cliente) ................ mapa de calor día × hora en
 *     escala secuencial de un solo matiz: { filas, columnas, valores,
 *       serie, className? } — valores en % de la demanda (0-100)
 * — InsigniaEstado (server-safe) ....... píldora de estado unificada:
 *     { estado: EstadoInsignia, className? } — reservas demo/reales y
 *     promos usan el MISMO diccionario de colores.
 * — NotaDemo (server-safe) ............. marquita "Datos de ejemplo".
 * — NotaEstimacion (server-safe) ....... la letra chica obligatoria de
 *     toda cifra en colones: { enOscuro?, className? }.
 *
 * FRONTERA CLIENTE/SERVIDOR: cada archivo declara su propio "use
 * client" si lo necesita; este índice re-exporta sin opinar. Ningún
 * archivo de esta carpeta exporta helpers sueltos desde un módulo
 * cliente (la regla que ya rompió Finanzas e IA): los datos y sus
 * helpers viven en src/lib/food/panel-demo.ts, que es neutro.
 */

export { TarjetaPanel } from "./tarjeta-panel";
export { EncabezadoPagina } from "./encabezado-pagina";
export { KpiCard } from "./kpi-card";
export { GraficoArea, type PuntoGrafico } from "./grafico-area";
export { GraficoBarras, type BarraGrafico } from "./grafico-barras";
export { GraficoRendimiento } from "./grafico-rendimiento";
export { MapaCalor, type DatosMapaCalor } from "./mapa-calor";
export { InsigniaEstado, type EstadoInsignia } from "./insignia-estado";
export { NotaDemo, NotaEstimacion } from "./notas";
