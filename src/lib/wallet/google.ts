import { createSign } from "node:crypto";
import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarSaldo } from "@/lib/lealtad/motor";
import { coloresDe, metaDeSellos, type ConfigPase } from "./tarjeta";

/**
 * Pases de lealtad en GOOGLE Wallet (Android) — el espejo de Apple.
 *
 * Google funciona al revés que Apple y eso simplifica todo:
 *
 *  · No hay archivo firmado: el pase es un OBJETO en la API de Google
 *    (LoyaltyClass por negocio + LoyaltyObject por miembro), y
 *    "agregar al Wallet" es un link con un JWT firmado por nuestra
 *    cuenta de servicio.
 *  · No hay push propio: al hacer PATCH del objeto, Google actualiza
 *    los teléfonos solo. Sin APNs, sin registros de dispositivo.
 *
 * Sin dependencias nuevas: el RS256 del JWT y el OAuth (JWT bearer) se
 * firman con node:crypto, igual que la firma PKCS#7 de Apple se hace
 * con node-forge. La llave viene de GOOGLE_WALLET_SA_KEY_B64 (el JSON
 * de la cuenta de servicio en base64) + GOOGLE_WALLET_ISSUER_ID.
 *
 * Todo está APAGADO sin esas variables: credencialesGoogleDelEntorno()
 * devuelve null y ni el botón se muestra.
 */

const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const LOGO_BOOKEA = "https://www.bookea.lat/logo-bookea-v3.png";

export type CredencialesGoogle = {
  issuerId: string;
  clientEmail: string;
  /** PEM PKCS#8, tal cual viene en el JSON de la cuenta de servicio. */
  privateKey: string;
};

export function credencialesGoogleDelEntorno(): CredencialesGoogle | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const b64 = process.env.GOOGLE_WALLET_SA_KEY_B64;
  if (!issuerId || !b64) return null;
  try {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
      client_email?: string;
      private_key?: string;
    };
    if (!json.client_email || !json.private_key) return null;
    return { issuerId, clientEmail: json.client_email, privateKey: json.private_key };
  } catch {
    return null;
  }
}

// ── JWT RS256 a mano ──────────────────────────────────────────────────

function base64url(datos: Buffer | string): string {
  return Buffer.from(datos).toString("base64url");
}

export function firmarJwt(
  payload: Record<string, unknown>,
  privateKey: string,
): string {
  const cabecera = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(JSON.stringify(payload));
  const firmador = createSign("RSA-SHA256");
  firmador.update(`${cabecera}.${cuerpo}`);
  const firma = firmador.sign(privateKey).toString("base64url");
  return `${cabecera}.${cuerpo}.${firma}`;
}

// ── OAuth: token de acceso con caché ─────────────────────────────────

let tokenCache: { token: string; vence: number } | null = null;

