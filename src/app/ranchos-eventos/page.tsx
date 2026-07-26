import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Directorio from "./directorio";
import type { Rancho } from "../mi-rancho/types";

export default async function RanchosEventosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("estado", "aprobado")
    .order("created_at", { ascending: true });

  const ranchos = (data ?? []) as Rancho[];

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-10">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aventurea-orange text-[14.5px] font-bold text-white">
              A
            </span>
            <span className="whitespace-nowrap text-[15px] font-bold text-aventurea-ink sm:text-base">
              AVENTUREA CR
            </span>
            <span className="hidden text-zinc-400 sm:inline">/</span>
            <span className="hidden text-[13px] font-light text-aventurea-ink-soft sm:inline">
              Eventos
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/mi-rancho/login"
              className="whitespace-nowrap rounded-full px-2.5 py-2 text-[12px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange sm:px-4 sm:text-[12.5px]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/mi-rancho/registro"
              className="whitespace-nowrap rounded-full border border-aventurea-line bg-aventurea-surface px-2.5 py-2 text-[12px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange sm:px-4 sm:text-[12.5px]"
            >
              Publicá tu salón
            </Link>
          </div>
        </div>
      </header>

      <section className="py-7 pb-16">
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
          <div className="mb-6">
            <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
              Encontrá tu lugar
            </p>
            <h1 className="mt-1.5 text-[26px] font-bold text-aventurea-orange-dark sm:text-[30px]">
              Eventos
            </h1>
          </div>

          <Directorio ranchos={ranchos} />
        </div>
      </section>

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-400">
          AVENTUREA CR — Costa Rica ·{" "}
          <Link href="/" className="font-bold text-aventurea-orange">
            Volver al inicio
          </Link>
        </p>
      </footer>
    </div>
  );
}
