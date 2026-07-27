import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Directorio from "./directorio";
import SiteHeader from "@/components/site-header";
import { normalizarCategoria } from "../mi-rancho/types";
import type { Rancho } from "../mi-rancho/types";

export default async function RanchosEventosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("estado", "aprobado")
    // Los más nuevos primero: mezcla todas las categorías en el frente
    // en vez de amontonar ahí a los lugares (los primeros que existieron
    // en la plataforma), y los sitios viejos se corren solos hacia las
    // páginas siguientes conforme se publican otros.
    .order("created_at", { ascending: false });

  const ranchos = ((data ?? []) as Rancho[]).map((r) => ({
    ...r,
    categoria: normalizarCategoria(r.categoria),
  }));

  // Solo "lugares" reserva por fecha en línea — el resto se contrata por
  // WhatsApp, sin calendario. Traemos de una sola vez qué fechas ya están
  // confirmadas para poder filtrar por "Cuándo" sin una consulta por card.
  const { data: confirmadas } = await supabase
    .from("disponibilidad_rancho")
    .select("rancho_id, fecha")
    .eq("estado", "confirmada");

  const fechasOcupadas = (confirmadas ?? []) as { rancho_id: string; fecha: string }[];

  // Calificación real (Fase 1): si un proveedor todavía no tiene
  // reseñas, la tarjeta simplemente no muestra estrellas — nunca un
  // número inventado.
  const { data: calificacionesData } = await supabase
    .from("calificaciones_rancho")
    .select("rancho_id, promedio, total");

  const calificaciones = (calificacionesData ?? []) as {
    rancho_id: string;
    promedio: number;
    total: number;
  }[];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let favoritosIniciales: string[] = [];
  if (user) {
    const { data: favData } = await supabase
      .from("favoritos")
      .select("rancho_id")
      .eq("cliente_id", user.id);
    favoritosIniciales = (favData ?? []).map((f) => f.rancho_id as string);
  }

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Eventos" />

      <section className="py-8 pb-16">
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
          <div className="mb-7">
            <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
              Directorio nacional
            </p>
            <h1 className="titulo mt-2 text-[34px] text-aventurea-orange-dark sm:text-[44px]">
              Todo para tu evento
            </h1>
          </div>

          <Directorio
            ranchos={ranchos}
            fechasOcupadas={fechasOcupadas}
            calificaciones={calificaciones}
            favoritosIniciales={favoritosIniciales}
            sesionActiva={!!user}
          />
        </div>
      </section>

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-500">
          BOOKEAR CR — Costa Rica ·{" "}
          <Link href="/puntaleona-web" className="font-bold text-aventurea-orange">
            Paquetes vacacionales
          </Link>
        </p>
      </footer>
    </div>
  );
}
