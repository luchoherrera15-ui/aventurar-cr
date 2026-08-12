import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarSaldo } from "@/lib/lealtad/motor";
import { puede } from "@/lib/lealtad/planes";
import { dibujarIcono, dibujarLogo, dibujarTiraDeSellos } from "./imagenes";
import { empaquetarPase } from "./empaquetar";
import { credencialesDelEntorno } from "./firma";

/**
 * Base pública del sitio; Apple le agrega `/v1/...` por su cuenta.
 *
 * TIENE que ser el host CANÓNICO, con `www`. El ápex `bookea.lat`
 * responde 308 hacia `www`, y el Web Service de Wallet no sigue
 * redirecciones de forma confiable: el iPhone acepta el pase, nunca
 * completa el registro, y el sello no se refresca jamás. No hay error
 * visible en ningún lado — por eso está clavado y no derivado.
 */
const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bookea.lat";
import {
  coloresDe,
  construirPassJson,
  metaDeSellos,
  type ConfigPase,
  type MetaRecompensa,
} from "./tarjeta";

/**
 * Genera el .pkpass de un cliente para un negocio.
 *
 * Junta lo que vive repartido: el programa y su apariencia (0060,
 * 0121, 0122), el saldo derivado del ledger, la recompensa que marca
 * la meta, y el certificado del entorno.
 *
 * Corre con la llave de servicio a propósito: `pases_wallet` no tiene
 * política de escritura para clientes —crear el pase y firmarlo es del
 * servidor— pero la IDENTIDAD la comprueba quien llama, con la sesión
 * del usuario, antes de invocar esto.
 */

export type ResultadoPase =
  | { ok: true; pkpass: Buffer; serialNumber: string }
  | { ok: false; motivo: string };

