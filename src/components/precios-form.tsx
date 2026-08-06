"use client";

import { useState, useTransition } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  GuardarPreciosInput,
  PrecioTier,
  ServicioAdicional,
} from "@/app/mi-negocio/types";
import {
  MODALIDADES_PRECIO_LUGAR,
  MODALIDAD_PRECIO_LUGAR_LABEL,
  type ModalidadPrecioLugar,
} from "@/app/mi-negocio/types";
import { IconTrash } from "@/components/icons";
import SeccionPlegable from "@/components/seccion-plegable";

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

const CLASE_INPUT =
  "w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink px-2.5 py-2 text-[13px]";

/** Los rangos de diciembre son filas de la misma tabla (0099). */
function esDeDiciembre(t: PrecioTier) {
  return t.temporada === "diciembre";
}

function aDraft(t: PrecioTier): TierDraft {
  return {
    key: t.id,
    min_invitados: t.min_invitados,
    max_invitados: t.max_invitados,
    precio: t.precio,
  };
}

export type GuardarPreciosFn = (
  input: GuardarPreciosInput,
) => Promise<{ error: string | null } | undefined>;

/**
 * La tabla de rangos "desde–hasta–precio". Es la misma para los precios
 * de todo el año y para los de diciembre: cambiarla en un solo lugar
 * evita que las dos listas terminen comportándose distinto.
 */
