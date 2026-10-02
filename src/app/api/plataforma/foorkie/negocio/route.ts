import { createAdminClient } from "@/lib/supabase/admin";
import { crearNegocioDeLealtadCompleto } from "@/lib/lealtad/crear-negocio-completo";
import { validarTarjetaDeAlta, type TarjetaDeAlta } from "@/lib/lealtad/tarjeta-alta";
import { definicionDe } from "@/lib/lealtad/planes";
import { normalizarCorreo } from "@/lib/lealtad/personas";
import { beneficioDeFoorkie } from "@/lib/lealtad/canje-libre";
import { copiarImagenDeFoorkie, leerPedidoFirmado, responder, UUID } from "@/lib/plataforma/foorkie-api";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/negocio — crea en Bookea el negocio y la
 * tarjeta de lealtad de uno o varios locales de Foorkie (las sucursales
 * de una marca comparten tarjeta). Ver `foorkie-api.ts`.
 *
 *   { restaurante_ids: uuid[], nombre, correo, telefono?, plan,
 *     tarjeta: { modo, beneficio, colorFondo?, colorSello?, logoUrl?, bannerUrl? } }
 *   firmado en `x-foorkie-firma`
 *
 *   200 { ok: true, rancho_id, programa_id, slug }
 *   400 datos/motivo · 409 ya_vinculado · 401 firma · 503
 *
 * Es el MISMO alta que hace un admin de Bookea (`crearNegocioDeLealtadCompleto`,
 * origen "admin"): mismo negocio, mismo complemento, mismo aviso al
 * equipo. El dueño es el dueño de los locales en Foorkie (misma cuenta de
 * `auth.users`), y Bookea lo comprueba leyendo `foorkie_restaurantes`:
 * una firma no alcanza para abrirle un negocio a cualquiera.
 *
 * Las imágenes llegan como URLs del bucket público de Foorkie
 * (`foorkie_media`) y se COPIAN al de Bookea (`comprobantes/logos-negocio/`,
 * como el wizard de alta): un pase instalado no puede depender de un
 * archivo que otro producto puede borrar o cambiar.
 *
 * Foorkie guarda después los ids en sus locales (`bookea_rancho_id` +
 * `bookea_programa_id`): Bookea no escribe tablas de Foorkie.
 */

/** Copia una imagen pública de Foorkie al bucket del alta de Bookea. null = no vino; "error" = no se pudo. */
async function copiarImagen(db: SupabaseClient, url: unknown, destino: "logo" | "banda"): Promise<string | null | "error"> {
  if (typeof url !== "string" || !url.trim()) return null;
  return copiarImagenDeFoorkie(db, url.trim(), destino);
}

export async function POST(request: Request) {
  const pedido = await leerPedidoFirmado(request, 8000);
  if (!pedido.ok) return pedido.respuesta;
  const d = pedido.datos;

  const ids = Array.isArray(d.restaurante_ids) ? d.restaurante_ids.filter((x): x is string => typeof x === "string" && UUID.test(x)) : [];
  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  const correo = normalizarCorreo(typeof d.correo === "string" ? d.correo : null);
  const telefono = typeof d.telefono === "string" ? d.telefono.replace(/[^\d+]/g, "").slice(0, 20) || null : null;
  const plan = typeof d.plan === "string" ? d.plan : "";
  const tarjetaCruda = d.tarjeta && typeof d.tarjeta === "object" && !Array.isArray(d.tarjeta) ? (d.tarjeta as Record<string, unknown>) : null;
  if (ids.length === 0 || ids.length > 20 || nombre.length < 2 || nombre.length > 80 || !correo || !definicionDe(plan) || !tarjetaCruda) {
    return responder({ ok: false, codigo: "datos" }, 400);
  }

  const db = createAdminClient();
  if (!db) return responder({ ok: false, codigo: "no_configurado" }, 503);

  // Los locales: existen, son del mismo dueño y todavía no tienen tarjeta.
  const { data: locales } = await db
    .from("foorkie_restaurantes")
    .select("id, dueno_id, bookea_rancho_id, bookea_programa_id")
    .in("id", ids);
  if (!locales || locales.length !== new Set(ids).size) return responder({ ok: false, codigo: "datos", motivo: "Algún local no existe." }, 400);
  const duenos = new Set(locales.map((l) => String(l.dueno_id ?? "")));
  const dueno = [...duenos][0];
  if (duenos.size !== 1 || !dueno || !UUID.test(dueno)) {
    return responder({ ok: false, codigo: "datos", motivo: "Los locales tienen que ser del mismo dueño." }, 400);
  }
  if (locales.some((l) => l.bookea_rancho_id || l.bookea_programa_id)) {
    return responder({ ok: false, codigo: "ya_vinculado", motivo: "Alguno de esos locales ya tiene tarjeta de lealtad." }, 409);
  }

  const [logoUrl, bannerUrl] = await Promise.all([copiarImagen(db, tarjetaCruda.logoUrl, "logo"), copiarImagen(db, tarjetaCruda.bannerUrl, "banda")]);
  if (logoUrl === "error" || bannerUrl === "error") {
    return responder({ ok: false, codigo: "datos", motivo: "No pudimos copiar el logo o la banda (tienen que ser imágenes PNG, JPG o WebP de Foorkie)." }, 400);
  }

  const cruda: TarjetaDeAlta = {
    modo: typeof tarjetaCruda.modo === "string" ? tarjetaCruda.modo : null,
    // Toda tarjeta de este alta es de Foorkie: su cashback nace con canje
    // libre (0253, `canje-libre.ts`), sin el tramo de «₡1 000».
    beneficio: (beneficioDeFoorkie(tarjetaCruda.beneficio) ?? null) as TarjetaDeAlta["beneficio"],
    colorFondo: typeof tarjetaCruda.colorFondo === "string" ? tarjetaCruda.colorFondo : null,
    colorSello: typeof tarjetaCruda.colorSello === "string" ? tarjetaCruda.colorSello : null,
    logoUrl,
    bannerUrl,
  };
  const validada = validarTarjetaDeAlta(cruda, plan);
  if (!validada.ok) return responder({ ok: false, codigo: "datos", motivo: validada.motivo }, 400);

  const creado = await crearNegocioDeLealtadCompleto({
    userId: dueno,
    plan,
    nombre,
    tipo: "restaurantes",
    detalle: "",
    paseColor: cruda.colorFondo ?? "",
    paseLogoUrl: logoUrl,
    regalia: "",
    metaSellos: 10,
    telefono,
    correo,
    codigoReferido: null,
    agenteId: null,
    origen: "admin",
    aprobadoPor: null,
    tarjeta: validada.tarjeta,
  });
  if (!creado.ok) return responder({ ok: false, codigo: "rechazado", motivo: creado.motivo }, 400);

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("id")
    .eq("rancho_id", creado.creado.ranchoId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!programa?.id) return responder({ ok: false, codigo: "rechazado", motivo: "El negocio se creó pero no encontramos su tarjeta." }, 500);

  return responder({ ok: true, rancho_id: creado.creado.ranchoId, programa_id: String(programa.id), slug: creado.creado.slug });
}
