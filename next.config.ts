import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El creador de invitaciones manda imágenes/videos en base64 dentro
  // del body del server action; el default de 1 MB los rechazaría.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  // ── Assets del pase de Wallet ──
  //
  // Vercel arma el bundle de cada función siguiendo los `import`. Los
  // archivos que se abren con `readFile` en tiempo de ejecución —la
  // fuente Montserrat y el ícono del emisor, en `assets-wallet/`— no
  // aparecen en ese rastreo y quedarían fuera del despliegue.
  //
  // El fallo no lo atrapa el build: compila perfecto y revienta con un
  // 500 la primera vez que alguien pide su tarjeta en producción. Por
  // eso van declarados a mano.
  //
  // La clave es un glob de RUTA (no de archivo): cubre cualquier ruta
  // que genere un pase, presente o futura.
  outputFileTracingIncludes: {
    "/**": ["assets-wallet/**/*"],
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
      // Cloudflare Images: de acá salen todas las fotos nuevas. Sin esta
      // entrada, `next/image` se niega a cargarlas y la galería queda en
      // blanco — falla en tiempo de ejecución, no en el build, así que no
      // la atrapa ninguna prueba.
      {
        protocol: "https",
        hostname: "imagedelivery.net",
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
          // ── OJO AL CAMBIAR UN LOGO ──
          //
          // Estos archivos se sirven con una semana de `max-age` y un mes
          // de `stale-while-revalidate`. Reemplazar el CONTENIDO dejando
          // el mismo nombre NO se ve: los navegadores que ya lo tenían
          // siguen mostrando el viejo hasta que expire. Pasó exactamente
          // eso al estrenar el logo de 2026.
          //
          // La forma correcta de cambiar un logo es cambiarle el NOMBRE
          // (el sufijo -v2, -v3…) y actualizar las referencias. La URL
          // nueva no tiene caché que la ensucie y el cambio se ve al
          // instante, sin tocar estas cabeceras ni pedirle a nadie que
          // limpie el navegador.
          // El isotipo (`icono-bookea-v2`) sigue en v2: solo cambió el
          // logotipo, así que no hay motivo para invalidar su caché.
          "/:archivo(logo-bookea-nav-v3\\.png|logo-bookea-v3\\.png|logo-bookea-blanco-v3\\.png|icono-bookea-v2\\.png|portada-bookea\\.jpg)",
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
      // ── LA RAÍZ, SIN VIAJE DE IDA Y VUELTA ────────────────────────
      // Antes era un `redirect` 307 a /eventos. Medido desde Costa
      // Rica costaba ~340 ms: el navegador pedía `/`, el edge le
      // contestaba «andá a /eventos», y recién ahí empezaba la
      // solicitud de verdad. Un rewrite sirve el MISMO contenido en la
      // primera respuesta, sin el rebote.
      //
      // Y la URL se queda en `/`, que es lo que se quiere: era la
      // dirección más fuerte del sitio y estaba regalando su autoridad.
      //
      // OJO — DEUDA CONOCIDA: ahora el mismo contenido vive en `/` y en
      // `/eventos`. Para Google eso es duplicado si nadie desempata, y
      // el desempate correcto es un `alternates.canonical` en la página
      // de eventos. Lo está resolviendo la auditoría de SEO; mientras
      // tanto el riesgo es bajo porque `/eventos` ya era la única
      // indexada (la raíz redirigía).
      {
        source: "/",
        destination: "/eventos",
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
      // La raíz YA NO REDIRIGE — ahora es un rewrite (ver `rewrites()`
      // más abajo). Se midió: el 307 costaba ~340 ms desde Costa Rica,
      // un viaje completo de ida y vuelta a Virginia ANTES de que
      // empezara a existir el HTML.
      //
      // Y de paso recupera la URL más fuerte del sitio. Con la
      // redirección, `bookea.lat/` no tenía contenido propio y le
      // pasaba toda su autoridad a `/eventos`: quien buscaba «Bookea»
      // no encontraba una página que dijera qué es Bookea.
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
