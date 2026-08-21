"use client";

import { useState } from "react";
import { Interruptor } from "@/components/lealtad/paso-beneficio";

/**
 * CUÁNDO VALE LA TARJETA Y CUÁNTAS VECES (0136).
 *
 * Era el paso 4 del creador y vivía adentro de `creador-tarjeta.tsx`.
 * Se sacó acá porque ahora lo usan DOS pantallas: el asistente que
 * crea la tarjeta y el editor de la tarjeta que ya existe. Copiarlo
 * hubiera sido la forma más rápida de que las dos empezaran a ofrecer
 * reglas distintas — y de que una guardara un campo que la otra no.
 *
 * TODO arranca apagado: una tarjeta sin reglas es la que más se
 * entiende, y cada regla encendida es una forma más de que un canje
 * legítimo sea rechazado en el mostrador.
 *
 * Los campos aparecen recién al encender su interruptor, con la
 * utilidad `desplegable` (grid-template-rows de 0fr a 1fr) — que anima
 * sin tocar `height` ni hacer saltar lo de abajo.
 */

export type Reglas = {
  desde: string;
  /** true = la tarjeta de cada cliente vale desde el día de su primer
   *  sello o bono (0195) — sin fecha fija de inicio. Excluyente con
   *  `desde`. */
  desdePrimerSello: boolean;
  hasta: string;
  usoUnico: boolean;
  maxPorCliente: number | null;
  maxGlobal: number | null;
  /** 0 = domingo. Vacío = todos los días. */
  dias: number[];
  horaDesde: string;
  horaHasta: string;
};

export const REGLAS_VACIAS: Reglas = {
  desde: "",
  desdePrimerSello: false,
  hasta: "",
  usoUnico: false,
  maxPorCliente: null,
  maxGlobal: null,
  dias: [],
  horaDesde: "",
  horaHasta: "",
};

export const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const campo =
  "w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] text-bookea-tinta placeholder:text-bookea-gris/70";
const etiqueta = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris";

