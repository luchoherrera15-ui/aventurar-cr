"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { InsigniaEstado, NotaDemo } from "@/components/food/panel";
import { RADIO_CARD, SUPERFICIE_PANEL } from "@/components/panel/sistema";
import type { Promocion } from "./agrupar";
import { alternarPromocion } from "./actions";

/**
 * LAS CARDS DE PROMOCIÓN — cliente solo por el botón de pausar. Cada
 * card mezcla dos capas y las rotula distinto a propósito:
 *
 *   · Lo REAL (de food_franjas): el descuento, los días, el horario,
 *     la vigencia, cuántas franjas son y cuántos cupos ya reservaron.
 *   · Lo ESTIMADO (utilería de panel-demo): el embudo de vistas →
 *     reservas → check-ins, marcado con "Datos de ejemplo" hasta que
 *     exista analítica real de promociones.
 *
 * Pausar/Reactivar es una acción REAL: alterna `activa` en todas las
 * franjas del grupo (ver actions.ts) y el público deja de ver la
 * promo al instante — mismo efecto que apagar las franjas una por una
 * en Disponibilidad, sin el tedio.
 */

/** El rendimiento de utilería que la página le cuelga a cada card. */
export type RendimientoDemoPromo = {
  visualizaciones: number;
  reservas: number;
  checkIns: number;
  /** reservas ÷ visualizaciones, % a un decimal — derivado, no declarado. */
  conversion: number;
};

export type PromoParaCard = Promocion & { demo: RendimientoDemoPromo };

export default function CardsPromociones({
  negocioId,
  promos,
}: {
  negocioId: string;
  promos: PromoParaCard[];
}) {
  return (
    <ul className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
      {promos.map((p) => (
        <CardPromo key={p.clave} negocioId={negocioId} promo={p} />
      ))}
    </ul>
  );
}

function CardPromo({ negocioId, promo }: { negocioId: string; promo: PromoParaCard }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const activa = promo.activas > 0;

  return (
    <li className={`${SUPERFICIE_PANEL} ${RADIO_CARD} flex flex-col p-4 sm:p-5`}>
      <div className="flex items-start gap-3.5">
        {/* El descuento es LA cara de la promo: va grande y con el
            acento coral de FOOD — el único naranja de la card. */}
        <span
          className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-aventurea-orange-light text-[16px] font-extrabold tracking-tight text-aventurea-orange-dark"
          aria-hidden
        >
          −{promo.descuento}%
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold leading-snug text-aventurea-navy">
            {promo.descuento}% de descuento · {promo.momento} {promo.dias}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
            {promo.horario} · {promo.vigencia}
          </p>
        </div>
        <InsigniaEstado estado={activa ? "activa" : "pausada"} className="shrink-0" />
      </div>

      {/* Los hechos reales del grupo — esto SÍ sale de la base. */}
      <p className="mt-3 text-[12.5px] tabular-nums text-aventurea-ink-soft">
        <span className="font-bold text-aventurea-ink">{promo.franjas}</span>{" "}
        {promo.franjas === 1 ? "franja" : "franjas"} ·{" "}
        <span className="font-bold text-aventurea-ink">{promo.cupoTotal}</span> cupos ·{" "}
        <span className="font-bold text-aventurea-ink">{promo.reservado}</span> ya reservados
        {promo.activas > 0 && promo.activas < promo.franjas && (
          <span className="ml-1.5 rounded-md bg-aventurea-cream-2 px-1.5 py-0.5 text-[11px] font-bold">
            {promo.franjas - promo.activas} apagadas
          </span>
        )}
      </p>

      {/* La capa estimada, rotulada como tal. */}
      <div className="mt-3 rounded-xl bg-aventurea-cream-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-aventurea-ink-soft">
            Rendimiento estimado
          </p>
          <NotaDemo />
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniDato rotulo="Vistas" valor={promo.demo.visualizaciones.toLocaleString("es-CR")} />
          <MiniDato rotulo="Reservas" valor={promo.demo.reservas.toLocaleString("es-CR")} />
          <MiniDato rotulo="Check-ins" valor={promo.demo.checkIns.toLocaleString("es-CR")} />
          <MiniDato
            rotulo="Conversión"
            valor={`${promo.demo.conversion.toLocaleString("es-CR", { maximumFractionDigits: 1 })}%`}
          />
        </dl>
      </div>

      {error && <p className="mt-2 text-[12px] font-bold text-red-700">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-aventurea-line pt-3">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              // Pausar apaga TODO el grupo; reactivar lo prende todo —
              // incluso las franjas que estaban apagadas una por una,
              // que es lo que "reactivar la promo" significa.
              const r = await alternarPromocion(negocioId, promo.franjaIds, !activa);
              setError(r.error);
            })
          }
          className="rounded-xl border border-aventurea-line bg-white px-4 py-2 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : activa ? "Pausar promoción" : "Reactivar promoción"}
        </button>
        <Link
          href="/food/negocio/franjas"
          className="text-[12.5px] font-bold text-aventurea-navy hover:underline"
        >
          Editar franjas →
        </Link>
      </div>
    </li>
  );
}

function MiniDato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-bold text-aventurea-ink-soft">{rotulo}</dt>
      <dd className="mt-0.5 text-[15px] font-extrabold tabular-nums leading-none text-aventurea-ink">
        {valor}
      </dd>
    </div>
  );
}
