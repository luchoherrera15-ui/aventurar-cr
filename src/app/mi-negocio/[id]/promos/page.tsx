import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAccesoRancho } from "@/lib/auth";
import { IconChevronLeft } from "@/components/icons";
import PromosPanel, { type PromoFila } from "./promos-panel";

export const metadata = { title: "Promos · Bookea" };

/**
 * LAS PROMOS DEL NEGOCIO.
 *
 * Pantalla propia y no una pestaña del panel, a propósito: las
 * pestañas del panel se arman del catálogo de MÓDULOS, que cambia
 * según el tipo de negocio (una barbería tiene agenda, un salón de
 * eventos no). Las promos las puede publicar cualquiera —un rancho, una
 * barbería, un restaurante—, así que atarlas a un módulo por tipo
 * dejaría a la mitad de los negocios sin poder anunciarse.
 *
 * ── EL PERMISO ─────────────────────────────────────────────────────
 * `verificarAccesoRancho` resuelve dueño-o-admin. Se corta con
 * `notFound()` y no con un "no tenés permiso": a quien no es dueño no
 * se le confirma que ese negocio existe.
 *
 * Las cuatro acciones (`actions.ts`) vuelven a verificar por su cuenta:
 * se invocan por HTTP y no pasan por esta página.
 */
export default async function PromosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-negocio/login");

  const { ok } = await verificarAccesoRancho(id);
  if (!ok) notFound();

  // Con la llave de servicio, igual que el resto del panel: desde la
  // 0155 `authenticated` no tiene permiso de tabla completa sobre
  // `ranchos`, y el control de acceso real ya lo hizo la línea de
  // arriba.
  const { data: rancho } = await (createAdminClient() ?? supabase)
    .from("ranchos")
    .select("id, nombre, estado")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) notFound();

  // TODAS las suyas, vigentes o no: la política del dueño (0189) las
  // deja ver aunque estén vencidas o apagadas — si no, no podría
  // volver a prenderlas.
  const { data, error } = await supabase
    .from("promociones")
    .select(
      "id, titulo, descripcion, foto_url, descuento_porcentaje, precio_antes, precio_ahora, desde, hasta, activa",
    )
    .eq("rancho_id", id)
    .order("creado_en", { ascending: false });

  const promos = (data ?? []) as PromoFila[];

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 lg:py-8">
      <Link
        href={`/mi-negocio/${id}`}
        className="inline-flex items-center gap-1 text-[13px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
      >
        <IconChevronLeft />
        {rancho.nombre}
      </Link>

      <h1 className="titulo mt-2 text-2xl text-aventurea-ink">Promos</h1>
      <p className="mt-1 max-w-[560px] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        Lo que publiques acá sale en la pestaña <strong>Promos</strong> de la app, mezclado con
        las de los demás negocios. Es un anuncio para que la gente entre — no cambia el precio
        de tu catálogo.
      </p>

      {rancho.estado !== "aprobado" && (
        <p
          role="status"
          className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-[13px] font-bold leading-relaxed text-amber-900"
        >
          Tu publicación todavía no está aprobada, así que las promos que crees no se van a ver
          en la app hasta que lo esté. Podés dejarlas listas mientras tanto.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3.5 text-[13px] font-bold leading-relaxed text-red-900"
        >
          No se pudieron leer las promos: {error.message}
        </p>
      )}

      <div className="mt-6">
        <PromosPanel ranchoId={id} promos={promos} />
      </div>
    </div>
  );
}
