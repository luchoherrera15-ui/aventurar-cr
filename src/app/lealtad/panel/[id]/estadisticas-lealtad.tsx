"use client";

import { useMemo, useState } from "react";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import {
  BOTON_PANEL,
  CAMPO_PANEL,
  CIFRA,
  CUERPO,
  CUERPO_SUAVE,
  DETALLE,
  ROTULO_CAMPO,
  ROTULO_CIFRA,
} from "@/components/panel/sistema";
import { ETIQUETA_CANAL, type CanalDelSello } from "@/lib/lealtad/canal-del-sello";
import type { DatosEstadisticas, MovimientoEstadistica, TipoMovimiento } from "./estadisticas-datos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  ESTADÍSTICAS — el programa de estadísticas de la tarjeta
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (7 sep 2026): «un verdadero programa de
 * estadísticas: ordenado, que se pueda filtrar, tablas separadas de
 * entregas de sellos y de canjes, quién cuánto consume, amigable».
 *
 * ── CÓMO ESTÁ ARMADO ───────────────────────────────────────────────
 * Todo sale de UNA lista plana de movimientos que el servidor ya cruzó
 * (`estadisticas-datos.ts`). Arriba, los filtros: el período (hoy, 7,
 * 30, 90 días, este año, todo, o dos fechas), el tipo, el canal, el
 * colaborador y el cliente. TODO lo demás —las cifras, la gráfica y
 * cada tabla— se calcula sobre los movimientos que pasan los filtros.
 * Cambiar un filtro cambia toda la pantalla a la vez, y por eso las
 * cifras nunca pueden decir una cosa y la tabla otra.
 *
 * Las tablas son siete y responden preguntas distintas:
 *   Entregas    cada sello o punto dado: cuándo, a quién, cuánto,
 *               con qué valor y detalle, por dónde y quién lo dio.
 *   Canjes      cada premio entregado.
 *   Ajustes     lo que se corrigió o revirtió a mano.
 *   Clientes    quién cuánto consume EN EL PERÍODO: visitas, sellos,
 *               valor, ticket, canjes.
 *   Equipo      qué dio cada colaborador.
 *   Detalle     qué se vende más (lo anotado en «Detalle»).
 *   Canales     por dónde entran los sellos.
 * Todas se ordenan tocando el encabezado y se exportan a CSV con los
 * filtros puestos.
 *
 * ── EL VALOR NO LLEVA MONEDA ───────────────────────────────────────
 * Lealtad vende en 21 países: el número se muestra pelado («4 500») y
 * la columna se llama «Valor», como en el mostrador.
 */

type Periodo = "hoy" | "7" | "30" | "90" | "anio" | "todo" | "personalizado";
type Vista = "entregas" | "canjes" | "ajustes" | "clientes" | "equipo" | "detalle" | "canales";

const PERIODOS: { id: Periodo; nombre: string }[] = [
  { id: "hoy", nombre: "Hoy" },
  { id: "7", nombre: "7 días" },
  { id: "30", nombre: "30 días" },
  { id: "90", nombre: "90 días" },
  { id: "anio", nombre: "Este año" },
  { id: "todo", nombre: "Todo" },
  { id: "personalizado", nombre: "Fechas" },
];

const TIPO_ETIQUETA: Record<TipoMovimiento, string> = {
  sello: "Entrega",
  canje: "Canje",
  ajuste: "Ajuste",
  reversion: "Reversión",
};

