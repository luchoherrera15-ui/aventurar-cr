import type { SupabaseClient } from "@supabase/supabase-js";
import { generarSlugUnico } from "@/lib/slug";
import { apagarModulosOperativos } from "./solo-lealtad";

/**
 * CONVERTIR UNA SOLICITUD DE ALTA EN UN NEGOCIO DE VERDAD.
 *
 * Una fila de `solicitudes_lealtad` SIN rancho es una solicitud de ALTA
 * (0130): el negocio todavía no existe y lo único que hay es el nombre,
 * el tipo y lo que la persona armó en el creador. Este archivo es el
 * único lugar donde esa fila se vuelve un negocio.
 *
 * ------------------------------------------------------------------
 * POR QUÉ VIVE ACÁ Y NO EN EL PANEL DE ADMIN
 * ------------------------------------------------------------------
 * Hasta hoy solo había UNA forma de que un alta se concretara: un
 * administrador tocaba «Aceptar» en /admin/complementos. Desde que se
 * puede pagar con tarjeta hay DOS —la otra es el webhook de Stripe
 * confirmando el cobro— y las dos tienen que producir exactamente el
 * mismo negocio.
 *
 * Copiar y pegar los ochenta renglones habría hecho que el día que se
 * agregue un paso al alta (una tabla nueva, un default distinto) uno de
 * los dos caminos se quede atrás, y el que se quedaría atrás es
 * justamente el que nadie mira: el del webhook, que corre sin nadie
 * delante.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTA FUNCIÓN NO HACE
 * ------------------------------------------------------------------
 * No marca la solicitud, no enciende el complemento `lealtad` (0077) y
 * no decide si el alta corresponde. Eso es de quien llama: el admin lo
 * hace con su `requireAdmin`, y el webhook solo después de que Stripe
 * firmó el cobro. Acá adentro no hay ninguna autorización — quien la
 * llama ya decidió.
 *
 * Siempre con la LLAVE DE SERVICIO: crea un rancho a nombre de otra
 * persona y le escribe `lealtad_aprobado_en`, que el trigger
 * `ranchos_proteger_aprobacion_lealtad` (0129) le niega a cualquier
 * sesión que no sea admin.
 */

/** Las verticales que un rancho puede tener de verdad. */
const VERTICALES_REALES = ["citas", "eventos", "hospedajes", "restaurantes"];

export type ResultadoAlta = { ok: true; ranchoId: string } | { ok: false; motivo: string };

export async function crearNegocioDesdeSolicitud(
  db: SupabaseClient,
  /**
   * La fila cruda de `solicitudes_lealtad`. Se recibe cruda a propósito:
   * quien la lee usa `select *` porque las columnas de la 0130 pueden no
   * existir todavía en la base, y un tipo estricto acá obligaría a
   * prometer columnas que la migración quizá no corrió.
   */
  solicitud: Record<string, unknown>,
  opciones: {
    /** El admin que aceptó. null = lo aceptó el sistema (cobro de Stripe). */
    aprobadoPor: string | null;
    /** El paquete con el que nace. null = lo escribe quien llama, después. */
    plan: string | null;
  },
): Promise<ResultadoAlta> {
  const nombre = ((solicitud.negocio_nombre as string | null) ?? "").trim();
  if (!nombre) return { ok: false, motivo: "La solicitud de alta no trae nombre de negocio." };

  const ownerId = (solicitud.solicitante_id as string | null) ?? null;
  if (!ownerId) return { ok: false, motivo: "La solicitud de alta no dice de quién es." };

  // 'otro' no es una vertical real: el rancho nace como 'citas' (no se
  // publica en ningún directorio, así que solo es el eje operativo) y la
  // respuesta original queda registrada en la solicitud.
  const verticalCruda = (solicitud.negocio_vertical as string | null) ?? "otro";
  const vertical = VERTICALES_REALES.includes(verticalCruda) ? verticalCruda : "citas";

  const slug = await generarSlugUnico(db, nombre);
  const { data: nuevo, error } = await db
    .from("ranchos")
    .insert({
      owner_id: ownerId,
      nombre,
      slug,
      vertical,
      categoria: "otros",
      estado: "pendiente",
      // Aceptar el alta ES la aprobación de lealtad (0129): no tendría
      // sentido volver a ponerlo en hold recién nacido.
      lealtad_aprobado_en: new Date().toISOString(),
      lealtad_aprobado_por: opciones.aprobadoPor,
      ...(opciones.plan ? { plan_lealtad: opciones.plan } : {}),
    })
    .select("id")
    .single();

  if (error || !nuevo) {
    return { ok: false, motivo: "No se pudo crear el negocio: " + (error?.message ?? "") };
  }
  const ranchoId = nuevo.id as string;

  // Nace SOLO para lealtad: sin agenda, catálogo, equipo ni finanzas —
  // el dueño enciende lo que quiera después.
  await apagarModulosOperativos(db, ranchoId);
  await armarProgramaInicial(db, ranchoId, solicitud);

  return { ok: true, ranchoId };
}

/**
 * EL PROCESO AUTOMÁTICO: si la solicitud vino del CREADOR (o sea, no es
 * personalizada), el programa nace FUNCIONANDO con lo que la persona
 * armó — color, logo, regalía y meta de sellos.
 *
 * Un fallo acá NO tumba el alta: el negocio ya existe y lo peor que
 * pasa es que el dueño configure la tarjeta él mismo. Por eso todo
 * queda en el log y nada lanza.
 */
async function armarProgramaInicial(
  db: SupabaseClient,
  ranchoId: string,
  solicitud: Record<string, unknown>,
): Promise<void> {
  const regalia = (solicitud.regalia as string | null) ?? null;
  const metaSellos = (solicitud.meta_sellos as number | null) ?? null;
  if (solicitud.personalizado === true || !regalia || !metaSellos) return;

  const { data: prog, error: eProg } = await db
    .from("programa_lealtad")
    .insert({
      rancho_id: ranchoId,
      nombre: "Programa de lealtad",
      modo: "sellos",
      puntos_por_visita: 1,
      puntos_por_colon: 0,
      activo: true,
      estado: "activo",
      pase_color_fondo: (solicitud.pase_color as string | null) ?? null,
      pase_logo_url: (solicitud.pase_logo_url as string | null) ?? null,
    })
    .select("id")
    .single();

  if (eProg || !prog) {
    console.error("[alta] El programa no se pudo auto-crear:", eProg?.message);
    return;
  }

  const { error: eRec } = await db.from("recompensas").insert({
    programa_id: prog.id,
    nombre: regalia,
    costo_puntos: metaSellos,
    activo: true,
  });
  if (eRec) console.error("[alta] La recompensa no se pudo auto-crear:", eRec.message);
}
