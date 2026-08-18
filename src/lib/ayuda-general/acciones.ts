"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { ipDePeticion, idDeCuentaDeBookea } from "@/lib/lealtad/personas";
import { hashDeToken, hmacDeIp, clavePorIp } from "@/lib/media/capacidad";
import { generarToken, leerTokenCookie, escribirTokenCookie } from "./token";
import { hiloPorClave, hiloPorTokenHash, hilosParaAdmin, ultimoMensajeDelHilo } from "./hilo";
import { avisarNuevoHiloAyuda, avisarRespuestaBookea } from "./aviso";
import type { HiloAyudaGeneral, MensajeAyudaGeneral } from "./tipos";

/**
 * «HABLÁ CON BOOKEA» — el contrato de servidor completo (0182).
 *
 * ------------------------------------------------------------------
 * LA DECISIÓN DE IDENTIDAD, EN CÓDIGO
 * ------------------------------------------------------------------
 * `idDeCuentaDeBookea` (reusada tal cual de `@/lib/lealtad/personas`,
 * no reimplementada) es la ÚNICA función que decide "¿esta persona
 * tiene una cuenta real?" en todo este archivo — y devuelve `null` para
 * una sesión anónima de Supabase exactamente igual que para "no hay
 * sesión". Es la misma función que ya arregló el bug de alta de
 * lealtad (el chat flotante abre `signInAnonymously()`, y esa fila de
 * `auth.users` NO es una identidad). Acá se aplica la misma regla desde
 * el primer día: en NINGÚN punto de este archivo se llama
 * `signInAnonymously()` ni se trata un usuario con `is_anonymous` como
 * si supiera su propio nombre.
 *
 * Quien NO tiene cuenta real (sin sesión, o con la sesión anónima del
 * chat) pasa por la rama de nombre+contacto obligatorios y un token
 * propio en cookie httpOnly (`token.ts`) — nunca por Supabase Auth.
 *
 * ------------------------------------------------------------------
 * QUIÉN ESCRIBE CON QUÉ CLIENTE
 * ------------------------------------------------------------------
 * Visitante CON cuenta real y Bookea: escriben con SU PROPIA sesión
 * (`supabase`), porque la RLS de la 0182 exige `autor_id = auth.uid()`
 * — insertar con la llave de servicio dejaría esa columna en blanco o
 * forzada a mano, y ahí se pierde quién escribió de verdad.
 *
 * Visitante SIN cuenta: escribe con la llave de servicio
 * (`createAdminClient()`), porque `anon` no tiene ningún grant sobre la
 * tabla (`revoke all ... from anon` en la 0182) — no hay RLS que darle,
 * así que el servidor valida el hash del token A MANO antes de tocar la
 * fila, mismo patrón que `media_reservar_con_capacidad` (0113).
 *
 * Las LECTURAS (armar `HiloAyudaGeneral`) siempre van con la llave de
 * servicio a través de `hilo.ts` — igual que `ayuda-hilo.ts` hace para
 * la ayuda de diseño, incluida su propia bandeja de admin. Este archivo
 * es quien decide QUÉ clave leer (`u:<uid>` o `a:<hash>`) después de
 * verificar quién pregunta; `hilo.ts` no vuelve a verificar nada.
 */

const TOPE_TEXTO = 2000;

/** Máx. 20 mensajes cada 5 minutos POR HILO — cubre tanto al visitante con sesión como al anónimo. */
const LIMITE_HILO = { limite: 20, ventanaSegundos: 300 } as const;

/**
 * Máx. 5 hilos NUEVOS por hora por IP — solo aplica al camino anónimo.
 * Un usuario logueado ya está identificado por su cuenta; limitarlo por
 * IP castigaría a una oficina entera detrás del mismo NAT por un solo
 * cliente que escribe mucho.
 */
const LIMITE_IP_HILO_NUEVO = { limite: 5, ventanaSegundos: 3600 } as const;

/** Para no repetir el aviso en cada request — mismo patrón que `visitas.ts`. */
let yaSeAvisoSinSal = false;

type Db = NonNullable<ReturnType<typeof createAdminClient>>;

