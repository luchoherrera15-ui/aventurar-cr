import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import { LIENZO_PANEL } from "@/components/panel/sistema";
import PanelNavFood from "./panel-nav";
import { salirDelPanelFood } from "./panel-actions";

// Privado: nada de esto le sirve a un buscador. Cubre las cinco
// pantallas del panel (Hoy/Franjas/Menú/Configuración/Check-in), que
// heredan esto salvo que declaren su propia `metadata`.
export const metadata: Metadata = { title: "Panel · FOOD.BOOKEA", robots: { index: false } };

/**
 * EL PANEL DEL RESTAURANTE — todo lo que cuelga de acá exige sesión Y
 * un negocio de FOOD ya creado. `nuevo/` y `login/` viven FUERA de
 * este grupo de rutas a propósito: `nuevo/` necesita sesión pero
 * TODAVÍA NO tiene negocio (este layout lo mandaría en un loop), y
 * `login/` no necesita ninguna de las dos cosas.
 *
 * `LIENZO_PANEL` (el mismo token que usan mi-negocio/lealtad/cuenta):
 * sin esto, las tarjetas blancas de cada pantalla flotaban sobre un
 * fondo también blanco y el panel se leía plano — el mismo problema
 * que el sistema de diseño de paneles ya documentó y resolvió para el
 * resto del sitio.
 */
export default async function PanelFoodLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/food/negocio/login");

  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  return (
    <div className={`min-h-[calc(100vh-64px)] ${LIENZO_PANEL}`}>
      <header className="border-b border-aventurea-line bg-white">
        <div className="mx-auto flex max-w-[900px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="text-[13.5px] font-extrabold tracking-tight text-aventurea-navy">
            Bookea
          </Link>
          <span className="text-aventurea-line">/</span>
          <span className="truncate text-[13.5px] font-bold text-aventurea-ink">{negocio.nombre}</span>
          <div className="flex-1" />
          <form action={salirDelPanelFood}>
            <button
              type="submit"
              className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink-soft transition-colors hover:border-aventurea-navy hover:text-aventurea-navy"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
        <p className="text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
          FOOD.BOOKEA — panel
        </p>
        <h1 className="mt-1 text-xl font-bold text-aventurea-ink">{negocio.nombre}</h1>
        {!negocio.activo && (
          <p className="mt-2 inline-block rounded-lg bg-red-50 px-3 py-1.5 text-[12.5px] font-bold text-red-700">
            Tu negocio está apagado — no lo ve el público. Prendelo en Configuración.
          </p>
        )}

        <div className="mt-5">
          <PanelNavFood />
        </div>

        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
