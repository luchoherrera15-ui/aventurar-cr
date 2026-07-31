"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { CostoCongelado } from "@/components/invitaciones-historial";

/**
 * El gasto real de cada invitación, leído de la bitácora uso_ia.
 *
 * Existe porque la tabla `invitaciones` (0073) guarda costo_usd pero
 * ni colones ni tipo de cambio: convertir en el navegador con el
 * cambio de hoy mostraría un monto que nunca se cobró. uso_ia (0078)
 * sí congela `tipo_cambio` en cada fila y calcula `costo_crc` como
 * columna generada, así que los colones del historial salen de acá —
 * o no salen del todo.
 *
 * Es un servidor aparte del listado (invitaciones-generador-actions)
 * a propósito: el listado sigue funcionando igual aunque esta lectura
 * falle, y en ese caso el historial cae a mostrar solo dólares.
 */

/** Tope de ids por consulta: PostgREST manda todo esto en la URL. */
const MAX_IDS = 200;

/** Fila cruda de uso_ia; los `numeric` de Postgres pueden llegar como texto. */
interface FilaUso {
  referencia_id: string | null;
  costo_usd: number | string | null;
  costo_crc: number | string | null;
}

function aNumero(v: number | string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function costosDeInvitaciones(
  ids: string[],
): Promise<Record<string, CostoCongelado>> {
  const vacio: Record<string, CostoCongelado> = {};
  if (!ids || ids.length === 0) return vacio;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return vacio;

  // uso_ia solo la lee el admin o el dueño del negocio por RLS, y estas
  // filas no tienen rancho: se lee con el service role y se acota a
  // usuario_id, para que nadie pueda pedir el gasto de una invitación
  // ajena mandando ids inventados.
  const db = createAdminClient();
  if (!db) return vacio;

  const { data, error } = await db
    .from("uso_ia")
    .select("referencia_id, costo_usd, costo_crc, created_at")
    .eq("agente", "invitacion_generar")
    .eq("usuario_id", user.id)
    .eq("exito", true)
    .in("referencia_id", ids.slice(0, MAX_IDS))
    .order("created_at", { ascending: false });

  if (error || !data) {
    // Un gasto que no se pudo leer no puede tumbar el historial del
    // cliente: se devuelve vacío y la tabla muestra solo dólares.
    console.error(
      "[invitaciones] No se pudo leer el gasto de uso_ia:",
      error?.message ?? "sin datos",
    );
    return vacio;
  }

  const porInvitacion: Record<string, CostoCongelado> = {};
  // Vienen ordenadas de la más nueva a la más vieja y la primera de
  // cada invitación gana: si se regeneró, la fila del historial (costo
  // y tokens de la tabla `invitaciones`) es la de la última corrida.
  for (const fila of data as FilaUso[]) {
    const id = fila.referencia_id;
    if (!id || porInvitacion[id]) continue;

    const usd = aNumero(fila.costo_usd);
    if (usd === null) continue;

    porInvitacion[id] = { usd, crc: aNumero(fila.costo_crc) };
  }

  return porInvitacion;
}
