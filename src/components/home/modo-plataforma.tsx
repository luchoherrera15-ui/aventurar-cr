import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import HeaderPlataforma from "@/components/home/plataforma/header-plataforma";
import CuatroProductos from "@/components/home/plataforma/cuatro-productos";
import Cadena from "@/components/home/plataforma/cadena";
import QueNegocio from "@/components/home/plataforma/que-negocio";
import UnPanel from "@/components/home/plataforma/un-panel";
import Lealtad from "@/components/home/plataforma/lealtad";
import { Encabezado, Seccion, TITULO_GRANDE } from "@/components/home/plataforma/piezas";
import { hayProductosPagos } from "@/lib/productos";
import { DATOS_ORGANIZACION } from "@/lib/seo-organizacion";

/**
 * ════════════════════════════════════════════════════════════════════
 *  MODO PLATAFORMA — qué es Bookea, atacando el problema de frente
 * ════════════════════════════════════════════════════════════════════
 *
 * Lo que ve quien llega a `bookea.lat` sin buscar nada. La otra mitad
 * del home vive en `modo-descubrir.tsx`; quién contesta lo decide
 * `src/lib/home-modo.ts`.
 *
 * ── LA VUELTA DEL 24 SEP 2026: EL PROBLEMA PRIMERO ──────────────────
 *
 * Pedido del dueño: «regenerar este home bien estructurado, que
 * expliquemos fácil qué ofrecemos, qué soluciones damos, atacar el
 * problema directamente». El guion completo —a quién le hablamos, qué
 * se promete y qué no— está en `docs/bookea-producto.md` §10; esta
 * página lo ejecuta:
 *
 *   1. Héroe          la promesa: digitalizá tu negocio, vendé más
 *   2. Cadena         cómo se conecta todo, en cuatro pasos
 *   3. Productos      los cuatro, con su «antes» tachado
 *   4. ¿Qué tenés?    gastronomía · tienda · citas — el onboarding
 *                     empieza acá, con la misma pregunta del alta
 *   5. Un panel       el lado del dueño: menú lateral y comandas
 *   6. Lealtad        destacada aparte: es donde nos enfatizamos
 *   7. Marketplace    y además, clientes nuevos
 *   8. Precio         gratis mientras arranca, sin letra chica
 *   9. Cierre         la puerta, otra vez
 *
 * La versión anterior (titular + cuatro teléfonos, 23 sep) explicaba
 * QUÉ vendemos pero no QUÉ resolvemos. Ahora el héroe da la promesa
 * en las palabras del dueño («digitalizá tu negocio, aumentá tus
 * ventas») y el PROBLEMA lo cuentan las secciones que siguen: el
 * «antes» tachado de cada producto y el dolor de cada rubro.
 *
 * ── LA REGLA QUE SIGUE VIGENTE ──────────────────────────────────────
 *
 * Solo se promete lo que el repositorio respalda: sin prueba social
 * (hay CERO reseñas), sin cifras inventadas, sin «reservá tu mesa»,
 * sin nombrar a «Linksy», y las Automatizaciones con su «muy pronto»
 * mientras la app de Meta no exista. Celebrar y Foorkie no aparecen:
 * son productos aparte (decisiones congeladas #3 y #4).
 */

/**
 * El ancla del catálogo.
 *
 * ⚠️ TIENE QUE EXISTIR EN LOS DOS MODOS. El buscador navega a
 * `…#catalogo`, y cuando alguien lo envía VACÍO `urlBusqueda()` no
 * emite ningún parámetro: la URL queda en `/#catalogo`, o sea el modo
 * Plataforma. Sin este id, esa persona aterriza en el héroe sin
 * entender por qué. Lo lleva la sección de los cuatro productos, que
 * es donde está la puerta al marketplace.
 */
export const ID_CATALOGO = "catalogo";

/**
 * El titular, cada frase en su renglón.
 *
 * Primero salió con el problema («Tu menú está en una foto…»), pero el
 * dueño lo pidió directo al beneficio (24 sep 2026): «digitalizá tu
 * negocio, aumentá tus ventas». El problema no se perdió: lo cuentan
 * el «antes» tachado de cada producto y las tarjetas de rubro.
 */
const TITULAR = ["Digitalizá tu negocio.", "Aumentá tus ventas."] as const;

