import { Montserrat } from "next/font/google";

/**
 * EL CONTENEDOR DE /solutions — EL MISMO QUE EL DE LEALTAD, A PROPÓSITO.
 *
 * /solutions es la landing de los productos para negocios (lealtad,
 * linktree, menú digital con pedidos). Reusa la clase `.lealtad` y no
 * inventa una `.solutions`: dentro de `.lealtad`, globals.css
 * re-declara las siete variables de color y todos los componentes de
 * la landing de Lealtad que se montan acá (nav, FAQ, botones) salen
 * con su paleta correcta sin tocarlos.
 *
 * Una clase nueva habría exigido copiar ese bloque de variables — y
 * dos copias de una paleta es la garantía de que se despeguen. Si
 * algún día Solutions necesita colores propios, se agrega una capa
 * encima, no una copia al lado.
 *
 * Montserrat se carga acá por lo mismo que en lealtad/layout.tsx: que
 * el marketplace no la descargue.
 */

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function LayoutSolutions({ children }: { children: React.ReactNode }) {
  return <div className={`${montserrat.variable} lealtad`}>{children}</div>;
}
