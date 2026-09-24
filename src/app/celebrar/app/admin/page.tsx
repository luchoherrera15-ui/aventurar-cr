import { redirect } from "next/navigation";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { RUTA } from "@/lib/celebrar/rutas";
import { prefijoDeLaPeticion } from "@/lib/celebrar/sesion";

export default async function AdminInicio() {
  redirect(conPrefijo(RUTA.appAdminCreditos, await prefijoDeLaPeticion()));
}
