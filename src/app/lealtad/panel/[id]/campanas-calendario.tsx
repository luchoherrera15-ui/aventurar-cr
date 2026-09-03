"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
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
 *  LA AGENDA DE CAMPAÑAS — siete filas, una por día de la semana
 * ════════════════════════════════════════════════════════════════════
 *
 * V2 (2 sep 2026, pedido del dueño mirando la V1: «esa agenda se ve
 * horrible… hazla mucho mucho más pequeña y más fácil de usar»).
 *
 * ------------------------------------------------------------------
 * POR QUÉ SIETE FILAS Y NO EL MES ENTERO
 * ------------------------------------------------------------------
 * La V1 pintaba la grilla del mes completo — treinta celdas enormes
 * para configurar algo que solo tiene SIETE estados posibles: la
 * campaña es POR DÍA DE LA SEMANA (unique(programa, dia_semana), 0226)
 * y se repite sola. El calendario de mes obligaba a deducir esa regla;
 * la lista de días la MUESTRA: cada fila es un día, con su campaña o
 * su «Programar…». La cuenta de envíos del mes —lo único que el mes
 * entero aportaba— quedó dicha en una línea, junto al cupo.
 *
 * El editor se abre INLINE debajo del día tocado, no en un panel
 * aparte al fondo: lo que editás queda pegado a donde tocaste.
 *
 * Cero naranja: los paneles son blancos y azules (rediseño CRM sep
 * 2026) — la señal de encendida es el punto azul de acción, y el
 * cupo que no alcanza avisa en el rojo de error del sistema.
 */

/** Empieza en LUNES, como se lee la semana acá. */
const DIAS = [
  { n: 1, corto: "Lun", nombre: "Lunes" },
  { n: 2, corto: "Mar", nombre: "Martes" },
  { n: 3, corto: "Mié", nombre: "Miércoles" },
  { n: 4, corto: "Jue", nombre: "Jueves" },
  { n: 5, corto: "Vie", nombre: "Viernes" },
  { n: 6, corto: "Sáb", nombre: "Sábado" },
  { n: 0, corto: "Dom", nombre: "Domingo" },
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
    const m = new Map<number, Campana>();
    resumen.campanas.forEach((c) => m.set(c.diaSemana, c));
    return m;
  }, [resumen.campanas]);

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
    setBorrador((b) =>
      // Tocar el día ya abierto lo cierra — el mismo gesto para las dos
      // direcciones, sin buscar un botón de cerrar.
      b?.diaSemana === diaSemana
        ? null
        : ya
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

  // El cupo: `limite` es null cuando el paquete no tiene tope.
  const sinTope = resumen.cupo.limite === null;
  const alcanza = sinTope || resumen.enviosEstimados <= (resumen.cupo.limite ?? 0);

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      {/* ── LA SEMANA, EN SIETE FILAS ────────────────────────────── */}
      <div className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-1.5`}>
        {DIAS.map((d) => {
          const camp = porDia.get(d.n);
          const abierto = borrador?.diaSemana === d.n;
          return (
            <Fragment key={d.n}>
              <div
                className={`flex min-h-[44px] items-center gap-1.5 rounded-lg pr-1.5 transition-colors ${
                  abierto ? "bg-white" : "hover:bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => abrir(d.n)}
                  aria-expanded={abierto}
                  className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-2 text-left"
                  title={camp ? camp.mensaje : `Programar los ${d.nombre.toLowerCase()}`}
                >
                  <span className="w-9 shrink-0 text-[11.5px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                    {d.corto}
                  </span>
                  {camp ? (
                    <>
                      {/* El punto: azul = sale esta semana, gris = pausada. */}
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: camp.activa ? "var(--accion)" : "var(--line)" }}
                      />
                      <span className="min-w-0 truncate text-[13px] text-aventurea-ink">
                        <b>{camp.etiqueta}</b>
                        <span className={`ml-1.5 ${CUERPO_SUAVE}`}>
                          {hora12(camp.hora)}
                          {!camp.activa && " · pausada"}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className={`text-[12.5px] ${CUERPO_SUAVE}`}>Programar…</span>
                  )}
                </button>
                {camp && (
                  <button
                    type="button"
                    onClick={() => alternar(camp)}
                    disabled={ocupado}
                    className={`${BOTON_PANEL} h-7 shrink-0 px-2.5 text-[11.5px]`}
                  >
                    {camp.activa ? "Pausar" : "Activar"}
                  </button>
                )}
              </div>

              {/* ── El editor, pegado al día que lo abrió ──────────── */}
              {abierto && borrador && (
                <div className="mx-1 mb-1.5 rounded-lg border border-aventurea-line bg-white p-3">
                  <div className="grid gap-2.5 sm:grid-cols-[110px_1fr]">
                    <label className="block">
                      <span className={DETALLE}>Nombre corto</span>
                      <input
                        value={borrador.etiqueta}
                        onChange={(e) => setBorrador({ ...borrador, etiqueta: e.target.value })}
                        placeholder="2×1"
                        maxLength={12}
                        className="mt-1 w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[13px] text-aventurea-ink"
                      />
                    </label>
                    <label className="block">
                      <span className={DETALLE}>Hora</span>
                      <select
                        value={borrador.hora}
                        onChange={(e) => setBorrador({ ...borrador, hora: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[13px] text-aventurea-ink"
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>
                            {hora12(h)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-2.5 block">
                    <span className={DETALLE}>El aviso que le llega a tus clientes</span>
                    <textarea
                      value={borrador.mensaje}
                      onChange={(e) => setBorrador({ ...borrador, mensaje: e.target.value })}
                      placeholder="Miércoles de 2×1 en cualquier bebida caliente. Mostrá tu tarjeta."
                      maxLength={180}
                      rows={2}
                      className="mt-1 w-full resize-none rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[13px] leading-snug text-aventurea-ink"
                    />
                    <span className={DETALLE}>{borrador.mensaje.trim().length}/180</span>
                  </label>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
            </Fragment>
          );
        })}
      </div>

      {/* ── LA CUENTA DEL CUPO, ANTES Y NO DESPUÉS ───────────────────
          Es lo único que impide la sorpresa del tercer miércoles: la
          promo no salió, el local lleno esperando el 2×1, y el cupo se
          había acabado dos semanas antes. */}
      {resumen.campanas.length === 0 ? (
        <p className={DETALLE}>
          Tocá un día y escribí el aviso una vez — sale solo todas las semanas, a la hora
          que elijas.
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
                <b className="text-red-600">
                  No alcanza: cuando se acabe el cupo del mes, las que sigan no salen.
                </b>
              )}
            </>
          )}
        </p>
      )}

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
    </div>
  );
}
