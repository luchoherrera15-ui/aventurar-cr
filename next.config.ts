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
