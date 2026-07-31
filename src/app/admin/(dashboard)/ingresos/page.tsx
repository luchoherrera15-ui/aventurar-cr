import { redirect } from "next/navigation";

/**
 * Los dineros de invitaciones dejaron de ser una pantalla aparte: son
 * la pestaña de invitaciones virtuales dentro de Finanzas. La ruta
 * vieja queda solo para los enlaces guardados.
 */
export default function AdminIngresosPage() {
  redirect("/admin/finanzas?tab=invitaciones");
}
