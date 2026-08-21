"use server";

import { revalidatePath } from "next/cache";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TOPE_PRODUCTOS,
  leerPrecioColones,
  motivoNombreInvalido,
  normalizarNombreProducto,
  precioValido,
  type ProductoCatalogo,
} from "@/lib/lealtad/productos";
import { catalogoDelNegocio, faltaLaTablaDeProductos } from "@/lib/lealtad/productos-db";

/**
 * EL CATÁLOGO DE PRODUCTOS — quién lo toca y con qué reglas (0198).
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO ES DEL DUEÑO Y NO DEL MOSTRADOR
 * ------------------------------------------------------------------
 * El mismo criterio que las ubicaciones (`ubicaciones-actions.ts`) y
 * que `puedeDisenar` en page.tsx: cuánto vale lo que se vende es
 * CONFIGURACIÓN del negocio, no operación de caja. Un colaborador con
 * permiso de acreditar ELIGE del catálogo cuando cobra; cambiarle el
 * precio a un producto —o crear uno de ₡50.000— es del dueño.
 *
 * La RLS de la 0198 dice lo mismo por `owner_id`, pero acá se vuelve a
 * comprobar porque estas acciones corren con la LLAVE DE SERVICIO, que
 * pasa por encima de la RLS. La verificación propia es la que manda,
 * igual que en todo el módulo.
 *
 * ------------------------------------------------------------------
 * DEGRADA SIN ROMPER
 * ------------------------------------------------------------------
 * La 0198 se aplica aparte. Mientras no esté, cada acción devuelve un
 * aviso neutro y la sección lo pinta — el resto del panel ni se entera,
 * y el mostrador sigue cobrando con el monto a mano igual que siempre.
 */

export type DatosProducto = { nombre: string; precio: string };

/** Lo que se puede cambiar de un producto ya creado. */
export type CambioProducto = {
  nombre?: string;
  /** Tal como se tecleó; lo lee `leerPrecioColones`. */
  precio?: string;
  activo?: boolean;
};

type Resultado<T> = { ok: true; datos: T } | { ok: false; motivo: string };

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const AVISO_SIN_TABLA =
  "El catálogo de productos todavía no está disponible en tu panel — el equipo de Bookea lo " +
  "está habilitando. Mientras tanto podés seguir cobrando escribiendo el monto a mano.";

/** El mismo guard que `ubicaciones-actions.ts`: dueño del negocio o Bookea. */
async function accesoDeNegocio(ranchoId: string) {
  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.user) return { ok: false as const, motivo: "Iniciá sesión de nuevo." };
  if (!acceso.esDueno && !acceso.esAdmin) {
    return { ok: false as const, motivo: "Los precios los maneja el dueño del negocio." };
  }
  return { ok: true as const, motivo: "" };
}

/** La lista completa, o el aviso de que la tabla no está. */
async function listarDe(db: Admin, ranchoId: string): Promise<Resultado<ProductoCatalogo[]>> {
  const catalogo = await catalogoDelNegocio(db, ranchoId);
  if (catalogo === null) return { ok: false, motivo: AVISO_SIN_TABLA };
  return { ok: true, datos: catalogo };
}

/**
 * Traduce lo que rebotó la base a algo que el dueño pueda arreglar.
 * Los dos casos que de verdad pasan: el nombre repetido (índice único)
 * y el tope de 100 (trigger, que ya viene con su frase en español).
 */
function motivoDeBase(error: { code?: string | null; message?: string | null }): string {
  if (faltaLaTablaDeProductos(error)) return AVISO_SIN_TABLA;
  if ((error.code ?? "") === "23505") {
    return "Ya tenés un producto con ese nombre. Usá otro o editá el que ya está.";
  }
  // 23514 = el `raise` del trigger del tope, escrito para el dueño.
  if ((error.code ?? "") === "23514" && error.message) return error.message;
  return "No se pudo guardar: " + (error.message ?? "error desconocido");
}

/** La lista para pintar la sección. */
export async function listarProductos(ranchoId: string): Promise<Resultado<ProductoCatalogo[]>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  return listarDe(db, ranchoId);
}

/**
 * Alta de un producto. El tope de 100 lo remacha el trigger de la
 * 0198; se comprueba también acá para que el mensaje llegue ANTES de
 * que el dueño llene el formulario para nada.
 */