function EditorRangos({
  rangos,
  setRangos,
  vacio,
  nota,
}: {
  rangos: TierDraft[];
  setRangos: Dispatch<SetStateAction<TierDraft[]>>;
  /** Qué decir cuando todavía no hay ningún rango cargado. */
  vacio?: string;
  /** Aclaración corta debajo del botón de agregar. */
  nota?: string;
}) {
  function actualizar(key: string, campo: keyof TierDraft, valor: number) {
    setRangos((prev) =>
      prev.map((t) => (t.key === key ? { ...t, [campo]: valor } : t)),
    );
  }

  return (
    <div>
      {rangos.length > 0 ? (
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
            {rangos.map((t) => (
              <tr key={t.key}>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={t.min_invitados}
                    onChange={(e) =>
                      actualizar(t.key, "min_invitados", Number(e.target.value))
                    }
                    className={CLASE_INPUT}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={t.max_invitados}
                    onChange={(e) =>
                      actualizar(t.key, "max_invitados", Number(e.target.value))
                    }
                    className={CLASE_INPUT}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={t.precio}
                    onChange={(e) =>
                      actualizar(t.key, "precio", Number(e.target.value))
                    }
                    className={CLASE_INPUT}
                  />
                </td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setRangos((prev) => prev.filter((x) => x.key !== t.key))
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
      ) : (
        vacio && (
          <p className="mt-4 rounded-lg border border-dashed border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[12px] text-aventurea-ink-soft">
            {vacio}
          </p>
        )
      )}

      <button
        type="button"
        onClick={() =>
          setRangos((prev) => {
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
        className="mt-3.5 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
      >
        ＋ Agregar rango
      </button>
      {nota && (
        <p className="mt-2 text-[11px] text-aventurea-ink-soft">{nota}</p>
      )}
    </div>
  );
}

export default function PreciosForm({
  initialTiers,
  initialServicios,
  initialTarifaDiciembre,
  initialDepositoReserva,
  initialModalidadPrecio,
  initialPrecioHora,
  initialPrecioFijo,
  initialPrecioHoraDiciembre,
  initialPrecioFijoDiciembre,
  onGuardar,
}: {
  /** TODOS los rangos del lugar: acá se separan por temporada (0099). */
  initialTiers: PrecioTier[];
  initialServicios: ServicioAdicional[];
  initialTarifaDiciembre: number;
  initialDepositoReserva: number;
  initialModalidadPrecio: ModalidadPrecioLugar;
  initialPrecioHora: number | null;
  initialPrecioFijo: number | null;
  initialPrecioHoraDiciembre: number | null;
  initialPrecioFijoDiciembre: number | null;
  onGuardar: GuardarPreciosFn;
}) {
  const [tiers, setTiers] = useState<TierDraft[]>(
    initialTiers.filter((t) => !esDeDiciembre(t)).map(aDraft),
  );
  const [tiersDiciembre, setTiersDiciembre] = useState<TierDraft[]>(
    initialTiers.filter(esDeDiciembre).map(aDraft),
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
  const [precioHoraDiciembre, setPrecioHoraDiciembre] = useState(
    initialPrecioHoraDiciembre ?? 0,
  );
  const [precioFijoDiciembre, setPrecioFijoDiciembre] = useState(
    initialPrecioFijoDiciembre ?? 0,
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  function updateServicio(
    key: string,
    field: keyof ServicioDraft,
    value: string | number | boolean | null,
  ) {
    setServicios((prev) =>
      prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)),
    );
  }

  // Se calcula de los valores GUARDADOS, no del estado: si dependiera
  // de lo que se está escribiendo, borrar el último rango cerraría la
  // sección de golpe mientras el dueño la está editando.
  const diciembreYaCargado =
    initialTiers.some(esDeDiciembre) ||
    initialTarifaDiciembre > 0 ||
    (initialPrecioHoraDiciembre ?? 0) > 0 ||
    (initialPrecioFijoDiciembre ?? 0) > 0;

  // El resumen del encabezado sí sigue lo que hay en pantalla.
  const tieneDiciembre =
    modalidadPrecio === "rango_personas"
      ? tiersDiciembre.length > 0 || tarifaDiciembre > 0
      : modalidadPrecio === "hora"
        ? precioHoraDiciembre > 0
        : precioFijoDiciembre > 0;

  function guardar() {
    setMessage(null);
    startTransition(async () => {
      const soloRango = (t: TierDraft) => ({
        min_invitados: t.min_invitados,
        max_invitados: t.max_invitados,
        precio: t.precio,
      });
      const res = await onGuardar({
        tiers: tiers.map(soloRango),
        tiersDiciembre: tiersDiciembre.map(soloRango),
        servicios: servicios.map((s) => ({
          nombre: s.nombre,
          precio: s.precio,
          requisito_max_invitados: s.requisito_max_invitados,
          activo: s.activo,
        })),
        tarifaDiciembre,
        depositoReserva,
        modalidadPrecio,
        precioHora: modalidadPrecio === "hora" ? precioHora : null,
        precioFijo: modalidadPrecio === "fijo" ? precioFijo : null,
        // 0 no es "gratis en diciembre": es "ese mes cobro lo de
        // siempre", y eso en la base se escribe null.
        precioHoraDiciembre:
          modalidadPrecio === "hora" && precioHoraDiciembre > 0
            ? precioHoraDiciembre
            : null,
        precioFijoDiciembre:
          modalidadPrecio === "fijo" && precioFijoDiciembre > 0
            ? precioFijoDiciembre
            : null,
      });
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
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
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
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
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
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
            Rangos de invitados
          </p>
          <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
            Rangos de precio según número de invitados
          </h3>
          <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
            Si un número de invitados no cae en ningún rango, el sitio muestra
            &quot;cotización personalizada&quot;.
          </p>

          <EditorRangos
            rangos={tiers}
            setRangos={setTiers}
            vacio="Todavía no cargaste ningún rango: mientras tanto, el sitio pide cotización personalizada."
            nota="Cada rango nuevo continúa automáticamente donde terminó el anterior — solo ajustá el precio."
          />
        </section>
      )}

      {/* Diciembre es su propia lista de precios (0099), no un recargo:
          lo que quede acá vacío se cobra igual que el resto del año. */}
      <SeccionPlegable
        abierta={diciembreYaCargado}
        etiqueta="Temporada alta"
        titulo="Precios de diciembre"
        descripcion="Lo que cobrás solo en diciembre. Si lo dejás vacío, ese mes se cobra igual que el resto del año."
        resumen={tieneDiciembre ? "Con precios propios" : "Igual todo el año"}
      >
        {modalidadPrecio === "rango_personas" && (
          <>
            <p className="text-[12.5px] text-aventurea-ink-soft">
              Los mismos rangos de arriba, pero con los precios de
              diciembre. Un número de invitados que no caiga en ninguno se
              cobra con los rangos de todo el año.
            </p>

            <EditorRangos
              rangos={tiersDiciembre}
              setRangos={setTiersDiciembre}
              vacio="Sin rangos de diciembre: ese mes se cobra con los precios de todo el año."
              nota="Podés copiar los mismos tramos de arriba y subirles el precio."
            />

            <div className="mt-4.5 border-t border-dashed border-aventurea-line pt-4">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                Tarifa por persona de diciembre (₡)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={tarifaDiciembre}
                  onChange={(e) => setTarifaDiciembre(Number(e.target.value))}
                  className="w-32 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                />
                <span className="text-[12.5px] text-aventurea-ink-soft">
                  colones por persona
                </span>
              </div>
              <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
                La forma vieja de cobrar diciembre; sigue funcionando. Si
                cargaste rangos de diciembre, mandan los rangos. Dejala en
                0 si no la usás.
              </p>
            </div>
          </>
        )}

        {modalidadPrecio === "hora" && (
          <>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Precio por hora en diciembre (₡)
            </label>
            <input
              type="number"
              min={0}
              value={precioHoraDiciembre}
              onChange={(e) => setPrecioHoraDiciembre(Number(e.target.value))}
              className="w-40 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
            />
            <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
              Dejalo en 0 si en diciembre cobrás la misma hora que el resto
              del año.
            </p>
          </>
        )}

        {modalidadPrecio === "fijo" && (
          <>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Precio fijo del evento en diciembre (₡)
            </label>
            <input
              type="number"
              min={0}
              value={precioFijoDiciembre}
              onChange={(e) => setPrecioFijoDiciembre(Number(e.target.value))}
              className="w-40 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
            />
            <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
              Dejalo en 0 si en diciembre cobrás lo mismo que el resto del
              año.
            </p>
          </>
        )}
      </SeccionPlegable>

      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
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
                    className={CLASE_INPUT}
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
                    className={CLASE_INPUT}
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
                    className={CLASE_INPUT}
                  />
                </td>
                <td className="py-1.5 pr-2 text-center">
                  <input
                    type="checkbox"
                    checked={s.activo}
                    onChange={(e) =>
                      updateServicio(s.key, "activo", e.target.checked)
                    }
                    className="h-[18px] w-[18px] accent-aventurea-sky"
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
          className="mt-3.5 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
        >
          ＋ Agregar servicio
        </button>
      </section>

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          disabled={pending}
          onClick={guardar}
          className="rounded-xl bg-aventurea-sky px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
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
