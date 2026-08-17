import { abrirContexto, responder } from "@/lib/lealtad/api/contexto";
import { nombreDelNegocio, nombreDelPrograma } from "@/lib/lealtad/api/datos";
import { serializarYo } from "@/lib/lealtad/api/respuestas";

/**
 * GET /api/lealtad/v1/yo — «¿quién soy y qué me dejaron hacer?»
 *
 * El primer endpoint que llama cualquiera que integra: confirma que la
 * llave sirve, dice a qué negocio y a qué tarjeta pertenece, y lista
 * los scopes. No pide scope propio porque no devuelve nada de nadie:
 * es la credencial mirándose al espejo.
 *
 * También es la forma de que un integrador descubra que le falta un
 * permiso ANTES de escribir el código que lo necesita.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(pedido: Request) {
  const apertura = await abrirContexto(pedido, { ruta: "/yo", scope: null });
  if (!apertura.ok) return apertura.respuesta;
  const { ctx } = apertura;

  const [negocio, programa] = await Promise.all([nombreDelNegocio(ctx), nombreDelPrograma(ctx)]);

  const { data: llave } = await ctx.db
    .from("llaves_api_lealtad")
    .select("expira_en")
    .eq("id", ctx.llaveId)
    .maybeSingle();

  return responder(
    ctx,
    serializarYo({
      desarrollador: ctx.desarrollador,
      entorno: ctx.entorno,
      scopes: ctx.scopes,
      negocio,
      programa,
      expiraEn: (llave?.expira_en as string | null) ?? "",
      requestId: ctx.requestId,
    }),
    200,
    { userAgent: pedido.headers.get("user-agent") },
  );
}
