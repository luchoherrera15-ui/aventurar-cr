import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Directorio from "./directorio";
import AccionesSesion from "@/components/acciones-sesion";
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

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-10">
          <Link href="/ranchos-eventos" className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aventurea-orange text-[14.5px] font-bold text-white">
              B
            </span>
            <span className="whitespace-nowrap text-[15px] font-bold text-aventurea-ink sm:text-base">
              BOOKEAR CR
            </span>
            <span className="hidden text-zinc-500 sm:inline">/</span>
            <span className="hidden text-[13px] font-light text-aventurea-ink-soft sm:inline">
              Eventos
            </span>
          </Link>
          <AccionesSesion compacto />
        </div>
      </header>

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

          <Directorio ranchos={ranchos} />
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
