import { listarReuniones } from "./actions";
import ReunionesPanel from "./reuniones-panel";

export const metadata = { title: "Reuniones · Admin Bookea" };

/**
 * /admin/reuniones — la agenda de las reuniones de ayuda de Lealtad.
 *
 * La protección la hace el layout (`requireAdmin()`); `listarReuniones`
 * la repite por su cuenta, como toda action del admin. Sin filtro de
 * `admin_seccion`: una reunión pedida desde el alta no tiene vertical.
 */
export default async function AdminReunionesPage() {
  const { proximas, pasadas } = await listarReuniones();
  return <ReunionesPanel proximas={proximas} pasadas={pasadas} />;
}
