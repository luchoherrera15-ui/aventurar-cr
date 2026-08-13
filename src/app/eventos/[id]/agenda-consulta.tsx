"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CatalogoPaquetes from "@/components/catalogo-paquetes";
import type { RanchoItem } from "@/app/mi-negocio/types";
import { horaBonita } from "@/app/citas/tipos";
import {
  calcularDisponibilidad,
  instanteEnZona,
  type BloqueoDisponibilidad,
  type CitaExistente,
} from "@/lib/agenda/disponibilidad";
import { abrirChatConNegocio } from "@/lib/chat-panel";
import {
  leerEleccionesIncluidas,
  paqueteBaseElegido,
  totalPedido,
} from "@/lib/catalogo";
import {
  cotizarServicio,
  leerConfigCobro,
  totalCotizacion,
} from "@/lib/cotizador-servicio";
import { sumarDiasISO } from "@/lib/fechas";
import {
  armarPrimerMensaje,
  duracionAgenda,
  etiquetaDuracion,
  finDeEvento,
  horarioDeEventos,
  DIAS_VISIBLES,
  EVENTO_CERRAR_MODAL,
  INTERVALO_MINUTOS,
  type LineaPedido,
} from "../agenda-consulta";

/**
 * ============================================================
 * "VER DISPONIBILIDAD" — la agenda por horas de un proveedor de
 * eventos, en MODO CHAT.
 * ============================================================
 *
 * Reemplaza al formulario de reserva con depósito que vivía acá. La
 * decisión de producto: fuera de los LUGARES (ranchos y salones, que
 * siguen con su agenda por día, su hold y su SINPE — el único flujo
 * que cobra plata real hoy), un proveedor de eventos trabaja POR HORAS
 * y POR SERVICIOS, igual que la vertical de Citas.
 *
 * Y al tocar un espacio libre NO SE RESERVA NADA: se abre el chat con
 * la fecha, la hora y lo que se armó como primer mensaje. Cero holds,
 * cero depósito, cero comprobante — por eso este componente no importa
 * ninguna server action, no toca `storage`, y no necesita que la
 * persona tenga cuenta (el panel de chat abre una sesión anónima si
 * hace falta).
 *
 * Lo que SÍ se conservó del formulario viejo: el cotizador en vivo
 * (steppers de horas, paquete base, invitados) y el catálogo. Eso es
 * lo que hace que el primer mensaje llegue con el pedido armado en vez
 * de un "hola, ¿cuánto cobrás?".
 *
 * Las horas salen del motor puro `calcularDisponibilidad` (0061), el
 * mismo que usa /citas — no sabe qué es un vertical, así que se reusa
 * tal cual. Lo único propio de Eventos es la ventana de arranques
 * (ver `horarioDeEventos` en ../agenda-consulta.ts).
 */

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

const DIAS_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTO = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "set", "oct", "nov", "dic",
];

