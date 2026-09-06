import { Montserrat } from "next/font/google";

/**
 * EL CONTENEDOR DE /linksy — el mismo scope de color que Solutions.
 *
 * Reusa la clase `.lealtad` y NO inventa una `.linksy`, por la misma
 * razón que la documenta `solutions/layout.tsx`: dentro de ese
 * contenedor, globals.css re-declara las siete variables de color y
 * todo componente que ya usa `bg-aventurea-navy` o `var(--accion)`
 * sale con la paleta correcta sin tocarle una línea. Una clase nueva
 * habría exigido copiar ese bloque de variables, y dos copias de una
 * paleta se despegan.
 *
 * ── LINKSY SE DISTINGUE POR LA COMPOSICIÓN, NO POR LOS COLORES ──────
 * El día que el dueño defina una identidad propia (logo y paleta), lo
 * que corresponde es una capa ENCIMA de `.lealtad` que redefina solo
 * lo que cambia — no una copia al lado. Mientras tanto, lo que hace
 * que esta landing no se parezca a la de Solutions es su estructura:
 * el reclamo del link en el héroe, no un hex distinto.
 */

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function LayoutLinksy({ children }: { children: React.ReactNode }) {
  // `.linksy` va ENCIMA de `.lealtad`: hereda toda la paleta del sitio y
  // suma sus propios bloques de color (ver globals.css).
  return <div className={`${montserrat.variable} lealtad linksy`}>{children}</div>;
}