export async function agregarProducto(
  ranchoId: string,
  datos: DatosProducto,
): Promise<Resultado<ProductoCatalogo[]>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const malNombre = motivoNombreInvalido(datos.nombre);
  if (malNombre) return { ok: false, motivo: malNombre };

  const precio = leerPrecioColones(datos.precio);
  if (!precio.ok) return { ok: false, motivo: precio.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const actuales = await listarDe(db, ranchoId);
  if (!actuales.ok) return actuales;

  if (actuales.datos.length >= TOPE_PRODUCTOS) {
    return {
      ok: false,
      motivo: `Tu catálogo llegó a ${TOPE_PRODUCTOS} productos. Desactivá o eliminá alguno para agregar otro.`,
    };
  }

  const { error } = await db.from("lealtad_productos").insert({
    rancho_id: ranchoId,
    nombre: normalizarNombreProducto(datos.nombre),
    precio: precio.precio,
    // Al final de la lista: el producto nuevo no se le mete adelante a
    // los que el negocio ya tenía ordenados.
    orden: actuales.datos.length,
  });
  if (error) return { ok: false, motivo: motivoDeBase(error) };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return listarDe(db, ranchoId);
}

/**
 * Edición: el precio, el nombre o el interruptor de activo.
 *
 * `productoId` llega del navegador, así que antes de escribir se
 * comprueba que sea de ESTE negocio — sin eso, un id ajeno cambiaría el
 * precio del producto de otro local (mismo patrón que
 * `eliminarUbicacion`). El `update` lleva ADEMÁS el filtro por
 * `rancho_id`: dos candados que no dependen el uno del otro.
 */
export async function actualizarProducto(
  ranchoId: string,
  productoId: string,
  cambio: CambioProducto,
): Promise<Resultado<ProductoCatalogo[]>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const parche: Record<string, string | number | boolean> = {};

  if (cambio.nombre !== undefined) {
    const malNombre = motivoNombreInvalido(cambio.nombre);
    if (malNombre) return { ok: false, motivo: malNombre };
    parche.nombre = normalizarNombreProducto(cambio.nombre);
  }
  if (cambio.precio !== undefined) {
    const precio = leerPrecioColones(cambio.precio);
    if (!precio.ok) return { ok: false, motivo: precio.motivo };
    // Cinturón y tirantes: lo que se escribe cumple el CHECK de la base.
    if (!precioValido(precio.precio)) {
      return { ok: false, motivo: "Ese precio no es válido." };
    }
    parche.precio = precio.precio;
  }
  if (cambio.activo !== undefined) parche.activo = cambio.activo;

  if (Object.keys(parche).length === 0) {
    return { ok: false, motivo: "No hay nada que cambiar." };
  }

  const { data: fila, error: errorFila } = await db
    .from("lealtad_productos")
    .select("rancho_id")
    .eq("id", productoId)
    .maybeSingle();
  if (errorFila) return { ok: false, motivo: motivoDeBase(errorFila) };
  if (!fila || fila.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Ese producto no es de este negocio." };
  }

  const { error } = await db
    .from("lealtad_productos")
    .update(parche)
    .eq("id", productoId)
    .eq("rancho_id", ranchoId);
  if (error) return { ok: false, motivo: motivoDeBase(error) };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return listarDe(db, ranchoId);
}

/**
 * Baja de un producto.
 *
 * LAS VENTAS NO SE VAN CON ÉL: `lealtad_transacciones.producto_id` es
 * `on delete set null` (0198), y el nombre del producto quedó guardado
 * como texto en cada venta desde la 0197. O sea que el reporte de
 * «Lo que más venden» sigue diciendo lo mismo después de borrar.
 * Aun así la pantalla ofrece DESACTIVAR primero: sacar del menú sin
 * borrar es casi siempre lo que el dueño quiere.
 */
export async function eliminarProducto(
  ranchoId: string,
  productoId: string,
): Promise<Resultado<ProductoCatalogo[]>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: fila, error: errorFila } = await db
    .from("lealtad_productos")
    .select("rancho_id")
    .eq("id", productoId)
    .maybeSingle();
  if (errorFila) return { ok: false, motivo: motivoDeBase(errorFila) };
  if (!fila || fila.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Ese producto no es de este negocio." };
  }

  const { error } = await db
    .from("lealtad_productos")
    .delete()
    .eq("id", productoId)
    .eq("rancho_id", ranchoId);
  if (error) return { ok: false, motivo: motivoDeBase(error) };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return listarDe(db, ranchoId);
}
