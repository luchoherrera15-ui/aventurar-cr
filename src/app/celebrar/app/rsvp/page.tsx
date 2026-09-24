import { redirect } from "next/navigation";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { RUTA } from "@/lib/celebrar/rutas";
import { prefijoDeLaPeticion } from "@/lib/celebrar/sesion";

/** «Confirmaciones» vive dentro de Invitados: un solo panel por celebración. */
export default async function RsvpPage() {
  redirect(conPrefijo(RUTA.appInvitados, await prefijoDeLaPeticion()));
}
