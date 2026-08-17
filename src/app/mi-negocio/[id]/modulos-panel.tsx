"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import * as Iconos from "@/components/icons";
import {
  FAMILIAS,
  FAMILIA_LABEL,
  GRUPOS,
  GRUPO_LABEL,
  MODULOS,
  definicionModulo,
  definicionTipo,
  modulosPorDefecto,
  modulosProximamente,
  resolverModulos,
  tiposDeVertical,
  type FamiliaId,
  type ModuloId,
  type TipoNegocioId,
} from "@/lib/business/modulos";
import { identidadDe, variablesAcento } from "@/lib/business/identidad";
import { guardarModulos, guardarTipoNegocio } from "./modulos-actions";

/**
 * Bookea Business — el tipo de negocio y sus módulos.
 *
 * Acá se decide qué ve el dueño en su panel: la barbería trabaja con
 * agenda, servicios y equipo; el estudio de pilates con clases,
 * membresías y check-in. Un mismo Bookea, dos experiencias.
 *
 * Dos cosas que esta pantalla hace a propósito:
 *
 * 1. ELEGIR NO ES GUARDAR. El <select> solo mueve el candidato; abajo se
 *    arma la ficha de ese tipo (nombre, para qué es, cómo llama a la
 *    gente y qué secciones enciende o apaga) y recién ahí hay un botón.
 *    Cambiar de tipo reordena el panel entero, así que el dueño tiene
 *    que poder VER el cambio antes de aceptarlo, no descubrirlo.
 *
 * 2. EL DERIVADO SE CONFIRMA. `ranchos.tipo_negocio` está en null para
 *    todos los negocios que existían antes de la 0108: funcionan con el
 *    tipo deducido de su categoría, pero nadie lo eligió. Antes eso era
 *    una línea de letra chica y no había forma de aceptarlo (elegir el
 *    mismo valor no dispara `onChange`). Ahora es un aviso con su botón.
 *
 * Todo lo que se muestra sale del catálogo (`modulos.ts` + `identidad.ts`)
 * o de las diferencias guardadas del negocio: acá no se calcula ni se
 * insinúa ninguna métrica.
 */

/** El orden de `MODULOS` es el del menú: se respeta al listar. */
const ORDEN_MODULOS = MODULOS.map((m) => m.id) as readonly ModuloId[];

function ordenar(ids: Iterable<ModuloId>): ModuloId[] {
  return [...ids].sort((a, b) => ORDEN_MODULOS.indexOf(a) - ORDEN_MODULOS.indexOf(b));
}

function nombres(ids: readonly ModuloId[]): string {
  return ids.map((id) => definicionModulo(id).nombre).join(" · ");
}

