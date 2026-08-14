import { NextResponse } from "next/server";
import { verificarAccesoOperativo } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";
import { motivoParaNoGastar } from "@/lib/ia/config-ia";
import {
  leerAgendaDeFotos,
  leerAgendaDeTexto,
  MAX_FOTOS,
  type ImagenAgenda,
  type NegocioAgenda,
  type ResultadoLectura,
} from "@/lib/ia/leer-agenda";
import type { VerticalAgenda } from "@/lib/agenda/importar-agenda";

/**
 * Lectura de agenda con IA — el add-on de pago.
 *
 * Va en un Route Handler y no en una server action porque las
 * acciones topan en 1 MB de cuerpo y una página de agenda fotografiada
 * pesa más que eso. Acá el límite lo ponemos nosotros.
 *
 * Este endpoint SOLO LEE: devuelve filas propuestas y no escribe ni
 * una reserva. Guardar es otro paso, gratuito, y pasa por la revisión
 * del dueño (guardarLoteAgenda).
 *
 * Cuatro puertas antes de gastar un token:
 *   1. Sesión válida y dueño (o admin) de ese negocio.
 *   2. El add-on `agenda_ia` activo y vigente — se consulta con la
 *      llave de servicio, nunca con lo que diga el navegador.
 *   3. La IA encendida y el tope de gasto del mes sin alcanzar.
 *   4. Tamaño y cantidad de imágenes dentro de lo razonable.
 */

/** Tope de payload: ~12 MB de base64 ≈ 9 MB de fotos. */
const MAX_BYTES_BASE64 = 12_000_000;
const MEDIA_VALIDOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type CuerpoLectura = {
  ranchoId?: unknown;
  modo?: unknown;
  fotos?: unknown;
  texto?: unknown;
  contexto?: unknown;
};

export async function POST(request: Request) {
  let cuerpo: CuerpoLectura;
  try {
    cuerpo = (await request.json()) as CuerpoLectura;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const ranchoId = typeof cuerpo.ranchoId === "string" ? cuerpo.ranchoId : "";
  if (!ranchoId) {
    return NextResponse.json({ error: "Falta el negocio." }, { status: 400 });
  }

  // 1. ¿Es suyo?
  const { supabase, user, ok } = await verificarAccesoOperativo(ranchoId);
  if (!user) {
    return NextResponse.json({ error: "Iniciá sesión." }, { status: 401 });
  }
  if (!ok) {
    return NextResponse.json({ error: "No encontramos tu publicación." }, { status: 403 });
  }

  // La CATEGORÍA viaja junto con la vertical porque dentro de Eventos
  // decide si el negocio agenda por fecha (un lugar) o por horas (un
  // proveedor), y de eso depende qué se le pide leer al modelo.
  const { data: rancho } = await supabase
    .from("ranchos")
    .select("vertical, categoria")
    .eq("id", ranchoId)
    .maybeSingle();
  const negocio: NegocioAgenda = {
    vertical: ((rancho?.vertical as string) || "eventos") as VerticalAgenda,
    categoria: (rancho?.categoria as string | null) ?? null,
  };

  // 2. ¿Tiene el add-on? (con la llave de servicio, no con la sesión)
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta la configuración del servidor." }, { status: 500 });
  }
  const { data: tieneAddon } = await admin.rpc("tiene_addon", {
    p_rancho_id: ranchoId,
    p_addon: "agenda_ia",
  });
  if (tieneAddon !== true) {
    return NextResponse.json(
      {
        error:
          "La lectura con IA es un complemento de pago. Podés cargar tu agenda a mano sin costo.",
        addonRequerido: "agenda_ia",
      },
      { status: 402 },
    );
  }

  // 3. ¿La plataforma está en condiciones de gastar? (IA apagada o tope
  //    del mes alcanzado). Se avisa antes de llamar al modelo, no después.
  const motivo = await motivoParaNoGastar();
  if (motivo) {
    return NextResponse.json({ error: motivo }, { status: 503 });
  }

  const modo = cuerpo.modo === "texto" ? "texto" : "foto";
  const hoy = hoyISOCR();
  const contexto = typeof cuerpo.contexto === "string" ? cuerpo.contexto : undefined;

  let resultado: ResultadoLectura;
  const registrarFallo = async (mensaje: string) => {
    await admin.from("importaciones_agenda").insert({
      rancho_id: ranchoId,
      metodo: modo === "texto" ? "ia_texto" : "ia_foto",
      filas_propuestas: 0,
      filas_guardadas: 0,
      error: mensaje.slice(0, 500),
    });
  };

  try {
    if (modo === "texto") {
      const texto = typeof cuerpo.texto === "string" ? cuerpo.texto : "";
      if (texto.trim().length < 10) {
        return NextResponse.json({ error: "Pegá el texto de la agenda." }, { status: 400 });
      }
      resultado = await leerAgendaDeTexto(texto, negocio, hoy, {
        ranchoId,
        usuarioId: user.id,
      });
    } else {
      // 4. Validar las imágenes antes de gastar un token.
      const crudas = Array.isArray(cuerpo.fotos) ? cuerpo.fotos : [];
      if (crudas.length === 0) {
        return NextResponse.json({ error: "Subí al menos una foto." }, { status: 400 });
      }
      if (crudas.length > MAX_FOTOS) {
        return NextResponse.json(
          { error: `Máximo ${MAX_FOTOS} fotos por vez. Subilas por tandas.` },
          { status: 400 },
        );
      }

      const fotos: ImagenAgenda[] = [];
      let total = 0;
      for (const c of crudas) {
        if (typeof c !== "object" || c === null) continue;
        const { mediaType, datos } = c as { mediaType?: unknown; datos?: unknown };
        if (typeof mediaType !== "string" || !MEDIA_VALIDOS.has(mediaType)) {
          return NextResponse.json(
            { error: "Formato de imagen no soportado. Usá JPG, PNG o WebP." },
            { status: 400 },
          );
        }
        if (typeof datos !== "string" || datos.length === 0) {
          return NextResponse.json({ error: "Una de las fotos llegó vacía." }, { status: 400 });
        }
        total += datos.length;
        if (total > MAX_BYTES_BASE64) {
          return NextResponse.json(
            { error: "Las fotos pesan demasiado. Subí menos por vez o bajales la resolución." },
            { status: 413 },
          );
        }
        fotos.push({ mediaType, datos });
      }

      resultado = await leerAgendaDeFotos(fotos, negocio, hoy, contexto, {
        ranchoId,
        usuarioId: user.id,
      });
    }
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No se pudo leer la agenda.";
    await registrarFallo(mensaje);
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }

  // Bitácora: es lo que después permite facturar el add-on por consumo.
  await admin.from("importaciones_agenda").insert({
    rancho_id: ranchoId,
    metodo: modo === "texto" ? "ia_texto" : "ia_foto",
    filas_propuestas: resultado.filas.length,
    filas_guardadas: 0,
    modelo: resultado.modelo,
    tokens_input: resultado.tokensInput,
    tokens_output: resultado.tokensOutput,
    costo_usd: resultado.costoUsd,
    tiempo_ms: resultado.tiempoMs,
  });

  // Al navegador no le importa el costo interno: solo las filas.
  return NextResponse.json({
    filas: resultado.filas,
    resumen: resultado.resumen,
    leidas: resultado.filas.length,
  });
}
