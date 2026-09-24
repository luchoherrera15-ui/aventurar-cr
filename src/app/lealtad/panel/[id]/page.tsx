import { redirect } from "next/navigation";
import ShellLealtad from "./shell-lealtad";
import { armarPanelLealtad } from "./armado";

export const metadata = { title: "Programa de lealtad · Bookea" };

/**
 * /lealtad/panel/[id] — el panel de Lealtad con su propio chrome.
 *
 * El armado (datos, permisos, secciones) vive en `armado.tsx` desde el
 * 7 sep 2026, compartido con la sección Lealtad del panel de Linksy.
 * Acá solo se decide qué hacer con el resultado.
 */
export default async function PanelNegocioLealtad(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pago?: string; tarjeta?: string }>;
}) {
  const r = await armarPanelLealtad(props);
  if (r.tipo === "redirect") redirect(r.destino);
  if (r.tipo === "pantalla") return r.nodo;
  return r.envolver(<ShellLealtad negocio={r.negocio} usuario={r.usuario} grupos={r.grupos} contenidos={r.contenidos} />);
}
