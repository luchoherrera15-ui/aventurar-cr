import { permanentRedirect } from "next/navigation";
import { urlLinksy } from "@/lib/solutions/dominios";

/**
 * /solutions — LA LANDING VIEJA, AHORA UNA REDIRECCIÓN.
 *
 * Desde el 7 sep 2026 el producto se llama Linksy y su portada es
 * linksy.lat (servida también en /linksy). Esta ruta sigue existiendo
 * solo para los links viejos (correos, QR, marcadores): manda a la
 * portada de Linksy con 308. `landing-solutions.tsx` y `textos.ts`
 * quedan en el árbol sin uso, por si hay que rescatar un texto.
 */
export default function SolutionsPage() {
  permanentRedirect(urlLinksy());
}
