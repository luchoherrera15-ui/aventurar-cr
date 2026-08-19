import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISOCR } from "@/lib/fechas";
import { miNegocioFood } from "@/lib/food/auth";
import { horaCorta } from "@/lib/food/tipos";
import FilaReservaHoy from "./fila-reserva-hoy";

export default async function HoyFoodPage() {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  const supabase = await createClient();
  // hoyISOCR(), no `new Date().toISOString()`: el servidor corre en
  // UTC — entre las 6pm y medianoche hora de Costa Rica, justo la
  // franja de la cena, este panel decía "no hay reservas para hoy"
  // aunque sí las hubiera. Ver src/lib/fechas.ts.
  const hoy = hoyISOCR();

  const { data: reservas, error } = await supabase
    .from("food_reservations")
    .select("id, party_size, estado, codigo_confirmacion, food_franjas!inner(fecha, hora)")
    .eq("business_id", negocio.id)
    .eq("food_franjas.fecha", hoy)
    .order("id");

  if (error) console.error("[food/negocio hoy] no se pudo cargar:", error.message);

  const filas = (reservas ?? [])
    .map((r) => {
      const franja = Array.isArray(r.food_franjas) ? r.food_franjas[0] : r.food_franjas;
      return { ...r, hora: franja?.hora ?? "" };
    })
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const confirmadas = filas.filter((f) => f.estado === "confirmada");
  const conCheckIn = filas.filter((f) => f.estado === "check_in");
  const totalPersonas = filas.reduce((acc, f) => acc + f.party_size, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-aventurea-line bg-white p-4 text-center">
          <p className="text-2xl font-extrabold text-aventurea-ink">{filas.length}</p>
          <p className="text-[11.5px] font-bold text-aventurea-ink-soft">Reservas hoy</p>
        </div>
        <div className="rounded-2xl border border-aventurea-line bg-white p-4 text-center">
          <p className="text-2xl font-extrabold text-aventurea-ink">{totalPersonas}</p>
          <p className="text-[11.5px] font-bold text-aventurea-ink-soft">Personas</p>
        </div>
        <div className="rounded-2xl border border-aventurea-line bg-white p-4 text-center">
          <p className="text-2xl font-extrabold text-aventurea-orange">{conCheckIn.length}</p>
          <p className="text-[11.5px] font-bold text-aventurea-ink-soft">Con check-in</p>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-aventurea-line-fuerte bg-white px-6 py-10 text-center text-[13.5px] text-aventurea-ink-soft">
          No hay reservas para hoy.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((f) => (
            <FilaReservaHoy
              key={f.id}
              negocioId={negocio.id}
              reservaId={f.id}
              hora={horaCorta(f.hora)}
              partySize={f.party_size}
              codigo={f.codigo_confirmacion}
              estado={f.estado}
            />
          ))}
        </ul>
      )}

      {confirmadas.length > 0 && (
        <p className="text-[12px] text-aventurea-ink-soft">
          {confirmadas.length} todavía sin check-in.
        </p>
      )}
    </div>
  );
}
