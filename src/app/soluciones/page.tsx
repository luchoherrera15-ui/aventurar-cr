import { permanentRedirect } from "next/navigation";
import { urlLinksy } from "@/lib/solutions/dominios";

/** /soluciones — el alias en español de la landing vieja: a la portada de Linksy (ver solutions/page.tsx). */
export default function SolucionesPage() {
  permanentRedirect(urlLinksy());
}
