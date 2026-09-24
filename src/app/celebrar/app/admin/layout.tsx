import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { esAdminCelebrar } from "@/lib/celebrar/sesion";

export const metadata: Metadata = { title: "Administración" };

/**
 * La administración de CELEBRAR vive dentro del panel (mismo rail,
 * mismos estilos) pero solo para el equipo: para cualquier otra persona
 * la ruta no existe. Las RPC de la base vuelven a preguntar `is_admin()`
 * por su cuenta, así que esto es la primera barrera, no la única.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  if (!(await esAdminCelebrar())) notFound();
  return <>{children}</>;
}
