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
import { Card, PildoraEstado } from "@/components/panel/piezas";
import {
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  DETALLE,
  DISCO_ACENTO,
  ESTADO_AVISO,
  ESTADO_PILDORA,
  RADIO_TILE,
  SUPERFICIE_HUNDIDA,
} from "@/components/panel/sistema";
import { BOTON_FILA } from "./fila-ficha";
import { iconoModulo } from "./iconos-modulos";
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
 *
 * ── LO QUE TODAVÍA NO EXISTE ES UNA PROMESA, NO UN HUECO ────────────
 * «Recursos», «Inventario», «Comisiones», «Marketing» y los módulos de
 * clínica están declarados por su tipo y todavía no tienen pantalla.
 * Antes se veían como una fila apagada, sobre un gris translúcido, con
 * el nombre en gris claro y un chip que decía «Próximamente» — la
 * misma cara que tiene una sección rota. Ahora llevan la MISMA fila que
 * los demás: su ícono, su nombre en tinta plena y una explicación de
 * para qué va a servir. Lo único distinto es el marco punteado y la
 * píldora que dice «En camino», que es la verdad y no una falla.
 */

/** El orden de `MODULOS` es el del menú: se respeta al listar. */
const ORDEN_MODULOS = MODULOS.map((m) => m.id) as readonly ModuloId[];

function ordenar(ids: Iterable<ModuloId>): ModuloId[] {
  return [...ids].sort((a, b) => ORDEN_MODULOS.indexOf(a) - ORDEN_MODULOS.indexOf(b));
}

function nombres(ids: readonly ModuloId[]): string {
  return ids.map((id) => definicionModulo(id).nombre).join(" · ");
}