export default function ModulosPanel({
  ranchoId,
  vertical,
  tipo,
  tipoExplicito,
  publicadoComo,
  overrides,
  errorModulos,
}: {
  ranchoId: string;
  vertical: string;
  /** El tipo que rige HOY: el elegido, o el derivado si nadie eligió. */
  tipo: TipoNegocioId;
  /** false = el tipo se dedujo de la categoría, nadie lo eligió. */
  tipoExplicito: boolean;
  /** Cómo está publicado el negocio, para explicar de dónde salió el derivado. */
  publicadoComo: string;
  /** Las diferencias guardadas contra el default (modulo → activo). */
  overrides: Record<string, boolean>;
  errorModulos: string | null;
}) {
  // `tipoActual`/`explicito` son lo GUARDADO (se mueven al guardar);
  // `candidato` es lo que el dueño está mirando en el selector.
  const [tipoActual, setTipoActual] = useState<TipoNegocioId>(tipo);
  const [explicito, setExplicito] = useState(tipoExplicito);
  const [candidato, setCandidato] = useState<TipoNegocioId>(tipo);

  // Lo que resuelve el servidor hoy, recalculado con la MISMA función:
  // el default del tipo corregido por las diferencias guardadas.
  const activosGuardados = useMemo(
    () => resolverModulos({ tipo: tipoActual, overrides }),
    [tipoActual, overrides],
  );

  const [seleccion, setSeleccion] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULOS.map((m) => [m.id, resolverModulos({ tipo, overrides }).has(m.id)])),
  );
  const [guardando, startGuardar] = useTransition();
  const [cambiandoTipo, startTipo] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Los tipos de esta vertical. Si el tipo vigente no estuviera en la
  // lista (dato viejo o vertical rara), igual se ofrece para que el
  // selector no aparezca en blanco mostrando otra cosa: quien manda es
  // el servidor, que rechaza lo que no corresponde y muestra el error.
  const opciones = useMemo(() => {
    const propias = tiposDeVertical(vertical);
    return propias.some((t) => t.id === tipoActual)
      ? propias
      : [definicionTipo(tipoActual), ...propias];
  }, [vertical, tipoActual]);

  const porFamilia = useMemo(
    () =>
      FAMILIAS.map((familia: FamiliaId) => ({
        familia,
        tipos: opciones.filter((t) => t.familia === familia),
      })).filter((g) => g.tipos.length > 0),
    [opciones],
  );

  const porDefecto = useMemo(() => new Set(modulosPorDefecto(tipoActual)), [tipoActual]);

  // ---- La ficha del candidato ----
  const identidad = useMemo(() => identidadDe(candidato), [candidato]);
  const IconoTipo = Iconos[identidad.icono];
  const defTipo = definicionTipo(candidato);

  const activosCandidato = useMemo(
    () => resolverModulos({ tipo: candidato, overrides }),
    [candidato, overrides],
  );
  const proximamente = useMemo(() => ordenar(modulosProximamente(candidato)), [candidato]);

  const cambiaria = candidato !== tipoActual;
  const seEnciende = useMemo(
    () => ordenar([...activosCandidato].filter((id) => !activosGuardados.has(id))),
    [activosCandidato, activosGuardados],
  );
  const seApaga = useMemo(
    () => ordenar([...activosGuardados].filter((id) => !activosCandidato.has(id))),
    [activosCandidato, activosGuardados],
  );

  function aplicarTipo() {
    setError(null);
    setMensaje(null);
    startTipo(async () => {
      const res = await guardarTipoNegocio(ranchoId, candidato);
      if (res.error) {
        setError(res.error);
        return;
      }
      setTipoActual(candidato);
      setExplicito(true);
      // Las diferencias guardadas siguen valiendo, así que la selección
      // nueva se recalcula con la misma función que va a usar el
      // servidor al recargar — no con una regla paralela.
      const nuevos = resolverModulos({ tipo: candidato, overrides });
      setSeleccion(Object.fromEntries(MODULOS.map((m) => [m.id, nuevos.has(m.id)])));
      setMensaje(
        cambiaria
          ? `Listo — tu panel ahora es de ${defTipo.label}.`
          : `Listo — ${defTipo.label} quedó guardado como tu tipo de negocio.`,
      );
    });
  }

  function guardar() {
    setError(null);
    setMensaje(null);
    startGuardar(async () => {
      const res = await guardarModulos(ranchoId, seleccion);
      if (res.error) setError(res.error);
      else setMensaje("Módulos guardados.");
    });
  }

  const disponibles = MODULOS.filter((m) => m.disponible);
  const hayCambios = disponibles.some(
    (m) => (seleccion[m.id] === true) !== activosGuardados.has(m.id),
  );

  return (
    <div className="flex flex-col gap-5">
      {errorModulos && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
          <strong>Falta la migración de Bookea Business.</strong> Tu negocio funciona con los
          módulos que le corresponden por su tipo, pero no vas a poder cambiarlos hasta correr{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
            supabase/migrations/0108_bookea_business_tipo_y_modulos.sql
          </code>{" "}
          en el SQL Editor de Supabase. ({errorModulos})
        </div>
      )}

      {/* ---- Tipo de negocio ---- */}
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
        <label htmlFor="tipo-negocio" className="text-[13px] font-bold text-aventurea-ink">
          ¿Qué tipo de negocio administrás?
        </label>
        <p className="mb-3 mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          Esto no es una etiqueta: reconfigura tu panel. Define qué secciones ves en el menú y cómo
          te habla el sistema. No cambia cómo te encuentra la gente en Bookea — eso lo decide tu
          categoría, en Mi perfil.
        </p>

        {/* Punto de partida honesto: nadie eligió nada, esto es lo que
            está rigiendo mientras tanto y de dónde salió. */}
        {!explicito && (
          <div className="mb-3 rounded-xl border border-aventurea-orange/40 bg-aventurea-orange/10 p-3.5 text-[12.5px] leading-relaxed text-aventurea-ink">
            <strong>Todavía no elegiste tu tipo de negocio.</strong> Mientras tanto tu panel
            funciona como <strong>{definicionTipo(tipoActual).label}</strong>, deducido de cómo
            estás publicado ({publicadoComo}). Revisá la ficha de acá abajo: si es lo que sos,
            confirmalo; si no, elegí el que te calce.
          </div>
        )}

        <select
          id="tipo-negocio"
          value={candidato}
          disabled={cambiandoTipo}
          onChange={(e) => {
            setCandidato(e.target.value as TipoNegocioId);
            setError(null);
            setMensaje(null);
          }}
          className="w-full max-w-[340px] rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink disabled:opacity-60"
        >
          {porFamilia.map((grupo) => (
            <optgroup key={grupo.familia} label={FAMILIA_LABEL[grupo.familia]}>
              {grupo.tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* ---- La ficha: qué es y qué cambia si lo elige ---- */}
        <div
          style={variablesAcento(identidad) as CSSProperties}
          className="mt-4 rounded-xl border border-aventurea-line bg-white p-4"
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[19px]"
              style={{ background: "var(--acento-suave)", color: "var(--acento)" }}
              aria-hidden
            >
              <IconoTipo className="h-[1em] w-[1em]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-aventurea-ink">
                {defTipo.label}
                {!cambiaria && (
                  <span
                    className="rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                    style={{ background: "var(--acento-suave)", color: "var(--acento)" }}
                  >
                    {explicito ? "Tu tipo actual" : "El que rige hoy"}
                  </span>
                )}
                {cambiaria && (
                  <span className="rounded-md bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Sin guardar
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                {identidad.descripcion}
              </p>
            </div>
          </div>

          <dl className="mt-3.5 flex flex-col gap-2.5 border-t border-aventurea-line/60 pt-3.5 text-[12.5px] leading-relaxed">
            <div>
              <dt className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-aventurea-ink-soft">
                Cómo te habla el panel
              </dt>
              <dd className="text-aventurea-ink">
                A quien viene le dice{" "}
                <strong style={{ color: "var(--acento)" }}>
                  {identidad.vocabulario.persona.plural}
                </strong>
                , y a lo que se agenda,{" "}
                <strong style={{ color: "var(--acento)" }}>
                  {identidad.vocabulario.visita.plural}
                </strong>
                .
              </dd>
            </div>

            <div>
              <dt className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-aventurea-ink-soft">
                Secciones que vas a tener ({activosCandidato.size})
              </dt>
              <dd className="text-aventurea-ink">{nombres(ordenar(activosCandidato))}</dd>
            </div>

            {/* Lo que este tipo declara pero todavía no se puede abrir.
                Va aparte y dicho con todas las letras: prometer una
                sección que no existe es peor que no ofrecerla. */}
            {proximamente.length > 0 && (
              <div>
                <dt className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-aventurea-ink-soft">
                  En camino para este tipo
                </dt>
                <dd className="text-aventurea-ink-soft">
                  {nombres(proximamente)} — todavía no se pueden abrir; aparecen abajo como
                  &ldquo;próximamente&rdquo;.
                </dd>
              </div>
            )}

            {cambiaria && (
              <div className="rounded-lg bg-aventurea-cream-2 p-3">
                <dt className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-aventurea-ink-soft">
                  Qué cambia contra tu panel de ahora ({definicionTipo(tipoActual).label})
                </dt>
                <dd className="mt-0.5 text-aventurea-ink">
                  {seEnciende.length === 0 && seApaga.length === 0 ? (
                    <>
                      Las mismas secciones. Cambian el vocabulario y cómo se presenta tu negocio en
                      el panel.
                    </>
                  ) : (
                    <span className="flex flex-col gap-0.5">
                      {seEnciende.length > 0 && (
                        <span>
                          <strong className="text-aventurea-green">Se enciende:</strong>{" "}
                          {nombres(seEnciende)}
                        </span>
                      )}
                      {seApaga.length > 0 && (
                        <span>
                          <strong>Se apaga:</strong> {nombres(seApaga)} — no se borra nada de lo que
                          ya tenés; la sección deja de aparecer en el menú y podés volver a
                          encenderla acá abajo.
                        </span>
                      )}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>

          {(cambiaria || !explicito) && (
            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={aplicarTipo}
                disabled={cambiandoTipo}
                className="rounded-xl bg-aventurea-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-60"
              >
                {cambiandoTipo
                  ? "Guardando…"
                  : cambiaria
                    ? `Cambiar mi panel a ${defTipo.label}`
                    : `Confirmar que soy ${defTipo.label}`}
              </button>
              {cambiaria && (
                <button
                  type="button"
                  onClick={() => setCandidato(tipoActual)}
                  disabled={cambiandoTipo}
                  className="text-[12.5px] font-bold text-aventurea-ink-soft underline disabled:opacity-60"
                >
                  Dejarlo como está
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Módulos ---- */}
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
        <p className="text-[13px] font-bold text-aventurea-ink">Tus módulos</p>
        <p className="mb-4 mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          Tu tipo de negocio ya trae los suyos recomendados. Apagá lo que no usás y tu menú se
          acorta. Lo que dice &ldquo;próximamente&rdquo; ya está en camino.
        </p>

        <div className="flex flex-col gap-4">
          {GRUPOS.map((grupo) => {
            const delGrupo = MODULOS.filter((m) => m.grupo === grupo);
            if (delGrupo.length === 0) return null;
            return (
              <div key={grupo}>
                <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-aventurea-ink-soft">
                  {GRUPO_LABEL[grupo]}
                </p>
                <div className="overflow-hidden rounded-xl border border-aventurea-line bg-white">
                  {delGrupo.map((m, i) => {
                    const encendido = seleccion[m.id] === true;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${
                          i > 0 ? "border-t border-aventurea-line/60" : ""
                        } ${m.disponible ? "" : "bg-aventurea-cream-2/60"}`}
                      >
                        <div className="min-w-[180px] flex-1">
                          <p className="text-[13px] font-bold text-aventurea-ink">
                            {m.nombre}
                            {porDefecto.has(m.id) && (
                              <span className="ml-2 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                                recomendado
                              </span>
                            )}
                          </p>
                          <p className="text-[12px] leading-snug text-aventurea-ink-soft">
                            {m.resumen}
                          </p>
                        </div>
                        {m.disponible ? (
                          <button
                            type="button"
                            aria-pressed={encendido}
                            onClick={() => {
                              setSeleccion((s) => ({ ...s, [m.id]: !encendido }));
                              setMensaje(null);
                            }}
                            className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] font-bold ${
                              encendido
                                ? "border-aventurea-green bg-aventurea-green/10 text-aventurea-green"
                                : "border-aventurea-line bg-aventurea-cream-2 text-zinc-500"
                            }`}
                          >
                            {encendido ? "Activo" : "Apagado"}
                          </button>
                        ) : (
                          <span className="shrink-0 rounded-lg bg-aventurea-cream-2 px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-zinc-500">
                            Próximamente
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !hayCambios}
            className="rounded-xl bg-aventurea-sky px-4 py-2 text-[13px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
          >
            {guardando ? "Guardando..." : "Guardar módulos"}
          </button>
          {mensaje && (
            <span className="text-[12.5px] font-bold text-aventurea-green">✓ {mensaje}</span>
          )}
        </div>
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}
      </div>
    </div>
  );
}
