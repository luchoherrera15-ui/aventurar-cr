import type { ReactNode } from "react";
import { ESTADO_MARCA, type EstadoPanel } from "@/components/panel/sistema";

/**
 * LA FILA DE UNA FICHA QUE SE ADMINISTRA, y los botones chicos que la
 * acompañan.
 *
 * `FilaPanel` (components/panel/piezas.tsx) es la fila canónica de todo
 * LISTADO: contexto · barrita · título · detalle · estado, con una sola
 * línea de detalle truncada. Es exacta para una agenda —una cita tiene
 * una hora y una persona— y se queda corta para las tres pantallas que
 * administran fichas en este panel: el catálogo, el equipo y el CRM.
 * Una ficha trae, además de su nombre:
 *
 *   · una miniatura (la foto del paquete, el avatar de quien atiende),
 *   · dos o tres líneas de detalle que NO se pueden truncar —el precio
 *     con su unidad, el correo al que se le va a escribir—, y
 *   · un racimo de cinco o seis acciones (subir, bajar, editar,
 *     duplicar, pausar, borrar) que en 390px tiene que envolver.
 *
 * Así que esta es la MISMA anatomía —barrita de estado de 4px, título
 * con sus píldoras, detalle en gris, acciones a la derecha— resuelta
 * para una fila que crece en alto. Todo el color, el radio y la escala
 * salen igual de `panel/sistema.ts`: acá no hay ni un hexadecimal.
 *
 * ── PARA EL QUE VENGA DESPUÉS ──────────────────────────────────────
 * Si aparece una cuarta pantalla con este mismo problema, esto merece
 * subir a `components/panel/piezas.tsx` como `FilaFicha` junto a
 * `FilaPanel`, y `BOTON_FILA` a `sistema.ts` como el escalón chico de
 * `BOTON_PANEL`. Se dejó acá y no allá porque hoy lo usan tres
 * pantallas de un mismo panel, y porque `components/panel/` lo están
 * tocando otras manos al mismo tiempo.
 *
 * Módulo neutro (sin "use client"): lo importan los paneles del
 * catálogo, del equipo y del CRM, que sí son de cliente.
 */

// ───────────────────────────────────────────────────────────────────
//  LOS BOTONES CHICOS DE UNA FILA
// ───────────────────────────────────────────────────────────────────
//
// `BOTON_PANEL` mide 40px de alto: es el botón de una acción de
// pantalla ("Guardar", "Agregar"). Seis de esos en una fila de 390px
// ocupan tres renglones y tapan la ficha. Este es el mismo botón un
// escalón más abajo —32px, radio 8, texto 12— para las acciones que
// pertenecen a UNA fila.
//
// Contraste: tinta #161616 sobre superficie blanca = 18,10:1 ✅ AAA.
// El borde `--line` es separador, no estado: quién está deshabilitado
// lo dice el atributo `disabled`, no el color.

export const BOTON_FILA =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-aventurea-line bg-aventurea-surface px-2.5 text-[12px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-40";

/** El cuadrado de 32px para una acción que es solo ícono (subir, bajar). */
export const BOTON_FILA_ICONO =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-aventurea-line bg-aventurea-surface text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-40";

/** La acción que destruye. Rojo en la LETRA, nunca de relleno: un
 *  "Borrar" con fondo rojo pesa lo mismo que "Guardar" y es la acción
 *  que menos veces se quiere apretar. red-700 #b91c1c sobre blanco =
 *  6,47:1 ✅ AA. */
export const BOTON_FILA_PELIGRO =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-aventurea-line bg-aventurea-surface px-2.5 text-[12px] font-bold text-red-700 transition-colors hover:border-red-700 disabled:opacity-40";

/** El racimo de acciones de una fila. Envuelve en 390px y se pega a la
 *  derecha cuando hay lugar. */
export const ACCIONES_FILA = "flex flex-wrap items-center gap-1.5";

// ───────────────────────────────────────────────────────────────────
//  LA FILA
// ───────────────────────────────────────────────────────────────────

export function FilaFicha({
  marca,
  medio,
  titulo,
  detalle,
  acciones,
  separador = true,
}: {
  /**
   * El estado de la ficha, como barrita de 4px a la izquierda — el
   * `.mark` de la maqueta. `null` = la ficha no tiene estado que
   * comunicar y la fila arranca sin barrita.
   *
   * Es lo que reemplaza al `opacity-50` que llevaban las fichas
   * pausadas: bajarle la opacidad a una fila entera le baja el
   * contraste a TODO lo que tiene adentro —nombre, precio, botones— y
   * deja el mismo estado viéndose de un color distinto según el fondo.
   * El estado lo dicen la barrita y una píldora; el texto se lee igual
   * de bien esté pausado o no.
   */
  marca?: EstadoPanel | null;
  /** La miniatura: la foto del paquete, el avatar de quien atiende. */
  medio?: ReactNode;
  /** El nombre y sus píldoras. */
  titulo: ReactNode;
  /** Una o más líneas en gris. No se truncan: acá vive el precio con su
   *  unidad y el correo al que se le va a escribir. */
  detalle?: ReactNode;
  acciones?: ReactNode;
  separador?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 px-3.5 py-3 sm:px-4 ${
        separador ? "border-b border-aventurea-line" : ""
      }`}
    >
      {marca !== undefined && marca !== null && (
        <span
          aria-hidden="true"
          className={`h-10 w-1 shrink-0 rounded-full ${ESTADO_MARCA[marca]}`}
        />
      )}
      {medio}
      <div className="flex min-w-[160px] flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-bold leading-tight text-aventurea-ink">
          {titulo}
        </div>
        {detalle && (
          <div className="flex flex-col gap-0.5 text-[12px] leading-snug text-aventurea-ink-soft">
            {detalle}
          </div>
        )}
      </div>
      {acciones}
    </div>
  );
}

/**
 * LA CAJA DE UNA LISTA DE FICHAS: el borde y el recorte que hacen que
 * las filas se lean como una sola pieza. Va DENTRO de una `Card`, así
 * que no repite ni la sombra ni el fondo — sería una tarjeta adentro de
 * otra.
 */
export const LISTA_FICHAS =
  "overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface";
