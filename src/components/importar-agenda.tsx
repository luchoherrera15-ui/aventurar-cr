"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  desbloquearAgendaIA,
  deshacerImportacion,
  guardarLoteAgenda,
  partirTextoPegado,
} from "@/app/mi-negocio/[id]/importar-agenda-actions";
import {
  detectarChoques,
  filaVacia,
  nombreDia,
  validarFila,
  type ConfigNegocio,
  type FilaAgenda,
} from "@/lib/agenda/importar-agenda";
import { IconCalendarLine } from "./icons";

/**
 * "Traé tu agenda" — pasar a la plataforma la agenda que el proveedor
 * ya llevaba en papel, en Excel o en un cuaderno.
 *
 * Dos caminos que caen en la MISMA tabla de revisión:
 *
 *   A mano (gratis)     — pega columnas o escribe fila por fila.
 *   Con IA (complemento)— sube fotos de la agenda y Claude las lee.
 *
 * La tabla de revisión no es un trámite: ni el partidor de columnas ni
 * el modelo pueden saber si "Erika" del 23 de octubre es la misma del
 * 20 de setiembre. Nada se guarda sin que el dueño lo mire.
 */

type Modo = "manual" | "ia";

export default function ImportarAgenda({
  ranchoId,
  negocio,
  hoy,
  addonActivo,
}: {
  ranchoId: string;
  negocio: ConfigNegocio;
  /** "YYYY-MM-DD" en hora de Costa Rica, calculado en el servidor. */
  hoy: string;
  addonActivo: boolean;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("manual");
  const [filas, setFilas] = useState<FilaAgenda[]>([]);
  const [pegado, setPegado] = useState("");
  const [contexto, setContexto] = useState("");
  const [resumenIA, setResumenIA] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [ultimaImportacion, setUltimaImportacion] = useState<string | null>(null);
  const inputFotos = useRef<HTMLInputElement>(null);

  // El complemento arranca apagado para todo el mundo; se abre con el
  // código. `addonActivo` llega del servidor (ya desbloqueado antes),
  // y `abiertoAhora` cubre el desbloqueo de esta misma sesión sin
  // esperar a que el router refresque.
  const [abiertoAhora, setAbiertoAhora] = useState(false);
  const [codigo, setCodigo] = useState("");
  const desbloqueado = addonActivo || abiertoAhora;

  function desbloquear() {
    if (!codigo.trim()) return;
    setMensaje(null);
    iniciar(async () => {
      const res = await desbloquearAgendaIA(ranchoId, codigo);
      if (res.error) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      setAbiertoAhora(true);
      setCodigo("");
      setMensaje({ tipo: "ok", texto: "Listo, ya podés subir las fotos de tu agenda." });
      router.refresh();
    });
  }

  const esCitas = negocio.vertical === "citas" || negocio.vertical === "restaurantes";
  const esHospedaje = negocio.vertical === "hospedajes";

  // Validación en vivo: el dueño ve qué le falta antes de guardar.
  const { choques, porFila, listas } = useMemo(() => {
    const choques = detectarChoques(filas, negocio);
    const porFila = new Map(filas.map((f) => [f.id, validarFila(f, negocio)]));
    const listas = filas.filter((f) => porFila.get(f.id)?.ok && !choques.has(f.id)).length;
    return { choques, porFila, listas };
  }, [filas, negocio]);

  function editar(id: string, cambios: Partial<FilaAgenda>) {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  function quitar(id: string) {
    setFilas((prev) => prev.filter((f) => f.id !== id));
  }

  // ---------- Camino manual ----------

  function partir() {
    if (!pegado.trim()) return;
    setMensaje(null);
    iniciar(async () => {
      const res = await partirTextoPegado(ranchoId, pegado);
      if (res.error) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      setFilas((prev) => [...prev, ...(res.filas ?? [])]);
      setPegado("");
      setMensaje({ tipo: "ok", texto: `${res.filas?.length ?? 0} filas listas para revisar.` });
    });
  }

  // ---------- Camino con IA ----------

  /**
   * Baja la resolución antes de subir. Opus 5 no aprovecha más de
   * ~2576 px de lado largo, así que mandar la foto original de 12 MP
   * solo encarece la corrida sin leer mejor.
   */
  async function comprimir(file: File): Promise<{ mediaType: string; datos: string }> {
    const bitmap = await createImageBitmap(file);
    const MAX = 2000;
    const escala = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { mediaType: "image/jpeg", datos: dataUrl.split(",")[1] ?? "" };
  }

  async function leerConIA(files: FileList) {
    setMensaje(null);
    setResumenIA(null);
    setLeyendo(true);
    try {
      const fotos = [];
      for (const file of Array.from(files).slice(0, 8)) {
        fotos.push(await comprimir(file));
      }

      const res = await fetch("/api/agenda/leer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ranchoId, modo: "foto", fotos, contexto }),
      });
      const data = (await res.json()) as {
        error?: string;
        filas?: FilaAgenda[];
        resumen?: string | null;
      };

      if (!res.ok) {
        setMensaje({ tipo: "error", texto: data.error ?? "No se pudo leer la agenda." });
        return;
      }
      setFilas((prev) => [...prev, ...(data.filas ?? [])]);
      setResumenIA(data.resumen ?? null);
      setMensaje({
        tipo: "ok",
        texto: `${data.filas?.length ?? 0} filas leídas. Revisalas antes de guardar.`,
      });
    } catch {
      setMensaje({ tipo: "error", texto: "No se pudo procesar las fotos." });
    } finally {
      setLeyendo(false);
      if (inputFotos.current) inputFotos.current.value = "";
    }
  }

  // ---------- Guardar ----------

  function guardar() {
    const guardables = filas.filter((f) => porFila.get(f.id)?.ok && !choques.has(f.id));
    if (guardables.length === 0) return;
    setMensaje(null);
    iniciar(async () => {
      const res = await guardarLoteAgenda(ranchoId, guardables, modo === "ia" ? "ia_foto" : "manual");
      if (res.error) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      const rechazadas = res.rechazadas ?? [];
      setUltimaImportacion(res.importacionId ?? null);
      setFilas((prev) => prev.filter((f) => !guardables.some((g) => g.id === f.id)));
      setMensaje({
        tipo: rechazadas.length ? "error" : "ok",
        texto: rechazadas.length
          ? `Se guardaron ${res.guardadas}. ${rechazadas.length} quedaron fuera: ${rechazadas
              .slice(0, 3)
              .map((r) => `${r.fecha} ${r.nombre} (${r.motivo})`)
              .join("; ")}`
          : `Listo: ${res.guardadas} reservas en tu agenda.`,
      });
      router.refresh();
    });
  }

  function deshacer() {
    if (!ultimaImportacion) return;
    iniciar(async () => {
      const res = await deshacerImportacion(ranchoId, ultimaImportacion);
      if (res.error) {
        setMensaje({ tipo: "error", texto: res.error });
        return;
      }
      setUltimaImportacion(null);
      setMensaje({ tipo: "ok", texto: `Se deshizo la importación (${res.borradas} reservas).` });
      router.refresh();
    });
  }

  // ---------- Estilos compartidos ----------

  const inputCls =
    "w-full rounded-lg border border-aventurea-line bg-white px-2 py-1.5 text-[12.5px] text-aventurea-ink focus:border-aventurea-navy focus:outline-none";
  const tabCls = (activo: boolean) =>
    `rounded-xl px-4 py-2 text-[13px] font-bold transition ${
      activo
        ? "bg-aventurea-navy text-white"
        : "bg-white text-aventurea-ink-soft hover:text-aventurea-ink"
    }`;

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-5">
      <h3 className="flex items-center gap-2 text-[14px] font-extrabold text-aventurea-ink">
        <IconCalendarLine className="h-4.5 w-4.5 text-aventurea-orange" />
        Traé tu agenda
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
        ¿Llevabas tus reservas en un cuaderno o en Excel? Pasalas a Bookea de una
        vez. Todo lo que cargues acá ocupa la fecha igual que una reserva hecha
        por la web.
      </p>

      {/* --- Selector de camino --- */}
      <div className="mt-4 inline-flex gap-1 rounded-xl border border-aventurea-line bg-white p-1">
        <button type="button" onClick={() => setModo("manual")} className={tabCls(modo === "manual")}>
          A mano · gratis
        </button>
        <button type="button" onClick={() => setModo("ia")} className={tabCls(modo === "ia")}>
          Con IA {desbloqueado ? "· activo" : "· con código"}
        </button>
      </div>

      {/* --- Camino manual --- */}
      {modo === "manual" && (
        <div className="mt-4 rounded-xl border border-aventurea-line bg-white p-4">
          <p className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            Pegá las columnas de tu hoja de cálculo en este orden:{" "}
            <span className="font-bold text-aventurea-ink">
              fecha, nombre, personas, hora inicio, hora fin, monto, adelanto
            </span>
            . O agregá las filas una por una.
          </p>
          <textarea
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            rows={4}
            placeholder={`2026-08-01\tKatherine Murillo\t60\t15:00\t00:00\t180000\t20000`}
            className="mt-2.5 w-full rounded-xl border border-aventurea-line px-3 py-2 font-mono text-[12px] text-aventurea-ink focus:border-aventurea-navy focus:outline-none"
          />
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={partir}
              disabled={pendiente || !pegado.trim()}
              className="rounded-xl bg-aventurea-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
            >
              Partir en filas
            </button>
            <button
              type="button"
              onClick={() => setFilas((p) => [...p, filaVacia(hoy)])}
              className="rounded-xl border border-aventurea-line bg-white px-4 py-2 text-[13px] font-bold text-aventurea-ink"
            >
              Agregar fila vacía
            </button>
          </div>
        </div>
      )}

      {/* --- Camino con IA --- */}
      {modo === "ia" && (
        <div className="mt-4 rounded-xl border border-aventurea-line bg-white p-4">
          {!desbloqueado ? (
            <>
              <p className="text-[13px] font-bold text-aventurea-ink">
                Lectura de fotos con IA — complemento
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                Tomás una foto de las páginas de tu agenda y la IA las transcribe:
                fechas, nombres, personas, horarios y montos, marcando lo que no
                se lee bien para que vos lo confirmés.
              </p>
              <p className="mt-2.5 text-[12.5px] font-semibold text-aventurea-ink">
                Escribí tu código de acceso para desbloquearlo:
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") desbloquear();
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Código"
                  aria-label="Código de acceso"
                  className={`${inputCls} w-32 text-center font-mono tracking-[0.3em]`}
                />
                <button
                  type="button"
                  onClick={desbloquear}
                  disabled={pendiente || !codigo.trim()}
                  className="rounded-xl bg-aventurea-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  Desbloquear
                </button>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                ¿No tenés código? Podés cargar tu agenda{" "}
                <button
                  type="button"
                  onClick={() => setModo("manual")}
                  className="font-bold text-aventurea-navy underline"
                >
                  a mano, sin costo
                </button>
                .
              </p>
            </>
          ) : (
            <>
              <p className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                Subí fotos de las páginas de tu agenda (hasta 8 por vez). Que se
                lean los renglones completos y sin sombra encima. La IA propone
                las filas; vos las revisás antes de guardar.
              </p>
              <input
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                placeholder="Opcional: algo que ayude a leerla (ej. «son agosto y setiembre de 2026»)"
                className={`${inputCls} mt-2.5`}
              />
              <input
                ref={inputFotos}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={leyendo}
                onChange={(e) => {
                  if (e.target.files?.length) void leerConIA(e.target.files);
                }}
                className="mt-2.5 block w-full text-[12.5px] text-aventurea-ink-soft file:mr-3 file:rounded-xl file:border-0 file:bg-aventurea-navy file:px-4 file:py-2 file:text-[13px] file:font-bold file:text-white"
              />
              {leyendo && (
                <p className="mt-2.5 text-[12.5px] font-semibold text-aventurea-navy">
                  Leyendo la agenda… puede tardar un minuto si son varias páginas.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {resumenIA && (
        <p className="mt-3 rounded-xl border border-aventurea-line bg-white px-4 py-3 text-[12.5px] italic leading-relaxed text-aventurea-ink-soft">
          {resumenIA}
        </p>
      )}

      {mensaje && (
        <p
          className={`mt-3 text-[12.5px] font-semibold ${
            mensaje.tipo === "ok" ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      {ultimaImportacion && (
        <button
          type="button"
          onClick={deshacer}
          disabled={pendiente}
          className="mt-2 text-[12.5px] font-bold text-red-600 underline disabled:opacity-50"
        >
          Deshacer la última importación
        </button>
      )}

      {/* --- Tabla de revisión --- */}
      {filas.length > 0 && (
        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-[13px] font-extrabold text-aventurea-ink">
              Revisá antes de guardar
            </h4>
            <p className="text-[12px] text-aventurea-ink-soft">
              {listas} de {filas.length} listas
            </p>
          </div>

          <div className="mt-2 overflow-x-auto rounded-xl border border-aventurea-line bg-white">
            <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-aventurea-line text-left text-[11px] uppercase tracking-wide text-aventurea-ink-soft">
                  <th className="px-3 py-2 font-bold">Fecha</th>
                  {esHospedaje && <th className="px-3 py-2 font-bold">Salida</th>}
                  <th className="px-3 py-2 font-bold">Cliente</th>
                  <th className="px-3 py-2 font-bold">Pers.</th>
                  <th className="px-3 py-2 font-bold">{esCitas ? "Hora" : "Desde"}</th>
                  <th className="px-3 py-2 font-bold">Hasta</th>
                  <th className="px-3 py-2 font-bold">Monto</th>
                  <th className="px-3 py-2 font-bold">Adelanto</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const check = porFila.get(f.id);
                  const choque = choques.get(f.id);
                  const malo = !check?.ok || !!choque;
                  return (
                    <tr
                      key={f.id}
                      className={`border-b border-aventurea-line last:border-none ${
                        malo ? "bg-red-50/60" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={f.fecha}
                          onChange={(e) => editar(f.id, { fecha: e.target.value })}
                          className={inputCls}
                        />
                        <span className="mt-0.5 block text-[10.5px] text-aventurea-ink-soft">
                          {nombreDia(f.fecha)}
                        </span>
                      </td>
                      {esHospedaje && (
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={f.fechaFin ?? ""}
                            onChange={(e) => editar(f.id, { fechaFin: e.target.value || null })}
                            className={inputCls}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <input
                          value={f.nombre}
                          onChange={(e) => editar(f.id, { nombre: e.target.value })}
                          placeholder="Nombre"
                          className={inputCls}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={f.personas ?? ""}
                          onChange={(e) =>
                            editar(f.id, {
                              personas: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className={`${inputCls} w-16`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={f.horaInicio ?? ""}
                          onChange={(e) => editar(f.id, { horaInicio: e.target.value || null })}
                          className={`${inputCls} w-24`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={f.horaFin ?? ""}
                          onChange={(e) => editar(f.id, { horaFin: e.target.value || null })}
                          className={`${inputCls} w-24`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={f.montoTotal ?? ""}
                          onChange={(e) =>
                            editar(f.id, {
                              montoTotal: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className={`${inputCls} w-24`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={f.adelanto ?? ""}
                          onChange={(e) =>
                            editar(f.id, {
                              adelanto: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className={`${inputCls} w-24`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => quitar(f.id)}
                          className="text-[12px] font-bold text-aventurea-ink-soft hover:text-red-600"
                          aria-label={`Quitar la fila de ${f.nombre || "sin nombre"}`}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Avisos y errores, fuera de la tabla para que se lean */}
          <ul className="mt-2 grid gap-1">
            {filas.map((f) => {
              const check = porFila.get(f.id);
              const choque = choques.get(f.id);
              const lineas = [...(check?.errores ?? []), ...(choque ? [choque] : [])];
              const suaves = check?.avisos ?? [];
              if (lineas.length === 0 && suaves.length === 0) return null;
              return (
                <li key={f.id} className="text-[11.5px] leading-relaxed">
                  <span className="font-bold text-aventurea-ink">
                    {f.fecha} {f.nombre || "(sin nombre)"}:
                  </span>{" "}
                  {lineas.length > 0 && <span className="text-red-600">{lineas.join(" ")}</span>}{" "}
                  {suaves.length > 0 && (
                    <span className="text-aventurea-ink-soft">{suaves.join(" ")}</span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={pendiente || listas === 0}
              className="rounded-xl bg-aventurea-sky px-5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-50"
            >
              {pendiente ? "Guardando…" : `Guardar ${listas} reserva${listas === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={() => setFilas([])}
              className="text-[12.5px] font-bold text-aventurea-ink-soft underline"
            >
              Descartar todo
            </button>
            {listas < filas.length && (
              <span className="text-[12px] text-aventurea-ink-soft">
                Las {filas.length - listas} filas en rojo no se guardan hasta que las corrijás.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
