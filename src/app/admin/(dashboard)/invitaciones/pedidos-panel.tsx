"use client";

import { useState, useTransition } from "react";
import { briefDelPedido, type PedidoParaBrief } from "@/lib/invitaciones/brief";
import { SITIO_URL } from "@/lib/qr";
import { cambiarEstadoPedido, entregarPedido, urlComprobantePedido } from "./actions";
import { ESTADOS_PEDIDO_ABIERTOS } from "./pestanas";

/**
 * Los pedidos de invitación que entraron por el formulario del sitio y
 * del app (tabla `pedidos_invitacion`, migración 0075).
 *
 * Hasta ahora esta tabla no la leía ningún panel: el formulario
 * guardaba bien los 18 campos, pero /admin/invitaciones solo consultaba
 * `invitaciones` (las ya creadas) y Finanzas solo las columnas de plata
 * de los pedidos YA pagados. Un pedido nuevo era invisible.
 *
 * El botón que importa es "Copiar brief para la IA": arma de una sola
 * vez el encargo con todo lo que llenó el cliente, sin transcribir
 * campo por campo.
 */

/** Un pedido tal como sale de la base, ya normalizado por el servidor. */
export type PedidoAdmin = PedidoParaBrief & {
  id: string;
  estado: string;
  /** Nombre del paquete resuelto del catálogo; null si el id no existe. */
  paqueteNombre: string | null;
  /** Lo cobrado en colones, ya formateado ("₡31 200"). */
  montoEtiqueta: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  /** Ruta dentro del bucket `comprobantes`, no una URL pública. */
  comprobante_url: string | null;
  contacto_correo: string;
  created_at: string;
  /** La cuenta que hizo el pedido; con esto se ordena el selector. */
  cliente_id: string | null;
  /** La invitación que ya salió de este pedido, si se entregó. */
  invitacion_id: string | null;
};

/** Una invitación candidata a entregarse, para el selector. */
export type OpcionInvitacion = {
  id: string;
  slug: string;
  titulo: string;
  fechaEvento: string;
  estado: string;
  clienteId: string | null;
};

/** Los estados de la 0075, en el orden en que ocurren de verdad. */
const ESTADOS: { id: string; label: string; chip: string }[] = [
  {
    id: "pendiente_pago",
    label: "Esperando pago",
    chip: "bg-aventurea-cream-2 text-aventurea-ink-soft",
  },
  {
    id: "en_revision",
    label: "Comprobante por revisar",
    chip: "bg-aventurea-sky-light text-aventurea-orange-dark",
  },
  { id: "pagado", label: "Pagado", chip: "bg-aventurea-blue-light text-aventurea-blue" },
  { id: "en_diseno", label: "En diseño", chip: "bg-aventurea-blue-light text-aventurea-blue" },
  { id: "entregado", label: "Entregado", chip: "bg-aventurea-green-light text-aventurea-green" },
  { id: "cancelado", label: "Cancelado", chip: "bg-zinc-200 text-zinc-500" },
];

const ETIQUETA_ESTADO = new Map(ESTADOS.map((e) => [e.id, e]));

const METODO: Record<string, string> = {
  sinpe: "SINPE Móvil",
  transferencia: "Transferencia",
  stripe: "Tarjeta",
};

/** "2026-07-31T14:02:00Z" → "31/7/2026". */
function fechaCorta(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CR");
}

const FILTROS: { id: string; label: string }[] = [
  { id: "abiertos", label: "Por atender" },
  { id: "todos", label: "Todos" },
  ...ESTADOS.map((e) => ({ id: e.id, label: e.label })),
];

