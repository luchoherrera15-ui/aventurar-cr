import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { vinculoConFoorkie } from "@/lib/plataforma/foorkie";
import {
  beneficioEditado,
  cambioElBeneficio,
  copiarImagenDeFoorkie,
  leerEdicionDeFoorkie,
  leerPedidoFirmado,
  MOTIVO_DISENO,
  programaParaFoorkie,
  responder,
  selloEditado,
  sitioDeBookea,
  tiraParaGuardar,
  UUID,
} from "@/lib/plataforma/foorkie-api";
import { puedeEditarse } from "@/lib/lealtad/editable";
import { estadoDelPrograma } from "@/lib/lealtad/reglas";
import { leerBeneficio, metaDe, tipoDe, type ConfigSellos } from "@/lib/lealtad/tipos-tarjeta";
import { acumulacionDe } from "@/lib/lealtad/mostrador";
import { traducirError } from "@/lib/lealtad/errores-base";
import { avisarCambioDeDiseno } from "@/lib/wallet/aviso-de-diseno";
import { refrescarClaseGoogle } from "@/lib/wallet/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/programa/guardar — el panel de Foorkie
 * cambia la tarjeta de un local: los colores, el logo, la banda, el
 * beneficio (% del cashback, o meta y regalía de los sellos) y, desde oct
 * 2026, el dibujo del sello y la tira. Ver `foorkie-api.ts`.
 *
 *   { rancho_id, programa_id,
 *     cambios: { colorFondo?, colorSello?, logoUrl?, bannerUrl?, beneficio?,
 *                iconoSello?, iconoUrl?, diseno? } }
 *   firmado en `x-foorkie-firma`
 *
 *   iconoSello: null (el logo) | uno de los doce | "propio" — solo en
 *     tarjetas de sellos; en otro tipo se ignora (como el alta).
 *   iconoUrl: URL de `foorkie_media` (se copia, PNG/JPG/WebP ≤ 2 MB), la
 *     que ya tiene (se deja) o null (se saca). "propio" sin archivo → 400.
 *   diseno: `ConfigTira` entera (saneada: lo que falta, clásico) o null =
 *     el diseño por defecto.
 *
 *   200 { ok: true, cambio, programa: {...} }  (`programa.diseno` trae
 *     también `iconoSello`, `iconoUrl` y `tira`: lo guardado)
 *   400 datos/motivo · 403 no_vinculado · 404 sin_programa · 409 no_editable · 401 firma · 503
 *
 * Escribe lo mismo que el panel de Bookea (`guardarPrograma` y
 * `guardarBeneficio` en pases-actions.ts), con las mismas reglas, y avisa
 * igual a los pases ya instalados: Apple (`avisarCambioDeDiseno`) y la
 * clase de Google (`refrescarClaseGoogle`), después de responder.
 */
