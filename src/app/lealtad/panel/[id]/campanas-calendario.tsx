"use client";

import { useMemo, useState, useTransition } from "react";
import {
  alternarCampana,
  borrarCampana,
  guardarCampana,
  type Campana,
  type ResumenCampanas,
} from "./campanas-actions";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CUERPO_SUAVE,
  DETALLE,
  RADIO_TILE,
  SUPERFICIE_HUNDIDA,
} from "@/components/panel/sistema";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL CALENDARIO DE CAMPAÑAS — marcar un día y que salga sola
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 sep 2026), con mockup: la grilla del mes, los
 * días marcados con su etiqueta corta, la leyenda abajo y «se programa
 * una vez y se repite sola».
 *
 * ------------------------------------------------------------------
 * POR QUÉ EL MES ENTERO Y NO SOLO LOS SIETE DÍAS
 * ------------------------------------------------------------------
 * Lo que se configura es UN día de la semana; con siete casillas
 * alcanzaba. Pero la pregunta que el negocio se hace no es «¿qué día
 * marqué?» sino «¿cuántas veces va a salir esto?» — y esa se contesta
 * mirando el mes: cinco miércoles pintados dicen «cinco envíos» sin una
 * palabra. Es la misma cuenta que decide si el cupo alcanza.
 *
 * ------------------------------------------------------------------
 * LOS COLORES SALEN DEL SISTEMA, NO DE UNA PALETA NUEVA
 * ------------------------------------------------------------------
 * Dos tokens alternados por orden de creación: `--navy` y `--orange`,
 * los mismos del mockup. Alternar es suficiente para distinguir dos o
 * tres campañas de un vistazo, y no obliga a inventar siete colores que
 * después hay que auditar de contraste uno por uno.
 */

/** Empieza en LUNES, como el mockup y como se lee un calendario acá. */
const DIAS = [
  { n: 1, letra: "L", nombre: "Lunes" },
  { n: 2, letra: "M", nombre: "Martes" },
  { n: 3, letra: "M", nombre: "Miércoles" },
  { n: 4, letra: "J", nombre: "Jueves" },
  { n: 5, letra: "V", nombre: "Viernes" },
  { n: 6, letra: "S", nombre: "Sábado" },
  { n: 0, letra: "D", nombre: "Domingo" },
] as const;

/** El par fondo/letra de cada campaña, por orden. Ver la cabecera. */
const COLORES = [
  { fondo: "var(--orange)", tinta: "#fff" },
  { fondo: "var(--navy)", tinta: "#fff" },
] as const;

