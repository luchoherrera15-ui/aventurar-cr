"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ETIQUETA_PERIODO,
  estadoVigente,
  etiquetaSaldo,
  saldoMembresia,
  type ConsumoMembresia,
  type PeriodoPlan,
} from "@/lib/membresias";
import {
  actualizarPlan,
  cambiarEstadoMembresia,
  crearPlan,
  devolverSesion,
  eliminarPlan,
  registrarConsumo,
  venderMembresia,
  type MembresiaFila,
  type PlanFila,
  type PlanInput,
} from "./membresias-actions";

import { Card, CardVacia, PildoraEstado } from "@/components/panel/piezas";
import {
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  DETALLE,
  ESTADO_AVISO,
  RADIO_PILDORA,
  RADIO_TILE,
  ROTULO_CAMPO,
  SUPERFICIE_HUNDIDA,
  type EstadoPanel,
} from "@/components/panel/sistema";
import {
  ACCIONES_FILA,
  BOTON_FILA,
  BOTON_FILA_PELIGRO,
  FilaFicha,
  LISTA_FICHAS,
} from "../fila-ficha";

const inputCls = `${CAMPO_PANEL} placeholder:text-aventurea-ink-soft`;
const labelCls = `mb-1.5 block ${ROTULO_CAMPO}`;
const ayudaCls = `mt-1.5 ${DETALLE}`;

const PERIODOS: PeriodoPlan[] = ["unico", "mensual", "trimestral", "semestral", "anual"];

/**
 * El estado de una membresía, mapeado a los cinco del panel — los
 * mismos que usan la agenda, el CRM y las giftcards, con su contraste
 * ya medido en `panel/sistema.ts`. Antes eran cuatro pares propios,
 * entre ellos un `text-zinc-500` sobre `zinc-100` que no llegaba a AA.
 */
const ESTADO_MEMBRESIA: Record<string, EstadoPanel> = {
  activa: "exito",
  pausada: "aviso",
  vencida: "neutro",
  cancelada: "alerta",
};

function fmtColones(n: number) {
  return "₡" + Number(n).toLocaleString("es-CR");
}

type BorradorPlan = {
  nombre: string;
  descripcion: string;
  precio: string;
  periodo: PeriodoPlan;
  sesiones: string;
  vigencia: string;
  activo: boolean;
};

const PLAN_VACIO: BorradorPlan = {
  nombre: "",
  descripcion: "",
  precio: "",
  periodo: "mensual",
  sesiones: "",
  vigencia: "",
  activo: true,
};

