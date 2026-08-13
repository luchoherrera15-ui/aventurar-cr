import Link from "next/link";
import {
  PLANES_VIGENTES,
  PLAN_DESTACADO,
  definicionDe,
  estadoDelLimite,
  precioDe,
  ETIQUETAS_CAPACIDAD,
  type DefinicionPlan,
} from "@/lib/lealtad/planes";
import { Icono } from "./iconos";

/**
 * PLAN Y FACTURACIÓN — el equivalente nuestro del "Billing &
 * Subscription" de Cockato: el plan actual, cuánto llevás consumido de
 * tus topes, y la grilla de paquetes para comparar.
 *
 * Todo sale de `planes.ts` y de contar filas. Acá no se guarda ningún
 * número: el tope es del catálogo y el consumo se cuenta, así que
 * cambiar de plan cambia los medidores solo.
 *
 * DOS COSAS DE COCKATO QUE NO SE COPIARON, porque mentirían:
 *
 *  · «Outlets» (sucursales) — no existe el modelo de datos. Un medidor
 *    "0 / 1 sucursales" sería decoración.
 *  · «45-day free trial» y el interruptor Mensual/Anual — nuestra
 *    compra es por depósito SINPE con comprobante (0128), no hay
 *    suscripción ni cobro recurrente que anualizar. Prometer una
 *    prueba que nadie puede empezar es peor que no ofrecerla.
 */

const NARANJA = "#ee7420";

