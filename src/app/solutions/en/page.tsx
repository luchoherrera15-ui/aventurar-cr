import { permanentRedirect } from "next/navigation";
import { urlLinksy } from "@/lib/solutions/dominios";

/** /solutions/en — la landing vieja en inglés: a la portada de Linksy (ver ../page.tsx). */
export default function SolutionsEnPage() {
  permanentRedirect(urlLinksy());
}
