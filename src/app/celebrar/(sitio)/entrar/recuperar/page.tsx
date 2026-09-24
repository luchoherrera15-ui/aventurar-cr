import { redirect } from "next/navigation";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { RUTA } from "@/lib/celebrar/rutas";
import { prefijoDeLaPeticion } from "@/lib/celebrar/sesion";

/** CELEBRAR entra solo con código por correo (dueño, 21 sep 2026): esta ruta vuelve a la puerta. */
export default async function Page() {
  redirect(conPrefijo(RUTA.entrar, await prefijoDeLaPeticion()));
}
