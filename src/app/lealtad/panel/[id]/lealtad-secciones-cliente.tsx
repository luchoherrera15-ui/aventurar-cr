"use client";

import { useState, useTransition } from "react";
import { marcarCanjeEnPos, revertirMovimiento } from "./lealtad-operar-actions";

/**
 * Las partes interactivas de Actividad e Integraciones: revertir un
 * movimiento y marcar un canje como registrado en el POS. Viven aparte
 * porque sus secciones son componentes de servidor.
 */

const TIPO_CLS: Record<string, string> = {
  ganado: "bg-aventurea-green-light text-aventurea-green",
  canjeado: "bg-aventurea-sky-light text-aventurea-orange-dark",
  ajuste: "bg-aventurea-cream-2 text-aventurea-ink-soft",
};

/** Una fila del libro, ya resuelta en el servidor (nombres incluidos). */
export type FilaLibro = {
  transaccionId: string;
  miembroId: string;
  nombre: string;
  tipo: string;
  puntos: number;
  motivo: string;
  saldoPosterior: number | null;
  esReversion: boolean;
  porQuien: string | null;
  fecha: string;
  /** YYYY-MM-DD (hora CR), para el filtro por fechas. */
  fechaISO: string;
};

/**
 * El libro con sus controles: buscar por nombre (cliente u operador),
 * acotar por fechas, y el contador de clientes del programa siempre a
 * la vista. Todo filtra en memoria — el servidor ya mandó las filas.
 */