export async function POST(request: Request) {
  // 6000: tres URLs de hasta 600 caracteres (logo, banda, ícono), la tira y
  // el beneficio entran holgados (~3 000 en el peor caso).
  const pedido = await leerPedidoFirmado(request, 6000);
  if (!pedido.ok) return pedido.respuesta;
  const ranchoId = typeof pedido.datos.rancho_id === "string" ? pedido.datos.rancho_id : "";
  const programaId = typeof pedido.datos.programa_id === "string" ? pedido.datos.programa_id : "";
  if (!UUID.test(ranchoId) || !UUID.test(programaId)) return responder({ ok: false, codigo: "datos" }, 400);
  const leida = leerEdicionDeFoorkie(pedido.datos.cambios);
  if (!leida.ok) return responder({ ok: false, codigo: "datos", motivo: leida.motivo }, 400);
  const e = leida.edicion;

  const db = createAdminClient();
  if (!db) return responder({ ok: false, codigo: "no_configurado" }, 503);

  const vinculo = await vinculoConFoorkie(db, ranchoId, programaId);
  if (!vinculo) return responder({ ok: false, codigo: "no_vinculado" }, 403);

  // `select *`: hay columnas de diseño que una base sin migrar no tiene.
  const { data: fila0 } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("id", programaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!fila0) return responder({ ok: false, codigo: "sin_programa" }, 404);
  const fila = fila0 as Record<string, unknown>;

  // El mismo candado que el panel de Bookea: una tarjeta archivada no se edita.
  const tipo = tipoDe(typeof fila.modo === "string" ? fila.modo : null);
  const { count: miembros } = await db
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("programa_id", programaId);
  const editable = puedeEditarse({
    miembros: miembros ?? 0,
    estado: estadoDelPrograma({ estado: typeof fila.estado === "string" ? fila.estado : null, activo: fila.activo === true }),
    tipo,
  });
  if (!editable.puede) return responder({ ok: false, codigo: "no_editable", motivo: editable.motivo }, 409);

  // Solo lo que de verdad cambia: cada cambio le llega a todos los pases instalados.
  const cambios: Record<string, unknown> = {};
  const textoDe = (v: unknown) => (typeof v === "string" ? v : null);

  // Los colores se comparan sin mayúsculas: el selector del navegador los manda en minúscula.
  if (e.colorFondo && (textoDe(fila.pase_color_fondo) ?? "").toUpperCase() !== e.colorFondo) {
    cambios.pase_color_fondo = e.colorFondo;
  }
  if (e.colorSello && (textoDe(fila.pase_color_sello) ?? "").toUpperCase() !== e.colorSello) {
    cambios.pase_color_sello = e.colorSello;
  }

  // Las imágenes: la que ya tiene se deja, null la saca y una de Foorkie se COPIA a Bookea.
  const imagenes = [
    ["logoUrl", "pase_logo_url", "logo"],
    ["bannerUrl", "pase_banner_url", "banda"],
  ] as const;
  for (const [campo, columna, destino] of imagenes) {
    const v = e[campo];
    if (v === undefined) continue;
    const actual = textoDe(fila[columna]);
    if (v === null) {
      if (actual) cambios[columna] = null;
      continue;
    }
    if (v === actual) continue;
    const copiada = await copiarImagenDeFoorkie(db, v, destino);
    if (copiada === "error") {
      return responder(
        {
          ok: false,
          codigo: "datos",
          motivo: `${destino === "logo" ? "El logo" : "La banda"} no se pudo usar: tiene que ser una imagen PNG, JPG o WebP de hasta 4 MB.`,
        },
        400,
      );
    }
    cambios[columna] = copiada;
  }

  // El dibujo del sello (0145/0174). Solo las tarjetas de sellos tienen
  // círculos donde dibujarlo: en otro tipo se ignora —ni se copia el
  // archivo—, la misma decisión que `validarTarjetaDeAlta`.
  if (tipo === "sellos" && (e.iconoSello !== undefined || e.iconoUrl !== undefined)) {
    const urlGuardada = textoDe(fila.pase_sello_icono_url);
    let url = e.iconoUrl;
    if (typeof url === "string" && url !== urlGuardada) {
      const copiada = await copiarImagenDeFoorkie(db, url, "icono");
      if (copiada === "error") return responder({ ok: false, codigo: "datos", motivo: MOTIVO_DISENO.copia }, 400);
      url = copiada;
    }
    const sello = selloEditado({ actual: { icono: fila.pase_sello_icono, url: urlGuardada }, icono: e.iconoSello, url });
    if (!sello.ok) return responder({ ok: false, codigo: "datos", motivo: sello.motivo }, 400);
    if (sello.icono !== textoDe(fila.pase_sello_icono)) cambios.pase_sello_icono = sello.icono;
    if (sello.url !== urlGuardada) cambios.pase_sello_icono_url = sello.url;
  }

  // La tira (0212): entera, saneada; null = el clásico (`{}` en la columna).
  if (e.diseno !== undefined) {
    const tira = tiraParaGuardar(fila.pase_diseno, e.diseno);
    if (tira.cambia) cambios.pase_diseno = tira.valor;
  }

  // El beneficio, completo y validado como en el panel de Bookea.
  let sellosNuevos: ({ tipo: "sellos" } & ConfigSellos) | null = null;
  if (e.beneficio) {
    const actual = leerBeneficio(fila.beneficio, tipo);
    const r = beneficioEditado(actual, tipo, e.beneficio);
    if (!r.ok) return responder({ ok: false, codigo: "datos", motivo: r.motivo }, 400);
    if (cambioElBeneficio(actual, r.beneficio)) {
      cambios.beneficio = r.beneficio;
      if (r.beneficio.tipo === "cashback") {
        // Las dos columnas que el motor LEE al acreditar (`acreditar_lealtad`): el 5% son 0.05 por colón.
        const a = acumulacionDe(r.beneficio);
        cambios.puntos_por_visita = a.porVisita;
        cambios.puntos_por_colon = a.porColon;
      }
      // En sellos la tasa se conserva (puede dar 2 por visita), igual que `guardarBeneficio`.
      if (r.beneficio.tipo === "sellos") sellosNuevos = r.beneficio;
    }
  }

  const base = sitioDeBookea(request);
  if (Object.keys(cambios).length === 0) {
    return responder({ ok: true, cambio: false, programa: await programaParaFoorkie(db, ranchoId, programaId, base) });
  }

  const { error } = await db.from("programa_lealtad").update(cambios).eq("id", programaId).eq("rancho_id", ranchoId);
  if (error) return responder({ ok: false, codigo: "rechazado", motivo: traducirError(error, "guardar la tarjeta") }, 400);

  const fallaMeta = sellosNuevos ? await sincronizarMetaDeSellos(db, programaId, sellosNuevos) : null;

  // Todo lo que se cambia acá se DIBUJA: los pases ya instalados se enteran después de responder.
  after(() => avisarCambioDeDiseno(programaId));
  after(async () => {
    const r = await refrescarClaseGoogle(ranchoId, programaId);
    if (!r.ok) console.warn(`[google-wallet] no se refrescó la clase de ${ranchoId}/${programaId}: ${r.motivo}`);
  });
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath(`/admin/lealtad/${ranchoId}`);

  const programa = await programaParaFoorkie(db, ranchoId, programaId, base);
  if (fallaMeta) return responder({ ok: false, codigo: "rechazado", motivo: fallaMeta, programa }, 500);
  return responder({ ok: true, cambio: true, programa });
}

