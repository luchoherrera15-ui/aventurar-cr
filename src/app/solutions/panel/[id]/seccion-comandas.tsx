"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, ESTADO_AVISO } from "@/components/panel/sistema";
import { fmtColones } from "@/lib/finanzas";
import {
  ESTADO_PEDIDO,
  METODO_PAGO,
  MODALIDAD,
  type EstadoPedido,
  type ItemMenuSolutions,
  type PedidoSolutions,
} from "@/lib/solutions/tipos";
import { codigoDePedido } from "@/lib/solutions/whatsapp";
import { cambiarEstadoPedidoSolutions, marcarAgotadoSolutions } from "./actions";

/**
 * COMANDAS — la pantalla de trabajo del restaurante.
 *
 * Las vivas (nuevo → preparando → listo) arriba, por orden de llegada,
 * cada una con UN botón que la lleva al siguiente estado — el patrón
 * de un comandero de papel, no un formulario. Las cerradas del día
 * abajo, plegadas.
 *
 * Se refresca sola cada 12 s con `router.refresh()`: sin sockets ni
 * suscripciones, una cocina con el panel abierto ve entrar los pedidos
 * sin tocar nada. Es lo que Timely/Fresha hacen para la lista del día.
 */
export default function SeccionComandas({
  negocioId,
  pedidos,
  aceptaPedidos,
  mesas,
  puedeEditar,
  items,
}: {
  negocioId: string;
  pedidos: PedidoSolutions[];
  aceptaPedidos: boolean;
  mesas: number;
  puedeEditar: boolean;
  items: ItemMenuSolutions[];
}) {
  const router = useRouter();
  const [ocupado, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [verCerradas, setVerCerradas] = useState(false);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 12000);
    return () => clearInterval(t);
  }, [router]);

  const mover = (p: PedidoSolutions, estado: EstadoPedido) => {
    setError(null);
    arrancar(async () => {
      const r = await cambiarEstadoPedidoSolutions(negocioId, p.id, estado);
      if (!r.ok) setError(r.motivo);
      else router.refresh();
    });
  };

  const vivas = pedidos.filter((p) => p.estado === "nuevo" || p.estado === "preparando" || p.estado === "listo");
  const cerradas = pedidos.filter((p) => p.estado === "entregado" || p.estado === "cancelado");
  const agotados = items.filter((it) => it.agotado_hoy);
  const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
  const tono = (e: EstadoPedido) => (e === "nuevo" ? "aviso" : e === "preparando" ? "info" : e === "listo" ? "exito" : "neutro");
  /** «Mesa 4» o «Para llevar #A1B2»: el título de una comanda (0233). El
   *  código es el mismo que viaja en el mensaje de WhatsApp, para que el
   *  local encuentre acá lo que le llegó por el chat. */
  const titulo = (p: PedidoSolutions) =>
    p.modalidad === "mesa" ? `Mesa ${p.mesa ?? "?"}` : `${MODALIDAD[p.modalidad].rotulo} #${codigoDePedido(p.id)}`;

  return (
    <div className="flex flex-col gap-4">
      {!aceptaPedidos && (
        <p className={`rounded-xl p-3 text-[13px] ${ESTADO_AVISO.info}`}>
          Los pedidos están apagados.{" "}
          {puedeEditar ? (
            <Link href="?tab=pagina" className="font-bold underline">Prendelos en «Mi página»</Link>
          ) : (
            "Pedile al dueño que los prenda."
          )}
          {mesas === 0 && " También hace falta indicar cuántas mesas tenés."}
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 p-3 text-[13px] font-bold text-red-700">{error}</p>}

      <Card eyebrow="Ahora" titulo="Comandas en curso" accion={<PildoraEstado estado={vivas.length > 0 ? "aviso" : "neutro"}>{vivas.length}</PildoraEstado>}>
        {vivas.length === 0 && (
          <p className="text-[13px] text-aventurea-ink-soft">Nada pendiente. Cuando alguien pida desde su mesa o por WhatsApp, aparece acá solo.</p>
        )}
        <ul className="grid gap-3 lg:grid-cols-2">
          {vivas.map((p) => {
            const def = ESTADO_PEDIDO[p.estado];
            return (
              <li key={p.id} className="rounded-2xl border border-aventurea-line bg-white p-4 shadow-plano">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[22px] font-extrabold leading-none text-aventurea-navy">{titulo(p)}</p>
                    <p className="mt-1 text-[12px] text-aventurea-ink-soft">
                      {hora(p.creado_en)}{p.nombre && ` · ${p.nombre}`}
                    </p>
                    {/* Los datos del cliente, solo cuando hay que entregarle (0233). */}
                    {p.modalidad !== "mesa" && (
                      <p className="mt-1 text-[12.5px] leading-snug text-aventurea-ink">
                        {p.telefono && <span className="block">Tel. {p.telefono}</span>}
                        {p.cedula && <span className="block">Cédula {p.cedula}</span>}
                        {p.direccion && <span className="block">{p.direccion}</span>}
                        {p.metodo_pago && <span className="block font-bold">Paga con {METODO_PAGO[p.metodo_pago].toLowerCase()}</span>}
                      </p>
                    )}
                  </div>
                  <PildoraEstado estado={tono(p.estado)}>{def.rotulo}</PildoraEstado>
                </div>
                <ul className="mt-3 flex flex-col gap-1 text-[14px] text-aventurea-ink">
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
                {p.nota && <p className="mt-2 rounded-lg bg-aventurea-cream-2 px-3 py-2 text-[12.5px] italic text-aventurea-ink">«{p.nota}»</p>}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-aventurea-line pt-3">
                  <span className="text-[15px] font-extrabold tabular-nums text-aventurea-navy">{fmtColones(p.total)}</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={ocupado} onClick={() => { if (confirm(`¿Cancelar el pedido ${titulo(p)}?`)) mover(p, "cancelado"); }} className={BOTON_PANEL}>Cancelar</button>
                    {def.siguiente && def.accion && (
                      <button type="button" disabled={ocupado} onClick={() => mover(p, def.siguiente as EstadoPedido)} className={BOTON_PANEL_PRIMARIO}>{def.accion}</button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {agotados.length > 0 && (
        <Card eyebrow="Hoy no hay" titulo="Agotados">
          <ul className="flex flex-wrap gap-2">
            {agotados.map((it) => (
              <li key={it.id}>
                <button type="button" disabled={ocupado} onClick={() => arrancar(async () => { await marcarAgotadoSolutions(negocioId, it.id, false); router.refresh(); })} className={BOTON_PANEL}>
                  {it.nombre} · hay de nuevo
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {cerradas.length > 0 && (
        <Card eyebrow="Historial" titulo="Cerradas" accion={<button type="button" onClick={() => setVerCerradas((v) => !v)} className={BOTON_PANEL}>{verCerradas ? "Ocultar" : `Ver ${cerradas.length}`}</button>}>
          {verCerradas && (
            <ul className="flex flex-col divide-y divide-aventurea-line">
              {cerradas.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="text-aventurea-ink"><strong>{titulo(p)}</strong> · {hora(p.creado_en)} · {p.items.reduce((s, it) => s + it.cantidad, 0)} platos</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-aventurea-ink-soft">{fmtColones(p.total)}</span>
                    <PildoraEstado estado={p.estado === "cancelado" ? "alerta" : "neutro"}>{ESTADO_PEDIDO[p.estado].rotulo}</PildoraEstado>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
