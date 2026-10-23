"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Card, CardVacia, PildoraEstado } from "@/components/panel/piezas";
import { CAMPO_PANEL, CUERPO_SUAVE, ESTADO_AVISO, RADIO_TILE, type EstadoPanel } from "@/components/panel/sistema";
import { ESTADOS_TAREA, type EstadoTarea } from "@/lib/lealtad/impulsos/tipos";
import { BOTON_LEALTAD } from "../sistema-lealtad";
import { historialDeImpulsos, reintentarMensaje } from "./impulsos-actions";
import type { FilaHistorial, PaginaDeHistorial } from "./impulsos-vista";

/**
 * EL HISTORIAL: qué se mandó, a quién, cuándo y qué pasó con cada mensaje.
 *
 * «Enviado» quiere decir «el proveedor lo aceptó» (Resend, Apple o Google): ninguno confirma que el cliente
 * lo vio, y la pantalla lo dice. Cada mensaje que no salió muestra POR QUÉ, en español; los que fallaron se
 * pueden reintentar, y los de «resultado incierto» piden confirmar antes (podrían llegar dos veces).
 */

const ETIQUETA: Record<EstadoTarea, string> = {
  programada: "Programado",
  pendiente: "Reintentando",
  procesando: "Enviando",
  enviada: "Enviado",
  entregada: "Entregado",
  omitida: "No se mandó",
  fallida: "Falló",
  cancelada: "Cancelado",
};

const TONO: Record<EstadoTarea, EstadoPanel> = {
  programada: "info",
  pendiente: "aviso",
  procesando: "info",
  enviada: "exito",
  entregada: "exito",
  omitida: "neutro",
  fallida: "alerta",
  cancelada: "neutro",
};

