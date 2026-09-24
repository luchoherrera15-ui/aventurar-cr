import { permanentRedirect } from "next/navigation";

/** /soluciones — el alias en español de la landing vieja: a la página de producto (ver solutions/page.tsx). */
export default function SolucionesPage() {
  permanentRedirect("/solutions");
}
