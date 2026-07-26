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
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-5 px-7 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aventurea-orange text-[14.5px] font-bold text-zinc-950">
              A
            </span>
            <span className="text-base font-bold text-aventurea-ink">AVENTUREA CR</span>
            <span className="text-zinc-600">/</span>
            <span className="text-[13px] font-light text-aventurea-ink-soft">
              Salones para Eventos
            </span>
          </Link>
          <Link
            href="/mi-rancho/registro"
            className="rounded-full border border-aventurea-line bg-white px-4 py-2 text-[12.5px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
          >
            Publicá tu salón
          </Link>
        </div>
      </header>

      <section className="py-9 pb-16">
        <div className="mx-auto max-w-[1080px] px-7">
          <div className="mb-6.5 max-w-[640px]">
            <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
              Directorio nacional
            </p>
            <h1 className="mt-2.5 text-[28px] font-bold text-aventurea-orange-dark sm:text-[32px]">
              Salones para Eventos
            </h1>
            <p className="mt-2.5 text-[14.5px] text-aventurea-ink-soft">
              Todos los salones y ranchos para eventos de Costa Rica, en un
              solo lugar. Explorá y filtrá por provincia, cantidad de
              invitados o presupuesto.
            </p>
          </div>

          <Directorio ranchos={ranchos} />
        </div>
      </section>

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-500">
          AVENTUREA CR — Puntarenas, Costa Rica ·{" "}
          <Link href="/" className="font-bold text-aventurea-orange">
            Volver al inicio
          </Link>
        </p>
      </footer>
    </div>
  );
}
