import type { Rancho } from "@/lib/types";

/**
 * ============================================================
 * Qué columnas de `ranchos` puede pedir una pantalla pública
 * ============================================================
 *
 * ESPEJO de src/lib/ranchos-publicos.ts de la web (proyecto aparte:
 * no se puede importar, se replica). Si allá se agrega una columna a
 * una lista, revisá si acá hace falta la misma.
 *
 * `ranchos` es legible por cualquiera: es un directorio. Pero la MISMA
 * fila guarda los datos de cobro del proveedor — a qué SINPE y a qué
 * cuenta hay que transferirle. Un `select("*")` los baja junto con el
 * resto, así que el teléfono de cualquier curioso recibe por la red las
 * cuentas de todos los proveedores del país sin haber reservado nada.
 *
 * La regla: ninguna consulta de una pantalla pública (directorio,
 * ficha, buscador) puede pedir `*` sobre `ranchos`. El panel del DUEÑO
 * sí puede — corre con sesión y lee su propia fila.
 *
 * Ojo con el otro lado de la moneda: a partir de la migración 0140 el
 * rol anónimo tiene permiso columna por columna. Una columna nueva NO
 * queda pública sola — hay que sumarla al `grant` de esa migración
 * además de a la lista de acá.
 */

/**
 * Las columnas de cobro. Están juntas y con nombre propio para que sea
 * evidente qué es lo que nunca va en una lista pública.
 */
export const COLUMNAS_COBRO =
  "sinpe_numero, sinpe_titular, cuenta_banco, cuenta_numero, cuenta_titular, cuenta_tipo";

/**
 * Lo que leen las tarjetas del directorio de Eventos (pantallas/
 * explorar.tsx). `created_at` y `estado` van porque la consulta ordena
 * y filtra por ellos, y en Postgres ordenar por una columna también
 * pide permiso de lectura sobre ella.
 *
 * `detalles` va desde que se arregló la pausa: ahí vive
 * `en_configuracion`, la bandera con la que el dueño frena su
 * publicación mientras la termina de armar. Sin ella, la tarjeta no
 * tenía cómo saber que el negocio está en pausa y el teléfono lo
 * seguía abriendo — y cobrando — cuando el sitio web ya no lo hacía.
 * (Es una columna que el rol anónimo ya lee: viene en COLUMNAS_FICHA.)
 */
export const COLUMNAS_CARD =
  "id, slug, nombre, categoria, subcategoria, vertical, provincia, canton, " +
  "capacidad_min, capacidad_max, precio_desde, unidad_precio, foto_url, " +
  "detalles, estado, destacado_orden, created_at";

/**
 * Lo que pinta la ficha pública de un negocio de Eventos
 * (app/rancho/[id].tsx) — verificada campo por campo contra la
 * pantalla. Es la misma lista que COLUMNAS_PORTAL en la web, menos las
 * columnas que la app todavía no dibuja.
 *
 * `owner_id` SÍ va: la burbuja de chat lo necesita para abrir el hilo
 * con el proveedor, y no es un dato sensible (es un uuid de auth).
 *
 * `zona_horaria` va desde que los proveedores de eventos (todo lo que
 * no es un Lugar) trabajan por horas: la agenda de la ficha se calcula
 * en la zona del NEGOCIO, no en la del teléfono.
 */
export const COLUMNAS_FICHA =
  "id, owner_id, slug, nombre, descripcion, descripcion_larga, categoria, " +
  "subcategoria, vertical, estado, provincia, canton, direccion_exacta, " +
  "latitud, longitud, foto_url, foto_presentacion, fotos, amenidades, " +
  "detalles, terminos, monto_minimo, capacidad_min, capacidad_max, " +
  "precio_desde, unidad_precio, deposito_reserva, horarios_bloques, " +
  "eventos_por_dia, zona_horaria, destacado_orden, created_at, instagram, " +
  "facebook, tiktok, sitio_web, contacto_whatsapp";

/**
 * La fila de `ranchos` tal como la ve el público: la misma de siempre
 * MENOS los datos de cobro. Es un `Omit` y no un tipo nuevo a propósito
 * — así el compilador marca en rojo cualquier `rancho.sinpe_numero` que
 * alguien vuelva a escribir en una pantalla pública, en vez de dejarlo
 * pasar y mostrar un campo vacío en producción.
 */
export type RanchoPublico = Omit<
  Rancho,
  | "sinpe_numero"
  | "sinpe_titular"
  | "cuenta_banco"
  | "cuenta_numero"
  | "cuenta_titular"
  | "cuenta_tipo"
>;
