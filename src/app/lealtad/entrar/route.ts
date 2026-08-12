import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A dónde cae alguien después de entrar por `/lealtad/login`.
 *
 * La gracia de tener una puerta aparte es no aterrizar en el panel
 * general: si el usuario tiene UN solo negocio con el programa, se va
 * derecho a su pestaña de lealtad. Con varios, al listado para elegir.
 *
 * No es una pantalla, es un desvío: por eso vive como route handler y
 * no como page — no tiene nada que mostrar.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(pedido: Request) {
  const base = new URL(pedido.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/lealtad/login", base));

  // Los negocios que administra: propios y donde es colaborador.
  const [{ data: propios }, { data: colaboraciones }] = await Promise.all([
    supabase.from("ranchos").select("id").eq("owner_id", user.id),
    supabase.from("rancho_colaboradores").select("rancho_id").eq("usuario_id", user.id),
  ]);

  const ids = [
    ...((propios ?? []) as { id: string }[]).map((r) => r.id),
    ...((colaboraciones ?? []) as { rancho_id: string }[]).map((r) => r.rancho_id),
  ];

  if (ids.length === 0) {
    // Tiene cuenta pero ningún negocio: lo útil es explicarle el
    // producto, no dejarlo en un panel vacío.
    return NextResponse.redirect(new URL("/lealtad", base));
  }

  // Cuáles de esos tienen el complemento. Va con la llave de servicio
  // porque `addons_negocio` no le da lectura a nadie más (0077).
  const admin = createAdminClient();
  let conPrograma = ids;

  if (admin) {
    const { data: activos } = await admin
      .from("addons_negocio")
      .select("rancho_id, vence_en")
      .in("rancho_id", ids)
      .eq("addon", "lealtad")
      .eq("activo", true);

    const ahora = Date.now();
    conPrograma = ((activos ?? []) as { rancho_id: string; vence_en: string | null }[])
      .filter((a) => !a.vence_en || new Date(a.vence_en).getTime() > ahora)
      .map((a) => a.rancho_id);
  }

  if (conPrograma.length === 0) {
    // Tiene negocios pero ninguno lo contrató: la página de venta le
    // dice cómo conseguirlo, que es exactamente lo que necesita.
    return NextResponse.redirect(new URL("/lealtad", base));
  }

  if (conPrograma.length === 1) {
    return NextResponse.redirect(
      new URL(`/mi-negocio/${conPrograma[0]}?tab=pases`, base),
    );
  }

  // Con varios no se adivina: que elija.
  return NextResponse.redirect(new URL("/mi-negocio", base));
}
