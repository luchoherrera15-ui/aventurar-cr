import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATALOGO_LABEL, normalizarCategoria } from "../../types";
import AsistentePanel from "./asistente-panel";
import type { ConocimientoFila } from "./actions";

/**
 * "Tu asistente": la pantalla donde el dueño se entera de que hay un
 * asistente contestando por él en el chat, decide si lo quiere y le
 * enseña sus propias respuestas.
 *
 * Se lee el rancho con select("*") a propósito: si la migración 0078
 * todavía no se corrió, pedir asistente_activo por nombre tumbaría la
 * pantalla entera en vez de mostrar el aviso de migración pendiente.
 */
export default async function AsistenteConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) notFound();

  // Mismo control de acceso que el panel: el dueño siempre, y un admin
  // que entra a ayudar en nombre del proveedor.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  if (rancho.owner_id !== user.id && perfil?.rol !== "admin") notFound();

  const datos = rancho as Record<string, unknown>;
  const nombre = typeof datos.nombre === "string" ? datos.nombre : "tu negocio";
  const slug = typeof datos.slug === "string" ? datos.slug : null;
  const categoria = normalizarCategoria(
    typeof datos.categoria === "string" ? datos.categoria : null,
  );
  const activoInicial =
    typeof datos.asistente_activo === "boolean" ? datos.asistente_activo : null;
  const instrucciones =
    typeof datos.asistente_instrucciones === "string" ? datos.asistente_instrucciones : "";

  // La misma regla que aplica el asistente del chat (src/lib/asistente-ia.ts):
  // toda la categoría Lugares más los slugs del piloto. Se calcula acá para
  // poder decirle al dueño qué hace HOY su opción "por defecto".
  const slugsPiloto = (process.env.ASISTENTE_IA_SLUGS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const porDefectoActivo =
    categoria === "lugares" || (!!slug && slugsPiloto.includes(slug));

  const { data: conocimientoData, error: errorConocimiento } = await supabase
    .from("conocimiento_negocio")
    .select("id, pregunta, respuesta, activo, orden")
    .eq("rancho_id", id)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  const conocimiento = (conocimientoData ?? []) as ConocimientoFila[];
  const faltaMigracion = !!errorConocimiento || !("asistente_activo" in datos);

  const esLugar = categoria === "lugares";
  const etiquetaCatalogo = CATALOGO_LABEL[categoria];

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-12">
      <Link
        href={`/mi-rancho/${id}`}
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Volver al panel de {nombre}
      </Link>

      <h1 className="mt-4 text-[22px] font-bold text-aventurea-ink">Tu asistente</h1>
      <p className="mt-2 max-w-[70ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        Cuando un cliente te escribe por el chat de Bookea, el asistente le
        contesta al instante con los datos de {nombre} — a cualquier hora, sin
        que vos tengás que estar pendiente. Sus respuestas salen con el
        prefijo <span className="font-bold text-aventurea-ink">🤖</span> para que
        el cliente sepa que todavía no hablaste vos.
      </p>
      <p className="mt-2 max-w-[70ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        Podés meterte en la conversación cuando querás desde{" "}
        <Link href="/mensajes" className="font-bold text-aventurea-navy underline">
          Mensajes
        </Link>
        : apenas escribís vos, el asistente se hace a un lado y la conversación
        sigue siendo tuya.
      </p>

      {faltaMigracion && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
          <strong>Falta la migración del asistente.</strong> Corré{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
            supabase/migrations/0078_panel_ia.sql
          </code>{" "}
          en el SQL Editor de Supabase y volvé a entrar. Mientras tanto no se
          puede guardar nada de esta pantalla.
        </div>
      )}

      <div className="mt-8">
        <AsistentePanel
          ranchoId={id}
          activoInicial={activoInicial}
          porDefectoActivo={porDefectoActivo}
          instruccionesInicial={instrucciones}
          conocimientoInicial={conocimiento}
        />
      </div>

      {/* El aviso más importante de la pantalla: qué puede y qué NO puede
          decir. Va al final porque se lee después de configurar, pero con
          marco propio para que no pase por decoración. */}
      <section className="mt-8 rounded-2xl border border-aventurea-navy/25 bg-aventurea-navy/5 p-5">
        <h2 className="text-[15px] font-bold text-aventurea-ink">
          Qué puede decir el asistente (y qué no)
        </h2>
        <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
          Solo repite lo que vos cargaste: tu perfil, tus precios, tu{" "}
          {etiquetaCatalogo.toLowerCase()}, tus condiciones y las respuestas de
          esta pantalla. <strong className="text-aventurea-ink">Nunca inventa</strong>{" "}
          precios, descuentos ni disponibilidad de fechas: cuando le preguntan
          algo que no está cargado, dice que no lo sabe y avisa que vos
          respondés por el mismo chat. Si querés que conteste mejor, la vía es
          llenar tus datos — no pedirle que adivine.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/mi-rancho/${id}?tab=editar`}
            className="rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2 text-[12.5px] font-bold text-aventurea-ink hover:border-aventurea-navy hover:text-aventurea-navy"
          >
            Perfil y fotos
          </Link>
          {!esLugar && (
            <Link
              href={`/mi-rancho/${id}?tab=catalogo`}
              className="rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2 text-[12.5px] font-bold text-aventurea-ink hover:border-aventurea-navy hover:text-aventurea-navy"
            >
              {etiquetaCatalogo}
            </Link>
          )}
          <Link
            href={`/mi-rancho/${id}?tab=precios`}
            className="rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2 text-[12.5px] font-bold text-aventurea-ink hover:border-aventurea-navy hover:text-aventurea-navy"
          >
            {esLugar ? "Precios y condiciones" : "Cobros y condiciones"}
          </Link>
        </div>
      </section>
    </main>
  );
}
