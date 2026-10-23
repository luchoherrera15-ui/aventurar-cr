"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardVacia, Metrica, PildoraEstado } from "@/components/panel/piezas";
import { CAMPO_PANEL, CUERPO_SUAVE, ESTADO_AVISO, GRILLA_METRICAS, RADIO_TILE, type EstadoPanel } from "@/components/panel/sistema";
import { ACTIVADORES, definicionDeActivador, definicionDeCanal } from "@/lib/lealtad/impulsos/catalogo";
import { ACCION, ACCION_TINTA, BOTON_ACCION, BOTON_LEALTAD } from "../sistema-lealtad";
import {
  cambiarEstadoImpulso,
  crearDesdePlantilla,
  duplicarImpulso,
  eliminarImpulso,
} from "./impulsos-actions";
import ImpulsosEditor from "./impulsos-editor";
import ImpulsosHistorial from "./impulsos-historial";
import type { ContextoDeImpulsos, ImpulsoVista, PlantillaVista } from "./impulsos-vista";
import type { EstadoImpulso } from "@/lib/lealtad/impulsos/tipos";

/**
 * IMPULSOS AUTOMÁTICOS — la pantalla.
 *
 * Tres vistas en una: la lista (con resumen, búsqueda y filtros), el constructor de uno y el historial de
 * mensajes. Los datos reales vienen del servidor (`impulsos-lealtad.tsx`); acá solo se decide qué se ve y se
 * llama a las acciones, y después de cada una se vuelve a pedir la pantalla (`router.refresh`).
 */

const ETIQUETA_ESTADO: Record<EstadoImpulso, string> = {
  borrador: "Borrador",
  activo: "Activo",
  pausado: "Pausado",
  archivado: "Archivado",
};
const TONO_ESTADO: Record<EstadoImpulso, EstadoPanel> = {
  borrador: "neutro",
  activo: "exito",
  pausado: "aviso",
  archivado: "neutro",
};

function textoDeRetraso(minutos: number): string {
  if (minutos <= 0) return "al instante";
  if (minutos % 1440 === 0) return `${minutos / 1440} ${minutos / 1440 === 1 ? "día" : "días"} después`;
  if (minutos % 60 === 0) return `${minutos / 60} ${minutos / 60 === 1 ? "hora" : "horas"} después`;
  return `${minutos} min después`;
}

function textoDeHorario(i: ImpulsoVista): string {
  const h = i.horario;
  if (h.modo === "hora_exacta") return `a las ${h.hora ?? "—"}`;
  if (h.modo === "ventana") return `entre ${h.desde ?? "—"} y ${h.hasta ?? "—"}`;
  return "a cualquier hora";
}

function fechaCorta(iso: string | null, zona: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CR", { timeZone: zona, dateStyle: "medium" }).format(d);
}

type Vista = { tipo: "lista" } | { tipo: "editor"; impulso: ImpulsoVista | null } | { tipo: "historial"; impulsoId: string | null };

