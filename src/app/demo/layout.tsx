import { Montserrat } from "next/font/google";

/**
 * EL CONTENEDOR DE /demo.
 *
 * Es el mismo envoltorio que `src/app/lealtad/layout.tsx` y por la
 * misma razón: /demo enseña el producto Lealtad, así que tiene que
 * verse y leerse como Lealtad. La clase `.lealtad` re-declara los
 * tokens de color (globals.css) y Montserrat se carga acá para que el
 * marketplace ni siquiera descargue la familia.
 *
 * Además NO es decorativo: los mockups que se reusan de /lealtad
 * (mockup-anuncios.tsx) pintan con `var(--accion)` y compañía. Sin
 * esta clase esas variables no existen fuera de /lealtad y el mockup
 * saldría con colores en blanco.
 */

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function LayoutDemo({ children }: { children: React.ReactNode }) {
  return <div className={`${montserrat.variable} lealtad`}>{children}</div>;
}
