import { permanentRedirect } from "next/navigation";

/** /solutions/en — la landing vieja en inglés: a la página de producto (ver ../page.tsx). */
export default function SolutionsEnPage() {
  permanentRedirect("/solutions");
}
