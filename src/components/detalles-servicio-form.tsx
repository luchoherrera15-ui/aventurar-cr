"use client";

import {
  CAMPOS_POR_CATEGORIA,
  type Campo,
  type DetallesServicio,
} from "@/app/mi-rancho/campos-servicio";
import type { Categoria } from "@/app/mi-rancho/types";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

/**
 * Pinta los campos que le tocan a la categoría elegida. Todo se guarda
 * en un solo campo oculto como JSON, así el formulario padre no tiene
 * que saber nada de qué campos existen.
 */
export default function DetallesServicioForm({
  categoria,
  valores,
  onCambiar,
}: {
  categoria: Categoria;
  valores: DetallesServicio;
  onCambiar: (valores: DetallesServicio) => void;
}) {
  const grupos = CAMPOS_POR_CATEGORIA[categoria];
  if (!grupos || grupos.length === 0) return null;

  function set(id: string, valor: string | number | boolean | string[]) {
    onCambiar({ ...valores, [id]: valor });
  }

  function toggleMulti(id: string, opcion: string) {
    const actual = Array.isArray(valores[id]) ? (valores[id] as string[]) : [];
    set(
      id,
      actual.includes(opcion)
        ? actual.filter((v) => v !== opcion)
        : [...actual, opcion],
    );
  }

  return (
    <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Detalles del servicio
      </p>
      <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
        Lo que el cliente necesita saber antes de escribirte
      </h3>
      <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
        Estos campos cambian según el tipo de servicio que elegiste arriba.
        Completá lo que aplique — lo que dejés vacío no se muestra.
      </p>

      <input type="hidden" name="detalles" value={JSON.stringify(valores)} />

      <div className="mt-5 flex flex-col gap-6">
        {grupos.map((grupo) => (
          <div key={grupo.titulo}>
            <h4 className="mb-3 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              {grupo.titulo}
            </h4>

            {/* Los booleanos se agrupan como pastillas; el resto va apilado. */}
            <div className="flex flex-wrap gap-2">
              {grupo.campos
                .filter((c) => c.tipo === "booleano")
                .map((campo) => {
                  const activo = Boolean(valores[campo.id]);
                  return (
                    <button
                      key={campo.id}
                      type="button"
                      onClick={() => set(campo.id, !activo)}
                      aria-pressed={activo}
                      className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                        activo
                          ? "border-aventurea-orange bg-aventurea-orange/10 text-aventurea-orange"
                          : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-orange"
                      }`}
                    >
                      {activo && <span aria-hidden>✓ </span>}
                      {campo.label}
                    </button>
                  );
                })}
            </div>

            <div className="mt-3 flex flex-col gap-3.5">
              {grupo.campos
                .filter((c) => c.tipo !== "booleano")
                .map((campo) => (
                  <CampoControl
                    key={campo.id}
                    campo={campo}
                    valor={valores[campo.id]}
                    onSet={(v) => set(campo.id, v)}
                    onToggleMulti={(o) => toggleMulti(campo.id, o)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CampoControl({
  campo,
  valor,
  onSet,
  onToggleMulti,
}: {
  campo: Campo;
  valor: unknown;
  onSet: (v: string | number | boolean | string[]) => void;
  onToggleMulti: (opcion: string) => void;
}) {
  const ayuda = campo.ayuda && (
    <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500">
      {campo.ayuda}
    </p>
  );

  if (campo.tipo === "multi") {
    const marcados = Array.isArray(valor) ? (valor as string[]) : [];
    return (
      <div>
        <label className={labelCls}>{campo.label}</label>
        <div className="flex flex-wrap gap-2">
          {campo.opciones?.map((o) => {
            const activo = marcados.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onToggleMulti(o.id)}
                aria-pressed={activo}
                className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                  activo
                    ? "border-aventurea-orange bg-aventurea-orange/10 text-aventurea-orange"
                    : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-orange"
                }`}
              >
                {activo && <span aria-hidden>✓ </span>}
                {o.label}
              </button>
            );
          })}
        </div>
        {ayuda}
      </div>
    );
  }

  if (campo.tipo === "opciones") {
    return (
      <div>
        <label className={labelCls}>{campo.label}</label>
        <select
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onSet(e.target.value)}
          className={inputCls}
        >
          <option value="">Selecciona una opción</option>
          {campo.opciones?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {ayuda}
      </div>
    );
  }

  if (campo.tipo === "textarea") {
    return (
      <div>
        <label className={labelCls}>{campo.label}</label>
        <textarea
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onSet(e.target.value)}
          placeholder={campo.placeholder}
          className={`min-h-[90px] field-sizing-content ${inputCls}`}
        />
        {ayuda}
      </div>
    );
  }

  return (
    <div>
      <label className={labelCls}>
        {campo.label}
        {campo.sufijo && (
          <span className="ml-1 font-normal normal-case tracking-normal text-zinc-500">
            ({campo.sufijo})
          </span>
        )}
      </label>
      <input
        type={campo.tipo === "numero" ? "number" : "text"}
        min={campo.tipo === "numero" ? 0 : undefined}
        value={
          typeof valor === "string" || typeof valor === "number" ? String(valor) : ""
        }
        onChange={(e) => onSet(e.target.value)}
        placeholder={campo.placeholder}
        className={inputCls}
      />
      {ayuda}
    </div>
  );
}
