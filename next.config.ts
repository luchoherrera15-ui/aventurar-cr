import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El creador de invitaciones manda imágenes/videos en base64 dentro
  // del body del server action; el default de 1 MB los rechazaría.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  // Casi todas las fotos remotas del sitio cuelgan de estos dos hosts
  // (buckets públicos de este mismo proyecto de Supabase, y las fotos
  // placeholder de los seeds de demo) — con esto next/image las puede
  // optimizar (tamaño correcto por pantalla, WebP/AVIF, lazy real) en
  // vez de servirlas tal cual con <img>. Casos legítimos que siguen
  // como <img> crudo (avatar de Google, QR externo, URLs firmadas) NO
  // se tocan — están documentados en su propio eslint-disable.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bjhprmtobmualefvcmau.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    // AVIF primero, WebP de respaldo. Sin esta línea el default de Next
    // es solo ['image/webp'] — se midió pidiendo con
    // `Accept: image/avif,image/webp` y el optimizador devolvía WebP en
    // las 4 anchuras. AVIF pesa 20-30% menos con la misma calidad; el
    // navegador que no lo soporte recibe WebP por el header Accept.
    // Cuesta ~50% más encodear la PRIMERA vez; con minimumCacheTTL de
    // abajo esa primera vez pasa una vez al mes, no cada 4 horas.
    formats: ["image/avif", "image/webp"],
    // El default incluye 2048 y 3840. Combinado con `sizes="100vw"` y
    // una pantalla DPR2, el navegador pedía el candidato de 3840 y se
    // bajaba 718 KB de UNA foto (medido en /rancholastorres). Ninguna
    // maqueta del sitio pasa de 1600 px de ancho de contenido, así que
    // 1920 es el techo útil: el peor caso queda en 264 KB.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Next 16 exige declarar las calidades permitidas (una calidad
    // libre deja que cualquiera haga trabajar al optimizador con
    // valores arbitrarios). 75 es el default de todo el sitio; 60 es
    // para las fotos que van detrás de un velo, donde nadie nota la
    // diferencia y se ahorra ~30%; 82 es SOLO para la galería del
    // negocio y su visor a pantalla completa — las fotos contra las
    // que un cliente compara con Airbnb.
    //
    // Que sea una lista corta y no un rango es a propósito: cada valor
    // nuevo multiplica el trabajo del optimizador y las entradas de
    // caché (una por ancho × formato × calidad). Antes de agregar un
    // cuarto número, medir si se nota.
    qualities: [60, 75, 82],
    // Supabase Storage sirve las fotos con `max-age=3600`, y el
    // optimizador toma el mayor entre eso y este TTL (default 4 h). O
    // sea que Vercel volvía a bajar el original —hay archivos de 5.7
    // MB en el bucket— y a reencodarlo cada 4 horas, por cada ancho y
    // cada formato. Los nombres en el bucket llevan `Date.now()` y
    // nunca se reescriben (todo `upload` usa una ruta nueva), así que
    // una URL siempre apunta al mismo byte: cachear 31 días es seguro.
    minimumCacheTTL: 2678400,
  },
  // Los archivos de /public salían con `cache-control: public,
  // max-age=0, must-revalidate`: el logo (en TODAS las páginas, dos
  // veces) pedía permiso al servidor en cada carga antes de pintarse.
  // Son assets de marca que cambian una vez al año y, cuando cambian,
  // se cambia también el nombre del archivo — una semana de frescura
  // más un mes de stale-while-revalidate no arriesga nada.
  async headers() {
    return [
      {
        source:
          "/:archivo(logo-bookea-nav\\.png|logo-bookea\\.png|logo-bookea-blanco\\.png|icono-bookea\\.png|portada-bookea\\.jpg)",
        headers: [
          { key: "cache-control", value: "public, max-age=604800, stale-while-revalidate=2592000" },
        ],
      },
      {
        source: "/fondos/:archivo*",
        headers: [
          { key: "cache-control", value: "public, max-age=604800, stale-while-revalidate=2592000" },
        ],
      },
    ];
  },
  // La ruta bonita de las invitaciones: /invitacion/{slug} sirve la
  // misma página que /i/{slug} — el cliente comparte una dirección
  // con su nombre, no un código.
  async rewrites() {
    return [
      {
        source: "/invitacion/:slug",
        destination: "/i/:slug",
      },
    ];
  },
  // El directorio vivía en /ranchos-eventos; ahora es /eventos (la
  // primera de tres secciones: eventos, citas, booking). Los links ya
  // mandados por correo y lo que tenga indexado Google siguen sirviendo.
  //
  // El panel del proveedor vivía en /mi-rancho — nombre que solo tenía
  // sentido para Eventos y confundía a un negocio de Citas. Ahora es
  // /mi-negocio para todos los rubros; los links viejos (correos ya
  // mandados, favoritos guardados) siguen sirviendo.
  async redirects() {
    return [
      // Entrar a bookea.lat aterriza DIRECTO en el directorio de
      // eventos (pedido del dueño): la intro animada del home hacía
      // esperar ~5 segundos a cada visita nueva antes de mostrar nada
      // reservable. El edge responde esta redirección al instante, sin
      // invocar servidor. No-permanente a propósito: si algún día la
      // raíz vuelve a ser un home con contenido, los navegadores no
      // tendrán cacheado un 308.
      {
        source: "/",
        destination: "/eventos",
        permanent: false,
      },
      {
        source: "/ranchos-eventos",
        destination: "/eventos",
        permanent: true,
      },
      {
        source: "/ranchos-eventos/:path*",
        destination: "/eventos/:path*",
        permanent: true,
      },
      {
        source: "/mi-rancho",
        destination: "/mi-negocio",
        permanent: true,
      },
      {
        source: "/mi-rancho/:path*",
        destination: "/mi-negocio/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
