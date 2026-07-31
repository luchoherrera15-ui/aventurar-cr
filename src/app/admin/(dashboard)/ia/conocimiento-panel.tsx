"use client";

import { useMemo, useState, useTransition } from "react";
import {
  activarConocimiento,
  borrarConocimiento,
  crearConocimiento,
  editarConocimiento,
  guardarAsistenteNegocio,
} from "./actions";

/** Un negocio con lo que define a su asistente del chat. */
export type NegocioIA = {
  id: string;
  nombre: string;
  vertical: string | null;
  /** null = regla por defecto; true = siempre encendido; false = apagado. */
  asistenteActivo: boolean | null;
  instrucciones: string;
};

export type FilaConocimiento = {
  id: string;
  ranchoId: string;
  pregunta: string;
  respuesta: string;
  activo: boolean;
  orden: number;
};

type EstadoAsistente = { activo: boolean | null; instrucciones: string };

const MODOS: { valor: "defecto" | "si" | "no"; label: string; detalle: string }[] = [
  {
    valor: "defecto",
    label: "Según la categoría (por defecto)",
    detalle:
      "Se enciende solo en los negocios donde ya venía encendido: los de la categoría Lugares y los que están en la lista del código.",
  },
  {
    valor: "si",
    label: "Siempre encendido",
    detalle:
      "Este negocio tiene asistente aunque su categoría no lo lleve. Consume tokens cada vez que alguien le escribe.",
  },
  {
    valor: "no",
    label: "Apagado",
    detalle:
      "Nadie recibe respuestas automáticas de este negocio; los mensajes le llegan al dueño y ya.",
  },
];

const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";
const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";

function modoDe(activo: boolean | null): "defecto" | "si" | "no" {
  if (activo === null) return "defecto";
  return activo ? "si" : "no";
}

function valorDe(modo: "defecto" | "si" | "no"): boolean | null {
  if (modo === "defecto") return null;
  return modo === "si";
}

