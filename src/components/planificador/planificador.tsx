"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CANTONES,
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  PROVINCIAS,
  SUBCATEGORIA_LABEL,
  UNIDAD_PRECIO_LABEL,
  type Provincia,
  type Rancho,
} from "@/app/mi-rancho/types";
import { NOMBRE_RANCHO_BOOKEAR } from "@/app/eventos/constants";
import { alternarFavorito } from "@/app/eventos/favoritos-actions";
import { IconHeart, IconStar } from "@/components/icons";
import { hoyISOCR } from "@/lib/fechas";
import { generarPlan } from "./motor";
import { guardarLeadPlanificador } from "./actions";
import {
  ESTILOS,
  ETAPAS,
  RESPUESTAS_VACIAS,
  SERVICIOS,
  SERVICIO_POR_ID,
  TIPOS_EVENTO,
  type CandidatoServicio,
  type EstiloId,
  type RespuestasPlanificador,
  type TipoEvento,
} from "./tipos";
import type { Calificacion } from "@/components/rancho-card";

/**
 * Boki, el personaje del asistente: una chispa redonda y sonriente de
 * la marca (navy + naranja). Existe para darle calidez al wizard — la
 * gente le responde a alguien, no a un formulario.
 */
function BokiAvatar({ tamano = 36 }: { tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 48 48"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="24" cy="26" r="19" fill="#ee7420" />
      <circle cx="24" cy="26" r="19" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
      {/* Antena chispa */}
      <line x1="24" y1="7" x2="24" y2="2.5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 1l1.2 2.4L27.6 4l-2.4 1.2L24 7.6l-1.2-2.4L20.4 4l2.4-1.2z" fill="#ffd9b8" />
      {/* Ojos */}
      <circle cx="17.5" cy="23.5" r="3.2" fill="#ffffff" />
      <circle cx="30.5" cy="23.5" r="3.2" fill="#ffffff" />
      <circle cx="18.3" cy="24.2" r="1.6" fill="#16295e" />
      <circle cx="31.3" cy="24.2" r="1.6" fill="#16295e" />
      {/* Sonrisa */}
      <path
        d="M17 32c2 2.6 4.4 3.9 7 3.9s5-1.3 7-3.9"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* Cachetes */}
      <circle cx="13.5" cy="29" r="2" fill="rgba(255,255,255,0.35)" />
      <circle cx="34.5" cy="29" r="2" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}

/**
 * "¡Creá tu evento con IA!" — el cotizador guiado del directorio de
 * eventos. Un wizard de una pregunta por pantalla (nada de chat
 * libre) que termina en un plan armado SOLO con negocios reales de
 * la plataforma (ver ./motor.ts). Va montado únicamente en
 * /eventos: el botón flotante vive abajo a la IZQUIERDA para no
 * chocar con la burbuja de chat de la derecha.
 */

const STORAGE_KEY = "bookea-planificador-v1";

type Guardado = {
  respuestas: RespuestasPlanificador;
  etapa: number;
  max: number;
};

/** Rescata lo guardado en localStorage sin confiar en su forma. */
function sanearGuardado(crudo: string | null): Guardado | null {
  if (!crudo) return null;
  try {
    const g = JSON.parse(crudo) as Partial<Guardado>;
    const r = (g.respuestas ?? {}) as Partial<RespuestasPlanificador>;
    const tipoOk = TIPOS_EVENTO.some((t) => t.id === r.tipoEvento);
    const estiloOk = ESTILOS.some((e) => e.id === r.estilo);
    const provinciaOk = (PROVINCIAS as readonly string[]).includes(r.provincia ?? "");
    const provincia = provinciaOk ? (r.provincia as Provincia) : null;
    const respuestas: RespuestasPlanificador = {
      tipoEvento: tipoOk ? (r.tipoEvento as TipoEvento) : null,
      fecha:
        typeof r.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha) ? r.fecha : null,
      provincia,
      canton:
        provincia && typeof r.canton === "string" && CANTONES[provincia].includes(r.canton)
          ? r.canton
          : null,
      invitados:
        typeof r.invitados === "number" && r.invitados > 0 ? Math.round(r.invitados) : null,
      presupuesto:
        typeof r.presupuesto === "number" && r.presupuesto > 0 ? Math.round(r.presupuesto) : null,
      estilo: estiloOk ? (r.estilo as EstiloId) : null,
      servicios: Array.isArray(r.servicios)
        ? r.servicios.filter((s): s is string => typeof s === "string" && s in SERVICIO_POR_ID)
        : [],
      preferencias: typeof r.preferencias === "string" ? r.preferencias.slice(0, 400) : "",
    };
    const etapa =
      typeof g.etapa === "number" ? Math.min(Math.max(0, g.etapa), ETAPAS.length - 1) : 0;
    const max = typeof g.max === "number" ? Math.min(Math.max(etapa, g.max), ETAPAS.length - 1) : etapa;
    return { respuestas, etapa, max };
  } catch {
    return null;
  }
}

