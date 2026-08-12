import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import PasesPanel from "@/app/lealtad/panel/[id]/pases-panel";
import type { ProgramaFila, RecompensaFila } from "@/app/lealtad/panel/[id]/pases-actions";

/**
 * El EDITOR del programa de lealtad de un negocio — dentro del sitio de
 * administración, porque nadie genera sus pases salvo Bookea: el
 * negocio solicita (con su depósito), acá se arma.
 *
 * La puerta la pone el layout del dashboard (solo admins) y la
 * refuerzan las server actions de pases-actions, que exigen admin de
 * plataforma por su cuenta: llegar a la URL sin serlo pinta la
 * pantalla pero no puede guardar nada.
 */

export const metadata = { title: "Configurar programa de lealtad · Admin" };

export default async function AdminLealtadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin) {
    return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{FALTA_SERVICE_KEY}</p>;
  }

  const { data: rancho } = await admin
    .from("ranchos")
    .select("id, nombre, slug, plan_lealtad")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) notFound();

  const [{ data: programa }, { data: cercania }] = await Promise.all([
    admin.from("programa_lealtad").select("*").eq("rancho_id", id).maybeSingle(),
    admin.rpc("tiene_addon", { p_rancho_id: id, p_addon: "pases_cercania" }),
  ]);

  const { data: recompensas } = programa
    ? await admin
        .from("recompensas")
        .select("*")
        .eq("programa_id", (programa as ProgramaFila).id)
        .order("costo_puntos", { ascending: true })
    : { data: [] };

  return (
    <div>
      <div className="mb-6">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Lealtad · Configuración
        </p>
        <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">{rancho.nombre}</h1>
        <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
          Plan: {(rancho.plan_lealtad as string | null) ?? "sin plan"} ·{" "}
          <Link href={`/lealtad/panel/${id}`} className="font-bold underline">
            ver el panel como lo ve el negocio
          </Link>
          {rancho.slug ? (
            <>
              {" · "}
              <Link href={`/tarjeta/${rancho.slug}`} className="font-bold underline">
                la tarjeta del cliente
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <PasesPanel
        ranchoId={id}
        programaInicial={(programa ?? null) as ProgramaFila | null}
        recompensasIniciales={(recompensas ?? []) as RecompensaFila[]}
        tieneCercania={cercania === true}
      />
    </div>
  );
}
