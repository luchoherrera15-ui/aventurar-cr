"use client";

import { useMemo, useState, useTransition } from "react";
import {
  FAMILIAS,
  FAMILIA_LABEL,
  GRUPOS,
  GRUPO_LABEL,
  MODULOS,
  modulosPorDefecto,
  tiposDeVertical,
  type FamiliaId,
  type ModuloId,
  type TipoNegocioId,
} from "@/lib/business/modulos";
import { guardarModulos, guardarTipoNegocio } from "./modulos-actions";

/**
 * Bookea Business — el tipo de negocio y sus módulos.
 *
 * Acá se decide qué ve el dueño en su panel: la barbería trabaja con
 * agenda, servicios y equipo; el estudio de pilates con clases,
 * membresías y check-in. Un mismo Bookea, dos experiencias.
 *
 * El tipo se guarda solo (cambiarlo reordena el panel entero, así que
 * conviene que se vea el efecto de una vez) y los módulos se guardan
 * con su botón, porque son varios de un tirón.
 */
export default function ModulosPanel({
  ranchoId,
  vertical,
  tipo,
  tipoExplicito,
  activos,
  errorModulos,
}: {
  ranchoId: string;
  vertical: string;
  tipo: TipoNegocioId;
  /** false = el tipo se dedujo de la categoría, nadie lo eligió. */
  tipoExplicito: boolean;
  activos: ModuloId[];
  errorModulos: string | null;
}) {
  const [tipoActual, setTipoActual] = useState<TipoNegocioId>(tipo);
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULOS.map((m) => [m.id, activos.includes(m.id)])),
  );
  const [guardando, startGuardar] = useTransition();
  const [cambiandoTipo, startTipo] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const opciones = useMemo(() => tiposDeVertical(vertical), [vertical]);
  const porFamilia = useMemo(
    () =>
      FAMILIAS.map((familia: FamiliaId) => ({
        familia,
        tipos: opciones.filter((t) => t.familia === familia),
      })).filter((g) => g.tipos.length > 0),
    [opciones],
  );

  const porDefecto = useMemo(() => new Set(modulosPorDefecto(tipoActual)), [tipoActual]);

  function cambiarTipo(nuevo: string) {
    setError(null);
    setMensaje(null);
    startTipo(async () => {
      const res = await guardarTipoNegocio(ranchoId, nuevo);
      if (res.error) {
        setError(res.error);
        return;
      }
      setTipoActual(nuevo as TipoNegocioId);
      // El tipo nuevo trae sus propios módulos por defecto; las
      // diferencias guardadas del tipo anterior siguen valiendo, así
      // que se recalcula lo mismo que va a resolver el servidor.
      const nuevosDefaults = new Set(modulosPorDefecto(nuevo as TipoNegocioId));
      setSeleccion((previa) =>
        Object.fromEntries(
          MODULOS.map((m) => {
            const antesEraDefault = porDefecto.has(m.id) === (previa[m.id] === true);
            return [m.id, antesEraDefault ? nuevosDefaults.has(m.id) : previa[m.id] === true];
          }),
        ),
      );
      setMensaje("Listo — tu panel se reorganizó para este tipo de negocio.");
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
  const hayCambios = disponibles.some((m) => (seleccion[m.id] === true) !== activos.includes(m.id));

  return (
    <div className="flex flex-col gap-5">
      {errorModulos && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
          <strong>Falta la migración de Bookea Business.</strong> Tu negocio
          funciona con los módulos que le corresponden por su tipo, pero no vas
          a poder cambiarlos hasta correr{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
            supabase/migrations/0108_bookea_business_tipo_y_modulos.sql
          </code>{" "}
          en el SQL Editor de Supabase. ({errorModulos})
        </div>
      )}

      {/* ---- Tipo de negocio ---- */}
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
        <label
          htmlFor="tipo-negocio"
          className="text-[13px] font-bold text-aventurea-ink"
        >
          ¿Qué tipo de negocio administrás?
        </label>
        <p className="mb-3 mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          Define qué herramientas ves. No cambia cómo te encuentra la gente en
          Bookea — eso lo decide tu categoría, en Mi perfil.
        </p>
        <select
          id="tipo-negocio"
          value={tipoActual}
          disabled={cambiandoTipo}
          onChange={(e) => cambiarTipo(e.target.value)}
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
        {!tipoExplicito && (
          <p className="mt-2 text-[12px] text-aventurea-ink-soft">
            Lo dedujimos de tu categoría. Si no es exacto, elegí el que sea —
            por ejemplo un gimnasio o un estudio de pilates.
          </p>
        )}
        {cambiandoTipo && (
          <p className="mt-2 text-[12px] font-bold text-aventurea-navy">Guardando…</p>
        )}
      </div>

      {/* ---- Módulos ---- */}
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
        <p className="text-[13px] font-bold text-aventurea-ink">Tus módulos</p>
        <p className="mb-4 mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          Apagá lo que no usás y tu menú se acorta. Lo que dice
          &ldquo;próximamente&rdquo; ya está en camino.
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
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
        )}
      </div>
    </div>
  );
}