function fmtColones(n: number | null) {
  if (n == null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default function Planificador({
  ranchos,
  fechasOcupadas,
  calificaciones,
  favoritosIniciales,
  sesionActiva,
}: {
  ranchos: Rancho[];
  fechasOcupadas: { rancho_id: string; fecha: string }[];
  calificaciones: Calificacion[];
  favoritosIniciales: string[];
  sesionActiva: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [respuestas, setRespuestas] = useState<RespuestasPlanificador>(RESPUESTAS_VACIAS);
  const [etapaIdx, setEtapaIdx] = useState(0);
  const [maxVisitada, setMaxVisitada] = useState(0);
  const [mostrandoCierre, setMostrandoCierre] = useState(false);
  const [leadGuardado, setLeadGuardado] = useState(false);
  const [huboSesion, setHuboSesion] = useState(false);

  const etapa = ETAPAS[etapaIdx].id;
  const hoy = useMemo(() => hoyISOCR(), []);
  const favoritosIds = useMemo(() => new Set(favoritosIniciales), [favoritosIniciales]);

  // Retomar donde quedó: lo respondido vive en localStorage y se
  // rescata al abrir (solo la primera vez de la visita, para no
  // pisar lo que se esté contestando al reabrir el modal).
  function abrir() {
    if (!huboSesion) {
      const g = sanearGuardado(window.localStorage.getItem(STORAGE_KEY));
      if (g) {
        setRespuestas(g.respuestas);
        setEtapaIdx(g.etapa);
        setMaxVisitada(g.max);
      }
    }
    setAbierto(true);
    setHuboSesion(true);
  }

  useEffect(() => {
    if (!huboSesion) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ respuestas, etapa: etapaIdx, max: maxVisitada } satisfies Guardado),
      );
    } catch {
      // Sin localStorage (modo privado estricto) el wizard funciona igual.
    }
  }, [huboSesion, respuestas, etapaIdx, maxVisitada]);

  // El fondo no scrollea mientras el modal está abierto.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setMostrandoCierre(false);
  }, []);

  const algoRespondido =
    respuestas.tipoEvento !== null ||
    respuestas.provincia !== null ||
    respuestas.invitados !== null ||
    respuestas.presupuesto !== null ||
    respuestas.servicios.length > 0;

  const pedirCierre = useCallback(() => {
    if (algoRespondido && !leadGuardado && !mostrandoCierre) {
      setMostrandoCierre(true);
    } else {
      cerrar();
    }
  }, [algoRespondido, leadGuardado, mostrandoCierre, cerrar]);

  // Escape también pide cerrar (con la pantallita de guardar de por medio).
  const pedirCierreRef = useRef(pedirCierre);
  useEffect(() => {
    pedirCierreRef.current = pedirCierre;
  }, [pedirCierre]);
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") pedirCierreRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  function irA(idx: number) {
    setEtapaIdx(idx);
    setMaxVisitada((m) => Math.max(m, idx));
  }

  const siguiente = () => irA(Math.min(etapaIdx + 1, ETAPAS.length - 1));
  const atras = () => setEtapaIdx((i) => Math.max(0, i - 1));

  function actualizar(parcial: Partial<RespuestasPlanificador>) {
    setRespuestas((prev) => ({ ...prev, ...parcial }));
  }

  function responderYAvanzar(parcial: Partial<RespuestasPlanificador>) {
    actualizar(parcial);
    siguiente();
  }

  // Los resultados se recalculan cada vez que se vuelve a esta etapa
  // (el motor es puro: mismas respuestas + mismos datos = mismo plan).
  const resultados = useMemo(
    () =>
      abierto && etapa === "resultados"
        ? generarPlan(respuestas, { ranchos, fechasOcupadas, calificaciones })
        : null,
    [abierto, etapa, respuestas, ranchos, fechasOcupadas, calificaciones],
  );

  return (
    <>
      {/* Botón flotante: abajo a la IZQUIERDA (la burbuja de chat ya
          ocupa la derecha). En móvil sube un poco para librar la
          botonera inferior, igual que la burbuja. */}
      <button
        type="button"
        onClick={abrir}
        className="fixed right-4 top-[72px] z-40 flex h-12 items-center gap-2.5 rounded-full bg-aventurea-navy pl-1.5 pr-5 text-[13px] font-bold text-white shadow-[0_14px_34px_-10px_rgba(22,41,94,0.55)] transition-transform hover:scale-[1.04] active:scale-[0.98] lg:right-6 lg:top-20 lg:text-[13.5px]"
      >
        <BokiAvatar tamano={36} />
        <span className="hidden sm:inline">Creá tu evento con nuestro asistente Boki</span>
        <span className="sm:hidden">Asistente Boki</span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Cerrar el planificador"
            onClick={pedirCierre}
            className="anim-velo-entrar absolute inset-0 cursor-default bg-aventurea-navy/50 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Creá tu evento con IA"
            className="anim-panel-entrar relative flex max-h-[92vh] w-full max-w-[580px] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_30px_80px_-20px_rgba(16,26,44,0.5)] sm:rounded-[24px]"
          >
            {/* Encabezado navy de la marca */}
            <div className="flex items-start justify-between gap-3 bg-aventurea-navy px-5 py-4">
              <div className="flex items-center gap-3">
                <BokiAvatar tamano={44} />
                <div>
                  <p className="text-[15px] font-extrabold text-white">
                    ¡Hola! Soy Boki, tu asistente
                  </p>
                  <p className="mt-0.5 text-[12px] text-white/70">
                    Contestame unas preguntas y te armo el plan con negocios
                    reales de Bookea.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={pedirCierre}
                aria-label="Cerrar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[18px] leading-none text-white transition-colors hover:bg-white/25"
              >
                ×
              </button>
            </div>

            {mostrandoCierre ? (
              <PantallaGuardar
                respuestas={respuestas}
                onGuardado={() => {
                  setLeadGuardado(true);
                  cerrar();
                }}
                onSaltar={cerrar}
              />
            ) : (
              <>
                {/* Barra de progreso: cada etapa ya visitada se puede
                    tocar para cambiarla sin reiniciar. */}
                <div className="border-b border-aventurea-line px-3 pt-2.5">
                  <div className="flex gap-1 overflow-x-auto pb-2.5">
                    {ETAPAS.map((e, i) => {
                      const alcanzable = i <= maxVisitada;
                      const actual = i === etapaIdx;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          disabled={!alcanzable}
                          onClick={() => irA(i)}
                          aria-current={actual ? "step" : undefined}
                          className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                            actual
                              ? "bg-aventurea-navy text-white"
                              : alcanzable
                                ? "bg-aventurea-orange/10 text-aventurea-orange hover:bg-aventurea-orange/20"
                                : "text-zinc-400"
                          }`}
                        >
                          {e.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="h-[3px] w-full overflow-hidden rounded-full bg-aventurea-line/60">
                    <div
                      className="h-full rounded-full bg-aventurea-orange transition-all duration-300"
                      style={{ width: `${(etapaIdx / (ETAPAS.length - 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {etapa === "evento" && (
                    <Pregunta
                      titulo="¿Qué evento estás planeando?"
                      sub="Elegí el tipo de celebración para empezar."
                    >
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {TIPOS_EVENTO.map((t) => (
                          <ChipGrande
                            key={t.id}
                            emoji={t.emoji}
                            label={t.label}
                            activo={respuestas.tipoEvento === t.id}
                            onClick={() => responderYAvanzar({ tipoEvento: t.id })}
                          />
                        ))}
                      </div>
                    </Pregunta>
                  )}

                  {etapa === "fecha" && (
                    <Pregunta
                      titulo="¿Cuándo sería?"
                      sub="Con la fecha revisamos la disponibilidad real de los lugares. Si aún no la tenés, saltá este paso."
                    >
                      <input
                        type="date"
                        min={hoy}
                        value={respuestas.fecha ?? ""}
                        onChange={(e) => actualizar({ fecha: e.target.value || null })}
                        className="w-full rounded-[14px] border border-aventurea-line bg-aventurea-cream-2 px-4 py-3 text-[14px] text-aventurea-ink focus:border-aventurea-navy/50 focus:outline-none"
                      />
                      <PieBotones
                        onAtras={atras}
                        onSiguiente={siguiente}
                        siguienteLabel={respuestas.fecha ? "Continuar" : "Aún no sé la fecha"}
                      />
                    </Pregunta>
                  )}

                  {etapa === "ubicacion" && (
                    <Pregunta
                      titulo="¿En qué zona del país?"
                      sub="Elegí la provincia y, si querés afinar, el cantón."
                    >
                      <div className="flex flex-wrap gap-2">
                        {PROVINCIAS.map((p) => (
                          <ChipChico
                            key={p}
                            label={p}
                            activo={respuestas.provincia === p}
                            onClick={() =>
                              actualizar(
                                respuestas.provincia === p
                                  ? { provincia: null, canton: null }
                                  : { provincia: p, canton: null },
                              )
                            }
                          />
                        ))}
                      </div>
                      {respuestas.provincia && (
                        <div className="mt-4 border-t border-aventurea-line pt-3">
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                            Cantones de {respuestas.provincia} (opcional)
                          </p>
                          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                            {CANTONES[respuestas.provincia].map((ct) => (
                              <ChipChico
                                key={ct}
                                label={ct}
                                activo={respuestas.canton === ct}
                                onClick={() =>
                                  actualizar({ canton: respuestas.canton === ct ? null : ct })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <PieBotones
                        onAtras={atras}
                        onSiguiente={siguiente}
                        siguienteLabel={respuestas.provincia ? "Continuar" : "Me da igual la zona"}
                      />
                    </Pregunta>
                  )}

                  {etapa === "invitados" && (
                    <Pregunta
                      titulo="¿Cuántos invitados esperás?"
                      sub="Un aproximado alcanza — filtra los lugares por capacidad."
                    >
                      <div className="mb-3 flex flex-wrap gap-2">
                        {[30, 50, 80, 100, 150, 200, 300].map((n) => (
                          <ChipChico
                            key={n}
                            label={String(n)}
                            activo={respuestas.invitados === n}
                            onClick={() => responderYAvanzar({ invitados: n })}
                          />
                        ))}
                      </div>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={respuestas.invitados ?? ""}
                        onChange={(e) => {
                          const n = parseInt(e.target.value);
                          actualizar({ invitados: Number.isFinite(n) && n > 0 ? n : null });
                        }}
                        placeholder="Otra cantidad — ej. 120"
                        className="w-full rounded-[14px] border border-aventurea-line bg-aventurea-cream-2 px-4 py-3 text-[14px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-navy/50 focus:outline-none"
                      />
                      <PieBotones
                        onAtras={atras}
                        onSiguiente={siguiente}
                        siguienteLabel={respuestas.invitados ? "Continuar" : "Saltar"}
                      />
                    </Pregunta>
                  )}

                  {etapa === "presupuesto" && (
                    <Pregunta
                      titulo="¿Cuál es tu presupuesto total?"
                      sub="En colones, para todo el evento. Como guía, el lugar suele llevarse cerca del 40%."
                    >
                      <div className="mb-3 flex flex-wrap gap-2">
                        {[500_000, 1_000_000, 2_000_000, 4_000_000, 8_000_000].map((n) => (
                          <ChipChico
                            key={n}
                            label={`₡${n.toLocaleString("es-CR")}`}
                            activo={respuestas.presupuesto === n}
                            onClick={() => responderYAvanzar({ presupuesto: n })}
                          />
                        ))}
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={50000}
                        inputMode="numeric"
                        value={respuestas.presupuesto ?? ""}
                        onChange={(e) => {
                          const n = parseInt(e.target.value);
                          actualizar({ presupuesto: Number.isFinite(n) && n > 0 ? n : null });
                        }}
                        placeholder="Otro monto — ej. 1500000"
                        className="w-full rounded-[14px] border border-aventurea-line bg-aventurea-cream-2 px-4 py-3 text-[14px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-navy/50 focus:outline-none"
                      />
                      <PieBotones
                        onAtras={atras}
                        onSiguiente={siguiente}
                        siguienteLabel={respuestas.presupuesto ? "Continuar" : "Prefiero no decir"}
                      />
                    </Pregunta>
                  )}

                  {etapa === "estilo" && (
                    <Pregunta
                      titulo="¿Qué estilo soñás?"
                      sub="Lo usamos para afinar las sugerencias — sin descartar a nadie."
                    >
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {ESTILOS.map((e) => (
                          <ChipGrande
                            key={e.id}
                            emoji={e.emoji}
                            label={e.label}
                            activo={respuestas.estilo === e.id}
                            onClick={() => responderYAvanzar({ estilo: e.id })}
                          />
                        ))}
                      </div>
                      <PieBotones onAtras={atras} onSiguiente={siguiente} siguienteLabel="Saltar" />
                    </Pregunta>
                  )}

                  {etapa === "servicios" && (
                    <Pregunta
                      titulo="¿Qué servicios necesitás?"
                      sub="Marcá todos los que apliquen. Si no marcás nada, te sugerimos lo esencial: lugar, comida y decoración."
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {SERVICIOS.map((s) => {
                          const activo = respuestas.servicios.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              aria-pressed={activo}
                              onClick={() =>
                                actualizar({
                                  servicios: activo
                                    ? respuestas.servicios.filter((x) => x !== s.id)
                                    : [...respuestas.servicios, s.id],
                                })
                              }
                              className={`flex items-center gap-2 rounded-[14px] border px-3 py-2.5 text-left text-[12.5px] font-bold transition-colors ${
                                activo
                                  ? "border-aventurea-navy bg-aventurea-navy text-white"
                                  : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
                              }`}
                            >
                              <span aria-hidden className="text-[15px]">{s.emoji}</span>
                              <span className="min-w-0 flex-1">{s.label}</span>
                              {activo && <span aria-hidden>✓</span>}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4">
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                          ¿Algo especial? (opcional)
                        </label>
                        <textarea
                          value={respuestas.preferencias}
                          onChange={(e) => actualizar({ preferencias: e.target.value.slice(0, 400) })}
                          rows={2}
                          placeholder="Ej. con piscina, pet friendly, comida vegetariana…"
                          className="w-full resize-none rounded-[14px] border border-aventurea-line bg-aventurea-cream-2 px-4 py-3 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-navy/50 focus:outline-none"
                        />
                      </div>

                      <PieBotones
                        onAtras={atras}
                        onSiguiente={siguiente}
                        siguienteLabel="Ver resultados ✨"
                        destacado
                      />
                    </Pregunta>
                  )}

                  {etapa === "resultados" && resultados && (
                    <div>
                      <div className="rounded-[18px] bg-aventurea-navy px-4 py-3.5">
                        <p className="text-[13.5px] font-bold leading-snug text-white">
                          {resultados.resumen}
                        </p>
                        <p className="mt-1 text-[11.5px] text-white/65">
                          Tocá cualquier etapa arriba para ajustar tu plan — se recalcula al momento.
                        </p>
                      </div>

                      {resultados.vacio ? (
                        <div className="mt-5 rounded-[18px] border border-aventurea-line bg-aventurea-cream-2 p-6 text-center">
                          <p className="text-[14px] font-bold text-aventurea-ink">
                            Todavía no hay negocios que calcen con todo lo que pediste.
                          </p>
                          <p className="mx-auto mt-1.5 max-w-[40ch] text-[12.5px] text-aventurea-ink-soft">
                            Probá con otra zona, otra fecha o un presupuesto mayor — el directorio
                            crece todas las semanas.
                          </p>
                        </div>
                      ) : (
                        resultados.grupos.map((g) => (
                          <div key={g.servicio.id} className="mt-6">
                            <h3 className="mb-2.5 flex items-center gap-2 text-[13.5px] font-extrabold text-aventurea-ink">
                              <span aria-hidden>{g.servicio.emoji}</span>
                              {g.servicio.label}
                              {g.candidatos[0]?.presupuestoServicio ? (
                                <span className="font-semibold text-aventurea-ink-soft">
                                  · ~{fmtColones(g.candidatos[0].presupuestoServicio)}
                                </span>
                              ) : null}
                            </h3>
                            {g.candidatos.length === 0 ? (
                              <p className="rounded-[14px] border border-dashed border-aventurea-line px-4 py-3 text-[12.5px] text-aventurea-ink-soft">
                                Aún no tenemos opciones de {g.servicio.label.toLowerCase()} que
                                calcen — probá ajustar la zona o el presupuesto.
                              </p>
                            ) : (
                              <div className="space-y-2.5">
                                {g.candidatos.map((c) => (
                                  <CardResultado
                                    key={`${g.servicio.id}-${c.rancho.id}`}
                                    candidato={c}
                                    favoritoInicial={favoritosIds.has(c.rancho.id)}
                                    sesionActiva={sesionActiva}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}

                      <p className="mt-6 text-center text-[11px] text-zinc-500">
                        Los precios &quot;desde&quot; son de referencia — confirmá la cotización
                        con cada negocio.
                      </p>
                      <div className="mt-3 flex justify-center">
                        <button
                          type="button"
                          onClick={atras}
                          className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange"
                        >
                          ← Ajustar mis respuestas
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Piezas del wizard ---------- */

function Pregunta({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-[17px] font-extrabold leading-snug text-aventurea-ink">{titulo}</h2>
      <p className="mb-4 mt-1 text-[12.5px] text-aventurea-ink-soft">{sub}</p>
      {children}
    </div>
  );
}

function PieBotones({
  onAtras,
  onSiguiente,
  siguienteLabel,
  destacado,
}: {
  onAtras: () => void;
  onSiguiente: () => void;
  siguienteLabel: string;
  destacado?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onAtras}
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Atrás
      </button>
      <button
        type="button"
        onClick={onSiguiente}
        className={`rounded-full px-5 py-2.5 text-[13px] font-bold text-white transition-colors ${
          destacado
            ? "bg-aventurea-orange hover:bg-aventurea-orange-dark"
            : "bg-aventurea-navy hover:bg-aventurea-navy/85"
        }`}
      >
        {siguienteLabel}
      </button>
    </div>
  );
}

function ChipGrande({
  emoji,
  label,
  activo,
  onClick,
}: {
  emoji: string;
  label: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-[14px] border px-3 py-3 text-left text-[13px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
      }`}
    >
      <span aria-hidden className="text-[17px]">{emoji}</span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

function ChipChico({
  label,
  activo,
  onClick,
}: {
  label: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-ink"
      }`}
    >
      {label}
    </button>
  );
}

/** Card compacta de un negocio real dentro de los resultados. */
function CardResultado({
  candidato,
  favoritoInicial,
  sesionActiva,
}: {
  candidato: CandidatoServicio;
  favoritoInicial: boolean;
  sesionActiva: boolean;
}) {
  const { rancho, calificacion, etiquetaDisponibilidad } = candidato;
  const esBookear = rancho.nombre === NOMBRE_RANCHO_BOOKEAR;
  const href = esBookear
    ? "/eventos-salon"
    : rancho.slug
      ? `/${rancho.slug}`
      : `/eventos/${rancho.id}`;
  const esDemo = !!rancho.slug?.startsWith("demo-");
  const precio = fmtColones(rancho.precio_desde);
  const rubro = rancho.subcategoria
    ? SUBCATEGORIA_LABEL[rancho.subcategoria]
    : CATEGORIA_LABEL[rancho.categoria];
  const ubicacion = [rancho.canton, rancho.provincia].filter(Boolean).join(", ");

  return (
    <article className="rounded-[18px] border border-aventurea-line bg-white p-3 shadow-[0_8px_28px_-18px_rgba(22,41,94,0.3)] transition-shadow hover:shadow-[0_14px_34px_-18px_rgba(22,41,94,0.4)]">
      <div className="flex gap-3">
        <div
          className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[14px] bg-aventurea-blue-light"
          style={
            !rancho.foto_url
              ? { backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] }
              : undefined
          }
        >
          {rancho.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- fotos externas subidas por cada proveedor, sin dominio fijo para next/image
            <img
              src={rancho.foto_url}
              alt={rancho.nombre}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-white/30 [&_svg]:h-7 [&_svg]:w-7">
              {CATEGORIA_ICONO[rancho.categoria]}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-aventurea-ink">
              {rancho.nombre}
            </h4>
            {calificacion && (
              <span className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-aventurea-ink">
                <IconStar className="h-3.5 w-3.5 text-aventurea-orange" />
                {calificacion.promedio.toFixed(1).replace(".", ",")}
                <span className="font-semibold text-aventurea-ink-soft">({calificacion.total})</span>
              </span>
            )}
          </div>
          <p className="truncate text-[11.5px] text-aventurea-ink-soft">
            {rubro}
            {ubicacion ? ` · ${ubicacion}` : ""}
          </p>
          <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
            {precio ? (
              <>
                Desde <strong className="font-extrabold text-aventurea-ink">{precio}</strong>{" "}
                {UNIDAD_PRECIO_LABEL[rancho.unidad_precio]}
              </>
            ) : (
              "Precio a consultar"
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-aventurea-navy px-2 py-0.5 text-[10.5px] font-bold text-aventurea-navy">
              <i aria-hidden className="h-1 w-1 rounded-full bg-aventurea-navy" />
              {etiquetaDisponibilidad}
            </span>
            {esDemo && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-zinc-900">
                Demo
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 border-t border-aventurea-line/70 pt-2.5">
        <Link
          href={href}
          className="flex h-8 flex-1 items-center justify-center rounded-full border border-aventurea-navy px-3 text-[12px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white"
        >
          Ver perfil
        </Link>
        <Link
          href={`/mensajes/consulta/${rancho.id}`}
          className="flex h-8 flex-1 items-center justify-center rounded-full bg-aventurea-orange px-3 text-[12px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
        >
          Pedir cotización
        </Link>
        <CorazonFavorito ranchoId={rancho.id} inicial={favoritoInicial} sesionActiva={sesionActiva} />
      </div>
    </article>
  );
}

/** El mismo mecanismo de favoritos de las cards del directorio. */
function CorazonFavorito({
  ranchoId,
  inicial,
  sesionActiva,
}: {
  ranchoId: string;
  inicial: boolean;
  sesionActiva: boolean;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(inicial);
  const [pending, startTransition] = useTransition();

  function alternar() {
    if (!sesionActiva) {
      router.push("/cuenta");
      return;
    }
    const nuevo = !activo;
    setActivo(nuevo);
    startTransition(async () => {
      const res = await alternarFavorito(ranchoId, nuevo);
      if (res?.error) setActivo(!nuevo);
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={pending}
      aria-label={activo ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={activo}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-aventurea-line transition-transform hover:scale-110 disabled:opacity-70"
    >
      <IconHeart
        className={`h-4 w-4 ${activo ? "text-aventurea-orange" : "text-aventurea-ink-soft"}`}
      />
    </button>
  );
}

/** "¿Querés que te guardemos esto?" — el lead opcional al cerrar. */
function PantallaGuardar({
  respuestas,
  onGuardado,
  onSaltar,
}: {
  respuestas: RespuestasPlanificador;
  onGuardado: () => void;
  onSaltar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [pending, startTransition] = useTransition();

  const puedeGuardar = consentimiento && (correo.trim() !== "" || whatsapp.trim() !== "");

  function guardar() {
    startTransition(async () => {
      // Si la tabla no existe o el insert falla, se cierra igual: el
      // lead nunca puede trabar al usuario.
      await guardarLeadPlanificador({ nombre, correo, whatsapp, respuestas, consentimiento });
      onGuardado();
    });
  }

  const inputCls =
    "w-full rounded-[14px] border border-aventurea-line bg-aventurea-cream-2 px-4 py-3 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-navy/50 focus:outline-none";

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      <h2 className="text-[17px] font-extrabold leading-snug text-aventurea-ink">
        ¿Querés que te guardemos esto?
      </h2>
      <p className="mb-4 mt-1 text-[12.5px] text-aventurea-ink-soft">
        Dejanos un contacto y te ayudamos a aterrizar tu evento. Es totalmente opcional — tus
        respuestas quedan guardadas en este navegador de todos modos.
      </p>

      <div className="space-y-2.5">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          className={inputCls}
        />
        <input
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="Correo electrónico"
          className={inputCls}
        />
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="WhatsApp — ej. 8888 8888"
          className={inputCls}
        />
      </div>

      <label className="mt-3.5 flex items-start gap-2.5 text-[11.5px] leading-relaxed text-aventurea-ink-soft">
        <input
          type="checkbox"
          checked={consentimiento}
          onChange={(e) => setConsentimiento(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-aventurea-orange"
        />
        <span>
          Acepto que Bookea guarde estos datos para contactarme sobre mi evento (Ley 8968).
          Puedo pedir que los borren cuando quiera.
        </span>
      </label>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSaltar}
          className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          No, gracias
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={!puedeGuardar || pending}
          className="rounded-full bg-aventurea-orange px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark disabled:opacity-40"
        >
          {pending ? "Guardando…" : "Guardar mi plan"}
        </button>
      </div>
    </div>
  );
}
