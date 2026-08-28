"use client";

import { usePathname } from "next/navigation";
import VerticalSwitcher from "./vertical-switcher";
import type { SeccionAdmin } from "./vertical";

/**
 * EL SELECTOR DE SECCIÓN, EXCEPTO EN LEALTAD Y COMPLEMENTOS.
 *
 * `VerticalSwitcher` vive en el layout compartido de TODO `/admin`
 * (`layout.tsx`) — filtra de verdad en Balance/Finanzas, Ranchos y
 * Auditoría, así que no se toca ahí. Pero en `/admin/complementos` deja
 * de tener sentido: esa pantalla ahora muestra TODOS los negocios con
 * un plan de lealtad activo, estén o no en el marketplace, y filtrar
 * por vertical ahí escondería negocios por accidente — justo lo
 * contrario de lo que esa pantalla existe para mostrar.
 *
 * Es un componente cliente aparte, y no un `if` dentro del layout,
 * porque el layout es un Server Component y no tiene forma de saber en
 * qué ruta está sin leer el pathname del navegador.
 */
export default function VerticalSwitcherCondicional({
  actual,
  variante,
}: {
  actual: SeccionAdmin;
  variante?: "barra" | "rail";
}) {
  const pathname = usePathname();
  // ⚠️ `/admin/lealtad` y no `/admin/complementos`: la pantalla se mudó
  // el 27 ago 2026 (era el panel de Lealtad con el nombre equivocado).
  // El filtro por vertical del marketplace no aplica a un negocio de
  // lealtad, que no está en ninguna vertical.
  if (pathname?.startsWith("/admin/lealtad")) return null;
  return <VerticalSwitcher actual={actual} variante={variante} />;
}
