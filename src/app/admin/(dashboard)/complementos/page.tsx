import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADDONS } from "@/lib/addons";
import ComplementosTabla, { type NegocioComplementos } from "./complementos-tabla";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /admin/complementos — LOS COMPLEMENTOS, Y NADA MÁS
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (27 ago 2026): «sacá lealtad y todo lo que tenga
 * que ver con lealtad de esos complementos, hacé un menú a la
 * izquierda dedicado para LEALTAD».
 *
 * ── LO QUE HABÍA ACÁ ANTES, Y POR QUÉ SE MUDÓ ENTERO ────────────────
 *
 * Esta ruta servía una tabla de DOCE columnas de la que solo UNA era de
 * complementos. Las otras once —Paquete, Clientes, Tarjetas, Vence,
 * Cliente desde, Pase, Auditoría— son de Bookea Lealtad.
 *
 * O sea que la pantalla ERA el panel de Lealtad y el nombre del menú
 * estaba describiendo su columna más chica. Se movió completa a
 * `/admin/lealtad`, que es lo que siempre fue, y acá quedó lo que de
 * verdad responde a la palabra «complemento».
 *
 * ── Y LOS COMPLEMENTOS NO SON DE LEALTAD ────────────────────────────
 *
 * Asistente IA y Agenda con IA los puede tener cualquier negocio del
 * marketplace, tenga o no un programa de lealtad. Meterlos adentro de
 * la pantalla de Lealtad era lo que hacía difícil encontrarlos.
 *
 * ⚠️ `lealtad` y `pases_cercania` SÍ están en el catálogo de
 * `@/lib/addons` y NO se listan acá: esos dos se administran desde
 * `/admin/lealtad`, donde vive el plan que los habilita. Prenderlos
 * desde dos pantallas distintas era pedir que se contradijeran.
 */

/** Los que se administran acá. Ver el ⚠️ de arriba. */
const DE_ESTA_PANTALLA = ADDONS.filter(
  (a) => a.id !== "lealtad" && a.id !== "pases_cercania",
);

export default async function AdminComplementosPage() {
  const admin = createAdminClient();

  if (!admin) {
    return (
      <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        Falta la llave de servicio: sin ella no se pueden leer los complementos.
      </p>
    );
  }

  // Los negocios del marketplace. Los de lealtad quedan fuera a
  // propósito: se administran en su propia pantalla.
  const [{ data: negocios }, { data: filas }] = await Promise.all([
    admin
      .from("ranchos")
      .select("id, nombre, slug, categoria, vertical, estado")
      .neq("en_marketplace", false)
      .order("nombre", { ascending: true }),
    admin.from("addons_negocio").select("rancho_id, addon, activo, vence_en, concepto"),
  ]);

  const porNegocio = new Map<string, NegocioComplementos["addons"]>();
  for (const f of filas ?? []) {
    const lista = porNegocio.get(f.rancho_id as string) ?? [];
    lista.push({
      addon: f.addon as string,
      activo: Boolean(f.activo),
      venceEn: (f.vence_en as string | null) ?? null,
      concepto: (f.concepto as string | null) ?? null,
    });
    porNegocio.set(f.rancho_id as string, lista);
  }

  const lista: NegocioComplementos[] = (negocios ?? []).map((n) => ({
    id: n.id as string,
    nombre: n.nombre as string,
    slug: (n.slug as string | null) ?? null,
    categoria: (n.categoria as string | null) ?? null,
    estado: n.estado as string,
    addons: porNegocio.get(n.id as string) ?? [],
  }));

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Productos de Bookea
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">Complementos</h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
        Qué negocio del marketplace tiene encendido cada complemento.{" "}
        <Link
          href="/admin/lealtad"
          className="font-bold text-aventurea-navy underline underline-offset-2"
        >
          Lealtad y sus pases se administran en su propia sección
        </Link>
        , donde vive el paquete que los habilita.
      </p>

      <ComplementosTabla negocios={lista} catalogo={DE_ESTA_PANTALLA} />
    </div>
  );
}
