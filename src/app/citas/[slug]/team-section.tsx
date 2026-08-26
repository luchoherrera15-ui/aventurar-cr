"use client";

import { useState } from "react";
import type { ProfesionalPerfil, ResenaPerfil } from "./perfil-tipos";
import ProfessionalCard from "./professional-card";
import ProfessionalAvatar from "./professional-avatar";
import ProfessionalSheet from "./professional-sheet";

type Props = {
  equipo: ProfesionalPerfil[];
  resenas: ResenaPerfil[];
  onReservar: (servicioId: string | null, miembroId: string | null) => void;
};

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL EQUIPO — DOS FORMAS SEGÚN EL ANCHO
 * ════════════════════════════════════════════════════════════════════
 *
 * Sin equipo cargado la sección entera desaparece, mismo criterio que
 * ya usaba page.tsx con `equipo.length > 0 &&`.
 *
 * ── MÓVIL: CÍRCULOS ─────────────────────────────────────────────────
 *
 * Pedido del dueño (26 ago 2026): «en la versión móvil las fotos de los
 * miembros deben salir en un card circular pequeño y al darle click que
 * salga tipo INFORMACIÓN, RESEÑAS».
 *
 * La tarjeta grande ocupa media pantalla de teléfono por persona: con
 * tres del equipo hay que scrollear solo para saber cuánta gente hay.
 * El círculo lo invierte — se ve el equipo completo de un vistazo y el
 * detalle se pide tocando.
 *
 * La fila scrollea de lado en vez de envolverse. Con uno o dos se ve
 * igual que una fila normal, y con ocho no empuja el resto de la página
 * hacia abajo. Los negativos de margen la dejan sangrar hasta el borde:
 * una fila que scrollea y CORTA en el margen se lee como scrolleable;
 * una que termina justo en el margen parece que ya no tiene nada más.
 *
 * ── PANTALLA GRANDE: LAS TARJETAS DE SIEMPRE ────────────────────────
 *
 * No se tocan. Ahí sobra ancho y la tarjeta muestra de una lo que en
 * móvil hay que ir a buscar. El pedido era explícito sobre móvil.
 *
 * ── LAS DOS SON EL MISMO DOM, NO DOS ÁRBOLES ────────────────────────
 *
 * Se renderizan las dos y CSS esconde una. Es a propósito: montar según
 * el ancho medido en JavaScript obliga a esperar al cliente para saber
 * qué dibujar, y en el primer pintado la sección aparecería vacía o
 * saltaría de una forma a otra. El costo real es una lista de nombres
 * duplicada en el HTML.
 */
export default function TeamSection({ equipo, resenas, onReservar }: Props) {
  const [elegido, setElegido] = useState<ProfesionalPerfil | null>(null);
  const [hojaAbierta, setHojaAbierta] = useState(false);

  if (equipo.length === 0) return null;

  function abrirFicha(profesional: ProfesionalPerfil) {
    setElegido(profesional);
    setHojaAbierta(true);
  }

  /**
   * Reservar desde la ficha cierra la ficha y abre el motor de reserva.
   *
   * `elegido` NO se limpia acá: la hoja tarda ~260 ms en terminar de
   * salir y necesita seguir teniendo a quién dibujar durante ese rato.
   * Si se pusiera en null de una, el contenido se vaciaría a mitad de
   * la animación.
   *
   * Las dos capas pueden solaparse un instante y eso ya es seguro: el
   * bloqueo del scroll va por el candado contado de
   * `@/lib/bloqueo-scroll`. Sin él, la página quedaba congelada para
   * siempre al cerrar la segunda.
   */
  function reservarDesdeFicha(servicioId: string | null, miembroId: string | null) {
    setHojaAbierta(false);
    onReservar(servicioId, miembroId);
  }

  return (
    <div className="mt-9">
      <h2 className="titulo text-[18px] text-aventurea-navy">El equipo</h2>

      {/* ---------- Móvil: la fila de círculos ---------- */}
      <div className="sm:hidden">
        {/* `py-1` y no solo `pb-1`: al poner `overflow-x-auto` el
            navegador vuelve `overflow-y` AUTO también, así que esta
            caja recorta por arriba. Sin aire adentro, el anillo de foco
            del círculo —que se dibuja por FUERA del botón— quedaba
            cortado, y quien navega con teclado perdía la única señal de
            dónde está parado. El `mt-3` no sirve para eso: es margen,
            queda fuera de la caja que recorta. */}
        <ul className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {equipo.map((profesional) => (
            <li key={profesional.id}>
              <ProfessionalAvatar
                profesional={profesional}
                onAbrir={() => abrirFicha(profesional)}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* ---------- Pantalla grande: las tarjetas ---------- */}
      <div className="mt-3 hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {equipo.map((profesional) => (
          <ProfessionalCard
            key={profesional.id}
            profesional={profesional}
            onReservar={onReservar}
          />
        ))}
      </div>

      <ProfessionalSheet
        profesional={elegido}
        resenas={resenas}
        abierta={hojaAbierta}
        onCerrar={() => setHojaAbierta(false)}
        onReservar={reservarDesdeFicha}
      />
    </div>
  );
}