export function ActividadFiltrable({
  ranchoId,
  filas,
  totalMiembros,
}: {
  ranchoId: string;
  filas: FilaLibro[];
  totalMiembros: number;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const texto = busqueda.trim().toLowerCase();
  const visibles = filas.filter((f) => {
    if (texto && !f.nombre.toLowerCase().includes(texto) && !(f.porQuien ?? "sistema").toLowerCase().includes(texto)) {
      return false;
    }
    if (desde && f.fechaISO < desde) return false;
    if (hasta && f.fechaISO > hasta) return false;
    return true;
  });

  const campo =
    "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[12.5px] text-aventurea-ink placeholder:text-zinc-500";

  return (
    <div>
      {/* El contador y los filtros, en una sola línea de control. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-aventurea-cream-2 px-3 py-1.5 text-[12px] font-bold text-aventurea-ink">
          👥 {totalMiembros} cliente{totalMiembros === 1 ? "" : "s"} en el programa
        </span>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cliente o colaborador…"
          className={`${campo} min-w-[190px] flex-1`}
        />
        <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-aventurea-ink-soft">
          De
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={campo} />
        </label>
        <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-aventurea-ink-soft">
          a
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={campo} />
        </label>
        {(texto || desde || hasta) && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setDesde("");
              setHasta("");
            }}
            className="text-[12px] font-bold text-aventurea-ink-soft underline"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white">
        {visibles.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-aventurea-ink-soft">
            Ningún movimiento coincide con el filtro.
          </p>
        ) : (
          visibles.map((f, i) => (
            <FilaActividad
              key={f.transaccionId}
              ranchoId={ranchoId}
              transaccionId={f.transaccionId}
              miembroId={f.miembroId}
              nombre={f.nombre}
              tipo={f.tipo}
              puntos={f.puntos}
              motivo={f.motivo}
              saldoPosterior={f.saldoPosterior}
              esReversion={f.esReversion}
              porQuien={f.porQuien}
              fecha={f.fecha}
              primera={i === 0}
            />
          ))
        )}
        <p className="border-t border-aventurea-line px-4 py-2.5 text-[11.5px] text-aventurea-ink-soft">
          {visibles.length} de los últimos {filas.length} movimientos. El libro nunca se
          edita: los errores se corrigen con el movimiento contrario, y las dos versiones
          quedan a la vista.
        </p>
      </div>
    </div>
  );
}

export default function FilaActividad({
  ranchoId,
  transaccionId,
  miembroId,
  nombre,
  tipo,
  puntos,
  motivo,
  saldoPosterior,
  esReversion,
  porQuien,
  fecha,
  primera,
}: {
  ranchoId: string;
  transaccionId: string;
  miembroId: string;
  nombre: string;
  tipo: string;
  puntos: number;
  motivo: string;
  saldoPosterior: number | null;
  esReversion: boolean;
  /** El colaborador que lo hizo. null = lo hizo el sistema. */
  porQuien: string | null;
  fecha: string;
  primera: boolean;
}) {
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivoReversion, setMotivoReversion] = useState("");
  const [estado, setEstado] = useState<"normal" | "revertido" | string>("normal");
  const [pendiente, iniciar] = useTransition();

  function revertir() {
    iniciar(async () => {
      const res = await revertirMovimiento(ranchoId, miembroId, transaccionId, motivoReversion);
      if (res.ok) setEstado("revertido");
      else setEstado(res.motivo);
      setPidiendoMotivo(false);
    });
  }

  return (
    <div
      className={`px-4 py-3 ${primera ? "" : "border-t border-aventurea-line"} ${
        estado === "revertido" ? "opacity-50" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${TIPO_CLS[tipo] ?? TIPO_CLS.ajuste}`}
        >
          {esReversion ? "reversión" : tipo}
        </span>
        {/* Ancho completo en móvil: con siete elementos en la fila, el
            nombre quedaba en ~19px («M…»). */}
        <span className="w-full min-w-0 truncate text-[13px] font-bold text-aventurea-ink sm:w-auto sm:flex-1">
          {nombre}
        </span>
        <span
          className={`text-[13px] font-bold tabular-nums ${
            puntos > 0 ? "text-aventurea-green" : "text-aventurea-ink"
          }`}
        >
          {puntos > 0 ? `+${puntos}` : puntos}
        </span>
        {saldoPosterior !== null && (
          <span className="text-[12px] tabular-nums text-aventurea-ink-soft">
            → {saldoPosterior}
          </span>
        )}
        {/* Quién lo hizo, siempre visible: es la diferencia entre un
            registro y un rumor. "sistema" = lo otorgó Bookea solo (ej.
            puntos por cita cumplida). */}
        <span className="rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft">
          {porQuien ?? "sistema"}
        </span>
        <span className="text-[11.5px] text-aventurea-ink-soft">{fecha}</span>

        {/* Una reversión no se revierte: se registra el movimiento
            correcto. El RPC también lo rechaza; esto solo evita ofrecer
            un botón que va a fallar. */}
        {!esReversion && estado === "normal" && (
          <button
            type="button"
            onClick={() => setPidiendoMotivo((v) => !v)}
            className="text-[11.5px] font-bold text-aventurea-ink-soft underline"
          >
            Revertir
          </button>
        )}
        {estado === "revertido" && (
          <span className="text-[11.5px] font-bold text-red-700">revertido</span>
        )}
      </div>

      {motivo && <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">{motivo}</p>}
      {estado !== "normal" && estado !== "revertido" && (
        <p className="mt-1 text-[12px] font-bold text-red-700">{estado}</p>
      )}

      {pidiendoMotivo && (
        <div className="mt-2 flex gap-2">
          <input
            value={motivoReversion}
            onChange={(e) => setMotivoReversion(e.target.value)}
            placeholder="Por qué se revierte (queda en el historial)"
            maxLength={200}
            className="flex-1 rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[12.5px] text-aventurea-ink placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={revertir}
            disabled={pendiente || !motivoReversion.trim()}
            className="shrink-0 rounded-[10px] bg-red-700 px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
}

export function CanjePendientePos({
  ranchoId,
  canje,
  primera,
}: {
  ranchoId: string;
  canje: {
    id: string;
    miembro_id: string;
    nombre: string;
    recompensa: string;
    sku: string | null;
    fecha: string;
  };
  primera: boolean;
}) {
  const [factura, setFactura] = useState("");
  const [estado, setEstado] = useState<"pendiente" | "hecho" | string>("pendiente");
  const [ocupado, iniciar] = useTransition();

  function marcar() {
    iniciar(async () => {
      const res = await marcarCanjeEnPos(ranchoId, canje.miembro_id, canje.id, factura);
      setEstado(res.ok ? "hecho" : res.motivo);
    });
  }

  if (estado === "hecho") {
    return (
      <div className={`px-4 py-3 ${primera ? "" : "border-t border-aventurea-line"}`}>
        <p className="text-[12.5px] font-bold text-aventurea-green">
          {canje.recompensa} de {canje.nombre} — registrado en tu caja.
        </p>
      </div>
    );
  }

  return (
    <div className={`px-4 py-3 ${primera ? "" : "border-t border-aventurea-line"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-aventurea-ink">
          {canje.recompensa} · {canje.nombre}
        </span>
        {canje.sku && (
          <span className="rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft">
            SKU {canje.sku}
          </span>
        )}
        <span className="text-[11.5px] text-aventurea-ink-soft">{canje.fecha}</span>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={factura}
          onChange={(e) => setFactura(e.target.value)}
          placeholder="Nº de factura (opcional)"
          maxLength={60}
          className="flex-1 rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[12.5px] text-aventurea-ink placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={marcar}
          disabled={ocupado}
          className="shrink-0 rounded-[10px] bg-aventurea-navy px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
        >
          Ya lo pasé a la caja
        </button>
      </div>
      {estado !== "pendiente" && (
        <p className="mt-1 text-[12px] font-bold text-red-700">{estado}</p>
      )}
    </div>
  );
}
