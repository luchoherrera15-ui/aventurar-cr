import type { Metadata } from "next";
import CuatroProductos from "@/components/home/plataforma/cuatro-productos";
import DemoAutomatizacion from "@/components/home/plataforma/demo-automatizacion";
import DemoReservas from "@/components/home/plataforma/demo-reservas";
import VariantePestanas from "@/components/home/plataforma/variante-pestanas";
import {
  PiezaPase,
  VarianteA,
  VarianteB,
  VarianteD,
} from "@/components/home/plataforma/variantes-mockup";
import PiezaPagina from "@/components/home/plataforma/pieza-pagina";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /prueba-mockups — las cinco formas de enseñar lo mismo
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (23 sep 2026): «hagamos pruebas con los 4 tipos de
 * diseño, mostrame para ver cómo se verían».
 *
 * Arriba de todo va la versión que HOY está en el home (los cuatro
 * teléfonos), para que la comparación sea contra algo y no contra el
 * recuerdo. Abajo, las cuatro alternativas.
 *
 * ⚠️ PÁGINA DESECHABLE. No se enlaza desde ningún lado y no se indexa.
 * Cuando se elija una variante, esa se muda a `cuatro-productos.tsx` y
 * se borran esta página, `variantes-mockup.tsx` y
 * `variante-pestanas.tsx`.
 *
 * Lleva la clase `home-plataforma` porque las piezas usan sus tokens
 * (`--tinta`, `--papel`, `--acento`…), que están acotados a ese ámbito.
 */

export const metadata: Metadata = {
  title: "Prueba de mockups",
  robots: { index: false, follow: false },
};

const PANELES = [
  {
    titulo: "Tu app",
    resumen:
      "Menú, servicios, reservas y contacto en un solo link. Sin descargar nada.",
    pieza: <PiezaPagina />,
  },
  {
    titulo: "Pases de lealtad",
    resumen:
      "Sellos y recompensas que viven en Apple Wallet y Google Wallet, y se actualizan solos.",
    pieza: <PiezaPase />,
  },
  {
    titulo: "Automatizaciones",
    resumen:
      "Comentan una palabra clave en Instagram y Bookea les manda el DM con tu link.",
    pieza: <DemoAutomatizacion />,
  },
  {
    titulo: "Reservas",
    resumen:
      "Tu negocio aparece en el directorio de Bookea y te reservan desde ahí.",
    pieza: <DemoReservas />,
  },
];

function Bloque({
  letra,
  titulo,
  nota,
  children,
}: {
  letra: string;
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[color:var(--linea)] px-5 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="mb-10 flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--tinta)] text-[16px] font-extrabold text-white">
            {letra}
          </span>
          <div>
            <h2 className="titulo text-[26px] text-[color:var(--tinta)]">{titulo}</h2>
            <p className="mt-1 max-w-[70ch] text-[14.5px] leading-snug text-[color:var(--tinta-suave)]">
              {nota}
            </p>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

export default function PruebaMockups() {
  return (
    <div className="home-plataforma min-h-screen bg-[color:var(--papel)]">
      <header className="px-5 py-12 text-center sm:px-8">
        <h1 className="titulo text-[clamp(28px,4vw,40px)] text-[color:var(--tinta)]">
          Cinco formas de enseñar lo mismo
        </h1>
        <p className="mx-auto mt-3 max-w-[60ch] text-[15px] text-[color:var(--tinta-suave)]">
          Las cinco muestran los mismos cuatro productos. Cambia cómo se
          presentan, no qué dicen.
        </p>
      </header>

      <Bloque
        letra="0"
        titulo="Lo que hay hoy — cuatro teléfonos"
        nota="Cada pantalla mide 182 px, así que el texto del menú queda en 8 px: ilegible. Las cuatro siluetas son iguales, y el ojo lee «cuatro teléfonos» antes que «cuatro cosas distintas»."
      >
        <CuatroProductos />
      </Bloque>

      <Bloque
        letra="A"
        titulo="Piezas recortadas, sin marco"
        nota="Se va el chasis y queda solo el pedazo que importa, a tamaño legible. Cada pieza tiene forma distinta —una tarjeta, una burbuja, una lista, una ficha—, así que se distinguen sin esfuerzo."
      >
        <VarianteA />
      </Bloque>

      <Bloque
        letra="B"
        titulo="Bento — cuatro tamaños distintos"
        nota="Las mismas piezas, pero en cajas de distinto tamaño: el pase ocupa una columna alta y el menú una ancha. Permite jerarquizar en vez de dar a todo el mismo peso."
      >
        <VarianteB />
      </Bloque>

      <Bloque
        letra="C"
        titulo="Un escenario con pestañas"
        nota="Una sola cosa por vez, cuatro veces más grande. A cambio: solo se ve lo que la persona elige, y es la única variante que necesita JavaScript."
      >
        <VariantePestanas paneles={PANELES} />
      </Bloque>

      <Bloque
        letra="D"
        titulo="Una fila por producto, alternando lados"
        nota="Cada producto se lleva el ancho completo. Es lo que más deja ver y lo que más scroll pide — el recorrido vuelve a ser largo."
      >
        <VarianteD />
      </Bloque>
    </div>
  );
}
