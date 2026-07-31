"use client";

import { useState, useTransition } from "react";
import {
  actualizarConocimiento,
  crearConocimiento,
  eliminarConocimiento,
  guardarAsistenteActivo,
  guardarInstruccionesAsistente,
  reordenarConocimiento,
  type ConocimientoFila,
} from "./actions";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";
const tarjetaCls = "rounded-2xl border border-aventurea-line bg-aventurea-surface p-5";
const botonPrimario =
  "rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60";
const botonChico =
  "h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange disabled:opacity-40";

const PREGUNTA_MAX = 160;
const RESPUESTA_MAX = 700;
const INSTRUCCIONES_MAX = 800;

/** Preguntas que a todos los negocios les llegan por chat, para que la
 *  pantalla no arranque en blanco: al tocarlas se llena el formulario y
 *  el dueño solo escribe SU respuesta (nadie contesta por él). */
const SUGERENCIAS = [
  "¿Aceptan mascotas?",
  "¿Hay parqueo?",
  "¿Se puede llevar comida de afuera?",
  "¿Hasta qué hora se puede tener música?",
  "¿Qué pasa si llueve?",
  "¿Cómo llego? ¿Tienen waze?",
];

const EJEMPLO_TONO =
  "Tuteanos no: hablá de vos. Somos un negocio familiar, contestá con calidez y siempre invitá a agendar una visita. Si preguntan por diciembre, aclarales que esas fechas se llenan rápido.";

type Estado = "defecto" | "si" | "no";

function aEstado(valor: boolean | null): Estado {
  if (valor === true) return "si";
  if (valor === false) return "no";
  return "defecto";
}

function aValor(estado: Estado): boolean | null {
  if (estado === "si") return true;
  if (estado === "no") return false;
  return null;
}

/**
 * La pantalla donde el dueño le enseña cosas a su asistente: si contesta
 * o no, con qué tono, y las respuestas propias que puede citar. Todo se
 * guarda por acciones de servidor que revalidan la ruta; el estado local
 * es solo para que la lista se sienta inmediata.
 */