export default function ConocimientoPanel({
  negocios,
  filas: filasIniciales,
  faltaMigracion = false,
}: {
  negocios: NegocioIA[];
  filas: FilaConocimiento[];
  faltaMigracion?: boolean;
}) {
  const [ranchoId, setRanchoId] = useState(negocios[0]?.id ?? "");
  const [filas, setFilas] = useState(filasIniciales);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  // El interruptor y las instrucciones se editan en pantalla antes de
  // guardarse, así que cada negocio lleva su propia copia local. Se
  // guarda aparte lo que ya está en la base para saber si hay cambios
  // pendientes sin tener que recargar la página.
  const inicial = (): Record<string, EstadoAsistente> =>
    Object.fromEntries(
      negocios.map((n) => [n.id, { activo: n.asistenteActivo, instrucciones: n.instrucciones }]),
    );
  const [estados, setEstados] = useState<Record<string, EstadoAsistente>>(inicial);
  const [guardados, setGuardados] = useState<Record<string, EstadoAsistente>>(inicial);

  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState("");

  const conteoPorRancho = useMemo(() => {
    const acc = new Map<string, number>();
    for (const f of filas) acc.set(f.ranchoId, (acc.get(f.ranchoId) ?? 0) + 1);
    return acc;
  }, [filas]);

  const delNegocio = useMemo(
    () =>
      filas
        .filter((f) => f.ranchoId === ranchoId)
        .sort((a, b) => a.orden - b.orden || (a.pregunta < b.pregunta ? -1 : 1)),
    [filas, ranchoId],
  );

  const negocio = negocios.find((n) => n.id === ranchoId) ?? null;
  const estado = estados[ranchoId] ?? { activo: null, instrucciones: "" };
  const guardado = guardados[ranchoId] ?? { activo: null, instrucciones: "" };
  const asistenteCambiado =
    guardado.activo !== estado.activo || guardado.instrucciones !== estado.instrucciones;

  function cambiarEstado(parcial: Partial<EstadoAsistente>) {
    setEstados((prev) => ({
      ...prev,
      [ranchoId]: { ...(prev[ranchoId] ?? { activo: null, instrucciones: "" }), ...parcial },
    }));
  }

  function onGuardarAsistente() {
    setError(null);
    setMensaje(null);
    startTransition(async () => {
      const res = await guardarAsistenteNegocio(ranchoId, estado.activo, estado.instrucciones);
      if (res.error) {
        setError(res.error);
        return;
      }
      // Lo guardado en memoria queda igual que la base: así el botón se
      // apaga y no queda la duda de si el cambio se aplicó.
      setGuardados((prev) => ({ ...prev, [ranchoId]: { ...estado } }));
      setMensaje("Listo, el asistente de este negocio quedó guardado.");
    });
  }

  function onAgregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    if (!pregunta.trim() || !respuesta.trim()) {
      setError("Escribí la pregunta y la respuesta.");
      return;
    }
    const orden = delNegocio.length > 0 ? Math.max(...delNegocio.map((f) => f.orden)) + 1 : 0;
    startTransition(async () => {
      const res = await crearConocimiento({
        ranchoId,
        pregunta: pregunta.trim(),
        respuesta: respuesta.trim(),
        orden,
      });
      if (res.error || !res.id) {
        setError(res.error ?? "No se pudo guardar la respuesta.");
        return;
      }
      setFilas((prev) => [
        ...prev,
        {
          id: res.id as string,
          ranchoId,
          pregunta: pregunta.trim(),
          respuesta: respuesta.trim(),
          activo: true,
          orden,
        },
      ]);
      setPregunta("");
      setRespuesta("");
    });
  }

  function onGuardarFila(id: string, datos: { pregunta: string; respuesta: string; orden: number }) {
    setError(null);
    setMensaje(null);
    startTransition(async () => {
      const res = await editarConocimiento(id, datos);
      if (res.error) {
        setError(res.error);
        return;
      }
      setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...datos } : f)));
      setMensaje("Respuesta actualizada.");
    });
  }

  function onAlternar(id: string, activo: boolean) {
    setError(null);
    setMensaje(null);
    startTransition(async () => {
      const res = await activarConocimiento(id, activo);
      if (res.error) {
        setError(res.error);
        return;
      }
      setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, activo } : f)));
    });
  }

  function onBorrar(id: string) {
    setError(null);
    setMensaje(null);
    const ok = window.confirm("¿Borrar esta respuesta? No se puede deshacer.");
    if (!ok) return;
    startTransition(async () => {
      const res = await borrarConocimiento(id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setFilas((prev) => prev.filter((f) => f.id !== id));
    });
  }

  if (faltaMigracion) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        Todavía no existen las tablas del asistente: corré la migración{" "}
        <strong>0078_panel_ia.sql</strong> en Supabase y esta pestaña empieza a
        funcionar sola.
      </p>
    );
  }

  if (negocios.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-aventurea-line bg-aventurea-surface p-10 text-center text-[13.5px] text-zinc-500">
        No hay negocios publicados todavía.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Negocio */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4.5 shadow-sm">
        <label className={labelCls} htmlFor="negocio-conocimiento">
          Negocio
        </label>
        <select
          id="negocio-conocimiento"
          value={ranchoId}
          onChange={(e) => {
            setRanchoId(e.target.value);
            setError(null);
            setMensaje(null);
          }}
          className="w-full max-w-[520px] rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink"
        >
          {negocios.map((n) => (
            <option key={n.id} value={n.id}>
              {n.nombre} — {conteoPorRancho.get(n.id) ?? 0} respuesta
              {(conteoPorRancho.get(n.id) ?? 0) === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <p className="mt-2 max-w-[76ch] text-[12.5px] text-aventurea-ink-soft">
          Lo que se escriba acá lo lee el asistente antes de contestarle a un
          cliente. Sirve para lo que no está en la publicación: horarios raros,
          formas de pago, si aceptan mascotas, qué incluye el precio.
        </p>
      </section>

      {(error || mensaje) && (
        <p
          className={`rounded-xl p-3 text-[13px] ${
            error
              ? "bg-aventurea-orange-light font-bold text-aventurea-orange-dark"
              : "bg-aventurea-cream-2 text-aventurea-ink-soft"
          }`}
        >
          {error ?? mensaje}
        </p>
      )}

      {/* Interruptor por negocio */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Asistente de {negocio?.nombre ?? "este negocio"}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {MODOS.map((m) => {
            const puesto = modoDe(estado.activo) === m.valor;
            return (
              <label
                key={m.valor}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors ${
                  puesto
                    ? "border-aventurea-navy bg-aventurea-navy/5"
                    : "border-aventurea-line hover:border-aventurea-navy/40"
                }`}
              >
                <input
                  type="radio"
                  name="modo-asistente"
                  checked={puesto}
                  onChange={() => cambiarEstado({ activo: valorDe(m.valor) })}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-aventurea-navy"
                />
                <span>
                  <span className="block text-[13.5px] font-bold text-aventurea-ink">
                    {m.label}
                  </span>
                  <span className="mt-0.5 block max-w-[76ch] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                    {m.detalle}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-4">
          <label className={labelCls} htmlFor="instrucciones-asistente">
            Indicaciones del dueño (tono y reglas)
          </label>
          <textarea
            id="instrucciones-asistente"
            rows={4}
            value={estado.instrucciones}
            onChange={(e) => cambiarEstado({ instrucciones: e.target.value })}
            placeholder="Ej. Tuteá poco, hablá de usted. Nunca prometas descuentos. Si preguntan por fechas ocupadas, decí que revisen el calendario."
            className={inputCls}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pendiente || !asistenteCambiado}
            onClick={onGuardarAsistente}
            className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-60"
          >
            {pendiente ? "Guardando…" : "Guardar asistente"}
          </button>
          {!asistenteCambiado && (
            <span className="text-[12.5px] text-aventurea-ink-soft">
              No hay cambios pendientes.
            </span>
          )}
        </div>
      </section>

      {/* Alta de respuestas */}
      <section>
        <p className="mb-3 flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Enseñarle algo nuevo
        </p>
        <form
          onSubmit={onAgregar}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4.5 shadow-sm"
        >
          <div>
            <label className={labelCls} htmlFor="nueva-pregunta">
              Pregunta del cliente
            </label>
            <input
              id="nueva-pregunta"
              type="text"
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              placeholder="Ej. ¿Se puede llevar comida de afuera?"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="nueva-respuesta">
              Respuesta
            </label>
            <textarea
              id="nueva-respuesta"
              rows={3}
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              placeholder="Ej. Sí, sin problema. Solo pedimos que no entre vidrio a la zona de piscina."
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={pendiente}
            className="h-[42px] w-fit rounded-xl bg-aventurea-navy px-5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-60"
          >
            Agregar respuesta
          </button>
        </form>
      </section>

      {/* Lo que ya sabe */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
            Lo que ya sabe
          </p>
          <p className="text-[12px] text-aventurea-ink-soft">
            El orden decide con qué se queda primero cuando hay muchas.
          </p>
        </div>

        {delNegocio.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-aventurea-line bg-aventurea-surface p-10 text-center text-[13.5px] text-zinc-500">
            Este negocio no tiene respuestas cargadas: el asistente contesta
            solo con lo que dice la publicación.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {delNegocio.map((f) => (
              <FilaEditor
                key={f.id}
                fila={f}
                pendiente={pendiente}
                onGuardar={onGuardarFila}
                onAlternar={onAlternar}
                onBorrar={onBorrar}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilaEditor({
  fila,
  pendiente,
  onGuardar,
  onAlternar,
  onBorrar,
}: {
  fila: FilaConocimiento;
  pendiente: boolean;
  onGuardar: (id: string, datos: { pregunta: string; respuesta: string; orden: number }) => void;
  onAlternar: (id: string, activo: boolean) => void;
  onBorrar: (id: string) => void;
}) {
  const [pregunta, setPregunta] = useState(fila.pregunta);
  const [respuesta, setRespuesta] = useState(fila.respuesta);
  const [orden, setOrden] = useState(String(fila.orden));

  const cambiada =
    pregunta !== fila.pregunta || respuesta !== fila.respuesta || Number(orden) !== fila.orden;

  return (
    <div
      className={`rounded-2xl border bg-aventurea-surface p-4.5 shadow-sm ${
        fila.activo ? "border-aventurea-line" : "border-dashed border-aventurea-line opacity-70"
      }`}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_100px]">
        <div>
          <label className={labelCls}>Pregunta</label>
          <input
            type="text"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Orden</label>
          <input
            type="number"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls}>Respuesta</label>
        <textarea
          rows={3}
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          className={inputCls}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={pendiente || !cambiada}
          onClick={() =>
            onGuardar(fila.id, {
              pregunta,
              respuesta,
              orden: Number(orden) || 0,
            })
          }
          className="rounded-xl bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => onAlternar(fila.id, !fila.activo)}
          className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy disabled:opacity-50"
        >
          {fila.activo ? "Desactivar" : "Activar"}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => onBorrar(fila.id)}
          className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-red-400 hover:text-red-700 disabled:opacity-50"
        >
          Borrar
        </button>
        {!fila.activo && (
          <span className="text-[12px] text-aventurea-ink-soft">
            Desactivada: el asistente no la usa.
          </span>
        )}
      </div>
    </div>
  );
}
