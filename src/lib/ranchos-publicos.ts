import type { Rancho } from "@/app/mi-negocio/types";

/**
 * Lo mínimo que `leerCuentasDeCobro` le pide a un cliente de Supabase.
 * Es estructural a propósito: así la misma función sirve con el cliente
 * de la sesión y con el de servicio (createAdminClient), sin que este
 * módulo —que también lo importan componentes "use client"— tenga que
 * importar el código de ninguno de los dos.
 */
type LectorDeCuentas = { from(tabla: string): unknown };

/** El pedacito del constructor de consultas que se usa acá. Va aparte
 *  —y `from` devuelve `unknown`— porque describir el builder completo
 *  hacía que TypeScript comparara los dos clientes hasta agotarse
 *  ("Type instantiation is excessively deep"). */
type ConsultaDeFila = {
  select(columnas: string): {
    eq(
      columna: string,
      valor: string,
    ): { maybeSingle(): PromiseLike<{ data: unknown }> };
  };
};

/**
 * ============================================================
 * Qué columnas de `ranchos` puede ver el público
 * ============================================================
 *
 * `ranchos` es legible por cualquiera con la llave anónima (así tiene
 * que ser: es un directorio). Pero la MISMA fila guarda los datos de
 * cobro del proveedor — a qué SINPE y a qué cuenta bancaria hay que
 * transferirle. Un `select("*")` los trae junto con el resto, y de ahí
 * en adelante alcanza con que UN dato de esa fila llegue a un
 * componente `"use client"` para que React serialice la propiedad
 * dentro del HTML: queda a la vista de cualquier anónimo y de
 * Googlebot, sin sesión, con solo un `curl`.
 *
 * Eso ya pasó dos veces:
 *
 * 1. En el directorio (/eventos). Se cerró con COLUMNAS_CARD —
 *    ver el comentario de src/app/eventos/page.tsx, que además midió el
 *    ahorro de peso: 17030 bytes con `*` contra 8003 con la lista
 *    (−53%), por tres, porque el payload RSC serializa las filas tres
 *    veces.
 * 2. En las FICHAS individuales (/[slug], /eventos/[id], /citas/[slug]
 *    y /citas/[slug]/reservar) y en el directorio de /hospedajes.
 *    Verificado contra producción: `curl https://www.bookea.lat/
 *    rancholastorres` devolvía `"sinpeNumero"`, `"sinpeTitular"`,
 *    `"cuentaBanco"`, `"cuentaNumero"` y `"cuentaTitular"` con los
 *    valores reales del dueño. Esas rutas ahora piden las listas de
 *    acá abajo, que NO incluyen ninguna columna de cobro.
 *
 * La regla, entonces: ninguna consulta que termine pintando una página
 * pública puede pedir `*` sobre `ranchos`. Los datos de cobro se piden
 * aparte, con `leerCuentasDeCobro`, y solo cuando quien pregunta tiene
 * una razón legítima (ver el comentario de esa función).
 *
 * Si una tarjeta o una ficha necesita un campo nuevo, hay que sumarlo
 * a la lista que corresponda — y pensar dos veces antes de sumar uno
 * que el visitante no debería poder leer.
 */

/**
 * Las columnas de cobro. Están juntas y con nombre propio para que sea
 * evidente qué es lo que nunca va en una lista pública.
 */
export const COLUMNAS_COBRO =
  "sinpe_numero, sinpe_titular, cuenta_banco, cuenta_numero, cuenta_titular, cuenta_tipo";

/**
 * Lo único que leen las tarjetas del directorio (verificado campo por
 * campo contra rancho-card.tsx, rancho-card-grande.tsx,
 * riel-proveedores.tsx, planificador.tsx y los filtros de
 * directorio.tsx). La usan /eventos y /hospedajes.
 */
export const COLUMNAS_CARD =
  "id, slug, nombre, descripcion, categoria, subcategoria, provincia, canton, " +
  "capacidad_min, capacidad_max, precio_desde, unidad_precio, foto_url, fotos, " +
  "detalles, destacado_orden, created_at, vertical, verificado";

/**
 * Lo que pinta la ficha de un negocio de Eventos (rancho-portal.tsx),
 * sea Lugar o Servicio. `owner_id` SÍ va: se compara contra la sesión
 * del lado del servidor (para mostrarle "Modificar tu página" al dueño
 * y esconderle la burbuja de chat consigo mismo) y nunca se le pasa a
 * un componente cliente — verificado con `grep owner_id` sobre el HTML
 * de producción: cero.
 */
