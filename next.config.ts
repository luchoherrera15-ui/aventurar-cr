import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El creador de invitaciones manda imágenes/videos en base64 dentro
  // del body del server action; el default de 1 MB los rechazaría.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  // El directorio vivía en /ranchos-eventos; ahora es /eventos (la
  // primera de tres secciones: eventos, citas, booking). Los links ya
  // mandados por correo y lo que tenga indexado Google siguen sirviendo.
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
    ];
  },
};

export default nextConfig;
