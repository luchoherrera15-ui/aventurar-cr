"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Card, CardVacia } from "@/components/panel/piezas";
import { CAMPO_PANEL, CUERPO_SUAVE, ESTADO_AVISO, RADIO_TILE, ROTULO_CAMPO } from "@/components/panel/sistema";
import { ACCION, ACCION_TINTA, BOTON_ACCION, BOTON_LEALTAD } from "../sistema-lealtad";
import {
  activadoresParaModo,
  CANALES,
  condicionesParaModo,
  definicionDeActivador,
  definicionDeCanal,
  definicionDeCondicion,
  ETIQUETA_OP,
  type DefinicionActivador,
} from "@/lib/lealtad/impulsos/catalogo";
import { contextoDeEjemplo, variablesParaModo, vistaPrevia } from "@/lib/lealtad/impulsos/mensaje";
import { validarImpulso } from "@/lib/lealtad/impulsos/validacion";
import type { Condicion, ConfigActivador, EntradaImpulso, Horario } from "@/lib/lealtad/impulsos/tipos";
import { cambiarEstadoImpulso, guardarImpulso } from "./impulsos-actions";
import type { ContextoDeImpulsos, ImpulsoVista } from "./impulsos-vista";

/**
 * EL CONSTRUCTOR DE UN IMPULSO.
 *
 * Una sola pantalla en seis bloques —qué lo dispara, a quién le toca, cuándo sale, por dónde y con qué
 * texto, y qué falta para activarlo—, con la vista previa del mensaje al lado y la validación en vivo.
 * La validación es la MISMA función que corre el servidor (`validarImpulso`): lo que acá se ve bien, allá
 * pasa; y nada que acá se vea mal llega a guardarse.
 *
 * Todo lo que se puede elegir sale del catálogo (`catalogo.ts`): lo que hoy no se puede cumplir aparece
 * apagado y diciendo QUÉ falta, en vez de esconderse o de prometerse.
 */

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
const UNIDADES = [
  { id: "minutos", etiqueta: "minutos", factor: 1 },
  { id: "horas", etiqueta: "horas", factor: 60 },
  { id: "dias", etiqueta: "días", factor: 1440 },
] as const;
type IdUnidad = (typeof UNIDADES)[number]["id"];
const ATAJOS_DE_RETRASO = [
  { etiqueta: "Al instante", minutos: 0 },
  { etiqueta: "1 min", minutos: 1 },
  { etiqueta: "5 min", minutos: 5 },
  { etiqueta: "10 min", minutos: 10 },
  { etiqueta: "15 min", minutos: 15 },
  { etiqueta: "30 min", minutos: 30 },
] as const;

function unidadInicial(minutos: number): { valor: number; unidad: IdUnidad } {
  if (minutos > 0 && minutos % 1440 === 0) return { valor: minutos / 1440, unidad: "dias" };
  if (minutos > 0 && minutos % 60 === 0) return { valor: minutos / 60, unidad: "horas" };
  return { valor: minutos, unidad: "minutos" };
}

function entradaVacia(modo: string): EntradaImpulso {
  const primero = activadoresParaModo(modo).disponibles[0];
  return {
    nombre: "",
    descripcion: null,
    activador: primero?.id ?? "inscripcion",
    activador_config: configPorDefecto(primero ?? null),
    condiciones: [],
    canal: "wallet",
    titulo: "",
    cuerpo: "",
    retraso_minutos: 0,
    horario: { modo: "inmediato" },
    vigente_desde: null,
    vigente_hasta: null,
    espera_minima_horas: 0,
    plantilla: null,
  };
}

function entradaDe(i: ImpulsoVista): EntradaImpulso {
  return {
    nombre: i.nombre,
    descripcion: i.descripcion,
    activador: i.activador,
    activador_config: { ...i.activador_config },
    condiciones: i.condiciones.map((c) => ({ ...c })),
    canal: i.canal,
    titulo: i.titulo,
    cuerpo: i.cuerpo,
    retraso_minutos: i.retraso_minutos,
    horario: { ...i.horario },
    vigente_desde: i.vigente_desde,
    vigente_hasta: i.vigente_hasta,
    espera_minima_horas: i.espera_minima_horas,
    plantilla: i.plantilla,
  };
}

function configPorDefecto(def: DefinicionActivador | null): ConfigActivador {
  const config: ConfigActivador = {};
  for (const p of def?.parametros ?? []) config[p.campo] = p.defecto;
  return config;
}