export default function AsistentePanel({
  ranchoId,
  activoInicial,
  porDefectoActivo,
  instruccionesInicial,
  conocimientoInicial,
}: {
  ranchoId: string;
  /** null = regla por defecto, true = siempre encendido, false = apagado. */
  activoInicial: boolean | null;
  /** Qué hace hoy la regla por defecto para este negocio. */
  porDefectoActivo: boolean;
  instruccionesInicial: string;
  conocimientoInicial: ConocimientoFila[];
}) {
  const [estado, setEstado] = useState<Estado>(aEstado(activoInicial));
  const [estadoOk, setEstadoOk] = useState(false);

  const [instrucciones, setInstrucciones] = useState(instruccionesInicial);
  const [instruccionesOk, setInstruccionesOk] = useState(false);

  const [filas, setFilas] = useState<ConocimientoFila[]>(
    [...conocimientoInicial].sort((a, b) => a.orden - b.orden),
  );
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [editando, setEditando] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const encendido = estado === "si" || (estado === "defecto" && porDefectoActivo);

  function cambiarEstado(nuevo: Estado) {
    const previo = estado;
    setEstado(nuevo);
    setEstadoOk(false);
    setError(null);
    iniciar(async () => {
      const res = await guardarAsistenteActivo(ranchoId, aValor(nuevo));
      if (res.error) {
        // Si la base rechazó el cambio, el botón vuelve a lo que era:
        // que la pantalla no muestre un estado que no está guardado.
        setEstado(previo);
        setError(res.error);
        return;
      }
      setEstadoOk(true);
    });
  }

  function guardarTono() {
    setError(null);
    setInstruccionesOk(false);
    iniciar(async () => {
      const res = await guardarInstruccionesAsistente(ranchoId, instrucciones);
      if (res.error) setError(res.error);
      else setInstruccionesOk(true);
    });
  }

  function limpiarFormulario() {
    setPregunta("");
    setRespuesta("");
    setEditando(null);
  }

  function guardar() {
    setError(null);
    const activo = editando
      ? (filas.find((f) => f.id === editando)?.activo ?? true)
      : true;
    iniciar(async () => {
      const res = editando
        ? await actualizarConocimiento(ranchoId, editando, { pregunta, respuesta, activo })
        : await crearConocimiento(ranchoId, { pregunta, respuesta, activo });
      if (res.error || !res.fila) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      const fila = res.fila;
      setFilas((prev) =>
        editando ? prev.map((f) => (f.id === fila.id ? fila : f)) : [...prev, fila],
      );
      limpiarFormulario();
    });
  }

  function alternarActivo(fila: ConocimientoFila) {
    setError(null);
    iniciar(async () => {
      const res = await actualizarConocimiento(ranchoId, fila.id, {
        pregunta: fila.pregunta,
        respuesta: fila.respuesta,
        activo: !fila.activo,
      });
      if (res.error || !res.fila) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      const nueva = res.fila;
      setFilas((prev) => prev.map((f) => (f.id === nueva.id ? nueva : f)));
    });
  }

  function mover(fila: ConocimientoFila, direccion: -1 | 1) {
    const idx = filas.findIndex((f) => f.id === fila.id);
    const destino = idx + direccion;
    if (idx < 0 || destino < 0 || destino >= filas.length) return;

    const nuevo = [...filas];
    [nuevo[idx], nuevo[destino]] = [nuevo[destino], nuevo[idx]];
    setFilas(nuevo);
    setError(null);
    iniciar(async () => {
      const res = await reordenarConocimiento(
        ranchoId,
        nuevo.map((f) => f.id),
      );
      if (res.error) setError(res.error);
    });
  }

  function borrar(fila: ConocimientoFila) {
    if (!confirm(`¿Borrar "${fila.pregunta}"?`)) return;
    setError(null);
    iniciar(async () => {
      const res = await eliminarConocimiento(ranchoId, fila.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setFilas((prev) => prev.filter((f) => f.id !== fila.id));
      if (editando === fila.id) limpiarFormulario();
    });
  }

  const opciones: { valor: Estado; titulo: string; detalle: string }[] = [
    {
      valor: "defecto",
      titulo: "Según la categoría (por defecto)",
      detalle: porDefectoActivo
        ? "Hoy tu categoría lo tiene encendido, así que el asistente contesta. Si mañana cambiamos esa regla, tu negocio la sigue."
        : "Hoy tu categoría lo tiene apagado, así que nadie contesta automáticamente. Si mañana lo activamos para tu categoría, tu negocio la sigue.",
    },
    {
      valor: "si",
      titulo: "Siempre encendido",
      detalle:
        "El asistente contesta el primer mensaje de todo cliente, pase lo que pase con la regla general.",
    },
    {
      valor: "no",
      titulo: "Apagado",
      detalle:
        "Nadie contesta por vos: los mensajes te llegan y esperan hasta que respondás desde Mensajes.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}

      {/* 1. El interruptor */}
      <section className={tarjetaCls}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-aventurea-ink">
            ¿Querés que el asistente conteste?
          </h2>
          <span
            className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${
              encendido
                ? "bg-aventurea-green-light text-aventurea-green"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {encendido ? "Contestando" : "Apagado"}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {opciones.map((o) => (
            <button
              key={o.valor}
              type="button"
              disabled={pendiente}
              onClick={() => cambiarEstado(o.valor)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                estado === o.valor
                  ? "border-aventurea-navy bg-aventurea-navy/5"
                  : "border-aventurea-line bg-aventurea-cream-2 hover:border-aventurea-navy"
              }`}
            >
              <span
                className={`block text-[13.5px] font-bold ${
                  estado === o.valor ? "text-aventurea-navy" : "text-aventurea-ink"
                }`}
              >
                {estado === o.valor ? "● " : "○ "}
                {o.titulo}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                {o.detalle}
              </span>
            </button>
          ))}
        </div>

        {estadoOk && (
          <p className="mt-3 text-[12.5px] font-bold text-aventurea-green">✓ Guardado</p>
        )}
      </section>

      {/* 2. Tono e indicaciones */}
      <section className={tarjetaCls}>
        <h2 className="text-[15px] font-bold text-aventurea-ink">
          Tono e indicaciones
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          Cómo querés que suene y qué querés que empuje. Esto no le da datos
          nuevos: solo le dice cómo hablar. Dejalo vacío y contesta con el tono
          normal de Bookea.
        </p>
        <div className="mt-4">
          <label className={labelCls} htmlFor="tono-asistente">
            Indicaciones (opcional)
          </label>
          <textarea
            id="tono-asistente"
            rows={4}
            maxLength={INSTRUCCIONES_MAX}
            value={instrucciones}
            onChange={(e) => {
              setInstruccionesOk(false);
              setInstrucciones(e.target.value);
            }}
            placeholder={`Ej. ${EJEMPLO_TONO}`}
            className={inputCls}
          />
          <p className="mt-1 text-[11.5px] text-aventurea-ink-soft">
            {instrucciones.length}/{INSTRUCCIONES_MAX}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={guardarTono}
            disabled={pendiente}
            className={botonPrimario}
          >
            {pendiente ? "Guardando..." : "Guardar indicaciones"}
          </button>
          {instruccionesOk && (
            <span className="text-[12.5px] font-bold text-aventurea-green">
              ✓ Guardado
            </span>
          )}
        </div>
      </section>

      {/* 3. Las respuestas propias */}
      <section className={tarjetaCls}>
        <h2 className="text-[15px] font-bold text-aventurea-ink">
          Respuestas que le enseñás
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          Las preguntas que más te hacen, con la respuesta exacta que darías vos.
          El asistente las usa tal cual. Poné arriba las más importantes: si un
          día hay que recortar, se citan las primeras.
        </p>

        {filas.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-aventurea-line">
            {filas.map((fila, idx) => (
              <div
                key={fila.id}
                className={`flex flex-wrap items-start gap-3 border-b border-aventurea-line bg-aventurea-surface px-4 py-3 last:border-none ${
                  fila.activo ? "" : "opacity-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-aventurea-ink">
                    {fila.pregunta}
                    {!fila.activo && (
                      <span className="ml-2 rounded-lg bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-zinc-500">
                        Pausada
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                    {fila.respuesta}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={pendiente || idx === 0}
                    onClick={() => mover(fila, -1)}
                    aria-label="Subir"
                    className="h-[30px] w-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pendiente || idx === filas.length - 1}
                    onClick={() => mover(fila, 1)}
                    aria-label="Bajar"
                    className="h-[30px] w-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => {
                      setEditando(fila.id);
                      setPregunta(fila.pregunta);
                      setRespuesta(fila.respuesta);
                    }}
                    className={botonChico}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => alternarActivo(fila)}
                    className={botonChico}
                  >
                    {fila.activo ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => borrar(fila)}
                    className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-red-700 hover:border-red-300 disabled:opacity-40"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {filas.length === 0 && (
          <p className="mt-4 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
            Todavía no le enseñaste nada. Empezá por las tres preguntas que más
            te repiten por WhatsApp — con eso el asistente ya te ahorra la mitad
            de los mensajes.
          </p>
        )}

        <div className="mt-5 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-4">
          <h3 className="text-[13.5px] font-bold text-aventurea-ink">
            {editando ? "Editar respuesta" : "Agregar una respuesta"}
          </h3>

          {!editando && (
            <div className="mt-3">
              <p className={labelCls}>Ideas para arrancar</p>
              <div className="flex flex-wrap gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPregunta(s)}
                    className="rounded-lg border border-aventurea-line bg-aventurea-surface px-2.5 py-1.5 text-[12px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
                Tocá una y escribí tu respuesta: nadie contesta por vos.
              </p>
            </div>
          )}

          <div className="mt-4">
            <label className={labelCls} htmlFor="pregunta-nueva">
              Pregunta del cliente
            </label>
            <input
              id="pregunta-nueva"
              type="text"
              maxLength={PREGUNTA_MAX}
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              placeholder="Ej. ¿Hay parqueo?"
              className={inputCls}
            />
          </div>

          <div className="mt-3">
            <label className={labelCls} htmlFor="respuesta-nueva">
              Lo que tiene que contestar
            </label>
            <textarea
              id="respuesta-nueva"
              rows={3}
              maxLength={RESPUESTA_MAX}
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              placeholder="Ej. Sí, hay parqueo propio para 20 carros dentro de la propiedad, sin costo extra."
              className={inputCls}
            />
            <p className="mt-1 text-[11.5px] text-aventurea-ink-soft">
              {respuesta.length}/{RESPUESTA_MAX}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={pendiente || !pregunta.trim() || !respuesta.trim()}
              className={botonPrimario}
            >
              {pendiente
                ? "Guardando..."
                : editando
                  ? "Guardar cambios"
                  : "Agregar respuesta"}
            </button>
            {(editando || pregunta || respuesta) && (
              <button
                type="button"
                onClick={limpiarFormulario}
                disabled={pendiente}
                className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
