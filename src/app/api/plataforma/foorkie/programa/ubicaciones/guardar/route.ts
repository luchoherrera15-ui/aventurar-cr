import { after } from "next/server";
import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirElPanel, leerPedidoGuardarUbicaciones } from "@/lib/plataforma/foorkie-panel";
import { guardarUbicacionesDeLaTarjeta } from "@/lib/plataforma/foorkie-ubicaciones";
import { avisarCambioDeDiseno } from "@/lib/wallet/aviso-de-diseno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El refresco de los pases instalados corre después de responder, por tandas.
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/programa/ubicaciones/guardar — Foorkie
 * deja las ubicaciones del aviso por cercanía del negocio de una tarjeta
 * suya (las sucursales con su pin). Ver
 * `src/lib/plataforma/foorkie-ubicaciones.ts`.
 *
 *   { rancho_id, programa_id,
 *     ubicaciones: [{ latitud, longitud, mensaje, nombre? }] }
 *   firmado en `x-foorkie-firma`.
 *
 *   La lista es COMPLETA y REEMPLAZA a las del negocio (vacía = ninguna).
 *   De 0 a 10 (el techo de Apple); latitud −90..90, longitud −180..180;
 *   `mensaje` de 3 a 80 caracteres en una línea (lo que se lee en la
 *   pantalla bloqueada); `nombre` opcional, hasta 80 (sin él, el mensaje).
 *
 *   200 { ok: true, cambio, ubicaciones: [{ latitud, longitud, mensaje, nombre }] }
 *       cómo quedaron; `cambio` = si se escribió algo
 *
 *   Si no: { ok: false, codigo, motivo } con su status —
 *   400 datos               una ubicación fuera de rango, un mensaje corto o largo, más de 10…
 *   400 rechazado           la base no aceptó el cambio (el motivo dice por qué)
 *   403 no_es_de_foorkie    vinculada pero sin la marca `lealtad_por_foorkie`
 *   409 negocio_compartido  el negocio tiene otras tarjetas que no son de
 *                           Foorkie: las ubicaciones son de todo el negocio
 *   503 sin_migracion (falta la 0196) · 500 error_base
 *   401 firma · 403 no_vinculado · 503 no_configurado (la puerta del panel)
 *
 * Si cambió algo, DESPUÉS de responder refresca en silencio los pases
 * instalados de todas las tarjetas del negocio (`avisarCambioDeDiseno`,
 * como un cambio de diseño): el iPhone vuelve a pedir el pase y le llegan
 * las `locations` nuevas. Google Wallet no tiene aviso por cercanía.
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerPedidoGuardarUbicaciones);
  if (!panel.ok) return panel.respuesta;

  const r = await guardarUbicacionesDeLaTarjeta(panel.db, panel.pedido);
  // También si quedó a medias: lo que lleva el pase ya cambió.
  if (r.refrescar.length > 0) {
    const programas = r.refrescar;
    after(async () => {
      for (const programaId of programas) await avisarCambioDeDiseno(programaId);
    });
  }
  if (!r.ok) return responder({ ok: false, codigo: r.codigo, motivo: r.motivo }, r.status);
  return responder({ ok: true, cambio: r.cambio, ubicaciones: r.ubicaciones });
}
