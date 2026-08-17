"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACUERDO_VERSION, esScopeValido } from "@/lib/lealtad/api/acuerdo";
import { generarLlave, hashDeSecreto, pepperDeLlaves } from "@/lib/lealtad/api/llaves";

/**
 * LA PUERTA 2, DESDE LA SESIÓN DEL DUEÑO.
 *
 * Acá se decide lo único que de verdad abre datos: que un desarrollador
 * ya admitido entre a UNA tarjeta de ESTE negocio, con permisos
 * explícitos, y se lleve una llave que se muestra una sola vez.
 *
 * ------------------------------------------------------------------
 * POR QUÉ TODO PASA POR RPCs Y NO POR UN INSERT DESDE EL NAVEGADOR
 * ------------------------------------------------------------------
 * La fila de autorización lleva el `pepper_ref` y la de la llave lleva
 * el `secreto_hash`. Un insert desde el cliente significaría un
 * navegador que conoce el pepper, y una tabla de llaves legible desde
 * un navegador significaría que un `select("*")` distraído publica el
 * hash — este repo ya filtró SINPE y cuenta bancaria dos veces por
 * exactamente eso (src/lib/ranchos-publicos.ts:36-52).
 *
 * Así que: llave de servicio + `gestiona_rancho_como` DENTRO del RPC.
 * Esa función existe justamente para actuar en nombre de alguien y ya
 * está revocada de `authenticated` (0116:121). El permiso se comprueba
 * dos veces —acá con la sesión, y otra vez en la base— porque una
 * server action se puede invocar por su id desde cualquier ruta.
 *
 * ------------------------------------------------------------------
 * EL SECRETO SE DEVUELVE UNA SOLA VEZ Y NO SE GUARDA
 * ------------------------------------------------------------------
 * Sale de acá, se pinta en pantalla, y se termina. No pasa por el
 * panel de Bookea, ni por un correo, ni por un ticket. Si se pierde,
 * se rota — que es más barato que tener un secreto viajando.
 */

type Resultado<T = undefined> = { ok: true; datos: T } | { ok: false; motivo: string };

const FALTA_LLAVE = "Falta configurar la llave de servicio en el servidor.";
const SIN_PEPPER =
  "Falta configurar LEALTAD_API_PEPPER en el servidor: sin eso la API no puede emitir llaves.";

/** El dueño (o Bookea). Nunca un colaborador, ni con permiso de auditoría. */
async function comoDueno(ranchoId: string) {
  const acceso = await verificarAccesoRancho(ranchoId);
  if (!acceso.ok || !acceso.user) return null;
  return acceso.user.id;
}

async function nota(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  fila: Record<string, unknown>,
): Promise<void> {
  // La bitácora no puede tumbar la operación: si falla, la operación ya
  // pasó y el rastro se pierde, pero el negocio no se queda sin poder
  // revocar. (Y la fila igual se nota, porque no cuadra con la tabla.)
  try {
    await db.from("bitacora_llaves").insert(fila);
  } catch {
    // Muda a propósito.
  }
}

export type LlaveNueva = { completa: string; kid: string; sufijo: string; expiraEn: string };

/**
 * Autorizar a un developer en una tarjeta, y emitir su primera llave.
 *
 * La precondición dura (`max_diario_cliente` configurado si se pide
 * `acreditar`) la verifica el RPC, no esta función: una validación que
 * vive solo en TypeScript es una validación que la próxima pantalla se
 * olvida de hacer.
 */