export default function SeccionPlan({
  ranchoId,
  plan,
  miembros,
  equipo,
}: {
  ranchoId: string;
  plan: string | null;
  miembros: number;
  /** Colaboradores dados de alta, sin contar al dueño. */
  equipo: number;
}) {
  const actual = definicionDe(plan);
  const limite = estadoDelLimite(plan, "clientesActivos", miembros);

  return (
    <div className="space-y-5">
      {/* ── Tu plan + el consumo ────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Encabezado icono="plan" titulo="Tu plan actual" />
          {actual ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-[28px] font-extrabold leading-none text-aventurea-ink">
                  {actual.nombre}
                </p>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: "rgba(238,116,32,.16)", color: NARANJA }}
                >
                  {actual.precioMensual === null
                    ? "A convenir"
                    : actual.precioMensual === 0
                      ? "Gratis"
                      : `${precioDe(actual)}/mes`}
                </span>
                {!actual.vigente && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-aventurea-ink-soft">
                    Paquete anterior
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[12.5px] text-aventurea-ink-soft">
                {actual.descripcion}
              </p>
              <ul className="mt-4 space-y-1.5">
                {actual.capacidades.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <span className="mt-[1px] shrink-0 text-aventurea-green">
                      <Icono nombre="listo" className="h-[15px] w-[15px]" />
                    </span>
                    <span className="text-[12.5px] leading-snug text-aventurea-ink-soft">
                      {ETIQUETAS_CAPACIDAD[c]}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-[13px] text-aventurea-ink-soft">
              Tu programa está activo sin un paquete asignado. Elegí uno abajo para fijar tu
              tope de miembros y tus beneficios.
            </p>
          )}
        </Card>

        <Card>
          <Encabezado icono="metricas" titulo="Tu consumo" />
          <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
            Cómo vas contra los topes de tu paquete.
          </p>

          <div className="mt-5 space-y-4">
            <Medidor
              icono="clientes"
              etiqueta="Miembros afiliados"
              usado={miembros}
              tope={limite.limite}
              alerta={limite.lleno}
              aviso={limite.cerca}
            />
            <Medidor
              icono="equipo"
              etiqueta="Gente de tu equipo"
              usado={equipo}
              tope={null}
              detalle="Sin tope: sumá a quien necesités en el mostrador."
            />
          </div>

          {limite.lleno && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-[12.5px] font-bold text-red-700">
              Tu paquete llegó al tope: un cliente nuevo ya no se puede afiliar. Subí de
              paquete para seguir sumando gente.
            </p>
          )}
          {limite.cerca && !limite.lleno && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[12.5px] font-bold text-amber-800">
              Te queda{limite.disponibles === 1 ? "" : "n"} {limite.disponibles} lugar
              {limite.disponibles === 1 ? "" : "es"}. Conviene subir antes de toparte.
            </p>
          )}
        </Card>
      </div>

      {/* ── Los paquetes ────────────────────────────────────────── */}
      <div>
        <h3 className="text-[16px] font-extrabold text-white">Paquetes disponibles</h3>
        <p className="mt-1 text-[13px] text-white/55">
          Los precios están en dólares y el depósito se hace por SINPE en colones: te
          confirmamos el monto al tipo de cambio del día. Al enviar la solicitud, el equipo
          de Bookea la revisa y te activa el paquete.
        </p>

        {/* Solo los VIGENTES: ofrecerle a alguien un paquete retirado
            es venderle algo que ya no existe. El suyo, si es retirado,
            se sigue viendo arriba en «Tu plan actual». */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {PLANES_VIGENTES.map((def) => (
            <TarjetaPlan
              key={def.id}
              def={def}
              esActual={actual?.id === def.id}
              ranchoId={ranchoId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Piezas ────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-aventurea-line bg-white p-5">{children}</div>
  );
}

function Encabezado({
  icono,
  titulo,
}: {
  icono: Parameters<typeof Icono>[0]["nombre"];
  titulo: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
        style={{ background: "rgba(238,116,32,.15)", color: NARANJA }}
      >
        <Icono nombre={icono} className="h-[17px] w-[17px]" />
      </span>
      <h3 className="text-[15px] font-extrabold text-aventurea-ink">{titulo}</h3>
    </div>
  );
}

/**
 * Un medidor de consumo. Sin tope no dibuja barra: una barra al 0% con
 * "sin límite" al lado se lee como "no has usado nada de algo que se
 * puede acabar", que es justo lo contrario de lo que pasa.
 */
function Medidor({
  icono,
  etiqueta,
  usado,
  tope,
  detalle,
  alerta,
  aviso,
}: {
  icono: Parameters<typeof Icono>[0]["nombre"];
  etiqueta: string;
  usado: number;
  tope: number | null;
  detalle?: string;
  alerta?: boolean;
  aviso?: boolean;
}) {
  const pct = tope ? Math.min(100, Math.round((usado / tope) * 100)) : 0;
  const color = alerta ? "#ef4444" : aviso ? "#f59e0b" : NARANJA;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="flex items-center gap-2 text-[13px] font-bold text-aventurea-ink">
          <span className="text-aventurea-ink-soft">
            <Icono nombre={icono} className="h-[15px] w-[15px]" />
          </span>
          {etiqueta}
        </span>
        <span className="text-[13px] font-bold tabular-nums text-aventurea-ink-soft">
          {tope === null ? `${usado.toLocaleString("es-CR")}` : `${usado} / ${tope}`}
        </span>
      </div>

      {tope === null ? (
        <p className="mt-1 text-[11.5px] text-aventurea-ink-soft">
          {detalle ?? "Sin tope en tu paquete."}
        </p>
      ) : (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}

function TarjetaPlan({
  def,
  esActual,
  ranchoId,
}: {
  def: DefinicionPlan;
  esActual: boolean;
  ranchoId: string;
}) {
  // El más vendible, no el más caro: Growth es el que trae push,
  // bienvenida y segmentación — el salto que de verdad se nota.
  const recomendado = def.id === PLAN_DESTACADO;

  return (
    <div
      className="relative flex flex-col rounded-2xl border bg-white p-5"
      style={
        esActual
          ? { borderColor: NARANJA, background: "rgba(238,116,32,.07)" }
          : recomendado
            ? { borderColor: "rgba(238,116,32,.45)" }
            : undefined
      }
    >
      {(esActual || recomendado) && (
        <span
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-extrabold text-white"
          style={{ background: esActual ? "#16a34a" : NARANJA }}
        >
          {esActual ? "Tu paquete" : "El más popular"}
        </span>
      )}

      <h4 className="mt-1 text-[16px] font-extrabold text-aventurea-ink">{def.nombre}</h4>
      <p className="mt-1 min-h-[32px] text-[11.5px] leading-snug text-aventurea-ink-soft">
        {def.descripcion}
      </p>

      <p className="mt-3 text-[24px] font-extrabold leading-none text-aventurea-ink">
        {precioDe(def) ?? "A convenir"}
        {def.precioMensual ? (
          <span className="text-[12px] font-bold text-aventurea-ink-soft">/mes</span>
        ) : null}
      </p>

      <p className="mt-2 text-[12px] font-bold text-aventurea-ink">
        {def.limites.clientesActivos === null
          ? "Clientes ilimitados"
          : `Hasta ${def.limites.clientesActivos} clientes activos`}
      </p>

      <ul className="mt-3 flex-1 space-y-1.5">
        {def.capacidades.map((c) => (
          <li key={c} className="flex items-start gap-1.5">
            <span className="mt-[1px] shrink-0 text-aventurea-green">
              <Icono nombre="listo" className="h-[13px] w-[13px]" />
            </span>
            <span className="text-[11.5px] leading-snug text-aventurea-ink-soft">
              {ETIQUETAS_CAPACIDAD[c]}
            </span>
          </li>
        ))}
      </ul>

      {esActual ? (
        <p className="mt-4 rounded-xl border border-dashed border-aventurea-line px-3 py-2.5 text-center text-[12px] font-bold text-aventurea-ink-soft">
          Es el que tenés
        </p>
      ) : (
        <Link
          href={`/lealtad/planes?negocio=${ranchoId}`}
          className={`mt-4 block rounded-xl px-3 py-2.5 text-center text-[12.5px] font-bold ${
            recomendado ? "text-white" : "border border-aventurea-line text-aventurea-ink"
          }`}
          style={recomendado ? { background: NARANJA } : undefined}
        >
          {def.precioMensual === 0 ? "Empezar gratis" : "Solicitar este paquete"}
        </Link>
      )}
    </div>
  );
}
