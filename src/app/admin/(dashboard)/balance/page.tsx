import { redirect } from "next/navigation";

/**
 * El balance dejó de ser una pantalla aparte: vive como la pestaña de
 * alquileres dentro de Finanzas. La ruta vieja queda solo para que los
 * enlaces guardados sigan llegando a algún lado.
 */
export default function AdminBalancePage() {
  redirect("/admin/finanzas?tab=alquileres");
}