type ResultadoHilo =
  | { ok: true; hilo: HiloAyudaGeneral | null }
  | { ok: false; motivo: string };

type ResultadoMensaje =
  | { ok: true; mensaje: MensajeAyudaGeneral | null }
  | { ok: false; motivo: string };

type Resultado = { ok: true } | { ok: false; motivo: string };

export type DatosIniciarHilo = {
  mensaje: string;
  /** Solo hace falta sin sesión real — ver §1 del plan. */
  nombre?: string;
  contacto?: string;
  /** Campo señuelo: invisible para una persona, tentador para un bot. Igual que `contacto-actions.ts`. */
  panal: string;
};

function textoValido(bruto: string): string | null {
  const texto = bruto.trim().slice(0, TOPE_TEXTO);
  return texto.length >= 1 ? texto : null;
}

/** El error de la base, en algo que una persona pueda entender. */
function traducir(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return "Ya tenés una conversación abierta — seguila ahí abajo, te contestamos por ese mismo hilo.";
  }
  if (
    /mensajes_ayuda_general/.test(error.message) &&
    /does not exist|schema cache|Could not find/i.test(error.message)
  ) {
    return "Falta correr la migración 0182 en Supabase.";
  }
  return `No se pudo enviar: ${error.message}`;
}

/**
 * Cuenta un intento contra `media_rate_limit_tomar` (0113), reusada tal
 * cual — la tabla que la respalda ya es genérica pese al nombre. Un
 * fallo del contador no puede abrir la puerta: se cierra (mismo
 * criterio que `src/lib/media/servicio.ts`).
 */
async function tomarLimite(
  db: Db,
  clave: string,
  { limite, ventanaSegundos }: { limite: number; ventanaSegundos: number },
): Promise<boolean> {
  const { data, error } = await db.rpc("media_rate_limit_tomar", {
    p_clave: clave,
    p_limite: limite,
    p_ventana_segundos: ventanaSegundos,
  });
  if (error) {
    console.error("[ayuda-general] rate limit falló, se cierra la puerta:", error.message);
    return false;
  }
  const fila = Array.isArray(data) ? data[0] : data;
  return (fila as { permitido?: boolean } | null)?.permitido === true;
}

/**
 * El hilo del visitante ACTUAL, sea quien sea. `null` = mostrar el
 * formulario. La llaman tanto `page.tsx` (Server Component) como el
 * polling del cliente sin sesión (mismo server action, doble uso).
 */
export async function obtenerHiloVisitante(): Promise<HiloAyudaGeneral | null> {
  const db = createAdminClient();
  if (!db) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const miId = idDeCuentaDeBookea(user);

  if (miId) return hiloPorClave(db, `u:${miId}`);

  const token = await leerTokenCookie();
  if (!token) return null;
  return hiloPorTokenHash(db, hashDeToken(token));
}

