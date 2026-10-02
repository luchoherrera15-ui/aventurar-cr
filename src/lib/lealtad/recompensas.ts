import type { SupabaseClient } from "@supabase/supabase-js";
import { esColumnaAusente, type ErrorBase } from "./errores-base";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS RECOMPENSAS DE UNA TARJETA — qué se valida y cómo se escribe
 * ════════════════════════════════════════════════════════════════════
 *
 * Salió de `guardarRecompensa` y `eliminarRecompensa`
 * (src/app/lealtad/panel/[id]/pases-actions.ts) el 1 oct 2026, cuando el
 * panel de Foorkie empezó a editar las regalías de sus locales por la API
 * firmada (`/api/plataforma/foorkie/recompensas/*`). Las dos puertas —la
 * del dueño en Bookea, con su sesión, y la de Foorkie, con la llave de
 * servicio— validan y escriben con ESTAS funciones: dos copias de
 * `validarRecompensa` serían dos criterios que se separan el día que
 * alguien cambia uno.
 *
 * Acá no hay sesión ni permisos. Quien llama ya comprobó que la tarjeta
 * es del negocio (el panel con `verificarAccesoRancho`, Foorkie con el
 * vínculo de `foorkie_restaurantes`) y le pasa la base con la que escribe.
 * Lo que hace la acción del panel no cambió: es el mismo código, movido.
 */

export type TipoRecompensa =
  | "producto"
  | "servicio"
  | "descuento_porcentaje"
  | "descuento_fijo"
  | "personalizada";

export const TIPOS_RECOMPENSA: readonly TipoRecompensa[] = [
  "producto",
  "servicio",
  "descuento_porcentaje",
  "descuento_fijo",
  "personalizada",
];

export type RecompensaInput = {
  nombre: string;
  descripcion: string;
  /** En modo sellos, esto ES la meta: "10 sellos". */
  costoPuntos: number;
  activo: boolean;
  /** Tipo de recompensa (0125). null = personalizada. */
  tipo: TipoRecompensa | null;
  /** % (1..100) o colones, según el tipo. Solo para descuentos. */
  valor: number | null;
  /** null = sin límite. El RPC lo CUENTA contra los canjes: no es un
   *  contador que se descuenta y se desincroniza. */
  stockTotal: number | null;
  limitePorCliente: number | null;
  /** Referencia externa para el POS. */
  sku: string;
  /** Qué debe hacer el personal al entregarla. */
  instrucciones: string;
};

export function validarRecompensa(datos: RecompensaInput): string | null {
  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 120) return "El nombre es obligatorio (máximo 120 caracteres).";
  if (datos.descripcion.trim().length > 300) return "La descripción es muy larga.";
  if (!Number.isInteger(datos.costoPuntos) || datos.costoPuntos < 1) {
    return "La recompensa tiene que costar al menos 1.";
  }
  if (datos.tipo !== null && !TIPOS_RECOMPENSA.includes(datos.tipo)) {
    return "Ese tipo de recompensa no existe.";
  }
  // Mismos rangos que recompensas_detalle_check (0125): un 150% de
  // descuento o un fijo negativo son errores de digitación.
  if (datos.tipo === "descuento_porcentaje") {
    if (datos.valor === null || !(datos.valor > 0 && datos.valor <= 100)) {
      return "El descuento porcentual va de 1 a 100.";
    }
  }
  if (datos.tipo === "descuento_fijo") {
    if (datos.valor === null || !(datos.valor > 0 && datos.valor <= 10000000)) {
      return "El descuento fijo va de ₡1 a ₡10.000.000.";
    }
  }
  if (
    datos.stockTotal !== null &&
    (!Number.isInteger(datos.stockTotal) || datos.stockTotal < 1 || datos.stockTotal > 1000000)
  ) {
    return "El stock debe estar entre 1 y 1.000.000 (vacío = sin límite).";
  }
  if (
    datos.limitePorCliente !== null &&
    (!Number.isInteger(datos.limitePorCliente) ||
      datos.limitePorCliente < 1 ||
      datos.limitePorCliente > 10000)
  ) {
    return "El límite por cliente debe estar entre 1 y 10.000.";
  }
  if (datos.sku.trim().length > 60) return "El SKU es muy largo (máximo 60).";
  if (datos.instrucciones.trim().length > 500) {
    return "Las instrucciones son muy largas (máximo 500).";
  }
  return null;
}

