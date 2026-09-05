"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO } from "@/components/panel/sistema";
import { IconWhatsapp } from "@/components/icons";
import { fmtColones } from "@/lib/finanzas";
import {
  ESTADO_PEDIDO,
  METODO_PAGO,
  MODALIDAD,
  type EstadoPedido,
  type ItemMenuSolutions,
  type Modalidad,
  type PedidoSolutions,
} from "@/lib/solutions/tipos";
import { codigoDePedido, enlaceDeWhatsapp, textoAvisoListo } from "@/lib/solutions/whatsapp";
import { cambiarEstadoPedidoSolutions, marcarAgotadoSolutions } from "../actions";

/**
 * MODO RESTAURANTE — la pantalla de trabajo de la cocina y la caja.
 *
 * Pedido del dueño (5 sep 2026): «poné las comandas en una opción a la
 * izquierda, Modo restaurante, donde veamos las de comer en el
 * restaurante y también las To go y Exprés, hechas por la web».
 *
 * ── UN TABLERO, TRES COLUMNAS ──────────────────────────────────────
 * Nuevos → Preparando → Listos, de izquierda a derecha, como el riel
 * de comandas de una cocina. Cada tarjeta tiene UN botón que la lleva
 * a la siguiente columna; no hay formularios. Las de mesa, To go y
 * Exprés viven juntas, con su etiqueta, y un filtro arriba deja ver
 * solo una modalidad cuando la caja atiende To go y la cocina las
 * mesas.
 *
 * ── SE REFRESCA SOLO ───────────────────────────────────────────────
 * Cada 12 s con `router.refresh()`, sin sockets: una cocina con la
 * pantalla abierta ve entrar los pedidos sin tocar nada. Es lo que
 * hacen los KDS del rubro. El reloj de «hace N min» se actualiza en el
 * cliente cada 30 s y NO se calcula en el render (react-hooks/purity):
 * arranca vacío en el servidor y aparece al montar.
 *
 * ── EL AVISO AL CLIENTE, OPCIONAL ──────────────────────────────────
 * Un pedido To go o Exprés trae el teléfono del cliente. Cuando pasa a
 * «Listo», la tarjeta ofrece «Avisar por WhatsApp»: abre wa.me con el
 * mensaje ya escrito (`textoAvisoListo`). Es la única parte del flujo
 * que toca WhatsApp, y es del restaurante hacia el cliente, no al
 * revés — el pedido entró por la web.
 */

type Filtro = "todas" | Modalidad;
const VIVOS: EstadoPedido[] = ["nuevo", "preparando", "listo"];

