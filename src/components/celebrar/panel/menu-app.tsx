"use client";

import { RUTA } from "@/lib/celebrar/rutas";
import {
  IconoAlbumes,
  IconoCelebraciones,
  IconoConfiguracion,
  IconoCorporativo,
  IconoCreditos,
  IconoCrear,
  IconoInicio,
  IconoInvitados,
  IconoPlantillas,
  IconoRsvp,
} from "../iconos-celebrar";
import { EnlaceCelebrar, useRutaActual } from "../rutas-cliente";

type Item = {
  a: string;
  texto: string;
  Icono: (p: { className?: string }) => React.JSX.Element;
  /** Marca el ítem activo también en sus subrutas (`/app/celebraciones/…`). */
  prefijo?: boolean;
};

/** El menú del panel, en el orden del brief (sección 31). */
export const ITEMS_MENU: readonly Item[] = [
  { a: RUTA.app, texto: "Inicio", Icono: IconoInicio },
  { a: RUTA.appCelebraciones, texto: "Mis celebraciones", Icono: IconoCelebraciones, prefijo: true },
  { a: RUTA.appCrear, texto: "Crear invitación", Icono: IconoCrear },
  { a: RUTA.appPlantillas, texto: "Plantillas", Icono: IconoPlantillas },
  { a: RUTA.appCreditos, texto: "Precios y pagos", Icono: IconoCreditos },
  { a: RUTA.appAlbumes, texto: "Álbumes", Icono: IconoAlbumes },
  { a: RUTA.appInvitados, texto: "Invitados", Icono: IconoInvitados },
  { a: RUTA.appPartner, texto: "Partners", Icono: IconoCorporativo, prefijo: true },
  { a: RUTA.appConfiguracion, texto: "Configuración", Icono: IconoConfiguracion },
];

/** Lo que solo ve el equipo de CELEBRAR (perfiles.rol = admin). */
export const ITEMS_ADMIN: readonly Item[] = [
  { a: RUTA.appAdminCreditos, texto: "Admin · Créditos", Icono: IconoRsvp },
  { a: RUTA.appAdminPartners, texto: "Admin · Partners", Icono: IconoCorporativo },
  { a: RUTA.appAdminDiseno, texto: "Admin · Diseño", Icono: IconoPlantillas },
];

function estaActivo(item: Item, actual: string): boolean {
  if (item.a === actual) return true;
  return !!item.prefijo && actual.startsWith(`${item.a}/`);
}

export function tituloDeLaSeccion(actual: string): string {
  return [...ITEMS_MENU, ...ITEMS_ADMIN].find((i) => estaActivo(i, actual))?.texto ?? "Panel";
}

/**
 * El rail del panel. En escritorio es la columna izquierda, siempre
 * visible. En el teléfono se vuelve un `<details>` con la sección
 * actual como resumen, que despliega la MISMA lista debajo, en el flujo
 * de la página — el patrón de los paneles del sitio (nunca un overlay
 * de pantalla completa).
 */
export default function MenuApp({ variante, esAdmin = false }: { variante: "rail" | "movil"; esAdmin?: boolean }) {
  const actual = useRutaActual();
  // El rail va sobre marino (letra clara); el selector del teléfono, sobre blanco.
  const oscuro = variante === "rail";
  const items = esAdmin ? [...ITEMS_MENU, ...ITEMS_ADMIN] : ITEMS_MENU;

  const lista = (
    <ul className="grid gap-1">
      {items.map((item) => {
        const activo = estaActivo(item, actual);
        return (
          <li key={item.a}>
            <EnlaceCelebrar
              a={item.a}
              aria-current={activo ? "page" : undefined}
              className={`c-montserrat flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${
                oscuro
                  ? activo
                    ? "bg-(--c-marino-medio) font-semibold text-(--c-blanco)"
                    : "font-medium text-(--c-sobre-marino-suave) hover:bg-(--c-marino-medio) hover:text-(--c-blanco)"
                  : activo
                    ? "bg-(--c-celeste) font-semibold text-(--c-marino)"
                    : "font-medium text-(--c-tinta-suave) hover:bg-(--c-hielo) hover:text-(--c-tinta)"
              }`}
            >
              <item.Icono className="h-5 w-5 shrink-0" />
              {item.texto}
            </EnlaceCelebrar>
          </li>
        );
      })}
    </ul>
  );

  if (variante === "rail") {
    return <nav aria-label="Secciones del panel">{lista}</nav>;
  }

  return (
    <details className="group rounded-2xl border border-(--c-linea) bg-(--c-blanco)">
      <summary className="c-montserrat flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[14px] font-semibold text-(--c-tinta) [&::-webkit-details-marker]:hidden">
        {tituloDeLaSeccion(actual)}
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-(--c-tinta-suave) transition-transform duration-(--duracion-micro) ease-(--ease-bookea) group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <nav aria-label="Secciones del panel" className="border-t border-(--c-linea) p-2">
        {lista}
      </nav>
    </details>
  );
}
