import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta, horaCorta, type FoodReservationEstado } from "@/lib/food/tipos";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

export const metadata: Metadata = { title: "Mis reservas · FOOD.BOOKEA", robots: { index: false } };

const ESTADO_LABEL: Record<FoodReservationEstado, string> = {
  confirmada: "Confirmada",
  check_in: "Ya fuiste",
  no_show: "No te presentaste",
  cancelada: "Cancelada",
};

type Fila = {
  id: string;
  codigo_confirmacion: string;
  party_size: number;
  estado: FoodReservationEstado;
  food_franjas: { fecha: string; hora: string } | { fecha: string; hora: string }[] | null;
  food_businesses: { nombre: string } | { nombre: string }[] | null;
};

/**
 * "MIS RESERVAS DE FOOD" — el hueco que la auditoría marcó como el más
 * serio del circuito de cliente: antes de esto, la única confirmación
 * vivía en /food/reserva/[id] y solo se alcanzaba en el instante
 * posterior a reservar. Si alguien cerraba la pestaña, no tenía
 * ninguna forma de recuperar su código.
 *
 * La política RLS "El cliente ve sus reservas de FOOD" (0190) ya
 * permite esta consulta tal cual — no hizo falta ningún cambio de
 * esquema ni de permisos para esta pantalla.
 */
export default async function MisReservasFoodPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  const { data, error } = await supabase
    .from("food_reservations")
    .select("id, codigo_confirmacion, party_size, estado, food_franjas(fecha, hora), food_businesses(nombre)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) console.error("[food/mis-reservas] no se pudo cargar:", error.message);

  const reservas = (data ?? []) as Fila[];

  return (
    <>
      <SiteHeader breadcrumb="FOOD.BOOKEA" />
      <main className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
        <p className="text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
          FOOD.BOOKEA
        </p>
        <h1 className="mt-2 text-2xl font-bold text-aventurea-ink sm:text-3xl">Mis reservas</h1>

        {reservas.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-aventurea-line-fuerte bg-white px-6 py-12 text-center">
            <p className="text-[15px] font-bold text-aventurea-ink">Todavía no reservaste ninguna mesa</p>
            <p className="mx-auto mt-1.5 max-w-[420px] text-[13.5px] text-aventurea-ink-soft">
              <Link href="/food" className="font-bold text-aventurea-navy underline">
                Buscá un restaurante
              </Link>{" "}
              y reservá tu horario con descuento.
            </p>
          </div>
        ) : (
          <ul className="mt-8 flex flex-col gap-3">
            {reservas.map((r) => {
              const franja = Array.isArray(r.food_franjas) ? r.food_franjas[0] : r.food_franjas;
              const negocio = Array.isArray(r.food_businesses) ? r.food_businesses[0] : r.food_businesses;
              return (
                <li key={r.id}>
                  <Link
                    href={`/food/reserva/${r.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-aventurea-line bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-bold text-aventurea-ink">{negocio?.nombre ?? "Restaurante"}</p>
                      {franja && (
                        <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                          {fechaCorta(franja.fecha)} · {horaCorta(franja.hora)} · {r.party_size}{" "}
                          {r.party_size === 1 ? "persona" : "personas"}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-lg bg-aventurea-cream-2 px-2.5 py-1 text-[11.5px] font-bold text-aventurea-ink-soft">
                      {ESTADO_LABEL[r.estado] ?? r.estado}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] font-bold text-aventurea-navy">
                      {r.codigo_confirmacion}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
