/**
 * LAS SECCIONES DEL PANEL ADMIN, EN EL ORDEN DEL DÍA.
 *
 * Antes esto no existía como lista: eran quince `<HubCard>` escritas a
 * mano en la portada. Ahora es un dato, porque lo consumen dos lugares
 * —la barra lateral y la portada— y dos copias de la misma lista se
 * desincronizan a la primera sección nueva.
 *
 * ── POR QUÉ ESTE ARCHIVO NO TIENE JSX NI "use client" ──────────────
 * Lo importa la barra lateral, que ES cliente (necesita `usePathname`
 * para saber cuál está activa), y también el layout, que es servidor.
 * Un módulo compartido entre los dos no puede arrastrar ninguno de los
 * dos mundos: los íconos viven aparte (`iconos-admin.tsx`) y acá solo
 * queda el NOMBRE del ícono. Un helper exportado desde un módulo
 * cliente ya rompió Finanzas e IA con un 500 invisible al build.
 *
 * ── EL ORDEN ───────────────────────────────────────────────────────
 * Lo que se opera todos los días, lo que Bookea vende como producto
 * propio, la plata, la gente, y de último la infraestructura. No es
 * alfabético a propósito: nadie abre el panel buscando la letra A.
 */

/** Ojo: `SeccionAdmin` de `./vertical` es otra cosa — la VERTICAL del
 *  marketplace (Todas, Eventos, Citas…). Esta es un destino del menú.
 *  Por eso la lista se llama `DESTINOS_ADMIN` y no `SECCIONES_ADMIN`. */
export type DestinoAdmin = {
  /** Adónde va. Es también la llave: no se repite. */
  href: string;
  etiqueta: string;
  /** La llave dentro de `ICONOS_ADMIN` (ver `iconos-admin.tsx`). */
  icono: string;
  /**
   * Qué contador de pendientes le corresponde, si tiene. Solo dos
   * tienen: son los únicos que `contarPendientes()` calcula contra una
   * fuente de verdad. Un badge inventado enseña a ignorar los badges.
   */
  badge?: "publicaciones" | "invitaciones";
  /** Una aclaración corta al lado del nombre, cuando hace falta. */
  chip?: string;
};

export type GrupoAdmin = {
  /** null = sin rótulo, va suelto arriba de todo. */
  titulo: string | null;
  items: DestinoAdmin[];
};

export const GRUPOS_ADMIN: GrupoAdmin[] = [
  {
    titulo: null,
    items: [{ href: "/admin", etiqueta: "Tablero", icono: "tablero" }],
  },
  {
    titulo: "Operación",
    items: [
      {
        href: "/admin/ranchos",
        etiqueta: "Publicaciones",
        icono: "negocio",
        badge: "publicaciones",
      },
      { href: "/admin/eventos", etiqueta: "Reservas", icono: "reserva" },
      { href: "/admin/agenda", etiqueta: "Agenda", icono: "calendario" },
      {
        href: "/admin/eventos/precios",
        etiqueta: "Precios",
        icono: "etiqueta",
        chip: "Eventos",
      },
    ],
  },
  {
    titulo: "Productos de Bookea",
    items: [
      {
        href: "/admin/invitaciones",
        etiqueta: "Invitaciones digitales",
        icono: "sobre",
        badge: "invitaciones",
      },
      { href: "/admin/complementos", etiqueta: "Complementos", icono: "complemento" },
      { href: "/admin/campanas", etiqueta: "Campañas", icono: "campana" },
    ],
  },
  {
    titulo: "Plata",
    items: [
      { href: "/admin/finanzas", etiqueta: "Finanzas", icono: "chart" },
      { href: "/admin/modulos", etiqueta: "Ingresos de los módulos", icono: "libro" },
      { href: "/admin/auditoria", etiqueta: "Auditoría del dinero", icono: "lupa" },
    ],
  },
  {
    titulo: "Personas",
    items: [
      { href: "/admin/usuarios", etiqueta: "Cuentas y accesos", icono: "users" },
      { href: "/admin/ayuda", etiqueta: "Chats", icono: "chat", chip: "En vivo" },
      { href: "/admin/developers", etiqueta: "Developers de la API", icono: "llave" },
    ],
  },
  {
    titulo: "Plataforma",
    items: [
      { href: "/admin/ia", etiqueta: "Inteligencia artificial", icono: "ia" },
      { href: "/admin/almacenamiento", etiqueta: "Almacenamiento", icono: "almacen" },
    ],
  },
];

/** Todas, sin agrupar. */
export const DESTINOS_ADMIN: DestinoAdmin[] = GRUPOS_ADMIN.flatMap((g) => g.items);

/**
 * Cuál está activa según la URL.
 *
 * ── LA TRAMPA QUE ESTO EVITA ───────────────────────────────────────
 * Con un `startsWith` a secas, estando en `/admin/eventos/precios` se
 * prenden DOS: Reservas (`/admin/eventos`) y Precios. Gana el href más
 * largo que sea prefijo de la ruta.
 *
 * Y `/admin` se compara por igualdad exacta, porque si no es prefijo
 * de absolutamente todo y el Tablero queda encendido siempre.
 */
export function seccionDeLaRuta(pathname: string): string | null {
  if (pathname === "/admin") return "/admin";

  let mejor: string | null = null;
  for (const s of DESTINOS_ADMIN) {
    if (s.href === "/admin") continue;
    if (pathname === s.href || pathname.startsWith(`${s.href}/`)) {
      if (mejor === null || s.href.length > mejor.length) mejor = s.href;
    }
  }
  return mejor;
}
