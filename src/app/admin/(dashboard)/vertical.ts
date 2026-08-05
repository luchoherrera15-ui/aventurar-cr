/**
 * Las secciones del panel admin: cada vertical del marketplace
 * (agendas/citas, eventos, hospedajes) se gestiona por aparte —
 * directorio, agenda, reservas y balance — para que los números de
 * una no se mezclen con los de otra. "todas" es la vista combinada.
 *
 * La sección elegida vive en una cookie (COOKIE_SECCION) que fija el
 * conmutador del header y leen todas las páginas del panel.
 */
export type SeccionAdmin =
  | "todas"
  | "citas"
  | "eventos"
  | "hospedajes"
  | "restaurantes";

export const COOKIE_SECCION = "admin_seccion";

export const SECCIONES_ADMIN: { key: SeccionAdmin; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "citas", label: "Agendas y citas" },
  { key: "eventos", label: "Eventos" },
  { key: "hospedajes", label: "Hospedajes" },
  { key: "restaurantes", label: "Restaurantes" },
];

export const SECCION_LABEL: Record<SeccionAdmin, string> = {
  todas: "Todas las secciones",
  citas: "Agendas y citas",
  eventos: "Eventos",
  hospedajes: "Hospedajes",
  restaurantes: "Restaurantes",
};

/** Versión corta para etiquetas en tablas. */
export const SECCION_CORTA: Record<string, string> = {
  citas: "Citas",
  eventos: "Eventos",
  hospedajes: "Hospedajes",
  restaurantes: "Restaurantes",
};

export const SECCION_BADGE: Record<string, string> = {
  citas: "bg-aventurea-navy/10 text-aventurea-navy",
  eventos: "bg-aventurea-sky/15 text-aventurea-orange",
  hospedajes: "bg-aventurea-green/15 text-aventurea-green",
  restaurantes: "bg-aventurea-blue/15 text-aventurea-blue",
};

/** Un negocio sin vertical guardada es de eventos (el default histórico). */
export function verticalDeRancho(
  vertical: string | null | undefined,
): Exclude<SeccionAdmin, "todas"> {
  return vertical === "citas" ||
    vertical === "hospedajes" ||
    vertical === "restaurantes"
    ? vertical
    : "eventos";
}

export function perteneceASeccion(
  vertical: string | null | undefined,
  seccion: SeccionAdmin,
) {
  return seccion === "todas" || verticalDeRancho(vertical) === seccion;
}
