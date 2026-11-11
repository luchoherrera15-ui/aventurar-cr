import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarTarjetaDeAlta, type TarjetaDeAlta } from "@/lib/lealtad/tarjeta-alta";
import { definicionDe } from "@/lib/lealtad/planes";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { beneficioDeFoorkie } from "@/lib/lealtad/canje-libre";
import { monedaParaCrear } from "@/lib/lealtad/moneda-tarjeta";
import { acumulacionDe } from "@/lib/lealtad/mostrador";
import { sembrarRecompensa } from "@/lib/lealtad/sembrar-recompensa";
import { minutoISOCR } from "@/lib/fechas";
import { SELLO_PROPIO } from "@/lib/lealtad/iconos-sello";
import {
  copiarImagenDeFoorkie,
  leerIconoSello,
  leerPedidoFirmado,
  leerTira,
  leerUrlDeIcono,
  MOTIVO_DISENO,
  responder,
  UUID,
} from "@/lib/plataforma/foorkie-api";
import { COLUMNA_LEALTAD_POR_FOORKIE } from "@/lib/plataforma/negocio-de-foorkie";
import { estadoAlCrear } from "@/app/lealtad/panel/[id]/estado-inicial";
import { cupoLleno, lasQueOcupanCupo, tarjetaDelCupo } from "@/app/lealtad/panel/[id]/cupo-tarjetas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/programa/crear — OTRA tarjeta para un local
 * de Foorkie que ya tiene la suya, en el MISMO negocio de Bookea.
 *
 * Pedido de Luis (11 nov 2026): «Tostado Café Bistró» lleva tres tarjetas
 * —puntos y dos de socio, una por cada equipo deportivo—. `negocio` crea
 * el negocio y su PRIMERA tarjeta (y rechaza un local que ya tiene una);
 * esta ruta agrega las demás adentro del mismo negocio, que es como
 * Bookea arma un negocio con varias tarjetas (el asistente de su panel,
 * `crearTarjeta`): mismo nombre y mismo logo en el Wallet, cada una con
 * su tipo y su beneficio.
 *
 *   { rancho_id, programa_id: la PRINCIPAL del local, nombre (1–40),
 *     intento_id: uuid, tarjeta: { modo, beneficio, colorFondo?, colorSello?,
 *     logoUrl?, bannerUrl?, iconoSello?, iconoUrl?, diseno? } }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, programa_id, ya_estaba }
 *   400 { codigo: "datos", motivo }        · 401 firma
 *   403 { codigo: "no_es_de_foorkie" }     la principal no es de un local
 *                                          de Foorkie con la marca (o el par
 *                                          negocio + tarjeta no coincide)
 *   503 no_configurado
 *
 * Foorkie guarda después la tarjeta nueva en `foorkie_lealtad_tarjetas`
 * (con su slug y su código para unirse): Bookea no escribe tablas de
 * Foorkie. Mientras esa fila no exista, la tarjeta es de Bookea para todo
 * el motor (pase, correos, caja): Foorkie la tiene que guardar ANTES de
 * repartirla.
 *
 * ── SOLO SOBRE UNA PRINCIPAL MARCADA ────────────────────────────────
 * `programa_id` tiene que ser la tarjeta de la columna de siempre
 * (`foorkie_restaurantes.bookea_programa_id`) de un local con
 * `lealtad_por_foorkie`, con su mismo negocio. Una extra no sirve de
 * ancla, y un negocio de Bookea vinculado sin la marca (Pura Matcha)
 * tampoco: sus tarjetas nuevas se arman desde el panel de Bookea.
 *
 * ── EL PAQUETE ──────────────────────────────────────────────────────
 * El tipo y el tope de tarjetas se miden contra el paquete del negocio,
 * igual que `crearTarjeta`. Toda tarjeta de Foorkie nace con `impulso`
 * (`PLAN_ALTA` de Foorkie: los ocho tipos y sin tope de tarjetas), así
 * que para ellas no frena nada; si algún día un negocio de Foorkie
 * tuviera un paquete con tope, se respeta y el motivo dice cuál.
 *
 * ── LO QUE HEREDA DE LA PRINCIPAL ───────────────────────────────────
 * Sin colores, logo o banda, los de la principal (ya son copias de
 * Bookea, no se vuelven a copiar): la tarjeta nueva se ve de la misma
 * marca. El ícono y la tira son de sellos y no se heredan.
 *
 * ── LA DE SOCIO CON RENOVACIÓN AUTOMÁTICA NO VENCE ──────────────────
 * Una membresía siembra su premio con `vigenciaMeses` (`sembrarRecompensa`)
 * y ese día el beneficio deja de valer para TODOS sus socios: no es por
 * cliente, y `renovacionAutomatica` no lo renueva en ningún lado. Una
 * tarjeta de equipo es «mientras seas del equipo»: con
 * `renovacionAutomatica: true`, la de Foorkie nace con el premio SIN
 * vencimiento. Quién es socio lo decide el local (da de baja a quien
 * deja el equipo).
 *
 * ── IDEMPOTENTE POR `intento_id` ────────────────────────────────────
 * La tarjeta nace con id = `intento_id`. Un reintento del mismo intento
 * encuentra la tarjeta ya creada en este negocio y contesta `ya_estaba`
 * sin crear otra; un id que ya es de otro negocio es un 400.
 */