/** Abre (o encuentra) el hilo del visitante y manda su primer mensaje. */
export async function iniciarHilo(datos: DatosIniciarHilo): Promise<ResultadoHilo> {
  // Bot: se contesta éxito sin escribir nada, igual que `contacto-actions.ts`.
  if (datos.panal.trim() !== "") return { ok: true, hilo: null };

  const texto = textoValido(datos.mensaje);
  if (!texto) return { ok: false, motivo: "Escribí tu consulta (unas palabras alcanzan)." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_SERVICE_KEY };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const miId = idDeCuentaDeBookea(user);

  // ---------- Con cuenta real: nombre y contacto salen de perfiles ----------
  if (miId) {
    const clave = `u:${miId}`;

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, email")
      .eq("id", miId)
      .maybeSingle();

    const correo = (((perfil?.email as string | null) ?? user?.email) ?? "").trim();
    if (!correo) {
      return { ok: false, motivo: "Tu cuenta no tiene un correo — escribinos por WhatsApp." };
    }
    const nombre = ((perfil?.nombre as string | null) ?? "").trim() || correo;

    const { error } = await supabase.from("mensajes_ayuda_general").insert({
      hilo_id: null,
      visitante_clave: clave,
      autor_id: miId,
      de_bookea: false,
      texto,
      nombre,
      contacto: correo,
      estado: "abierta",
    });
    if (error) return { ok: false, motivo: traducir(error) };

    const hilo = await hiloPorClave(db, clave);
    if (hilo) after(() => avisarNuevoHiloAyuda(hilo));
    return { ok: true, hilo };
  }

  // ---------- Sin cuenta real: nombre y contacto son obligatorios ----------
  const nombre = (datos.nombre ?? "").trim().slice(0, 100);
  const contacto = (datos.contacto ?? "").trim().slice(0, 150);
  if (nombre.length < 2) return { ok: false, motivo: "Contanos tu nombre." };
  if (contacto.length < 5) {
    return { ok: false, motivo: "Dejanos un correo o un WhatsApp para poder contestarte." };
  }

  // Rate limit por IP: solo el vector caro (cada hilo nuevo dispara un
  // correo a todos los admins). Sin sal configurada, `hmacDeIp` da null
  // y este límite simplemente no aplica — el de por-hilo sigue en pie,
  // pero se avisa en los logs (una sola vez) para que la falta de sal
  // no quede invisible, mismo criterio que `visitas.ts`.
  const cabeceras = await headers();
  const ipHmac = hmacDeIp(ipDePeticion(cabeceras));
  if (ipHmac) {
    const permitido = await tomarLimite(
      db,
      clavePorIp(ipHmac, "ayuda-nuevo-hilo"),
      LIMITE_IP_HILO_NUEVO,
    );
    if (!permitido) {
      return { ok: false, motivo: "Ya escribiste varias veces — dale un rato y probá de nuevo." };
    }
  } else if (!yaSeAvisoSinSal) {
    yaSeAvisoSinSal = true;
    console.warn(
      "[ayuda-general] Falta MEDIA_IP_SALT/VISITAS_SALT: el tope de 5 hilos/hora por IP está apagado.",
    );
  }

  const token = generarToken();
  const hash = hashDeToken(token);

  const { error } = await db.from("mensajes_ayuda_general").insert({
    hilo_id: null,
    visitante_clave: `a:${hash}`,
    autor_id: null,
    de_bookea: false,
    texto,
    nombre,
    contacto,
    token_hash: hash,
    estado: "abierta",
  });
  if (error) return { ok: false, motivo: traducir(error) };

  // La cookie se pone DESPUÉS de que el insert salió bien: si algo
  // falla arriba, no queda una cookie apuntando a un hilo que no existe.
  await escribirTokenCookie(token);

  const hilo = await hiloPorClave(db, `a:${hash}`);
  if (hilo) after(() => avisarNuevoHiloAyuda(hilo));
  return { ok: true, hilo };
}

/** La clave de quien abrió el hilo, o `null` si ese hilo no existe. */
async function claveDelHilo(db: Db, hiloId: string): Promise<string | null> {
  const { data } = await db
    .from("mensajes_ayuda_general")
    .select("visitante_clave")
    .eq("id", hiloId)
    .is("hilo_id", null)
    .maybeSingle();
  return (data as { visitante_clave: string } | null)?.visitante_clave ?? null;
}

