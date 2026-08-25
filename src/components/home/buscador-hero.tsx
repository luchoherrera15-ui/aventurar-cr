"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconSearch } from "@/components/icons";
import {
  PESTANAS,
  TEXTOS,
  urlBusqueda,
  type PestanaBuscador,
} from "@/components/buscador-home-datos";
import { PAISES } from "@/lib/paises";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL BUSCADOR DEL HÉROE — una cápsula de cuatro tramos
 * ════════════════════════════════════════════════════════════════════
 *
 *   [ ¿Qué buscás? │ ¿Dónde? │ ¿Cuándo? ] ( Buscar )
 *
 * ── NO ARMA URLs: LLAMA AL EMBUDO QUE YA EXISTE ─────────────────────
 *
 * `urlBusqueda()` de `buscador-home-datos.ts` ya es el único lugar del
 * repo que convierte campos en una URL de directorio, y ya trae las tres
 * reglas que importan: lo vacío no viaja, lo inválido se descarta acá y
 * no allá, y Costa Rica no se emite porque es el caso por defecto de
 * todo el sitio. Escribir un segundo armador habría sido tener dos
 * embudos que se despegan a la primera.
 *
 * ── LAS DOS PESTAÑAS SON LAS DOS VERTICALES QUE SE PUEDEN BUSCAR ────
 *
 * `/hospedajes` NO lee `?q=` ni `?provincia=` —su firma es literalmente
 * `{ categoria?: … }`— así que ofrecerlo como destino sería mandar a
 * alguien a una lista que ignora lo que escribió. A Hospedaje se llega
 * por el mega menú, que sí filtra por categoría. Ese criterio es el
 * mismo que ya documentaba el buscador anterior.
 *
 * ── EL BOTÓN ES NAVY, Y NO ES UNA ELECCIÓN ESTÉTICA ─────────────────
 *
 * Blanco sobre el naranja de marca (#ee7420) da 2,94:1: reprueba el
 * 4,5:1 de texto normal Y el 3:1 de texto grande. Navy con letra blanca
 * da 13,88:1. Si alguna vez se quiere naranja de verdad, el único que
 * pasa es `--orange-fuerte` (#a83f00), con 6,22:1. Lo que no se puede
 * es #ee7420 con letra blanca.
 *
 * ── PREPARADO PARA LA BÚSQUEDA INTELIGENTE ──────────────────────────
 *
 * El día que Bookea interprete «Villa para 8 personas en Guanacaste», lo
 * que cambia es `urlBusqueda` —o una función que la envuelva— y ningún
 * componente de esta pantalla. Por eso acá no hay una sola regla de
 * ruteo: se juntan los campos y se delega.
 */

/** Las siete provincias, de la misma lista que valida `urlBusqueda`. */
const PROVINCIAS = PAISES.find((p) => p.codigo === "cr")?.regiones ?? [];

const TRAMO = "flex min-w-0 flex-1 flex-col justify-center px-5 py-2.5 text-left";
const ROTULO = "text-[11.5px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft";
const CONTROL =
  "w-full truncate bg-transparent text-[14.5px] font-semibold text-aventurea-ink outline-none placeholder:font-normal placeholder:text-aventurea-ink-soft";

export default function BuscadorHero() {
  const router = useRouter();
  const [pestana, setPestana] = useState<PestanaBuscador>("citas");
  const [texto, setTexto] = useState("");
  const [provincia, setProvincia] = useState("");

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    router.push(urlBusqueda(pestana, { q: texto, provincia, pais: "cr" }));
  }

  return (
    <div className="mx-auto mt-9 w-full max-w-[860px]">
      {/* Las dos puertas del buscador. Un `radiogroup` de verdad y no dos
          botones sueltos: así el lector de pantalla anuncia «1 de 2» y
          las flechas se mueven entre ellas de fábrica. */}
      <div
        role="radiogroup"
        aria-label="Qué querés buscar"
        className="mx-auto mb-4 inline-flex items-center gap-1 rounded-full border border-aventurea-line bg-white/70 p-1"
      >
        {PESTANAS.map((id) => {
          const activa = pestana === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => setPestana(id)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors duration-200 ${
                activa
                  ? "bg-[color:var(--navy)] text-white"
                  : "text-aventurea-ink-soft hover:text-aventurea-ink"
              }`}
            >
              {TEXTOS[id].label}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={buscar}
        className="flex flex-col items-stretch overflow-hidden rounded-3xl border border-aventurea-line bg-white shadow-[0_24px_60px_-28px_rgba(16,47,82,0.35)] transition-shadow focus-within:shadow-[0_28px_70px_-26px_rgba(16,47,82,0.45)] sm:flex-row sm:items-center sm:rounded-full"
      >
        <label className={TRAMO}>
          <span className={ROTULO}>Qué buscás</span>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={100}
            // El ejemplo cambia con la pestaña: «Uñas, masajes,
            // barbería…» enseña qué se puede pedir mucho mejor que un
            // «Servicio, negocio o experiencia» que no compromete nada.
            placeholder={TEXTOS[pestana].placeholderQue}
            className={CONTROL}
          />
        </label>

        <span aria-hidden className="mx-2 hidden h-8 w-px bg-aventurea-line sm:block" />
        <span aria-hidden className="mx-5 h-px bg-aventurea-line sm:hidden" />

        <label className={TRAMO}>
          <span className={ROTULO}>Dónde</span>
          {/* `<select>` nativo y no un desplegable propio: accesible de
              fábrica, con la rueda nativa en el teléfono, y no suma un
              panel más que cerrar y que le pelee el foco al mega menú. */}
          <select
            value={provincia}
            onChange={(e) => setProvincia(e.target.value)}
            className={`${CONTROL} cursor-pointer`}
          >
            <option value="">Todo el país</option>
            {PROVINCIAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <span aria-hidden className="mx-2 hidden h-8 w-px bg-aventurea-line sm:block" />
        <span aria-hidden className="mx-5 h-px bg-aventurea-line sm:hidden" />

        {/* ── EL CUARTO TRAMO EXISTE, PERO NO MIENTE ──────────────────
            El dueño pidió un campo de fecha, y el ritmo visual de cuatro
            tramos es parte del pedido. Pero HOY no hay ningún directorio
            que lea una fecha: en Citas la disponibilidad se calcula
            negocio por negocio (no existe una consulta que responda
            «quién tiene campo el martes» para el directorio entero), y en
            Eventos solo aplicaría a la categoría «lugares». Y el atajo de
            plegar la fecha dentro de `?q=` tampoco sirve: solo `/eventos`
            interpreta fechas escritas — mandarle «barbería 3 de agosto» a
            `/citas`, que hace un `includes` plano, devuelve CERO
            resultados.

            Un control que no filtra nada es un control que miente, así
            que se muestra deshabilitado y diciendo qué es. Encenderlo es
            una consulta de disponibilidad agregada por vertical, que es
            trabajo propio y no un detalle de este buscador. */}
        <div className={`${TRAMO} opacity-55`} aria-disabled>
          <span className={ROTULO}>Cuándo</span>
          <span className="truncate text-[14.5px] font-semibold text-aventurea-ink-soft">
            Próximamente
          </span>
        </div>

        <div className="p-2">
          <button
            type="submit"
            className="presionable flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 text-[14.5px] font-extrabold text-white sm:w-auto"
            style={{ background: "var(--navy)" }}
          >
            <IconSearch aria-hidden className="h-4 w-4" />
            Buscar
          </button>
        </div>
      </form>
    </div>
  );
}