/** Cómo se resume una regla en una línea, para el paso de Revisar. */
export function resumenDeReglas(reglas: Reglas): { vigencia: string; cuando: string; canjes: string } {
  return {
    vigencia: reglas.desdePrimerSello
      ? `Desde el primer sello del cliente → ${reglas.hasta || "sin fin"}`
      : reglas.desde || reglas.hasta
        ? `${reglas.desde || "hoy"} → ${reglas.hasta || "sin fin"}`
        : "Sin límite de fechas",
    cuando:
      reglas.dias.length > 0
        ? `${reglas.dias.map((d) => DIAS[d]).join(", ")}${
            reglas.horaDesde ? ` · ${reglas.horaDesde}–${reglas.horaHasta || "cierre"}` : ""
          }`
        : "Todos los días",
    canjes: reglas.usoUnico
      ? "Uno solo por cliente"
      : [
          reglas.maxPorCliente ? `${reglas.maxPorCliente} por cliente` : null,
          reglas.maxGlobal ? `${reglas.maxGlobal} en total` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Sin tope",
  };
}

export default function PasoReglas({
  reglas,
  alCambiar,
}: {
  reglas: Reglas;
  alCambiar: (r: Reglas) => void;
}) {
  // Los interruptores arrancan encendidos si la tarjeta YA tiene esa
  // regla puesta. Sin esto, el editor de una tarjeta con vigencia la
  // mostraría apagada —o sea, mintiendo— y el primer clic en el
  // interruptor le borraría las fechas al dueño.
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>(() => ({
    vig: !!(reglas.desde || reglas.hasta || reglas.desdePrimerSello),
    dias: reglas.dias.length > 0 || !!reglas.horaDesde || !!reglas.horaHasta,
    lim: reglas.maxPorCliente !== null || reglas.maxGlobal !== null,
  }));
  const set = (k: string, v: boolean) => setAbiertos((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-3">
      <Interruptor
        id="r-vig"
        titulo="Vigencia"
        detalle="Desde cuándo y hasta cuándo vale."
        activo={!!abiertos.vig}
        alCambiar={(v) => {
          set("vig", v);
          if (!v) alCambiar({ ...reglas, desde: "", hasta: "", desdePrimerSello: false });
        }}
      />
      <div className="desplegable" data-abierto={abiertos.vig ? "true" : "false"}>
        <div>
          {/* «Desde el primer sello» (0195): la vigencia de cada cliente
              arranca el día de su primer sello o bono — con el check
              puesto, la fecha fija de inicio deja de aplicar y el campo
              Desde se esconde (mandar las dos sería contradictorio). */}
          <label className="flex cursor-pointer items-start gap-2.5 px-1 pb-3">
            <input
              type="checkbox"
              checked={reglas.desdePrimerSello}
              onChange={(e) =>
                alCambiar({
                  ...reglas,
                  desdePrimerSello: e.target.checked,
                  ...(e.target.checked ? { desde: "" } : {}),
                })
              }
              className="mt-0.5 h-4 w-4 accent-[color:var(--accion)]"
            />
            <span className="text-[13px] font-bold leading-snug text-bookea-tinta">
              Desde el día del primer sello o bono del cliente
              <span className="mt-0.5 block text-[11.5px] font-normal leading-relaxed text-bookea-gris">
                La tarjeta de cada cliente empieza a valer el día en que recibe el primero —
                sin fecha fija de inicio.
              </span>
            </span>
          </label>
          <div className="grid gap-3 px-1 pb-1 sm:grid-cols-2">
            {!reglas.desdePrimerSello && (
              <div>
                <label className={etiqueta} htmlFor="r-desde">Desde</label>
                <input
                  id="r-desde"
                  type="date"
                  value={reglas.desde}
                  onChange={(e) => alCambiar({ ...reglas, desde: e.target.value })}
                  className={campo}
                />
              </div>
            )}
            <div>
              <label className={etiqueta} htmlFor="r-hasta">Hasta</label>
              <input
                id="r-hasta"
                type="date"
                value={reglas.hasta}
                onChange={(e) => alCambiar({ ...reglas, hasta: e.target.value })}
                className={campo}
              />
            </div>
          </div>
          <p className="px-1 pb-2 text-[11.5px] text-bookea-gris">
            Hora de Costa Rica. Al vencer, la tarjeta deja de emitirse y los canjes se
            rechazan — lo decide el servidor, no el pase que tenga el cliente en el
            teléfono.
          </p>
        </div>
      </div>

      <Interruptor
        id="r-dias"
        titulo="Solo ciertos días y horas"
        detalle="Por ejemplo: 30% de descuento de lunes a jueves."
        activo={!!abiertos.dias}
        alCambiar={(v) => {
          set("dias", v);
          if (!v) alCambiar({ ...reglas, dias: [], horaDesde: "", horaHasta: "" });
        }}
      />
      <div className="desplegable" data-abierto={abiertos.dias ? "true" : "false"}>
        <div>
          <div className="px-1 pb-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días permitidos">
              {DIAS.map((d, i) => {
                const puesto = reglas.dias.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={puesto}
                    onClick={() =>
                      alCambiar({
                        ...reglas,
                        dias: puesto
                          ? reglas.dias.filter((x) => x !== i)
                          : [...reglas.dias, i].sort(),
                      })
                    }
                    className={`presionable rounded-lg border px-2.5 py-1.5 text-[12px] font-bold ${
                      puesto
                        ? "border-bookea-azul bg-bookea-azul text-white"
                        : "border-bookea-linea bg-white text-bookea-gris"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={etiqueta} htmlFor="r-hd">Desde las</label>
                <input
                  id="r-hd"
                  type="time"
                  value={reglas.horaDesde}
                  onChange={(e) => alCambiar({ ...reglas, horaDesde: e.target.value })}
                  className={campo}
                />
              </div>
              <div>
                <label className={etiqueta} htmlFor="r-hh">Hasta las</label>
                <input
                  id="r-hh"
                  type="time"
                  value={reglas.horaHasta}
                  onChange={(e) => alCambiar({ ...reglas, horaHasta: e.target.value })}
                  className={campo}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Interruptor
        id="r-uso"
        titulo="Un solo uso por cliente"
        detalle="Se canjea una vez y la tarjeta queda usada."
        activo={reglas.usoUnico}
        alCambiar={(v) => alCambiar({ ...reglas, usoUnico: v })}
      />

      <Interruptor
        id="r-lim"
        titulo="Límite de canjes"
        detalle="Un tope por cliente, o uno global para toda la promoción."
        activo={!!abiertos.lim}
        alCambiar={(v) => {
          set("lim", v);
          if (!v) alCambiar({ ...reglas, maxPorCliente: null, maxGlobal: null });
        }}
      />
      <div className="desplegable" data-abierto={abiertos.lim ? "true" : "false"}>
        <div>
          <div className="grid gap-3 px-1 pb-2 sm:grid-cols-2">
            <div>
              <label className={etiqueta} htmlFor="r-mpc">Máximo por cliente</label>
              <input
                id="r-mpc"
                type="number"
                min={1}
                value={reglas.maxPorCliente ?? ""}
                onChange={(e) =>
                  alCambiar({
                    ...reglas,
                    maxPorCliente: e.target.value.trim() === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="Sin tope"
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="r-mg">Máximo en total</label>
              <input
                id="r-mg"
                type="number"
                min={1}
                value={reglas.maxGlobal ?? ""}
                onChange={(e) =>
                  alCambiar({
                    ...reglas,
                    maxGlobal: e.target.value.trim() === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="Sin tope"
                className={campo}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