/** Un mensaje más en un hilo YA abierto — del lado del visitante. */
export async function mandarMensaje(hiloId: string, bruto: string): Promise<ResultadoMensaje> {
  const texto = textoValido(bruto);
  if (!texto) return { ok: false, motivo: "Escribí un mensaje." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_SERVICE_KEY };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const miId = idDeCuentaDeBookea(user);

  // La propiedad del hilo se verifica ANTES de tocar el rate limit: si
  // el hilo no es de quien pregunta, no hay ninguna razón para gastarle
  // el cupo de 20 mensajes/5min a otra persona antes de que la base
  // rechace el insert — sin este orden, cualquiera que conozca un uuid
  // ajeno podía "quemar" el cupo de esa conversación con basura. Mismo
  // criterio de "el token tiene que cubrir ESTE hilo" que ya tenía la
  // rama sin cuenta, ahora aplicado también a la rama con cuenta (antes
  // dependía solo de que la RLS del insert rechazara después).
  const claveReal = await claveDelHilo(db, hiloId);
  if (!claveReal) return { ok: false, motivo: "Esa conversación ya no existe." };

  if (miId) {
    if (claveReal !== `u:${miId}`) return { ok: false, motivo: "Esa conversación no es tuya." };
  } else {
    const token = await leerTokenCookie();
    if (!token) {
      return { ok: false, motivo: "Perdimos tu conversación — escribí de nuevo tu consulta desde arriba." };
    }
    if (claveReal !== `a:${hashDeToken(token)}`) {
      return { ok: false, motivo: "Esa conversación no es tuya." };
    }
  }

  const permitido = await tomarLimite(db, `ayuda:hilo:${hiloId}`, LIMITE_HILO);
  if (!permitido) {
    return { ok: false, motivo: "Vas muy rápido — esperá un momento y volvé a intentar." };
  }

  if (miId) {
    const { error } = await supabase.from("mensajes_ayuda_general").insert({
      hilo_id: hiloId,
      visitante_clave: claveReal,
      autor_id: miId,
      de_bookea: false,
      texto,
    });
    if (error) return { ok: false, motivo: traducir(error) };
    return { ok: true, mensaje: await ultimoMensajeDelHilo(db, hiloId) };
  }

  const { error } = await db.from("mensajes_ayuda_general").insert({
    hilo_id: hiloId,
    visitante_clave: claveReal,
    autor_id: null,
    de_bookea: false,
    texto,
  });
  if (error) return { ok: false, motivo: traducir(error) };
  return { ok: true, mensaje: await ultimoMensajeDelHilo(db, hiloId) };
}

// ------------------------------------------------------------
// El lado de Bookea
// ------------------------------------------------------------

/** Todos los hilos, para la bandeja de `/admin/ayuda`. */
export async function listarHilosAdmin(): Promise<HiloAyudaGeneral[]> {
  const { ok } = await requireAdmin();
  if (!ok) return [];

  const db = createAdminClient();
  if (!db) return [];
  return hilosParaAdmin(db);
}

/** Bookea le contesta a un hilo — con la sesión del admin, para que quede firmado quién contestó. */
export async function responderComoBookea(hiloId: string, bruto: string): Promise<ResultadoHilo> {
  const { ok, supabase } = await requireAdmin();
  if (!ok) return { ok: false, motivo: "No tenés permiso para esto." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión de nuevo." };

  const texto = textoValido(bruto);
  if (!texto) return { ok: false, motivo: "Escribí la respuesta." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_SERVICE_KEY };

  const { data: cabeza } = await db
    .from("mensajes_ayuda_general")
    .select("visitante_clave")
    .eq("id", hiloId)
    .is("hilo_id", null)
    .maybeSingle();
  if (!cabeza) return { ok: false, motivo: "Esa conversación ya no existe." };

  const clave = (cabeza as { visitante_clave: string }).visitante_clave;

  const { error } = await supabase.from("mensajes_ayuda_general").insert({
    hilo_id: hiloId,
    visitante_clave: clave,
    autor_id: user.id,
    de_bookea: true,
    texto,
  });
  if (error) return { ok: false, motivo: traducir(error) };

  const hilo = await hiloPorClave(db, clave);
  if (hilo) {
    const ultimo = hilo.mensajes[hilo.mensajes.length - 1];
    if (ultimo) after(() => avisarRespuestaBookea(hilo, ultimo));
  }

  revalidatePath("/admin/ayuda");
  return { ok: true, hilo };
}

async function cambiarEstadoCabeza(hiloId: string, estado: "abierta" | "cerrada"): Promise<Resultado> {
  const { ok, supabase } = await requireAdmin();
  if (!ok) return { ok: false, motivo: "No tenés permiso para esto." };

  const { error } = await supabase
    .from("mensajes_ayuda_general")
    .update({ estado })
    .eq("id", hiloId)
    .is("hilo_id", null);
  if (error) return { ok: false, motivo: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/admin/ayuda");
  return { ok: true };
}

export async function cerrarHilo(hiloId: string): Promise<Resultado> {
  return cambiarEstadoCabeza(hiloId, "cerrada");
}

export async function reabrirHilo(hiloId: string): Promise<Resultado> {
  return cambiarEstadoCabeza(hiloId, "abierta");
}
