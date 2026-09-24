import type { Metadata } from "next";
import Home from "@/app/page";
import { urlSitio } from "@/lib/sitio";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /all — EL MARKETPLACE, EN UNA DIRECCIÓN FIJA
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «necesito que en www.bookea.lat/all
 * salga el marketplace que teníamos antes, de citas y reservas».
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────
 *
 * El catálogo nunca se fue: es el MODO DESCUBRIR de la portada. Pero
 * desde el rediseño solo aparece cuando la URL trae un parámetro de
 * búsqueda (`/?rubro=citas`, `/?q=barbería`). Entrar a `bookea.lat` a
 * secas muestra la landing de producto.
 *
 * O sea que no había forma de decirle a alguien «mirá el catálogo» sin
 * mandarle una URL con un filtro pegado, que además recorta lo que ve.
 * `/all` es esa dirección: el catálogo COMPLETO, sin filtro.
 *
 * ── ESTE ARCHIVO NO DIBUJA NADA, Y ESE ES EL PUNTO ──────────────────
 *
 * Llama a `Home` —el mismo componente que sirve `bookea.lat`— con
 * `forzarDescubrir`. Mismo header, mismo héroe con su buscador, mismos
 * rieles, misma tarjeta de negocio. Si mañana cambia la tarjeta, acá
 * cambia sola.
 *
 * Es el mismo patrón de `/demo-bookea`, con una diferencia importante:
 * ahí los negocios son de muestra; **acá son los de verdad**.
 *
 * ── LOS FILTROS SIGUEN FUNCIONANDO ──────────────────────────────────
 *
 * `/all?rubro=citas` recorta igual que `/?rubro=citas`: los parámetros
 * se leen exactamente igual, porque es el mismo componente. Lo único
 * que `forzarDescubrir` cambia es qué pasa cuando NO hay ninguno.
 *
 * ── SOBRE EL CANÓNICO ───────────────────────────────────────────────
 *
 * `/all` lleva el suyo propio y no apunta a `/`. Son dos páginas
 * distintas para Google: `/` presenta la plataforma a quien tiene un
 * negocio, `/all` lista proveedores para quien busca uno. Decirle que
 * la versión buena de `/all` es `/` sería pedirle que indexe la
 * landing de producto cuando alguien busca «barbería en Heredia».
 *
 * Y, como en la portada, el canónico NO lleva parámetros: las diez
 * variantes de filtro son el mismo catálogo recortado, no diez
 * páginas.
 *
 * ── LA REGLA DE SIEMPRE ─────────────────────────────────────────────
 * Ni estrellas, ni cifras inventadas, ni negocios de mentira. El
 * catálogo enseña lo que hay publicado, que hoy es poco.
 */

export const metadata: Metadata = {
  title: {
    absolute: "Bookea — Reservá servicios y encontrá proveedores para eventos",
  },
  description:
    "El directorio completo de Bookea: barbería, belleza, spa y salud con reserva directa, y lugares, catering, música y decoración para tu evento en todo Costa Rica. Precios en colones, a la vista.",
  alternates: { canonical: urlSitio("/all") },
};

export default async function TodoElMarketplace({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  return <Home searchParams={searchParams} forzarDescubrir />;
}