function num(v: string): number | null {
  const limpio = v.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function aInput(b: BorradorPlan): PlanInput {
  return {
    nombre: b.nombre,
    descripcion: b.descripcion,
    precio: num(b.precio) ?? 0,
    periodo: b.periodo,
    sesionesIncluidas: num(b.sesiones),
    vigenciaDias: num(b.vigencia),
    activo: b.activo,
  };
}

function dePlan(p: PlanFila): BorradorPlan {
  return {
    nombre: p.nombre,
    descripcion: p.descripcion ?? "",
    precio: String(p.precio),
    periodo: p.periodo,
    sesiones: p.sesiones_incluidas === null ? "" : String(p.sesiones_incluidas),
    vigencia: p.vigencia_dias === null ? "" : String(p.vigencia_dias),
    activo: p.activo,
  };
}

/**
 * Membresías y bonos (0120). Dos cosas en una pantalla porque en la
 * base son la misma: un bono es un plan de período único.
 *
 * El saldo que se muestra acá se DERIVA de los consumos, nunca de un
 * contador — misma función pura que valida el servidor antes de
 * escribir, así que lo que se ve y lo que se permite no se separan.
 */
export default function MembresiasPanel({
  ranchoId,
  hoy,
  planesIniciales,
  membresiasIniciales,
  consumosIniciales,
  faltaMigracion,
}: {
  ranchoId: string;
  /** El hoy del negocio, calculado en el servidor con su zona. */
  hoy: string;
  planesIniciales: PlanFila[];
  membresiasIniciales: MembresiaFila[];
  consumosIniciales: ConsumoMembresia[];
  faltaMigracion: boolean;
}) {
  const [planes, setPlanes] = useState(
    [...planesIniciales].sort((a, b) => a.orden - b.orden),
  );
  const [membresias, setMembresias] = useState(membresiasIniciales);
  const [consumos, setConsumos] = useState(consumosIniciales);

  const [borrador, setBorrador] = useState<BorradorPlan>(PLAN_VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Venta
  const [venta, setVenta] = useState({
    planId: "",
    nombre: "",
    correo: "",
    telefono: "",
    inicio: "",
    notas: "",
  });

  const planesActivos = useMemo(() => planes.filter((p) => p.activo), [planes]);

  function guardarPlan() {
    setError(null);
    startTransition(async () => {
      const res = editando
        ? await actualizarPlan(ranchoId, editando, aInput(borrador))
        : await crearPlan(ranchoId, aInput(borrador));
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.plan) {
        setPlanes((prev) =>
          editando
            ? prev.map((p) => (p.id === editando ? res.plan! : p))
            : [...prev, res.plan!],
        );
      }
      setBorrador(PLAN_VACIO);
      setEditando(null);
    });
  }

  function borrarPlan(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await eliminarPlan(ranchoId, id);
      if (res.error) setError(res.error);
      else setPlanes((prev) => prev.filter((p) => p.id !== id));
    });
  }

  function vender() {
    setError(null);
    startTransition(async () => {
      const res = await venderMembresia(ranchoId, venta, hoy);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.membresia) setMembresias((prev) => [res.membresia!, ...prev]);
      setVenta({ planId: "", nombre: "", correo: "", telefono: "", inicio: "", notas: "" });
    });
  }

  function marcarSesion(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await registrarConsumo(ranchoId, id, hoy);
      if (res.error) setError(res.error);
      else setConsumos((prev) => [...prev, { membresia_id: id, cantidad: 1 }]);
    });
  }

  function devolver(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await devolverSesion(ranchoId, id);
      if (res.error) setError(res.error);
      else setConsumos((prev) => [...prev, { membresia_id: id, cantidad: -1 }]);
    });
  }

  function cambiarEstado(id: string, estado: MembresiaFila["estado"]) {
    setError(null);
    startTransition(async () => {
      const res = await cambiarEstadoMembresia(ranchoId, id, estado);
      if (res.error) setError(res.error);
      else if (res.membresia) {
        setMembresias((prev) => prev.map((m) => (m.id === id ? res.membresia! : m)));
      }
    });
  }

  if (faltaMigracion) {
    return (
      <div className={`${RADIO_TILE} p-4 text-[12.5px] leading-relaxed ${ESTADO_AVISO.aviso}`}>
        Falta correr la migración <strong>0120</strong> en Supabase para poder vender
        membresías y bonos. El resto del panel funciona igual.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {error && (
        <p className={`${RADIO_TILE} p-3 text-[13px] font-bold ${ESTADO_AVISO.alerta}`}>
          {error}
        </p>
      )}

      {/* ── Planes ─────────────────────────────────────────────── */}
      <Card
        eyebrow="El catálogo"
        titulo="Lo que vendés"
        accion={
          planes.length > 0 ? (
            <span className={DETALLE}>
              {planesActivos.length} de {planes.length} a la venta
            </span>
          ) : undefined
        }
      >
        <p className={`-mt-1.5 ${DETALLE}`}>
          Un plan con período es una membresía (&quot;Premium, 12 al mes&quot;). Con
          período <strong>Pago único</strong> es un bono (&quot;10 masajes&quot;). Dejá
          las sesiones vacías para que sea ilimitado.
        </p>

        {planes.length > 0 && (
          <div className={`mt-3.5 ${LISTA_FICHAS}`}>
            {planes.map((p, idx) => (
              <FilaFicha
                key={p.id}
                separador={idx < planes.length - 1}
                // A la venta o guardado: el estado lo dice la barrita y
                // la píldora, no un `opacity-50` sobre la fila entera.
                marca={p.activo ? "exito" : "neutro"}
                titulo={
                  <>
                    <span className="break-words">{p.nombre}</span>
                    <span
                      className={`${RADIO_PILDORA} bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft`}
                    >
                      {ETIQUETA_PERIODO[p.periodo]}
                    </span>
                    {!p.activo && <PildoraEstado estado="neutro">Desactivado</PildoraEstado>}
                  </>
                }
                detalle={
                  <span>
                    {fmtColones(p.precio)} ·{" "}
                    {p.sesiones_incluidas === null
                      ? "ilimitado"
                      : `${p.sesiones_incluidas} sesiones`}
                  </span>
                }
                acciones={
                  <div className={ACCIONES_FILA}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(p.id);
                        setBorrador(dePlan(p));
                      }}
                      className={BOTON_FILA}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => borrarPlan(p.id)}
                      disabled={pending}
                      className={BOTON_FILA_PELIGRO}
                    >
                      Quitar
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}

        <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre</label>
            <input
              value={borrador.nombre}
              onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
              placeholder="Premium · Bono 10 masajes"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Precio (₡)</label>
            <input
              type="number"
              min={0}
              value={borrador.precio}
              onChange={(e) => setBorrador({ ...borrador, precio: e.target.value })}
              placeholder="30000"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Período</label>
            <select
              value={borrador.periodo}
              onChange={(e) =>
                setBorrador({ ...borrador, periodo: e.target.value as PeriodoPlan })
              }
              className={inputCls}
            >
              {PERIODOS.map((p) => (
                <option key={p} value={p}>
                  {ETIQUETA_PERIODO[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Sesiones incluidas</label>
            <input
              type="number"
              min={1}
              value={borrador.sesiones}
              onChange={(e) => setBorrador({ ...borrador, sesiones: e.target.value })}
              placeholder="Vacío = ilimitadas"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Vence a los (días)</label>
            <input
              type="number"
              min={1}
              value={borrador.vigencia}
              onChange={(e) => setBorrador({ ...borrador, vigencia: e.target.value })}
              placeholder="Vacío = lo decide el período"
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={guardarPlan}
            disabled={pending || !borrador.nombre.trim()}
            className={BOTON_PANEL_PRIMARIO}
          >
            {editando ? "Guardar cambios" : "Agregar plan"}
          </button>
          {editando && (
            <button
              type="button"
              onClick={() => {
                setEditando(null);
                setBorrador(PLAN_VACIO);
              }}
              className={BOTON_FILA}
            >
              Cancelar
            </button>
          )}
        </div>
      </Card>

      {/* ── Venta ──────────────────────────────────────────────── */}
      {planesActivos.length > 0 && (
        <Card eyebrow="Mostrador" titulo="Vender a un cliente">
          <p className={`-mt-1.5 ${DETALLE}`}>
            Podés venderle a alguien que nunca abrió la app: con el correo o el
            teléfono alcanza.
          </p>

          <div className={`mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 ${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-4`}>
            <div className="sm:col-span-2">
              <label className={labelCls}>Plan</label>
              <select
                value={venta.planId}
                onChange={(e) => setVenta({ ...venta, planId: e.target.value })}
                className={inputCls}
              >
                <option value="">Elegí un plan…</option>
                {planesActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {fmtColones(p.precio)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nombre</label>
              <input
                value={venta.nombre}
                onChange={(e) => setVenta({ ...venta, nombre: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input
                value={venta.telefono}
                onChange={(e) => setVenta({ ...venta, telefono: e.target.value })}
                placeholder="88887777"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Correo</label>
              <input
                value={venta.correo}
                onChange={(e) => setVenta({ ...venta, correo: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Arranca el</label>
              <input
                type="date"
                value={venta.inicio}
                onChange={(e) => setVenta({ ...venta, inicio: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={vender}
            disabled={pending || !venta.planId}
            className={`mt-3.5 ${BOTON_PANEL_PRIMARIO}`}
          >
            Vender
          </button>
        </Card>
      )}

      {/* ── Vendidas ───────────────────────────────────────────── */}
      <Card
        eyebrow="Quién la tiene"
        titulo="Membresías vendidas"
        accion={
          membresias.length > 0 ? (
            <span className={DETALLE}>
              {membresias.length} vendida{membresias.length === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
      >
        {membresias.length === 0 ? (
          <CardVacia>Todavía no vendiste ninguna.</CardVacia>
        ) : (
          <div className={LISTA_FICHAS}>
            {membresias.map((m, idx) => {
              const saldo = saldoMembresia(m, consumos);
              const estado = estadoVigente(m, hoy);
              return (
                <FilaFicha
                  key={m.id}
                  separador={idx < membresias.length - 1}
                  marca={ESTADO_MEMBRESIA[estado] ?? "neutro"}
                  titulo={
                    <>
                      <span className="break-words">
                        {m.nombre || m.correo || m.telefono}
                      </span>
                      <PildoraEstado estado={ESTADO_MEMBRESIA[estado] ?? "neutro"}>
                        {estado}
                      </PildoraEstado>
                    </>
                  }
                  detalle={
                    <span>
                      {etiquetaSaldo(saldo)} ·{" "}
                      {m.fin ? `vence ${m.fin}` : "sin vencimiento"}
                    </span>
                  }
                  acciones={
                    <div className={ACCIONES_FILA}>
                      <button
                        type="button"
                        onClick={() => marcarSesion(m.id)}
                        disabled={pending}
                        className={BOTON_FILA}
                      >
                        Marcar sesión
                      </button>
                      {saldo.usadas > 0 && (
                        <button
                          type="button"
                          onClick={() => devolver(m.id)}
                          disabled={pending}
                          className={BOTON_FILA}
                        >
                          Devolver una
                        </button>
                      )}
                      {estado === "activa" && (
                        <button
                          type="button"
                          onClick={() => cambiarEstado(m.id, "pausada")}
                          disabled={pending}
                          className={BOTON_FILA}
                        >
                          Pausar
                        </button>
                      )}
                      {estado === "pausada" && (
                        <button
                          type="button"
                          onClick={() => cambiarEstado(m.id, "activa")}
                          disabled={pending}
                          className={BOTON_FILA}
                        >
                          Reactivar
                        </button>
                      )}
                      {estado !== "cancelada" && (
                        <button
                          type="button"
                          onClick={() => cambiarEstado(m.id, "cancelada")}
                          disabled={pending}
                          className={BOTON_FILA_PELIGRO}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  }
                />
              );
            })}
          </div>
        )}

        <p className={ayudaCls}>
          Las sesiones se marcan acá cuando el cliente se atiende: reservar todavía no
          descuenta solo. Devolver una no borra el movimiento, agrega el contrario, así
          el historial queda completo.
        </p>
      </Card>
    </div>
  );
}
