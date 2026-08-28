"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { esAddon } from "@/lib/addons";

/**
 * Encender y apagar los complementos de pago de cada negocio.
 *
 * Todo esto va con la llave de servicio a propósito: `addons_negocio`
 * (0077) NO tiene política de escritura para `authenticated`, así que
 * la RLS niega por defecto y un dueño no puede regalarse un complemento
 * desde el navegador aunque encuentre el endpoint. La única puerta es
 * ésta, y requiere sesión de admin.
 *
 * Mientras no exista la pasarela de pago, este panel ES el cobro: se
 * activa a mano cuando el negocio paga, y la nota guarda por qué.
 */

/** Refresca el panel y las pantallas cuyo contenido depende del gate. */
function refrescar(ranchoId: string) {
  revalidatePath("/admin/complementos");
  // El asistente vive plegado en la página unificada (Configuración),
  // no en la ruta /asistente vieja (hoy solo un redirect stub).
  revalidatePath(`/mi-negocio/${ranchoId}`);
  // Y lealtad ya no vive ahí: su panel propio también cambia con el gate.
  revalidatePath(`/lealtad/panel/${ranchoId}`);
}

export async function activarAddon({
  ranchoId,
  addon,
  meses,
  notas,
  esCortesia,
}: {
  ranchoId: string;
  addon: string;
  /** Meses de vigencia; null = sin vencimiento. */
  meses: number | null;
  notas: string;
  /**
   * true = SE REGALA. No entró plata por esta fila (0173).
   *
   * Es un dato y no una etiqueta: hasta la 0173 la pantalla ofrecía una
   * duración llamada «1 mes (cortesía)» que escribía EXACTAMENTE lo
   * mismo que una venta de un mes. Lo único que distinguía un
   * complemento regalado de uno cobrado era una frase escrita a mano en
   * `notas`, así que una auditoría de ingresos tendría que parsear
   * español — o, más probable, contar el regalo como plata que entró.
   */
  esCortesia: boolean;
  // La forma del resultado es SIEMPRE la misma —`error` y `aviso`, los
  // dos presentes— y no una unión de formas. Una unión obliga a la
  // pantalla a adivinar qué rama le tocó, y el `aviso` («quedó activado
  // pero sin la marca de regalía») es justo el que no se puede perder
  // por un problema de tipos.
}): Promise<{ error: string | null; aviso: string | null }> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto.", aviso: null };

  if (!esAddon(addon)) return { error: "Ese complemento no existe.", aviso: null };

  // Lealtad se separó por completo del resto del sitio (14 ago 2026):
  // un negocio de Citas/Eventos/Restaurantes ya no puede activar pases
  // desde acá — eso mezclaba un negocio real del directorio con el
  // servicio de lealtad, que ahora nace SIEMPRE aislado (sin agenda,
  // catálogo ni finanzas) desde /lealtad/planes. `desactivarAddon` de
  // abajo SÍ sigue permitido: sirve para deshacer los casos mezclados
  // que ya existían antes de este cambio.
  if (addon === "lealtad") {
    return {
      error:
        "Lealtad ya no se activa acá. Cada negocio de lealtad nace por su cuenta desde /lealtad/planes — nunca sobre un negocio que ya está en el directorio.",
      aviso: null,
    };
  }

  if (meses !== null && (!Number.isFinite(meses) || meses < 1 || meses > 60)) {
    return { error: "Esa duración no es válida.", aviso: null };
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY, aviso: null };

  // La fecha se calcula acá y no en la base para que el panel muestre
  // exactamente lo que se guardó, sin depender de la zona del servidor.
  let venceEn: string | null = null;
  if (meses !== null) {
    const fin = new Date();
    fin.setMonth(fin.getMonth() + meses);
    venceEn = fin.toISOString();
  }

  const nota = notas.trim().slice(0, 300) || null;

  // Una REGALÍA sin motivo no se guarda. Es la misma regla que la de los
  // paquetes: dentro de tres meses, un complemento regalado sin una
  // línea que diga por qué es indistinguible de un error, y nadie se va
  // a animar a quitarlo.
  if (esCortesia && !nota) {
    return {
      error:
        "Escribí por qué se le regala este complemento. Una regalía sin motivo no se puede auditar después.",
      aviso: null,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const base = {
    rancho_id: ranchoId,
    addon,
    activo: true,
    vence_en: venceEn,
    notas: nota,
    activado_en: new Date().toISOString(),
  };

  // Hay un unique (rancho_id, addon): reactivar pisa la fila anterior
  // en vez de crear una segunda.
  const conflicto = { onConflict: "rancho_id,addon" };

  let aviso: string | null = null;
  let { error } = await admin
    .from("addons_negocio")
    .upsert({ ...base, es_cortesia: esCortesia, otorgado_por: user?.id ?? null }, conflicto);

  // La 0173 la pega el dueño a mano, así que hay una ventana con código
  // nuevo y base vieja. En esa ventana el complemento SE ACTIVA igual
  // —dejar a un negocio sin lo que pagó por una migración pendiente
  // sería el peor final— pero se dice, fuerte, que quedó sin la marca.
  if (error && faltaLaColumnaDeCortesia(error.message)) {
    ({ error } = await admin.from("addons_negocio").upsert(base, conflicto));
    aviso = esCortesia
      ? "Quedó activado, pero NO se pudo marcar como regalía: falta correr 0173_regalias_y_rastro_del_plan.sql. Hasta que se corra, esta fila se ve igual que una venta."
      : "Quedó activado. Falta correr 0173_regalias_y_rastro_del_plan.sql para poder distinguir lo regalado de lo vendido.";
  }

  if (error) {
    if (error.message?.includes("addons_negocio_addon_check")) {
      return {
        error:
          "La base todavía no acepta ese complemento — falta correr la migración que lo agrega.",
        aviso: null,
      };
    }
    return { error: error.message, aviso: null };
  }

  refrescar(ranchoId);
  return { error: null, aviso };
}

/** ¿El error es «esa columna no existe» de la 0173 y no otra cosa? */
function faltaLaColumnaDeCortesia(mensaje: string | undefined): boolean {
  const m = (mensaje ?? "").toLowerCase();
  return m.includes("es_cortesia") || m.includes("otorgado_por");
}

export async function desactivarAddon(ranchoId: string, addon: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };
  if (!esAddon(addon)) return { error: "Ese complemento no existe." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  // Se apaga, no se borra: la fila es el historial de que alguna vez lo
  // tuvo, con su nota y su fecha de activación.
  //
  // Y `es_cortesia` NO se limpia: si eso fue un regalo, lo fue — quitarle
  // la marca al apagarlo haría que una auditoría del pasado viera una
  // venta donde hubo una cortesía. Lo que se apaga es el servicio, no el
  // hecho de que se regaló.
  const { error } = await admin
    .from("addons_negocio")
    .update({ activo: false })
    .eq("rancho_id", ranchoId)
    .eq("addon", addon);

  if (error) return { error: error.message };

  refrescar(ranchoId);
  return { error: null };
}