export default function ImpulsosPanel({
  ranchoId,
  contexto,
  impulsos,
  plantillas,
}: {
  ranchoId: string;
  contexto: ContextoDeImpulsos;
  impulsos: ImpulsoVista[];
  plantillas: PlantillaVista[];
}) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>({ tipo: "lista" });
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoImpulso | "todos">("todos");
  const [filtroActivador, setFiltroActivador] = useState("todos");
  const [aviso, setAviso] = useState<{ texto: string; tipo: "exito" | "alerta" } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const [claveHistorial, setClaveHistorial] = useState(0);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return impulsos.filter((i) => {
      if (filtroEstado !== "todos" && i.estado !== filtroEstado) return false;
      else if (filtroEstado === "todos" && i.estado === "archivado") return false;
      if (filtroActivador !== "todos" && i.activador !== filtroActivador) return false;
      if (q && !`${i.nombre} ${i.descripcion ?? ""} ${i.titulo}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [impulsos, busqueda, filtroEstado, filtroActivador]);

  const resumen = useMemo(() => {
    let activos = 0;
    let programados = 0;
    let enviados = 0;
    let conProblema = 0;
    for (const i of impulsos) {
      if (i.estado === "activo") activos += 1;
      programados += i.conteo.programada + i.conteo.pendiente + i.conteo.procesando;
      enviados += i.conteo.enviada + i.conteo.entregada;
      conProblema += i.conteo.fallida;
    }
    return { activos, programados, enviados, conProblema };
  }, [impulsos]);

  function refrescar(texto: string, tipo: "exito" | "alerta" = "exito") {
    setAviso({ texto, tipo });
    setClaveHistorial((k) => k + 1);
    router.refresh();
  }

  function correr(accion: () => Promise<{ ok: boolean; motivo?: string; problemas?: { mensaje: string }[] }>, exito: string) {
    setAviso(null);
    iniciar(async () => {
      const res = await accion();
      if (res.ok) refrescar(exito);
      else {
        const extra = res.problemas?.length ? ` ${res.problemas.map((p) => p.mensaje).join(" · ")}` : "";
        setAviso({ texto: (res.motivo ?? "No se pudo completar.") + extra, tipo: "alerta" });
      }
    });
  }

  function cambiarEstado(i: ImpulsoVista, nuevo: "activo" | "pausado" | "archivado" | "borrador") {
    if (nuevo === "archivado" && !window.confirm(`¿Archivar «${i.nombre}»? Los mensajes que esperan salir se cancelan.`)) return;
    correr(
      () => cambiarEstadoImpulso(ranchoId, contexto.programaId, i.id, nuevo),
      nuevo === "activo"
        ? `«${i.nombre}» está activo. Solo toma lo que pase desde ahora.`
        : nuevo === "pausado"
          ? `«${i.nombre}» quedó pausado. Los mensajes que esperaban salir se cancelaron.`
          : nuevo === "archivado"
            ? `«${i.nombre}» quedó archivado.`
            : `«${i.nombre}» volvió a borrador.`,
    );
  }

  function eliminar(i: ImpulsoVista) {
    const salio = i.conteo.enviada + i.conteo.entregada + i.conteo.fallida > 0;
    const pregunta = salio
      ? `«${i.nombre}» ya mandó mensajes, así que no se borra: se archiva y el historial se conserva. ¿Archivarlo?`
      : `¿Eliminar «${i.nombre}»? No tiene mensajes enviados; se borra del todo.`;
    if (!window.confirm(pregunta)) return;
    setAviso(null);
    iniciar(async () => {
      const res = await eliminarImpulso(ranchoId, contexto.programaId, i.id);
      if (res.ok) refrescar(res.datos.resultado === "archivado" ? `«${i.nombre}» se archivó (conserva su historial).` : `«${i.nombre}» se eliminó.`);
      else setAviso({ texto: res.motivo, tipo: "alerta" });
    });
  }

  function usarPlantilla(p: PlantillaVista) {
    setAviso(null);
    iniciar(async () => {
      const res = await crearDesdePlantilla(ranchoId, contexto.programaId, p.id);
      if (!res.ok) {
        setAviso({ texto: res.motivo, tipo: "alerta" });
        return;
      }
      setAviso({ texto: `Se creó «${p.nombre}» como borrador. Leelo, ajustalo a tu voz y activalo cuando esté listo.`, tipo: "exito" });
      router.refresh();
    });
  }

  if (vista.tipo === "editor") {
    return (
      <ImpulsosEditor
        key={vista.impulso?.id ?? "nuevo"}
        ranchoId={ranchoId}
        contexto={contexto}
        inicial={vista.impulso}
        onCerrar={() => setVista({ tipo: "lista" })}
        onGuardado={(mensaje) => {
          setVista({ tipo: "lista" });
          refrescar(mensaje);
        }}
      />
    );
  }

  if (vista.tipo === "historial") {
    return (
      <div className="flex flex-col gap-3.5">
        <div>
          <button type="button" className={BOTON_LEALTAD} onClick={() => setVista({ tipo: "lista" })}>
            ← Volver a los impulsos
          </button>
        </div>
        <ImpulsosHistorial
          ranchoId={ranchoId}
          programaId={contexto.programaId}
          zona={contexto.zona}
          impulsos={impulsos.map((i) => ({ id: i.id, nombre: i.nombre }))}
          impulsoInicial={vista.impulsoId}
          refrescarClave={claveHistorial}
        />
      </div>
    );
  }

  const hayPlantillasUsables = plantillas.some((p) => p.disponible);

  return (
    <div className="flex flex-col gap-3.5">
      <div className={GRILLA_METRICAS}>
        <Metrica rotulo="Activos" valor={String(resumen.activos)} detalle={`de ${impulsos.filter((i) => i.estado !== "archivado").length} impulsos`} />
        <Metrica rotulo="Esperando salir" valor={String(resumen.programados)} detalle="mensajes en la cola" />
        <Metrica rotulo="Enviados" valor={String(resumen.enviados)} detalle="aceptados por el proveedor" />
        <Metrica rotulo="Con problema" valor={String(resumen.conProblema)} detalle={resumen.conProblema > 0 ? "revisá el historial" : "ninguno"} />
      </div>

      {!contexto.tarjetaOpera && (
        <p className={`${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.aviso}`}>
          La tarjeta no está activa en este momento: mientras tanto no sale ningún mensaje automático.
        </p>
      )}
      {aviso && (
        <p
          role={aviso.tipo === "alerta" ? "alert" : "status"}
          className={`${RADIO_TILE} px-3 py-2 text-[12.5px] font-bold ${aviso.tipo === "alerta" ? ESTADO_AVISO.alerta : ESTADO_AVISO.exito}`}
        >
          {aviso.texto}
        </p>
      )}

      <Card
        eyebrow="Mensajes automáticos"
        titulo="Tus impulsos"
        accion={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BOTON_LEALTAD} onClick={() => setVista({ tipo: "historial", impulsoId: null })}>
              Ver historial
            </button>
            <button
              type="button"
              className={BOTON_ACCION}
              style={{ background: ACCION, color: ACCION_TINTA }}
              onClick={() => setVista({ tipo: "editor", impulso: null })}
            >
              + Nuevo impulso
            </button>
          </div>
        }
      >
        <p className={CUERPO_SUAVE}>
          Un impulso es una regla: «cuando pase esto, esperá tanto y mandale este mensaje a ese cliente». Se manda solo, aunque no
          tengas el panel abierto, en el horario de tu negocio ({contexto.zona}) y respetando lo que cada cliente aceptó recibir. Los
          mensajes salen con un atraso de unos minutos: el sistema los revisa cada pocos minutos.
        </p>

        {impulsos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="search"
              className={`${CAMPO_PANEL} !w-auto min-w-[200px] flex-1`}
              placeholder="Buscar por nombre o mensaje…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar impulsos"
            />
            <select
              className={`${CAMPO_PANEL} !w-auto`}
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoImpulso | "todos")}
              aria-label="Filtrar por estado"
            >
              <option value="todos">Todos (sin archivados)</option>
              <option value="activo">Activos</option>
              <option value="borrador">Borradores</option>
              <option value="pausado">Pausados</option>
              <option value="archivado">Archivados</option>
            </select>
            <select
              className={`${CAMPO_PANEL} !w-auto`}
              value={filtroActivador}
              onChange={(e) => setFiltroActivador(e.target.value)}
              aria-label="Filtrar por evento"
            >
              <option value="todos">Cualquier evento</option>
              {ACTIVADORES.filter((a) => a.disponible).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.etiqueta}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3">
          {impulsos.length === 0 ? (
            <CardVacia>
              Todavía no armaste ningún impulso. Empezá por una de las ideas de abajo (quedan como borrador para que las revises) o
              creá uno desde cero.
            </CardVacia>
          ) : visibles.length === 0 ? (
            <CardVacia>Ningún impulso coincide con lo que buscás.</CardVacia>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {visibles.map((i) => (
                <FilaImpulso
                  key={i.id}
                  impulso={i}
                  zona={contexto.zona}
                  ocupado={ocupado}
                  onEditar={() => setVista({ tipo: "editor", impulso: i })}
                  onEstado={(nuevo) => cambiarEstado(i, nuevo)}
                  onDuplicar={() =>
                    correr(() => duplicarImpulso(ranchoId, contexto.programaId, i.id), `Se creó una copia de «${i.nombre}» como borrador.`)
                  }
                  onEliminar={() => eliminar(i)}
                  onHistorial={() => setVista({ tipo: "historial", impulsoId: i.id })}
                />
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card eyebrow="Para arrancar rápido" titulo="Ideas listas para usar" nivel="h3">
        <p className={CUERPO_SUAVE}>
          Ninguna se activa sola: al elegirla se crea un borrador con un texto de ejemplo para tu tipo de tarjeta. Leelo, cambialo a tu
          estilo y activalo cuando quieras.
        </p>
        {!hayPlantillasUsables && <CardVacia>Por ahora no hay ideas disponibles para este tipo de tarjeta.</CardVacia>}
        <ul className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {plantillas.map((p) => (
            <li key={p.id} className={`${RADIO_TILE} flex flex-col justify-between gap-2 border p-3 ${p.disponible ? "border-aventurea-line" : "border-dashed border-aventurea-line opacity-70"}`}>
              <div>
                <p className="text-[13px] font-extrabold text-aventurea-ink">{p.nombre}</p>
                <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">{p.disponible ? p.resumen : `${p.resumen} — No disponible: ${p.motivo ?? "todavía no se puede cumplir."}`}</p>
              </div>
              <div>
                <button type="button" className={BOTON_LEALTAD} disabled={!p.disponible || ocupado} onClick={() => usarPlantilla(p)}>
                  Usar esta idea
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card eyebrow="Con qué contamos hoy" titulo="Qué se puede y qué no (todavía)" nivel="h3">
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {ACTIVADORES.filter((a) => !a.disponible).map((a) => (
            <li key={a.id} className="text-[12px] text-aventurea-ink-soft">
              <span className="font-bold text-aventurea-ink">{a.etiqueta}:</span> {a.noDisponible}
            </li>
          ))}
        </ul>
        <p className={`mt-2.5 ${CUERPO_SUAVE}`}>
          Canales: el Wallet y el correo funcionan. SMS, WhatsApp y notificaciones web todavía no tienen un proveedor conectado, así que no
          se ofrecen.
        </p>
      </Card>
    </div>
  );
}

function FilaImpulso({
  impulso: i,
  zona,
  ocupado,
  onEditar,
  onEstado,
  onDuplicar,
  onEliminar,
  onHistorial,
}: {
  impulso: ImpulsoVista;
  zona: string;
  ocupado: boolean;
  onEditar: () => void;
  onEstado: (nuevo: "activo" | "pausado" | "archivado" | "borrador") => void;
  onDuplicar: () => void;
  onEliminar: () => void;
  onHistorial: () => void;
}) {
  const act = definicionDeActivador(i.activador);
  const canal = definicionDeCanal(i.canal);
  const abiertos = i.conteo.programada + i.conteo.pendiente + i.conteo.procesando;
  const enviados = i.conteo.enviada + i.conteo.entregada;
  const omitidos = i.conteo.omitida;

  return (
    <li className={`${RADIO_TILE} border border-aventurea-line p-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-extrabold text-aventurea-ink">{i.nombre}</p>
          <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">
            {act?.etiqueta ?? i.activador} · {textoDeRetraso(i.retraso_minutos)} · {textoDeHorario(i)} · {canal?.etiqueta ?? i.canal}
          </p>
        </div>
        <PildoraEstado estado={TONO_ESTADO[i.estado]}>{ETIQUETA_ESTADO[i.estado]}</PildoraEstado>
      </div>

      <p className="mt-2 text-[12.5px] text-aventurea-ink">
        <span className="font-bold">{i.titulo}</span> — {i.cuerpo}
      </p>

      <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
        {enviados} enviado{enviados === 1 ? "" : "s"} · {abiertos} esperando · {omitidos} no se mandó{omitidos === 1 ? "" : "s"}
        {i.conteo.fallida > 0 ? ` · ${i.conteo.fallida} con problema` : ""}
        {i.ultimoEnvio ? ` · último envío ${fechaCorta(i.ultimoEnvio, zona)}` : ""}
        {i.vigente_hasta ? ` · vigente hasta ${i.vigente_hasta}` : ""}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {i.estado !== "archivado" && (
          <button type="button" className={`${BOTON_LEALTAD} !h-8 !px-3 !text-[12px]`} onClick={onEditar} disabled={ocupado}>
            Editar
          </button>
        )}
        {(i.estado === "borrador" || i.estado === "pausado") && (
          <button
            type="button"
            className={`${BOTON_ACCION} !h-8 !px-3 !text-[12px]`}
            style={{ background: ACCION, color: ACCION_TINTA }}
            onClick={() => onEstado("activo")}
            disabled={ocupado}
          >
            Activar
          </button>
        )}
        {i.estado === "activo" && (
          <button type="button" className={`${BOTON_LEALTAD} !h-8 !px-3 !text-[12px]`} onClick={() => onEstado("pausado")} disabled={ocupado}>
            Pausar
          </button>
        )}
        <button type="button" className={`${BOTON_LEALTAD} !h-8 !px-3 !text-[12px]`} onClick={onHistorial}>
          Historial
        </button>
        <button type="button" className={`${BOTON_LEALTAD} !h-8 !px-3 !text-[12px]`} onClick={onDuplicar} disabled={ocupado}>
          Duplicar
        </button>
        {i.estado !== "archivado" && i.estado !== "borrador" && (
          <button type="button" className={`${BOTON_LEALTAD} !h-8 !px-3 !text-[12px]`} onClick={() => onEstado("archivado")} disabled={ocupado}>
            Archivar
          </button>
        )}
        <button type="button" className={`${BOTON_LEALTAD} !h-8 !px-3 !text-[12px]`} onClick={onEliminar} disabled={ocupado}>
          Eliminar
        </button>
      </div>
    </li>
  );
}