export default function ImpulsosEditor({
  ranchoId,
  contexto,
  inicial,
  onCerrar,
  onGuardado,
}: {
  ranchoId: string;
  contexto: ContextoDeImpulsos;
  /** null = uno nuevo en blanco. */
  inicial: ImpulsoVista | null;
  onCerrar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const [form, setForm] = useState<EntradaImpulso>(() => (inicial ? entradaDe(inicial) : entradaVacia(contexto.modo)));
  const [retraso, setRetraso] = useState(() => unidadInicial(inicial?.retraso_minutos ?? 0));
  const [sellosTexto, setSellosTexto] = useState(() => (inicial?.activador_config.sellos ?? []).join(", "));
  const [ocupado, iniciar] = useTransition();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [problemasServidor, setProblemasServidor] = useState<{ campo: string; mensaje: string }[]>([]);
  const refTitulo = useRef<HTMLInputElement>(null);
  const refCuerpo = useRef<HTMLTextAreaElement>(null);
  const ultimoCampo = useRef<"titulo" | "cuerpo">("cuerpo");

  const editandoActivo = inicial?.estado === "activo";
  const def = definicionDeActivador(form.activador);
  const canal = definicionDeCanal(form.canal);
  const { disponibles, noDisponibles } = useMemo(() => activadoresParaModo(contexto.modo), [contexto.modo]);
  const condicionesPosibles = useMemo(() => condicionesParaModo(contexto.modo), [contexto.modo]);
  const variables = useMemo(() => variablesParaModo(contexto.modo), [contexto.modo]);

  const validacion = useMemo(
    () =>
      validarImpulso(form, {
        modo: contexto.modo,
        esFoorkie: contexto.esFoorkie,
        tieneRecompensa: contexto.tieneRecompensa,
        hoy: contexto.hoy,
      }),
    [form, contexto],
  );

  const vista = useMemo(
    () =>
      canal
        ? vistaPrevia(
            { titulo: form.titulo, cuerpo: form.cuerpo },
            canal,
            contextoDeEjemplo(contexto.modo, contexto.nombreNegocio || "Tu negocio", contexto.nombrePrograma),
          )
        : null,
    [canal, form.titulo, form.cuerpo, contexto],
  );

  function cambiar(parcial: Partial<EntradaImpulso>) {
    setForm((f) => ({ ...f, ...parcial }));
  }

  function elegirActivador(id: string) {
    const nuevo = definicionDeActivador(id);
    cambiar({ activador: id, activador_config: configPorDefecto(nuevo) });
    setSellosTexto("");
  }

  function cambiarParametro(campo: "dias" | "ventana_dias" | "faltan", valor: string) {
    const n = Number(valor);
    setForm((f) => ({ ...f, activador_config: { ...f.activador_config, [campo]: Number.isFinite(n) ? Math.trunc(n) : 0 } }));
  }

  function cambiarSellos(texto: string) {
    setSellosTexto(texto);
    const lista = texto
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map(Number)
      .filter((n) => n >= 1 && n <= 1000);
    setForm((f) => ({ ...f, activador_config: { ...f.activador_config, sellos: [...new Set(lista)].slice(0, 20) } }));
  }

  function cambiarRetraso(valor: number, unidad: IdUnidad) {
    const factor = UNIDADES.find((u) => u.id === unidad)?.factor ?? 1;
    const v = Number.isFinite(valor) ? Math.max(0, Math.trunc(valor)) : 0;
    setRetraso({ valor: v, unidad });
    cambiar({ retraso_minutos: Math.min(525_600, v * factor) });
  }

  function atajoDeRetraso(minutos: number) {
    const u = unidadInicial(minutos);
    setRetraso(u);
    cambiar({ retraso_minutos: minutos });
  }

  function cambiarHorario(parcial: Partial<Horario>) {
    setForm((f) => ({ ...f, horario: { ...f.horario, ...parcial } }));
  }

  function elegirModoHorario(modo: Horario["modo"]) {
    if (modo === "inmediato") cambiar({ horario: { modo } });
    else if (modo === "hora_exacta") cambiar({ horario: { modo, hora: form.horario.hora ?? "09:00", dias: form.horario.dias } });
    else
      cambiar({
        horario: {
          modo,
          desde: form.horario.desde ?? "09:00",
          hasta: form.horario.hasta ?? "20:00",
          dias: form.horario.dias,
          siguiente_ventana: form.horario.siguiente_ventana ?? true,
        },
      });
  }

  function alternarDia(dia: number) {
    const actuales = new Set(form.horario.dias ?? []);
    if (actuales.has(dia)) actuales.delete(dia);
    else actuales.add(dia);
    const lista = [...actuales].sort();
    cambiarHorario({ dias: lista.length === 0 || lista.length === 7 ? undefined : lista });
  }

  function agregarCondicion() {
    const primera = condicionesPosibles[0];
    if (!primera || form.condiciones.length >= 12) return;
    cambiar({ condiciones: [...form.condiciones, valorInicialDeCondicion(primera.id)] });
  }

  function cambiarCondicion(i: number, nueva: Condicion) {
    cambiar({ condiciones: form.condiciones.map((c, j) => (j === i ? nueva : c)) });
  }

  function quitarCondicion(i: number) {
    cambiar({ condiciones: form.condiciones.filter((_, j) => j !== i) });
  }

  /** Mete la variable donde está el cursor, en el título o en el mensaje (el último campo tocado). */
  function insertarVariable(id: string) {
    const texto = id === "nombre_cliente" ? "{{nombre_cliente|}}" : `{{${id}}}`;
    const campo = ultimoCampo.current;
    const el = campo === "titulo" ? refTitulo.current : refCuerpo.current;
    const actual = campo === "titulo" ? form.titulo : form.cuerpo;
    const inicio = el?.selectionStart ?? actual.length;
    const fin = el?.selectionEnd ?? actual.length;
    const nuevo = actual.slice(0, inicio) + texto + actual.slice(fin);
    cambiar(campo === "titulo" ? { titulo: nuevo } : { cuerpo: nuevo });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(inicio + texto.length, inicio + texto.length);
    });
  }

  function guardar(activar: boolean) {
    setErrorServidor(null);
    setProblemasServidor([]);
    iniciar(async () => {
      const res = await guardarImpulso(ranchoId, contexto.programaId, inicial?.id ?? null, form);
      if (!res.ok) {
        setErrorServidor(res.motivo);
        setProblemasServidor(res.problemas ?? []);
        return;
      }
      if (activar) {
        const r2 = await cambiarEstadoImpulso(ranchoId, contexto.programaId, res.datos.id, "activo");
        if (!r2.ok) {
          // Quedó guardado como borrador: se dice, y se muestra qué impide activarlo.
          setErrorServidor(`Se guardó, pero no se pudo activar: ${r2.motivo}`);
          setProblemasServidor(r2.problemas ?? []);
          return;
        }
        onGuardado("Impulso activado. Desde ahora le llega a los clientes que cumplan lo que pusiste.");
        return;
      }
      onGuardado(inicial ? "Cambios guardados." : "Guardado como borrador. Revisalo y activalo cuando esté listo.");
    });
  }

  const bloqueGuardar = !validacion.puedeGuardar || (editandoActivo && !validacion.puedeActivar);
  const motivosParaGuardar = validacion.problemas;
  const errorDe = (campo: string) => motivosParaGuardar.find((p) => p.campo === campo)?.mensaje ?? null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[16px] font-extrabold text-aventurea-ink">{inicial ? "Editar impulso" : "Nuevo impulso"}</h3>
          <p className={CUERPO_SUAVE}>
            {editandoActivo
              ? "Este impulso está activo: los cambios valen para los mensajes que todavía no salieron."
              : "Mientras sea un borrador no le llega nada a nadie."}
          </p>
        </div>
        <button type="button" onClick={onCerrar} className={BOTON_LEALTAD} disabled={ocupado}>
          Volver a la lista
        </button>
      </div>

      {!contexto.tarjetaOpera && (
        <p className={`${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.aviso}`}>
          La tarjeta no está activa en este momento: aunque actives impulsos, no se va a mandar ningún mensaje hasta que lo esté.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.9fr)]">
        <div className="flex flex-col gap-3.5">
          {/* ── 1 · IDENTIDAD ── */}
          <Card eyebrow="Paso 1" titulo="¿Cómo se llama?" nivel="h3">
            <label className="flex flex-col gap-1">
              <span className={ROTULO_CAMPO}>Nombre (solo lo ves vos)</span>
              <input
                type="text"
                className={CAMPO_PANEL}
                value={form.nombre}
                maxLength={80}
                onChange={(e) => cambiar({ nombre: e.target.value })}
                placeholder="Ej.: Bienvenida"
                aria-invalid={Boolean(errorDe("nombre"))}
              />
              {errorDe("nombre") && <span className="text-[11.5px] font-bold text-red-700">{errorDe("nombre")}</span>}
            </label>
            <label className="mt-2.5 flex flex-col gap-1">
              <span className={ROTULO_CAMPO}>Para qué sirve (opcional)</span>
              <input
                type="text"
                className={CAMPO_PANEL}
                value={form.descripcion ?? ""}
                maxLength={240}
                onChange={(e) => cambiar({ descripcion: e.target.value || null })}
                placeholder="Ej.: Le damos las gracias a quien se une"
              />
            </label>
          </Card>

          {/* ── 2 · QUÉ LO DISPARA ── */}
          <Card eyebrow="Paso 2" titulo="¿Cuándo se dispara?" nivel="h3">
            <label className="flex flex-col gap-1">
              <span className={ROTULO_CAMPO}>Cuando…</span>
              <select className={CAMPO_PANEL} value={form.activador} onChange={(e) => elegirActivador(e.target.value)}>
                {disponibles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.etiqueta}
                  </option>
                ))}
                {noDisponibles.length > 0 && (
                  <optgroup label="Todavía no disponibles">
                    {noDisponibles.map((a) => (
                      <option key={a.id} value={a.id} disabled>
                        {a.etiqueta}
                      </option>
                    ))}
                  </optgroup>
                )}
                {def && !disponibles.some((a) => a.id === def.id) && !noDisponibles.some((a) => a.id === def.id) && (
                  <option value={def.id}>{def.etiqueta} (no aplica a este tipo de tarjeta)</option>
                )}
              </select>
            </label>
            {errorDe("activador") && <p className="mt-1 text-[11.5px] font-bold text-red-700">{errorDe("activador")}</p>}
            {def && (
              <p className={`mt-2 ${CUERPO_SUAVE}`}>
                {def.descripcion}
                {def.nota ? ` ${def.nota}` : ""}
              </p>
            )}

            {(def?.parametros ?? []).map((p) => (
              <label key={p.campo} className="mt-2.5 flex flex-col gap-1">
                <span className={ROTULO_CAMPO}>
                  {p.etiqueta} ({p.unidad})
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  className={CAMPO_PANEL}
                  min={p.min}
                  max={p.max}
                  value={form.activador_config[p.campo] ?? p.defecto}
                  onChange={(e) => cambiarParametro(p.campo, e.target.value)}
                />
                <span className="text-[11px] text-aventurea-ink-soft">{p.ayuda}</span>
                {errorDe(`activador_config.${p.campo}`) && (
                  <span className="text-[11.5px] font-bold text-red-700">{errorDe(`activador_config.${p.campo}`)}</span>
                )}
              </label>
            ))}

            {form.activador === "sello_registrado" && (
              <label className="mt-2.5 flex flex-col gap-1">
                <span className={ROTULO_CAMPO}>Solo al llegar a estos sellos (opcional)</span>
                <input
                  type="text"
                  className={CAMPO_PANEL}
                  value={sellosTexto}
                  onChange={(e) => cambiarSellos(e.target.value)}
                  placeholder="Ej.: 3, 5 — vacío = en cada sello"
                />
                <span className="text-[11px] text-aventurea-ink-soft">
                  Separalos con comas. Para no saturar a tus clientes conviene elegir los sellos que importan.
                </span>
              </label>
            )}
          </Card>

          {/* ── 3 · CONDICIONES ── */}
          <Card eyebrow="Paso 3" titulo="¿A quién le toca? (opcional)" nivel="h3">
            <p className={CUERPO_SUAVE}>
              Sin condiciones, le llega a todos los clientes a los que se les cumpla el paso anterior. Si agregás condiciones, se
              tienen que cumplir todas, y se revisan justo antes de mandar con los datos de ese momento.
            </p>
            <div className="mt-2.5 flex flex-col gap-2">
              {form.condiciones.map((c, i) => (
                <FilaCondicion
                  key={i}
                  condicion={c}
                  modo={contexto.modo}
                  posibles={condicionesPosibles.map((p) => p.id)}
                  error={errorDe(`condiciones.${i}`)}
                  onCambiar={(nueva) => cambiarCondicion(i, nueva)}
                  onQuitar={() => quitarCondicion(i)}
                />
              ))}
              {form.condiciones.length < 12 && condicionesPosibles.length > 0 && (
                <button type="button" onClick={agregarCondicion} className={BOTON_LEALTAD}>
                  + Agregar condición
                </button>
              )}
            </div>
          </Card>

          {/* ── 4 · CUÁNDO SALE ── */}
          <Card eyebrow="Paso 4" titulo="¿Cuándo sale el mensaje?" nivel="h3">
            <p className={ROTULO_CAMPO}>Esperar después del hecho</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ATAJOS_DE_RETRASO.map((a) => (
                <button
                  key={a.minutos}
                  type="button"
                  onClick={() => atajoDeRetraso(a.minutos)}
                  aria-pressed={form.retraso_minutos === a.minutos}
                  className={`${BOTON_LEALTAD} !h-8 !px-3 !text-[12px] ${form.retraso_minutos === a.minutos ? "!border-aventurea-navy" : ""}`}
                >
                  {a.etiqueta}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={`${CAMPO_PANEL} !w-28`}
                value={retraso.valor}
                onChange={(e) => cambiarRetraso(Number(e.target.value), retraso.unidad)}
                aria-label="Cuánto esperar"
              />
              <select
                className={`${CAMPO_PANEL} !w-32`}
                value={retraso.unidad}
                onChange={(e) => cambiarRetraso(retraso.valor, e.target.value as IdUnidad)}
                aria-label="Unidad de espera"
              >
                {UNIDADES.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            {errorDe("retraso_minutos") && <p className="mt-1 text-[11.5px] font-bold text-red-700">{errorDe("retraso_minutos")}</p>}

            <p className={`mt-4 ${ROTULO_CAMPO}`}>Horario de envío (hora de tu negocio: {contexto.zona})</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(
                [
                  ["inmediato", "A cualquier hora"],
                  ["hora_exacta", "A una hora exacta"],
                  ["ventana", "Dentro de una franja"],
                ] as const
              ).map(([id, etiqueta]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => elegirModoHorario(id)}
                  aria-pressed={form.horario.modo === id}
                  className={`${BOTON_LEALTAD} !h-8 !px-3 !text-[12px] ${form.horario.modo === id ? "!border-aventurea-navy" : ""}`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            {form.horario.modo === "hora_exacta" && (
              <label className="mt-2 flex flex-col gap-1">
                <span className={ROTULO_CAMPO}>Hora</span>
                <input
                  type="time"
                  className={`${CAMPO_PANEL} !w-36`}
                  value={form.horario.hora ?? "09:00"}
                  onChange={(e) => cambiarHorario({ hora: e.target.value })}
                />
              </label>
            )}
            {form.horario.modo === "ventana" && (
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className={ROTULO_CAMPO}>Desde</span>
                  <input
                    type="time"
                    className={`${CAMPO_PANEL} !w-36`}
                    value={form.horario.desde ?? "09:00"}
                    onChange={(e) => cambiarHorario({ desde: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={ROTULO_CAMPO}>Hasta</span>
                  <input
                    type="time"
                    className={`${CAMPO_PANEL} !w-36`}
                    value={form.horario.hasta ?? "20:00"}
                    onChange={(e) => cambiarHorario({ hasta: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 pb-2.5 text-[12.5px] text-aventurea-ink">
                  <input
                    type="checkbox"
                    checked={form.horario.siguiente_ventana ?? true}
                    onChange={(e) => cambiarHorario({ siguiente_ventana: e.target.checked })}
                  />
                  Si cae afuera, esperar a la próxima franja (si no, no se manda)
                </label>
              </div>
            )}
            {form.horario.modo !== "inmediato" && (
              <div className="mt-3">
                <p className={ROTULO_CAMPO}>Días permitidos {form.horario.dias ? "" : "(todos)"}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {DIAS.map((nombre, dia) => {
                    const marcado = !form.horario.dias || form.horario.dias.includes(dia);
                    return (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => alternarDia(dia)}
                        aria-pressed={marcado}
                        className={`${BOTON_LEALTAD} !h-8 !px-3 !text-[12px] ${marcado ? "!border-aventurea-navy" : "opacity-60"}`}
                      >
                        {nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {errorDe("horario") && <p className="mt-1 text-[11.5px] font-bold text-red-700">{errorDe("horario")}</p>}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className={ROTULO_CAMPO}>Vigente desde (opcional)</span>
                <input
                  type="date"
                  className={CAMPO_PANEL}
                  value={form.vigente_desde ?? ""}
                  onChange={(e) => cambiar({ vigente_desde: e.target.value || null })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={ROTULO_CAMPO}>Vigente hasta (opcional)</span>
                <input
                  type="date"
                  className={CAMPO_PANEL}
                  value={form.vigente_hasta ?? ""}
                  onChange={(e) => cambiar({ vigente_hasta: e.target.value || null })}
                />
                {errorDe("vigente_hasta") && <span className="text-[11.5px] font-bold text-red-700">{errorDe("vigente_hasta")}</span>}
              </label>
              <label className="flex flex-col gap-1">
                <span className={ROTULO_CAMPO}>Espera entre dos iguales (horas)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className={CAMPO_PANEL}
                  value={form.espera_minima_horas}
                  onChange={(e) => cambiar({ espera_minima_horas: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
                />
                <span className="text-[11px] text-aventurea-ink-soft">
                  Para que un mismo cliente no reciba este impulso dos veces seguidas. 0 = sin límite.
                </span>
              </label>
            </div>
            <p className={`mt-2 ${CUERPO_SUAVE}`}>
              Cada cliente recibe como máximo 3 mensajes de impulsos por día, sin importar cuántos impulsos tengas activos.
            </p>
          </Card>

          {/* ── 5 · CANAL Y MENSAJE ── */}
          <Card eyebrow="Paso 5" titulo="¿Por dónde y qué le decís?" nivel="h3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CANALES.map((c) => {
                const elegido = form.canal === c.id;
                const sinSalida = c.id === "correo" && contexto.esFoorkie;
                const apagado = !c.disponible || sinSalida;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={apagado}
                    onClick={() => cambiar({ canal: c.id })}
                    aria-pressed={elegido}
                    className={`${RADIO_TILE} border p-3 text-left transition-colors ${
                      elegido ? "border-aventurea-navy bg-aventurea-cream-2" : "border-aventurea-line"
                    } ${apagado ? "cursor-not-allowed border-dashed opacity-60" : "hover:border-aventurea-navy"}`}
                  >
                    <span className="block text-[13px] font-extrabold text-aventurea-ink">{c.etiqueta}</span>
                    <span className="mt-0.5 block text-[11.5px] text-aventurea-ink-soft">
                      {apagado
                        ? sinSalida
                          ? "Las tarjetas de Foorkie no mandan correos desde acá: los manda Foorkie."
                          : `No disponible: ${c.falta ?? "falta configurar el proveedor."}`
                        : c.descripcion}
                    </span>
                  </button>
                );
              })}
            </div>
            {canal && canal.limites.length > 0 && (
              <ul className="mt-2.5 list-disc space-y-1 pl-5 text-[11.5px] text-aventurea-ink-soft">
                {canal.limites.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            {form.canal === "correo" && !contexto.correoConfigurado && (
              <p className={`mt-2.5 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.aviso}`}>
                El proveedor de correo todavía no está configurado en el servidor: los correos no van a salir hasta que lo esté.
              </p>
            )}
            {errorDe("canal") && <p className="mt-1.5 text-[11.5px] font-bold text-red-700">{errorDe("canal")}</p>}

            <label className="mt-3.5 flex flex-col gap-1">
              <span className={ROTULO_CAMPO}>
                Título {canal ? `(hasta ${Math.min(60, canal.tituloMax)} caracteres)` : ""}
              </span>
              <input
                ref={refTitulo}
                type="text"
                className={CAMPO_PANEL}
                value={form.titulo}
                maxLength={60}
                onFocus={() => (ultimoCampo.current = "titulo")}
                onChange={(e) => cambiar({ titulo: e.target.value })}
                aria-invalid={Boolean(errorDe("titulo"))}
              />
              {errorDe("titulo") && <span className="text-[11.5px] font-bold text-red-700">{errorDe("titulo")}</span>}
            </label>
            <label className="mt-2.5 flex flex-col gap-1">
              <span className={ROTULO_CAMPO}>
                Mensaje {canal ? `(hasta ${Math.min(600, canal.cuerpoMax)} caracteres)` : ""}
              </span>
              <textarea
                ref={refCuerpo}
                className={`${CAMPO_PANEL} min-h-[96px]`}
                value={form.cuerpo}
                maxLength={600}
                onFocus={() => (ultimoCampo.current = "cuerpo")}
                onChange={(e) => cambiar({ cuerpo: e.target.value })}
                aria-invalid={Boolean(errorDe("cuerpo"))}
              />
              {errorDe("cuerpo") && <span className="text-[11.5px] font-bold text-red-700">{errorDe("cuerpo")}</span>}
            </label>

            <p className={`mt-2.5 ${ROTULO_CAMPO}`}>Datos del cliente que podés insertar</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  title={v.descripcion}
                  onClick={() => insertarVariable(v.id)}
                  disabled={v.requiereRecompensa === true && !contexto.tieneRecompensa}
                  className={`${BOTON_LEALTAD} !h-8 !px-2.5 !text-[11.5px]`}
                >
                  {v.etiqueta}
                </button>
              ))}
            </div>
            <p className={`mt-1.5 ${CUERPO_SUAVE}`}>
              Si a un cliente le falta un dato y no pusiste un alternativo, ese mensaje no se manda (nunca sale «Hola , ya vas por…»).
              Para el nombre: {"{{nombre_cliente|amigo}}"}.
            </p>
          </Card>
        </div>

        {/* ── COLUMNA DE LA DERECHA: vista previa y qué falta ── */}
        <div className="flex flex-col gap-3.5 xl:sticky xl:top-3 xl:self-start">
          <Card eyebrow="Así se ve" titulo="Vista previa" nivel="h3">
            {vista && canal ? (
              <>
                {canal.id === "wallet" ? (
                  <div className="rounded-2xl bg-black/30 p-3">
                    <div className="rounded-2xl bg-white/95 p-3 text-aventurea-ink shadow-elevado" style={{ color: "#0a1226" }}>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide opacity-60">{contexto.nombreNegocio || "Tu negocio"} · Wallet</p>
                      <p className="mt-1 text-[13.5px] font-extrabold">{vista.titulo || "Título del mensaje"}</p>
                      <p className="mt-0.5 text-[12.5px] leading-snug">{vista.cuerpo || "El mensaje aparece acá."}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-black/30 p-3">
                    <div className="rounded-xl bg-white p-4" style={{ color: "#0a1226" }}>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide opacity-60">{contexto.nombreNegocio || "Tu negocio"}</p>
                      <p className="mt-1 text-[16px] font-extrabold">{vista.titulo || "Título del correo"}</p>
                      <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed">{vista.cuerpo || "El mensaje aparece acá."}</p>
                      <p className="mt-3 border-t border-black/10 pt-2 text-[10.5px] opacity-60">Recibís este correo porque sos cliente… Darme de baja.</p>
                    </div>
                  </div>
                )}
                <p className={`mt-2 ${CUERPO_SUAVE}`}>
                  Con datos de ejemplo (María, {contexto.modo === "sellos" ? "4 de 5 sellos" : contexto.modo === "cashback" ? "₡1 250 de saldo" : "180 puntos"}). Cada cliente ve los suyos.
                </p>
                {vista.recortado && (
                  <p className={`mt-2 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.aviso}`}>
                    El texto es más largo que lo que admite este canal: se acorta al enviarse.
                  </p>
                )}
                {vista.faltantes.length > 0 && (
                  <p className={`mt-2 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.aviso}`}>
                    Faltan datos para armar el mensaje: {vista.faltantes.join(", ")}.
                  </p>
                )}
              </>
            ) : (
              <CardVacia>Elegí un canal para ver cómo queda.</CardVacia>
            )}
          </Card>

          <Card eyebrow="Antes de activar" titulo="Revisión" nivel="h3">
            {validacion.problemas.length === 0 && validacion.avisos.length === 0 ? (
              <p className={`${RADIO_TILE} px-3 py-2 text-[12.5px] font-bold ${ESTADO_AVISO.exito}`}>Todo en orden: se puede activar.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {validacion.problemas.map((p, i) => (
                  <p key={`p${i}`} className={`${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${p.bloquea === "guardar" ? ESTADO_AVISO.alerta : ESTADO_AVISO.aviso}`}>
                    {p.bloquea === "guardar" ? "Para guardar: " : "Para activar: "}
                    {p.mensaje}
                  </p>
                ))}
                {validacion.avisos.map((a, i) => (
                  <p key={`a${i}`} className={`${RADIO_TILE} px-3 py-2 text-[12px] ${ESTADO_AVISO.info}`}>
                    {a}
                  </p>
                ))}
              </div>
            )}
            {errorServidor && (
              <p role="alert" className={`mt-2.5 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.alerta}`}>
                {errorServidor}
                {problemasServidor.length > 0 && (
                  <span className="mt-1 block font-semibold">{problemasServidor.map((p) => p.mensaje).join(" · ")}</span>
                )}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={BOTON_ACCION}
                style={{ background: ACCION, color: ACCION_TINTA }}
                disabled={ocupado || bloqueGuardar}
                onClick={() => guardar(false)}
              >
                {ocupado ? "Guardando…" : inicial ? "Guardar cambios" : "Guardar borrador"}
              </button>
              {!editandoActivo && (
                <button
                  type="button"
                  className={BOTON_LEALTAD}
                  disabled={ocupado || !validacion.puedeActivar}
                  onClick={() => guardar(true)}
                  title={validacion.puedeActivar ? "Guarda y deja el impulso funcionando" : "Todavía falta algo: mirá la revisión"}
                >
                  Guardar y activar
                </button>
              )}
            </div>
            <p className={`mt-2 ${CUERPO_SUAVE}`}>Al activarlo, solo toma lo que pase desde ese momento: nunca le escribe a nadie por algo que ya pasó.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  UNA CONDICIÓN
// ═══════════════════════════════════════════════════════════════════

function valorInicialDeCondicion(campo: Condicion["campo"]): Condicion {
  const def = definicionDeCondicion(campo);
  if (def?.tipo === "booleano") return { campo, op: "es", valor: true };
  if (def?.tipo === "opciones") return { campo, op: "es", valor: def.opciones?.[0]?.valor ?? "" };
  return { campo, op: def?.ops[0] ?? "gte", valor: def?.min ?? 0 };
}

function FilaCondicion({
  condicion,
  modo,
  posibles,
  error,
  onCambiar,
  onQuitar,
}: {
  condicion: Condicion;
  modo: string;
  posibles: Condicion["campo"][];
  error: string | null;
  onCambiar: (c: Condicion) => void;
  onQuitar: () => void;
}) {
  const def = definicionDeCondicion(condicion.campo);
  return (
    <div className={`${RADIO_TILE} border border-aventurea-line p-2.5`}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${CAMPO_PANEL} !w-auto min-w-[160px] flex-1`}
          value={condicion.campo}
          aria-label="Dato del cliente"
          onChange={(e) => onCambiar(valorInicialDeCondicion(e.target.value as Condicion["campo"]))}
        >
          {posibles.map((id) => (
            <option key={id} value={id}>
              {definicionDeCondicion(id)?.etiqueta(modo) ?? id}
            </option>
          ))}
        </select>

        {def?.tipo === "numero" && (
          <>
            <select
              className={`${CAMPO_PANEL} !w-auto`}
              value={condicion.op}
              aria-label="Comparación"
              onChange={(e) => onCambiar({ ...condicion, op: e.target.value as Condicion["op"] })}
            >
              {def.ops.map((op) => (
                <option key={op} value={op}>
                  {ETIQUETA_OP[op]}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              className={`${CAMPO_PANEL} !w-28`}
              min={def.min}
              max={def.max}
              value={typeof condicion.valor === "number" ? condicion.valor : 0}
              aria-label="Valor"
              onChange={(e) => onCambiar({ ...condicion, valor: Number(e.target.value) || 0 })}
            />
          </>
        )}
        {def?.tipo === "booleano" && (
          <select
            className={`${CAMPO_PANEL} !w-auto`}
            value={condicion.valor === true ? "si" : "no"}
            aria-label="Valor"
            onChange={(e) => onCambiar({ ...condicion, op: "es", valor: e.target.value === "si" })}
          >
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        )}
        {def?.tipo === "opciones" && (
          <select
            className={`${CAMPO_PANEL} !w-auto`}
            value={String(condicion.valor)}
            aria-label="Valor"
            onChange={(e) => onCambiar({ ...condicion, op: "es", valor: e.target.value })}
          >
            {(def.opciones ?? []).map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        )}
        <button type="button" onClick={onQuitar} className={`${BOTON_LEALTAD} !h-9 !px-3`} aria-label="Quitar condición">
          Quitar
        </button>
      </div>
      {def && <p className="mt-1 text-[11px] text-aventurea-ink-soft">{def.ayuda}</p>}
      {error && <p className="mt-1 text-[11.5px] font-bold text-red-700">{error}</p>}
    </div>
  );
}
