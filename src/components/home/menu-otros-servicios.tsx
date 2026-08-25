"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GRUPOS } from "@/components/home/grupos-categorias";

/**
 * EL BOTÓN «⋯» DEL HÉROE, JUNTO A LA LUPA — segunda vuelta (pedido del
 * dueño, ago 2026): el botón de texto «Otros servicios» pasa a ser un
 * ícono de tres puntos, chico y redondo, a la par del buscador. Y el
 * panel se ACOTA: ya no las cuatro verticales del marketplace ni
 * Lealtad/Invitaciones — solo Eventos y Citas y servicios (la vertical
 * `citas`, que internamente se llama "Salud y belleza" en
 * `NOMBRE_VERTICAL` — ver `grupos-categorias.tsx`), que son las dos
 * que el dueño pidió dejar a mano desde acá. Hospedajes y Restaurantes
 * siguen enteros en sus propios directorios; no desaparecieron, solo
 * ya no tienen atajo en este menú.
 *
 * `SOLO_ESTOS_GRUPOS` filtra el mismo `GRUPOS` que ya usan
 * `NavCategorias` y `ExplorarRubros` — nada de taxonomía nueva, así que
 * si mañana se agrega un rubro a Eventos o a Citas, aparece acá solo.
 *
 * Sigue el mismo patrón de accesibilidad que ya tenía este componente:
 * aria-expanded/haspopup/controls, cierre con click afuera y con
 * Escape devolviendo el foco al botón.
 */
const SOLO_ESTOS_GRUPOS = new Set(["eventos", "citas"]);
const GRUPOS_DEL_MENU = GRUPOS.filter((g) => SOLO_ESTOS_GRUPOS.has(g.id));

export default function MenuOtrosServicios() {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    function alTocarFuera(e: PointerEvent) {
      const objetivo = e.target as Node;
      if (botonRef.current?.contains(objetivo)) return;
      if (panelRef.current?.contains(objetivo)) return;
      setAbierto(false);
    }

    function alTeclado(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setAbierto(false);
      botonRef.current?.focus();
    }

    document.addEventListener("pointerdown", alTocarFuera);
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("pointerdown", alTocarFuera);
      document.removeEventListener("keydown", alTeclado);
    };
  }, [abierto]);

  return (
    <div className="relative shrink-0">
      <button
        ref={botonRef}
        type="button"
        aria-expanded={abierto}
        aria-haspopup="true"
        aria-controls="panel-otros-servicios"
        aria-label="Ver categorías de Eventos y Citas y servicios"
        onClick={() => setAbierto((v) => !v)}
        // `border-[color:var(--navy)] text-[color:var(--navy)]` como
        // CLASES y no como `style` inline: un `style` de color siempre
        // gana por especificidad sobre `hover:text-white` (una clase),
        // así que con `style` el texto se quedaba navy incluso en hover
        // — navy sobre navy, invisible. Como clases, la cascada normal
        // de Tailwind sí deja que el hover gane.
        className={`presionable flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-[20px] font-extrabold leading-none transition-colors ${
          abierto
            ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
            : "border-[color:var(--navy)] text-[color:var(--navy)] hover:bg-[color:var(--navy)] hover:text-white"
        }`}
      >
        ⋯
      </button>

      {abierto && (
        <div
          id="panel-otros-servicios"
          ref={panelRef}
          className="absolute left-1/2 top-full z-40 mt-2 max-h-[min(75vh,620px)] w-[min(92vw,560px)] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-aventurea-line bg-white p-5 text-left shadow-2xl"
        >
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft">
            Todas las categorías
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {GRUPOS_DEL_MENU.map((g) => (
              <Link
                key={g.id}
                href={g.base}
                onClick={() => setAbierto(false)}
                className="group flex items-center gap-2 text-[14px] font-extrabold text-aventurea-ink hover:text-aventurea-navy"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aventurea-sky/10 text-aventurea-orange [&_svg]:h-[15px] [&_svg]:w-[15px]">
                  <g.Icono />
                </span>
                {g.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
