"use client";

import { useMemo, useState, useActionState } from "react";
import { createClient } from "@/lib/supabase/client";
import { solicitarCotizacion, type CotizacionState } from "../cotizacion-actions";
import type { RanchoItem } from "@/app/mi-rancho/types";
import CatalogoPaquetes from "@/components/catalogo-paquetes";
import {
  leerEleccionesIncluidas,
  paqueteBaseElegido,
  totalPedido,
} from "@/lib/catalogo";
import { sumarDiasISO } from "@/lib/fechas";
import type { CupoDia } from "@/lib/disponibilidad";
import {
  cotizarServicio,
  leerConfigCobro,
  totalCotizacion,
} from "@/lib/cotizador-servicio";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

const DOW = ["D", "L", "M", "M", "J", "V", "S"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fmtColones(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

/**
 * Reserva en línea para servicios (todo lo que no es Lugares): elegís
 * la fecha en el calendario, armás tu reserva con los paquetes y
 * productos del catálogo, pagás el depósito y listo — el chat queda
 * como apoyo, no como requisito.
 *
 * A diferencia de los Lugares, un mismo día puede admitir varios
 * eventos: el calendario bloquea el pasado, la anticipación mínima, y
 * los días donde el proveedor ya llenó su cupo (eventos_por_dia).
 */
export default function ReservaServicio({
  ranchoId,
  items,
  anticipacionDias,
  etiquetaCatalogo,
  detalles = null,
  depositoReserva = 0,
  sinpeNumero = null,
  sinpeTitular = null,
  cuentaBanco = null,
  cuentaNumero = null,
  cuentaTitular = null,
  cuentaTipo = null,
  disponibilidad = {},
  eventosPorDia = null,
  montoMinimo = null,
  categoria = null,
}: {
  ranchoId: string;
  items: RanchoItem[];
  anticipacionDias: number;
  etiquetaCatalogo: string;
  /** Los detalles del servicio (jsonb): de ahí sale cómo cobra el
   *  proveedor y sus tarifas, para cotizar en vivo. */
  detalles?: Record<string, unknown> | null;
  /** Con depósito > 0 y al menos una cuenta de cobro, la reserva pide
   *  el pago por adelantado + comprobante, igual que los Lugares. */
  depositoReserva?: number;
  sinpeNumero?: string | null;
  sinpeTitular?: string | null;
  cuentaBanco?: string | null;
  cuentaNumero?: string | null;
  cuentaTitular?: string | null;
  cuentaTipo?: string | null;
  /** fecha → cuántos eventos ya tiene tomados y cuánto de cada ítem. */
  disponibilidad?: Record<string, CupoDia>;
  /** Cupo de eventos por día del proveedor. null = sin tope. */
  eventosPorDia?: number | null;
  /** Monto mínimo de contratación del negocio (se avisa antes de enviar). */
  montoMinimo?: number | null;
  /** Categoría del negocio — decoración/otros habilitan el alquiler multi-día. */
  categoria?: string | null;
}) {
  const accion = solicitarCotizacion.bind(null, ranchoId);
  const [state, formAction, pending] = useActionState<CotizacionState, FormData>(
    accion,
    undefined,
  );

  const hoy = useMemo(() => new Date(), []);
  const [mesOffset, setMesOffset] = useState(0);
  const [fecha, setFecha] = useState<string | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  // ---------- Cotización según cómo cobra el proveedor ----------
  const config = useMemo(() => leerConfigCobro(detalles), [detalles]);
  const [invitados, setInvitados] = useState("");
  const [horas, setHoras] = useState(0);
  const [dias, setDias] = useState(0);
  const [horasExtra, setHorasExtra] = useState(0);
  const [hora, setHora] = useState("");
  // Elecciones incluidas en la tarifa (grupos "elegí hasta N"): no
  // suman al precio — viajan como texto para el proveedor.
  const [elegidos, setElegidos] = useState<Record<string, boolean>>({});
  const eleccionesPorGrupo = useMemo(
    () => leerEleccionesIncluidas(detalles),
    [detalles],
  );

  // Pedido mínimo en unidades (detalles.minimo_pedido) — invitaciones,
  // promocionales, alquileres. Se avisa acá y la base lo hace cumplir.
  const minimoPedido = useMemo(() => {
    const n = Number((detalles ?? {})["minimo_pedido"]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }, [detalles]);

  // El paquete del catálogo que SUSTITUYE la tarifa base (0067): su
  // precio entra por el pedido, no por la tarifa del jsonb.
  const pb = paqueteBaseElegido(items, cantidades);
  const paqueteBaseSel =
    pb &&
    (config.modalidad === "por_evento" || config.modalidad === "por_paquete")
      ? { nombre: pb.nombre, precio: pb.precio, duracionHoras: pb.duracion_horas }
      : null;

  // Solo hay paso de "armá tu servicio" si el proveedor configuró la
  // tarifa de su modalidad; si no, todo sigue siendo "a cotizar".
  const pasoServicio =
    (config.modalidad === "por_persona" && !!config.tarifaPersona) ||
    (config.modalidad === "por_hora" && !!config.tarifaHora) ||
    ((config.modalidad === "por_evento" || config.modalidad === "por_paquete") &&
      (!!config.tarifaEvento || !!paqueteBaseSel)) ||
    (config.modalidad === "por_dia" && !!config.tarifaDia);

  const lineasBase = cotizarServicio(config, {
    invitados: invitados ? parseInt(invitados, 10) : null,
    horas,
    dias,
    horasExtra,
    paqueteBase: paqueteBaseSel,
  });
  const totalBase = totalCotizacion(lineasBase);

  // Alquiler multi-día: con modalidad por día los días del cotizador
  // definen el rango; decoración/otros lo ofrecen aparte (toldos,
  // baños, sillas que se quedan el fin de semana completo).
  const esAlquiler =
    config.modalidad === "por_dia" ||
    ((categoria === "decoracion" || categoria === "otros") && items.length > 0);

  // ---------- Depósito (solo si el proveedor lo configuró) ----------
  const tieneSinpe = !!sinpeNumero;
  const tieneCuenta = !!cuentaNumero;
  const pagoActivo = depositoReserva > 0 && (tieneSinpe || tieneCuenta);
  const [metodoPago, setMetodoPago] = useState<"sinpe" | "transferencia">(
    tieneSinpe ? "sinpe" : "transferencia",
  );
  const [comprobantePath, setComprobantePath] = useState<string | null>(null);
  const [comprobanteNombre, setComprobanteNombre] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [subidaError, setSubidaError] = useState<string | null>(null);

  // El archivo se sube apenas se elige (mismo bucket que los Lugares):
  // al enviar, la acción solo recibe la ruta ya subida.
  async function subirComprobante(archivo: File | null) {
    setSubidaError(null);
    setComprobantePath(null);
    setComprobanteNombre(null);
    if (!archivo) return;
    setSubiendo(true);
    const supabase = createClient();
    const path = `servicios/${ranchoId}/${Date.now()}-${archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("comprobantes").upload(path, archivo);
    setSubiendo(false);
    if (error) {
      setSubidaError("No se pudo subir el comprobante: " + error.message);
      return;
    }
    setComprobantePath(path);
    setComprobanteNombre(archivo.name);
  }

  // Primer día habilitado: hoy + anticipación del proveedor.
  const minima = useMemo(() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + Math.max(0, anticipacionDias));
    return iso(d.getFullYear(), d.getMonth(), d.getDate());
  }, [hoy, anticipacionDias]);

  const vista = new Date(hoy.getFullYear(), hoy.getMonth() + mesOffset, 1);
  const anio = vista.getFullYear();
  const mes = vista.getMonth();
  const primerDow = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();

  const celdas: (number | null)[] = [
    ...Array.from({ length: primerDow }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  function fijarCantidad(id: string, cantidad: number) {
    setCantidades((prev) => {
      const nueva = Math.max(0, Math.min(999, cantidad));
      const copia = { ...prev };
      if (nueva === 0) delete copia[id];
      else copia[id] = nueva;
      return copia;
    });
  }

  // Un día está lleno cuando el proveedor ya alcanzó su cupo de
  // eventos. Sin cupo configurado nunca se llena por cantidad.
  function diaLleno(valor: string) {
    if (eventosPorDia === null) return false;
    return (disponibilidad[valor]?.eventos ?? 0) >= eventosPorDia;
  }

  const reservadasDelDia = fecha ? (disponibilidad[fecha]?.porItem ?? {}) : {};

  const resumenPedido = totalPedido(items, cantidades);
  const totalEstimado = resumenPedido.total;
  const seleccionados = resumenPedido.unidades;

  // Hasta qué día va el alquiler (se deriva de los días elegidos).
  const fechaFin =
    esAlquiler && fecha && dias > 1 ? sumarDiasISO(fecha, dias - 1) : null;

  // Nombres de las elecciones incluidas, para mandarlas en el pedido.
  const nombresElegidos = items
    .filter((i) => elegidos[i.id])
    .map((i) => i.nombre);

  function alternarEleccion(itemId: string, elegido: boolean) {
    setElegidos((prev) => {
      const copia = { ...prev };
      if (elegido) copia[itemId] = true;
      else delete copia[itemId];
      return copia;
    });
  }

  // La numeración de pasos se arma según lo que este proveedor tenga
  // configurado (cotizador, catálogo, depósito).
  let paso = 1;
  const numServicio = pasoServicio ? ++paso : 0;
  const numPedido = items.length > 0 ? ++paso : 0;
  const numPago = pagoActivo ? ++paso : 0;
  const numDatos = ++paso;
  const listoParaEnviar = !!fecha && (!pagoActivo || !!comprobantePath);

  const totalGeneral = totalBase + totalEstimado;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* ---------- Paso 1: la fecha ---------- */}
      <div>
        <p className={labelCls}>1 · Elegí la fecha de tu evento</p>
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMesOffset((v) => v - 1)}
              disabled={mesOffset === 0}
              aria-label="Mes anterior"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-aventurea-cream-2 text-aventurea-ink disabled:opacity-30"
            >
              ←
            </button>
            <p className="text-[14px] font-bold text-aventurea-ink">
              {MESES[mes]} {anio}
            </p>
            <button
              type="button"
              onClick={() => setMesOffset((v) => v + 1)}
              aria-label="Mes siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-aventurea-cream-2 text-aventurea-ink"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DOW.map((d, i) => (
              <span key={i} className="py-1 text-[10.5px] font-bold uppercase text-zinc-500">
                {d}
              </span>
            ))}
            {celdas.map((dia, i) => {
              if (dia === null) return <span key={`v-${i}`} />;
              const valor = iso(anio, mes, dia);
              const lleno = valor >= minima && diaLleno(valor);
              const deshabilitado = valor < minima || lleno;
              const activo = fecha === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  disabled={deshabilitado}
                  onClick={() => setFecha(valor)}
                  aria-pressed={activo}
                  title={lleno ? "Este día ya está lleno" : undefined}
                  className={`aspect-square rounded-lg text-[13px] font-bold transition-colors ${
                    activo
                      ? "bg-aventurea-navy text-white"
                      : lleno
                        ? "bg-aventurea-cream-2 text-zinc-400 line-through"
                        : deshabilitado
                          ? "text-zinc-300"
                          : "text-aventurea-ink hover:bg-aventurea-cream-2"
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>

          {anticipacionDias > 0 && (
            <p className="mt-2 text-[11.5px] text-zinc-500">
              Este proveedor pide al menos {anticipacionDias} día
              {anticipacionDias === 1 ? "" : "s"} de anticipación.
            </p>
          )}
        </div>
        {fecha && (
          <p className="mt-2 text-[12.5px] font-bold text-aventurea-navy">
            Fecha elegida: {fecha}
          </p>
        )}
      </div>

      <input type="hidden" name="fecha" value={fecha ?? ""} />
      <input type="hidden" name="pedido" value={JSON.stringify(cantidades)} />
      <input type="hidden" name="horas" value={horas || ""} />
      <input type="hidden" name="dias" value={dias || ""} />
      <input type="hidden" name="horas_extra" value={horasExtra || ""} />
      <input type="hidden" name="elecciones" value={JSON.stringify(nombresElegidos)} />

      {/* ---------- Paso: armá tu servicio (según cómo cobra) ---------- */}
      {pasoServicio && (
        <div>
          <p className={labelCls}>{numServicio} · Armá tu servicio</p>
          <div className="flex flex-col gap-4 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 sm:p-5">
            {config.modalidad === "por_persona" && (
              <div>
                <label className={labelCls}>¿Para cuántas personas?</label>
                <input
                  type="number"
                  min={1}
                  value={invitados}
                  onChange={(e) => setInvitados(e.target.value)}
                  placeholder={
                    config.minimoPersonas ? `Mínimo ${config.minimoPersonas}` : "Ej. 80"
                  }
                  className={inputCls}
                />
                <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
                  Este proveedor cobra {fmtColones(config.tarifaPersona!)} por persona
                  {config.minimoPersonas
                    ? ` (mínimo ${config.minimoPersonas} personas)`
                    : ""}
                  .
                </p>
              </div>
            )}

            {config.modalidad === "por_hora" && (
              <Contador
                label="¿Cuántas horas de servicio?"
                ayuda={`${fmtColones(config.tarifaHora!)} por hora${
                  config.horasMinimas ? ` · mínimo ${config.horasMinimas} horas` : ""
                }`}
                valor={horas}
                sufijo={horas === 1 ? "hora" : "horas"}
                onCambiar={(v) => setHoras(v)}
              />
            )}

            {(config.modalidad === "por_evento" || config.modalidad === "por_paquete") && (
              <>
                {paqueteBaseSel ? (
                  <p className="text-[13.5px] text-aventurea-ink-soft">
                    Paquete elegido:{" "}
                    <strong className="text-aventurea-ink">{paqueteBaseSel.nombre}</strong>
                    {paqueteBaseSel.precio !== null
                      ? ` — ${fmtColones(paqueteBaseSel.precio)}`
                      : ""}
                    {paqueteBaseSel.duracionHoras
                      ? ` — incluye ${paqueteBaseSel.duracionHoras} hora${paqueteBaseSel.duracionHoras === 1 ? "" : "s"} de servicio`
                      : ""}
                    . Sustituye la tarifa base (no se cobran las dos).
                  </p>
                ) : config.tarifaEvento ? (
                  <p className="text-[13.5px] text-aventurea-ink-soft">
                    {config.modalidad === "por_paquete" ? "Paquete base" : "Tarifa por evento"}:{" "}
                    <strong className="text-aventurea-ink">
                      {fmtColones(config.tarifaEvento)}
                    </strong>
                    {config.horasIncluidas
                      ? ` — incluye ${config.horasIncluidas} hora${config.horasIncluidas === 1 ? "" : "s"} de servicio`
                      : ""}
                    .
                  </p>
                ) : null}
                {config.horaExtra && (
                  <Contador
                    label="¿Horas extra?"
                    ayuda={`${fmtColones(config.horaExtra)} por cada hora adicional`}
                    valor={horasExtra}
                    sufijo={horasExtra === 1 ? "hora extra" : "horas extra"}
                    onCambiar={(v) => setHorasExtra(v)}
                  />
                )}
              </>
            )}

            {config.modalidad === "por_dia" && (
              <div>
                <Contador
                  label="¿Cuántos días de alquiler?"
                  ayuda={`${fmtColones(config.tarifaDia!)} por día`}
                  valor={dias}
                  sufijo={dias === 1 ? "día" : "días"}
                  onCambiar={(v) => setDias(v)}
                />
                {fechaFin && (
                  <p className="mt-1.5 text-[12.5px] font-bold text-aventurea-navy">
                    Tu alquiler va del {fecha} al {fechaFin} — el inventario
                    queda apartado todos esos días.
                  </p>
                )}
              </div>
            )}

            {lineasBase.length > 0 && (
              <div className="rounded-xl bg-aventurea-cream-2 px-4 py-3">
                {lineasBase.map((l) => (
                  <p
                    key={l.etiqueta}
                    className="flex items-center justify-between gap-3 py-0.5 text-[12.5px] text-aventurea-ink-soft"
                  >
                    <span>{l.etiqueta}</span>
                    <span className="font-bold text-aventurea-ink">{fmtColones(l.monto)}</span>
                  </p>
                ))}
                <p className="mt-1.5 flex items-center justify-between gap-3 border-t border-aventurea-line pt-2 text-[13.5px] font-bold text-aventurea-ink">
                  <span>Estimado del servicio</span>
                  <span className="text-aventurea-navy">{fmtColones(totalBase)}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- Paso: armá tu reserva con el catálogo ---------- */}
      {items.length > 0 && (
        <div>
          <p className={labelCls}>
            {numPedido} · Elegí del {etiquetaCatalogo.toLowerCase()}
            {pasoServicio ? " (opcional)" : ""}
          </p>
          <CatalogoPaquetes
            items={items}
            cantidades={cantidades}
            reservadasPorItem={reservadasDelDia}
            hayFecha={!!fecha}
            onCambiar={fijarCantidad}
            eleccionesPorGrupo={eleccionesPorGrupo}
            elegidos={elegidos}
            onElegir={alternarEleccion}
          />
          {seleccionados > 0 && (
            <p className="mt-2 text-[13px] font-bold text-aventurea-ink">
              {seleccionados} ítem{seleccionados === 1 ? "" : "s"} elegido
              {seleccionados === 1 ? "" : "s"}
              {totalEstimado > 0 && (
                <>
                  {" "}
                  · {lineasBase.length > 0 ? "Subtotal del pedido" : "Total estimado"}:{" "}
                  <span className="text-aventurea-navy">{fmtColones(totalEstimado)}</span>
                </>
              )}
              {resumenPedido.hayACotizar && (
                <span className="font-normal text-aventurea-ink-soft">
                  {" "}
                  · algunos ítems se cotizan aparte
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* ---------- El total de todo, siempre a la vista ---------- */}
      {lineasBase.length > 0 && totalGeneral > totalBase && (
        <p className="rounded-full bg-aventurea-navy px-4 py-3 text-[14px] font-bold text-white">
          Total estimado (servicio + pedido):{" "}
          <span className="float-right">{fmtColones(totalGeneral)}</span>
        </p>
      )}

      {/* ---------- Paso: depósito (si el proveedor cobra por agendar) ---------- */}
      {pagoActivo && (
        <div>
          <p className={labelCls}>{numPago} · Pagá el depósito para agendar</p>
          <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 sm:p-5">
            <p className="text-[13.5px] text-aventurea-ink-soft">
              Para agendar tu fecha, este proveedor pide un depósito de{" "}
              <strong className="text-aventurea-ink">{fmtColones(depositoReserva)}</strong>.
              Hacé el pago y subí el comprobante — tu reserva queda en
              aprobación hasta que lo confirme.
            </p>

            {tieneSinpe && tieneCuenta && (
              <div className="mt-4 flex gap-2">
                {(["sinpe", "transferencia"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodoPago(m)}
                    aria-pressed={metodoPago === m}
                    className={`rounded-lg border px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                      metodoPago === m
                        ? "border-aventurea-navy bg-aventurea-navy text-white"
                        : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-navy"
                    }`}
                  >
                    {m === "sinpe" ? "SINPE Móvil" : "Transferencia"}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-xl bg-aventurea-cream-2 p-4 text-[13.5px] text-aventurea-ink">
              {metodoPago === "sinpe" && tieneSinpe ? (
                <>
                  <p>
                    SINPE Móvil: <strong>{sinpeNumero}</strong>
                  </p>
                  {sinpeTitular && (
                    <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
                      A nombre de {sinpeTitular}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    {cuentaBanco ? `${cuentaBanco} · ` : ""}
                    {cuentaTipo ? `${cuentaTipo} ` : ""}
                    <strong>{cuentaNumero}</strong>
                  </p>
                  {cuentaTitular && (
                    <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
                      A nombre de {cuentaTitular}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="mt-4">
              <label className={labelCls}>Comprobante del depósito</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => subirComprobante(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-aventurea-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-aventurea-navy file:px-4 file:py-2 file:text-[12.5px] file:font-bold file:text-white"
              />
              {subiendo && (
                <p className="mt-2 text-[12.5px] text-aventurea-ink-soft">Subiendo…</p>
              )}
              {comprobantePath && (
                <p className="mt-2 text-[12.5px] font-bold text-aventurea-green">
                  ✓ Comprobante subido{comprobanteNombre ? ` (${comprobanteNombre})` : ""}
                </p>
              )}
              {subidaError && (
                <p className="mt-2 text-[12.5px] text-red-700">{subidaError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <input type="hidden" name="metodo_pago" value={pagoActivo ? metodoPago : ""} />
      <input type="hidden" name="comprobante_path" value={comprobantePath ?? ""} />

      {/* ---------- Paso: los datos ---------- */}
      <div>
        <p className={labelCls}>{numDatos} · Contanos de tu evento</p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Con cobro por persona la cantidad ya se pidió arriba y
              manda la cotización; acá solo viaja en el form. */}
          {config.modalidad === "por_persona" && pasoServicio ? (
            <input type="hidden" name="invitados" value={invitados} />
          ) : (
            <div>
              <label className={labelCls}>Cantidad de invitados (opcional)</label>
              <input
                type="number"
                name="invitados"
                min={1}
                placeholder="Ej. 80"
                value={invitados}
                onChange={(e) => setInvitados(e.target.value)}
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Tipo de evento (opcional)</label>
            <input
              type="text"
              name="tipo_evento"
              placeholder="Ej. Cumpleaños, boda, corporativo..."
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>¿A qué hora es tu evento? (opcional)</label>
            <input
              type="time"
              name="hora_inicio"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className={inputCls}
            />
            <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
              Le ayuda al proveedor a cuidar su agenda y evitar choques de
              horario ese día.
            </p>
          </div>
          {esAlquiler && config.modalidad !== "por_dia" && (
            <div className="sm:col-span-2">
              <Contador
                label="¿Cuántos días necesitás el alquiler? (opcional)"
                ayuda={
                  fechaFin
                    ? `Del ${fecha} al ${fechaFin} — el inventario queda apartado todos esos días.`
                    : "Si tu alquiler es de varios días (ej. de viernes a domingo), el inventario se aparta todo el rango."
                }
                valor={dias}
                sufijo={dias === 1 ? "día" : "días"}
                onCambiar={(v) => setDias(v)}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={labelCls}>Notas para el proveedor (opcional)</label>
            <textarea
              name="notas"
              rows={3}
              placeholder="Ej. El evento es en Santa Ana, al aire libre. ¿Tenés opción vegetariana?"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ---------- Avisos de mínimos, antes de intentar enviar ---------- */}
      {montoMinimo !== null &&
        montoMinimo > 0 &&
        totalGeneral > 0 &&
        totalGeneral < montoMinimo && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
            Este negocio toma pedidos desde {fmtColones(montoMinimo)}. Tu pedido
            va en {fmtColones(totalGeneral)} — agregale{" "}
            {fmtColones(montoMinimo - totalGeneral)} más para poder reservar.
          </p>
        )}
      {minimoPedido !== null && seleccionados > 0 && seleccionados < minimoPedido && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          Este negocio despacha pedidos desde {minimoPedido} unidades y tu
          pedido lleva {seleccionados}.
        </p>
      )}

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{state.error}</p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending || subiendo || !listoParaEnviar}
          className="flex h-11 w-full items-center justify-center rounded-full bg-aventurea-navy px-6 text-sm font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-60 sm:w-fit"
        >
          {pending
            ? "Enviando..."
            : !fecha
              ? "Elegí una fecha para continuar"
              : pagoActivo && !comprobantePath
                ? "Subí el comprobante para reservar"
                : pagoActivo
                  ? "Reservar y pagar el depósito"
                  : "Reservar mi fecha"}
        </button>
        <p className="mt-2 text-[12px] text-aventurea-ink-soft">
          {pagoActivo
            ? "Tu reserva queda en aprobación con tu pedido ya detallado. El proveedor la revisa y te confirma — y si tenés dudas, el chat queda abierto."
            : "Tu reserva queda registrada con tu pedido ya detallado, en aprobación del proveedor. Si tenés dudas, el chat queda abierto."}
        </p>
      </div>
    </form>
  );
}

/** Stepper −/+ para horas o días, con la tarifa como ayuda. */
function Contador({
  label,
  ayuda,
  valor,
  sufijo,
  onCambiar,
}: {
  label: string;
  ayuda: string;
  valor: number;
  sufijo: string;
  onCambiar: (v: number) => void;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onCambiar(Math.max(0, valor - 1))}
          disabled={valor === 0}
          aria-label="Quitar"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-aventurea-line text-aventurea-ink disabled:opacity-30"
        >
          −
        </button>
        <span className="min-w-[90px] text-center text-[14px] font-bold text-aventurea-ink">
          {valor} {sufijo}
        </span>
        <button
          type="button"
          onClick={() => onCambiar(Math.min(48, valor + 1))}
          aria-label="Agregar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-aventurea-navy text-white"
        >
          +
        </button>
      </div>
      <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">{ayuda}</p>
    </div>
  );
}
