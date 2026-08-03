import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo, escaparHtml, plantillaCampana } from "@/lib/email";
import { enlacesBaja } from "@/lib/correo/baja";
import { filtrarDestinatariosMarketing } from "@/lib/correo/marketing";
import { hoyISOCR } from "@/lib/fechas";
import { agruparClientes, correosSegmento, type ReservaCliente } from "@/lib/crm-citas";

/**
 * El núcleo de las campañas de correo POR NEGOCIO — compartido entre
 * la server action del panel web y el endpoint /api/citas/campanas que
 * usa la app móvil. La autorización (¿es el dueño?) la hace quien
 * llama; acá se reciben un cliente de Supabase YA autenticado como esa
 * persona (la RLS aplica) y su userId para la bitácora.
 *
 * Mismo rigor que las campañas del admin (0082/0083), con ámbito de
 * negocio, y tres frenos:
 *  - Los destinatarios SIEMPRE se derivan de las reservas del negocio
 *    en el servidor — la lista del cliente jamás se confía (sin esto,
 *    cualquier dueño mandaría spam a listas compradas con el remitente
 *    de Bookea).
 *  - Tope de campañas por día y de destinatarios por campaña.
 *  - No repetirle al mismo correo (7 días; 30 si es re-enganche).
 */

const MAX_CAMPANAS_POR_DIA = 3;
const MAX_DESTINATARIOS = 200;
/** Días sin volver a escribirle al mismo correo. */
const FRENO_DIAS_CAMPANA = 7;
const FRENO_DIAS_REENGANCHE = 30;

const TAMANO_LOTE = 10;
const PAUSA_ENTRE_LOTES_MS = 1000;

export type CampanaNegocioInput = {
  tipo: "reenganche" | "campana";
  segmento: "todos" | "inactivos" | "no_show" | "manual";
  asunto: string;
  mensaje: string;
  correos: string[];
};

export type ResultadoCampanaNegocio = {
  error: string | null;
  enviados: number;
  fallidos: number;
  /** Fuera por consentimiento: dados de baja, rebotados o con queja. */
  excluidos: number;
  /** Fuera por el freno "ya le escribiste hace poco". */
  omitidosRecientes: number;
};

