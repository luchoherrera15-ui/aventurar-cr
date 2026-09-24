import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IconoSalir } from "@/components/celebrar/iconos-celebrar";
import MarcaCelebrar from "@/components/celebrar/marca-celebrar";
import MenuApp from "@/components/celebrar/panel/menu-app";
import { ProveedorRutas } from "@/components/celebrar/rutas-cliente";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { MARCA } from "@/lib/celebrar/marca";
import { RUTA } from "@/lib/celebrar/rutas";
import { esAdminCelebrar, prefijoDeLaPeticion, sesionCelebrar } from "@/lib/celebrar/sesion";
import { cerrarSesionCelebrar } from "./acciones-sesion";

export const metadata: Metadata = {
  // Con la plantilla otra vez: un layout que pone `title` como texto
  // suelto pierde la del layout de arriba y las páginas quedan sin marca.
  title: { default: "Mi panel", template: MARCA.plantillaTitulo },
  robots: { index: false, follow: false },
};

/**
 * ══════════════════════════════════════════════════════════════════
 *  EL PANEL DE CELEBRAR — /celebrar/app
 * ══════════════════════════════════════════════════════════════════
 *
 * Detrás de sesión: sin ella, al login de CELEBRAR (nunca al de
 * Bookea) con `next` para volver acá. La sesión se valida con
 * `getUser()` en cada petición del panel; los datos, cuando existan
 * (Fase 2), se leen con el token de la persona y RLS decide.
 *
 * Estructura: rail claro a la izquierda en escritorio (`lg`), que en el
 * teléfono se vuelve un selector desplegable arriba del contenido. Sin
 * el header ni el footer del sitio público: adentro del panel la marca
 * vive en el rail.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const [prefijo, sesion, esAdmin] = await Promise.all([prefijoDeLaPeticion(), sesionCelebrar(), esAdminCelebrar()]);
  if (!sesion) {
    const volver = encodeURIComponent(conPrefijo(RUTA.app, prefijo));
    redirect(`${conPrefijo(RUTA.entrar, prefijo)}?next=${volver}`);
  }

  const iniciales = (sesion.nombre ?? sesion.email ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <ProveedorRutas prefijo={prefijo}>
      <div className="flex min-h-screen flex-1 flex-col bg-(--c-hielo) lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        {/* Rail de escritorio: marino, como un panel profesional */}
        <aside className="sobre-oscuro hidden bg-(--c-marino) text-(--c-blanco) lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-4 lg:py-6">
          <div className="px-2">
            <MarcaCelebrar tono="claro" />
          </div>
          <div className="mt-9 flex-1">
            <MenuApp variante="rail" esAdmin={esAdmin} />
          </div>
          <div className="border-t border-(--c-marino-medio) pt-5">
            <div className="flex items-center gap-3 px-2">
              <Avatar iniciales={iniciales} fotoUrl={sesion.fotoUrl} />
              <div className="min-w-0">
                <p className="c-montserrat truncate text-[13px] font-semibold text-(--c-blanco)">
                  {sesion.nombre ?? "Tu cuenta"}
                </p>
                <p className="truncate text-[12px] text-(--c-sobre-marino-suave)">{sesion.email}</p>
              </div>
            </div>
            <form action={cerrarSesionCelebrar} className="mt-3">
              <button
                type="submit"
                className="c-montserrat flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-(--c-sobre-marino-suave) transition-colors duration-(--duracion-micro) ease-(--ease-bookea) hover:bg-(--c-marino-medio) hover:text-(--c-blanco)"
              >
                <IconoSalir className="h-5 w-5" />
                Cerrar sesión
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Barra superior del teléfono/tableta */}
          <header className="sticky top-0 z-30 border-b border-(--c-linea) bg-(--c-blanco) lg:hidden">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6">
              <MarcaCelebrar tamano="sm" />
              <form action={cerrarSesionCelebrar}>
                <button
                  type="submit"
                  className="c-montserrat flex h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-(--c-tinta-suave)"
                >
                  <IconoSalir className="h-5 w-5" />
                  Salir
                </button>
              </form>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <div className="mb-6 lg:hidden">
              <MenuApp variante="movil" esAdmin={esAdmin} />
            </div>
            {children}
          </main>
        </div>
      </div>
    </ProveedorRutas>
  );
}

function Avatar({ iniciales, fotoUrl }: { iniciales: string; fotoUrl: string | null }) {
  if (fotoUrl) {
    // Foto del proveedor OAuth (Google): dominio ajeno, no pasa por next/image.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      className="c-montserrat flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--c-blanco) text-[13px] font-bold text-(--c-marino)"
    >
      {iniciales}
    </span>
  );
}