const FECHA_HORA = new Intl.DateTimeFormat("es-CR", {
  timeZone: "America/Costa_Rica",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const num = (n: number) => n.toLocaleString("es-CR");
/** El valor sin moneda; «—» cuando no se registró. */
const valor = (n: number | null) => (n === null ? "—" : num(Math.round(n)));

/** YYYY-MM-DD de hace N días, en el mismo calendario que `hoy`. */
function restarDias(hoy: string, dias: number): string {
  const [a, m, d] = hoy.split("-").map(Number);
  const t = Date.UTC(a, m - 1, d) - dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** El CSV se arma a mano: las tablas son chicas y una dependencia sería peso sin beneficio. */
function descargarCsv(nombre: string, encabezados: string[], filas: (string | number | null)[][]) {
  const escapar = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texto = [encabezados, ...filas].map((f) => f.map(escapar).join(";")).join("\n");
  const blob = new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

// ── La tabla genérica: encabezados que ordenan, «ver más», CSV ──────

/** «mostrador» → «Mostrador»: las etiquetas de canal van en minúscula
 *  porque viven dentro de frases; en una celda de tabla van con mayúscula. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Columna<T> = {
  clave: string;
  titulo: string;
  /** Lo que se muestra. */
  celda: (fila: T) => React.ReactNode;
  /** Lo que se ordena y lo que va al CSV. */
  valor: (fila: T) => string | number | null;
  derecha?: boolean;
  /** Un renglón chico bajo el principal (contacto, motivo…). */
  pie?: (fila: T) => string | null;
  /** No se muestra en pantalla (referencias largas de auditoría): solo va al CSV. */
  soloCsv?: boolean;
};

function Tabla<T>({
  columnas,
  filas,
  clave,
  vacio,
  archivo,
  ordenInicial,
}: {
  columnas: Columna<T>[];
  filas: T[];
  clave: (fila: T) => string;
  vacio: string;
  archivo: string;
  ordenInicial: { clave: string; desc: boolean };
}) {
  const [orden, setOrden] = useState(ordenInicial);
  const [visibles, setVisibles] = useState(50);
  const enPantalla = columnas.filter((c) => !c.soloCsv);

  const ordenadas = useMemo(() => {
    const col = columnas.find((c) => c.clave === orden.clave) ?? columnas[0];
    const lista = [...filas].sort((a, b) => {
      const va = col.valor(a);
      const vb = col.valor(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "es");
      return orden.desc ? -r : r;
    });
    return lista;
  }, [filas, columnas, orden]);

  const exportar = () =>
    descargarCsv(
      archivo,
      columnas.map((c) => c.titulo),
      ordenadas.map((f) => columnas.map((c) => c.valor(f))),
    );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className={DETALLE}>
          {filas.length === 0 ? "Sin filas" : `${num(filas.length)} fila${filas.length === 1 ? "" : "s"}`} · tocá un
          encabezado para ordenar
        </p>
        <button type="button" onClick={exportar} disabled={filas.length === 0} className={BOTON_PANEL}>
          Exportar CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-aventurea-line">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-aventurea-line bg-aventurea-cream-2 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              {enPantalla.map((c) => {
                const activa = orden.clave === c.clave;
                return (
                  <th key={c.clave} scope="col" aria-sort={activa ? (orden.desc ? "descending" : "ascending") : "none"} className={`px-3 py-2.5 ${c.derecha ? "text-right" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setOrden((o) => ({ clave: c.clave, desc: o.clave === c.clave ? !o.desc : true }))}
                      className={`inline-flex items-center gap-1 hover:text-aventurea-navy ${activa ? "text-aventurea-navy" : ""}`}
                    >
                      {c.titulo}
                      <span aria-hidden className="text-[9px]">{activa ? (orden.desc ? "▼" : "▲") : "◇"}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ordenadas.length === 0 ? (
              <tr>
                <td colSpan={enPantalla.length} className="px-4 py-8 text-center text-[13px] text-aventurea-ink-soft">
                  {vacio}
                </td>
              </tr>
            ) : (
              ordenadas.slice(0, visibles).map((f) => (
                <tr key={clave(f)} className="border-b border-aventurea-line last:border-0 hover:bg-aventurea-cream-2">
                  {enPantalla.map((c) => {
                    const pie = c.pie?.(f);
                    return (
                      <td key={c.clave} className={`px-3 py-2.5 align-top ${c.derecha ? "text-right tabular-nums" : ""}`}>
                        <span className={`${CUERPO} block`}>{c.celda(f)}</span>
                        {pie && <span className={`${CUERPO_SUAVE} block truncate max-w-[280px]`}>{pie}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {ordenadas.length > visibles && (
        <button type="button" onClick={() => setVisibles((v) => v + 100)} className={`mt-3 ${BOTON_PANEL}`}>
          Ver más ({num(ordenadas.length - visibles)} restantes)
        </button>
      )}
    </div>
  );
}

// ── La gráfica: barras por día, semana o mes, tres series ───────────

type Cubeta = { etiqueta: string; sellos: number; canjes: number; nuevos: number };

function Grafica({ cubetas, unidad }: { cubetas: Cubeta[]; unidad: string }) {
  const max = Math.max(1, ...cubetas.map((c) => Math.max(c.sellos, c.canjes, c.nuevos)));
  const alto = 150;
  const anchoCubeta = 100 / Math.max(1, cubetas.length);
  const series: { clave: keyof Omit<Cubeta, "etiqueta">; nombre: string; color: string }[] = [
    { clave: "sellos", nombre: unidad.charAt(0).toUpperCase() + unidad.slice(1), color: "var(--accion, #0f4c9e)" },
    { clave: "canjes", nombre: "Canjes", color: "#2f855a" },
    { clave: "nuevos", nombre: "Clientes nuevos", color: "#b7791f" },
  ];
  if (cubetas.length === 0) {
    return <p className={CUERPO_SUAVE}>Sin movimientos en este período.</p>;
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.clave} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-aventurea-ink">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.nombre}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 100 ${alto + 22}`} preserveAspectRatio="none" className="h-[190px] w-full" role="img" aria-label={`${series[0].nombre}, canjes y clientes nuevos por período`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={100} y1={alto - alto * f} y2={alto - alto * f} stroke="rgba(16,24,40,.08)" strokeWidth={0.3} />
        ))}
        {cubetas.map((c, i) => {
          const x0 = i * anchoCubeta;
          const anchoBarra = (anchoCubeta * 0.7) / series.length;
          return (
            <g key={c.etiqueta}>
              {series.map((s, k) => {
                const v = c[s.clave];
                const h = (v / max) * alto;
                return (
                  <rect
                    key={s.clave}
                    x={x0 + anchoCubeta * 0.15 + k * anchoBarra}
                    y={alto - h}
                    width={anchoBarra * 0.9}
                    height={h}
                    fill={s.color}
                    opacity={v === 0 ? 0.15 : 1}
                  >
                    <title>{`${c.etiqueta} · ${s.nombre}: ${num(v)}`}</title>
                  </rect>
                );
              })}
              {(cubetas.length <= 16 || i % Math.ceil(cubetas.length / 12) === 0) && (
                <text x={x0 + anchoCubeta / 2} y={alto + 15} textAnchor="middle" fontSize={cubetas.length > 20 ? 4.2 : 5} fill="rgba(16,24,40,.6)" style={{ fontFamily: "inherit" }}>
                  {c.etiqueta}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── La pantalla ─────────────────────────────────────────────────────

export default function EstadisticasLealtad({
  datos,
  listosParaCanjear,
  enRiesgo,
  tieneProyeccion,
  abreProyeccion,
  limiteClientes,
}: {
  datos: DatosEstadisticas;
  /** Del padrón: quiénes ya pueden canjear y quiénes se están yendo. */
  listosParaCanjear: number;
  enRiesgo: number;
  /** La proyección es capacidad de paquete (ver planes.ts). */
  tieneProyeccion: boolean;
  abreProyeccion: string | null;
  limiteClientes: number | null;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipo, setTipo] = useState<"todos" | TipoMovimiento>("todos");
  const [canal, setCanal] = useState<"todos" | CanalDelSello>("todos");
  const [quien, setQuien] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<Vista>("entregas");

  // ── El rango de fechas, en YYYY-MM-DD de Costa Rica ──────────────
  const rango = useMemo(() => {
    const hoy = datos.hoy;
    switch (periodo) {
      case "hoy":
        return { desde: hoy, hasta: hoy };
      case "7":
        return { desde: restarDias(hoy, 6), hasta: hoy };
      case "30":
        return { desde: restarDias(hoy, 29), hasta: hoy };
      case "90":
        return { desde: restarDias(hoy, 89), hasta: hoy };
      case "anio":
        return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
      case "personalizado":
        return { desde: desde || "0000-01-01", hasta: hasta || hoy };
      default:
        return { desde: "0000-01-01", hasta: hoy };
    }
  }, [periodo, desde, hasta, datos.hoy]);

  const canalesPresentes = useMemo(() => [...new Set(datos.movimientos.map((m) => m.canal))], [datos.movimientos]);
  const quienesPresentes = useMemo(() => [...new Set(datos.movimientos.map((m) => m.quien))].sort((a, b) => a.localeCompare(b, "es")), [datos.movimientos]);

  // ── Lo que pasa los filtros ───────────────────────────────────────
  const filtrados = useMemo(() => {
    const aguja = busqueda.trim().toLowerCase();
    return datos.movimientos.filter((m) => {
      if (m.fechaISO < rango.desde || m.fechaISO > rango.hasta) return false;
      if (tipo !== "todos" && m.tipo !== tipo) return false;
      if (canal !== "todos" && m.canal !== canal) return false;
      if (quien !== "todos" && m.quien !== quien) return false;
      if (aguja && !`${m.cliente} ${m.contacto} ${m.detalle ?? ""} ${m.premio ?? ""}`.toLowerCase().includes(aguja)) return false;
      return true;
    });
  }, [datos.movimientos, rango, tipo, canal, quien, busqueda]);

  const nuevosEnRango = useMemo(
    () => datos.clientes.filter((c) => c.desde >= rango.desde && c.desde <= rango.hasta),
    [datos.clientes, rango],
  );

  // ── Las cifras del período ────────────────────────────────────────
  const cifras = useMemo(() => {
    const entregas = filtrados.filter((m) => m.tipo === "sello");
    const canjes = filtrados.filter((m) => m.tipo === "canje" && m.estadoCanje !== "anulado");
    const conValor = entregas.filter((m) => m.valor !== null);
    const valorTotal = conValor.reduce((s, m) => s + (m.valor ?? 0), 0);
    return {
      sellos: entregas.reduce((s, m) => s + m.cantidad, 0),
      visitas: entregas.length,
      clientes: new Set(filtrados.map((m) => m.miembroId)).size,
      canjes: canjes.length,
      valorTotal,
      conValor: conValor.length,
      ticket: conValor.length > 0 ? valorTotal / conValor.length : null,
      nuevos: nuevosEnRango.length,
    };
  }, [filtrados, nuevosEnRango]);

  // ── La gráfica: por día, semana o mes según el rango ─────────────
  const cubetas = useMemo<Cubeta[]>(() => {
    const dias = Math.max(1, Math.round((Date.parse(rango.hasta) - Date.parse(rango.desde)) / 86_400_000) + 1);
    const primera = rango.desde === "0000-01-01"
      ? [...filtrados.map((m) => m.fechaISO), ...nuevosEnRango.map((c) => c.desde)].sort()[0] ?? datos.hoy
      : rango.desde;
    const span = Math.max(1, Math.round((Date.parse(rango.hasta) - Date.parse(primera)) / 86_400_000) + 1);
    const modo: "dia" | "semana" | "mes" = span <= 31 ? "dia" : span <= 200 ? "semana" : "mes";
    const claveDe = (iso: string) => {
      if (modo === "dia") return iso;
      if (modo === "mes") return iso.slice(0, 7);
      const t = Date.parse(iso);
      const inicioSemana = t - ((new Date(t).getUTCDay() + 6) % 7) * 86_400_000;
      return new Date(inicioSemana).toISOString().slice(0, 10);
    };
    const etiquetaDe = (clave: string) => (modo === "mes" ? `${clave.slice(5, 7)}/${clave.slice(2, 4)}` : `${clave.slice(8, 10)}/${clave.slice(5, 7)}`);
    const mapa = new Map<string, Cubeta>();
    // Todas las cubetas del rango, aunque estén en cero: un mes vacío es un dato.
    const inicio = Date.parse(primera);
    const fin = Date.parse(rango.hasta);
    for (let t = inicio; t <= fin; t += 86_400_000) {
      const clave = claveDe(new Date(t).toISOString().slice(0, 10));
      if (!mapa.has(clave)) mapa.set(clave, { etiqueta: etiquetaDe(clave), sellos: 0, canjes: 0, nuevos: 0 });
    }
    for (const m of filtrados) {
      const c = mapa.get(claveDe(m.fechaISO));
      if (!c) continue;
      if (m.tipo === "sello") c.sellos += m.cantidad;
      if (m.tipo === "canje" && m.estadoCanje !== "anulado") c.canjes += 1;
    }
    for (const n of nuevosEnRango) {
      const c = mapa.get(claveDe(n.desde));
      if (c) c.nuevos += 1;
    }
    void dias;
    return [...mapa.values()];
  }, [filtrados, nuevosEnRango, rango, datos.hoy]);

  // ── Las agregaciones por cliente, colaborador, detalle y canal ───
  type FilaCliente = { miembroId: string; cliente: string; contacto: string; visitas: number; sellos: number; valor: number; conValor: number; canjes: number; ultima: string };
  const porCliente = useMemo<FilaCliente[]>(() => {
    const mapa = new Map<string, FilaCliente>();
    for (const m of filtrados) {
      const f = mapa.get(m.miembroId) ?? { miembroId: m.miembroId, cliente: m.cliente, contacto: m.contacto, visitas: 0, sellos: 0, valor: 0, conValor: 0, canjes: 0, ultima: "" };
      if (m.tipo === "sello") {
        f.visitas += 1;
        f.sellos += m.cantidad;
        if (m.valor !== null) {
          f.valor += m.valor;
          f.conValor += 1;
        }
        if (m.fechaISO > f.ultima) f.ultima = m.fechaISO;
      }
      if (m.tipo === "canje" && m.estadoCanje !== "anulado") f.canjes += 1;
      mapa.set(m.miembroId, f);
    }
    return [...mapa.values()];
  }, [filtrados]);

  type FilaGrupo = { clave: string; nombre: string; visitas: number; sellos: number; valor: number; conValor: number; canjes: number; ajustes: number };
  const agrupar = (de: (m: MovimientoEstadistica) => string | null): FilaGrupo[] => {
    const mapa = new Map<string, FilaGrupo>();
    for (const m of filtrados) {
      const clave = de(m);
      if (clave === null) continue;
      const f = mapa.get(clave) ?? { clave, nombre: clave, visitas: 0, sellos: 0, valor: 0, conValor: 0, canjes: 0, ajustes: 0 };
      if (m.tipo === "sello") {
        f.visitas += 1;
        f.sellos += m.cantidad;
        if (m.valor !== null) {
          f.valor += m.valor;
          f.conValor += 1;
        }
      } else if (m.tipo === "canje") {
        if (m.estadoCanje !== "anulado") f.canjes += 1;
      } else {
        f.ajustes += 1;
      }
      mapa.set(clave, f);
    }
    return [...mapa.values()];
  };
  const porQuien = useMemo(() => agrupar((m) => m.quien), [filtrados]); // eslint-disable-line react-hooks/exhaustive-deps
  const porDetalle = useMemo(() => agrupar((m) => (m.tipo === "sello" ? m.detalle : null)), [filtrados]); // eslint-disable-line react-hooks/exhaustive-deps
  const porCanal = useMemo(() => agrupar((m) => cap(m.canalEtiqueta)), [filtrados]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── La proyección (capacidad de paquete) ──────────────────────────
  const ritmoSemanal = useMemo(() => {
    const hace28 = restarDias(datos.hoy, 27);
    return datos.clientes.filter((c) => c.desde >= hace28).length / 4;
  }, [datos.clientes, datos.hoy]);
  const proyeccion30 = Math.round(datos.clientes.length + ritmoSemanal * 4.33);

  const unidadCap = datos.unidad.charAt(0).toUpperCase() + datos.unidad.slice(1);
  const rangoTexto = periodo === "todo" ? "todo el historial" : `${rango.desde.slice(8, 10)}/${rango.desde.slice(5, 7)}/${rango.desde.slice(0, 4)} – ${rango.hasta.slice(8, 10)}/${rango.hasta.slice(5, 7)}/${rango.hasta.slice(0, 4)}`;
  const hayFiltrosFinos = tipo !== "todos" || canal !== "todos" || quien !== "todos" || busqueda.trim() !== "";

  const VISTAS: { id: Vista; nombre: string; cuenta: number }[] = [
    { id: "entregas", nombre: "Entregas", cuenta: filtrados.filter((m) => m.tipo === "sello").length },
    { id: "canjes", nombre: "Canjes", cuenta: filtrados.filter((m) => m.tipo === "canje").length },
    { id: "ajustes", nombre: "Ajustes", cuenta: filtrados.filter((m) => m.tipo === "ajuste" || m.tipo === "reversion").length },
    { id: "clientes", nombre: "Por cliente", cuenta: porCliente.length },
    { id: "equipo", nombre: "Por colaborador", cuenta: porQuien.length },
    { id: "detalle", nombre: "Por detalle", cuenta: porDetalle.length },
    { id: "canales", nombre: "Por canal", cuenta: porCanal.length },
  ];

  const chip = (activo: boolean) =>
    `presionable rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
      activo ? "border-aventurea-navy bg-aventurea-navy text-white" : "border-aventurea-line bg-white text-aventurea-ink-soft hover:text-aventurea-navy"
    }`;

  return (
    <div className="flex flex-col gap-4">
      {/* ── LOS FILTROS: mandan sobre toda la pantalla ─────────────── */}
      <Card eyebrow="Qué mirar" titulo="Filtros" accion={<PildoraEstado estado="neutro">{rangoTexto}</PildoraEstado>}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPeriodo(p.id)} aria-pressed={periodo === p.id} className={chip(periodo === p.id)}>
              {p.nombre}
            </button>
          ))}
        </div>
        {periodo === "personalizado" && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className={ROTULO_CAMPO}>Desde</span>
              <input type="date" value={desde} max={datos.hoy} onChange={(e) => setDesde(e.target.value)} className={`${CAMPO_PANEL} w-[170px]`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={ROTULO_CAMPO}>Hasta</span>
              <input type="date" value={hasta} max={datos.hoy} onChange={(e) => setHasta(e.target.value)} className={`${CAMPO_PANEL} w-[170px]`} />
            </label>
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Tipo de movimiento</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={CAMPO_PANEL}>
              <option value="todos">Todos</option>
              <option value="sello">Entregas de {datos.unidad}</option>
              <option value="canje">Canjes</option>
              <option value="ajuste">Ajustes</option>
              <option value="reversion">Reversiones</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Canal</span>
            <select value={canal} onChange={(e) => setCanal(e.target.value as typeof canal)} className={CAMPO_PANEL}>
              <option value="todos">Todos</option>
              {canalesPresentes.map((c) => (
                <option key={c} value={c}>{ETIQUETA_CANAL[c]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Quién lo hizo</span>
            <select value={quien} onChange={(e) => setQuien(e.target.value)} className={CAMPO_PANEL}>
              <option value="todos">Todos</option>
              {quienesPresentes.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO_CAMPO}>Cliente, detalle o premio</span>
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className={CAMPO_PANEL} />
          </label>
        </div>
        {hayFiltrosFinos && (
          <button type="button" onClick={() => { setTipo("todos"); setCanal("todos"); setQuien("todos"); setBusqueda(""); }} className={`mt-3 ${BOTON_PANEL}`}>
            Quitar filtros
          </button>
        )}
        {datos.truncado && (
          <p className={`mt-3 ${DETALLE}`}>
            Se cargaron los últimos {num(datos.tope)} movimientos. Para ver más atrás, acotá las fechas y exportá el CSV.
          </p>
        )}
      </Card>

      {/* ── LAS CIFRAS DEL PERÍODO ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { r: `${unidadCap} entregados`, v: num(cifras.sellos), d: `${num(cifras.visitas)} visita${cifras.visitas === 1 ? "" : "s"}` },
          { r: "Clientes que vinieron", v: num(cifras.clientes), d: `${num(cifras.nuevos)} nuevo${cifras.nuevos === 1 ? "" : "s"} en el período` },
          { r: "Canjes entregados", v: num(cifras.canjes), d: `${num(listosParaCanjear)} listo${listosParaCanjear === 1 ? "" : "s"} para canjear hoy` },
          { r: "Valor registrado", v: valor(cifras.conValor > 0 ? cifras.valorTotal : null), d: cifras.conValor > 0 ? `ticket promedio ${valor(cifras.ticket)} · ${num(cifras.conValor)} con valor` : "sin valores anotados en el período" },
        ].map((k) => (
          <div key={k.r} className="rounded-2xl border border-aventurea-line bg-white p-4">
            <p className={ROTULO_CIFRA}>{k.r}</p>
            <p className={`mt-1 ${CIFRA}`}>{k.v}</p>
            <p className={`mt-1 ${DETALLE}`}>{k.d}</p>
          </div>
        ))}
      </div>

      {/* ── LA GRÁFICA ────────────────────────────────────────────── */}
      <Card eyebrow="Cómo se mueve" titulo={`${unidadCap}, canjes y clientes nuevos`} accion={<span className={DETALLE}>{cubetas.length > 31 ? "por semana" : cubetas.length <= 31 && periodo !== "todo" && periodo !== "anio" ? "por día" : "por mes"}</span>}>
        <Grafica cubetas={cubetas} unidad={datos.unidad} />
      </Card>

      {/* ── EL ESTADO DEL PROGRAMA HOY ────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-aventurea-line bg-white p-4">
          <p className={ROTULO_CIFRA}>Clientes en total</p>
          <p className={`mt-1 ${CIFRA}`}>{num(datos.clientes.length)}</p>
          <p className={`mt-1 ${DETALLE}`}>{limiteClientes !== null ? `de ${num(limiteClientes)} del paquete` : "sin tope"}</p>
        </div>
        <div className="rounded-2xl border border-aventurea-line bg-white p-4">
          <p className={ROTULO_CIFRA}>Se están yendo</p>
          <p className={`mt-1 ${CIFRA}`}>{num(enRiesgo)}</p>
          <p className={`mt-1 ${DETALLE}`}>en riesgo o dormidos · rescatalos en Clientes</p>
        </div>
        <div className="rounded-2xl border border-aventurea-line bg-white p-4">
          <p className={ROTULO_CIFRA}>A este ritmo</p>
          {tieneProyeccion ? (
            <>
              <p className={`mt-1 ${CIFRA}`}>{num(proyeccion30)}</p>
              <p className={`mt-1 ${DETALLE}`}>
                clientes en un mes (~{Math.round(ritmoSemanal * 10) / 10} nuevos por semana)
                {limiteClientes !== null && proyeccion30 >= limiteClientes ? " · pasarías el tope del paquete" : ""}
              </p>
            </>
          ) : (
            <p className={`mt-1 ${CUERPO_SUAVE}`}>La proyección se desbloquea con el paquete {abreProyeccion ?? "Impulso"}.</p>
          )}
        </div>
      </div>

      {/* ── LAS TABLAS ────────────────────────────────────────────── */}
      <Card eyebrow="El detalle" titulo="Movimientos y totales">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Qué tabla ver">
          {VISTAS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={vista === v.id} onClick={() => setVista(v.id)} className={chip(vista === v.id)}>
              {v.nombre}
              <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${vista === v.id ? "bg-white/20" : "bg-aventurea-cream-2"}`}>{num(v.cuenta)}</span>
            </button>
          ))}
        </div>
        <div className="mt-4">
          {vista === "entregas" && (
            <Tabla<MovimientoEstadistica>
              archivo="entregas.csv"
              filas={filtrados.filter((m) => m.tipo === "sello")}
              clave={(m) => m.id}
              vacio={`No se entregaron ${datos.unidad} con estos filtros.`}
              ordenInicial={{ clave: "fecha", desc: true }}
              columnas={[
                { clave: "fecha", titulo: "Fecha y hora", celda: (m) => FECHA_HORA.format(new Date(m.fecha)), valor: (m) => m.fecha },
                { clave: "cliente", titulo: "Cliente", celda: (m) => m.cliente, valor: (m) => m.cliente, pie: (m) => m.contacto || null },
                { clave: "cantidad", titulo: unidadCap, celda: (m) => `+${num(m.cantidad)}`, valor: (m) => m.cantidad, derecha: true },
                { clave: "valor", titulo: "Valor", celda: (m) => valor(m.valor), valor: (m) => m.valor, derecha: true },
                { clave: "detalle", titulo: "Detalle", celda: (m) => m.detalle ?? "—", valor: (m) => m.detalle },
                { clave: "canal", titulo: "Canal", celda: (m) => cap(m.canalEtiqueta), valor: (m) => cap(m.canalEtiqueta) },
                { clave: "quien", titulo: "Quién", celda: (m) => m.quien, valor: (m) => m.quien },
                { clave: "saldo", titulo: "Saldo después", celda: (m) => (m.saldoDespues === null ? "—" : num(m.saldoDespues)), valor: (m) => m.saldoDespues, derecha: true },
                { clave: "referencia", titulo: "Referencia", celda: (m) => m.referencia ?? "—", valor: (m) => m.referencia, soloCsv: true },
              ]}
            />
          )}
          {vista === "canjes" && (
            <Tabla<MovimientoEstadistica>
              archivo="canjes.csv"
              filas={filtrados.filter((m) => m.tipo === "canje")}
              clave={(m) => m.id}
              vacio="No hubo canjes con estos filtros."
              ordenInicial={{ clave: "fecha", desc: true }}
              columnas={[
                { clave: "fecha", titulo: "Fecha y hora", celda: (m) => FECHA_HORA.format(new Date(m.fecha)), valor: (m) => m.fecha },
                { clave: "cliente", titulo: "Cliente", celda: (m) => m.cliente, valor: (m) => m.cliente, pie: (m) => m.contacto || null },
                { clave: "premio", titulo: "Premio", celda: (m) => m.premio ?? m.motivo ?? "—", valor: (m) => m.premio ?? m.motivo },
                { clave: "cantidad", titulo: `${unidadCap} usados`, celda: (m) => num(Math.abs(m.cantidad)), valor: (m) => Math.abs(m.cantidad), derecha: true },
                { clave: "estado", titulo: "Estado", celda: (m) => m.estadoCanje ?? "entregado", valor: (m) => m.estadoCanje ?? "entregado" },
                { clave: "canal", titulo: "Canal", celda: (m) => cap(m.canalEtiqueta), valor: (m) => cap(m.canalEtiqueta) },
                { clave: "quien", titulo: "Quién", celda: (m) => m.quien, valor: (m) => m.quien },
                { clave: "saldo", titulo: "Saldo después", celda: (m) => (m.saldoDespues === null ? "—" : num(m.saldoDespues)), valor: (m) => m.saldoDespues, derecha: true },
              ]}
            />
          )}
          {vista === "ajustes" && (
            <Tabla<MovimientoEstadistica>
              archivo="ajustes.csv"
              filas={filtrados.filter((m) => m.tipo === "ajuste" || m.tipo === "reversion")}
              clave={(m) => m.id}
              vacio="No hubo ajustes ni reversiones con estos filtros."
              ordenInicial={{ clave: "fecha", desc: true }}
              columnas={[
                { clave: "fecha", titulo: "Fecha y hora", celda: (m) => FECHA_HORA.format(new Date(m.fecha)), valor: (m) => m.fecha },
                { clave: "tipo", titulo: "Tipo", celda: (m) => TIPO_ETIQUETA[m.tipo], valor: (m) => TIPO_ETIQUETA[m.tipo] },
                { clave: "cliente", titulo: "Cliente", celda: (m) => m.cliente, valor: (m) => m.cliente, pie: (m) => m.contacto || null },
                { clave: "cantidad", titulo: unidadCap, celda: (m) => `${m.cantidad > 0 ? "+" : ""}${num(m.cantidad)}`, valor: (m) => m.cantidad, derecha: true },
                { clave: "motivo", titulo: "Motivo", celda: (m) => m.motivo || "—", valor: (m) => m.motivo },
                { clave: "quien", titulo: "Quién", celda: (m) => m.quien, valor: (m) => m.quien },
                { clave: "saldo", titulo: "Saldo después", celda: (m) => (m.saldoDespues === null ? "—" : num(m.saldoDespues)), valor: (m) => m.saldoDespues, derecha: true },
              ]}
            />
          )}
          {vista === "clientes" && (
            <Tabla<FilaCliente>
              archivo="por-cliente.csv"
              filas={porCliente}
              clave={(f) => f.miembroId}
              vacio="Ningún cliente se movió con estos filtros."
              ordenInicial={{ clave: "valor", desc: true }}
              columnas={[
                { clave: "cliente", titulo: "Cliente", celda: (f) => f.cliente, valor: (f) => f.cliente, pie: (f) => f.contacto || null },
                { clave: "visitas", titulo: "Visitas", celda: (f) => num(f.visitas), valor: (f) => f.visitas, derecha: true },
                { clave: "sellos", titulo: unidadCap, celda: (f) => num(f.sellos), valor: (f) => f.sellos, derecha: true },
                { clave: "valor", titulo: "Valor consumido", celda: (f) => valor(f.conValor > 0 ? f.valor : null), valor: (f) => (f.conValor > 0 ? Math.round(f.valor) : null), derecha: true },
                { clave: "ticket", titulo: "Ticket promedio", celda: (f) => valor(f.conValor > 0 ? f.valor / f.conValor : null), valor: (f) => (f.conValor > 0 ? Math.round(f.valor / f.conValor) : null), derecha: true },
                { clave: "canjes", titulo: "Canjes", celda: (f) => num(f.canjes), valor: (f) => f.canjes, derecha: true },
                { clave: "ultima", titulo: "Última visita", celda: (f) => (f.ultima ? `${f.ultima.slice(8, 10)}/${f.ultima.slice(5, 7)}/${f.ultima.slice(0, 4)}` : "—"), valor: (f) => f.ultima || null },
              ]}
            />
          )}
          {vista === "equipo" && (
            <Tabla<FilaGrupo>
              archivo="por-colaborador.csv"
              filas={porQuien}
              clave={(f) => f.clave}
              vacio="Nadie hizo movimientos con estos filtros."
              ordenInicial={{ clave: "sellos", desc: true }}
              columnas={[
                { clave: "nombre", titulo: "Quién", celda: (f) => f.nombre, valor: (f) => f.nombre },
                { clave: "visitas", titulo: "Entregas", celda: (f) => num(f.visitas), valor: (f) => f.visitas, derecha: true },
                { clave: "sellos", titulo: `${unidadCap} dados`, celda: (f) => num(f.sellos), valor: (f) => f.sellos, derecha: true },
                { clave: "valor", titulo: "Valor registrado", celda: (f) => valor(f.conValor > 0 ? f.valor : null), valor: (f) => (f.conValor > 0 ? Math.round(f.valor) : null), derecha: true },
                { clave: "canjes", titulo: "Canjes", celda: (f) => num(f.canjes), valor: (f) => f.canjes, derecha: true },
                { clave: "ajustes", titulo: "Ajustes", celda: (f) => num(f.ajustes), valor: (f) => f.ajustes, derecha: true },
              ]}
            />
          )}
          {vista === "detalle" && (
            <Tabla<FilaGrupo>
              archivo="por-detalle.csv"
              filas={porDetalle}
              clave={(f) => f.clave}
              vacio="No hay entregas con detalle anotado en este período. El detalle se escribe al lado del valor, en el mostrador o el escáner."
              ordenInicial={{ clave: "visitas", desc: true }}
              columnas={[
                { clave: "nombre", titulo: "Detalle", celda: (f) => f.nombre, valor: (f) => f.nombre },
                { clave: "visitas", titulo: "Veces", celda: (f) => num(f.visitas), valor: (f) => f.visitas, derecha: true },
                { clave: "sellos", titulo: `${unidadCap} dados`, celda: (f) => num(f.sellos), valor: (f) => f.sellos, derecha: true },
                { clave: "valor", titulo: "Valor total", celda: (f) => valor(f.conValor > 0 ? f.valor : null), valor: (f) => (f.conValor > 0 ? Math.round(f.valor) : null), derecha: true },
                { clave: "promedio", titulo: "Valor promedio", celda: (f) => valor(f.conValor > 0 ? f.valor / f.conValor : null), valor: (f) => (f.conValor > 0 ? Math.round(f.valor / f.conValor) : null), derecha: true },
              ]}
            />
          )}
          {vista === "canales" && (
            <Tabla<FilaGrupo>
              archivo="por-canal.csv"
              filas={porCanal}
              clave={(f) => f.clave}
              vacio="Sin movimientos con estos filtros."
              ordenInicial={{ clave: "visitas", desc: true }}
              columnas={[
                { clave: "nombre", titulo: "Canal", celda: (f) => f.nombre, valor: (f) => f.nombre },
                { clave: "visitas", titulo: "Entregas", celda: (f) => num(f.visitas), valor: (f) => f.visitas, derecha: true },
                { clave: "sellos", titulo: `${unidadCap} dados`, celda: (f) => num(f.sellos), valor: (f) => f.sellos, derecha: true },
                { clave: "valor", titulo: "Valor registrado", celda: (f) => valor(f.conValor > 0 ? f.valor : null), valor: (f) => (f.conValor > 0 ? Math.round(f.valor) : null), derecha: true },
                { clave: "canjes", titulo: "Canjes", celda: (f) => num(f.canjes), valor: (f) => f.canjes, derecha: true },
                { clave: "ajustes", titulo: "Ajustes", celda: (f) => num(f.ajustes), valor: (f) => f.ajustes, derecha: true },
              ]}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
