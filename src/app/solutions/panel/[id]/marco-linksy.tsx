import type { ReactNode } from "react";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
import { BarraLinksy, NavLinksy, type ItemNavLinksy, type NegocioEnBarra } from "./nav-linksy";
import { LP_BAJADA, LP_TITULO } from "./sistema-linksy";

/**
 * EL MARCO DE LAS PÁGINAS PROPIAS DEL PANEL (Ventas, Lealtad, Instagram).
 *
 * Es el mismo chrome que el shell con pestañas —barra arriba, menú a
 * la izquierda—, montado desde el servidor alrededor de una página que
 * tiene su propia ruta. Así «Ventas en línea» o «Instagram» no se
 * sienten como salir del panel: el menú sigue ahí, con la sección
 * encendida. Antes cada una tenía un «← Volver al panel» chiquito y
 * ningún menú.
 */
export default function MarcoLinksy({
  negocio,
  items,
  activo,
  titulo,
  bajada,
  accion,
  ancho = "normal",
  children,
}: {
  negocio: NegocioEnBarra;
  items: ItemNavLinksy[];
  activo: string;
  titulo: string;
  bajada?: string;
  /** Un botón o píldora a la derecha del título. */
  accion?: ReactNode;
  /** «amplio»: el contenido usa todo el ancho (tableros con columnas). */
  ancho?: "normal" | "amplio";
  children: ReactNode;
}) {
  return (
    <main className={`linksy linksy-panel min-h-svh bg-[var(--linksy-fondo-panel)] text-[var(--linksy-tinta)] print:bg-white ${CLASES_FUENTES}`}>
      <BarraLinksy negocio={negocio} />
      <div className={`mx-auto grid gap-5 px-3 py-5 print:block print:p-0 sm:px-5 lg:gap-7 lg:py-7 ${ancho === "amplio" ? "w-[min(1600px,100%)]" : "w-[min(1440px,100%)]"} lg:grid-cols-[292px_minmax(0,1fr)]`}>
        <aside className="min-w-0 print:hidden lg:sticky lg:top-[92px] lg:self-start">
          <NavLinksy items={items} activo={activo} />
        </aside>
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1 print:hidden">
            <div>
              <h1 className={LP_TITULO}>{titulo}</h1>
              {bajada && <p className={`mt-2 ${LP_BAJADA}`}>{bajada}</p>}
            </div>
            {accion}
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
