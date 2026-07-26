import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Directorio from "./directorio";
import { normalizarCategoria } from "../mi-rancho/types";
import type { Rancho } from "../mi-rancho/types";

export default async function RanchosEventosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("estado", "aprobado")
    .order("created_at", { ascending: true });

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
              A
            </span>
            <span className="whitespace-nowrap text-[15px] font-bold text-aventurea-ink sm:text-base">
              AVENTUREA CR
            </span>
            <span className="hidden text-zinc-500 sm:inline">/</span>
            <span className="hidden text-[13px] font-light text-aventurea-ink-soft sm:inline">
              Eventos
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/mi-rancho/login"
              className="whitespace-nowrap rounded-lg px-2.5 py-2 text-[12px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange sm:px-4 sm:text-[12.5px]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/publicar"
              className="whitespace-nowrap rounded-lg border border-aventurea-line bg-aventurea-surface px-2.5 py-2 text-[12px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange sm:px-4 sm:text-[12.5px]"
            >
              Publicá tu salón
            </Link>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden py-7 pb-16">
        {/* Manchas suaves del mismo tratamiento que /publicar, para que el
            directorio no quede como una hoja en blanco detrás de las cards. */}
        {/* Van difuminadas y no con borde duro como en /publicar: acá el
            contenido arranca de una y una línea cruzando las pestañas del
            menú se leería como un error de render. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-[12%] -top-[30%] h-[820px] w-[820px] rounded-full bg-aventurea-navy-3/[0.16] blur-[110px]" />
          <div className="absolute -left-[16%] top-[4%] h-[640px] w-[640px] rounded-full bg-aventurea-green/[0.13] blur-[110px]" />
          <div className="absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b from-aventurea-navy-3/[0.05] to-transparent" />
        </div>

        <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
          <div className="mb-7 max-w-[54ch]">
            <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
              Encontrá tu lugar
            </p>
            <h1 className="mt-1.5 text-[30px] font-bold tracking-tight text-aventurea-orange-dark sm:text-[38px]">
              Eventos
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
              Salones, ranchos, catering, animación y todo lo que necesitás para
              tu evento, en todo el país.
            </p>
          </div>

          <Directorio ranchos={ranchos} />
        </div>
      </section>

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-500">
          AVENTUREA CR — Costa Rica ·{" "}
          <Link href="/puntaleona-web" className="font-bold text-aventurea-orange">
            Paquetes vacacionales
          </Link>
        </p>
      </footer>
    </div>
  );
}
