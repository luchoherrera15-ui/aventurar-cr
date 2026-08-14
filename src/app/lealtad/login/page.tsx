import { redirect } from "next/navigation";

/**
 * ARQUITECTURA NUEVA: ya no hay una puerta de lealtad aparte — todo el
 * login vive en /cuenta, la misma cuenta que el resto de Bookea.
 *
 * Este archivo se queda a propósito (no se borra): media docena de
 * guardas de sesión adentro del panel siguen escribiendo literalmente
 * `redirect("/lealtad/login")` (crear-actions.ts, ayuda-actions.ts,
 * pases-actions.ts, etc. — ver panel/[id]/*). Convertirlo en un simple
 * reenvío hace que todas esas guardas terminen en el lugar correcto sin
 * tocar cada una: quien caiga acá por cualquier camino sale por
 * `/cuenta?volver=lealtad`, entra, y `/cuenta` lo manda derecho al panel
 * de su negocio (ver el manejo de `volver` en cuenta/page.tsx).
 */
export default function LoginLealtadRedirect() {
  redirect("/cuenta?volver=lealtad");
}
