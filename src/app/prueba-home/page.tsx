import type { Metadata } from "next";
import Link from "next/link";
import { IDEAS } from "./ideas-home";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /prueba-home — las veinte miniaturas, para descartar rápido
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «dame 20 diseños de cómo podríamos
 * hacer el home para ver cuál decidimos, pensá como un verdadero
 * diseñador de sitios web».
 *
 * ── CÓMO SE USA ESTA PÁGINA ─────────────────────────────────────────
 *
 * No se elige una de veinte: se DESCARTAN diecisiete. Se recorre rápido
 * marcando las tres que no dan ganas de cerrar, y esas tres se dibujan
 * a tamaño real con contenido de verdad. Elegir en miniatura y
 * construir una sola es cómo se ahorra una semana.
 *
 * Están agrupadas por lo que resuelven, porque comparar «carrusel» con
 * «precio de titular» no tiene sentido: son respuestas a preguntas
 * distintas. Dentro de cada grupo sí compiten entre ellas.
 *
 * ⚠️ DESECHABLE y sin indexar. Se borra la carpeta entera cuando haya
 * decisión.
 *
 * Lleva `home-plataforma` porque los wireframes usan sus tokens
 * (`--tinta`, `--papel`, `--acento`…), acotados a ese ámbito.
 */

export const metadata: Metadata = {
  title: "20 ideas para el home",
  robots: { index: false, follow: false },
};

/**
 * Los grupos. El número es el índice dentro de `IDEAS`, no el orden de
 * la pantalla: así se puede reordenar la galería sin tocar la lista.
 */
const GRUPOS: { titulo: string; nota: string; ideas: number[] }[] = [
  {
    titulo: "Los cuatro productos, uno al lado del otro",
    nota: "Todos caben arriba. La pregunta es si pesan igual o hay uno que manda.",
    ideas: [0, 1, 3, 18],
  },
  {
    titulo: "Uno grande, el resto después",
    nota: "Se sacrifica ver los cuatro de una para que el producto se vea de verdad.",
    ideas: [2, 7, 10, 19],
  },
  {
    titulo: "Los cuatro, pero de a uno",
    nota: "Ocupan el lugar de uno y se turnan. Cambia quién controla el ritmo.",
    ideas: [4, 8, 14, 15],
  },
  {
    titulo: "Sin mockup, o casi",
    nota: "La carga la lleva el texto. Cargan rapidísimo y envejecen bien.",
    ideas: [9, 5, 17],
  },
  {
    titulo: "Empezar por otro lado",
    nota: "No por el producto: por el precio, por el rubro de la persona, o por su problema.",
    ideas: [11, 12, 13],
  },
  {
    titulo: "Cambios de piel",
    nota: "La misma estructura con otra atmósfera. Se pueden combinar con cualquiera de arriba.",
    ideas: [16, 6],
  },
];

