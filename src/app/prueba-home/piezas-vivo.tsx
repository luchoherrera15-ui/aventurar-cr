import type { ReactNode } from "react";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import HeaderPlataforma from "@/components/home/plataforma/header-plataforma";
import {
  TITULO_GRANDE,
  VerMas,
  Ventana,
} from "@/components/home/plataforma/piezas";
import {
  PiezaPase,
} from "@/components/home/plataforma/variantes-mockup";
import PiezaPagina from "@/components/home/plataforma/pieza-pagina";
import DemoAutomatizacion from "@/components/home/plataforma/demo-automatizacion";
import DemoReservas from "@/components/home/plataforma/demo-reservas";
import { PRODUCTOS, type Producto } from "@/lib/productos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL KIT DE LAS VEINTE PORTADAS
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «mostrame los ejemplos pero 100 %
 * funcionales, o sea cómo se verían exactamente».
 *
 * Así que las veinte se arman con las piezas REALES —el pase que monta
 * `VistaPase`, las dos demos que corren solas, el menú, y el texto que
 * sale de `productos.ts`—, no con cajas grises. Lo único que cambia
 * entre una portada y otra es la COMPOSICIÓN, que es justo lo que se
 * está eligiendo.
 *
 * Este archivo es el vocabulario común: el marco, los dos héroes y los
 * cuatro visuales. Las composiciones viven en `homes-vivos.tsx`.
 *
 * ⚠️ Carpeta desechable: se borra entera cuando haya decisión.
 */

/** Los cuatro visuales, en el mismo orden que `PRODUCTOS`. */
export const VISUAL: Record<Producto["id"], ReactNode> = {
  pagina: <PiezaPagina />,
  lealtad: <PiezaPase />,
  automatizaciones: <DemoAutomatizacion />,
  marketplace: <DemoReservas />,
};

/**
 * Cómo se apoya cada visual dentro de su `<Ventana>`.
 *
 * Las tres piezas de interfaz —pase, conversación, agenda— miden lo
 * justo y van centradas.
 *
 * La página va anclada ARRIBA, y no por gusto: un teléfono siempre es
 * más alto que la ventana, así que algo se va a cortar sí o sí. Si va
 * centrado se corta la cabecera —el logo y el nombre del negocio— y
 * eso se lee como un error de maquetación. Anclado arriba el corte cae
 * abajo, donde se lee como «la pantalla sigue», que es la verdad.
 */
export const DESDE: Record<Producto["id"], "arriba" | "centro"> = {
  pagina: "arriba",
  lealtad: "centro",
  automatizaciones: "centro",
  marketplace: "centro",
};

/** Los cuatro productos con su visual al lado, listo para recorrer. */
export const CUATRO = PRODUCTOS.map((p) => ({
  ...p,
  visual: VISUAL[p.id],
  desde: DESDE[p.id],
}));

/**
 * El marco de cualquier portada: header arriba, pie abajo.
 *
 * `oscuro` no cambia un solo componente: agrega `.home-oscuro`, que
 * vuelve a declarar las variables de color más adentro. Todo el
 * subárbol se repinta solo.
 */
