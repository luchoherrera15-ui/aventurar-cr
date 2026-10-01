import Link from "next/link";
import { producto, type ProductoId } from "@/lib/productos";
import { NotaDemo, VerMas } from "./piezas";
import { VivoLealtad, VivoMarketplace } from "./telefonos-vivos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS PRODUCTOS — un teléfono FUNCIONANDO por producto, y su puerta
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (23 sep 2026): una card por cada cosa que ofrecemos,
 * «cada uno con un "ver más"». Y el 24 sep, la vuelta de tuerca: «cada
 * mockup debería estar interactuando, funcionando… recreando la función
 * de cada cosa, ~20 segundos… algo profesional». Desde el 30 sep son
 * dos: pases de lealtad y reservas.
 *
 * Así que los teléfonos no posan: se REPRODUCEN. Cada uno es un guion
 * corto que recrea el flujo real —el pase suma sellos y el tablero
 * entrega; la búsqueda termina en la agenda— y rebobina solo. Las
 * escenas viven en `telefonos-vivos.tsx` (cliente); esta tarjeta sigue
 * siendo de servidor.
 *
 * ── EL TEXTO Y LOS DESTINOS VIENEN DEL CATÁLOGO ─────────────────────
 *
 * Nombre, promesa, «antes» y «ver más» salen de `src/lib/productos.ts`,
 * la misma lista que pinta `/empezar`. Acá solo se montan los teléfonos.
 * Las rutas existen: hay un test que lo comprueba contra el disco.
 */

/**
 * Una tarjeta: el teléfono, el texto y la puerta.
 *
 * El texto NO se escribe acá: sale de `src/lib/productos.ts`, que es la
 * misma lista que pinta la pantalla de «¿qué querés activar?». Así el
 * nombre que alguien lee en el home es el mismo que ve después de
 * registrarse, sin que nadie tenga que acordarse de cambiar los dos.
 */
function Tarjeta({
  id,
  children,
}: {
  id: ProductoId;
  children: React.ReactNode;
}) {
  const p = producto(id);
  return (
    <Link
      href={p.verMas}
      className="group flex flex-col items-center rounded-[20px] border border-[color:var(--linea)] bg-[color:var(--superficie)] px-5 py-7 text-center transition-colors hover:border-[color:var(--acento)]"
    >
      {/* El teléfono, apoyado en una BASE COMÚN.
          El de Lealtad mide más que el de Reservas —lleva las pestañas
          Apple/Google encima del marco, y su pase exige los 208 px de
          piso del MarcoTelefono—, así que sin una altura fija su título
          quedaba más abajo que el otro. `items-end` los para a los dos
          sobre la misma línea; 530 es lo que mide el conjunto del pase.

          `aria-hidden` + `inert`: es una demostración, no interfaz. El
          `inert` importa porque `VistaPase` trae botones DE VERDAD (las
          pestañas Apple/Google): sin él quedaban enfocables con Tab
          dentro de un aria-hidden, y su clic burbujeaba al <Link> de la
          tarjeta — botones dentro de un enlace, el mismo HTML inválido
          que `VerMas` (piezas.tsx) evita siendo un span. */}
      <div
        aria-hidden
        inert
        className="flex h-[530px] w-full select-none items-end justify-center"
      >
        {children}
      </div>

      <p className="mt-6 text-[17px] font-extrabold text-[color:var(--tinta)]">{p.nombre}</p>
      {/* El «antes», tachado: cómo se resuelve esto hoy sin Bookea. La
          frase vive en productos.ts, no acá (una sola lista). */}
      <p className="mt-1.5 text-[12.5px] text-[color:var(--tinta-tenue)] line-through decoration-1">
        {p.antes}
      </p>
      <p className="mb-5 mt-1 max-w-[26ch] text-[13.5px] leading-snug text-[color:var(--tinta-suave)]">
        {p.promesa}
      </p>
      {/* `mt-auto`: con `flex-col`, empuja el botón al piso de la
          tarjeta. Los resúmenes no miden lo mismo, y sin esto los
          botones quedaban a alturas distintas. El `mb-5` de arriba es
          el aire mínimo. */}
      <VerMas className="mt-auto" />
    </Link>
  );
}

export default function Productos() {
  return (
    <div>
      {/* Dos productos: dos columnas a partir de `sm`, con un ancho
          máximo para que cada tarjeta no se estire a media pantalla. */}
      <div className="mx-auto grid max-w-[820px] gap-5 sm:grid-cols-2">
        {/* 1 · EL PASE: sellos que se suman solos y el tablero que entrega */}
        <Tarjeta id="lealtad">
          <VivoLealtad />
        </Tarjeta>

        {/* 2 · RESERVAS: de la búsqueda a la agenda, sin aprobación */}
        <Tarjeta id="marketplace">
          <VivoMarketplace />
        </Tarjeta>
      </div>

      {/* La regla de piezas.tsx: si se enseñan datos inventados hay que
          decirlo. Café Aroma, Glow Nails y María no existen — y quien
          los busque en el directorio tiene que saberlo antes. */}
      <NotaDemo>
        Demostraciones con datos de muestra: los negocios y las personas
        no son reales.
      </NotaDemo>
    </div>
  );
}