function Ficha({ i }: { i: number }) {
  const idea = IDEAS[i];
  return (
    <article className="flex flex-col">
      {/* La miniatura es el enlace: al revisar, uno toca el dibujo, no
          el renglón de abajo. */}
      <Link
        href={`/prueba-home/${idea.n}`}
        className="group block rounded-[10px] outline-offset-4 transition-transform hover:-translate-y-0.5"
      >
        {idea.wire}
      </Link>

      <div className="mt-3">
        <h3 className="flex items-baseline gap-2 text-[15px] font-extrabold text-[color:var(--tinta)]">
          <span className="text-[11px] font-extrabold tabular-nums text-[color:var(--acento)]">
            {idea.n}
          </span>
          <Link
            href={`/prueba-home/${idea.n}`}
            className="hover:text-[color:var(--acento)]"
          >
            {idea.nombre}
          </Link>
        </h3>
        <p className="mt-1 text-[12.5px] leading-snug text-[color:var(--tinta-suave)]">
          {idea.idea}
        </p>

        <dl className="mt-2.5 space-y-1.5">
          <div className="flex gap-2">
            <dt className="mt-[1px] shrink-0 text-[9px] font-extrabold uppercase tracking-wide text-[color:var(--ok)]">
              Gana
            </dt>
            <dd className="text-[11.5px] leading-snug text-[color:var(--tinta-suave)]">
              {idea.gana}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="mt-[1px] shrink-0 text-[9px] font-extrabold uppercase tracking-wide text-[color:var(--aviso)]">
              Pierde
            </dt>
            <dd className="text-[11.5px] leading-snug text-[color:var(--tinta-suave)]">
              {idea.pierde}
            </dd>
          </div>
        </dl>

        <Link
          href={`/prueba-home/${idea.n}`}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[color:var(--acento)] hover:underline"
        >
          Verla a tamaño real
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

export default function PruebaHome() {
  return (
    <div className="home-plataforma min-h-screen bg-[color:var(--papel)]">
      <header className="mx-auto w-full max-w-[1280px] px-5 py-14 sm:px-8">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--acento)]">
          Veinte maneras
        </p>
        <h1 className="titulo mt-3 max-w-[18ch] text-[clamp(30px,4.4vw,46px)] leading-[1.08] text-[color:var(--tinta)]">
          Cómo podría ser el home.
        </h1>
        <p className="mt-5 max-w-[68ch] text-[16px] leading-relaxed text-[color:var(--tinta-suave)]">
          Están en gris a propósito: lo que se elige acá es la estructura, no
          el contenido. Si cada una llevara su foto y su titular, ganaría la
          foto más linda en vez de la composición que mejor explica Bookea.
        </p>
        <p className="mt-3 max-w-[68ch] text-[16px] leading-relaxed text-[color:var(--tinta-suave)]">
          <strong>Las veinte están construidas de verdad</strong>: tocá
          cualquier miniatura y la ves a tamaño real, con los mockups que
          corren solos y el texto de producción. Desde ahí se salta de una a
          otra con la barra de abajo.
        </p>
        <p className="mt-3 max-w-[68ch] text-[16px] leading-relaxed text-[color:var(--tinta-suave)]">
          No elijas una de veinte: <strong>descartá diecisiete</strong>.
        </p>

        {/* La 21 llegó después, con /celebrar como referencia. Va acá
            arriba y no en un grupo porque es la única que cambia el
            fondo de la pantalla entera: no compite con las otras, es
            otra categoría. */}
        <Link
          href="/prueba-home/21"
          className="group mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[16px] bg-[#16295e] px-6 py-5 text-white transition-colors hover:bg-[#1d3576]"
        >
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums">
            21
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-extrabold">
              Héroe marino, tipografía grande
            </span>
            <span className="mt-0.5 block text-[13.5px] text-white/70">
              La anatomía de Celebrar con la identidad de Bookea: fondo a
              sangre, titular de 72 px y cuatro negocios de verdad rotando
              en el teléfono.
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-4 py-2 text-[13px] font-extrabold text-[#16295e]">
            Verla
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </Link>
      </header>

      {GRUPOS.map((g) => (
        <section
          key={g.titulo}
          className="border-t border-[color:var(--linea)] px-5 py-12 sm:px-8"
        >
          <div className="mx-auto w-full max-w-[1280px]">
            <div className="mb-8">
              <h2 className="titulo text-[22px] text-[color:var(--tinta)]">
                {g.titulo}
              </h2>
              <p className="mt-1 max-w-[70ch] text-[14px] leading-snug text-[color:var(--tinta-suave)]">
                {g.nota}
              </p>
            </div>

            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
              {g.ideas.map((i) => (
                <Ficha key={i} i={i} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <footer className="border-t border-[color:var(--linea)] px-5 py-14 sm:px-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <h2 className="titulo text-[22px] text-[color:var(--tinta)]">
            Si me preguntás a mí
          </h2>
          <p className="mt-3 max-w-[72ch] text-[15px] leading-relaxed text-[color:var(--tinta-suave)]">
            La <strong>02 (bento)</strong> para la estructura: es la única que
            deja decir que un producto importa más que otro sin escribirlo. La{" "}
            <strong>11 (la demo es la portada)</strong> metida adentro de una
            de sus cajas, porque enseñar el producto funcionando es más fuerte
            que cualquier foto. Y la <strong>13 (¿qué negocio tenés?)</strong>{" "}
            como segundo piso, cuando haya contenido por rubro para sostenerla.
          </p>
          <p className="mt-3 max-w-[72ch] text-[15px] leading-relaxed text-[color:var(--tinta-suave)]">
            Las que yo descartaría primero: la <strong>18</strong> —doce cosas
            iguales contradicen que sean cuatro productos— y la{" "}
            <strong>16</strong>, porque el scroll secuestrado en teléfono sale
            mal casi siempre.
          </p>
        </div>
      </footer>
    </div>
  );
}