async function tokenDeAcceso(cred: CredencialesGoogle): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.vence - 60_000) return tokenCache.token;

  const ahora = Math.floor(Date.now() / 1000);
  const assertion = firmarJwt(
    {
      iss: cred.clientEmail,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    },
    cred.privateKey,
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth de Google respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, vence: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

// ── Ids deterministas ─────────────────────────────────────────────────
// El id del objeto SALE del miembro (y la clase, del negocio): no hay
// tabla de mapeo que se pueda desincronizar. Google solo acepta
// [a-zA-Z0-9._-], así que los uuid van sin guiones.

export function idDeClase(issuerId: string, ranchoId: string): string {
  return `${issuerId}.negocio_${ranchoId.replace(/-/g, "")}`;
}

export function idDeObjeto(issuerId: string, miembroId: string): string {
  return `${issuerId}.miembro_${miembroId.replace(/-/g, "")}`;
}

// ── Los recursos, como los quiere la API ──────────────────────────────

export function construirClase({
  issuerId,
  ranchoId,
  nombreNegocio,
  config,
}: {
  issuerId: string;
  ranchoId: string;
  nombreNegocio: string;
  config: ConfigPase;
}) {
  const colores = coloresDe(config);
  return {
    id: idDeClase(issuerId, ranchoId),
    issuerName: "Bookea",
    programName: nombreNegocio,
    programLogo: {
      sourceUri: { uri: config.pase_logo_url || LOGO_BOOKEA },
      contentDescription: {
        defaultValue: { language: "es", value: `Logo de ${nombreNegocio}` },
      },
    },
    hexBackgroundColor: colores.fondo,
    countryCode: "CR",
    reviewStatus: "UNDER_REVIEW",
  };
}

export function construirObjeto({
  issuerId,
  ranchoId,
  miembroId,
  nombreCliente,
  serial,
  saldo,
  modo,
  meta,
}: {
  issuerId: string;
  ranchoId: string;
  miembroId: string;
  nombreCliente: string;
  /** El MISMO serial de pases_wallet: es lo que lee el escáner. */
  serial: string;
  saldo: number;
  modo: ConfigPase["modo"];
  meta: { nombre: string; costo_puntos: number } | null;
}) {
  const total = metaDeSellos(meta);
  return {
    id: idDeObjeto(issuerId, miembroId),
    classId: idDeClase(issuerId, ranchoId),
    state: "ACTIVE",
    accountId: miembroId,
    accountName: nombreCliente,
    loyaltyPoints: {
      label: (modo ?? "puntos") === "sellos" ? "Sellos" : modo === "cashback" ? "Saldo" : "Puntos",
      balance: { int: saldo },
    },
    barcode: {
      type: "QR_CODE",
      value: serial,
      alternateText: "Tarjeta Bookea",
    },
    ...(meta
      ? {
          textModulesData: [
            {
              id: "meta",
              header: meta.nombre,
              body:
                total !== null
                  ? `${Math.min(saldo, total)} de ${total} — al completarlos es tuya.`
                  : `Cuesta ${meta.costo_puntos} puntos.`,
            },
          ],
        }
      : {}),
  };
}

// ── Hablar con la API ─────────────────────────────────────────────────

async function llamarApi(
  cred: CredencialesGoogle,
  metodo: "GET" | "POST" | "PATCH",
  ruta: string,
  cuerpo?: unknown,
): Promise<{ status: number; json: unknown }> {
  const token = await tokenDeAcceso(cred);
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${token}`,
      ...(cuerpo ? { "content-type": "application/json" } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Algunas respuestas de error vienen vacías.
  }
  return { status: res.status, json };
}

/** Crea el recurso si no existe; si existe, lo actualiza (PATCH). */
async function asegurarRecurso(
  cred: CredencialesGoogle,
  coleccion: "loyaltyClass" | "loyaltyObject",
  recurso: { id: string },
): Promise<void> {
  const existe = await llamarApi(cred, "GET", `/${coleccion}/${recurso.id}`);
  if (existe.status === 404) {
    const creado = await llamarApi(cred, "POST", `/${coleccion}`, recurso);
    if (creado.status >= 300) {
      throw new Error(`Google no aceptó el ${coleccion}: ${JSON.stringify(creado.json).slice(0, 300)}`);
    }
    return;
  }
  if (existe.status >= 300) {
    throw new Error(`Google respondió ${existe.status} consultando el ${coleccion}.`);
  }
  const parche = await llamarApi(cred, "PATCH", `/${coleccion}/${recurso.id}`, recurso);
  if (parche.status >= 300) {
    throw new Error(`Google no aceptó actualizar el ${coleccion}: ${JSON.stringify(parche.json).slice(0, 300)}`);
  }
}

// ── Lo que usa el resto de la app ─────────────────────────────────────

export type ResultadoPaseGoogle = { ok: true; url: string } | { ok: false; motivo: string };

/**
 * Genera (o refresca) el pase de Google de un cliente y devuelve el
 * link "Guardar en Google Wallet". Espejo de generarPaseDeLealtad:
 * auto-afilia al bajarlo, serial estable, y la identidad la verificó
 * quien llama con la sesión.
 */
export async function generarPaseGoogle({
  ranchoId,
  clienteId,
}: {
  ranchoId: string;
  clienteId: string;
}): Promise<ResultadoPaseGoogle> {
  const cred = credencialesGoogleDelEntorno();
  if (!cred) return { ok: false, motivo: "Google Wallet no está configurado en este servidor." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: negocio } = await db
    .from("ranchos")
    .select("id, nombre, plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  if (!negocio) return { ok: false, motivo: "Ese negocio no existe." };

  // `select *`, igual que en Apple (generar.ts): desde la 0134 el
  // programa cuelga de una CUENTA, y pedir `cuenta_id` explícitamente
  // rompería la consulta entera mientras la migración no esté corrida.
  const { data: programaFila } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", ranchoId)
    .eq("activo", true)
    .maybeSingle();
  if (!programaFila) {
    return { ok: false, motivo: "Este negocio todavía no tiene programa de lealtad." };
  }
  const programa = programaFila as {
    id: string;
    activo: boolean;
    modo: string | null;
    pase_color_fondo: string | null;
    pase_color_sello: string | null;
    pase_logo_url: string | null;
  };

  // Afiliación implícita, igual que en Apple: pedir la tarjeta ES unirse.
  let { data: miembro } = await db
    .from("miembros")
    .select("id, estado")
    .eq("programa_id", programa.id)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!miembro) {
    // El tope del plan se cumple igual que en Apple (generar.ts): la
    // afiliación NUEVA se frena cuando el programa está lleno, y el
    // plan sale de la CUENTA con el del rancho como respaldo.
    const { definicionDe } = await import("@/lib/lealtad/planes");
    const { contextoDeCuenta } = await import("@/lib/lealtad/cuenta");
    const { plan } = await contextoDeCuenta(db, programaFila as Record<string, unknown>, {
      planRancho: (negocio as { plan_lealtad?: string | null }).plan_lealtad ?? null,
    });
    const limite = definicionDe(plan)?.limites.clientesActivos;
    if (limite !== null && limite !== undefined) {
      const { count } = await db
        .from("miembros")
        .select("*", { count: "exact", head: true })
        .eq("programa_id", programa.id);
      if ((count ?? 0) >= limite) {
        return {
          ok: false,
          motivo:
            "El programa de este negocio está lleno por ahora — preguntá en el local.",
        };
      }
    }

    const { data: nuevo, error } = await db
      .from("miembros")
      .insert({ programa_id: programa.id, cliente_id: clienteId, estado: "activa" })
      .select("id, estado")
      .single();
    if (error) return { ok: false, motivo: "No se pudo afiliar: " + error.message };
    miembro = nuevo;
  }
  if (miembro!.estado === "cancelada") return { ok: false, motivo: "Esta membresía está cancelada." };

  // Un pase por miembro y plataforma, con serial estable (el QR).
  let { data: pase } = await db
    .from("pases_wallet")
    .select("serial_number")
    .eq("miembro_id", miembro!.id)
    .eq("plataforma", "google")
    .maybeSingle();
  if (!pase) {
    const { data: nuevo, error } = await db
      .from("pases_wallet")
      .insert({
        miembro_id: miembro!.id,
        plataforma: "google",
        serial_number: randomUUID(),
        // Google no autentica con esto (no hay web service propio),
        // pero la columna es not null y única por diseño.
        auth_token: randomBytes(32).toString("hex"),
        saldo_cache: 0,
      })
      .select("serial_number")
      .single();
    if (error) return { ok: false, motivo: "No se pudo crear el pase: " + error.message };
    pase = nuevo;
  }

  const saldo = (await consultarSaldo(miembro!.id)) ?? 0;
  const { data: recompensa } = await db
    .from("recompensas")
    .select("nombre, costo_puntos")
    .eq("programa_id", programa.id)
    .eq("activo", true)
    .order("costo_puntos", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: perfil } = await db
    .from("perfiles")
    .select("nombre")
    .eq("id", clienteId)
    .maybeSingle();

  const config: ConfigPase = {
    modo: programa.modo as ConfigPase["modo"],
    pase_color_fondo: programa.pase_color_fondo as string | null,
    pase_color_sello: programa.pase_color_sello as string | null,
    pase_logo_url: programa.pase_logo_url as string | null,
  };

  try {
    await asegurarRecurso(
      cred,
      "loyaltyClass",
      construirClase({ issuerId: cred.issuerId, ranchoId, nombreNegocio: negocio.nombre, config }),
    );
    await asegurarRecurso(
      cred,
      "loyaltyObject",
      construirObjeto({
        issuerId: cred.issuerId,
        ranchoId,
        miembroId: miembro!.id,
        nombreCliente: ((perfil?.nombre as string | null) ?? "").trim() || "Cliente",
        serial: pase!.serial_number as string,
        saldo,
        modo: config.modo,
        meta: recompensa
          ? { nombre: recompensa.nombre as string, costo_puntos: recompensa.costo_puntos as number }
          : null,
      }),
    );
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : "Google Wallet no respondió." };
  }

  const ahora = Math.floor(Date.now() / 1000);
  const jwt = firmarJwt(
    {
      iss: cred.clientEmail,
      aud: "google",
      typ: "savetowallet",
      iat: ahora,
      payload: { loyaltyObjects: [{ id: idDeObjeto(cred.issuerId, miembro!.id) }] },
    },
    cred.privateKey,
  );

  return { ok: true, url: `https://pay.google.com/gp/v/save/${jwt}` };
}

/**
 * Refresca el saldo del pase de Google de un miembro (tras acreditar,
 * canjear o revertir). Google avisa a los teléfonos solo — esto es el
 * equivalente entero del push de Apple. Nunca lanza: el ledger ya
 * quedó bien y es lo que manda.
 */
export async function refrescarPaseGoogleDeMiembro(miembroId: string): Promise<void> {
  try {
    const cred = credencialesGoogleDelEntorno();
    const db = createAdminClient();
    if (!cred || !db) return;

    const { data: pase } = await db
      .from("pases_wallet")
      .select("serial_number")
      .eq("miembro_id", miembroId)
      .eq("plataforma", "google")
      .maybeSingle();
    if (!pase) return; // sin pase de Android no hay nada que refrescar

    const { data: miembro } = await db
      .from("miembros")
      .select("id, programa_id")
      .eq("id", miembroId)
      .maybeSingle();
    if (!miembro) return;

    const { data: programa } = await db
      .from("programa_lealtad")
      .select("modo")
      .eq("id", miembro.programa_id)
      .maybeSingle();

    const saldo = (await consultarSaldo(miembroId)) ?? 0;
    const { data: recompensa } = await db
      .from("recompensas")
      .select("nombre, costo_puntos")
      .eq("programa_id", miembro.programa_id)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(1)
      .maybeSingle();

    const meta = recompensa
      ? { nombre: recompensa.nombre as string, costo_puntos: recompensa.costo_puntos as number }
      : null;
    const total = metaDeSellos(meta);

    const parche = {
      loyaltyPoints: {
        label:
          ((programa?.modo as string | null) ?? "puntos") === "sellos"
            ? "Sellos"
            : programa?.modo === "cashback"
              ? "Saldo"
              : "Puntos",
        balance: { int: saldo },
      },
      ...(meta
        ? {
            textModulesData: [
              {
                id: "meta",
                header: meta.nombre,
                body:
                  total !== null
                    ? `${Math.min(saldo, total)} de ${total} — al completarlos es tuya.`
                    : `Cuesta ${meta.costo_puntos} puntos.`,
              },
            ],
          }
        : {}),
    };

    const res = await llamarApi(
      cred,
      "PATCH",
      `/loyaltyObject/${idDeObjeto(cred.issuerId, miembroId)}`,
      parche,
    );
    if (res.status >= 300 && res.status !== 404) {
      // 404 = nunca se creó el objeto (fila huérfana): no es un error
      // que valga la pena gritar en cada sello.
      console.warn(`[google-wallet] PATCH respondió ${res.status}: ${JSON.stringify(res.json).slice(0, 200)}`);
    }

    await db
      .from("pases_wallet")
      .update({ saldo_cache: saldo, actualizado_en: new Date().toISOString() })
      .eq("miembro_id", miembroId)
      .eq("plataforma", "google");
  } catch (e) {
    console.warn("[google-wallet] No se pudo refrescar el pase:", e);
  }
}
