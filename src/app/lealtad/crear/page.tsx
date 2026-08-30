import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { sesionDelNavLealtad } from "@/lib/lealtad/sesion-nav";
import { esPlanOfrecido } from "@/lib/lealtad/planes";
import { obtenerHiloVisitante } from "@/lib/ayuda-general/acciones";
import { idDeCuentaDeBookea } from "@/lib/lealtad/personas";
import NavLealtad from "../nav-lealtad";
import ConfiguradorLealtad from "../configurador-lealtad";
import AyudaAlCrear from "../ayuda-al-crear";

/**
 * /lealtad/crear — LA PANTALLA DEDICADA PARA ARMAR EL PASE.
 *
 * Pedido del dueño (ago 2026): que «¡Creá tu pase de lealtad!» lleve a
 * su propia pantalla en vez de desplegar el configurador a mitad de la
 * landing. Armar una tarjeta es una tarea con principio y fin —el
 * mismo criterio que ya usan `/lealtad/panel/[id]/crear` y el editor de
 * tarjeta—: acá no hay secciones de marketing compitiendo por la
 * atención, solo el configurador y la ayuda.
 *
 * Es el MISMO `ConfiguradorLealtad` de siempre (menú → paquetes →
 * editor), con su respaldo en sessionStorage intacto: quien empezó a
 * armar su tarjeta acá y pasa por «Tu cuenta» —que recarga la página
 * entera— vuelve exactamente a este punto, no a la landing.
 *
 * ── LA COLUMNA DE AYUDA (ago 2026) ─────────────────────────────────
 * `AyudaAlCrear` va AL LADO y no debajo, porque el momento en que
 * alguien se traba armando su tarjeta es el mismo minuto en que está
 * mirando el configurador — una caja de ayuda a la que hay que
 * scrollear no la ve quien la necesita. Se corre abajo recién en
 * pantallas donde no cabe (por debajo de `xl`), porque el configurador
 * ya trae su propio mockup de teléfono a la derecha y apretarlo más lo
 * rompe.
 *
 * ── LA IDENTIDAD LA RESUELVE EL SERVIDOR, NO EL COMPONENTE ─────────
 * Mismo criterio exacto que /ayuda (ver la cabecera de esa página):
 * `obtenerHiloVisitante()` decide entre sesión real y cookie
 * `bk_ayuda`, e `idDeCuentaDeBookea` es lo único que distingue una
 * cuenta de verdad de una sesión ANÓNIMA de Supabase — un `!!user` a
 * secas trataría a quien abrió el chat flotante como si tuviera
 * cuenta, que es el bug que ya costó caro una vez.
 */
export const metadata: Metadata = {
  title: "Creá tu pase · Bookea Lealtad",
  description:
    "Armá tu tarjeta de lealtad: elegí el tipo, los colores y la regalía, y mirala en el teléfono antes de crear cuenta.",
  alternates: { canonical: "/lealtad/crear" },
};

export default async function CrearPaseLealtadPage({
  searchParams,
}: {
  /** `?plan=` — quien llega desde /lealtad/planes con un paquete ya
   *  elegido. Mismo criterio de validación que /lealtad/nuevo: nunca
   *  confiar el string crudo, siempre contra `esPlanOfrecido`. */
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planParam } = await searchParams;
  const planPedido = planParam ?? null;
  const planInicial = esPlanOfrecido(planPedido) ? planPedido : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sesion = await sesionDelNavLealtad();

  const sesionActiva = idDeCuentaDeBookea(user) !== null;
  const hiloAyuda = await obtenerHiloVisitante();

  return (
    <main className="min-h-svh bg-[#fbfcff]">
      <NavLealtad autoOcultar logueado={sesion.logueado} nombre={sesion.nombre} />

      <section className="px-5 pb-20 pt-10 sm:px-8">
        <div className="mx-auto w-full max-w-[1560px]">
          <Link
            href="/lealtad"
            className="text-[13px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
          >
            ← Volver a Lealtad
          </Link>

          <div className="mx-auto mt-6 max-w-[54ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              Tu pase, en vivo
            </p>
            <h1 className="titulo mx-auto mt-3 text-[clamp(28px,4.4vw,44px)] leading-[1.08] text-aventurea-navy">
              Armá tu pase y miralo en el teléfono
            </h1>
            <p className="mx-auto mt-3 max-w-[48ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
              Elegí el tipo, los colores y qué se gana. Lo vas viendo mientras lo armás — la
              primera tarjeta es gratis y no pide tarjeta de crédito.
            </p>
          </div>

          <div className="mt-9 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <ConfiguradorLealtad haySesion={!!user} planInicial={planInicial} />
            </div>
            <div className="xl:sticky xl:top-6">
              <AyudaAlCrear hiloInicial={hiloAyuda} sesionActiva={sesionActiva} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