function fechaCorta(iso: string | null, zona: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CR", { timeZone: zona, dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default function ImpulsosHistorial({
  ranchoId,
  programaId,
  zona,
  impulsos,
  impulsoInicial,
  refrescarClave,
}: {
  ranchoId: string;
  programaId: string;
  zona: string;
  impulsos: { id: string; nombre: string }[];
  impulsoInicial: string | null;
  /** Cambia cuando la lista de arriba cambió (se activó o pausó algo): fuerza una relectura. */
  refrescarClave: number;
}) {
  const [impulsoId, setImpulsoId] = useState<string>(impulsoInicial ?? "");
  const [estado, setEstado] = useState<EstadoTarea | "todos">("todos");
  const [pagina, setPagina] = useState(0);
  const [datos, setDatos] = useState<PaginaDeHistorial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await historialDeImpulsos(ranchoId, programaId, { impulsoId: impulsoId || null, estado, pagina });
    if (res.ok) {
      setDatos(res.datos);
      setError(null);
    } else {
      setError(res.motivo);
    }
    setCargando(false);
  }, [ranchoId, programaId, impulsoId, estado, pagina]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const res = await historialDeImpulsos(ranchoId, programaId, { impulsoId: impulsoId || null, estado, pagina });
      if (!vivo) return;
      if (res.ok) {
        setDatos(res.datos);
        setError(null);
      } else {
        setError(res.motivo);
      }
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [ranchoId, programaId, impulsoId, estado, pagina, refrescarClave]);

  function reintentar(fila: FilaHistorial) {
    setAviso(null);
    if (
      fila.reintentoConRiesgo &&
      !window.confirm("No se sabe si este mensaje salió. Si lo reintentás, el cliente podría recibirlo dos veces. ¿Reintentar igual?")
    ) {
      return;
    }
    iniciar(async () => {
      const res = await reintentarMensaje(ranchoId, programaId, fila.id, fila.reintentoConRiesgo);
      setAviso(res.ok ? "Listo: el mensaje vuelve a la cola y sale en los próximos minutos." : res.motivo);
      if (res.ok) await cargar();
    });
  }

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.porPagina)) : 1;

  return (
    <Card eyebrow="Lo que pasó" titulo="Historial de mensajes" nivel="h3">
      <p className={CUERPO_SUAVE}>
        «Enviado» quiere decir que el proveedor aceptó el mensaje (Resend, Apple o Google). Ninguno confirma que el cliente lo haya visto.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          className={`${CAMPO_PANEL} !w-auto min-w-[180px]`}
          value={impulsoId}
          aria-label="Filtrar por impulso"
          onChange={(e) => {
            setPagina(0);
            setImpulsoId(e.target.value);
          }}
        >
          <option value="">Todos los impulsos</option>
          {impulsos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </select>
        <select
          className={`${CAMPO_PANEL} !w-auto min-w-[160px]`}
          value={estado}
          aria-label="Filtrar por estado"
          onChange={(e) => {
            setPagina(0);
            setEstado(e.target.value as EstadoTarea | "todos");
          }}
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS_TAREA.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA[e]}
            </option>
          ))}
        </select>
        <button type="button" className={BOTON_LEALTAD} onClick={() => void cargar()} disabled={cargando}>
          {cargando ? "Cargando…" : "Actualizar"}
        </button>
      </div>

      {aviso && (
        <p className={`mt-2.5 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.info}`} role="status">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className={`mt-2.5 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.alerta}`}>
          {error}
        </p>
      )}

      <div className="mt-3">
        {!datos && cargando ? (
          <p className={CUERPO_SUAVE}>Cargando…</p>
        ) : !datos || datos.filas.length === 0 ? (
          <CardVacia>
            Todavía no hay mensajes en el historial. Cuando un cliente cumpla lo que pide un impulso activo, vas a ver acá qué se le programó y qué pasó.
          </CardVacia>
        ) : (
          <ul className="flex flex-col gap-2">
            {datos.filas.map((f) => (
              <li key={f.id} className={`${RADIO_TILE} border border-aventurea-line p-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold text-aventurea-ink">
                      {f.impulsoNombre} <span className="font-semibold text-aventurea-ink-soft">· {f.cliente}</span>
                    </p>
                    <p className="text-[11.5px] text-aventurea-ink-soft">
                      {f.canal === "wallet" ? "Wallet" : f.canal === "correo" ? "Correo" : f.canal} ·{" "}
                      {f.enviadaEn ? `salió ${fechaCorta(f.enviadaEn, zona)}` : `programado para ${fechaCorta(f.ejecutarEn, zona)}`}
                      {f.intentos > 1 ? ` · ${f.intentos} intentos` : ""}
                    </p>
                  </div>
                  <PildoraEstado estado={TONO[f.estado]}>{ETIQUETA[f.estado]}</PildoraEstado>
                </div>

                {(f.motivoTexto || f.detalle) && f.estado !== "enviada" && f.estado !== "entregada" && (
                  <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
                    {f.motivoTexto}
                    {f.detalle ? ` (${f.detalle})` : ""}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {f.titulo && (
                    <button
                      type="button"
                      className="text-[12px] font-bold text-aventurea-navy hover:underline"
                      onClick={() => setAbierta(abierta === f.id ? null : f.id)}
                      aria-expanded={abierta === f.id}
                    >
                      {abierta === f.id ? "Ocultar mensaje" : "Ver el mensaje"}
                    </button>
                  )}
                  {f.reintentable && (
                    <button type="button" className={`${BOTON_LEALTAD} !h-8 !px-3 !text-[12px]`} disabled={ocupado} onClick={() => reintentar(f)}>
                      Reintentar
                    </button>
                  )}
                </div>
                {abierta === f.id && f.titulo && (
                  <div className="mt-2 rounded-xl bg-black/20 p-3">
                    <p className="text-[12.5px] font-extrabold text-aventurea-ink">{f.titulo}</p>
                    {f.cuerpo && <p className="mt-1 whitespace-pre-line text-[12.5px] text-aventurea-ink">{f.cuerpo}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {datos && datos.total > datos.porPagina && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" className={BOTON_LEALTAD} disabled={pagina === 0 || cargando} onClick={() => setPagina((p) => Math.max(0, p - 1))}>
            ← Anteriores
          </button>
          <span className={CUERPO_SUAVE}>
            Página {pagina + 1} de {totalPaginas} · {datos.total} mensajes
          </span>
          <button
            type="button"
            className={BOTON_LEALTAD}
            disabled={pagina + 1 >= totalPaginas || cargando}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguientes →
          </button>
        </div>
      )}
    </Card>
  );
}