const hora12 = (h: number) => {
  const ampm = h < 12 ? "a. m." : "p. m.";
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base} ${ampm}`;
};

type Borrador = {
  diaSemana: number;
  hora: number;
  etiqueta: string;
  mensaje: string;
};

export default function CampanasCalendario({
  ranchoId,
  programaId,
  inicial,
}: {
  ranchoId: string;
  programaId: string;
  inicial: ResumenCampanas;
}) {
  const [resumen, setResumen] = useState(inicial);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const porDia = useMemo(() => {
    const m = new Map<number, Campana & { color: (typeof COLORES)[number] }>();
    resumen.campanas.forEach((c, i) => {
      m.set(c.diaSemana, { ...c, color: COLORES[i % COLORES.length] });
    });
    return m;
  }, [resumen.campanas]);

  // ── La grilla del mes en curso ────────────────────────────────────
  // Se arma con fechas locales: es un calendario para mirar, no un
  // cálculo de negocio — la hora exacta la decide el servidor.
  const celdas = useMemo(() => {
    const hoy = new Date();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const dias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    // Cuántos huecos antes del día 1 para que caiga en su columna. El
    // `+6) % 7` corre la semana para que empiece en lunes.
    const huecos = (primero.getDay() + 6) % 7;
    const salida: ({ dia: number; diaSemana: number } | null)[] = Array(huecos).fill(null);
    for (let d = 1; d <= dias; d++) {
      salida.push({
        dia: d,
        diaSemana: new Date(hoy.getFullYear(), hoy.getMonth(), d).getDay(),
      });
    }
    return salida;
  }, []);

  const mes = new Date().toLocaleDateString("es-CR", { month: "long", year: "numeric" });

  function refrescar(cambio: (c: Campana[]) => Campana[]) {
    setResumen((r) => {
      const campanas = cambio(r.campanas);
      return {
        ...r,
        campanas,
        enviosEstimados: Math.round(campanas.filter((c) => c.activa).length * (52 / 12)),
      };
    });
  }

  function abrir(diaSemana: number) {
    const ya = porDia.get(diaSemana);
    setError(null);
    setBorrador(
      ya
        ? { diaSemana, hora: ya.hora, etiqueta: ya.etiqueta, mensaje: ya.mensaje }
        : { diaSemana, hora: 9, etiqueta: "", mensaje: "" },
    );
  }

  function guardar() {
    if (!borrador) return;
    setError(null);
    iniciar(async () => {
      const res = await guardarCampana({ ranchoId, programaId, ...borrador });
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      const nueva: Campana = { id: res.datos.id, activa: true, ...borrador };
      refrescar((c) => [...c.filter((x) => x.diaSemana !== borrador.diaSemana), nueva]);
      setBorrador(null);
    });
  }

  function alternar(c: Campana) {
    iniciar(async () => {
      const res = await alternarCampana(ranchoId, c.id, !c.activa);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      refrescar((xs) => xs.map((x) => (x.id === c.id ? { ...x, activa: !x.activa } : x)));
    });
  }

  function borrar(c: Campana) {
    iniciar(async () => {
      const res = await borrarCampana(ranchoId, c.id);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      refrescar((xs) => xs.filter((x) => x.id !== c.id));
      setBorrador(null);
    });
  }

  // El cupo: `restante` es null cuando el paquete no tiene tope.
  const sinTope = resumen.cupo.limite === null;
  const alcanza = sinTope || resumen.enviosEstimados <= (resumen.cupo.limite ?? 0);

  return (
    <div className="flex flex-col gap-4">
      {/* ── LA GRILLA ────────────────────────────────────────────── */}
      <div className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-3.5 sm:p-4`}>
        <p className={`${DETALLE} text-center capitalize`}>{mes}</p>

        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {DIAS.map((d) => (
            <button
              key={d.n}
              type="button"
              onClick={() => abrir(d.n)}
              title={`Programar los ${d.nombre.toLowerCase()}`}
              className="presionable rounded-md py-1 text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft transition-colors hover:bg-white"
            >
              {d.letra}
            </button>
          ))}

          {celdas.map((c, i) =>
            c === null ? (
              <span key={`h${i}`} />
            ) : (
              (() => {
                const camp = porDia.get(c.diaSemana);
                const marcado = camp !== undefined && camp.activa;
                return (
                  <button
                    key={c.dia}
                    type="button"
                    onClick={() => abrir(c.diaSemana)}
                    aria-label={
                      camp
                        ? `${c.dia}: ${camp.etiqueta}, ${hora12(camp.hora)}`
                        : `${c.dia}: sin campaña`
                    }
                    className="presionable grid aspect-square place-items-center rounded-lg border text-[11px] font-bold transition-colors"
                    style={
                      marcado
                        ? {
                            background: camp.color.fondo,
                            color: camp.color.tinta,
                            borderColor: "transparent",
                          }
                        : {
                            background: "#fff",
                            borderColor: "var(--line)",
                            color: "var(--color-aventurea-ink-soft, #64748b)",
                          }
                    }
                  >
                    {marcado ? camp.etiqueta : c.dia}
                  </button>
                );
              })()
            ),
          )}
        </div>
      </div>

      {/* ── LA LEYENDA ───────────────────────────────────────────── */}
      {resumen.campanas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {resumen.campanas.map((c) => {
            const color = COLORES[resumen.campanas.indexOf(c) % COLORES.length];
            const dia = DIAS.find((d) => d.n === c.diaSemana);
            return (
              <li key={c.id} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: c.activa ? color.fondo : "var(--line)" }}
                />
                <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-aventurea-ink">
                  <b>{dia?.nombre}</b> · {c.etiqueta} — {c.mensaje}
                  <span className={`ml-1 ${CUERPO_SUAVE}`}>({hora12(c.hora)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => alternar(c)}
                  disabled={ocupado}
                  className={`${BOTON_PANEL} shrink-0`}
                >
                  {c.activa ? "Pausar" : "Activar"}
                </button>
                <button
                  type="button"
                  onClick={() => abrir(c.diaSemana)}
                  disabled={ocupado}
                  className={`${BOTON_PANEL} shrink-0`}
                >
                  Editar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── LA CUENTA DEL CUPO, ANTES Y NO DESPUÉS ───────────────────
          Es lo único que impide la sorpresa del tercer miércoles: la
          promo no salió, el local lleno esperando el 2×1, y el cupo se
          había acabado dos semanas antes. */}
      <div
        className={`${RADIO_TILE} border px-3.5 py-3`}
        style={{
          borderColor: alcanza ? "var(--line)" : "var(--orange)",
          background: alcanza ? "var(--accion-suave)" : "var(--hoja)",
        }}
      >
        {resumen.campanas.length === 0 ? (
          <p className={DETALLE}>
            Tocá un día del calendario para programar tu primera campaña. Se escribe una vez y
            se repite sola todas las semanas.
          </p>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-aventurea-ink">
            {resumen.enviosEstimados} envío{resumen.enviosEstimados === 1 ? "" : "s"} al mes
            {sinTope ? (
              <> — tu paquete no tiene tope.</>
            ) : (
              <>
                {" "}
                contra los <b>{resumen.cupo.limite}</b> de tu paquete.{" "}
                {alcanza ? (
                  "Alcanza."
                ) : (
                  <b style={{ color: "var(--orange-fuerte)" }}>
                    No alcanza: cuando se acabe el cupo del mes, las que sigan no salen.
                  </b>
                )}
              </>
            )}
          </p>
        )}
      </div>

      {/* ── LO QUE PASÓ LA ÚLTIMA VEZ ────────────────────────────── */}
      {resumen.ultimos.some((u) => u.estado !== "enviado") && (
        <ul className="flex flex-col gap-1">
          {resumen.ultimos
            .filter((u) => u.estado !== "enviado")
            .slice(0, 3)
            .map((u) => (
              <li key={`${u.campanaId}-${u.dia}`} className={DETALLE}>
                <b>{u.dia}</b> — {u.estado === "sin_cupo" ? "no salió por cupo" : "falló"}
                {u.detalle ? `: ${u.detalle}` : ""}
              </li>
            ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-[12.5px] font-bold text-red-600">
          {error}
        </p>
      )}

      {/* ── EL EDITOR DEL DÍA ────────────────────────────────────── */}
      {borrador && (
        <div className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-3.5 sm:p-4`}>
          <p className="text-[13px] font-extrabold text-aventurea-navy">
            Los {DIAS.find((d) => d.n === borrador.diaSemana)?.nombre.toLowerCase()}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-[110px_1fr]">
            <label className="block">
              <span className={DETALLE}>En el calendario</span>
              <input
                value={borrador.etiqueta}
                onChange={(e) => setBorrador({ ...borrador, etiqueta: e.target.value })}
                placeholder="2×1"
                maxLength={12}
                className="mt-1 w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-2 text-[13px] text-aventurea-ink"
              />
            </label>
            <label className="block">
              <span className={DETALLE}>Hora</span>
              <select
                value={borrador.hora}
                onChange={(e) => setBorrador({ ...borrador, hora: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-2 text-[13px] text-aventurea-ink"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {hora12(h)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block">
            <span className={DETALLE}>El aviso que le llega a tus clientes</span>
            <textarea
              value={borrador.mensaje}
              onChange={(e) => setBorrador({ ...borrador, mensaje: e.target.value })}
              placeholder="Miércoles de 2×1 en cualquier bebida caliente. Mostrá tu tarjeta."
              maxLength={180}
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-aventurea-line bg-white px-2.5 py-2 text-[13px] leading-snug text-aventurea-ink"
            />
            <span className={DETALLE}>{borrador.mensaje.trim().length}/180</span>
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={ocupado}
              className={BOTON_PANEL_PRIMARIO}
            >
              {ocupado ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setBorrador(null)}
              disabled={ocupado}
              className={BOTON_PANEL}
            >
              Cancelar
            </button>
            {porDia.get(borrador.diaSemana) && (
              <button
                type="button"
                onClick={() => borrar(porDia.get(borrador.diaSemana)!)}
                disabled={ocupado}
                className={`${BOTON_PANEL} ml-auto text-red-600`}
              >
                Borrar
              </button>
            )}
          </div>
        </div>
      )}

      <p className={DETALLE}>Se programa una vez y se repite sola.</p>
    </div>
  );
}