function fmtColones(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

function fechaISOLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Fila de la vista pública `disponibilidad_citas` (0081/0109). */
type FranjaOcupada = {
  hora_inicio: string;
  duracion_minutos: number | null;
  miembro_id: string | null;
  buffer_minutos: number | null;
};

/**
 * Fila de `bloqueos_agenda_publicos`: cuándo NO se puede, jamás el
 * porqué. Se declara acá y no se importa de /citas a propósito — es
 * una forma de dato, no una dependencia entre verticales.
 */
export type BloqueoPublico = {
  miembro_id: string | null;
  inicio: string;
  fin: string;
};

export default function AgendaConsulta({
  ranchoId,
  nombreNegocio,
  items,
  etiquetaCatalogo,
  detalles = null,
  anticipacionDias = 0,
  zonaHoraria,
  bloqueos = [],
  categoria = null,
  montoMinimo = null,
}: {
  ranchoId: string;
  nombreNegocio: string;
  items: RanchoItem[];
  etiquetaCatalogo: string;
  /** Los detalles del negocio (jsonb): de ahí sale cómo cobra. */
  detalles?: Record<string, unknown> | null;
  /** Días de anticipación que pide el proveedor (cierra los primeros). */
  anticipacionDias?: number;
  /** Zona IANA del negocio — el motor traduce los bloqueos con ella. */
  zonaHoraria: string;
  /** Bloqueos vigentes (vacaciones, calendario del dueño). */
  bloqueos?: BloqueoPublico[];
  /** Decoración/otros habilitan el alquiler de varios días. */
  categoria?: string | null;
  /** Monto mínimo de contratación — se avisa, no se bloquea. */
  montoMinimo?: number | null;
}) {
  const config = useMemo(() => leerConfigCobro(detalles), [detalles]);
  const eleccionesPorGrupo = useMemo(() => leerEleccionesIncluidas(detalles), [detalles]);

  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [invitados, setInvitados] = useState("");
  const [horas, setHoras] = useState(0);
  const [dias, setDias] = useState(0);
  const [horasExtra, setHorasExtra] = useState(0);
  const [elegidos, setElegidos] = useState<Record<string, boolean>>({});
  const [tipoEvento, setTipoEvento] = useState("");
  const [notas, setNotas] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [ocupadas, setOcupadas] = useState<FranjaOcupada[]>([]);
  const tiraRef = useRef<HTMLDivElement>(null);

  // ---------- Cotización en vivo ----------
  const pb = paqueteBaseElegido(items, cantidades);
  const paqueteBaseSel =
    pb && (config.modalidad === "por_evento" || config.modalidad === "por_paquete")
      ? { nombre: pb.nombre, precio: pb.precio, duracionHoras: pb.duracion_horas }
      : null;

  const seleccion = {
    invitados: invitados ? parseInt(invitados, 10) : null,
    horas,
    dias,
    horasExtra,
    paqueteBase: paqueteBaseSel,
  };

  // Solo hay paso de "armá tu servicio" si el proveedor configuró la
  // tarifa de su modalidad; si no, todo sigue siendo "a cotizar".
  const pasoServicio =
    (config.modalidad === "por_persona" && !!config.tarifaPersona) ||
    (config.modalidad === "por_hora" && !!config.tarifaHora) ||
    ((config.modalidad === "por_evento" || config.modalidad === "por_paquete") &&
      (!!config.tarifaEvento || !!paqueteBaseSel)) ||
    (config.modalidad === "por_dia" && !!config.tarifaDia);

  const lineasBase = cotizarServicio(config, seleccion);
  const totalBase = totalCotizacion(lineasBase);
  const resumenPedido = totalPedido(items, cantidades);
  const totalGeneral = totalBase + resumenPedido.total;

  // Alquiler de varios días: con modalidad por día lo definen los días
  // del cotizador; decoración/otros lo ofrecen aparte (toldos, sillas,
  // baños que se quedan el fin de semana completo).
  const esAlquiler =
    config.modalidad === "por_dia" ||
    ((categoria === "decoracion" || categoria === "otros") && items.length > 0);

  // Pedido mínimo en unidades (detalles.minimo_pedido).
  const minimoPedido = useMemo(() => {
    const n = Number((detalles ?? {})["minimo_pedido"]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }, [detalles]);

  // ---------- Cuánto dura, que es lo que define qué horas caben ----------
  const { minutos: duracionMinutos, supuesta: duracionSupuesta } = duracionAgenda({
    config,
    seleccion,
    items,
    cantidades,
  });

  // ---------- Los días ----------
  const dias28 = useMemo(() => {
    // El "hoy" del NEGOCIO, no el del aparato: en el servidor el reloj
    // es UTC y después de las 6 de la tarde en Costa Rica la tira
    // arrancaría un día corrida.
    const [ay, am, ad] = instanteEnZona(new Date().toISOString(), zonaHoraria)
      .fecha.split("-")
      .map(Number);
    const hoy = new Date(ay, am - 1, ad);
    const espera = Math.max(0, anticipacionDias);
    return Array.from({ length: DIAS_VISIBLES }, (_, i) => {
      const d = new Date(hoy);
      d.setDate(d.getDate() + i);
      return {
        date: d,
        iso: fechaISOLocal(d),
        dow: d.getDay(),
        // Lo único que cierra un día es la anticipación que pide el
        // proveedor: un proveedor de eventos no publica horario
        // semanal en ningún lado, y cerrarle días por nuestra cuenta
        // sería inventarle una restricción que él nunca puso.
        abierto: i >= espera,
      };
    });
  }, [zonaHoraria, anticipacionDias]);

  // Derivada, no un efecto: si el día marcado dejó de servir, la
  // elección se corre sola al primero que sí.
  const fechaElegida = dias28.some((d) => d.iso === fecha && d.abierto)
    ? fecha
    : (dias28.find((d) => d.abierto)?.iso ?? "");
  const diaElegido = dias28.find((d) => d.iso === fechaElegida);

  // Las franjas que el proveedor ya tiene tomadas ese día (vista
  // pública, sin datos de nadie). Se piden al cambiar de día.
  useEffect(() => {
    if (!fechaElegida) return;
    let vigente = true;
    // El cliente de Supabase (GoTrue + Realtime) se carga solo cuando
    // alguien abre la agenda de verdad, no al pintar la página.
    void import("@/lib/supabase/client").then(async ({ createClient }) => {
      const { data } = await createClient()
        .from("disponibilidad_citas")
        .select("hora_inicio, duracion_minutos, miembro_id, buffer_minutos")
        .eq("rancho_id", ranchoId)
        .eq("fecha", fechaElegida);
      if (vigente) setOcupadas((data ?? []) as FranjaOcupada[]);
    });
    return () => {
      vigente = false;
    };
  }, [ranchoId, fechaElegida]);

  // ---------- Las horas ----------
  const disponibilidad = !fechaElegida
    ? null
    : calcularDisponibilidad({
        fecha: fechaElegida,
        zonaHoraria,
        horarioNegocio: horarioDeEventos(duracionMinutos),
        // Sin equipo: el negocio entero es un solo recurso. Un
        // proveedor de eventos no tiene el módulo de Equipo, así que
        // `horarios_recurso` y `servicios_recurso` están siempre
        // vacíos para él.
        recursos: [],
        duracionMinutos,
        citas: ocupadas.map<CitaExistente>((c) => ({
          miembroId: c.miembro_id,
          horaInicio: c.hora_inicio,
          // Una reserva vieja sin duración guardada ocupa una hora:
          // más conservador que la media hora de una cita, que es lo
          // mínimo que dura cualquier servicio de evento.
          duracionMinutos: c.duracion_minutos ?? 60,
          bufferMinutos: c.buffer_minutos ?? 0,
        })),
        bloqueos: bloqueos.map<BloqueoDisponibilidad>((b) => ({
          miembroId: b.miembro_id,
          inicio: b.inicio,
          fin: b.fin,
        })),
        intervaloMinutos: INTERVALO_MINUTOS,
        ahora: new Date(),
        // Una hora de margen: no es una restricción del proveedor
        // (acá no se agenda nada), es no ofrecer un arranque que ya
        // pasó mientras la persona miraba la pantalla.
        anticipacionMinHoras: 1,
      });
  const horasLibres = disponibilidad?.porRecurso[""] ?? [];
  const horaElegida = horasLibres.includes(hora) ? hora : "";

  const fin = horaElegida ? finDeEvento(horaElegida, duracionMinutos) : null;
  const fechaFin = esAlquiler && fechaElegida && dias > 1 ? sumarDiasISO(fechaElegida, dias - 1) : null;

  const nombresElegidos = items.filter((i) => elegidos[i.id]).map((i) => i.nombre);

  function fijarCantidad(id: string, cantidad: number) {
    setCantidades((prev) => {
      const nueva = Math.max(0, Math.min(999, cantidad));
      const copia = { ...prev };
      if (nueva === 0) delete copia[id];
      else copia[id] = nueva;
      return copia;
    });
  }

  function alternarEleccion(itemId: string, elegido: boolean) {
    setElegidos((prev) => {
      const copia = { ...prev };
      if (elegido) copia[itemId] = true;
      else delete copia[itemId];
      return copia;
    });
  }

  /**
   * El único botón de acción de toda la pantalla: arma el resumen, lo
   * manda como primer mensaje y abre el chat con el proveedor. No hay
   * server action, no hay reserva, no hay nada que confirmar después.
   */
  function consultar() {
    if (!fechaElegida || !horaElegida) return;
    const pedido: LineaPedido[] = items
      .filter((i) => (cantidades[i.id] ?? 0) > 0)
      .map((i) => ({
        nombre: i.nombre,
        cantidad: cantidades[i.id],
        precio: i.precio,
        unidad: i.unidad,
      }));

    abrirChatConNegocio({
      ranchoId,
      nombre: nombreNegocio,
      primerMensaje: armarPrimerMensaje({
        fecha: fechaElegida,
        hora: horaElegida,
        duracionMinutos,
        duracionSupuesta,
        fechaFin,
        tipoEvento,
        invitados: seleccion.invitados,
        paqueteBase: paqueteBaseSel?.nombre ?? null,
        elecciones: nombresElegidos,
        lineasServicio: lineasBase,
        pedido,
        hayACotizar: resumenPedido.hayACotizar,
        notas,
      }),
    });
    // El panel de chat vive en z-50 y este modal en z-[100]: sin
    // cerrarlo, el chat que se acaba de abrir queda tapado por el modal
    // que lo abrió. Además cierra en el MISMO tick que el clic, así que
    // no hace falta un candado contra el doble toque: el botón ya no
    // está en pantalla cuando llegaría el segundo.
    window.dispatchEvent(new Event(EVENTO_CERRAR_MODAL));
  }

  function moverTira(direccion: -1 | 1) {
    tiraRef.current?.scrollBy({ left: direccion * 280, behavior: "smooth" });
  }

  // La numeración de pasos se arma según lo que este proveedor tenga
  // configurado (cotizador, catálogo).
  let paso = 0;
  const numServicio = pasoServicio ? ++paso : 0;
  const numPedido = items.length > 0 ? ++paso : 0;
  const numFecha = ++paso;
  const numHora = ++paso;
  const numDatos = ++paso;

  return (
    <div className="flex flex-col gap-6 pt-1">
      {/* ---------- Armá tu servicio (según cómo cobra) ---------- */}
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
                  Este proveedor cobra {fmtColones(config.tarifaPersona ?? 0)} por persona
                  {config.minimoPersonas ? ` (mínimo ${config.minimoPersonas} personas)` : ""}.
                </p>
              </div>
            )}

            {config.modalidad === "por_hora" && (
              <Contador
                label="¿Cuántas horas de servicio?"
                ayuda={`${fmtColones(config.tarifaHora ?? 0)} por hora${
                  config.horasMinimas ? ` · mínimo ${config.horasMinimas} horas` : ""
                }`}
                valor={horas}
                sufijo={horas === 1 ? "hora" : "horas"}
                onCambiar={setHoras}
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
                    onCambiar={setHorasExtra}
                  />
                )}
              </>
            )}

            {config.modalidad === "por_dia" && (
              <Contador
                label="¿Cuántos días de alquiler?"
                ayuda={`${fmtColones(config.tarifaDia ?? 0)} por día`}
                valor={dias}
                sufijo={dias === 1 ? "día" : "días"}
                onCambiar={setDias}
              />
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

      {/* ---------- El catálogo ---------- */}
      {items.length > 0 && (
        <div>
          <p className={labelCls}>
            {numPedido} · Elegí del {etiquetaCatalogo.toLowerCase()}
            {pasoServicio ? " (opcional)" : ""}
          </p>
          <CatalogoPaquetes
            items={items}
            cantidades={cantidades}
            // Sin agenda por día ya no hay "quedan N unidades para esa
            // fecha": ese contador salía del cupo diario que llevaban
            // las reservas, y acá no se crea ninguna.
            reservadasPorItem={{}}
            hayFecha={false}
            onCambiar={fijarCantidad}
            eleccionesPorGrupo={eleccionesPorGrupo}
            elegidos={elegidos}
            onElegir={alternarEleccion}
          />
          {resumenPedido.unidades > 0 && (
            <p className="mt-2 text-[13px] font-bold text-aventurea-ink">
              {resumenPedido.unidades} ítem{resumenPedido.unidades === 1 ? "" : "s"} elegido
              {resumenPedido.unidades === 1 ? "" : "s"}
              {resumenPedido.total > 0 && (
                <>
                  {" "}
                  · {lineasBase.length > 0 ? "Subtotal del pedido" : "Total estimado"}:{" "}
                  <span className="text-aventurea-navy">{fmtColones(resumenPedido.total)}</span>
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

      {lineasBase.length > 0 && totalGeneral > totalBase && (
        <p className="rounded-xl bg-aventurea-navy px-4 py-3 text-[14px] font-bold text-white">
          Total estimado (servicio + pedido):{" "}
          <span className="float-right">{fmtColones(totalGeneral)}</span>
        </p>
      )}

      {/* ---------- El día ---------- */}
      <div>
        <div className="flex items-center justify-between">
          <p className={`${labelCls} mb-0`}>{numFecha} · Elegí el día</p>
          <span className="flex gap-1">
            <BotonFlecha direccion={-1} onClick={() => moverTira(-1)} />
            <BotonFlecha direccion={1} onClick={() => moverTira(1)} />
          </span>
        </div>
        <div
          ref={tiraRef}
          className="mt-2.5 flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none]"
        >
          {dias28.map((d) => {
            const elegido = d.iso === fechaElegida;
            return (
              <button
                key={d.iso}
                type="button"
                disabled={!d.abierto}
                onClick={() => setFecha(d.iso)}
                aria-pressed={elegido}
                className={`flex w-[62px] shrink-0 flex-col items-center gap-0.5 rounded-2xl border py-3 transition-colors ${
                  elegido
                    ? "border-aventurea-navy bg-aventurea-navy text-white shadow-[0_10px_24px_-12px_rgba(22,41,94,0.7)]"
                    : !d.abierto
                      ? "cursor-not-allowed border-[#eef2f9] bg-[#fafbfd] text-zinc-300"
                      : "border-aventurea-line bg-aventurea-surface text-aventurea-ink hover:border-aventurea-navy"
                }`}
              >
                <span className="text-[10.5px] font-bold lowercase">{DIAS_CORTO[d.dow]}</span>
                <span className="text-[17px] font-extrabold leading-none">{d.date.getDate()}</span>
                <span className="text-[10px] font-semibold opacity-70">
                  {MESES_CORTO[d.date.getMonth()]}
                </span>
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

      {/* ---------- La hora ---------- */}
      <div>
        <p className={labelCls}>{numHora} · ¿A qué hora arranca tu evento?</p>
        <p className="mb-2.5 text-[12.5px] text-aventurea-ink-soft">
          {duracionSupuesta
            ? `Estamos calculando con un bloque de ${etiquetaDuracion(duracionMinutos)} — lo afinan por el chat.`
            : `Tu evento dura ${etiquetaDuracion(duracionMinutos)}: mostramos las horas que le calzan a la agenda del proveedor.`}
        </p>
        {horasLibres.length === 0 ? (
          <p className="rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-4 text-[13px] text-aventurea-ink-soft">
            No quedan horas libres ese día — probá con otra fecha, o
            escribile igual por el chat y lo acomodan entre los dos.
          </p>
        ) : (
          <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {horasLibres.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHora(h)}
                aria-pressed={h === horaElegida}
                className={`rounded-xl border px-3 py-2.5 text-center text-[13.5px] font-bold transition-colors ${
                  h === horaElegida
                    ? "border-2 border-aventurea-navy bg-[#f4f7fd] text-aventurea-ink"
                    : "border-aventurea-line bg-aventurea-surface text-aventurea-ink hover:border-aventurea-navy"
                }`}
              >
                {horaBonita(h)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Contanos de tu evento ---------- */}
      <div>
        <p className={labelCls}>{numDatos} · Contanos de tu evento</p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Con cobro por persona la cantidad ya se pidió arriba. */}
          {!(config.modalidad === "por_persona" && pasoServicio) && (
            <div>
              <label className={labelCls}>Cantidad de invitados (opcional)</label>
              <input
                type="number"
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
              placeholder="Ej. Cumpleaños, boda, corporativo..."
              value={tipoEvento}
              onChange={(e) => setTipoEvento(e.target.value)}
              className={inputCls}
            />
          </div>
          {esAlquiler && config.modalidad !== "por_dia" && (
            <div className="sm:col-span-2">
              <Contador
                label="¿Cuántos días necesitás el alquiler? (opcional)"
                ayuda={
                  fechaFin
                    ? `Del ${fechaElegida} al ${fechaFin}.`
                    : "Si tu alquiler es de varios días (ej. de viernes a domingo), decilo acá y va en la consulta."
                }
                valor={dias}
                sufijo={dias === 1 ? "día" : "días"}
                onCambiar={setDias}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={labelCls}>Notas para el proveedor (opcional)</label>
            <textarea
              rows={3}
              placeholder="Ej. El evento es en Santa Ana, al aire libre. ¿Tenés opción vegetariana?"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ---------- Avisos de mínimos: informan, no bloquean ---------- */}
      {montoMinimo !== null && montoMinimo > 0 && totalGeneral > 0 && totalGeneral < montoMinimo && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          Este negocio toma pedidos desde {fmtColones(montoMinimo)} y el tuyo va
          en {fmtColones(totalGeneral)} — podés consultarle igual.
        </p>
      )}
      {minimoPedido !== null &&
        resumenPedido.unidades > 0 &&
        resumenPedido.unidades < minimoPedido && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
            Este negocio despacha pedidos desde {minimoPedido} unidades y el tuyo
            lleva {resumenPedido.unidades}.
          </p>
        )}

      {/* ---------- El resumen y el único botón ---------- */}
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 sm:p-5">
        <p className="text-[13.5px] font-bold text-aventurea-ink">
          {diaElegido && horaElegida && fin ? (
            <>
              {DIAS_CORTO[diaElegido.dow]} {diaElegido.date.getDate()} de{" "}
              {MESES_CORTO[diaElegido.date.getMonth()]} · {horaBonita(horaElegida)} a{" "}
              {horaBonita(fin.hora)}
              {fin.diaSiguiente ? " del día siguiente" : ""}
            </>
          ) : (
            <span className="font-normal text-aventurea-ink-soft">
              Elegí el día y la hora para consultar.
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={consultar}
          disabled={!fechaElegida || !horaElegida}
          className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-aventurea-navy px-6 text-sm font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50 sm:w-fit"
        >
          Consultar por el chat
        </button>
        <p className="mt-2 text-[12px] leading-relaxed text-aventurea-ink-soft">
          No se aparta nada ni se paga nada: le llega un mensaje a{" "}
          {nombreNegocio} con tu fecha, tu hora y lo que armaste, y siguen
          la conversación por el chat. No hace falta tener cuenta.
        </p>
      </div>
    </div>
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

function BotonFlecha({ direccion, onClick }: { direccion: -1 | 1; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={direccion === -1 ? "Fechas anteriores" : "Más fechas"}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-aventurea-line bg-aventurea-surface text-aventurea-ink transition-colors hover:border-aventurea-navy"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-3.5 w-3.5 ${direccion === -1 ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}
