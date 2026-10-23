import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirLaCaja } from "@/lib/plataforma/foorkie-caja";
import { cuerpoDelFallo, impulsosDeLaTarjeta, leerPedidoImpulsos } from "@/lib/plataforma/foorkie-impulsos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/impulsos — los impulsos automáticos de la
 * tarjeta de un local de Foorkie, con todo lo que su pantalla necesita para
 * dibujarse. Ver `src/lib/plataforma/foorkie-impulsos.ts`.
 *
 *   { rancho_id, programa_id }  firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true,
 *         contexto: { programaId, nombrePrograma, nombreNegocio,
 *                     modo: "sellos" | "puntos" | "cashback" | string,
 *                     zona, hoy,               // hoy = AAAA-MM-DD en la zona del negocio
 *                     tieneRecompensa, recompensa: string | null,
 *                     meta: number | null, tarjetaOpera },
 *         impulsos: ImpulsoVista[],   // las columnas de `impulsos_lealtad` + conteo por estado + ultimoEnvio
 *         plantillas: { id, nombre, resumen, disponible, motivo? }[],
 *         catalogo: Catalogo }        // activadores, canales, condiciones, etiquetasOp, variables y topes,
 *                                     // ya resuelto para el tipo de tarjeta y en la voz de Foorkie
 *       Sin funciones: es JSON puro. Ninguna frase nombra a Bookea.
 *
 *   Si no: { ok: false, codigo, motivo } con su status —
 *   403 no_es_de_foorkie   vinculada pero sin la marca `lealtad_por_foorkie`
 *   404 sin_tarjeta · 503 sin_migracion (faltan las tablas de la 0254) · 500 error_base
 *   400 datos · 401 firma · 403 no_vinculado · 503 no_configurado (la puerta)
 *
 * Solo lee.
 */
export async function POST(request: Request) {
  const panel = await abrirLaCaja(request, leerPedidoImpulsos);
  if (!panel.ok) return panel.respuesta;

  const r = await impulsosDeLaTarjeta(panel.db, panel.pedido, panel.duenoId);
  if (!r.ok) return responder(cuerpoDelFallo(r), r.status);
  return responder({ ok: true, contexto: r.contexto, impulsos: r.impulsos, plantillas: r.plantillas, catalogo: r.catalogo });
}
