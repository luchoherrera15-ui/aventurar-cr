import { createAdminClient } from "@/lib/supabase/admin";
import { enGrupos } from "./aviso-de-pausa";
import { avisarCambioDeDiseno } from "./aviso-de-diseno";
import { enviarMensajeGoogle } from "./google";

/**
 * LA NOTIFICACIÓN DE MARKETING (0152) — «MIÉRCOLES MATCHAS 2X1» de
 * verdad en el teléfono del cliente, no un dato que hay que ir a buscar.
 *
 * Dos mecanismos DISTINTOS, uno por plataforma, porque Apple y Google
 * resuelven "avisar algo" de formas completamente distintas:
 *
 *   · Apple: el mensaje se guarda como una columna de `programa_lealtad`
 *     y se REGENERA dentro del pase entero (tarjeta.ts) con un campo que
 *     lleva `changeMessage` — eso es lo que dispara el aviso en la
 *     pantalla bloqueada. Reusa PALABRA POR PALABRA el mecanismo de la
 *     0150 (`avisarCambioDeDiseno`): guardar el mensaje ES un cambio de
 *     diseño de la tarjeta, ni más ni menos.
 *
 *   · Google: tiene su propio endpoint (`loyaltyObject.addMessage`,
 *     google.ts) que EMPUJA un mensaje sin regenerar nada — no pasa por
 *     `diseno_pendiente` porque ese mecanismo actualiza el objeto
 *     entero (PATCH), y un mensaje se agrega, no se reescribe.
 *
 * Por tandas y con pausa entre ellas — mismo criterio que
 * aviso-de-pausa.ts y aviso-de-diseno.ts: son llamadas de red, una por
 * cliente, y esto puede correr sobre un programa de miles de miembros
 * disparado por UN click del dueño.
 */

const TAMANO_TANDA = 20;
const PAUSA_ENTRE_TANDAS_MS = 1200;
/** Tope de la corrida inmediata: lo que sobre lo recoge el mismo cron que ya barre la 0150. */
const MAX_POR_CORRIDA_GOOGLE = 300;

export type ResultadoMensajePromocional =
  | {
      ok: true;
      guardado: true;
      googleEnviados: number;
      googleFallidos: number;
      /** null = no había pases de Apple instalados (no es un fallo, no hay nada que reportar). */
      apple: { avisados: number; fallidos: number } | null;
    }
  | { ok: false; motivo: string };

/**
 * Guarda el mensaje y dispara los dos avisos.
 *
 * NUNCA lanza: la llama una server action con alguien mirando la
 * pantalla, así que el resultado de Google sí se informa (a diferencia
 * del camino automático), pero un fallo de red no puede tirar abajo
 * toda la operación — el mensaje ya quedó guardado, que es lo que
 * importa primero.
 */
export async function enviarMensajePromocional(
  programaId: string,
  mensaje: string,
): Promise<ResultadoMensajePromocional> {
  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { error: errorGuardado } = await db
    .from("programa_lealtad")
    .update({ mensaje_promocional: mensaje, mensaje_promocional_en: new Date().toISOString() })
    .eq("id", programaId);
  if (errorGuardado) {
    if (/mensaje_promocional/.test(errorGuardado.message) && /column|schema cache/i.test(errorGuardado.message)) {
      return { ok: false, motivo: "Falta correr la migración 0152 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo guardar el mensaje: " + errorGuardado.message };
  }

  // ── Apple: el mismo camino que un cambio de diseño ─────────────────
  // Marca diseno_pendiente para todos los pases del programa y dispara
  // una corrida inmediata (hasta TAMANO_TANDA*2 pases, ver 0150). Nunca
  // lanza — si algo falla ahí, ya quedó registrado en su propio log —
  // pero el RESUMEN sí se recoge acá para que la UI deje de asumir éxito.
  const resumenApple = await avisarCambioDeDiseno(programaId);

  // ── Google: el mensaje nativo, uno por cliente ─────────────────────
  const { data: miembros } = await db
    .from("miembros")
    .select("id")
    .eq("programa_id", programaId)
    .eq("estado", "activa")
    .limit(MAX_POR_CORRIDA_GOOGLE);
  const idsConGoogle = new Set(
    (
      await db
        .from("pases_wallet")
        .select("miembro_id")
        .eq("plataforma", "google")
        .eq("activo", true)
        .in("miembro_id", (miembros ?? []).map((m) => m.id as string))
    ).data?.map((p) => p.miembro_id as string) ?? [],
  );
  const miembroIds = (miembros ?? []).map((m) => m.id as string).filter((id) => idsConGoogle.has(id));

  let googleEnviados = 0;
  let googleFallidos = 0;
  const tandas = enGrupos(miembroIds, TAMANO_TANDA);
  for (let i = 0; i < tandas.length; i++) {
    const resultados = await Promise.all(
      tandas[i].map((miembroId) => enviarMensajeGoogle(miembroId, mensaje)),
    );
    for (const r of resultados) {
      if (r.ok) googleEnviados++;
      else googleFallidos++;
    }
    if (i < tandas.length - 1) {
      await new Promise((listo) => setTimeout(listo, PAUSA_ENTRE_TANDAS_MS));
    }
  }

  return {
    ok: true,
    guardado: true,
    googleEnviados,
    googleFallidos,
    apple: resumenApple ? { avisados: resumenApple.avisados, fallidos: resumenApple.fallidos } : null,
  };
}
