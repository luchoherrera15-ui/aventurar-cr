"use client";

import { useState, useTransition } from "react";
import {
  DIAS_SEMANA,
  TIPOS_PROMOCION,
  type CodigoDescuento,
  type PromocionDia,
  type TipoPromocion,
} from "@/app/mi-negocio/types";
import { IconTrash } from "@/components/icons";

type CodigoDraft = {
  key: string;
  codigo: string;
  tipo: "porcentaje" | "monto_fijo";
  valor: number;
  activo: boolean;
  usos_maximos: number | null;
  valido_hasta: string | null;
};

type PromocionDraft = {
  key: string;
  dias_semana: number[];
  tipo: TipoPromocion;
  porcentaje_descuento: number | null;
  precio_fijo: number | null;
  personas_max: number | null;
  etiqueta: string;
  activo: boolean;
};

let keySeq = 0;
function newKey() {
  keySeq += 1;
  return `new-${keySeq}`;
}

export type GuardarCodigosFn = (
  codigos: Omit<CodigoDraft, "key">[],
) => Promise<{ error: string | null } | undefined>;

export type GuardarPromocionesFn = (
  promociones: Omit<PromocionDraft, "key">[],
) => Promise<{ error: string | null } | undefined>;

export default function DescuentosForm({
  initialCodigos,
  initialPromociones,
  onGuardarCodigos,
  onGuardarPromociones,
}: {
  initialCodigos: CodigoDescuento[];
  initialPromociones: PromocionDia[];
  onGuardarCodigos: GuardarCodigosFn;
  onGuardarPromociones: GuardarPromocionesFn;
}) {
  const [codigos, setCodigos] = useState<CodigoDraft[]>(
    initialCodigos.map((c) => ({ ...c, key: c.id })),
  );
  const [promociones, setPromociones] = useState<PromocionDraft[]>(
    initialPromociones.map((p) => ({ ...p, key: p.id })),
  );
  const [pendingCodigos, startCodigos] = useTransition();
  const [pendingPromos, startPromos] = useTransition();
  const [msgCodigos, setMsgCodigos] = useState<{ ok: boolean; text: string } | null>(null);
  const [msgPromos, setMsgPromos] = useState<{ ok: boolean; text: string } | null>(null);

  function updateCodigo(key: string, field: keyof CodigoDraft, value: unknown) {
    setCodigos((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)),
    );
  }
  function updatePromo(key: string, field: keyof PromocionDraft, value: unknown) {
    setPromociones((prev) =>
      prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)),
    );
  }
  function toggleDia(key: string, dia: number) {
    setPromociones((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        const tiene = p.dias_semana.includes(dia);
        return {
          ...p,
          dias_semana: tiene
            ? p.dias_semana.filter((d) => d !== dia)
            : [...p.dias_semana, dia].sort(),
        };
      }),
    );
  }

  function guardarCodigos() {
    setMsgCodigos(null);
    startCodigos(async () => {
      const res = await onGuardarCodigos(
        codigos.map((c) => ({
          codigo: c.codigo,
          tipo: c.tipo,
          valor: c.valor,
          activo: c.activo,
          usos_maximos: c.usos_maximos,
          valido_hasta: c.valido_hasta,
        })),
      );
      setMsgCodigos(
        res?.error
          ? { ok: false, text: res.error }
          : { ok: true, text: "Guardado — ya se puede usar en las reservas." },
      );
    });
  }

  function guardarPromociones() {
    setMsgPromos(null);
    startPromos(async () => {
      const vacia = promociones.find((p) => p.dias_semana.length === 0);
      if (vacia) {
        setMsgPromos({ ok: false, text: "Elegí al menos un día para cada promoción." });
        return;
      }
      const invalida = promociones.find((p) =>
        p.tipo === "porcentaje"
          ? !(p.porcentaje_descuento && p.porcentaje_descuento > 0 && p.porcentaje_descuento <= 100)
          : !(p.precio_fijo && p.precio_fijo > 0),
      );
      if (invalida) {
        setMsgPromos({
          ok: false,
          text:
            invalida.tipo === "porcentaje"
              ? "El % de descuento debe estar entre 1 y 100."
              : "El precio fijo debe ser mayor a ₡0.",
        });
        return;
      }
      const res = await onGuardarPromociones(
        promociones.map((p) => ({
          dias_semana: p.dias_semana,
          tipo: p.tipo,
          porcentaje_descuento: p.tipo === "porcentaje" ? p.porcentaje_descuento : null,
          precio_fijo: p.tipo === "precio_fijo" ? p.precio_fijo : null,
          personas_max: p.tipo === "precio_fijo" ? p.personas_max : null,
          etiqueta: p.etiqueta,
          activo: p.activo,
        })),
      );
      setMsgPromos(
        res?.error
          ? { ok: false, text: res.error }
          : { ok: true, text: "Guardado — ya se ve en el calendario público." },
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Códigos de descuento */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
          Códigos de descuento
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Cupones que el cliente escribe al reservar
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Ej. <strong>BODA10</strong> = 10% de descuento. Dejá &quot;usos
          máximos&quot; vacío para que no tenga límite.
        </p>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr>
              {["Código", "Tipo", "Valor", "Usos máx.", "Vence", "Activo", ""].map((h) => (
                <th
                  key={h}
                  className="pb-2 text-left text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {codigos.map((c) => (
              <tr key={c.key}>
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={c.codigo}
                    placeholder="BODA10"
                    onChange={(e) => updateCodigo(c.key, "codigo", e.target.value.toUpperCase())}
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] font-bold uppercase text-aventurea-ink"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <select
                    value={c.tipo}
                    onChange={(e) => updateCodigo(c.key, "tipo", e.target.value)}
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                  >
                    <option value="porcentaje">% descuento</option>
                    <option value="monto_fijo">₡ fijo</option>
                  </select>
                </td>
                <td className="w-24 py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={c.valor}
                    onChange={(e) => updateCodigo(c.key, "valor", Number(e.target.value))}
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                  />
                </td>
                <td className="w-28 py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Sin límite"
                    value={c.usos_maximos ?? ""}
                    onChange={(e) =>
                      updateCodigo(
                        c.key,
                        "usos_maximos",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                  />
                </td>
                <td className="w-40 py-1.5 pr-2">
                  <input
                    type="date"
                    value={c.valido_hasta ?? ""}
                    onChange={(e) =>
                      updateCodigo(c.key, "valido_hasta", e.target.value || null)
                    }
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                  />
                </td>
                <td className="py-1.5 pr-2 text-center">
                  <input
                    type="checkbox"
                    checked={c.activo}
                    onChange={(e) => updateCodigo(c.key, "activo", e.target.checked)}
                    className="h-[18px] w-[18px] accent-aventurea-sky"
                  />
                </td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() => setCodigos((prev) => prev.filter((x) => x.key !== c.key))}
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
            setCodigos((prev) => [
              ...prev,
              {
                key: newKey(),
                codigo: "",
                tipo: "porcentaje",
                valor: 10,
                activo: true,
                usos_maximos: null,
                valido_hasta: null,
              },
            ])
          }
          className="mt-3.5 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
        >
          ＋ Agregar código
        </button>

        <div className="mt-4.5 flex items-center gap-3.5 border-t border-aventurea-line pt-4">
          <button
            type="button"
            disabled={pendingCodigos}
            onClick={guardarCodigos}
            className="rounded-xl bg-aventurea-sky px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
          >
            {pendingCodigos ? "Guardando..." : "Guardar códigos"}
          </button>
          {msgCodigos && (
            <span
              className={`text-[12.5px] font-bold ${msgCodigos.ok ? "text-aventurea-green" : "text-red-700"}`}
            >
              {msgCodigos.ok ? "✓ " : ""}
              {msgCodigos.text}
            </span>
          )}
        </div>
      </section>

      {/* Promociones automáticas */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
          Promociones automáticas
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Descuentos por día, visibles para todos
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Ej. &quot;45% entre semana&quot; en Lunes a Jueves. Se aplican solas
          y se muestran en el calendario público para atraer reservas.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {promociones.map((p) => (
            <div
              key={p.key}
              className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                {DIAS_SEMANA.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDia(p.key, i)}
                    className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                      p.dias_semana.includes(i)
                        ? "bg-aventurea-sky text-white"
                        : "border border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {TIPOS_PROMOCION.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => updatePromo(p.key, "tipo", t)}
                    aria-pressed={p.tipo === t}
                    className={`rounded-lg border-[1.5px] px-3.5 py-2 text-[11.5px] font-bold transition-colors ${
                      p.tipo === t
                        ? "border-aventurea-navy bg-aventurea-navy text-white"
                        : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-navy"
                    }`}
                  >
                    {t === "porcentaje" ? "% de descuento" : "Precio fijo (₡)"}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {p.tipo === "porcentaje" ? (
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                      % de descuento
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={p.porcentaje_descuento ?? ""}
                      onChange={(e) =>
                        updatePromo(
                          p.key,
                          "porcentaje_descuento",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                      className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-surface px-2.5 py-2 text-[13px] text-aventurea-ink"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        Precio fijo (₡)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={p.precio_fijo ?? ""}
                        onChange={(e) =>
                          updatePromo(
                            p.key,
                            "precio_fijo",
                            e.target.value === "" ? null : Number(e.target.value),
                          )
                        }
                        className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-surface px-2.5 py-2 text-[13px] text-aventurea-ink"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        Máximo de personas (opcional)
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder="Sin límite"
                        value={p.personas_max ?? ""}
                        onChange={(e) =>
                          updatePromo(
                            p.key,
                            "personas_max",
                            e.target.value === "" ? null : Number(e.target.value),
                          )
                        }
                        className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-surface px-2.5 py-2 text-[13px] text-aventurea-ink"
                      />
                      <p className="mt-1 text-[10.5px] leading-snug text-aventurea-ink-soft">
                        Se compara contra los invitados que la persona indique al reservar.
                      </p>
                    </div>
                  </>
                )}
                <div className={p.tipo === "porcentaje" ? "sm:col-span-2" : ""}>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Texto que se muestra
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 45% entre semana"
                    value={p.etiqueta}
                    onChange={(e) => updatePromo(p.key, "etiqueta", e.target.value)}
                    className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-surface px-2.5 py-2 text-[13px] text-aventurea-ink"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] font-bold text-aventurea-ink-soft">
                  <input
                    type="checkbox"
                    checked={p.activo}
                    onChange={(e) => updatePromo(p.key, "activo", e.target.checked)}
                    className="h-[16px] w-[16px] accent-aventurea-sky"
                  />
                  Activa
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setPromociones((prev) => prev.filter((x) => x.key !== p.key))
                  }
                  className="text-[11.5px] font-bold text-red-700 hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setPromociones((prev) => [
              ...prev,
              {
                key: newKey(),
                dias_semana: [1, 2, 3, 4],
                tipo: "porcentaje",
                porcentaje_descuento: 20,
                precio_fijo: null,
                personas_max: null,
                etiqueta: "",
                activo: true,
              },
            ])
          }
          className="mt-4 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
        >
          ＋ Agregar promoción
        </button>

        <div className="mt-4.5 flex items-center gap-3.5 border-t border-aventurea-line pt-4">
          <button
            type="button"
            disabled={pendingPromos}
            onClick={guardarPromociones}
            className="rounded-xl bg-aventurea-sky px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
          >
            {pendingPromos ? "Guardando..." : "Guardar promociones"}
          </button>
          {msgPromos && (
            <span
              className={`text-[12.5px] font-bold ${msgPromos.ok ? "text-aventurea-green" : "text-red-700"}`}
            >
              {msgPromos.ok ? "✓ " : ""}
              {msgPromos.text}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