export async function autorizarDeveloper(datos: {
  ranchoId: string;
  programaId: string;
  desarrolladorId: string;
  scopes: string[];
  mostrarIniciales: boolean;
  etiqueta: string;
}): Promise<Resultado<LlaveNueva>> {
  const actor = await comoDueno(datos.ranchoId);
  if (!actor) return { ok: false, motivo: "Solo el dueño del negocio puede autorizar a alguien." };

  const pepper = pepperDeLlaves();
  if (!pepper) return { ok: false, motivo: SIN_PEPPER };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_LLAVE };

  const scopes = [...new Set(datos.scopes.filter(esScopeValido))];
  if (scopes.length === 0) return { ok: false, motivo: "Elegí al menos un permiso." };

  const { data: autorizacionId, error } = await db.rpc("api_lealtad_autorizar", {
    p_actor: actor,
    p_desarrollador_id: datos.desarrolladorId,
    p_rancho_id: datos.ranchoId,
    p_programa_id: datos.programaId,
    p_scopes: scopes,
    // El pepper lo genera Node, no Postgres: `gen_random_bytes` es de
    // pgcrypto y no está garantizado en el search_path del proyecto.
    p_pepper: `\\x${randomBytes(32).toString("hex")}`,
    p_entorno: "live",
    p_contrato_version: ACUERDO_VERSION,
    p_mostrar_iniciales: datos.mostrarIniciales,
  });

  if (error || typeof autorizacionId !== "string") {
    return { ok: false, motivo: traducir(error?.message ?? "No se pudo autorizar.") };
  }

  await nota(db, {
    evento: "autorizacion_creada",
    desarrollador_id: datos.desarrolladorId,
    autorizacion_id: autorizacionId,
    rancho_id: datos.ranchoId,
    actor_id: actor,
    detalle: { scopes, mostrar_iniciales: datos.mostrarIniciales },
  });

  const llave = await emitir(db, {
    actor,
    autorizacionId,
    ranchoId: datos.ranchoId,
    etiqueta: datos.etiqueta,
    pepper,
    evento: "llave_emitida",
  });

  revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
  return llave;
}

/** Rotar: nace una llave nueva; la vieja se revoca a mano después. */
export async function emitirLlaveApi(datos: {
  ranchoId: string;
  autorizacionId: string;
  etiqueta: string;
}): Promise<Resultado<LlaveNueva>> {
  const actor = await comoDueno(datos.ranchoId);
  if (!actor) return { ok: false, motivo: "Solo el dueño del negocio puede emitir llaves." };

  const pepper = pepperDeLlaves();
  if (!pepper) return { ok: false, motivo: SIN_PEPPER };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_LLAVE };

  const resultado = await emitir(db, {
    actor,
    autorizacionId: datos.autorizacionId,
    ranchoId: datos.ranchoId,
    etiqueta: datos.etiqueta,
    pepper,
    evento: "llave_rotada",
  });
  revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
  return resultado;
}

async function emitir(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  datos: {
    actor: string;
    autorizacionId: string;
    ranchoId: string;
    etiqueta: string;
    pepper: string;
    evento: string;
  },
): Promise<Resultado<LlaveNueva>> {
  const llave = generarLlave("live");

  const { data, error } = await db.rpc("api_lealtad_emitir_llave", {
    p_actor: datos.actor,
    p_autorizacion_id: datos.autorizacionId,
    p_kid: llave.kid,
    // A la base va el HMAC, nunca el secreto.
    p_secreto_hash: hashDeSecreto(llave.secreto, datos.pepper),
    p_sufijo: llave.sufijoVisible,
    p_etiqueta: datos.etiqueta.trim().slice(0, 60),
    p_meses: 12,
  });

  const fila = (Array.isArray(data) ? data[0] : data) as
    | { id: string; expira_en: string }
    | undefined;
  if (error || !fila) {
    return { ok: false, motivo: traducir(error?.message ?? "No se pudo emitir la llave.") };
  }

  await nota(db, {
    evento: datos.evento,
    autorizacion_id: datos.autorizacionId,
    llave_id: fila.id,
    rancho_id: datos.ranchoId,
    actor_id: datos.actor,
    // El kid NO es secreto; el secreto no aparece en ninguna bitácora.
    detalle: { kid: llave.kid, etiqueta: datos.etiqueta.trim().slice(0, 60) },
  });

  return {
    ok: true,
    datos: {
      completa: llave.completa,
      kid: llave.kid,
      sufijo: llave.sufijoVisible,
      expiraEn: fila.expira_en,
    },
  };
}

