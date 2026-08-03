import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Directorio from "./directorio";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import AvisoInvitacionesFlotante from "@/components/aviso-invitaciones-flotante";
import SelectorVertical from "@/components/selector-vertical";
import Planificador from "@/components/planificador/planificador";
import { normalizarCategoria } from "../mi-negocio/types";
import type { Rancho } from "../mi-negocio/types";

export default async function EventosPage() {
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

  const ranchos = ((data ?? []) as (Rancho & { vertical?: string })[])
    // Solo la vertical de eventos: citas y hospedajes tienen su propio
    // directorio. Se filtra acá (no en SQL) para que la página siga
    // viva aunque la migración 0055 no se haya corrido todavía.
    .filter((r) => (r.vertical ?? "eventos") === "eventos")
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
    // El lienzo crema de la línea bento (/lealtad): los bloques de
    // color se recortan encima.
    <div className="min-h-screen overflow-x-clip bg-aventurea-cream-2">
      <SiteHeader breadcrumb="Eventos" />

      <section className="pb-16 pt-4">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-6">
          {/* Sin hero: solo el conmutador de verticales y (abajo, dentro
              del Directorio) el buscador — todo el espacio es para las
              cards. El h1 queda para lectores de pantalla y SEO. */}
          <h1 className="sr-only">Todo para tu evento — directorio nacional</h1>
          <div className="mb-4">
            <SelectorVertical activo="eventos" />
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

      {/* Cotizador guiado "Asistente Boki": se abre por hash (#boki)
          desde el chip de la barra de categorías del directorio. */}
      <Planificador
        ranchos={ranchos}
        fechasOcupadas={fechasOcupadas}
        calificaciones={calificaciones}
        favoritosIniciales={favoritosIniciales}
        sesionActiva={!!user}
      />

      {/* La venta cruzada suave también acá: el directorio de salones es
          donde arranca la búsqueda, no solo la ficha de cada rancho. */}
      <AvisoInvitacionesFlotante />

      {/* El pie chiquito de antes solo decía "BOOKEA — Costa Rica": los
          legales quedaban publicados pero sin que los enlazara nadie.
          El pie del sitio los lleva, y de paso el link de paquetes. */}
      <p className="border-t border-aventurea-line py-6 text-center text-xs text-zinc-500">
        <Link href="/puntaleona-web" className="font-bold text-aventurea-orange">
          Paquetes vacacionales
        </Link>
      </p>
      <SiteFooter />
    </div>
  );
}