export function Shell({
  children,
  oscuro = false,
  cabecera = "papel",
}: {
  children: ReactNode;
  oscuro?: boolean;
  /** `marina` = la cabecera se funde con un héroe navy a sangre. */
  cabecera?: "papel" | "marina";
}) {
  return (
    <div
      className={`home-plataforma ${
        oscuro ? "home-oscuro" : ""
      } flex min-h-screen flex-col overflow-x-clip bg-[color:var(--papel)]`}
    >
      {cabecera === "marina" ? (
        <div className="cabecera-marina">
          <HeaderPlataforma />
        </div>
      ) : (
        <HeaderPlataforma />
      )}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** El ancho de trabajo de todas las portadas. */
export function Ancho({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1200px] px-5 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

/** La píldora de arriba del titular. */
export function Rotulo({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--linea)] bg-[color:var(--superficie)] px-4 py-2 text-[12.5px] font-extrabold text-[color:var(--tinta)]">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[color:var(--acento)]" />
      {children}
    </span>
  );
}

/** Los dos botones del héroe. */
export function Acciones({
  primario = "Empezá gratis",
  secundario = "Ver cómo funciona",
  centrado = true,
}: {
  primario?: string;
  secundario?: string;
  centrado?: boolean;
}) {
  return (
    <div
      className={`mt-9 flex flex-wrap items-center gap-3 ${
        centrado ? "justify-center" : ""
      }`}
    >
      <Link href="/empezar" className="btn-tinta">
        {primario}
      </Link>
      {secundario ? (
        <Link href="/solutions" className="btn-tinta-contorno">
          {secundario}
        </Link>
      ) : null}
    </div>
  );
}

export function HeroeCentrado({
  rotulo = "La plataforma de tu negocio",
  titulo = "Aumentá tus ventas con Bookea.",
  bajada = "Tu menú, tus reservas, tus clientes y tus automatizaciones. Todo en un solo lugar.",
  acciones = true,
  chico = false,
}: {
  rotulo?: string | null;
  titulo?: string;
  bajada?: string | null;
  acciones?: boolean;
  chico?: boolean;
}) {
  return (
    <div className="text-center">
      {rotulo ? <Rotulo>{rotulo}</Rotulo> : null}
      <h1
        className={`mx-auto max-w-[15ch] ${rotulo ? "mt-5" : ""} ${
          chico
            ? "titulo text-balance text-[clamp(26px,3.6vw,36px)] leading-[1.1] text-[color:var(--tinta)]"
            : TITULO_GRANDE
        }`}
      >
        {titulo}
      </h1>
      {bajada ? (
        <p className="mx-auto mt-6 max-w-[600px] text-pretty text-[17px] leading-relaxed text-[color:var(--tinta-suave)] sm:text-[20px]">
          {bajada}
        </p>
      ) : null}
      {acciones ? <Acciones /> : null}
    </div>
  );
}

export function HeroeIzquierda({
  rotulo = "La plataforma de tu negocio",
  titulo = "Aumentá tus ventas con Bookea.",
  bajada = "Tu menú, tus reservas, tus clientes y tus automatizaciones. Todo en un solo lugar.",
}: {
  rotulo?: string | null;
  titulo?: string;
  bajada?: string | null;
}) {
  return (
    <div className="text-left">
      {rotulo ? <Rotulo>{rotulo}</Rotulo> : null}
      <h1 className={`max-w-[14ch] ${rotulo ? "mt-5" : ""} ${TITULO_GRANDE}`}>
        {titulo}
      </h1>
      {bajada ? (
        <p className="mt-6 max-w-[46ch] text-pretty text-[17px] leading-relaxed text-[color:var(--tinta-suave)] sm:text-[19px]">
          {bajada}
        </p>
      ) : null}
      <Acciones centrado={false} />
    </div>
  );
}

/**
 * Una tarjeta de producto: el escenario arriba, el texto abajo.
 *
 * ── LO QUE CAMBIÓ EL 24 SEP 2026 ────────────────────────────────────
 *
 * El dueño puso take.app al lado y marcó la diferencia: allá cada
 * tarjeta se ve como una CAPTURA de la aplicación; acá el mockup
 * flotaba en el medio con aire alrededor y se leía como una
 * ilustración.
 *
 * Tres cambios, medidos contra esa página:
 *
 * 1. **El escenario va a sangre.** Toca los tres bordes de la tarjeta,
 *    sin margen, y tiene su propio fondo un punto más oscuro. Ese salto
 *    separa «la pantalla» del «texto» sin necesidad de una línea. Antes
 *    el mockup tenía padding a los lados y quedaba como una figurita
 *    pegada sobre la tarjeta.
 * 2. **El texto va a la IZQUIERDA**, no centrado. Centrado se lee como
 *    un pie de foto; alineado se lee como una ficha de producto.
 * 3. **El mockup ocupa todo el ancho que hay.** Sin el padding, el
 *    teléfono pasa de 182 px a 280 px — y a 280 px su contenido se lee,
 *    que es la diferencia entre enseñar el producto y sugerirlo.
 *
 * `alto` fija el alto del escenario. Los cuatro visuales miden
 * distinto, así que sin un piso común los títulos quedan escalonados.
 */
export function TarjetaProducto({
  p,
  alto = 300,
  compacta = false,
}: {
  p: (typeof CUATRO)[number];
  alto?: number;
  compacta?: boolean;
}) {
  return (
    <Link
      href={p.verMas}
      className="group flex flex-col overflow-hidden rounded-[20px] border border-[color:var(--linea)] bg-[color:var(--superficie)] text-left transition-colors hover:border-[color:var(--acento)]"
    >
      <Ventana alto={alto} desde={p.desde}>
        {p.visual}
      </Ventana>
      <div className="flex flex-1 flex-col p-5">
        <p
          className={`font-extrabold text-[color:var(--tinta)] ${
            compacta ? "text-[15px]" : "text-[17px]"
          }`}
        >
          {p.nombre}
        </p>
        {compacta ? null : (
          <p className="mb-5 mt-1.5 text-[13.5px] leading-snug text-[color:var(--tinta-suave)]">
            {p.promesa}
          </p>
        )}
        <VerMas className={compacta ? "mt-4 self-start" : "mt-auto self-start"} />
      </div>
    </Link>
  );
}