export default function ModoPlataforma() {
  return (
    <div className="home-plataforma flex min-h-screen flex-col overflow-x-clip bg-[color:var(--papel)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS_ORGANIZACION) }}
      />

      <HeaderPlataforma />

      <main className="flex-1">
        {/* ── 1 · EL HÉROE: el problema, con nombre ──────────────── */}
        <section className="mx-auto w-full max-w-[1200px] px-5 pb-4 pt-12 text-center sm:px-8 sm:pt-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--linea)] bg-white px-4 py-2 text-[12.5px] font-extrabold text-[color:var(--tinta)] shadow-[0_2px_10px_-4px_rgba(20,22,26,0.18)]">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-[color:var(--acento)]"
            />
            La plataforma de tu negocio
          </span>

          {/* Dos renglones, un golpe cada uno. `block` y no `<br>`: el
              salto es contenido, no maquetación, y así la frase entera
              sigue siendo UN h1 para Google y los lectores. */}
          <h1 className={`mx-auto mt-6 max-w-[21ch] ${TITULO_GRANDE}`}>
            {TITULAR.map((d) => (
              <span key={d} className="block">
                {d}
              </span>
            ))}
          </h1>

          <p className="mx-auto mt-6 max-w-[600px] text-pretty text-[17px] leading-relaxed text-[color:var(--tinta-suave)] sm:text-[20px]">
            Tu página, tus pedidos, tus reservas y tu plan de lealtad, en
            un solo panel — y todos hablando entre sí.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {/* `/empezar` muestra los cuatro productos y deja elegir —
                el orden que pidió el dueño: ver qué hay, elegir, y
                recién ahí registrarse. */}
            <Link href="/empezar" className="btn-tinta">
              Empezá gratis
            </Link>
            <a href="#como-funciona" className="btn-tinta-contorno">
              Ver cómo funciona
            </a>
          </div>
        </section>

        {/* ── 2 · LA CADENA: una cosa lleva a la otra ────────────── */}
        <Cadena />

        {/* ── 3 · LOS CUATRO PRODUCTOS ───────────────────────────── */}
        <Seccion id={ID_CATALOGO}>
          <Encabezado rotulo="Lo que te llevás" titulo="Cuatro productos. Un solo lugar.">
            Cada uno funciona solo; juntos se potencian. Y todos arrancan
            gratis.
          </Encabezado>
          <div className="mt-12 sm:mt-14">
            <CuatroProductos />
          </div>
        </Seccion>

        {/* ── 4 · ¿QUÉ NEGOCIO TENÉS? ────────────────────────────── */}
        <QueNegocio />

        {/* ── 5 · UN PANEL, TODO SINCRONIZADO ────────────────────── */}
        <UnPanel />

        {/* ── 6 · LEALTAD, DESTACADA ─────────────────────────────── */}
        {/* Sección aparte y no una tarjeta más: es el producto donde
            el dueño quiere enfatizarse. La sección es la que ya
            existía, con el pase de verdad (`VistaPase`) adentro. */}
        <Lealtad />

        {/* ── 7 · EL MARKETPLACE: clientes nuevos ────────────────── */}
        <Seccion id="marketplace">
          <Encabezado
            rotulo="El directorio"
            titulo="Y además, te encontramos clientes nuevos."
          >
            Los negocios de citas y de eventos aparecen en el directorio
            de Bookea, donde la gente ya está buscando.
          </Encabezado>
          <div className="mt-9 text-center">
            <Link href="/all" className="btn-tinta-contorno">
              Ver el directorio
            </Link>
          </div>
        </Seccion>

        {/* ── 8 · EL PRECIO, SIN LETRA CHICA ─────────────────────── */}
        {/* La condición lee el catálogo: el día que un producto tenga
            precio, esta sección desaparece sola en vez de mentir. */}
        {!hayProductosPagos() && (
          <Seccion id="precio">
            <Encabezado rotulo="Precio" titulo="Gratis mientras arrancamos.">
              Sin tarjeta y sin letra chica. Si algún día algo pasa a ser
              pago, te lo decimos antes.
            </Encabezado>
          </Seccion>
        )}

        {/* ── 9 · EL CIERRE ──────────────────────────────────────── */}
        <Seccion id="cierre">
          <div className="mx-auto max-w-[760px] text-center">
            <h2 className={TITULO_GRANDE}>Creá tu página en cinco minutos.</h2>
            <div className="mt-8">
              <Link href="/empezar" className="btn-tinta">
                Empezá gratis
              </Link>
            </div>
          </div>
        </Seccion>
      </main>

      <SiteFooter />
      <RevealOnScroll />
    </div>
  );
}
