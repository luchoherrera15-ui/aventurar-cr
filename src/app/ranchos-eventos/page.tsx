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

  const ranchos = ((data ?? []) as Rancho[])
    .map((r) => ({
      ...r,
      categoria: normalizarCategoria(r.categoria),
    }))
    // Los destacados del admin van de primeros, en su orden. Se ordena
    // acá y no en SQL para que la página siga viva aunque la migración
    // 0044 todavía no se haya corrido (sort es estable: el resto
    // conserva el más-nuevo-primero).
    .sort(
      (a, b) => (a.destacado_orden ?? Infinity) - (b.destacado_orden ?? Infinity),
    );

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

  // Una reseña con comentario por proveedor, la más reciente: la
  // tarjeta grande del directorio la muestra como cita, igual que los
  // marketplaces de referencia. Se trae un lote y se queda la primera
  // de cada rancho (PostgREST no hace "primera por grupo").
  const { data: resenasData } = await supabase
    .from("resenas")
    .select("rancho_id, comentario")
    .not("comentario", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);
  const resenaPorRancho: Record<string, string> = {};
  for (const r of (resenasData ?? []) as { rancho_id: string; comentario: string }[]) {
    if (!(r.rancho_id in resenaPorRancho)) resenaPorRancho[r.rancho_id] = r.comentario;
  }

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
          {/* Hero centrado: una sola columna vertebral — kicker, título,
              frase de valor y (justo debajo, dentro del Directorio) el
              buscador. Un eje, no tres. */}
          <div className="mb-2 pt-4 text-center">
            <p className="flex items-center justify-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange after:block after:h-[1.5px] after:w-5 after:bg-aventurea-orange">
              Directorio nacional
            </p>
            <h1 className="titulo mt-3 text-[38px] text-aventurea-ink sm:text-[52px]">
              Todo para tu evento
            </h1>
            <p className="mx-auto mt-3.5 max-w-[46ch] text-balance text-[15px] leading-relaxed text-aventurea-ink-soft sm:text-[16.5px]">
              Lugares, comida, música y todo lo demás — compará opciones
              reales y reservá directo, sin cadenas de WhatsApp.
            </p>
          </div>

          <Directorio
            ranchos={ranchos}
            fechasOcupadas={fechasOcupadas}
            calificaciones={calificaciones}
            resenaPorRancho={resenaPorRancho}
            favoritosIniciales={favoritosIniciales}
            sesionActiva={!!user}
          />
        </div>
      </section>

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-500">
          BOOKEA — Costa Rica ·{" "}
          <Link href="/puntaleona-web" className="font-bold text-aventurea-orange">
            Paquetes vacacionales
          </Link>
        </p>
      </footer>
    </div>
  );
}
