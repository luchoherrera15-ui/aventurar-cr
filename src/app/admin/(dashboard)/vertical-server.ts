import { cookies } from "next/headers";
import { COOKIE_SECCION, type SeccionAdmin } from "./vertical";

/** La sección elegida en el conmutador del header del admin. */
export async function seccionActiva(): Promise<SeccionAdmin> {
  const jar = await cookies();
  const v = jar.get(COOKIE_SECCION)?.value;
  return v === "citas" ||
    v === "eventos" ||
    v === "hospedajes" ||
    v === "restaurantes"
    ? v
    : "todas";
}