export const COLUMNAS_PORTAL =
  "id, owner_id, slug, nombre, descripcion, descripcion_larga, categoria, " +
  "subcategoria, vertical, estado, provincia, canton, direccion_exacta, " +
  "latitud, longitud, mapa_url, foto_url, foto_presentacion, fotos, amenidades, " +
  "detalles, terminos, monto_minimo, capacidad_min, capacidad_max, precio_desde, " +
  "unidad_precio, deposito_reserva, tarifa_diciembre_por_persona, " +
  "modalidad_precio_lugar, precio_hora_lugar, precio_fijo_lugar, horarios_bloques, " +
  "eventos_por_dia, zona_horaria, destacado_orden, created_at, instagram, " +
  "facebook, tiktok, sitio_web, contacto_whatsapp";

/** Lo que pinta la ficha de un negocio de Citas y su pantalla de reserva. */
export const COLUMNAS_CITAS =
  "id, owner_id, slug, nombre, descripcion, categoria, vertical, estado, " +
  "provincia, canton, direccion_exacta, latitud, longitud, foto_url, fotos, " +
  "amenidades, detalles, zona_horaria, created_at";

/**
 * Las columnas JÓVENES: las que trajo una migración que el dueño pega a
 * mano en el SQL Editor, así que este código puede llegar a producción
 * antes que el esquema. Van aparte porque una lista explícita que
 * nombre una columna inexistente hace fallar la consulta ENTERA — y
 * acá eso sería la ficha del negocio caída, o sea reservas perdidas.
 * `select("*")` nunca fallaba; `pedirFila` recupera esa garantía
 * reintentando sin ellas (mismo patrón que CAMPOS_POLITICA en
 * /citas/[slug]/reservar).
 */
export const COLUMNAS_PORTAL_JOVENES =
  "precio_hora_diciembre, precio_fijo_diciembre, precio_por_persona";
export const COLUMNAS_CITAS_JOVENES = "deposito_citas";

/**
 * EL PAÍS DEL NEGOCIO, y por qué viaja como columna JOVEN y no dentro
 * de `COLUMNAS_CARD`.
 *
 * `ranchos.pais` la trajo la 0062, o sea que en producción ya existe y
 * el grant columna-por-columna de la 0140/0155 —que se calcula leyendo
 * el esquema real— ya la incluye. En el camino feliz esto se pide y
 * llega, sin reintento.
 *
 * Va igual por el camino tolerante por dos razones concretas:
 *
 * 1. Una lista explícita que nombre una columna inexistente NO devuelve
 *    la columna en null: hace fallar la consulta ENTERA. Acá eso sería
 *    el directorio de /eventos, /citas o /restaurantes en blanco. El
 *    precio de equivocarse es asimétrico, y el reintento cuesta una ida
 *    a la base SOLO en el caso en que hoy la página se caería.
 * 2. Las bases de desarrollo y cualquier entorno a medio migrar sí
 *    pueden no tenerla, y el repo ya paga ese seguro para las columnas
 *    de la 0099/0103/0118 unas líneas más arriba.
 *
 * Sin la columna, `pais` llega `undefined` y `codigoPaisDe()` lo lee
 * como Costa Rica — que es exactamente lo que la plataforma hizo desde
 * el día uno.
 */
export const COLUMNAS_PAIS = "pais";

type Respuesta = { data: unknown; error: unknown };

/**
 * Pide la fila con las columnas jóvenes y, si la base todavía no las
 * tiene, la vuelve a pedir sin ellas. Sin columna, el campo llega
 * `undefined` y cada pantalla ya lo trata como null — exactamente lo
 * que pasaba con `select("*")` contra una base sin migrar.
 */
export async function pedirFila(
  consulta: (columnas: string) => PromiseLike<Respuesta>,
  base: string,
  jovenes: string,
): Promise<Record<string, unknown> | null> {
  const conJovenes = await consulta(`${base}, ${jovenes}`);
  if (!conJovenes.error) return conJovenes.data as Record<string, unknown> | null;
  const soloBase = await consulta(base);
  return soloBase.data as Record<string, unknown> | null;
}

/**
 * Lo mismo que `pedirFila`, pero para una LISTA — los directorios.
 *
 * Va aparte y no como un genérico de `pedirFila` porque el tipo de
 * vuelta es lo único que cambia y unificarlos obligaba a castear en los
 * cinco lugares que la llaman. El comportamiento es idéntico: se pide
 * con las columnas jóvenes y, si la base todavía no las tiene, se
 * vuelve a pedir sin ellas.
 *
 * Devuelve `[]` y no `null` cuando algo falla de verdad: un directorio
 * sin filas se ve como "todavía no hay negocios acá", que es un estado
 * que estas pantallas ya saben pintar. Es exactamente lo que pasaba
 * antes con `data ?? []`.
 */
