"use client";

import { useState, useTransition } from "react";
import type { PrecioTier, ServicioAdicional } from "@/app/mi-rancho/types";
import {
  MODALIDADES_PRECIO_LUGAR,
  MODALIDAD_PRECIO_LUGAR_LABEL,
  type ModalidadPrecioLugar,
} from "@/app/mi-rancho/types";
import { IconTrash } from "@/components/icons";

type TierDraft = {
  key: string;
  min_invitados: number;
  max_invitados: number;
  precio: number;
};
type ServicioDraft = {
  key: string;
  nombre: string;
  precio: number;
  requisito_max_invitados: number | null;
  activo: boolean;
};

let keySeq = 0;
function newKey() {
  keySeq += 1;
  return `new-${keySeq}`;
}

export type GuardarPreciosFn = (
  tiers: { min_invitados: number; max_invitados: number; precio: number }[],
  servicios: {
    nombre: string;
    precio: number;
    requisito_max_invitados: number | null;
    activo: boolean;
  }[],
  tarifaDiciembre: number,
  depositoReserva: number,
  modalidadPrecio: ModalidadPrecioLugar,
  precioHora: number | null,
  precioFijo: number | null,
) => Promise<{ error: string | null } | undefined>;

export default function PreciosForm({
  initialTiers,
  initialServicios,
  initialTarifaDiciembre,
  initialDepositoReserva,
  initialModalidadPrecio,
  initialPrecioHora,
  initialPrecioFijo,
  onGuardar,
}: {
  initialTiers: PrecioTier[];
  initialServicios: ServicioAdicional[];
  initialTarifaDiciembre: number;
  initialDepositoReserva: number;
  initialModalidadPrecio: ModalidadPrecioLugar;
  initialPrecioHora: number | null;
  initialPrecioFijo: number | null;
  onGuardar: GuardarPreciosFn;
}) {
  const [tiers, setTiers] = useState<TierDraft[]>(
    initialTiers.map((t) => ({ ...t, key: t.id })),
  );
  const [servicios, setServicios] = useState<ServicioDraft[]>(
    initialServicios.map((s) => ({ ...s, key: s.id })),
  );
  const [tarifaDiciembre, setTarifaDiciembre] = useState(
    initialTarifaDiciembre,
  );
  const [depositoReserva, setDepositoReserva] = useState(
    initialDepositoReserva,
  );
  const [modalidadPrecio, setModalidadPrecio] = useState<ModalidadPrecioLugar>(
    initialModalidadPrecio,
  );
  const [precioHora, setPrecioHora] = useState(initialPrecioHora ?? 0);
  const [precioFijo, setPrecioFijo] = useState(initialPrecioFijo ?? 0);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  function updateTier(key: string, field: keyof TierDraft, value: number) {
    setTiers((prev) =>
      prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)),
    );
  }
  function updateServicio(
    key: string,
    field: keyof ServicioDraft,
    value: string | number | boolean | null,
  ) {
    setServicios((prev) =>
      prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)),
    );
  }

  function guardar() {
    setMessage(null);
    startTransition(async () => {
      const res = await onGuardar(
        tiers.map((t) => ({
          min_invitados: t.min_invitados,
          max_invitados: t.max_invitados,
          precio: t.precio,
        })),
        servicios.map((s) => ({
          nombre: s.nombre,
          precio: s.precio,
          requisito_max_invitados: s.requisito_max_invitados,
          activo: s.activo,
        })),
        tarifaDiciembre,
        depositoReserva,
        modalidadPrecio,
        modalidadPrecio === "hora" ? precioHora : null,
        modalidadPrecio === "fijo" ? precioFijo : null,
      );
      if (res?.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "ok", text: "Guardado — ya se refleja en el sitio público." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Reserva de la fecha
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Depósito fijo para reservar
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Monto fijo (no depende de la cantidad de invitados) que el
          cliente paga por SINPE o transferencia para reservar la fecha
          en el sitio público.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[13px] font-bold text-aventurea-ink-soft">₡</span>
          <input
            type="number"
            min={0}
            value={depositoReserva}
            onChange={(e) => setDepositoReserva(Number(e.target.value))}
            className="w-40 rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Cotización automática
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          ¿Cómo cobrás?
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Elegí una forma de cobro. El sitio público calcula la cotización
          sola, según la que elijas acá.
        </p>

        <div className="mt-3.5 flex flex-wrap gap-2">
          {MODALIDADES_PRECIO_LUGAR.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModalidadPrecio(m)}
              aria-pressed={modalidadPrecio === m}
              className={`rounded-lg border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                modalidadPrecio === m
                  ? "border-aventurea-navy bg-aventurea-navy text-white"
                  : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-navy"
              }`}
            >
              {MODALIDAD_PRECIO_LUGAR_LABEL[m]}
            </button>
          ))}
        </div>

        {modalidadPrecio === "hora" && (
          <div className="mt-4.5 border-t border-dashed border-aventurea-line pt-4">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Precio por hora (₡)
            </label>
            <input
              type="number"
              min={0}
              value={precioHora}
              onChange={(e) => setPrecioHora(Number(e.target.value))}
              className="w-40 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
            />
            <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
              Al reservar, el cliente indica cuántas horas necesita y la
              cotización sale sola (horas × este precio).
            </p>
          </div>
        )}

        {modalidadPrecio === "fijo" && (
          <div className="mt-4.5 border-t border-dashed border-aventurea-line pt-4">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Precio fijo del evento (₡)
            </label>
            <input
              type="number"
              min={0}
              value={precioFijo}
              onChange={(e) => setPrecioFijo(Number(e.target.value))}
              className="w-40 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
            />
            <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
              Un solo precio para todo el evento, sin importar la cantidad de
              invitados.
            </p>
          </div>
        )}
      </section>

      {modalidadPrecio === "rango_personas" && (
        <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Rangos de invitados
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Rangos de precio según número de invitados
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Si un número de invitados no cae en ningún rango, el sitio muestra
          &quot;cotización personalizada&quot;.
        </p>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr>
              {["Desde (invitados)", "Hasta (invitados)", "Precio (₡)", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="pb-2 text-left text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.key}>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={t.min_invitados}
                    onChange={(e) =>
                      updateTier(t.key, "min_invitados", Number(e.target.value))
                    }
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink px-2.5 py-2 text-[13px]"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={t.max_invitados}
                    onChange={(e) =>
                      updateTier(t.key, "max_invitados", Number(e.target.value))
                    }
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink px-2.5 py-2 text-[13px]"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={t.precio}
                    onChange={(e) =>
                      updateTier(t.key, "precio", Number(e.target.value))
                    }
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink px-2.5 py-2 text-[13px]"
                  />
                </td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setTiers((prev) => prev.filter((x) => x.key !== t.key))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink-soft hover:border-red-400 hover:text-red-700"
                    title="Eliminar"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={() =>
            setTiers((prev) => {
              const anterior = prev[prev.length - 1];
              const desde = anterior ? anterior.max_invitados + 1 : 1;
              return [
                ...prev,
                {
                  key: newKey(),
                  min_invitados: desde,
                  max_invitados: desde + 9,
                  precio: anterior?.precio ?? 0,
                },
              ];
            })
          }
          className="mt-3.5 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
        >
          ＋ Agregar rango
        </button>
        <p className="mt-2 text-[11px] text-aventurea-ink-soft">
          Cada rango nuevo continúa automáticamente donde terminó el
          anterior — solo ajustá el precio.
        </p>

        <div className="mt-4.5 border-t border-dashed border-aventurea-line pt-4">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-orange">
            Tarifa especial de diciembre
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={tarifaDiciembre}
              onChange={(e) => setTarifaDiciembre(Number(e.target.value))}
              className="w-32 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink px-2.5 py-2 text-[13px]"
            />
            <span className="text-[12.5px] text-aventurea-ink-soft">
              colones por persona (reemplaza los rangos en diciembre)
            </span>
          </div>
        </div>
        </section>
      )}

      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Servicios adicionales
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Checklist de extras para el cliente
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          El campo &quot;requisito&quot; es opcional: si lo llenás, el
          servicio solo aparece cuando los invitados no superan ese número.
        </p>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr>
              {["Servicio", "Precio (₡)", "Máx. invitados", "Activo", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="pb-2 text-left text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {servicios.map((s) => (
              <tr key={s.key}>
                <td className="min-w-[200px] py-1.5 pr-2">
                  <input
                    type="text"
                    value={s.nombre}
                    placeholder="Nombre del servicio"
                    onChange={(e) =>
                      updateServicio(s.key, "nombre", e.target.value)
                    }
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink px-2.5 py-2 text-[13px]"
                  />
                </td>
                <td className="w-28 py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={s.precio}
                    onChange={(e) =>
                      updateServicio(s.key, "precio", Number(e.target.value))
                    }
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink px-2.5 py-2 text-[13px]"
                  />
                </td>
                <td className="w-32 py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Sin límite"
                    value={s.requisito_max_invitados ?? ""}
                    onChange={(e) =>
                      updateServicio(
                        s.key,
                        "requisito_max_invitados",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink px-2.5 py-2 text-[13px]"
                  />
                </td>
                <td className="py-1.5 pr-2 text-center">
                  <input
                    type="checkbox"
                    checked={s.activo}
                    onChange={(e) =>
                      updateServicio(s.key, "activo", e.target.checked)
                    }
                    className="h-[18px] w-[18px] accent-aventurea-orange"
                  />
                </td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setServicios((prev) =>
                        prev.filter((x) => x.key !== s.key),
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink-soft hover:border-red-400 hover:text-red-700"
                    title="Eliminar"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={() =>
            setServicios((prev) => [
              ...prev,
              {
                key: newKey(),
                nombre: "",
                precio: 0,
                requisito_max_invitados: null,
                activo: true,
              },
            ])
          }
          className="mt-3.5 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
        >
          ＋ Agregar servicio
        </button>
      </section>

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          disabled={pending}
          onClick={guardar}
          className="rounded-xl bg-aventurea-orange px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        {message && (
          <span
            className={`text-[12.5px] font-bold ${
              message.type === "ok" ? "text-aventurea-green" : "text-red-700"
            }`}
          >
            {message.type === "ok" ? "✓ " : ""}
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
