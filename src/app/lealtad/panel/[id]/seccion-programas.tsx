"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  conteoPorFiltro,
  estadoVisible,
  filtrar,
  ETIQUETA_ESTADO,
  FILTROS,
  TONO_ESTADO,
  type FiltroPrograma,
} from "@/lib/lealtad/programas";
import { TIPOS_TARJETA, tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { PildoraEstado } from "@/components/panel/piezas";
import { CUERPO_SUAVE, GAP_TABLERO, RADIO_CARD, RADIO_TILE } from "@/components/panel/sistema";
import {
  ACCION,
  ACCION_BORDE,
  ACCION_TINTA,
  ACCION_TINTE,
  BOTON_ACCION,
  ESTADO_DE_TONO,
} from "../sistema-lealtad";
import { Icono, type NombreIcono } from "./iconos";

/**
 * LA LISTA DE TARJETAS del negocio.
 *
 * Reemplaza la suposición de que hay UN programa por negocio: desde la
 * 0134 puede haber varios (2 en Esencial, 6 en Crece, 15 en Pro), y
 * esta es la pantalla donde se ven todos.
 *
 * ------------------------------------------------------------------
 * LOS ESTADOS DE LA PANTALLA
 * ------------------------------------------------------------------
 * Vacío, sin resultados, sin permiso y tope alcanzado son CUATRO
 * mensajes distintos, no uno genérico. Cada uno lleva a una acción
 * distinta: crear la primera, cambiar el filtro, pedirle acceso al
 * dueño, o subir de paquete. Un «no hay nada» para los cuatro deja a
 * la persona sin saber qué hacer.
 *
 * Y NADA de esto es información de ejemplo: si el negocio no tiene
 * tarjetas, se dice que no tiene. Sembrar una de mentira en un panel
 * operativo es la forma más rápida de que alguien la comparta con un
 * cliente.
 */

export type ProgramaEnLista = {
  id: string;
  nombre: string;
  modo: string | null;
  estado: string | null;
  activo: boolean;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  colorFondo: string | null;
  /** Miembros afiliados a ESTE programa. */
  miembros: number;
  /**
   * `programa_lealtad.created_at`. No lo dibuja esta sección: viaja
   * porque el panel le pasa ESTA MISMA lista a `elegirPrograma`, que
   * desempata por antigüedad. Sin el campo, todas las filas llegaban
   * sin fecha y el desempate caía al uuid — o sea que el panel elegía
   * como principal una tarjeta distinta de la que sirve el link
   * público y de la que entrega el pase. En Pura Matcha eso ponía de
   * principal el evento de 2 clientes en vez de la tarjeta de sellos
   * de 31. Ver `programa-principal.ts`.
   *
   * OBLIGATORIO —y `| null` en vez de opcional— justamente por eso: el
   * compilador tiene que rebotar al próximo que arme esta lista y se
   * olvide de la fecha. Un `?` habría dejado volver el mismo bug en
   * silencio.
   */
  created_at: string | null;
};

export default function SeccionProgramas({
  ranchoId,
  programas,
  ahoraCR,
  puedeCrear,
  topeAlcanzado,
  topePlan,
}: {
  ranchoId: string;
  programas: ProgramaEnLista[];
  /** El momento actual en hora de Costa Rica, calculado en el servidor. */
  ahoraCR: string;
  /** false = colaborador: ve las tarjetas, no las crea. */
  puedeCrear: boolean;
  topeAlcanzado: boolean;
  topePlan: number | null;
}) {
  const [filtro, setFiltro] = useState<FiltroPrograma>("todos");

  const conteo = useMemo(() => conteoPorFiltro(programas, ahoraCR), [programas, ahoraCR]);
  const visibles = useMemo(
    () => filtrar(programas, filtro, ahoraCR),
    [programas, filtro, ahoraCR],
  );

  // ── Vacío de verdad: el negocio no tiene ninguna ────────────────
  if (programas.length === 0) {
    return (
      <div
        className={`${RADIO_CARD} border border-dashed border-aventurea-line bg-aventurea-cream-2 px-6 py-12 text-center`}
      >
        <span
          aria-hidden
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
          style={{ background: ACCION_TINTE, color: ACCION }}
        >
          <Icono nombre="tarjeta" className="h-7 w-7" />
        </span>
        <p className="titulo mt-4 text-[18px] leading-tight tracking-[-0.02em] text-white">
          Todavía no tenés ninguna tarjeta
        </p>
        <p className="mx-auto mt-1.5 max-w-[420px] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          Creá la primera y tus clientes van a poder llevarla en el teléfono. Se arma en
          cinco pasos, con una última mirada antes de publicarla.
        </p>
        {puedeCrear ? (
          <Link
            href={`/lealtad/panel/${ranchoId}/crear`}
            className={`${BOTON_ACCION} presionable mt-5`}
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            Crear mi primera tarjeta →
          </Link>
        ) : (
          <p className="mt-5 text-[12.5px] text-aventurea-ink-soft">
            Pedile al dueño del negocio que cree la primera.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      {/* ── Crear / tope del plan ──────────────────────────────── */}
      {puedeCrear &&
        (topeAlcanzado ? (
          <div
            className={`${RADIO_TILE} border px-4 py-3.5`}
            style={{ borderColor: ACCION_BORDE, background: ACCION_TINTE }}
          >
            <p className="text-[13.5px] font-extrabold leading-tight text-aventurea-ink">
              Llegaste al tope de tu paquete
              {topePlan !== null ? `: ${topePlan} tarjeta${topePlan === 1 ? "" : "s"}` : ""}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
              Las que ya tenés siguen funcionando y sus clientes no pierden nada. Para crear
              otra, abrí la que ya no usás en la lista de abajo y archivala desde{" "}
              <strong className="font-bold text-aventurea-ink">Estado</strong> —el cupo se
              libera al instante— o subí de paquete.
            </p>
            <Link
              href={`/lealtad/planes?negocio=${ranchoId}`}
              className={`${BOTON_ACCION} presionable mt-3`}
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
              Ver paquetes →
            </Link>
          </div>
        ) : (
          <Link
            href={`/lealtad/panel/${ranchoId}/crear`}
            className={`presionable flex items-center justify-between gap-3 ${RADIO_TILE} border px-4 py-3.5`}
            style={{ borderColor: ACCION_BORDE, background: ACCION_TINTE }}
          >
            <span className="min-w-0">
              <span className="block text-[13.5px] font-extrabold leading-tight text-aventurea-ink">
                Crear una tarjeta
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-aventurea-ink-soft">
                Sellos, puntos, cupón, descuento, membresía, gift card, evento o cashback.
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-[18px]" style={{ color: ACCION }}>
              →
            </span>
          </Link>
        ))}

      {/* ── Filtros + el botón «+» ─────────────────────────────────
          El «+» redondo lo pidió el dueño para los paquetes pagos:
          quien tiene derecho a más tarjetas crea la siguiente sin
          buscar el banner. Mismas condiciones que el banner (puede
          crear y hay cupo) — el cupo real lo decide el plan, así que
          en Prueba (1 tarjeta) el tope ya alcanzado lo esconde solo. */}
      <div className="flex items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar tarjetas">
        {FILTROS.map((f) => {
          const n = conteo[f.id];
          const puesto = filtro === f.id;
          // Un filtro que siempre daría cero solo agrega ruido. «Todas»
          // se queda siempre para poder volver.
          if (n === 0 && f.id !== "todos" && !puesto) return null;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={puesto}
              onClick={() => setFiltro(f.id)}
              /* El chip apagado pasa a la superficie de tarjeta del
                 sistema (borde sólido + letra de texto, 16,79:1) en vez
                 de dos alfas de blanco: así un filtro sin elegir se lee
                 igual que cualquier otro control del panel, y su
                 contraste se mide una sola vez. */
              className={`presionable rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                puesto
                  ? "bg-[color:var(--accion-claro)] text-[color:var(--accion-claro-tinta)]"
                  : "border border-aventurea-line bg-aventurea-surface text-aventurea-ink hover:border-aventurea-navy"
              }`}
            >
              {f.etiqueta}
              {/* El contador es el dato secundario del chip, pero
                  «secundario» no puede significar invisible: el navy al
                  70 % sobre el azul de acción da 4,83:1, y el gris de
                  texto del panel sobre el chip apagado, 6,81:1. */}
              <span className={puesto ? "text-[#364367]" : "text-aventurea-ink-soft"}> {n}</span>
            </button>
          );
        })}
      </div>
      {puedeCrear && !topeAlcanzado && (
        <Link
          href={`/lealtad/panel/${ranchoId}/crear`}
          aria-label="Crear otra tarjeta"
          title="Crear otra tarjeta"
          className="presionable grid h-9 w-9 shrink-0 place-items-center rounded-full text-[19px] font-extrabold leading-none"
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          +
        </Link>
      )}
      </div>

      {/* ── Sin resultados en ESTE filtro (distinto de vacío) ───── */}
      {visibles.length === 0 ? (
        <div
          className={`${RADIO_TILE} border border-dashed border-aventurea-line bg-aventurea-cream-2 px-5 py-9 text-center`}
        >
          <p className="text-[13.5px] font-bold text-aventurea-ink">
            No hay tarjetas {ETIQUETA_ESTADO[filtro as keyof typeof ETIQUETA_ESTADO]?.toLowerCase() ?? ""}
          </p>
          <button
            type="button"
            onClick={() => setFiltro("todos")}
            className="presionable mt-2 text-[12.5px] font-bold text-aventurea-navy underline"
          >
            Ver todas
          </button>
        </div>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {visibles.map((p) => (
            <li key={p.id}>
              <TarjetaDeLista programa={p} ahoraCR={ahoraCR} ranchoId={ranchoId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaDeLista({
  programa,
  ahoraCR,
  ranchoId,
}: {
  programa: ProgramaEnLista;
  ahoraCR: string;
  ranchoId: string;
}) {
  const estado = estadoVisible(programa, ahoraCR);
  const tipo = TIPOS_TARJETA[tipoDe(programa.modo)];

  /* El chip pasa a ser la PÍLDORA del sistema, con el mapa de
     `sistema-lealtad`: el mismo estado se ve igual acá, en el tablero y
     en la ficha del negocio. Los tres colores que había escritos a mano
     eran los mismos que ya pinta la píldora —azul, ámbar y gris—, pero
     cada pantalla los repetía por su cuenta.

     La decisión de fondo NO cambia: «activa» sigue en azul y no en
     verde, porque el verde queda fuera de la marca de Lealtad (está
     escrito en `TONO_ESTADO`), y lo cálido sigue reservado a lo que
     pide atención. */
  const tonoPildora = ESTADO_DE_TONO[TONO_ESTADO[estado]];

  return (
    // ── CADA TARJETA A **SU** EDITOR ────────────────────────────────
    // Esto apuntaba a `#tarjeta`, la sección del panel — que cuelga de
    // la tarjeta PRINCIPAL. O sea que con dos tarjetas, tocar la B
    // abría la A, y el dueño editaba la que no quería sin que nada se
    // lo dijera. Ahora el id viaja en la ruta.
    <Link
      href={`/lealtad/panel/${ranchoId}/editar/${programa.id}`}
      className={`elevar flex h-full items-start gap-3 ${RADIO_TILE} border border-aventurea-line bg-aventurea-surface p-4 transition-colors hover:border-aventurea-navy`}
    >
      {/* El disco lleva el color REAL de la tarjeta del cliente: es lo
          que hace que la lista se reconozca de un vistazo cuando el
          negocio tiene seis. Sin color guardado cae al navy elevado. */}
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
        style={{ background: programa.colorFondo ?? "var(--navy-elevado)" }}
      >
        <Icono nombre={tipo.icono as NombreIcono} className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 truncate text-[13.5px] font-extrabold text-aventurea-ink">
            {programa.nombre}
          </span>
          <PildoraEstado estado={tonoPildora}>{ETIQUETA_ESTADO[estado]}</PildoraEstado>
        </span>

        <span className={`mt-1 block ${CUERPO_SUAVE}`}>
          {tipo.nombre}
          {" · "}
          {programa.miembros === 0
            ? "sin clientes todavía"
            : `${programa.miembros} cliente${programa.miembros === 1 ? "" : "s"}`}
        </span>

        {(programa.vigente_desde || programa.vigente_hasta) && (
          <span className="mt-1 block text-[11.5px] text-aventurea-ink-soft">
            {programa.vigente_desde ?? "desde siempre"} → {programa.vigente_hasta ?? "sin fin"}
          </span>
        )}
      </span>
    </Link>
  );
}