/**
 * La META de los sellos vive en la RECOMPENSA activa más barata (de ahí
 * la saca el pase): cambiar «10 sellos = Café» por «8 sellos = Postre»
 * mueve las dos cosas, como `sincronizarMetaDeSellos` de pases-actions.ts.
 */
async function sincronizarMetaDeSellos(
  db: SupabaseClient,
  programaId: string,
  beneficio: { tipo: "sellos" } & ConfigSellos,
): Promise<string | null> {
  const meta = metaDe(beneficio);
  const nombre = beneficio.recompensa.trim();
  if (meta === null || !nombre) return null;
  const costo = Math.max(1, Math.round(meta));

  const { data: actuales } = await db
    .from("recompensas")
    .select("id, nombre, costo_puntos")
    .eq("programa_id", programaId)
    .eq("activo", true)
    .order("costo_puntos", { ascending: true })
    .limit(1);
  const vigente = (actuales ?? [])[0] as { id: string; nombre: string; costo_puntos: number } | undefined;
  if (vigente && vigente.nombre === nombre && Number(vigente.costo_puntos) === costo) return null;

  const { error } = vigente
    ? await db.from("recompensas").update({ nombre, costo_puntos: costo }).eq("id", vigente.id).eq("programa_id", programaId)
    : await db.from("recompensas").insert({ programa_id: programaId, nombre, costo_puntos: costo, activo: true });
  return error ? traducirError(error, "guardar la regalía") : null;
}
