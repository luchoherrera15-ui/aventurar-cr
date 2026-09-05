import { createAdminClient } from "@/lib/supabase/admin";
import { addonsDeVarios, type EstadoAddons } from "@/lib/solutions/addons";
import { urlDelNegocio } from "@/lib/solutions/tipos";
import { estadoDominioDe } from "@/lib/solutions/tipos";
import SolutionsAdminPanel, { type NegocioAdmin } from "./solutions-admin-panel";

export const metadata = { title: "Solutions · Admin" };

/**
 * ════════════════════════════════════════════════════════════════════
 *  /admin/solutions — TODO SOLUTIONS DESDE LA ADMINISTRACIÓN
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (5 sep 2026): «una sección solo de Solutions:
 * lealtad, menús digitales y el link hub. Que yo pueda ponerle el
 * correo a alguien, dejarle el paquete listo y configurárselo».
 *
 * La pantalla arranca por LA LISTA —cada negocio con su dueño, sus
 * add-ons, su dominio y su enlace— y arriba el alta para un cliente.
 * Configurar un negocio ajeno no necesita nada nuevo: el admin de
 * Bookea entra a su panel (`/solutions/panel/<id>`) como dueño, que es
 * lo que `verificarAccesoSolutions` ya decide por `perfiles.rol`.
 *
 * Tope explícito de 500 negocios: PostgREST corta en 1.000 sin avisar,
 * y una lista que corta en silencio miente. Si alguna vez hay más, la
 * pantalla lo dice.
 */
const TOPE = 500;

export default async function SolutionsAdminPage() {
  const admin = createAdminClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-[900px]">
        <p className="text-[15px] font-bold text-red-600">Falta configurar SUPABASE_SERVICE_ROLE_KEY.</p>
      </div>
    );
  }

  const [{ data: filas, count }, { data: platos }, { data: pedidos }] = await Promise.all([
    admin
      .from("solutions_negocios")
      .select("id, nombre, slug, owner_id, publicado, dominio, dominio_estado, origen, creado_en", { count: "exact" })
      .order("creado_en", { ascending: false })
      .limit(TOPE),
    admin.from("solutions_menu_items").select("negocio_id"),
    admin.from("solutions_pedidos").select("negocio_id, estado"),
  ]);

  const negociosCrudos = filas ?? [];
  const ids = negociosCrudos.map((n) => n.id as string);
  const owners = Array.from(new Set(negociosCrudos.map((n) => n.owner_id as string)));

  const [{ data: perfiles }, addons] = await Promise.all([
    owners.length > 0 ? admin.from("perfiles").select("id, email, nombre").in("id", owners) : Promise.resolve({ data: [] }),
    addonsDeVarios(admin, ids),
  ]);
  const perfilPorId = new Map((perfiles ?? []).map((p) => [p.id as string, p]));

  const platosPor = new Map<string, number>();
  for (const p of platos ?? []) platosPor.set(p.negocio_id as string, (platosPor.get(p.negocio_id as string) ?? 0) + 1);
  const vivosPor = new Map<string, number>();
  for (const p of pedidos ?? []) {
    if (p.estado === "nuevo" || p.estado === "preparando" || p.estado === "listo") {
      vivosPor.set(p.negocio_id as string, (vivosPor.get(p.negocio_id as string) ?? 0) + 1);
    }
  }

  const negocios: NegocioAdmin[] = negociosCrudos.map((n) => {
    const perfil = perfilPorId.get(n.owner_id as string);
    const dominioEstado = estadoDominioDe(n.dominio_estado);
    return {
      id: n.id as string,
      nombre: n.nombre as string,
      slug: n.slug as string,
      publicado: n.publicado === true,
      origen: (n.origen as string) === "admin" ? "admin" : "publico",
      creadoEn: n.creado_en as string,
      dueno: { email: (perfil?.email as string | null) ?? "(sin perfil)", nombre: (perfil?.nombre as string | null) ?? null },
      addons: addons[n.id as string] as EstadoAddons,
      dominio: (n.dominio as string | null) ?? null,
      dominioEstado,
      url: urlDelNegocio({ slug: n.slug as string, dominio: (n.dominio as string | null) ?? null, dominio_estado: dominioEstado }),
      platos: platosPor.get(n.id as string) ?? 0,
      pedidosVivos: vivosPor.get(n.id as string) ?? 0,
    };
  });

  return <SolutionsAdminPanel negocios={negocios} total={count ?? negocios.length} tope={TOPE} />;
}
