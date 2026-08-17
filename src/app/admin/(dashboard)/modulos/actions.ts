"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, usuarioActual } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { esAddon } from "@/lib/addons";
import { esPlan } from "@/lib/lealtad/planes";
import {
  faltaTablaCobros,
  METODOS_COBRO,
  MIGRACION_COBROS,
  MONEDAS_COBRO,
  PERIODOS_COBRO,
  type MetodoCobro,
  type MonedaCobro,
  type PeriodoCobro,
  type ProductoCobro,
} from "@/lib/auditoria-modulos";

/**
 * Anotar y anular los cobros de los módulos.
 *
 * Va con la llave de servicio porque `cobros_modulo` (0172) tiene RLS
 * encendida y CERO políticas: la tabla no existe para el navegador, ni
 * para leer. La única puerta es ésta.
 *
 * Y cada acción llama a `requireAdmin()` por su cuenta a propósito: el
 * layout del panel NO protege las server actions —se invocan por su id
 * desde cualquier ruta— así que confiar en él dejaría el libro de
 * ingresos de la plataforma escribible por cualquiera con sesión.
 */

/** El tope de un cobro suelto. Más que esto es un dedo de más. */
const TOPE_CRC = 50_000_000;
const TOPE_USD = 100_000;

export type EntradaCobro = {
  ranchoId: string | null;
  producto: ProductoCobro;
  /** Id del catálogo si es un paquete. */
  plan: string | null;
  /** Id del complemento si es un add-on. */
  addon: string | null;
  periodo: PeriodoCobro;
  metodo: MetodoCobro;
  monto: number;
  moneda: MonedaCobro;
  tipoCambio: number | null;
  esCortesia: boolean;
  valorListaUsd: number | null;
  /** YYYY-MM-DD del día en que entró la plata. */
  cobradoEn: string;
  solicitudId: string | null;
  notas: string;
};

/**
 * Valida y guarda un cobro.
 *
 * Toda la validación se repite acá aunque el formulario ya la haga: el
 * formulario es una sugerencia, esto es la puerta. Y es plata — un
 * monto con un cero de más no se nota hasta que alguien cuadra el mes.
 */