export async function generarPaseDeLealtad({
  ranchoId,
  clienteId,
  ahora,
}: {
  ranchoId: string;
  /** Ya verificado por quien llama contra la sesión. */
  clienteId: string;
  ahora: Date;
}): Promise<ResultadoPase> {
  const credenciales = credencialesDelEntorno();
  if (!credenciales) {
    return { ok: false, motivo: "El pase de Wallet no está configurado en este servidor." };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // ── El negocio y su programa ──────────────────────────────────────
  const { data: negocio } = await db
    .from("ranchos")
    .select("id, nombre, latitud, longitud, plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  if (!negocio) return { ok: false, motivo: "Ese negocio no existe." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("id, activo, modo, pase_color_fondo, pase_color_sello, pase_logo_url")
    .eq("rancho_id", ranchoId)
    .eq("activo", true)
    .maybeSingle();
  if (!programa) {
    return { ok: false, motivo: "Este negocio todavía no tiene programa de lealtad." };
  }

  // ── El miembro: si no lo es, se afilia acá ────────────────────────
  // Pedir la tarjeta ES afiliarse. Obligar a un paso previo solo
  // agrega una pantalla donde la gente se cae.
  let { data: miembro } = await db
    .from("miembros")
    .select("id, estado")
    .eq("programa_id", programa.id)
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (!miembro) {
    const { data: nuevo, error } = await db
      .from("miembros")
      .insert({ programa_id: programa.id, cliente_id: clienteId, estado: "activa" })
      .select("id, estado")
      .single();
    if (error) return { ok: false, motivo: "No se pudo afiliar: " + error.message };
    miembro = nuevo;
  }

  if (miembro!.estado === "cancelada") {
    return { ok: false, motivo: "Esta membresía está cancelada." };
  }

  // ── El saldo y la meta ────────────────────────────────────────────
  const saldo = (await consultarSaldo(miembro!.id)) ?? 0;

  // La recompensa activa MÁS BARATA es la próxima meta: es lo que el
  // cliente puede alcanzar primero, y de ahí sale el "5 de 10".
  const { data: recompensa } = await db
    .from("recompensas")
    .select("nombre, costo_puntos")
    .eq("programa_id", programa.id)
    .eq("activo", true)
    .order("costo_puntos", { ascending: true })
    .limit(1)
    .maybeSingle();

  const meta: MetaRecompensa = recompensa
    ? { nombre: recompensa.nombre as string, costo_puntos: recompensa.costo_puntos as number }
    : null;

  // ── El pase: uno por miembro, con serial estable ──────────────────
  // El serial NO se regenera: es la identidad de la tarjeta en el
  // teléfono. Si cambiara, cada actualización agregaría una tarjeta
  // nueva en vez de refrescar la que el cliente ya tiene.
  let { data: pase } = await db
    .from("pases_wallet")
    .select("serial_number, auth_token")
    .eq("miembro_id", miembro!.id)
    .eq("plataforma", "apple")
    .maybeSingle();

  if (!pase) {
    const { data: nuevo, error } = await db
      .from("pases_wallet")
      .insert({
        miembro_id: miembro!.id,
        plataforma: "apple",
        serial_number: randomUUID(),
        // Con esto Apple se autentica al pedir el pase actualizado.
        auth_token: randomBytes(32).toString("hex"),
        saldo_cache: saldo,
      })
      .select("serial_number, auth_token")
      .single();
    if (error) return { ok: false, motivo: "No se pudo crear el pase: " + error.message };
    pase = nuevo;
  }

  const serialNumber = pase!.serial_number as string;
  const authToken = pase!.auth_token as string;

  // ── Las imágenes ──────────────────────────────────────────────────
  const config: ConfigPase = {
    modo: programa.modo as ConfigPase["modo"],
    pase_color_fondo: programa.pase_color_fondo as string | null,
    pase_color_sello: programa.pase_color_sello as string | null,
    pase_logo_url: programa.pase_logo_url as string | null,
  };
  const colores = coloresDe(config);
  const logoNegocio = await bajarImagen(config.pase_logo_url);

  const archivos: Record<string, Buffer> = {
    "icon.png": await dibujarIcono(29),
    "icon@2x.png": await dibujarIcono(58),
    "icon@3x.png": await dibujarIcono(87),
    "logo.png": await dibujarLogo({ nombre: negocio.nombre, imagen: logoNegocio, ancho: 160, alto: 50 }),
    "logo@2x.png": await dibujarLogo({ nombre: negocio.nombre, imagen: logoNegocio, ancho: 320, alto: 100 }),
  };

  // La tira de sellos SOLO en modo sellos y con meta: sin ella no hay
  // "5 de 10" posible, y una tira de círculos sin total no dice nada.
  const total = metaDeSellos(meta);
  if ((config.modo ?? "puntos") === "sellos" && total !== null) {
    for (const escala of [1, 2, 3] as const) {
      const nombre = escala === 1 ? "strip.png" : `strip@${escala}x.png`;
      archivos[nombre] = await dibujarTiraDeSellos({
        total,
        logrados: Math.min(saldo, total),
        colores,
        imagen: logoNegocio,
        escala,
      });
    }
  }

  // El aviso por cercanía lo trae el PLAN (0124), o lo regala un
  // complemento suelto (0123) para una cortesía o una prueba. No
  // alcanza con que el negocio tenga coordenadas cargadas.
  const { data: regalado } = await db.rpc("tiene_addon", {
    p_rancho_id: ranchoId,
    p_addon: "pases_cercania",
  });
  const tieneCercania = puede(
    (negocio as { plan_lealtad?: string | null }).plan_lealtad ?? null,
    "cercania",
    regalado === true ? ["pases_cercania"] : [],
  );

  const passJson = construirPassJson({
    negocioNombre: negocio.nombre,
    saldo,
    meta,
    config,
    serialNumber,
    passTypeIdentifier: credenciales.passTypeIdentifier,
    teamIdentifier: credenciales.teamIdentifier,
    ubicacion: tieneCercania === true ? coordenadasDe(negocio) : null,
    // Con esto el pase se registra solo para recibir actualizaciones:
    // al sumar un sello, el teléfono lo refresca sin que el cliente
    // vuelva a bajarlo.
    authToken,
    webServiceUrl: `${SITIO_URL}/api/wallet`,
  });
  archivos["pass.json"] = Buffer.from(JSON.stringify(passJson, null, 2), "utf8");

  try {
    const pkpass = await empaquetarPase({ archivos, credenciales, ahora });
    return { ok: true, pkpass, serialNumber };
  } catch (e) {
    // El caso típico es el certificado vencido, y su mensaje ya viene
    // en español con la fecha.
    return { ok: false, motivo: e instanceof Error ? e.message : "No se pudo firmar el pase." };
  }
}

/**
 * El logo del negocio, si lo configuró. Un fallo bajándolo NO tumba el
 * pase: se cae al nombre en Montserrat, que es peor pero sirve.
 */
async function bajarImagen(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function coordenadasDe(negocio: Record<string, unknown>) {
  const lat = Number(negocio.latitud);
  const lon = Number(negocio.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitud: lat, longitud: lon };
}