/** El rótulo de un grupo de módulos (`.nav-label` de la maqueta). */
const ROTULO_GRUPO =
  "mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft";

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
  const encendidos = disponibles.filter((m) => seleccion[m.id] === true).length;
  const enCamino = MODULOS.filter((m) => !m.disponible).length;

  return (
    <>
      {errorModulos && (
        <p className={`rounded-xl p-4 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}>
          <strong>Falta la migración de Bookea Business.</strong> Tu negocio funciona con los
          módulos que le corresponden por su tipo, pero no vas a poder cambiarlos hasta correr{" "}
          <code className="rounded bg-aventurea-surface px-1.5 py-0.5 font-mono text-[12px]">
            supabase/migrations/0108_bookea_business_tipo_y_modulos.sql
          </code>{" "}
          en el SQL Editor de Supabase. ({errorModulos})
        </p>
      )}

      {/* ── Tipo de negocio ──────────────────────────────────────── */}
      <Card
        eyebrow="Cómo se arma tu panel"
        titulo="Tu tipo de negocio"
        accion={
          <PildoraEstado estado={explicito ? "exito" : "aviso"}>
            {explicito ? "Confirmado" : "Sin confirmar"}
          </PildoraEstado>
        }
      >
        <label htmlFor="tipo-negocio" className="text-[13px] font-bold text-aventurea-ink">
          ¿Qué tipo de negocio administrás?
        </label>
        <p className={`mb-3 mt-1 leading-relaxed ${DETALLE}`}>
          Esto no es una etiqueta: reconfigura tu panel. Define qué secciones ves en el menú y
          cómo te habla el sistema. No cambia cómo te encuentra la gente en Bookea — eso lo
          decide tu categoría, en Mi perfil.
        </p>

        {/* Punto de partida honesto: nadie eligió nada, esto es lo que
            está rigiendo mientras tanto y de dónde salió. */}
        {!explicito && (
          /* La familia azul del sistema, sólida: esto no es una
             advertencia —el panel funciona igual sin elegir tipo—, es
             información, y pintarla de ámbar la hacía leer como error.
             `--navy` sobre `blue-light` = 12,07:1. */
          <p className={`mb-3 rounded-xl p-3.5 text-[12.5px] leading-relaxed ${ESTADO_AVISO.info}`}>
            <strong>Todavía no elegiste tu tipo de negocio.</strong> Mientras tanto tu panel
            funciona como <strong>{definicionTipo(tipoActual).label}</strong>, deducido de cómo
            estás publicado ({publicadoComo}). Revisá la ficha de acá abajo: si es lo que sos,
            confirmalo; si no, elegí el que te calce.
          </p>
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
          className={`max-w-[340px] disabled:opacity-60 ${CAMPO_PANEL}`}
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
          className={`mt-4 rounded-2xl p-4 ${SUPERFICIE_HUNDIDA}`}
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[19px]"
              style={DISCO_ACENTO as CSSProperties}
              aria-hidden
            >
              <IconoTipo className="h-[1em] w-[1em]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-extrabold text-aventurea-ink">
                {defTipo.label}
                {!cambiaria && (
                  <span
                    className="rounded-lg px-2 py-1 text-[11px] font-extrabold uppercase leading-none tracking-wide"
                    style={{ background: "var(--acento-suave)", color: "var(--acento)" }}
                  >
                    {explicito ? "Tu tipo actual" : "El que rige hoy"}
                  </span>
                )}
                {cambiaria && <PildoraEstado estado="aviso">Sin guardar</PildoraEstado>}
              </p>
              <p className={`mt-0.5 leading-relaxed ${DETALLE}`}>{identidad.descripcion}</p>
            </div>
          </div>

          <dl className="mt-3.5 flex flex-col gap-2.5 border-t border-aventurea-line pt-3.5 text-[12.5px] leading-relaxed">
            <div>
              <dt className={ROTULO_GRUPO}>Cómo te habla el panel</dt>
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
              <dt className={ROTULO_GRUPO}>
                Secciones que vas a tener ({activosCandidato.size})
              </dt>
              <dd className="text-aventurea-ink">{nombres(ordenar(activosCandidato))}</dd>
            </div>

            {/* Lo que este tipo declara pero todavía no se puede abrir.
                Va aparte y dicho con todas las letras: prometer una
                sección que no existe es peor que no ofrecerla. */}
            {proximamente.length > 0 && (
              <div>
                <dt className={ROTULO_GRUPO}>En camino para este tipo</dt>
                <dd className="text-aventurea-ink">
                  {nombres(proximamente)} — todavía no se pueden abrir; aparecen abajo como
                  &ldquo;en camino&rdquo;.
                </dd>
              </div>
            )}

            {cambiaria && (
              <div className="rounded-xl border border-aventurea-line bg-aventurea-surface p-3">
                <dt className={ROTULO_GRUPO}>
                  Qué cambia contra tu panel de ahora ({definicionTipo(tipoActual).label})
                </dt>
                <dd className="mt-0.5 text-aventurea-ink">
                  {seEnciende.length === 0 && seApaga.length === 0 ? (
                    <>
                      Las mismas secciones. Cambian el vocabulario y cómo se presenta tu negocio
                      en el panel.
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
                          <strong>Se apaga:</strong> {nombres(seApaga)} — no se borra nada de lo
                          que ya tenés; la sección deja de aparecer en el menú y podés volver a
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
                className={BOTON_PANEL_PRIMARIO}
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
                  className="text-[12.5px] font-bold text-aventurea-navy underline disabled:opacity-60"
                >
                  Dejarlo como está
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Módulos ──────────────────────────────────────────────── */}
      <Card
        eyebrow="Qué ves en tu menú"
        titulo="Tus módulos"
        accion={
          <span className={DETALLE}>
            {encendidos} encendido{encendidos === 1 ? "" : "s"} · {enCamino} en camino
          </span>
        }
      >
        <p className={`mb-4 leading-relaxed ${DETALLE}`}>
          Tu tipo de negocio ya trae los suyos recomendados. Apagá lo que no usás y tu menú se
          acorta. Los que dicen <strong>en camino</strong> están declarados por tu tipo y los
          estamos construyendo: cuando abran, aparecen solos en tu menú.
        </p>

        <div className="flex flex-col gap-4">
          {GRUPOS.map((grupo) => {
            const delGrupo = MODULOS.filter((m) => m.grupo === grupo);
            if (delGrupo.length === 0) return null;
            return (
              <div key={grupo}>
                <p className={ROTULO_GRUPO}>{GRUPO_LABEL[grupo]}</p>
                <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                  {delGrupo.map((m) => {
                    const encendido = seleccion[m.id] === true;
                    return (
                      <div
                        key={m.id}
                        // La misma tarjetita para los tres estados. Lo
                        // único que cambia en el que todavía no existe
                        // es el marco punteado: no es un error, es que
                        // no se puede tocar todavía.
                        className={`flex items-start gap-2.5 p-3 ${RADIO_TILE} border bg-aventurea-surface ${
                          m.disponible
                            ? "border-aventurea-line"
                            : "border-dashed border-aventurea-line"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[17px] [&_svg]:h-[18px] [&_svg]:w-[18px] ${
                            m.disponible && encendido
                              ? ""
                              : "bg-aventurea-cream-2 text-aventurea-ink-soft"
                          }`}
                          style={
                            m.disponible && encendido
                              ? (DISCO_ACENTO as CSSProperties)
                              : undefined
                          }
                        >
                          {iconoModulo(m.id)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold text-aventurea-ink">
                            {m.nombre}
                            {porDefecto.has(m.id) && (
                              <PildoraEstado estado="neutro">Recomendado</PildoraEstado>
                            )}
                          </p>
                          {/* Misma tinta para los tres estados: el
                              módulo que todavía no abrió es justamente
                              el que hay que poder LEER, porque es lo
                              único que se sabe de él. 7,12:1. */}
                          <p className="mt-1 text-[12px] leading-snug text-aventurea-ink-soft">
                            {m.resumen}
                          </p>
                        </div>
                        {m.disponible ? (
                          <button
                            type="button"
                            aria-pressed={encendido}
                            aria-label={`${encendido ? "Apagar" : "Encender"} ${m.nombre}`}
                            onClick={() => {
                              setSeleccion((s) => ({ ...s, [m.id]: !encendido }));
                              setMensaje(null);
                            }}
                            className={
                              encendido
                                ? `inline-flex h-8 shrink-0 items-center rounded-lg px-2.5 text-[12px] font-bold ${ESTADO_PILDORA.exito}`
                                : BOTON_FILA
                            }
                          >
                            {encendido ? "Activo" : "Apagado"}
                          </button>
                        ) : (
                          <PildoraEstado estado="info">En camino</PildoraEstado>
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
            className={BOTON_PANEL_PRIMARIO}
          >
            {guardando ? "Guardando..." : "Guardar módulos"}
          </button>
          {mensaje && (
            <span className="text-[12.5px] font-bold text-aventurea-green">✓ {mensaje}</span>
          )}
        </div>
        {error && (
          <p role="alert" className={`mt-3 rounded-xl p-3 text-[13px] ${ESTADO_AVISO.alerta}`}>
            {error}
          </p>
        )}
      </Card>
    </>
  );
}
