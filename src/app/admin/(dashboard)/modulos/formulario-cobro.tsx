"use client";

import { useState, useTransition } from "react";
import { ADDONS } from "@/lib/addons";
import { PLANES, PLANES_ID } from "@/lib/lealtad/planes";
import {
  METODO_LABEL,
  METODOS_COBRO,
  PERIODO_LABEL,
  PERIODOS_COBRO,
  diaCR,
  type MetodoCobro,
  type MonedaCobro,
  type PeriodoCobro,
  type ProductoCobro,
} from "@/lib/auditoria-modulos";
import { registrarCobro } from "./actions";

export type NegocioOpcion = {
  id: string;
  nombre: string;
  vertical: string | null;
  plan: string | null;
};

/** Lo que se sabe de antemano cuando el formulario abre desde una fila. */
export type PrellenadoCobro = {
  ranchoId?: string | null;
  plan?: string | null;
  metodo?: MetodoCobro;
  solicitudId?: string | null;
  /** ISO del momento en que se aprobó, para proponer la fecha. */
  fecha?: string | null;
  esCortesia?: boolean;
};

/**
 * Anotar un cobro a mano.
 *
 * Es el formulario que tapa el agujero: hasta que exista un registro
 * automático de importes, ESTA es la única forma de que un depósito por
 * SINPE quede con su monto en la base. Prellenado desde la fila que lo
 * abrió (negocio, paquete, medio y fecha de aprobación) para que anotar
 * un cobro viejo sea leer el comprobante y teclear un número.
 *
 * La moneda se elige, no se deduce: un SINPE entra en colones y una
 * tarjeta en dólares, pero también hay transferencias en dólares. Que
 * el sistema adivine la moneda es exactamente el error que vuelve
 * inútil un libro de ingresos.
 */
