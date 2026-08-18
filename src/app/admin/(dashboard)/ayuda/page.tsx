import { listarHilosAdmin } from "@/lib/ayuda-general/acciones";
import BandejaAyuda from "./bandeja-ayuda";

/**
 * LA BANDEJA DE «HABLÁ CON BOOKEA» — soporte general, visitante ↔ admin.
 *
 * Ruta propia dentro del hub y NO un widget metido en otra pantalla —a
 * diferencia de la ayuda de diseño (0149), que a propósito vive adentro
 * de /admin/complementos porque ese hilo es un complemento más de un
 * negocio que ya está visible ahí (ver ayuda-panel.tsx). Acá el
 * razonamiento es el inverso: un mensaje de soporte general no cuelga
 * de ningún negocio necesariamente —puede escribir cualquiera, tenga o
 * no un negocio— así que no tiene una pantalla "madre" de la que sea un
 * complemento. Merece su propia entrada en el hub.
 *
 * La protección real de /admin/ayuda ya la hace el layout
 * (`requireAdmin()` en `admin/(dashboard)/layout.tsx`, que redirige a
 * /admin/login si no hay sesión de admin) — no hace falta repetirla acá
 * para poder LEER la lista. Lo que sí verifica por su cuenta es
 * `listarHilosAdmin()` (en `@/lib/ayuda-general/acciones`): una server
 * action se puede invocar por su id desde cualquier lado, no solo desde
 * esta pantalla, así que cada acción de ese módulo trae su propio
 * `requireAdmin()`.
 *
 * Sin filtro de `admin_seccion`: esa cookie separa el panel por
 * vertical de negocio (citas/eventos/hospedajes/restaurantes), y un
 * mensaje de soporte general puede no tener negocio ni vertical de
 * origen —lo escribe cualquiera que visite el sitio. Traer siempre
 * todos los hilos, sin ese filtro.
 */
export default async function AdminAyudaPage() {
  const hilos = await listarHilosAdmin();
  return <BandejaAyuda hilosIniciales={hilos} />;
}