export default function PedidosPanel({
  pedidos,
  invitaciones,
}: {
  pedidos: PedidoAdmin[];
  invitaciones: OpcionInvitacion[];
}) {
  const [filtro, setFiltro] = useState("abiertos");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Qué invitación se eligió para entregar, por pedido.
  const [elegida, setElegida] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const invitacionPorId = new Map(invitaciones.map((i) => [i.id, i]));

  const visibles = pedidos.filter((p) => {
    if (filtro === "todos") return true;
    if (filtro === "abiertos") return ESTADOS_PEDIDO_ABIERTOS.includes(p.estado);
    return p.estado === filtro;
  });

  async function copiarBrief(p: PedidoAdmin) {
    setError(null);
    try {
      await navigator.clipboard.writeText(briefDelPedido(p, p.paqueteNombre));
      setCopiado(p.id);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      setError("El navegador no dejó copiar. Seleccioná el texto del brief a mano.");
    }
  }

  function mover(p: PedidoAdmin, estado: string) {
    setError(null);
    startTransition(async () => {
      const res = await cambiarEstadoPedido(p.id, estado);
      if (res.error) setError(res.error);
    });
  }

  function entregar(p: PedidoAdmin) {
    const invitacionId = elegida[p.id] ?? "";
    if (!invitacionId) {
      setError("Elegí cuál invitación se le entrega a este cliente.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await entregarPedido(p.id, invitacionId);
      if (res.error) setError(res.error);
    });
  }

  /**
   * Las invitaciones que se le pueden entregar a este pedido, con las
   * que YA son de ese mismo cliente primero: casi siempre la correcta
   * es una de ellas, y así no hay que buscarla en una lista larga.
   */
  function opcionesPara(p: PedidoAdmin) {
    const suyas: OpcionInvitacion[] = [];
    const resto: OpcionInvitacion[] = [];
    for (const i of invitaciones) {
      if (p.cliente_id && i.clienteId === p.cliente_id) suyas.push(i);
      else resto.push(i);
    }
    return { suyas, resto };
  }

  async function verComprobante(p: PedidoAdmin) {
    if (!p.comprobante_url) return;
    setError(null);
    const res = await urlComprobantePedido(p.comprobante_url);
    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    else setError(res.error ?? "No se pudo abrir el comprobante.");
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3.5 text-[13px] text-red-700">{error}</p>
      )}

      {/* ---------- Filtros por estado ---------- */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const cuenta =
            f.id === "todos"
              ? pedidos.length
              : f.id === "abiertos"
                ? pedidos.filter((p) => ESTADOS_PEDIDO_ABIERTOS.includes(p.estado)).length
                : pedidos.filter((p) => p.estado === f.id).length;
          if (cuenta === 0 && f.id !== "abiertos" && f.id !== "todos") return null;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                filtro === f.id
                  ? "bg-aventurea-navy text-white"
                  : "bg-aventurea-cream-2 text-aventurea-ink-soft hover:text-aventurea-ink"
              }`}
            >
              {f.label} · {cuenta}
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-aventurea-line bg-white p-8 text-center text-[13.5px] text-aventurea-ink-soft">
          {pedidos.length === 0
            ? "Todavía no ha entrado ningún pedido de invitación."
            : "Ningún pedido en este estado."}
        </p>
      ) : (
        <div className="space-y-3">
          {visibles.map((p) => {
            const chip = ETIQUETA_ESTADO.get(p.estado);
            const desplegado = abierto === p.id;
            const entregada = p.invitacion_id
              ? (invitacionPorId.get(p.invitacion_id) ?? null)
              : null;
            const opciones = opcionesPara(p);
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-aventurea-line bg-white p-5"
              >
                {/* ---------- Encabezado ---------- */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-bold text-aventurea-ink">
                        {p.nombre_evento}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          chip?.chip ?? "bg-aventurea-cream-2 text-aventurea-ink-soft"
                        }`}
                      >
                        {chip?.label ?? p.estado}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
                      {p.tipo_evento} · {p.contacto_nombre} · pedido del {fechaCorta(p.created_at)}
                      {p.paqueteNombre ? ` · paquete ${p.paqueteNombre}` : ""}
                      {p.montoEtiqueta ? ` · ${p.montoEtiqueta}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Cuando el pedido ya está pagado o en diseño, lo
                        siguiente que toca es entregarlo: el atajo abre
                        la ficha justo donde está el selector, para no
                        tener que saber que vive dentro de "Ver todos
                        los datos". */}
                    {!p.invitacion_id &&
                      ["pagado", "en_diseno"].includes(p.estado) && (
                        <button
                          type="button"
                          onClick={() => setAbierto(p.id)}
                          className="rounded-[10px] bg-aventurea-green px-3.5 py-2 text-[12.5px] font-bold text-white hover:brightness-95"
                        >
                          Entregar
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => copiarBrief(p)}
                      className="rounded-[10px] bg-aventurea-navy px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2"
                    >
                      {copiado === p.id ? "✓ Brief copiado" : "Copiar brief para la IA"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbierto(desplegado ? null : p.id)}
                      className="rounded-[10px] border border-aventurea-line px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
                    >
                      {desplegado ? "Ocultar datos" : "Ver todos los datos"}
                    </button>
                  </div>
                </div>

                {/* ---------- Todo lo que llenó el cliente ---------- */}
                {desplegado && (
                  <div className="mt-4 border-t border-aventurea-line pt-4">
                    <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Dato rotulo="Tipo de evento" valor={p.tipo_evento} />
                      <Dato rotulo="Anfitriones" valor={p.anfitriones} />
                      <Dato rotulo="Fecha del evento" valor={p.fecha_evento} />
                      <Dato rotulo="Hora" valor={p.hora} />
                      <Dato rotulo="Invitados" valor={p.cantidad_invitados} />
                      <Dato rotulo="Confirman hasta" valor={p.fecha_limite_confirmacion} />
                      <Dato rotulo="Lugar" valor={p.lugar_nombre} />
                      <Dato rotulo="Dirección" valor={p.lugar_direccion} />
                      <Dato rotulo="Maps" valor={p.maps_url} enlace />
                      <Dato rotulo="Temática" valor={p.tematica} />
                      <Dato rotulo="Colores" valor={p.colores} />
                      <Dato rotulo="Idioma" valor={p.idioma} />
                      <Dato rotulo="Contacto" valor={p.contacto_nombre} />
                      <Dato rotulo="WhatsApp" valor={p.contacto_whatsapp} />
                      <Dato rotulo="Correo" valor={p.contacto_correo} />
                    </div>

                    {p.mensaje && (
                      <div className="mt-4">
                        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                          Mensaje del cliente
                        </p>
                        <p className="whitespace-pre-wrap rounded-xl bg-aventurea-cream-2 p-3.5 text-[13px] text-aventurea-ink">
                          {p.mensaje}
                        </p>
                      </div>
                    )}

                    {/* El brief completo, por si prefieren leerlo antes
                        de copiarlo (o copiar solo un pedazo). */}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink">
                        Ver el brief que se copia
                      </summary>
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-aventurea-cream-2 p-3.5 text-[12.5px] text-aventurea-ink">
                        {briefDelPedido(p, p.paqueteNombre)}
                      </pre>
                    </details>

                    {/* ---------- Pago ---------- */}
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-aventurea-line pt-4">
                      <span className="text-[12.5px] text-aventurea-ink-soft">
                        {p.metodo_pago
                          ? `Pagó por ${METODO[p.metodo_pago] ?? p.metodo_pago}`
                          : "Todavía sin pago registrado"}
                        {p.referencia_pago ? ` · ref. ${p.referencia_pago}` : ""}
                      </span>
                      {p.comprobante_url && (
                        <button
                          type="button"
                          onClick={() => verComprobante(p)}
                          className="rounded-[10px] border border-aventurea-line px-3 py-1.5 text-[12px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
                        >
                          Ver comprobante
                        </button>
                      )}
                    </div>

                    {/* ---------- Cerrar la orden ---------- */}
                    <div className="mt-4 border-t border-aventurea-line pt-4">
                      {entregada ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[12.5px] font-bold text-aventurea-green">
                            Orden cerrada
                          </span>
                          <span className="text-[12.5px] text-aventurea-ink-soft">
                            Se le entregó{" "}
                            <a
                              href={`${SITIO_URL}/i/${entregada.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-aventurea-navy underline"
                            >
                              {entregada.titulo}
                            </a>
                            {" "}· se le mandó el correo con su link.
                          </span>
                        </div>
                      ) : p.invitacion_id ? (
                        // Atado a una invitación que ya no está en la
                        // lista (archivada, o borrada): no se pierde el
                        // dato, solo no se puede enlazar.
                        <p className="text-[12.5px] text-aventurea-ink-soft">
                          Este pedido quedó atado a una invitación que ya no aparece en
                          la lista.
                        </p>
                      ) : (
                        <>
                          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                            Entregar
                          </p>
                          <p className="mb-2.5 text-[12.5px] text-aventurea-ink-soft">
                            Al entregar, la invitación pasa a la cuenta del cliente (con
                            su álbum), se publica si estaba en borrador y le sale el
                            correo con su link para compartir.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={elegida[p.id] ?? ""}
                              onChange={(ev) =>
                                setElegida((prev) => ({
                                  ...prev,
                                  [p.id]: ev.target.value,
                                }))
                              }
                              className="min-w-[260px] max-w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[13px] text-aventurea-ink"
                            >
                              <option value="">Elegí la invitación…</option>
                              {opciones.suyas.length > 0 && (
                                <optgroup label="Ya son de este cliente">
                                  {opciones.suyas.map((i) => (
                                    <option key={i.id} value={i.id}>
                                      {i.titulo} · {i.fechaEvento}
                                      {i.estado === "borrador" ? " · borrador" : ""}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="Todas las demás">
                                {opciones.resto.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.titulo} · {i.fechaEvento}
                                    {i.estado === "borrador" ? " · borrador" : ""}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            <button
                              type="button"
                              disabled={pending || !elegida[p.id]}
                              onClick={() => entregar(p)}
                              className="rounded-[10px] bg-aventurea-green px-4 py-2 text-[12.5px] font-bold text-white hover:brightness-95 disabled:opacity-50"
                            >
                              {pending ? "Entregando…" : "Entregar y cerrar la orden"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* ---------- Mover de estado ---------- */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        Mover a
                      </span>
                      {ESTADOS.filter(
                        (e) =>
                          e.id !== p.estado &&
                          // "Entregado" ya no es un estado que se pone a
                          // mano: se llega por el botón de arriba, que es
                          // lo único que ata el pedido con su invitación.
                          (e.id !== "entregado" || Boolean(p.invitacion_id)),
                      ).map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          disabled={pending}
                          onClick={() => mover(p, e.id)}
                          className="rounded-full border border-aventurea-line px-3 py-1.5 text-[12px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy disabled:opacity-50"
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Un campo del pedido; se esconde solo cuando viene vacío. */
function Dato({
  rotulo,
  valor,
  enlace = false,
}: {
  rotulo: string;
  valor: string | number | null;
  enlace?: boolean;
}) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const texto = String(valor);
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {rotulo}
      </p>
      {enlace ? (
        <a
          href={texto}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-[13px] font-medium text-aventurea-navy underline"
        >
          Abrir en Maps
        </a>
      ) : (
        <p className="break-words text-[13px] text-aventurea-ink">{texto}</p>
      )}
    </div>
  );
}
