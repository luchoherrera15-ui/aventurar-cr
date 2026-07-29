import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import BookingCalendar from "./booking-calendar";
import { NOMBRE_RANCHO_BOOKEAR } from "@/app/ranchos-eventos/constants";
import type { DiaDisponibilidad, PrecioTier, ServicioAdicional } from "./types";
import type { HorarioBloqueConfig, ModalidadPrecioLugar, PromocionDia } from "@/app/mi-rancho/types";

export default async function EventosSalonPage() {
  const supabase = await createClient();

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id, deposito_reserva, tarifa_diciembre_por_persona, modalidad_precio_lugar, precio_hora_lugar, precio_fijo_lugar, terminos, monto_minimo, horarios_bloques, foto_url, descripcion, sinpe_numero, sinpe_titular, cuenta_banco, cuenta_numero, cuenta_titular, cuenta_tipo, capacidad_max")
    .eq("nombre", NOMBRE_RANCHO_BOOKEAR)
    .maybeSingle();

  if (!rancho) notFound();

  // Limpieza oportunista: borra holds temporales ya vencidos antes de
  // calcular qué fechas están disponibles.
  await supabase
    .from("reservas")
    .delete()
    .eq("rancho_id", rancho.id)
    .eq("estado", "temporal")
    .lt("expira_en", new Date().toISOString());

  const [dispRes, tiersRes, svcRes, promoRes] = await Promise.all([
    supabase
      .from("disponibilidad_rancho")
      .select("fecha, estado")
      .eq("rancho_id", rancho.id),
    supabase
      .from("precio_tiers")
      .select("min_invitados, max_invitados, precio")
      .eq("rancho_id", rancho.id)
      .order("min_invitados", { ascending: true }),
    supabase
      .from("servicios_adicionales")
      .select("id, nombre, precio, requisito_max_invitados")
      .eq("rancho_id", rancho.id)
      .eq("activo", true),
    supabase
      .from("promociones_dia")
      .select("*")
      .eq("rancho_id", rancho.id)
      .eq("activo", true),
  ]);

  const disponibilidad: Record<string, DiaDisponibilidad> = {};
  (dispRes.data ?? []).forEach((r) => {
    const dia = disponibilidad[r.fecha] ?? {
      confirmada: false,
      pendientes: 0,
      temporales: 0,
    };
    if (r.estado === "confirmada") dia.confirmada = true;
    else if (r.estado === "temporal") dia.temporales += 1;
    else dia.pendientes += 1;
    disponibilidad[r.fecha] = dia;
  });

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader
        breadcrumb="Rancho de Eventos"
        ancho="max-w-[1080px]"
        extra={
          <nav className="hidden items-center gap-6 sm:flex">
            <Link href="/ranchos-eventos" className="text-[13.5px] text-aventurea-ink-soft hover:text-aventurea-navy">
              Inicio
            </Link>
            <a href="#reservar" className="text-[13.5px] text-aventurea-ink-soft hover:text-aventurea-navy">
              Reservar
            </a>
            <a href="#rancho" className="text-[13.5px] text-aventurea-ink-soft hover:text-aventurea-navy">
              El rancho
            </a>
          </nav>
        }
      />

      <BookingCalendar
        ranchoId={rancho.id}
        nombreRancho="Bookea · Rancho de Eventos"
        disponibilidad={disponibilidad}
        tiers={(tiersRes.data ?? []) as PrecioTier[]}
        servicios={(svcRes.data ?? []) as ServicioAdicional[]}
        tarifaDiciembre={rancho.tarifa_diciembre_por_persona ?? 3750}
        depositoReserva={rancho.deposito_reserva ?? 25000}
        modalidadPrecio={(rancho.modalidad_precio_lugar as ModalidadPrecioLugar) ?? "rango_personas"}
        precioHora={(rancho.precio_hora_lugar as number | null) ?? null}
        precioFijo={(rancho.precio_fijo_lugar as number | null) ?? null}
        promociones={(promoRes.data ?? []) as PromocionDia[]}
        terminos={(rancho.terminos as string[] | null) ?? []}
        montoMinimo={(rancho.monto_minimo as number | null) ?? null}
        horarios={(rancho.horarios_bloques as HorarioBloqueConfig[] | null) ?? []}
        capacidadMax={(rancho.capacidad_max as number | null) ?? null}
        sinpeNumero={(rancho.sinpe_numero as string | null) ?? null}
        sinpeTitular={(rancho.sinpe_titular as string | null) ?? null}
        cuentaBanco={(rancho.cuenta_banco as string | null) ?? null}
        cuentaNumero={(rancho.cuenta_numero as string | null) ?? null}
        cuentaTitular={(rancho.cuenta_titular as string | null) ?? null}
        cuentaTipo={(rancho.cuenta_tipo as string | null) ?? null}
        descripcion={(rancho.descripcion as string | null) ?? null}
      />

      <section id="rancho" className="py-16">
        <div className="mx-auto max-w-[1080px] px-7">
          <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
            El espacio
          </p>
          <h2 className="mt-2.5 text-[27px] font-bold text-aventurea-ink">
            Lo que incluye el rancho
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-4.5 sm:grid-cols-2 md:grid-cols-3">
            {[
              ["Piscina", "Para el disfrute de los invitados durante el evento."],
              ["Parrilla para asar", "Zona de parrilla disponible para el catering del evento."],
              ["Área techada", "Rancho principal cubierto para la celebración."],
              ["Parqueo privado", "Espacio para los vehículos de los invitados."],
              ["Zona natural", "Jardines y entorno natural para fotografías y ambientación."],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5"
              >
                <h3 className="text-[15px] font-bold text-aventurea-ink">{title}</h3>
                <p className="mt-1.5 text-[12.5px] text-aventurea-ink-soft">{desc}</p>
              </div>
            ))}
            <div className="relative rounded-2xl border border-aventurea-orange/40 bg-aventurea-surface p-5">
              <span className="absolute right-4 top-4 rounded-full bg-aventurea-orange/15 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-aventurea-orange">
                Costo adicional
              </span>
              <h3 className="text-[15px] font-bold text-aventurea-ink">
                Hospedaje (chalets)
              </h3>
              <p className="mt-1.5 text-[12.5px] text-aventurea-ink-soft">
                Disponible solo en ciertos casos, sujeto a disponibilidad. Se
                elige como servicio adicional al reservar.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-500">
          BOOKEA — Costa Rica ·{" "}
          <Link href="/ranchos-eventos" className="font-bold text-aventurea-orange">
            Volver al inicio
          </Link>
        </p>
      </footer>
    </div>
  );
}
