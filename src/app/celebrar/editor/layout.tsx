import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProveedorRutas } from "@/components/celebrar/rutas-cliente";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { MARCA } from "@/lib/celebrar/marca";
import { RUTA } from "@/lib/celebrar/rutas";
import { prefijoDeLaPeticion, sesionCelebrar } from "@/lib/celebrar/sesion";

export const metadata: Metadata = {
  title: { default: "Editor", template: MARCA.plantillaTitulo },
  robots: { index: false, follow: false },
};

/**
 * El editor vive fuera del rail del panel: ocupa toda la pantalla
 * (teléfono a la izquierda, controles a la derecha). Exige sesión igual
 * que el panel; la celebración concreta la valida RLS al leerla.
 */
export default async function LayoutEditor({ children }: { children: React.ReactNode }) {
  const [prefijo, sesion] = await Promise.all([prefijoDeLaPeticion(), sesionCelebrar()]);
  if (!sesion) {
    redirect(`${conPrefijo(RUTA.entrar, prefijo)}?next=${encodeURIComponent(conPrefijo(RUTA.app, prefijo))}`);
  }
  return <ProveedorRutas prefijo={prefijo}>{children}</ProveedorRutas>;
}
