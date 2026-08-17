"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * LA COLA DE ADMISIÓN — puerta 1, del lado de Bookea.
 *
 * `requireAdmin()` en CADA acción, y no solo en el layout: una server
 * action se puede invocar por su id desde cualquier ruta, así que el
 * layout no la protege (lo dice el propio layout del panel admin).
 *
 * ------------------------------------------------------------------
 * QUÉ SE PUEDE ESCRIBIR ACÁ, Y QUÉ NO
 * ------------------------------------------------------------------
 * Solo el estado, el motivo, quién atendió y la verificación de
 * dominio. Lo que el desarrollador DECLARÓ —para qué la usa, qué
 * guarda, qué acuerdo aceptó— no se toca por esta vía, ni siquiera
 * siendo admin: eso ES el registro, y es la prueba documental ante la
 * PRODHAB. El grant por columna de la 0176 lo hace cumplir en la base.
 *
 * ------------------------------------------------------------------
 * APROBAR NO ABRE NINGÚN DATO
 * ------------------------------------------------------------------
 * Un desarrollador aprobado queda con cero llaves. Para que pueda leer
 * algo, el dueño de un negocio tiene que autorizarlo desde SU panel.
 * Bookea aprueba EXISTIR.
 */

type Resultado = { ok: true } | { ok: false; motivo: string };

const FALTA_LLAVE = "Falta configurar SUPABASE_SERVICE_ROLE_KEY.";

async function puerta() {
  const { ok } = await requireAdmin();
  if (!ok) return null;
  const db = createAdminClient();
  return db ?? null;
}

async function actorId(): Promise<string | null> {
  const { supabase } = await requireAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Aprobar. Se revalida el estado `pendiente` JUSTO ANTES de escribir:
 * dos admins con la misma pestaña abierta no aprueban dos veces, y una
 * solicitud ya rechazada no revive por un botón que quedó en pantalla.
 */
export async function aprobarDeveloper(id: string, nota: string): Promise<Resultado> {
  const db = await puerta();
  if (!db) return { ok: false, motivo: FALTA_LLAVE };
  const actor = await actorId();

  const { data: fila } = await db
    .from("desarrolladores")
    .select("id, estado, razon_social")
    .eq("id", id)
    .maybeSingle();
  if (!fila) return { ok: false, motivo: "Esa solicitud no existe." };
  if (fila.estado !== "pendiente") {
    return { ok: false, motivo: `Esa solicitud ya está ${fila.estado}.` };
  }

  const { error } = await db
    .from("desarrolladores")
    .update({ estado: "aprobado", atendido_por: actor, atendido_en: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "pendiente");
  if (error) return { ok: false, motivo: error.message };

  await registrar(db, {
    evento: "developer_aprobado",
    desarrollador_id: id,
    actor_id: actor,
    detalle: { nota: nota.trim().slice(0, 300) },
  });
  revalidatePath("/admin/developers");
  return { ok: true };
}

export async function rechazarDeveloper(id: string, motivo: string): Promise<Resultado> {
  const db = await puerta();
  if (!db) return { ok: false, motivo: FALTA_LLAVE };
  const actor = await actorId();

  const texto = motivo.trim().slice(0, 300);
  if (texto.length < 5) {
    return { ok: false, motivo: "Escribí el motivo: el que pidió tiene derecho a saber por qué." };
  }

  const { error } = await db
    .from("desarrolladores")
    .update({
      estado: "rechazado",
      motivo_rechazo: texto,
      atendido_por: actor,
      atendido_en: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("estado", "pendiente");
  if (error) return { ok: false, motivo: error.message };

  await registrar(db, {
    evento: "developer_rechazado",
    desarrollador_id: id,
    actor_id: actor,
    detalle: { motivo: texto },
  });
  revalidatePath("/admin/developers");
  return { ok: true };
}

/**
 * Marcar el dominio como verificado.
 *
 * Bookea busca `https://<dominio>/.well-known/bookea-developer.txt` con
 * el id de la solicitud adentro. Prueba control real del dominio, no
 * que alguien escribió una URL en un formulario. Obligatorio para quien
 * integra negocios de TERCEROS; opcional para el negocio que conecta su
 * propio sistema.
 */
export async function verificarDominioDeveloper(id: string): Promise<Resultado> {
  const db = await puerta();
  if (!db) return { ok: false, motivo: FALTA_LLAVE };
  const actor = await actorId();

  const { data: fila } = await db
    .from("desarrolladores")
    .select("id, sitio_web")
    .eq("id", id)
    .maybeSingle();
  const sitio = (fila?.sitio_web as string | null) ?? "";
  if (!/^https:\/\/[a-z0-9.-]+(\/.*)?$/i.test(sitio)) {
    return { ok: false, motivo: "Esta solicitud no declaró un sitio https válido." };
  }

  let contenido = "";
  try {
    const url = new URL("/.well-known/bookea-developer.txt", sitio);
    // Solo https, sin redirecciones, y con techo de tiempo: la URL la
    // escribió un tercero y esto lo pide NUESTRO servidor.
    if (url.protocol !== "https:") return { ok: false, motivo: "El sitio tiene que ser https." };
    const respuesta = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(6000),
      headers: { "user-agent": "Bookea/verificacion-developer" },
    });
    if (!respuesta.ok) {
      return { ok: false, motivo: `El archivo respondió ${respuesta.status}.` };
    }
    contenido = (await respuesta.text()).slice(0, 500);
  } catch {
    return {
      ok: false,
      motivo: "No se pudo leer https://<sitio>/.well-known/bookea-developer.txt",
    };
  }

  if (!contenido.includes(id)) {
    return { ok: false, motivo: "El archivo existe pero no trae el id de esta solicitud." };
  }

  const { error } = await db
    .from("desarrolladores")
    .update({ dominio_verificado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, motivo: error.message };

  await registrar(db, {
    evento: "dominio_verificado",
    desarrollador_id: id,
    actor_id: actor,
    detalle: { sitio },
  });
  revalidatePath("/admin/developers");
  return { ok: true };
}

/**
 * EL BOTÓN DE PÁNICO.
 *
 * Todas las llaves de un desarrollador, en TODOS los negocios, en una
 * transacción. Es lo que se aprieta cuando el `.env` del integrador
 * apareció en un repositorio público — y por eso está acá, en Bookea,
 * y no repartido entre trescientos paneles de dueños que no se van a
 * enterar a tiempo.
 */
export async function panicoDeveloper(id: string, motivo: string): Promise<Resultado> {
  const db = await puerta();
  if (!db) return { ok: false, motivo: FALTA_LLAVE };
  const actor = await actorId();

  const texto = motivo.trim().slice(0, 300) || "Pánico de Bookea";
  const { data, error } = await db.rpc("api_lealtad_panico", {
    p_desarrollador_id: id,
    p_motivo: texto,
  });
  if (error) return { ok: false, motivo: error.message };

  await registrar(db, {
    evento: "panico",
    desarrollador_id: id,
    actor_id: actor,
    detalle: { motivo: texto, llaves_apagadas: typeof data === "number" ? data : null },
  });
  revalidatePath("/admin/developers");
  return { ok: true };
}

async function registrar(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  fila: Record<string, unknown>,
): Promise<void> {
  // La bitácora no puede tumbar la operación; y si falta la 0178, el
  // admin igual tiene que poder aprobar y —sobre todo— apretar pánico.
  try {
    await db.from("bitacora_llaves").insert(fila);
  } catch {
    // Muda a propósito.
  }
}