export default function TableroRestaurante({
  negocioId,
  negocioNombre,
  pedidos,
  items,
  modalidades,
  puedeEditar,
}: {
  negocioId: string;
  negocioNombre: string;
  pedidos: PedidoSolutions[];
  items: ItemMenuSolutions[];
  /** Qué modalidades tiene prendidas el negocio: decide qué filtros se ofrecen. */
  modalidades: Modalidad[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [ocupado, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [verCerradas, setVerCerradas] = useState(false);
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 12000);
    return () => clearInterval(t);
  }, [router]);

  useEffect(() => {
    // El primer tic va en un timeout de 0 y no directo: llamar a
    // setState de forma síncrona dentro del efecto dispara un segundo
    // render en cascada (react-hooks/set-state-in-effect). Como
    // callback del temporizador es el patrón permitido.
    const marcar = () => setAhora(Date.now());
    const primero = setTimeout(marcar, 0);
    const t = setInterval(marcar, 30000);
    return () => {
      clearTimeout(primero);
      clearInterval(t);
    };
  }, []);

  const mover = (p: PedidoSolutions, estado: EstadoPedido) => {
    setError(null);
    arrancar(async () => {
      const r = await cambiarEstadoPedidoSolutions(negocioId, p.id, estado);
      if (!r.ok) setError(r.motivo);
      else router.refresh();
    });
  };

  const visibles = pedidos.filter((p) => filtro === "todas" || p.modalidad === filtro);
  const vivas = visibles.filter((p) => VIVOS.includes(p.estado));
  const cerradas = visibles.filter((p) => !VIVOS.includes(p.estado));
  const agotados = items.filter((it) => it.agotado_hoy);
  const columnas: { estado: EstadoPedido; titulo: string; tono: "aviso" | "info" | "exito" }[] = [
    { estado: "nuevo", titulo: "Nuevos", tono: "aviso" },
    { estado: "preparando", titulo: "Preparando", tono: "info" },
    { estado: "listo", titulo: "Listos", tono: "exito" },
  ];

  const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
  /** «hace 4 min», y a partir de hora y media «hace 3 h»: en minutos, un
   *  pedido viejo se leía «hace 2733 min», que no le dice nada a nadie. */
  const hace = (iso: string) => {
    if (ahora === null) return null;
    const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60000));
    return min < 90 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`;
  };
  /** «Mesa 4» o «To go #A1B2»: el título de una comanda. */
  const titulo = (p: PedidoSolutions) =>
    p.modalidad === "mesa" ? `Mesa ${p.mesa ?? "?"}` : `${MODALIDAD[p.modalidad].rotulo} #${codigoDePedido(p.id)}`;

  const filtros: { id: Filtro; nombre: string }[] = [
    { id: "todas", nombre: "Todas" },
    ...modalidades.map((m) => ({ id: m, nombre: MODALIDAD[m].rotulo })),
  ];
  const cuenta = (m: Filtro) => pedidos.filter((p) => VIVOS.includes(p.estado) && (m === "todas" || p.modalidad === m)).length;

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 pb-14 pt-6 sm:px-6 lg:px-8">
      {/* ── La barra de arriba ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/solutions/panel/${negocioId}?tab=inicio`} className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink">
            ← Volver al panel
          </Link>
          <h1 className="titulo mt-1 text-[clamp(22px,3vw,30px)] text-aventurea-navy">Modo restaurante</h1>
          <p className="mt-0.5 text-[13px] text-aventurea-ink-soft">
            {negocioNombre} · se actualiza solo cada 12 segundos
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por modalidad">
          {filtros.map((f) => {
            const activo = filtro === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                aria-pressed={activo}
                className={`presionable inline-flex min-h-[40px] items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition-colors ${
                  activo ? "border-aventurea-navy bg-aventurea-navy text-white" : "border-aventurea-line bg-white text-aventurea-ink-soft hover:text-aventurea-navy"
                }`}
              >
                {f.nombre}
                <span className={`rounded-full px-1.5 text-[11px] font-extrabold ${activo ? "bg-white/20" : "bg-aventurea-cream-2"}`}>
                  {cuenta(f.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-[13px] font-bold text-red-700">{error}</p>}

      {/* ── Agotados: para prenderlos de nuevo sin salir de acá ──── */}
      {agotados.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-aventurea-line bg-white p-3">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">Hoy no hay</span>
          {agotados.map((it) => (
            <button
              key={it.id}
              type="button"
              disabled={ocupado || !puedeEditar}
              onClick={() => arrancar(async () => { await marcarAgotadoSolutions(negocioId, it.id, false); router.refresh(); })}
              className={BOTON_PANEL}
              title="Tocá para marcar que hay de nuevo"
            >
              {it.nombre} · hay de nuevo
            </button>
          ))}
        </div>
      )}

      {/* ── El tablero ────────────────────────────────────────────── */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {columnas.map((c) => {
          const lista = vivas.filter((p) => p.estado === c.estado);
          return (
            <section key={c.estado} className="rounded-2xl border border-aventurea-line bg-[#f2f5fb] p-3" aria-label={c.titulo}>
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-aventurea-navy">{c.titulo}</h2>
                <PildoraEstado estado={lista.length > 0 ? c.tono : "neutro"}>{lista.length}</PildoraEstado>
              </div>
              {lista.length === 0 && (
                <p className="px-1 py-6 text-center text-[12.5px] text-aventurea-ink-soft">
                  {c.estado === "nuevo" ? "Cuando alguien pida, aparece acá solo." : "Nada por ahora."}
                </p>
              )}
              <ul className="flex flex-col gap-3">
                {lista.map((p) => {
                  const def = ESTADO_PEDIDO[p.estado];
                  const transcurrido = hace(p.creado_en);
                  const esMesa = p.modalidad === "mesa";
                  const avisable = !esMesa && p.estado === "listo" && p.telefono;
                  return (
                    <li key={p.id} className="rounded-2xl border border-aventurea-line bg-white p-4 shadow-plano">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[22px] font-extrabold leading-none text-aventurea-navy">{titulo(p)}</p>
                          <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
                            {hora(p.creado_en)}
                            {transcurrido && ` · ${transcurrido}`}
                            {p.nombre && ` · ${p.nombre}`}
                          </p>
                        </div>
                        <PildoraEstado estado={esMesa ? "neutro" : p.modalidad === "express" ? "info" : "aviso"}>
                          {MODALIDAD[p.modalidad].rotulo}
                        </PildoraEstado>
                      </div>

                      <ul className="mt-3 flex flex-col gap-1 text-[15px] text-aventurea-ink">
                        {p.items.map((it) => (
                          <li key={it.id} className="flex justify-between gap-3">
                            <span><span className="font-extrabold tabular-nums">{it.cantidad}×</span> {it.nombre}</span>
                            <span className="tabular-nums text-aventurea-ink-soft">{fmtColones(it.precio * it.cantidad)}</span>
                          </li>
                        ))}
                      </ul>
                      {p.costo_envio > 0 && (
                        <p className="mt-1 flex justify-between text-[13px] text-aventurea-ink-soft">
                          <span>Envío</span>
                          <span className="tabular-nums">{fmtColones(p.costo_envio)}</span>
                        </p>
                      )}
                      {p.nota && (
                        <p className="mt-2 rounded-lg bg-aventurea-cream-2 px-3 py-2 text-[13px] italic text-aventurea-ink">«{p.nota}»</p>
                      )}

                      {/* Los datos del cliente, solo cuando hay que entregarle. */}
                      {!esMesa && (
                        <div className="mt-3 rounded-xl border border-aventurea-line bg-[#f7f9fc] px-3 py-2.5 text-[13px] leading-snug text-aventurea-ink">
                          {p.telefono && <p>Tel. {p.telefono}</p>}
                          {p.cedula && <p>Cédula {p.cedula}</p>}
                          {p.direccion && <p>{p.direccion}</p>}
                          {p.metodo_pago && <p className="font-bold">Paga con {METODO_PAGO[p.metodo_pago].toLowerCase()}</p>}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-aventurea-line pt-3">
                        <span className="text-[16px] font-extrabold tabular-nums text-aventurea-navy">{fmtColones(p.total)}</span>
                        <div className="flex flex-wrap gap-2">
                          {avisable && (
                            <a
                              href={enlaceDeWhatsapp(p.telefono as string, textoAvisoListo({ cliente: p.nombre, codigo: codigoDePedido(p.id), negocio: negocioNombre, modalidad: p.modalidad as "llevar" | "express" }))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${BOTON_PANEL} inline-flex items-center gap-1.5`}
                            >
                              <IconWhatsapp className="h-4 w-4" />
                              Avisar
                            </a>
                          )}
                          <button type="button" disabled={ocupado} onClick={() => { if (confirm(`¿Cancelar el pedido ${titulo(p)}?`)) mover(p, "cancelado"); }} className={BOTON_PANEL}>
                            Cancelar
                          </button>
                          {def.siguiente && def.accion && (
                            <button type="button" disabled={ocupado} onClick={() => mover(p, def.siguiente as EstadoPedido)} className={BOTON_PANEL_PRIMARIO}>
                              {def.accion}
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* ── Las cerradas ──────────────────────────────────────────── */}
      {cerradas.length > 0 && (
        <div className="mt-5 rounded-2xl border border-aventurea-line bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-aventurea-navy">Cerradas</h2>
            <button type="button" onClick={() => setVerCerradas((v) => !v)} className={BOTON_PANEL}>
              {verCerradas ? "Ocultar" : `Ver ${cerradas.length}`}
            </button>
          </div>
          {verCerradas && (
            <ul className="mt-3 flex flex-col divide-y divide-aventurea-line">
              {cerradas.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="text-aventurea-ink">
                    <strong>{titulo(p)}</strong> · {hora(p.creado_en)} · {p.items.reduce((s, it) => s + it.cantidad, 0)} platos
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-aventurea-ink-soft">{fmtColones(p.total)}</span>
                    <PildoraEstado estado={p.estado === "cancelado" ? "alerta" : "neutro"}>{ESTADO_PEDIDO[p.estado].rotulo}</PildoraEstado>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