export async function pedirFilas(
  consulta: (columnas: string) => PromiseLike<Respuesta>,
  base: string,
  jovenes: string,
): Promise<Record<string, unknown>[]> {
  const conJovenes = await consulta(`${base}, ${jovenes}`);
  if (!conJovenes.error) return (conJovenes.data ?? []) as Record<string, unknown>[];
  const soloBase = await consulta(base);
  return (soloBase.data ?? []) as Record<string, unknown>[];
}

/**
 * La fila de `ranchos` tal como la ve el público: la misma de siempre
 * MENOS los datos de cobro. Es un `Omit` y no un tipo nuevo a propósito
 * — así el compilador marca en rojo cualquier `rancho.sinpe_numero` que
 * alguien vuelva a escribir en una pantalla pública, en vez de dejarlo
 * pasar y devolver `undefined` en producción.
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

/** Los datos de cobro, ya en el idioma de los componentes. */
export type CuentasCobro = {
  sinpeNumero: string | null;
  sinpeTitular: string | null;
  cuentaBanco: string | null;
  cuentaNumero: string | null;
  cuentaTitular: string | null;
  cuentaTipo: string | null;
};

/** El proveedor no configuró ninguna cuenta — o todavía no hay derecho
 *  a verlas. Las dos cosas se ven igual desde el formulario: esa forma
 *  de pago simplemente no se ofrece. */
export const SIN_CUENTAS: CuentasCobro = {
  sinpeNumero: null,
  sinpeTitular: null,
  cuentaBanco: null,
  cuentaNumero: null,
  cuentaTitular: null,
  cuentaTipo: null,
};

/**
 * Lee los datos de cobro de un negocio.
 *
 * ⚠️ Esto devuelve el número de SINPE y la cuenta bancaria REALES del
 * proveedor. Solo se llama desde donde ya se comprobó que quien
 * pregunta tiene una razón legítima para verlos:
 *
 * - `crearReservaTemporal` (Eventos/Lugares): la persona acaba de
 *   tomar una fecha de ESE negocio y tiene el hold de 10 minutos a su
 *   nombre. Viaja en la respuesta de esa acción, no en el HTML.
 * - `crearCita` (Citas): la cita ya existe y es de quien preguntó.
 * - la ficha de un Servicio de Eventos, con sesión iniciada (ver el
 *   comentario en rancho-portal.tsx).
 *
 * Nunca desde una pantalla que se le sirva a un anónimo.
 *
 * ⚠️ QUÉ CLIENTE PASARLE. Desde la migración 0140 el rol anónimo ya no
 * tiene permiso sobre estas seis columnas, así que un `db` sin sesión
 * devuelve SIN_CUENTAS y la persona se queda sin saber a dónde
 * transferir. Reservar en Eventos y en Citas se puede hacer SIN cuenta
 * (la cuenta se crea en silencio después), o sea que esos dos caminos
 * tienen que pasarle el cliente de servicio:
 *
 *     leerCuentasDeCobro(createAdminClient() ?? supabase, ranchoId)
 *
 * Eso salta la RLS, y por eso el gate no es el rol sino lo que la
 * persona ya hizo: tener el hold de esa fecha, o la cita ya creada.
 *
 * No tira: si la consulta falla, devuelve SIN_CUENTAS. Quien la llama
 * está en medio de una reserva y no puede quedarse sin ella por un
 * tropiezo de red al pedir un dato accesorio.
 */
export async function leerCuentasDeCobro(
  db: LectorDeCuentas,
  ranchoId: string,
): Promise<CuentasCobro> {
  try {
    const { data } = await (db.from("ranchos") as ConsultaDeFila)
      .select(COLUMNAS_COBRO)
      .eq("id", ranchoId)
      .maybeSingle();
    if (!data) return SIN_CUENTAS;
    const fila = data as unknown as Record<string, string | null>;
    return {
      sinpeNumero: fila.sinpe_numero ?? null,
      sinpeTitular: fila.sinpe_titular ?? null,
      cuentaBanco: fila.cuenta_banco ?? null,
      cuentaNumero: fila.cuenta_numero ?? null,
      cuentaTitular: fila.cuenta_titular ?? null,
      cuentaTipo: fila.cuenta_tipo ?? null,
    };
  } catch {
    return SIN_CUENTAS;
  }
}
