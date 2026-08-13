import { Montserrat } from "next/font/google";

/**
 * EL CONTENEDOR DEL MÓDULO DE LEALTAD.
 *
 * Hace dos cosas, y las dos son de alcance: aplicar la identidad de
 * Lealtad y NO derramarla al resto de Bookea.
 *
 * 1. LA CLASE `.lealtad` — dentro de ella, globals.css re-declara las
 *    siete variables de color del sistema. Como todo el repo pinta con
 *    alias de esas variables (`bg-aventurea-navy`, `text-aventurea-ink`…),
 *    cada componente que ya existe adopta la paleta de Lealtad con solo
 *    entrar acá. Sin duplicar componentes, sin un prop `variante`, sin
 *    tocar el JSX de nada que ya funcione.
 *
 * 2. MONTSERRAT — se carga en este layout y no en el raíz, así que el
 *    marketplace, mi-negocio e invitaciones siguen con Figtree y ni
 *    siquiera descargan esta familia. La cascada de `.lealtad` la
 *    aplica; `--font-figtree` queda de respaldo por si el archivo de
 *    Montserrat falla.
 *
 * Este layout NO trae header, footer ni chrome: las pantallas de
 * Lealtad ya traen el suyo (la landing es inmersiva y el panel tiene
 * su menú lateral). Envolver acá agregaría una barra que ninguna de
 * las dos quiere.
 */

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  // Los cinco pesos que el sistema usa: cuerpo, énfasis, subtítulo,
  // título y el ExtraBold de la utilidad `titulo`. Pedir la familia
  // completa agregaría archivos que nadie pinta.
  weight: ["400", "500", "600", "700", "800"],
});

export default function LayoutLealtad({ children }: { children: React.ReactNode }) {
  return <div className={`${montserrat.variable} lealtad`}>{children}</div>;
}
