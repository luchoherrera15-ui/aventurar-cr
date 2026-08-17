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
      <div className="rounded-3xl border border-dashed border-white/20 bg-white/[0.03] px-6 py-12 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white/70">
          <Icono nombre="tarjeta" className="h-7 w-7" />
        </span>
        <p className="mt-4 text-[16px] font-extrabold text-white">
          Todavía no tenés ninguna tarjeta
        </p>
        <p className="mx-auto mt-1.5 max-w-[420px] text-[13.5px] leading-relaxed text-white/55">
          Creá la primera y tus clientes van a poder llevarla en el teléfono. Se arma en
          cinco pasos, con una última mirada antes de publicarla.
        </p>
        {puedeCrear ? (
          <Link
            href={`/lealtad/panel/${ranchoId}/crear`}
            className="presionable mt-5 inline-block rounded-xl px-5 py-3 text-[13.5px] font-extrabold"
            style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
          >
            Crear mi primera tarjeta →
          </Link>
        ) : (
          <p className="mt-5 text-[12.5px] text-white/45">
            Pedile al dueño del negocio que cree la primera.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Crear / tope del plan ──────────────────────────────── */}
      {puedeCrear &&
        (topeAlcanzado ? (
          <div
            className="rounded-2xl border px-4 py-3.5"
            style={{ borderColor: "rgba(157,180,255,.45)", background: "rgba(157,180,255,.14)" }}
          >
            <p className="text-[13.5px] font-bold text-white">
              Llegaste al tope de tu paquete
              {topePlan !== null ? `: ${topePlan} tarjeta${topePlan === 1 ? "" : "s"}` : ""}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">
              Las que ya tenés siguen funcionando y sus clientes no pierden nada. Para crear
              otra, abrí la que ya no usás en la lista de abajo y archivala desde{" "}
              <strong className="font-bold">Estado</strong> —el cupo se libera al instante—
              o subí de paquete.
            </p>
            <Link
              href={`/lealtad/planes?negocio=${ranchoId}`}
              className="presionable mt-3 inline-block rounded-xl px-4 py-2.5 text-[12.5px] font-extrabold"
              style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
            >
              Ver paquetes →
            </Link>
          </div>
        ) : (
          <Link
            href={`/lealtad/panel/${ranchoId}/crear`}
            className="presionable flex items-center justify-between rounded-2xl border px-4 py-3.5"
            style={{ borderColor: "rgba(157,180,255,.45)", background: "rgba(157,180,255,.14)" }}
          >
            <span>
              <span className="block text-[13.5px] font-extrabold text-white">
                Crear una tarjeta
              </span>
              <span className="block text-[12px] text-white/60">
                Sellos, puntos, cupón, descuento, membresía, gift card, evento o cashback.
              </span>
            </span>
            <span aria-hidden className="ml-3 shrink-0 text-[18px]" style={{ color: "var(--accion-claro)" }}>
              →
            </span>
          </Link>
        ))}

      {/* ── Filtros ────────────────────────────────────────────── */}
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
              className={`presionable rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                puesto ? "bg-white text-[#062653]" : "bg-white/10 text-white/65 hover:bg-white/20"
              }`}
            >
              {f.etiqueta}
              <span className={puesto ? "text-[#53657f]" : "text-white/40"}> {n}</span>
            </button>
          );
        })}
      </div>

      {/* ── Sin resultados en ESTE filtro (distinto de vacío) ───── */}
      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 px-5 py-9 text-center">
          <p className="text-[13.5px] font-bold text-white/80">
            No hay tarjetas {ETIQUETA_ESTADO[filtro as keyof typeof ETIQUETA_ESTADO]?.toLowerCase() ?? ""}
          </p>
          <button
            type="button"
            onClick={() => setFiltro("todos")}
            className="presionable mt-2 text-[12.5px] font-bold text-white/60 underline hover:text-white"
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
  const tono = TONO_ESTADO[estado];

  /* Este chip es lo ÚNICO que distingue «pausada/vencida» de «activa» en
     la grilla, y el tono azul ya está tomado por «activa/programada».
     Pasarlo a azul dejaría los dos estados del mismo color, así que se
     queda cálido — pero en el ámbar de aviso del repo, no en el naranja
     de marca: el naranja quedó reservado para lo que el cliente GANA, y
     una tarjeta vencida es justo lo contrario. */
  const colorChip =
    tono === "naranja"
      ? { background: "rgba(245,158,11,.16)", color: "#fcd34d" }
      : tono === "azul"
        ? { background: "rgba(157,180,255,.16)", color: "#9db4ff" }
        : { background: "rgba(255,255,255,.09)", color: "rgba(255,255,255,.55)" };

  return (
    // ── CADA TARJETA A **SU** EDITOR ────────────────────────────────
    // Esto apuntaba a `#tarjeta`, la sección del panel — que cuelga de
    // la tarjeta PRINCIPAL. O sea que con dos tarjetas, tocar la B
    // abría la A, y el dueño editaba la que no quería sin que nada se
    // lo dijera. Ahora el id viaja en la ruta.
    <Link
      href={`/lealtad/panel/${ranchoId}/editar/${programa.id}`}
      className="elevar flex h-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
        style={{ background: programa.colorFondo ?? "var(--navy-elevado)" }}
      >
        <Icono nombre={tipo.icono as NombreIcono} className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 truncate text-[13.5px] font-extrabold text-white">
            {programa.nombre}
          </span>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
            style={colorChip}
          >
            {ETIQUETA_ESTADO[estado]}
          </span>
        </span>

        <span className="mt-0.5 block text-[12px] text-white/50">
          {tipo.nombre}
          {" · "}
          {programa.miembros === 0
            ? "sin clientes todavía"
            : `${programa.miembros} cliente${programa.miembros === 1 ? "" : "s"}`}
        </span>

        {(programa.vigente_desde || programa.vigente_hasta) && (
          <span className="mt-1 block text-[11.5px] text-white/40">
            {programa.vigente_desde ?? "desde siempre"} → {programa.vigente_hasta ?? "sin fin"}
          </span>
        )}
      </span>
    </Link>
  );
}