export async function registrarCobro(datos: EntradaCobro) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  if (datos.producto !== "plan_lealtad" && datos.producto !== "complemento") {
    return { error: "Ese producto no existe." };
  }
  if (datos.producto === "plan_lealtad" && !esPlan(datos.plan)) {
    return { error: "Ese paquete no está en el catálogo." };
  }
  if (datos.producto === "complemento" && !esAddon(datos.addon ?? "")) {
    return { error: "Ese complemento no existe." };
  }
  if (!(PERIODOS_COBRO as readonly string[]).includes(datos.periodo)) {
    return { error: "Ese período no es válido." };
  }
  if (!(METODOS_COBRO as readonly string[]).includes(datos.metodo)) {
    return { error: "Ese medio de pago no es válido." };
  }
  if (!(MONEDAS_COBRO as readonly string[]).includes(datos.moneda)) {
    return { error: "Esa moneda no es válida." };
  }

  // La cortesía es ₡0 SIEMPRE. La base también lo obliga por CHECK;
  // acá se corrige en vez de rechazar, para que un formulario con el
  // monto lleno y la casilla marcada no guarde una venta por error.
  const esCortesia = datos.esCortesia === true;
  const monto = esCortesia ? 0 : Number(datos.monto);
  if (!Number.isFinite(monto) || monto < 0) {
    return { error: "El monto no es un número válido." };
  }
  if (!esCortesia && monto === 0) {
    return {
      error:
        "Un cobro de ₡0 que no es cortesía no se puede guardar: o entró plata, o marcá la casilla de cortesía.",
    };
  }
  const tope = datos.moneda === "CRC" ? TOPE_CRC : TOPE_USD;
  if (monto > tope) {
    return { error: `Ese monto es demasiado alto para ser un cobro real. Revisalo.` };
  }

  const tipoCambio =
    datos.tipoCambio === null || datos.tipoCambio === undefined ? null : Number(datos.tipoCambio);
  if (tipoCambio !== null && (!Number.isFinite(tipoCambio) || tipoCambio <= 0)) {
    return { error: "El tipo de cambio no es válido." };
  }

  const valorLista =
    datos.valorListaUsd === null || datos.valorListaUsd === undefined
      ? null
      : Number(datos.valorListaUsd);
  if (valorLista !== null && (!Number.isFinite(valorLista) || valorLista < 0)) {
    return { error: "El valor de catálogo no es válido." };
  }

  // La fecha llega como YYYY-MM-DD del día tico. Se guarda al mediodía
  // UTC para que ninguna zona la corra un día: a las 00:00 UTC un cobro
  // del 1.º se lee como del 31 en Costa Rica (UTC-6).
  const fecha = fechaDelDia(datos.cobradoEn);
  if (!fecha) return { error: "Esa fecha no es válida." };
  const enElFuturo = fecha.getTime() > Date.now() + 86_400_000;
  if (enElFuturo) return { error: "No se puede anotar un cobro con fecha futura." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  // El nombre del negocio se CONGELA en la fila: si el negocio se da de
  // baja, `rancho_id` queda en null y sin esto el cobro se volvería
  // anónimo en el libro.
  let negocioNombre: string | null = null;
  if (datos.ranchoId) {
    const { data } = await admin
      .from("ranchos")
      .select("nombre")
      .eq("id", datos.ranchoId)
      .maybeSingle();
    if (!data) return { error: "Ese negocio no existe." };
    negocioNombre = (data.nombre as string | null) ?? null;
  }

  const usuario = await usuarioActual();

  const { error } = await admin.from("cobros_modulo").insert({
    rancho_id: datos.ranchoId,
    negocio_nombre: negocioNombre,
    producto: datos.producto,
    plan: datos.producto === "plan_lealtad" ? datos.plan : null,
    addon: datos.producto === "complemento" ? datos.addon : null,
    periodo: datos.periodo,
    metodo: datos.metodo,
    monto,
    moneda: datos.moneda,
    tipo_cambio: tipoCambio,
    es_cortesia: esCortesia,
    valor_lista_usd: valorLista,
    cobrado_en: fecha.toISOString(),
    solicitud_id: datos.solicitudId,
    notas: datos.notas.trim().slice(0, 300) || null,
    registrado_por: usuario?.id ?? null,
  });

  if (error) {
    if (faltaTablaCobros(error)) {
      return { error: `Falta correr la migración ${MIGRACION_COBROS} en Supabase.` };
    }
    // El índice único de la solicitud: ese depósito ya está anotado.
    if (error.message?.includes("cobros_modulo_solicitud_unq")) {
      return {
        error:
          "Ese depósito ya está registrado. Si el monto quedó mal, anulá el cobro anterior y volvé a anotarlo.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/modulos");
  return { error: null };
}

/**
 * Anular un cobro mal anotado. No se borra: un monto equivocado se
 * corrige dejando el rastro de que estuvo mal, con el motivo. Borrarlo
 * esconde el error y deja un hueco que nadie puede explicar después.
 */
export async function anularCobro(id: string, motivo: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const razon = motivo.trim().slice(0, 300);
  if (!razon) return { error: "Decí por qué se anula: sin motivo queda un hueco sin explicar." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const usuario = await usuarioActual();

  const { error } = await admin
    .from("cobros_modulo")
    .update({
      anulado_en: new Date().toISOString(),
      anulado_por: usuario?.id ?? null,
      anulado_motivo: razon,
    })
    .eq("id", id)
    // Anular dos veces pisaría la fecha y el motivo del primero.
    .is("anulado_en", null);

  if (error) return { error: error.message };

  revalidatePath("/admin/modulos");
  return { error: null };
}

/**
 * El día tico a las 12:00 UTC. Ver el comentario de arriba: guardar
 * 00:00 haría que un cobro del 1.º se leyera como del mes anterior.
 */
function fechaDelDia(dia: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const fecha = new Date(`${dia}T12:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) return null;
  if (fecha.getUTCFullYear() < 2020) return null;
  return fecha;
}