export async function enviarCampanaNegocioCore(
  supabase: SupabaseClient,
  userId: string,
  ranchoId: string,
  input: CampanaNegocioInput,
): Promise<ResultadoCampanaNegocio> {
  const sinEnvios = { enviados: 0, fallidos: 0, excluidos: 0, omitidosRecientes: 0 };

  const asunto = (input.asunto ?? "").trim();
  const mensaje = (input.mensaje ?? "").trim();
  if (!asunto || asunto.length > 150) {
    return { error: "El asunto es obligatorio (máximo 150 caracteres).", ...sinEnvios };
  }
  if (!mensaje || mensaje.length > 5000) {
    return { error: "El mensaje es obligatorio (máximo 5000 caracteres).", ...sinEnvios };
  }
  if (!["reenganche", "campana"].includes(input.tipo)) {
    return { error: "Tipo de campaña inválido.", ...sinEnvios };
  }
  if (!["todos", "inactivos", "no_show", "manual"].includes(input.segmento)) {
    return { error: "Segmento inválido.", ...sinEnvios };
  }
  if ((input.correos ?? []).length > 1000) {
    return { error: "Demasiados destinatarios.", ...sinEnvios };
  }

  // Solo negocios publicados mandan correos a clientes.
  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id, nombre, slug, estado")
    .eq("id", ranchoId)
    .maybeSingle();
  if (!rancho) return { error: "No encontramos tu publicación.", ...sinEnvios };
  if (rancho.estado !== "aprobado") {
    return {
      error: "Tu publicación tiene que estar aprobada para mandar campañas.",
      ...sinEnvios,
    };
  }

  // LA REGLA DE ORO: solo se le escribe a clientes REALES del negocio.
  const { data: reservasCrm } = await supabase
    .from("reservas")
    .select("id, fecha, hora_inicio, estado, nombre, correo, whatsapp, cliente_id, monto_total")
    .eq("rancho_id", ranchoId)
    .not("hora_inicio", "is", null)
    .order("fecha", { ascending: false })
    .limit(3000);
  const clientes = agruparClientes((reservasCrm ?? []) as ReservaCliente[], hoyISOCR());

  let correos: string[];
  if (input.segmento === "manual") {
    // Promo individual: el correo elegido tiene que ser de un cliente.
    const universo = new Set(correosSegmento(clientes, "todos"));
    correos = [
      ...new Set(
        (input.correos ?? [])
          .map((c) => String(c).trim().toLowerCase())
          .filter((c) => universo.has(c)),
      ),
    ];
  } else {
    // Segmentos: se recalculan en el servidor — lo que haya mandado el
    // navegador es solo informativo.
    correos = correosSegmento(clientes, input.segmento);
  }
  if (correos.length === 0) {
    return {
      error: "No hay destinatarios válidos: solo podés escribirle a clientes de tu negocio.",
      ...sinEnvios,
    };
  }
  if (correos.length > MAX_DESTINATARIOS) {
    return {
      error: `Máximo ${MAX_DESTINATARIOS} destinatarios por campaña.`,
      ...sinEnvios,
    };
  }

  // La bitácora y los frenos viven del lado del servidor (0094: el
  // dueño no puede escribir esas tablas). Sin service key no hay cómo
  // registrar ni frenar — y sin frenos, no se manda: falla cerrado.
  const admin = createAdminClient();
  if (!admin) {
    return {
      error: "El envío de campañas no está configurado en este entorno.",
      ...sinEnvios,
    };
  }

  // Freno 1: tope de campañas por día (hora de Costa Rica).
  const inicioHoy = `${hoyISOCR()}T00:00:00-06:00`;
  const { count: campanasHoy, error: errorConteo } = await admin
    .from("campanas_negocio")
    .select("id", { count: "exact", head: true })
    .eq("rancho_id", ranchoId)
    .gte("created_at", inicioHoy);
  if (errorConteo) {
    return {
      error: "No se pudo verificar el límite diario: " + errorConteo.message,
      ...sinEnvios,
    };
  }
  if ((campanasHoy ?? 0) >= MAX_CAMPANAS_POR_DIA) {
    return {
      error: `Ya mandaste ${MAX_CAMPANAS_POR_DIA} campañas hoy — el tope diario. Probá mañana.`,
      ...sinEnvios,
    };
  }

  // Freno 2: a quién le escribiste hace poco no se le repite.
  const frenoDias =
    input.tipo === "reenganche" ? FRENO_DIAS_REENGANCHE : FRENO_DIAS_CAMPANA;
  const corte = new Date(Date.now() - frenoDias * 86400000).toISOString();
  const { data: recientes, error: errorRecientes } = await admin
    .from("envios_campana")
    .select("correo")
    .eq("rancho_id", ranchoId)
    .in("correo", correos)
    .gte("created_at", corte);
  if (errorRecientes) {
    return {
      error: "No se pudo verificar el historial de envíos: " + errorRecientes.message,
      ...sinEnvios,
    };
  }
  const yaEscritos = new Set((recientes ?? []).map((r) => r.correo as string));
  const candidatos = correos.filter((c) => !yaEscritos.has(c));
  const omitidosRecientes = correos.length - candidatos.length;
  if (candidatos.length === 0) {
    return {
      error:
        input.tipo === "reenganche"
          ? "A ese cliente ya le escribiste hace poco — mejor esperá unas semanas."
          : "A todos los seleccionados ya les escribiste hace poco.",
      ...sinEnvios,
      omitidosRecientes,
    };
  }

  // Freno 3 (el importante): consentimiento con ámbito de negocio.
  const { permitidos, excluidos, error: errorFiltro } =
    await filtrarDestinatariosMarketing(candidatos, ranchoId);
  if (errorFiltro) {
    return { error: errorFiltro, ...sinEnvios, excluidos, omitidosRecientes };
  }
  if (permitidos.length === 0) {
    return {
      error:
        excluidos > 0
          ? "Los seleccionados están dados de baja o con el correo rebotado."
          : "No quedó ningún destinatario.",
      ...sinEnvios,
      excluidos,
      omitidosRecientes,
    };
  }

  // La bitácora nace ANTES de enviar: si el proceso muere a la mitad,
  // queda el rastro (con conteos en 0) y el freno diario igual cuenta.
  const { data: campana, error: errorCampana } = await admin
    .from("campanas_negocio")
    .insert({
      rancho_id: ranchoId,
      tipo: input.tipo,
      segmento: input.segmento,
      asunto,
      mensaje,
      total_destinatarios: permitidos.length,
      excluidos,
      creado_por: userId,
    })
    .select("id")
    .single();
  if (errorCampana || !campana) {
    return {
      error: "No se pudo registrar la campaña: " + (errorCampana?.message ?? "error"),
      ...sinEnvios,
      excluidos,
      omitidosRecientes,
    };
  }

  // El texto del dueño es texto plano: se escapa y los saltos de línea
  // se vuelven <br>. El HTML se arma POR destinatario (su link de baja).
  const mensajeHtml = escaparHtml(mensaje).replace(/\r?\n/g, "<br>");
  const urlPublica = rancho.slug
    ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat"}/${rancho.slug}`
    : `${process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat"}/citas/${rancho.id}`;

  let enviados = 0;
  let fallidos = 0;
  for (let i = 0; i < permitidos.length; i += TAMANO_LOTE) {
    const lote = permitidos.slice(i, i + TAMANO_LOTE);
    const resultados = await Promise.all(
      lote.map(async (to) => {
        const baja = enlacesBaja(to, ranchoId);
        const r = await enviarCorreo({
          to,
          subject: asunto,
          html: plantillaCampana({
            titulo: escaparHtml(asunto),
            mensajeHtml,
            kicker: escaparHtml(rancho.nombre),
            pie: `${escaparHtml(rancho.nombre)} te escribe a través de Bookea porque visitaste su negocio.`,
            cta: { href: urlPublica, label: "Reservar una cita" },
            bajaUrl: baja?.pagina,
          }),
          bajaOneClickUrl: baja?.oneClick,
        });
        return { to, enviado: r.enviado };
      }),
    );
    const lograron = resultados.filter((r) => r.enviado).map((r) => r.to);
    enviados += lograron.length;
    fallidos += resultados.length - lograron.length;
    // El registro va LOTE por lote, no al final: si el proceso muere a
    // la mitad, lo ya enviado queda anotado y el freno "no repetir al
    // mismo correo" sigue contando esos envíos.
    if (lograron.length > 0) {
      await admin.from("envios_campana").insert(
        lograron.map((correo) => ({
          campana_id: campana.id,
          rancho_id: ranchoId,
          correo,
        })),
      );
    }
    if (i + TAMANO_LOTE < permitidos.length) {
      await new Promise((resolve) => setTimeout(resolve, PAUSA_ENTRE_LOTES_MS));
    }
  }

  await admin
    .from("campanas_negocio")
    .update({ enviados, fallidos })
    .eq("id", campana.id);

  return { error: null, enviados, fallidos, excluidos, omitidosRecientes };
}