export default function FormularioCobro({
  negocios,
  inicial,
  onListo,
  deshabilitado,
}: {
  negocios: NegocioOpcion[];
  inicial?: PrellenadoCobro;
  onListo: () => void;
  deshabilitado: boolean;
}) {
  const [ranchoId, setRanchoId] = useState(inicial?.ranchoId ?? "");
  const [producto, setProducto] = useState<ProductoCobro>("plan_lealtad");
  const [plan, setPlan] = useState(inicial?.plan ?? "impulso");
  const [addon, setAddon] = useState<string>(ADDONS[0].id);
  const [periodo, setPeriodo] = useState<PeriodoCobro>("mensual");
  const [metodo, setMetodo] = useState<MetodoCobro>(inicial?.metodo ?? "sinpe");
  const [moneda, setMoneda] = useState<MonedaCobro>(
    (inicial?.metodo ?? "sinpe") === "stripe" ? "USD" : "CRC",
  );
  const [monto, setMonto] = useState("");
  const [tipoCambio, setTipoCambio] = useState("");
  const [esCortesia, setEsCortesia] = useState(inicial?.esCortesia ?? false);
  const [valorLista, setValorLista] = useState("");
  const [fecha, setFecha] = useState(
    inicial?.fecha ? diaCR(inicial.fecha) : diaCR(new Date()),
  );
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();

  /** El precio de catálogo del paquete, para proponer el valor regalado. */
  const definicion = plan in PLANES ? PLANES[plan as keyof typeof PLANES] : null;

  function cambiarMetodo(m: MetodoCobro) {
    setMetodo(m);
    // Sugerencia, no imposición: Stripe cobra en dólares y el SINPE en
    // colones, pero el campo queda editable.
    setMoneda(m === "stripe" ? "USD" : "CRC");
  }

  function guardar() {
    setError(null);
    if (!ranchoId) {
      setError("Elegí de qué negocio es el cobro.");
      return;
    }
    empezar(async () => {
      const res = await registrarCobro({
        ranchoId,
        producto,
        plan: producto === "plan_lealtad" ? plan : null,
        addon: producto === "complemento" ? addon : null,
        periodo,
        metodo,
        monto: esCortesia ? 0 : Number(monto.replace(",", ".")),
        moneda,
        tipoCambio: tipoCambio.trim() ? Number(tipoCambio.replace(",", ".")) : null,
        esCortesia,
        valorListaUsd: esCortesia
          ? valorLista.trim()
            ? Number(valorLista.replace(",", "."))
            : (definicion?.precioMensual ?? null)
          : null,
        cobradoEn: fecha,
        solicitudId: inicial?.solicitudId ?? null,
        notas,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onListo();
    });
  }

  return (
    <div className="rounded-2xl border border-aventurea-navy/25 bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-navy">
        Anotar un cobro
      </p>
      <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Se guarda el monto <strong>en la moneda en que entró</strong>. No se
        convierte: el tipo de cambio queda como dato al lado, nunca como parte
        de un total.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo etiqueta="Negocio">
          <select
            value={ranchoId}
            onChange={(e) => setRanchoId(e.target.value)}
            className={ENTRADA}
          >
            <option value="">Elegí un negocio…</option>
            {negocios.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Qué se cobró">
          <select
            value={producto}
            onChange={(e) => setProducto(e.target.value as ProductoCobro)}
            className={ENTRADA}
          >
            <option value="plan_lealtad">Paquete de Lealtad</option>
            <option value="complemento">Complemento suelto</option>
          </select>
        </Campo>

        {producto === "plan_lealtad" ? (
          <Campo etiqueta="Paquete">
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className={ENTRADA}>
              {PLANES_ID.map((id) => (
                <option key={id} value={id}>
                  {PLANES[id].nombre}
                  {PLANES[id].vigente ? "" : " (retirado)"}
                </option>
              ))}
            </select>
          </Campo>
        ) : (
          <Campo etiqueta="Complemento">
            <select value={addon} onChange={(e) => setAddon(e.target.value)} className={ENTRADA}>
              {ADDONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <Campo etiqueta="Período que cubre">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as PeriodoCobro)}
            className={ENTRADA}
          >
            {PERIODOS_COBRO.map((p) => (
              <option key={p} value={p}>
                {PERIODO_LABEL[p]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Medio de pago">
          <select
            value={metodo}
            onChange={(e) => cambiarMetodo(e.target.value as MetodoCobro)}
            className={ENTRADA}
          >
            {METODOS_COBRO.map((m) => (
              <option key={m} value={m}>
                {METODO_LABEL[m]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Día en que entró">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={ENTRADA}
          />
        </Campo>

        {!esCortesia && (
          <>
            <Campo etiqueta="Moneda que entró">
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as MonedaCobro)}
                className={ENTRADA}
              >
                <option value="CRC">Colones (₡)</option>
                <option value="USD">Dólares ($)</option>
              </select>
            </Campo>

            <Campo etiqueta={moneda === "CRC" ? "Monto en colones" : "Monto en dólares"}>
              <input
                type="number"
                step="any"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder={moneda === "CRC" ? "21000" : "42"}
                className={ENTRADA}
              />
            </Campo>

            {moneda === "CRC" && (
              <Campo etiqueta="Tipo de cambio del día (opcional)">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={tipoCambio}
                  onChange={(e) => setTipoCambio(e.target.value)}
                  placeholder="colones por dólar"
                  className={ENTRADA}
                />
              </Campo>
            )}
          </>
        )}

        {esCortesia && (
          <Campo etiqueta="Valor de catálogo (US$, opcional)">
            <input
              type="number"
              step="any"
              min="0"
              value={valorLista}
              onChange={(e) => setValorLista(e.target.value)}
              placeholder={
                definicion?.precioMensual != null ? String(definicion.precioMensual) : "0"
              }
              className={ENTRADA}
            />
          </Campo>
        )}
      </div>

      <label className="mt-3 flex items-start gap-2 text-[12.5px] text-aventurea-ink">
        <input
          type="checkbox"
          checked={esCortesia}
          onChange={(e) => setEsCortesia(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong>Es una cortesía</strong> (se regaló). Se guarda en ₡0 y queda
          fuera de los ingresos — lo obliga la base, no este formulario. Se
          anota aparte cuánto valía.
        </span>
      </label>

      <div className="mt-3">
        <Campo etiqueta="Nota (por qué, o de qué comprobante salió)">
          <input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            maxLength={300}
            placeholder="Ej. SINPE 2/8 al 8888-8888, comprobante en la solicitud"
            className={ENTRADA}
          />
        </Campo>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>
      )}
      {deshabilitado && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          La tabla todavía no existe en la base: hay que pegar la migración
          antes de poder guardar.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || deshabilitado}
          className="rounded-xl bg-aventurea-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar el cobro"}
        </button>
        <button
          type="button"
          onClick={onListo}
          className="rounded-xl border border-aventurea-line bg-white px-4 py-2 text-[13px] font-bold text-aventurea-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

const ENTRADA =
  "w-full rounded-lg border border-aventurea-line bg-white px-3 py-2 text-[13px] text-aventurea-ink";

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-bold text-aventurea-ink-soft">
        {etiqueta}
      </span>
      {children}
    </label>
  );
}
