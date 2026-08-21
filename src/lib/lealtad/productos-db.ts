import type { createAdminClient } from "@/lib/supabase/admin";
import type { ProductoCatalogo, ProductoDeVenta } from "./productos";

/**
 * LAS CONSULTAS DEL CATÁLOGO (0198).
 *
 * La parte pura —topes, lectura del precio, el ranking de ventas— vive
 * en `productos.ts`; acá está solo el ir a buscarlo, como en
 * `identidades-db.ts`. Se separan porque lo que hay que poder probar
 * sin base son las REGLAS, no el `select`.
 *
 * ------------------------------------------------------------------
 * DEGRADA EN SILENCIO, SIEMPRE
 * ------------------------------------------------------------------
 * La 0198 la aplica el equipo de Bookea cuando puede, y el mostrador
 * atiende gente HOY. Mientras la tabla no exista, estas funciones
 * devuelven «no hay catálogo» (lista vacía o null) y el panel entero
 * sigue funcionando exactamente como antes: monto a mano, producto a
 * mano. Un catálogo ausente NO puede dejar a un cliente sin su sello.
 *
 * Corre con la LLAVE DE SERVICIO: la RLS de la 0198 es del dueño
 * (`owner_id`), y a la caja la atiende también un colaborador. Quién
 * puede ver o tocar qué lo comprueba el llamador ANTES —igual que en
 * el resto del módulo— y por eso ninguna de estas funciones autoriza
 * nada por su cuenta.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** ¿El error es «la tabla lealtad_productos no existe todavía»? */
export function faltaLaTablaDeProductos(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const codigo = (error.code ?? "").trim();
  // 42P01 = undefined_table; PGRST205 = PostgREST no la tiene en el
  // schema cache (la migración corrió hace un instante, o no corrió).
  if (codigo === "42P01" || codigo === "PGRST205") return true;
  const mensaje = error.message ?? "";
  if (!/lealtad_productos/.test(mensaje)) return false;
  return (
    mensaje.includes("does not exist") ||
    mensaje.includes("schema cache") ||
    mensaje.includes("Could not find")
  );
}

/**
 * ¿El error es «lealtad_transacciones todavía no tiene producto_id»?
 *
 * Pasa en la ventana entre la 0197 y la 0198: la tabla de ventas está,
 * la columna no. Sin esta comprobación, mandar `producto_id` en el
 * insert haría que la venta ENTERA no se registre — o sea que estrenar
 * el catálogo apagaría las métricas que el catálogo viene a mejorar.
 */
export function faltaLaColumnaProductoId(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  // PGRST204 = PostgREST no encuentra la columna en el schema cache;
  // 42703 = undefined_column del lado de Postgres.
  const codigo = (error.code ?? "").trim();
  if (codigo === "PGRST204" || codigo === "42703") return true;
  const mensaje = error.message ?? "";
  return /producto_id/.test(mensaje) && /column|columna|schema cache|Could not find/i.test(mensaje);
}

const COLUMNAS = "id, nombre, precio, activo, orden";

function aCatalogo(fila: Record<string, unknown>): ProductoCatalogo {
  return {
    id: String(fila.id),
    nombre: typeof fila.nombre === "string" ? fila.nombre : "",
    precio: Number(fila.precio),
    activo: fila.activo !== false,
    orden: Number(fila.orden ?? 0),
  };
}

/**
 * El catálogo COMPLETO de un negocio, para la pantalla del dueño.
 *
 * `null` = la tabla no existe todavía. Es distinto de `[]` (el negocio
 * no cargó nada) a propósito: la sección dice una cosa u otra, y
 * confundirlas sería prometerle al dueño que guardó algo que no guardó.
 */
export async function catalogoDelNegocio(
  db: Admin,
  ranchoId: string,
): Promise<ProductoCatalogo[] | null> {
  const { data, error } = await db
    .from("lealtad_productos")
    .select(COLUMNAS)
    .eq("rancho_id", ranchoId)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    if (!faltaLaTablaDeProductos(error)) {
      console.warn("[lealtad] No se pudo leer el catálogo:", error.message);
    }
    return null;
  }
  return ((data ?? []) as Record<string, unknown>[]).map(aCatalogo);
}

/**
 * Los productos que se pueden VENDER hoy, para el desplegable de la
 * caja. Lista vacía = no hay catálogo (o está todo apagado), y el
 * mostrador se comporta igual que antes de la 0198.
 */
export async function productosParaVender(
  db: Admin,
  ranchoId: string,
): Promise<ProductoDeVenta[]> {
  const { data, error } = await db
    .from("lealtad_productos")
    .select("id, nombre, precio")
    .eq("rancho_id", ranchoId)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    if (!faltaLaTablaDeProductos(error)) {
      console.warn("[lealtad] No se pudo leer el catálogo de venta:", error.message);
    }
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    id: String(f.id),
    nombre: typeof f.nombre === "string" ? f.nombre : "",
    precio: Number(f.precio),
  }));
}

/**
 * EL PRODUCTO QUE MANDÓ EL NAVEGADOR, comprobado contra ESTE negocio.
 *
 * El id llega de fuera, así que sin esta comprobación una venta podría
 * quedar enlazada al producto de otro local — y el reporte de ventas de
 * ese otro local se llenaría de plata que no hizo. Mismo criterio que
 * `eliminarUbicacion` y que el filtro de tenencia del miembro.
 *
 * Devuelve null cuando el id no existe, no es de este negocio, o la
 * tabla todavía no está: en los tres casos la venta se registra igual,
 * solo que sin enlace al catálogo.
 */
export async function productoDelNegocio(
  db: Admin,
  ranchoId: string,
  productoId: string,
): Promise<ProductoDeVenta | null> {
  const id = productoId.trim();
  if (!id) return null;

  const { data, error } = await db
    .from("lealtad_productos")
    .select("id, nombre, precio, rancho_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  if ((data.rancho_id as string) !== ranchoId) return null;

  return {
    id: String(data.id),
    nombre: typeof data.nombre === "string" ? data.nombre : "",
    precio: Number(data.precio),
  };
}