/** La fila de `recompensas`, tal como la escribe el guardado (sin `programa_id`). */
export type FilaRecompensaGuardada = {
  nombre: string;
  descripcion: string | null;
  costo_puntos: number;
  activo: boolean;
  tipo: TipoRecompensa | null;
  valor: number | null;
  stock_total: number | null;
  limite_por_cliente: number | null;
  sku: string | null;
  instrucciones: string | null;
};

export function filaDeRecompensa(datos: RecompensaInput): FilaRecompensaGuardada {
  return {
    nombre: datos.nombre.trim(),
    descripcion: datos.descripcion.trim() || null,
    costo_puntos: datos.costoPuntos,
    activo: datos.activo,
    tipo: datos.tipo,
    valor: datos.tipo?.startsWith("descuento") ? datos.valor : null,
    stock_total: datos.stockTotal,
    limite_por_cliente: datos.limitePorCliente,
    sku: datos.sku.trim() || null,
    instrucciones: datos.instrucciones.trim() || null,
  };
}

/** Las columnas de la 0125: sin ellas se guarda la recompensa básica de la 0060. */
const COLUMNAS_0125 = ["tipo", "stock_total", "limite_por_cliente", "sku", "instrucciones"];

/**
 * Crea (sin `recompensaId`) o edita la recompensa de ESTE programa y
 * devuelve la fila guardada. `datos` ya pasó por `validarRecompensa`.
 *
 * La edición filtra por `programa_id` además del id: un id de otra
 * tarjeta no encuentra fila y `.single()` devuelve error en vez de
 * escribirle a la tarjeta de otro.
 */
export async function escribirRecompensa(
  db: SupabaseClient,
  programaId: string,
  datos: RecompensaInput,
  recompensaId?: string,
): Promise<{ data: Record<string, unknown> | null; error: ErrorBase | null }> {
  const fila = filaDeRecompensa(datos);

  const guardarCon = (f: Record<string, unknown>) =>
    recompensaId
      ? db
          .from("recompensas")
          .update(f)
          .eq("id", recompensaId)
          .eq("programa_id", programaId)
          .select("*")
          .single()
      : db
          .from("recompensas")
          .insert({ programa_id: programaId, ...f })
          .select("*")
          .single();

  let { data, error } = await guardarCon(fila);

  // Base sin la 0125: se reintenta con las columnas de la 0060 nada
  // más, para que la recompensa básica se pueda seguir editando. Por
  // CÓDIGO y no por texto, porque `recompensas_detalle_check` menciona
  // `tipo` y un descuento del 150% se estaba guardando «bien» con el
  // tipo tirado a la basura.
  if (error && esColumnaAusente(error, COLUMNAS_0125)) {
    ({ data, error } = await guardarCon({
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      costo_puntos: fila.costo_puntos,
      activo: fila.activo,
    }));
  }

  return { data: (data ?? null) as Record<string, unknown> | null, error: error ?? null };
}

/** Borra la recompensa de ESTE programa. Un id de otra tarjeta no borra nada. */
export async function borrarRecompensaDe(
  db: SupabaseClient,
  programaId: string,
  recompensaId: string,
): Promise<{ error: ErrorBase | null }> {
  const { error } = await db
    .from("recompensas")
    .delete()
    .eq("id", recompensaId)
    .eq("programa_id", programaId);
  return { error: error ?? null };
}
