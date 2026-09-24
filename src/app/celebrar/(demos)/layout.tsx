import type { Metadata } from "next";
import { ProveedorRutas } from "@/components/celebrar/rutas-cliente";
import { MARCA } from "@/lib/celebrar/marca";
import { prefijoDeLaPeticion } from "@/lib/celebrar/sesion";

export const metadata: Metadata = {
  title: { default: "Demo", template: MARCA.plantillaTitulo },
  robots: { index: false, follow: true },
};

/**
 * Los demos a pantalla completa (una invitación, el álbum, el panel):
 * sin nav ni pie del sitio para que se vean como lo que van a recibir
 * los invitados, pero con el prefijo de rutas para que la barra
 * flotante lleve a donde corresponde en los dos dominios.
 */
export default async function LayoutDemos({ children }: { children: React.ReactNode }) {
  const prefijo = await prefijoDeLaPeticion();
  return <ProveedorRutas prefijo={prefijo}>{children}</ProveedorRutas>;
}