/** Copia una imagen pública de Foorkie a Bookea. null = no vino; "error" = no se pudo. */
async function copiarImagen(db: SupabaseClient, url: unknown, destino: "logo" | "banda" | "icono"): Promise<string | null | "error"> {
  if (typeof url !== "string" || !url.trim()) return null;
  return copiarImagenDeFoorkie(db, url.trim(), destino);
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** ¿La tarjeta con ese id ya existe? En qué negocio. null = no existe. */
async function yaCreada(db: SupabaseClient, id: string): Promise<{ ranchoId: string } | null> {
  const { data } = await db.from("programa_lealtad").select("id, rancho_id").eq("id", id).maybeSingle();
  return data ? { ranchoId: String((data as { rancho_id?: unknown }).rancho_id ?? "") } : null;
}

export async function POST(request: Request) {
  const pedido = await leerPedidoFirmado(request, 8000);
  if (!pedido.ok) return pedido.respuesta;
  const d = pedido.datos;

  const ranchoId = typeof d.rancho_id === "string" && UUID.test(d.rancho_id) ? d.rancho_id.toLowerCase() : null;
  const programaId = typeof d.programa_id === "string" && UUID.test(d.programa_id) ? d.programa_id.toLowerCase() : null;
  const intentoId = typeof d.intento_id === "string" && UUID.test(d.intento_id) ? d.intento_id.toLowerCase() : null;
  const nombre = typeof d.nombre === "string" ? d.nombre.replace(/\s+/g, " ").trim() : "";
  const tarjetaCruda = d.tarjeta && typeof d.tarjeta === "object" && !Array.isArray(d.tarjeta) ? (d.tarjeta as Record<string, unknown>) : null;
  if (!ranchoId || !programaId) return responder({ ok: false, codigo: "datos", motivo: "Falta la tarjeta principal (rancho_id y programa_id)." }, 400);
  if (!intentoId) return responder({ ok: false, codigo: "datos", motivo: "Falta el identificador del intento (intento_id, un uuid)." }, 400);
  if (nombre.length < 1 || nombre.length > 40) return responder({ ok: false, codigo: "datos", motivo: "El nombre de la tarjeta va de 1 a 40 caracteres." }, 400);
  if (!tarjetaCruda) return responder({ ok: false, codigo: "datos", motivo: "Falta la tarjeta (tipo y beneficio)." }, 400);
  const modo = texto(tarjetaCruda.modo);
  if (!modo || !tarjetaCruda.beneficio) return responder({ ok: false, codigo: "datos", motivo: "Falta el tipo de tarjeta y su beneficio." }, 400);

  // El sello y la tira: solo la forma, antes de tocar la base (como `negocio`).
  const icono = leerIconoSello(tarjetaCruda.iconoSello);
  if (!icono.ok) return responder({ ok: false, codigo: "datos", motivo: icono.motivo }, 400);
  const iconoUrlCruda = leerUrlDeIcono(tarjetaCruda.iconoUrl);
  if (!iconoUrlCruda.ok) return responder({ ok: false, codigo: "datos", motivo: iconoUrlCruda.motivo }, 400);
  const tira = leerTira(tarjetaCruda.diseno);
  if (!tira.ok) return responder({ ok: false, codigo: "datos", motivo: tira.motivo }, 400);
  const conSello = modo === "sellos";
  if (conSello && icono.valor === SELLO_PROPIO && !iconoUrlCruda.valor) {
    return responder({ ok: false, codigo: "datos", motivo: MOTIVO_DISENO.sinArchivo }, 400);
  }

  const db = createAdminClient();
  if (!db) return responder({ ok: false, codigo: "no_configurado" }, 503);

  // ── La principal: de un local de Foorkie, con la marca, en ESTE negocio ──
  const [{ data: local }, { data: principal }, { data: rancho }] = await Promise.all([
    db
      .from("foorkie_restaurantes")
      .select("id, moneda")
      .eq("bookea_rancho_id", ranchoId)
      .eq("bookea_programa_id", programaId)
      .eq(COLUMNA_LEALTAD_POR_FOORKIE, true)
      .limit(1)
      .maybeSingle(),
    db.from("programa_lealtad").select("*").eq("id", programaId).eq("rancho_id", ranchoId).maybeSingle(),
    db.from("ranchos").select("id, plan_lealtad").eq("id", ranchoId).maybeSingle(),
  ]);
  if (!local || !principal || !rancho) {
    return responder(
      { ok: false, codigo: "no_es_de_foorkie", motivo: "Esa tarjeta no es la principal de un local de Foorkie Lealtad." },
      403,
    );
  }
  const filaPrincipal = principal as Record<string, unknown>;

  // ── Un reintento del mismo intento: la tarjeta ya existe ──
  const previa = await yaCreada(db, intentoId);
  if (previa) {
    if (previa.ranchoId === ranchoId) return responder({ ok: true, programa_id: intentoId, ya_estaba: true });
    return responder({ ok: false, codigo: "datos", motivo: "Ese intento_id ya se usó para otra tarjeta." }, 400);
  }

  // ── El paquete del negocio: el tipo y el tope de tarjetas ──
  const { plan } = await contextoDeCuenta(db, filaPrincipal, {
    planRancho: ((rancho as { plan_lealtad?: unknown }).plan_lealtad as string | null) ?? null,
  });
  const planParaValidar = plan ?? "impulso";

  // La moneda del local, para un cashback (como `negocio`). En los demás tipos no se usa.
  const esCashback = modo === "cashback";
  const moneda = monedaParaCrear(String((local as { moneda?: unknown }).moneda ?? "CRC").trim().toUpperCase() || "CRC");
  if (esCashback && !moneda) {
    return responder({ ok: false, codigo: "datos", motivo: "Todavía no hay cashback en la moneda de este local." }, 400);
  }

  const [logoUrl, bannerUrl, iconoUrl] = await Promise.all([
    copiarImagen(db, tarjetaCruda.logoUrl, "logo"),
    copiarImagen(db, tarjetaCruda.bannerUrl, "banda"),
    conSello ? copiarImagen(db, iconoUrlCruda.valor, "icono") : Promise.resolve(null),
  ]);
  if (logoUrl === "error" || bannerUrl === "error") {
    return responder({ ok: false, codigo: "datos", motivo: "No pudimos copiar el logo o la banda (tienen que ser imágenes PNG, JPG o WebP de Foorkie)." }, 400);
  }
  if (iconoUrl === "error") return responder({ ok: false, codigo: "datos", motivo: MOTIVO_DISENO.copia }, 400);

  const cruda: TarjetaDeAlta = {
    modo,
    beneficio: beneficioDeFoorkie(tarjetaCruda.beneficio, moneda ?? undefined) as TarjetaDeAlta["beneficio"],
    colorFondo: texto(tarjetaCruda.colorFondo),
    colorSello: texto(tarjetaCruda.colorSello),
    logoUrl,
    bannerUrl,
    iconoSello: icono.valor ?? null,
    iconoUrl,
    diseno: tira.valor ?? null,
  };
  const validada = validarTarjetaDeAlta(cruda, planParaValidar);
  if (!validada.ok) return responder({ ok: false, codigo: "datos", motivo: validada.motivo }, 400);
  const t = validada.tarjeta;
  if (!t || !t.modo || !t.beneficio) return responder({ ok: false, codigo: "datos", motivo: "Falta el tipo de tarjeta y su beneficio." }, 400);

  const tope = definicionDe(planParaValidar)?.limites.programas ?? null;
  if (tope !== null) {
    const { data: ocupan } = await db.from("programa_lealtad").select("*").eq("rancho_id", ranchoId);
    const ocupadas = lasQueOcupanCupo(((ocupan ?? []) as Record<string, unknown>[]).map(tarjetaDelCupo), minutoISOCR());
    if (cupoLleno({ ocupadas: ocupadas.length, tope })) {
      return responder(
        { ok: false, codigo: "datos", motivo: `El paquete de este negocio permite ${tope} tarjeta${tope === 1 ? "" : "s"} y ya las tiene.` },
        400,
      );
    }
  }

  // ── La fila, como `crearTarjeta`, con la marca de la principal ──
  const heredada = (columna: string): string | null => {
    const v = filaPrincipal[columna];
    return typeof v === "string" && v.trim() ? v : null;
  };
  const acumula = acumulacionDe(t.beneficio);
  const fila: Record<string, unknown> = {
    id: intentoId,
    rancho_id: ranchoId,
    nombre,
    modo: t.modo,
    beneficio: t.beneficio,
    pase_color_fondo: t.colorFondo ?? heredada("pase_color_fondo"),
    pase_color_sello: t.colorSello ?? heredada("pase_color_sello"),
    pase_logo_url: t.logoUrl ?? heredada("pase_logo_url"),
    pase_banner_url: t.bannerUrl ?? heredada("pase_banner_url"),
    pase_notificacion_logo_url: heredada("pase_notificacion_logo_url"),
    pase_sello_icono: t.iconoSello,
    pase_sello_icono_url: t.iconoUrl,
    ...estadoAlCrear(),
    puntos_por_visita: acumula.porVisita,
    puntos_por_colon: acumula.porColon,
    compra_minima: acumula.compraMinima,
  };
  if (t.diseno) fila.pase_diseno = t.diseno;
  const cuentaId = heredada("cuenta_id");
  if (cuentaId) fila.cuenta_id = cuentaId;

  const { error } = await db.from("programa_lealtad").insert(fila);
  if (error) {
    // Dos reintentos al mismo tiempo: el segundo choca con el id del primero.
    if (error.code === "23505") {
      const otra = await yaCreada(db, intentoId);
      if (otra?.ranchoId === ranchoId) return responder({ ok: true, programa_id: intentoId, ya_estaba: true });
    }
    console.error("[foorkie:programa/crear] No se pudo crear la tarjeta:", error.message);
    return responder({ ok: false, codigo: "datos", motivo: "No se pudo crear la tarjeta. Se puede reintentar con el mismo intento_id." }, 400);
  }

  // Lo que se canjea (o se USA, en una de socio): la misma siembra de todas las altas.
  await sembrarRecompensa(db, intentoId, t.beneficio);
  if (t.beneficio.tipo === "membresia" && t.beneficio.renovacionAutomatica === true) {
    const { error: eVigencia } = await db.from("recompensas").update({ vigencia_hasta: null }).eq("programa_id", intentoId);
    if (eVigencia) console.error("[foorkie:programa/crear] El beneficio del socio quedó con vencimiento:", eVigencia.message);
  }

  return responder({ ok: true, programa_id: intentoId, ya_estaba: false });
}
