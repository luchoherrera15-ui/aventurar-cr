import type { Metadata } from "next";
import Home from "@/app/page";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /demo-bookea — LA PORTADA DE BOOKEA, LLENA DE DEMOS
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (27 ago 2026): «necesito el MISMO MISMO sitio de
 * Bookea, solamente que lleno de demos, con los cards iguales a los de
 * Bookea normal, todo igual».
 *
 * ── ESTE ARCHIVO NO DIBUJA NADA, Y ESE ES EL PUNTO ──────────────────
 *
 * Llama a `Home` — el componente de `src/app/page.tsx`, el mismo que
 * sirve `bookea.lat` — con una sola diferencia: `demo`. Esa bandera
 * cambia ÚNICAMENTE de dónde salen los negocios (ver `home-datos.ts`:
 * los de muestra llevan `en_marketplace = false`).
 *
 * El primer intento fue una página propia que reusaba las mismas
 * piezas, y estaba mal: por más que compartiera componentes era OTRA
 * pantalla, con su encabezado y su franja. Lo que se enseña en una
 * demostración tiene que ser el producto, no una imitación del
 * producto — y lo que se ve acá tiene que cambiar solo cuando cambie
 * la portada de verdad, sin que nadie se acuerde de venir a copiarlo.
 *
 * ── NO SE INDEXA ────────────────────────────────────────────────────
 *
 * Son negocios que no existen. Que Google los liste bajo el nombre de
 * Bookea sería mandarle gente a barberías inventadas — y la persona
 * que llegue así no tiene forma de saber que es una muestra.
 *
 * ── POR QUÉ NO VIVE EN `/demo` ──────────────────────────────────────
 *
 * Esa ruta ya es la demostración de LEALTAD, que es otro producto y se
 * le enseña a otra persona.
 */

export const metadata: Metadata = {
  title: "Bookea",
  robots: { index: false, follow: false },
};

export default async function DemoBookea({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  return <Home searchParams={searchParams} demo />;
}
