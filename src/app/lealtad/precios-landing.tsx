"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PLANES_VIGENTES,
  PLAN_DESTACADO,
  precioDe,
  descuentoAnualPct,
  type DefinicionPlan,
} from "@/lib/lealtad/planes";
import { bulletsDe } from "./panel-paquetes-lealtad";
import { Icono } from "./panel/[id]/iconos";
import BotonVerTipos from "./boton-ver-tipos";
import { grillaDePaquetes } from "@/lib/lealtad/grilla-paquetes";

/**
 * LOS CUATRO PAQUETES, EN LA PORTADA.
 *
 * Antes la landing mostraba UN plan (Arranque) en una caja navy y
 * mandaba a `/lealtad/planes` a ver el resto — el pedido fue que los
 * cuatro se entiendan acá mismo, con jerarquía clara y sin ser cuatro
 * cards idénticas.
 *
 * Los datos y las viñetas son los MISMOS que ya usa el configurador
 * (`planes.ts` + `bulletsDe` de `panel-paquetes-lealtad.tsx`) — esta
 * pantalla no decide precios ni capacidades, solo los presenta distinto.
 * El toggle mensual/anual usa `precioDe(def, "año")` (el total real que
 * ya calcula ese archivo) y NO un cálculo propio de "equivalente por
 * mes": inventar esa división acá correría el riesgo de un redondeo que
 * `planes.ts` no avala.
 */
export default function PreciosLanding() {
  const [periodo, setPeriodo] = useState<"mes" | "año">("mes");

  return (
    <div>
      <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-white/15 p-1" style={{ background: "rgba(255,255,255,.05)" }}>
        {(["mes", "año"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={periodo === p}
            onClick={() => setPeriodo(p)}
            className="presionable rounded-full px-4 py-2 text-[12.5px] font-extrabold transition-colors"
            style={
              periodo === p
                ? { background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }
                : { color: "rgba(255,255,255,.6)" }
            }
          >
            {p === "mes" ? "Mensual" : "Anual · ahorrás"}
          </button>
        ))}
      </div>

      {/* Las columnas salen de CUÁNTOS paquetes hay, no escritas a
          mano: con `lg:grid-cols-4` fijo y tres paquetes, la cuarta
          columna quedaba vacía y las tarjetas se corrían a la
          izquierda con un hueco a la derecha. */}
      <div className={`mt-8 gap-4 ${grillaDePaquetes(PLANES_VIGENTES.length)}`}>
        {PLANES_VIGENTES.map((def) => (
          <TarjetaPlan key={def.id} def={def} periodo={periodo} />
        ))}
      </div>
    </div>
  );
}

function TarjetaPlan({ def, periodo }: { def: DefinicionPlan; periodo: "mes" | "año" }) {
  const destacado = def.id === PLAN_DESTACADO;
  const esGratis = def.precioMensual === 0;
  const aConvenir = def.precioMensual === null;
  const precio = precioDe(def, periodo);
  const ahorro = periodo === "año" ? descuentoAnualPct(def) : 0;
  const beneficios = bulletsDe(def);

  return (
    <div
      className={`flex flex-col rounded-3xl border p-5 sm:p-6 ${
        destacado ? "border-transparent" : "border-white/12"
      }`}
      style={
        destacado
          ? { background: "#ffffff", boxShadow: "0 26px 60px -20px rgba(0,0,0,.4)" }
          : { background: "rgba(255,255,255,.04)" }
      }
    >
      {destacado ? (
        <span
          className="mb-3 flex w-fit items-center gap-1.5 self-start rounded-full py-1 pl-2 pr-2.5 text-[10px] font-extrabold uppercase tracking-wide"
          style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "var(--accion)" }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--accion)" }} />
          </span>
          El más popular
        </span>
      ) : (
        <span className="mb-3 h-[21px]" aria-hidden />
      )}

      <h3 className={`text-[15px] font-extrabold ${destacado ? "text-aventurea-navy" : "text-white"}`}>
        {def.nombre}
      </h3>
      <p className={`mt-1 text-[12px] leading-snug ${destacado ? "text-aventurea-ink-soft" : "text-white/55"}`}>
        {def.descripcion}
      </p>

      <p className={`mt-4 flex items-baseline gap-1.5 text-[26px] font-extrabold leading-none ${destacado ? "text-aventurea-navy" : "text-white"}`}>
        {aConvenir ? "A convenir" : esGratis ? "Gratis" : precio}
        {!esGratis && !aConvenir && (
          <span className={`text-[12px] font-bold ${destacado ? "text-aventurea-ink-soft" : "text-white/50"}`}>
            /{periodo}
          </span>
        )}
      </p>
      {ahorro > 0 && (
        <p className="mt-1 text-[11.5px] font-bold" style={{ color: destacado ? "var(--accion-fuerte)" : "var(--accion-claro)" }}>
          Ahorrás {ahorro}% pagando el año
        </p>
      )}

      <ul className="mt-5 flex-1 space-y-2">
        {beneficios.map((b, i) => (
          <li
            key={b}
            className={`flex items-start gap-1.5 text-[12px] leading-snug ${destacado ? "text-aventurea-ink-soft" : "text-white/70"}`}
          >
            <span
              className="mt-0.5 shrink-0"
              style={{ color: destacado ? "var(--accion-fuerte)" : "var(--accion-claro)" }}
            >
              <Icono nombre="listo" className="h-3.5 w-3.5" />
            </span>
            <span>
              {b}
              {i === 0 && <BotonVerTipos tipos={def.tipos} claro={!destacado} />}
            </span>
          </li>
        ))}
      </ul>

      {/* El paquete elegido viaja en `?plan=`: sin eso, tocar
          «Elegir Impulso» abría el creador sin saber que la persona
          ya había elegido Impulso, y volvía a preguntárselo. */}
      <Link
        href={`/lealtad/crear?plan=${def.id}`}
        className="presionable mt-5 block rounded-full px-4 py-3 text-center text-[12.5px] font-extrabold"
        style={
          destacado
            ? { background: "var(--accion)", color: "var(--accion-tinta)" }
            : { background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }
        }
      >
        {esGratis ? "Empezar gratis" : `Elegir ${def.nombre}`}
      </Link>
    </div>
  );
}