export async function revocarLlaveApi(datos: {
  ranchoId: string;
  llaveId: string;
  motivo: string;
}): Promise<Resultado> {
  const actor = await comoDueno(datos.ranchoId);
  if (!actor) return { ok: false, motivo: "Solo el dueño del negocio puede revocar." };
  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_LLAVE };

  const { error } = await db.rpc("api_lealtad_revocar_llave", {
    p_actor: actor,
    p_llave_id: datos.llaveId,
    p_motivo: datos.motivo.trim().slice(0, 300) || "Revocada por el negocio",
  });
  if (error) return { ok: false, motivo: traducir(error.message) };

  await nota(db, {
    evento: "llave_revocada",
    llave_id: datos.llaveId,
    rancho_id: datos.ranchoId,
    actor_id: actor,
    detalle: { motivo: datos.motivo.trim().slice(0, 300) },
  });
  revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
  return { ok: true, datos: undefined };
}

export async function revocarAutorizacionApi(datos: {
  ranchoId: string;
  autorizacionId: string;
  motivo: string;
}): Promise<Resultado> {
  const actor = await comoDueno(datos.ranchoId);
  if (!actor) return { ok: false, motivo: "Solo el dueño del negocio puede revocar." };
  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_LLAVE };

  const { error } = await db.rpc("api_lealtad_revocar_autorizacion", {
    p_actor: actor,
    p_autorizacion_id: datos.autorizacionId,
    p_motivo: datos.motivo.trim().slice(0, 300) || "Desconectado por el negocio",
  });
  if (error) return { ok: false, motivo: traducir(error.message) };

  await nota(db, {
    evento: "autorizacion_revocada",
    autorizacion_id: datos.autorizacionId,
    rancho_id: datos.ranchoId,
    actor_id: actor,
    detalle: { motivo: datos.motivo.trim().slice(0, 300) },
  });
  revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
  return { ok: true, datos: undefined };
}

/**
 * «Romper la correlación»: pepper nuevo, refs viejos a la basura.
 *
 * Es el botón del día después. Deja permanentemente inservible todo lo
 * que un atacante se haya llevado de la base del integrador, sin tocar
 * un solo dato del cliente. El costo es que el integrador tiene que
 * volver a consultar cada tarjeta una vez.
 */
export async function romperCorrelacionApi(datos: {
  ranchoId: string;
  autorizacionId: string;
}): Promise<Resultado> {
  const actor = await comoDueno(datos.ranchoId);
  if (!actor) return { ok: false, motivo: "Solo el dueño del negocio puede hacer esto." };
  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_LLAVE };

  const { error } = await db.rpc("api_lealtad_romper_correlacion", {
    p_actor: actor,
    p_autorizacion_id: datos.autorizacionId,
    p_pepper: `\\x${randomBytes(32).toString("hex")}`,
  });
  if (error) return { ok: false, motivo: traducir(error.message) };

  await nota(db, {
    evento: "correlacion_rota",
    autorizacion_id: datos.autorizacionId,
    rancho_id: datos.ranchoId,
    actor_id: actor,
    detalle: {},
  });
  revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
  return { ok: true, datos: undefined };
}

/** Los errores de la base, en algo que el dueño pueda leer. */
function traducir(mensaje: string): string {
  if (/tope diario/i.test(mensaje)) {
    return "Antes de dejar que alguien acredite por API, configurá el tope diario por cliente en las reglas de tu tarjeta. Sin ese tope, una llave filtrada imprime premios.";
  }
  if (/dos llaves vivas/i.test(mensaje)) {
    return "Esta conexión ya tiene dos llaves vivas: revocá una antes de emitir otra.";
  }
  if (/no está aprobado/i.test(mensaje)) {
    return "Ese desarrollador ya no está aprobado por Bookea.";
  }
  if (/No administrás/i.test(mensaje)) return "No administrás ese negocio.";
  if (/api_lealtad_|does not exist|schema cache|Could not find/i.test(mensaje)) {
    return "Faltan correr las migraciones 0176-0178 en Supabase.";
  }
  if (/duplicate key|autorizaciones_api_activa_unq/i.test(mensaje)) {
    return "Ese desarrollador ya está conectado a este negocio.";
  }
  return mensaje;
}
