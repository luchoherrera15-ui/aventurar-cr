"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  IconChartBars,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconTrash,
  IconWarning,
} from "@/components/icons";
import {
  CATEGORIAS_GASTO,
  GASTO_LABEL,
  fmtColones,
  saldoPendiente,
  totalEvento,
  type Gasto,
  type ReservaFinanzas,
  type ResumenFinanzas,
} from "@/lib/finanzas";
import { fechaLargaCR } from "@/lib/fechas";
import SeccionPlegable from "@/components/seccion-plegable";
import {
  Card,
  CardVacia,
  ContextoFila,
  FilaPanel,
  PildoraEstado,
} from "@/components/panel/piezas";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  CIFRA,
  CUERPO_SUAVE,
  DETALLE,
  ESTADO_AVISO,
  ESTADO_PILDORA,
  EYEBROW_NEUTRO,
  GAP_METRICAS,
  GAP_TABLERO,
  RADIO_METRICA,
  ROTULO_CAMPO,
  ROTULO_CIFRA,
  SUPERFICIE_HUNDIDA,
  SUPERFICIE_PANEL,
  TITULO_CARD,
  type EstadoPanel,
} from "@/components/panel/sistema";
import GraficoSemanal from "./grafico-semanal";

/**
 * FINANZAS — la pantalla de la plata, con el lenguaje de
 * `referencia/bookeapaneles.html`: tarjeta blanca sobre el lienzo gris,
 * encabezado con kicker + título + algo a la derecha, y la MISMA fila de
 * listado que el resto del panel (contexto · barrita de estado · quién
 * y qué · monto a la derecha).
 *
 * ── LA REGLA DE ESTA PANTALLA: LOS NÚMEROS ─────────────────────────
 * Acá lo único que importa de verdad es que un monto se lea. Por eso:
 * · Todo monto va `tabular-nums` — sin eso una columna de plata baila de
 *   ancho renglón a renglón y deja de leerse como columna.
 * · Todo monto va alineado a la DERECHA y con `whitespace-nowrap`. Nada
 *   de `truncate` sobre una cifra: «₡12.500.000» cortado en «₡12.500…»
 *   no es un número redondeado, es un número equivocado.
 * · Lo que sí puede truncarse es la línea de detalle (el tipo de evento,
 *   la categoría del gasto): ahí perder una palabra no cambia una cuenta.
 * · Los tres indicadores de arriba parten a 1 columna hasta `md` y no a
 *   `sm`: a 640px la columna quedaba en ~170px y la cifra grande
 *   rozaba el borde.
 *
 * ── EL COLOR NO ES EL DATO ─────────────────────────────────────────
 * Antes la cifra grande de cada indicador venía teñida (verde/azul/rojo)
 * y el bloque de vencidos era una caja roja entera. Ahora la cifra va
 * SIEMPRE en la tinta más fuerte (18,10:1) y el significado lo llevan el
 * disco de ícono, la barrita de 4px de la fila y la píldora de estado —
 * los mismos cinco estados del sistema, medidos una sola vez. El rojo
 * queda para lo que de verdad está mal: un saldo vencido, un neto en
 * negativo.
 *
 * Ni un cálculo cambió: `resumenFinanciero`, `saldoPendiente`,
 * `totalEvento` y las acciones del servidor son exactamente las mismas.
 */

/** Los discos de los tres indicadores. Son ESTADOS (entró / falta que
 *  entre / el conjunto), no el acento del tipo de negocio, así que salen
 *  de los pares del sistema y no de `var(--acento…)`:
 *    verde  #1f7a4d sobre #e1f0e6 ..... 4,51:1 ✅ AA
 *    navy   #16295e sobre #e8f0f9 .... 12,07:1 ✅ AAA
 *    gris   #585858 sobre #f6f6f6 ..... 6,58:1 ✅ AA */
const DISCO_ESTADO: Record<EstadoPanel, string> = ESTADO_PILDORA;

const fmtMes = (d: Date) => d.toLocaleDateString("es-CR", { month: "long" });

function fmtFecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** La fecha partida para la columna angosta de la fila: el día grande y
 *  el mes debajo, como el `.appt-time` de la maqueta. */
function partesFecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  return {
    dia: String(d),
    mes: fecha
      .toLocaleDateString("es-CR", { month: "short" })
      .replace(".", "")
      .toUpperCase(),
  };
}

function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * UN MONTO. La única forma de pintar plata en esta pantalla.
 * `tabular-nums` + `whitespace-nowrap` + alineado a la derecha: el
 * porqué está arriba, en la cabecera del archivo.
 */
function Monto({
  children,
  fuerte = false,
  critico = false,
}: {
  children: ReactNode;
  fuerte?: boolean;
  critico?: boolean;
}) {
  return (
    <span
      className={`whitespace-nowrap text-right tabular-nums ${
        fuerte ? "text-[15px] font-extrabold" : "text-[12.5px] font-bold"
      } ${critico ? "text-red-700" : "text-aventurea-ink"}`}
    >
      {children}
    </span>
  );
}

/** La columna derecha de una fila de cobro: el saldo que se persigue,
 *  el total del evento debajo y la acción. Va apilada y alineada a la
 *  derecha para que a 390px el monto nunca compita con el nombre. */
function CobroDerecha({
  saldo,
  total,
  critico,
  children,
}: {
  saldo: number;
  total: number;
  critico?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <Monto fuerte critico={critico}>
        {fmtColones(saldo)}
      </Monto>
      <span className={`whitespace-nowrap tabular-nums ${CUERPO_SUAVE}`}>
        de {fmtColones(total)}
      </span>
      {children}
    </div>
  );
}

/** El botón chico que vive dentro de una fila. Es el `.btn` del sistema
 *  a escala de fila (32px), para que no empuje el alto del renglón. */
const BOTON_FILA =
  "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-aventurea-line bg-aventurea-surface px-3 text-[12px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-50";

export default function FinanzasPanel({
  resumen,
  gastos,
  onMarcarDeposito,
  onRegistrarPago,
  onRevertirPago,
  onAgregarGasto,
  onBorrarGasto,
  onMarcarAdelantoDevuelto,
  onVerComprobante,
}: {
  resumen: ResumenFinanzas;
  gastos: Gasto[];
  onMarcarDeposito: (
    id: string,
    recibido: boolean,
  ) => Promise<{ error: string | null }>;
  onRegistrarPago: (
    id: string,
    montoFinal: number | null,
  ) => Promise<{ error: string | null }>;
  onRevertirPago: (id: string) => Promise<{ error: string | null }>;
  onAgregarGasto: (entrada: {
    fecha: string;
    concepto: string;
    categoria: string;
    monto: number;
    nota: string | null;
  }) => Promise<{ error: string | null }>;
  onBorrarGasto: (id: string) => Promise<{ error: string | null }>;
  onMarcarAdelantoDevuelto?: (
    id: string,
    devuelto: boolean,
  ) => Promise<{ error: string | null }>;
  /** URL firmada del comprobante de un adelanto. Opcional a propósito:
   *  sin esto las filas se abren igual, solo sin el botón. */
  onVerComprobante?: (path: string) => Promise<{ url: string | null; error: string | null }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState<ReservaFinanzas | null>(null);

  function correr(accion: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const res = await accion();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      {error && (
        <p
          role="alert"
          className={`rounded-xl p-3.5 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}
        >
          {error}
        </p>
      )}

      <Indicadores resumen={resumen} />

      {/* Primero lo que pide acción (cobros vencidos, adelantos por
          confirmar, cobros que vienen); los análisis largos — semana a
          semana y gastos — van plegados al final. */}
      {resumen.cobrosVencidos.length > 0 && (
        <CobrosVencidos
          reservas={resumen.cobrosVencidos}
          total={resumen.vencido}
          onCobrar={setCobrando}
          pending={pending}
        />
      )}

      {resumen.depositosSinValidar.length > 0 && (
        <DepositosSinValidar
          reservas={resumen.depositosSinValidar}
          pending={pending}
          onConfirmar={(id) => correr(() => onMarcarDeposito(id, true))}
          onVerComprobante={onVerComprobante}
        />
      )}

      <ProximosCobros
        reservas={resumen.cobrosProximos}
        onCobrar={setCobrando}
        pending={pending}
      />

      {resumen.adelantosRetenidos.length > 0 && (
        <AdelantosRetenidos
          reservas={resumen.adelantosRetenidos}
          pending={pending}
          onDevuelto={
            onMarcarAdelantoDevuelto
              ? (id) => correr(() => onMarcarAdelantoDevuelto(id, true))
              : undefined
          }
        />
      )}

      <GraficoSemanal semanas={resumen.semanas} maximoSemanal={resumen.maximoSemanal} />

      <GastosCard
        gastos={gastos}
        pending={pending}
        onAgregar={(entrada) => correr(() => onAgregarGasto(entrada))}
        onBorrar={(id) => correr(() => onBorrarGasto(id))}
      />

      {cobrando && (
        <ModalCobro
          reserva={cobrando}
          pending={pending}
          onCerrar={() => setCobrando(null)}
          onConfirmar={(montoFinal) => {
            correr(() => onRegistrarPago(cobrando.id, montoFinal));
            setCobrando(null);
          }}
          onRevertir={() => {
            correr(() => onRevertirPago(cobrando.id));
            setCobrando(null);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Indicadores — tres cajas, tres preguntas: ¿qué entró de verdad?,
// ¿qué falta que entre?, ¿cuánto es todo junto?
// ------------------------------------------------------------

function Indicadores({ resumen }: { resumen: ResumenFinanzas }) {
  const mes = fmtMes(new Date());

  return (
    <div className={`grid grid-cols-1 ${GAP_METRICAS} md:grid-cols-3`}>
      <TileGrande
        kicker={`Entró en ${mes}`}
        titulo="Ya cobrado"
        subtitulo="Plata real en tu cuenta"
        valor={fmtColones(resumen.entroEsteMes)}
        estado="exito"
        icono={<IconCheck />}
        lineas={[
          {
            label: "Adelantos",
            valor: fmtColones(resumen.entroEsteMesAdelantos),
          },
          { label: "Saldos de eventos", valor: fmtColones(resumen.entroEsteMesSaldos) },
          { label: "Histórico total", valor: fmtColones(resumen.cobradoTotal) },
        ]}
      />
      <TileGrande
        kicker="Pendiente"
        titulo="Por cobrar"
        subtitulo="Lo que falta que te paguen"
        valor={fmtColones(resumen.porCobrarTotal)}
        estado="info"
        icono={<IconClock />}
        lineas={[
          {
            label: "Vencido",
            valor: fmtColones(resumen.vencido),
            critico: resumen.vencido > 0,
          },
          { label: "Próximos 30 días", valor: fmtColones(resumen.porCobrarProximos30) },
          {
            label: "Eventos agendados (30 días)",
            valor: String(resumen.eventosProximos30),
          },
        ]}
      />
      <TileGrande
        kicker="Comprometido"
        titulo="Total"
        subtitulo="Cobrado + por cobrar"
        valor={fmtColones(resumen.totalComprometido)}
        estado={resumen.netoEsteMes < 0 ? "alerta" : "neutro"}
        icono={<IconChartBars />}
        lineas={[
          {
            label: `Neto de ${mes}`,
            valor: fmtColones(resumen.netoEsteMes),
            critico: resumen.netoEsteMes < 0,
          },
          { label: `Gastos de ${mes}`, valor: `−${fmtColones(resumen.gastosEsteMes)}` },
          { label: "Agendado 30 días", valor: fmtColones(resumen.agendadoProximos30) },
        ]}
      />
    </div>
  );
}

/**
 * EL INDICADOR GRANDE (`.metric` de la maqueta, con desglose).
 *
 * Fila superior con el disco de ícono, rótulo en versalitas, la cifra
 * grande y el desglose en una `dl` de dos columnas: etiqueta a la
 * izquierda, monto a la derecha y tabular. NO lleva el círculo
 * decorativo que la maqueta le pone a `.metric:after` — acá teníamos el
 * mismo adorno (un ícono gigante rotado al 6% detrás del número) y era
 * exactamente eso: un adorno pasando por detrás del único dato.
 */
function TileGrande({
  kicker,
  titulo,
  subtitulo,
  valor,
  estado,
  icono,
  lineas,
}: {
  kicker: string;
  titulo: string;
  subtitulo: string;
  valor: string;
  estado: EstadoPanel;
  icono: ReactNode;
  lineas: { label: string; valor: string; critico?: boolean }[];
}) {
  return (
    <div className={`flex min-w-0 flex-col ${SUPERFICIE_PANEL} ${RADIO_METRICA} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span
          aria-hidden
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[17px] ${DISCO_ESTADO[estado]}`}
        >
          {icono}
        </span>
        <span className={`min-w-0 truncate ${EYEBROW_NEUTRO}`}>{kicker}</span>
      </div>
      <p className={`mt-3 truncate ${ROTULO_CIFRA}`}>{titulo}</p>
      {/* La cifra NO lleva `truncate`: un monto cortado es un monto
          equivocado. Que crezca a `sm` y no antes es lo que la deja
          entera a 390px. */}
      <p className={`mt-1.5 whitespace-nowrap ${CIFRA}`}>{valor}</p>
      <p className={`mt-1 ${DETALLE}`}>{subtitulo}</p>
      <dl className="mt-3.5 flex flex-col gap-1.5 border-t border-aventurea-line pt-3">
        {lineas.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3">
            <dt className={`min-w-0 truncate ${CUERPO_SUAVE}`}>{l.label}</dt>
            <dd>
              <Monto critico={l.critico}>{l.valor}</Monto>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ------------------------------------------------------------
// Cobros
// ------------------------------------------------------------

function CobrosVencidos({
  reservas,
  total,
  onCobrar,
  pending,
}: {
  reservas: ReservaFinanzas[];
  total: number;
  onCobrar: (r: ReservaFinanzas) => void;
  pending: boolean;
}) {
  return (
    <Card
      eyebrow="Cobros vencidos"
      titulo={`Te deben ${fmtColones(total)}`}
      accion={
        <PildoraEstado estado="alerta">
          {reservas.length} {reservas.length === 1 ? "evento" : "eventos"}
        </PildoraEstado>
      }
    >
      {/* El aviso rojo se reduce a UNA franja dentro de la tarjeta. Antes
          era la tarjeta entera teñida, y con eso el bloque más importante
          del panel se leía como un error del sistema en vez de como una
          lista de cosas por hacer. */}
      <p className={`rounded-xl p-3 text-[12.5px] leading-relaxed ${ESTADO_AVISO.alerta}`}>
        <IconWarning className="mr-1.5 inline-block h-3.5 w-3.5 align-[-2px]" />
        Estos eventos ya se hicieron y el saldo sigue sin registrarse. Si ya te pagaron,
        marcalo para que las cuentas cierren.
      </p>

      <div className="mt-2">
        {reservas.map((r, i) => {
          const { dia, mes } = partesFecha(r.fecha);
          return (
            <FilaPanel
              key={r.id}
              contexto={<ContextoFila fuerte={dia} suave={mes} />}
              marca="alerta"
              titulo={r.nombre ?? "Sin nombre"}
              detalle={`${r.tipo_evento ?? "Evento"} · adelanto ${fmtColones(
                Number(r.deposito_monto ?? 0),
              )}`}
              separador={i < reservas.length - 1}
              derecha={
                <CobroDerecha saldo={saldoPendiente(r)} total={totalEvento(r)} critico>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onCobrar(r)}
                    className={BOTON_FILA}
                  >
                    Registrar cobro
                  </button>
                </CobroDerecha>
              }
            />
          );
        })}
      </div>
    </Card>
  );
}

/**
 * ADELANTOS POR CONFIRMAR — CADA FILA SE ABRE (dueño, 3 sep 2026).
 *
 * «Necesito que estas cosas sean extendibles para poder ver la fecha,
 * ver el comprobante, revisar más minuciosamente».
 *
 * Lo que estaba mal no era el diseño de la fila, era lo que pedía:
 * marcar «recibido» es afirmar «esta plata entró», y la fila daba tres
 * datos para decidirlo — un día sin año, un nombre y un monto. Para
 * cotejar contra el comprobante había que irse a otra pantalla, volver,
 * y acordarse de cuál era.
 *
 * Ahora la fila se despliega en el lugar con todo lo que hace falta
 * para decidir: la fecha completa, cuándo entró la reserva, con qué
 * datos reservó, el desglose del dinero y el comprobante.
 *
 * ── POR QUÉ `desplegable` Y NO UN MODAL ────────────────────────────
 * Un modal tapa la lista, y confirmar adelantos es una tarea en SERIE:
 * se revisan tres o cuatro seguidos. Abriendo en el lugar, la lista no
 * se mueve y no hay que volver a encontrar dónde se estaba. Es el
 * mismo criterio que la agenda usa para el panel del día.
 *
 * `desplegable` (globals.css) anima `grid-template-rows` de 0fr a 1fr,
 * que el navegador interpola sin medir el contenido: sin `max-height`
 * inventado y sin animar `height`, que dispararía layout.
 */
function DepositosSinValidar({
  reservas,
  onConfirmar,
  onVerComprobante,
  pending,
}: {
  reservas: ReservaFinanzas[];
  onConfirmar: (id: string) => void;
  /** Devuelve la URL firmada del comprobante. Sin esto la fila se abre
   *  igual pero sin el botón — no se finge un enlace muerto. */
  onVerComprobante?: (path: string) => Promise<{ url: string | null; error: string | null }>;
  pending: boolean;
}) {
  // Una sola abierta a la vez: dos paneles abiertos empujan la lista y
  // se pierde la referencia de cuál se estaba mirando.
  const [abierta, setAbierta] = useState<string | null>(null);

  return (
    <Card
      eyebrow="Conciliación"
      titulo="Adelantos por confirmar"
      accion={<PildoraEstado estado="aviso">{reservas.length}</PildoraEstado>}
    >
      <p className={`mb-2 ${DETALLE}`}>
        El cliente subió el comprobante pero todavía no confirmaste que la plata llegó.
        Tocá una fila para revisarla antes de marcarla.
      </p>

      <div>
        {reservas.map((r, i) => {
          const { dia, mes } = partesFecha(r.fecha);
          const estaAbierta = abierta === r.id;
          return (
            <div key={r.id}>
              {/* La fila entera es el disparador. `w-full` y `text-left`
                  porque un <button> centra y encoge por defecto. */}
              <button
                type="button"
                onClick={() => setAbierta(estaAbierta ? null : r.id)}
                aria-expanded={estaAbierta}
                className="presionable w-full text-left"
              >
                <FilaPanel
                  contexto={<ContextoFila fuerte={dia} suave={mes} />}
                  marca="aviso"
                  titulo={r.nombre ?? "Sin nombre"}
                  detalle={estaAbierta ? "Cerrar" : "Ver detalle y comprobante"}
                  separador={i < reservas.length - 1 && !estaAbierta}
                  derecha={
                    <div className="flex shrink-0 items-center gap-2">
                      <Monto fuerte>{fmtColones(Number(r.deposito_monto ?? 0))}</Monto>
                      <span
                        aria-hidden
                        className="text-aventurea-ink-soft transition-transform duration-200"
                        style={{ transform: estaAbierta ? "rotate(180deg)" : "none" }}
                      >
                        <IconChevronDown className="h-4 w-4" />
                      </span>
                    </div>
                  }
                />
              </button>

              <div className="desplegable" data-abierto={estaAbierta}>
                <div>
                  <DetalleAdelanto
                    reserva={r}
                    onConfirmar={onConfirmar}
                    onVerComprobante={onVerComprobante}
                    pending={pending}
                    separador={i < reservas.length - 1}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** El panel que se abre bajo un adelanto: todo lo que hace falta para
 *  decidir si la plata entró, sin salir de la lista. */
function DetalleAdelanto({
  reserva: r,
  onConfirmar,
  onVerComprobante,
  pending,
  separador,
}: {
  reserva: ReservaFinanzas;
  onConfirmar: (id: string) => void;
  onVerComprobante?: (path: string) => Promise<{ url: string | null; error: string | null }>;
  pending: boolean;
  separador: boolean;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adelanto = Number(r.deposito_monto ?? 0);
  const total = totalEvento(r);
  const resto = Math.max(0, total - adelanto);

  const datos: { rotulo: string; valor: string }[] = [
    { rotulo: "Fecha del evento", valor: fechaLargaCR(r.fecha) },
  ];
  if (r.horario_bloque) datos.push({ rotulo: "Horario", valor: r.horario_bloque });
  if (r.tipo_evento) datos.push({ rotulo: "Tipo", valor: r.tipo_evento });
  if (r.invitados) datos.push({ rotulo: "Invitados", valor: String(r.invitados) });
  if (r.created_at) {
    datos.push({ rotulo: "Reservó el", valor: fechaLargaCR(r.created_at.slice(0, 10)) });
  }
  if (r.correo) datos.push({ rotulo: "Correo", valor: r.correo });
  if (r.whatsapp) datos.push({ rotulo: "WhatsApp", valor: r.whatsapp });

  // El comprobante se pide al TOCAR, no al abrir: la URL firmada dura
  // 60 segundos, así que precargarla la vencería antes de usarla.
  async function verComprobante() {
    if (!onVerComprobante || !r.deposito_comprobante_url) return;
    setAbriendo(true);
    setError(null);
    const res = await onVerComprobante(r.deposito_comprobante_url);
    setAbriendo(false);
    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    else setError(res.error ?? "No se pudo abrir el comprobante.");
  }

  return (
    <div className={`mb-2 ${separador ? "border-b border-aventurea-line pb-3" : ""}`}>
      <div className={`${SUPERFICIE_HUNDIDA} ${RADIO_METRICA} p-3.5`}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
          {datos.map((d) => (
            <div key={d.rotulo} className="min-w-0">
              <dt className={ROTULO_CAMPO}>{d.rotulo}</dt>
              <dd className="truncate text-[13px] font-bold text-aventurea-ink">{d.valor}</dd>
            </div>
          ))}
        </dl>

        {/* El desglose va aparte y con línea propia: es la plata, y es
            exactamente lo que se está confirmando. */}
        <dl className="mt-3 grid grid-cols-3 gap-x-4 border-t border-aventurea-line pt-3">
          <div>
            <dt className={ROTULO_CAMPO}>Adelanto</dt>
            <dd className="text-[13.5px] font-extrabold tabular-nums text-aventurea-ink">
              {fmtColones(adelanto)}
            </dd>
          </div>
          <div>
            <dt className={ROTULO_CAMPO}>Total del evento</dt>
            <dd className="text-[13.5px] font-bold tabular-nums text-aventurea-ink">
              {fmtColones(total)}
            </dd>
          </div>
          <div>
            <dt className={ROTULO_CAMPO}>Queda por cobrar</dt>
            <dd className="text-[13.5px] font-bold tabular-nums text-aventurea-ink">
              {fmtColones(resto)}
            </dd>
          </div>
        </dl>
      </div>

      {error && <p className={`mt-2 ${ESTADO_AVISO}`}>{error}</p>}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {onVerComprobante && r.deposito_comprobante_url ? (
          <button
            type="button"
            onClick={verComprobante}
            disabled={abriendo}
            className={BOTON_PANEL}
          >
            {abriendo ? "Abriendo…" : "Ver comprobante"}
          </button>
        ) : (
          /* Sin comprobante NO se pinta un botón muerto: se dice que no
             hay, que es un dato relevante para decidir. */
          <span className={CUERPO_SUAVE}>El cliente no subió comprobante.</span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => onConfirmar(r.id)}
          className={BOTON_PANEL_PRIMARIO}
        >
          Marcar recibido
        </button>
      </div>
    </div>
  );
}

function ProximosCobros({
  reservas,
  onCobrar,
  pending,
}: {
  reservas: ReservaFinanzas[];
  onCobrar: (r: ReservaFinanzas) => void;
  pending: boolean;
}) {
  const visibles = reservas.slice(0, 12);
  return (
    <Card
      eyebrow="Agenda de cobros"
      titulo="Qué cobrás el día del evento"
      accion={
        reservas.length > 0 ? (
          <PildoraEstado estado="neutro">
            {reservas.length} {reservas.length === 1 ? "evento" : "eventos"}
          </PildoraEstado>
        ) : undefined
      }
    >
      {reservas.length === 0 ? (
        <CardVacia>
          No tenés eventos por delante con saldo pendiente. Cuando agendes uno, acá vas a
          ver cuánto te queda por cobrar el día del evento.
        </CardVacia>
      ) : (
        <div>
          {visibles.map((r, i) => {
            const { dia, mes } = partesFecha(r.fecha);
            const enAprobacion = r.estado === "pendiente";
            return (
              <FilaPanel
                key={r.id}
                contexto={<ContextoFila fuerte={dia} suave={mes} />}
                // La barrita distingue el evento confirmado del que
                // todavía está en aprobación — el mismo par de estados
                // que usa el resto del panel.
                marca={enAprobacion ? "aviso" : "info"}
                titulo={r.nombre ?? "Sin nombre"}
                detalle={`${r.tipo_evento ?? "Evento"}${
                  r.invitados ? ` · ${r.invitados} invitados` : ""
                }${enAprobacion ? " · en aprobación" : ""}`}
                separador={i < visibles.length - 1}
                derecha={
                  <CobroDerecha saldo={saldoPendiente(r)} total={totalEvento(r)}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onCobrar(r)}
                      className={BOTON_FILA}
                    >
                      Ya me pagaron
                    </button>
                  </CobroDerecha>
                }
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function AdelantosRetenidos({
  reservas,
  onDevuelto,
  pending,
}: {
  reservas: ReservaFinanzas[];
  onDevuelto?: (id: string) => void;
  pending: boolean;
}) {
  const total = reservas.reduce((acc, r) => acc + Number(r.deposito_monto ?? 0), 0);
  return (
    <SeccionPlegable
      titulo="Adelantos retenidos de cancelaciones"
      descripcion="Reservas canceladas cuyo adelanto ya había entrado — según tus términos no se devuelve, así que sigue contando en lo cobrado."
      resumen={fmtColones(total)}
    >
      <div>
        {reservas.map((r, i) => {
          const { dia, mes } = partesFecha(r.fecha);
          return (
            <FilaPanel
              key={r.id}
              contexto={<ContextoFila fuerte={dia} suave={mes} />}
              marca="neutro"
              titulo={r.nombre ?? "Sin nombre"}
              detalle="Cancelada · el adelanto quedó retenido"
              separador={i < reservas.length - 1}
              derecha={
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Monto fuerte>{fmtColones(Number(r.deposito_monto ?? 0))}</Monto>
                  {onDevuelto && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onDevuelto(r.id)}
                      className={BOTON_FILA}
                    >
                      Lo devolví
                    </button>
                  )}
                </div>
              }
            />
          );
        })}
      </div>
    </SeccionPlegable>
  );
}

// ------------------------------------------------------------
// Modal de cobro
// ------------------------------------------------------------

function ModalCobro({
  reserva,
  pending,
  onCerrar,
  onConfirmar,
  onRevertir,
}: {
  reserva: ReservaFinanzas;
  pending: boolean;
  onCerrar: () => void;
  onConfirmar: (montoFinal: number | null) => void;
  onRevertir: () => void;
}) {
  const cotizado = totalEvento(reserva);
  const adelanto = Number(reserva.deposito_monto ?? 0);
  const [montoFinal, setMontoFinal] = useState(String(cotizado));

  const finalNum = Number(montoFinal) || 0;
  const saldo = Math.max(0, finalNum - adelanto);
  const cambio = finalNum !== cotizado;

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-aventurea-ink/40 backdrop-blur-md sm:items-center sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar cobro"
        onClick={(e) => e.stopPropagation()}
        // En el teléfono la hoja sube desde el borde inferior y solo
        // redondea las esquinas de arriba; de `sm` para arriba es una
        // tarjeta del sistema (radio 18 + borde). Las variantes van
        // escritas y no compuestas: Tailwind busca los nombres de clase
        // como texto, y un `sm:` pegado a una constante no existe en el
        // archivo, así que esa utilidad nunca se genera.
        className="w-full bg-aventurea-surface p-5 shadow-2xl max-sm:rounded-t-3xl sm:max-w-[440px] sm:rounded-3xl sm:border sm:border-aventurea-line"
      >
        <p className={`mb-1.5 ${EYEBROW_NEUTRO}`}>
          {fmtFecha(reserva.fecha)} · {reserva.nombre ?? "Sin nombre"}
        </p>
        <h3 className={TITULO_CARD}>Registrar el cobro</h3>

        <div className="mt-4">
          <label className={`mb-1.5 block ${ROTULO_CAMPO}`} htmlFor="monto-final-cobro">
            Cuánto cobraste en total por el evento
          </label>
          <input
            id="monto-final-cobro"
            type="number"
            min={0}
            value={montoFinal}
            onChange={(e) => setMontoFinal(e.target.value)}
            className={`${CAMPO_PANEL} text-right tabular-nums`}
          />
          <p className={`mt-1.5 ${DETALLE}`}>
            Cotizaste {fmtColones(cotizado)}. Cambialo si el día del evento se cobró
            distinto — más invitados, horas extra, un descuento de última hora.
          </p>
        </div>

        <dl className={`mt-4 flex flex-col gap-2 rounded-xl p-3.5 ${SUPERFICIE_HUNDIDA}`}>
          <div className="flex items-baseline justify-between gap-3">
            <dt className={CUERPO_SUAVE}>Adelanto ya recibido</dt>
            <dd>
              <Monto>{fmtColones(adelanto)}</Monto>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-aventurea-line pt-2">
            <dt className={CUERPO_SUAVE}>Saldo de este cobro</dt>
            <dd>
              <Monto fuerte>{fmtColones(saldo)}</Monto>
            </dd>
          </div>
        </dl>

        {cambio && (
          <p
            className={`mt-3 flex items-start gap-1.5 rounded-xl p-3 text-[12px] leading-relaxed ${ESTADO_AVISO.aviso}`}
          >
            <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Este monto reemplaza la cotización en todos tus números.
          </p>
        )}

        <div className="mt-5 flex gap-2.5">
          <button type="button" onClick={onCerrar} className={`${BOTON_PANEL} flex-1`}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onConfirmar(cambio ? finalNum : null)}
            className={`${BOTON_PANEL_PRIMARIO} flex-1`}
          >
            <IconCheck className="h-3.5 w-3.5" /> Confirmar cobro
          </button>
        </div>

        {reserva.evento_pagado && (
          <button
            type="button"
            onClick={onRevertir}
            className="mt-3 w-full text-center text-[12px] font-bold text-aventurea-ink-soft underline hover:text-red-700"
          >
            Marqué esto por error — deshacer el cobro
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Gastos
// ------------------------------------------------------------

function GastosCard({
  gastos,
  pending,
  onAgregar,
  onBorrar,
}: {
  gastos: Gasto[];
  pending: boolean;
  onAgregar: (entrada: {
    fecha: string;
    concepto: string;
    categoria: string;
    monto: number;
    nota: string | null;
  }) => void;
  onBorrar: (id: string) => void;
}) {
  const [fecha, setFecha] = useState(hoyIso());
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState<string>("insumos");
  const [monto, setMonto] = useState("");

  const totalMes = useMemo(() => {
    const ahora = new Date();
    return gastos
      .filter((g) => {
        const [y, m] = g.fecha.split("-").map(Number);
        return y === ahora.getFullYear() && m === ahora.getMonth() + 1;
      })
      .reduce((acc, g) => acc + Number(g.monto), 0);
  }, [gastos]);

  function enviar() {
    const montoNum = Number(monto);
    if (!concepto.trim() || !montoNum) return;
    onAgregar({
      fecha,
      concepto,
      categoria,
      monto: montoNum,
      nota: null,
    });
    setConcepto("");
    setMonto("");
  }

  const visibles = gastos.slice(0, 15);

  return (
    <SeccionPlegable
      titulo="Gastos"
      descripcion="Sin esto el panel te dice cuánto facturaste, no cuánto ganaste."
      resumen={`Este mes: ${fmtColones(totalMes)}`}
    >
      {/* El alta es un bloque hundido dentro de la sección: se lee como
          «acá se carga», separado de la lista de lo ya cargado. */}
      <div className={`rounded-xl p-3.5 ${SUPERFICIE_HUNDIDA}`}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-[130px_1fr_180px_130px_auto]">
          <div>
            <label className={`mb-1.5 block ${ROTULO_CAMPO}`} htmlFor="gasto-fecha">
              Fecha
            </label>
            <input
              id="gasto-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={CAMPO_PANEL}
            />
          </div>
          <div>
            <label className={`mb-1.5 block ${ROTULO_CAMPO}`} htmlFor="gasto-concepto">
              En qué gastaste
            </label>
            <input
              id="gasto-concepto"
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Cloro para la piscina"
              className={`${CAMPO_PANEL} placeholder:text-aventurea-ink-soft`}
            />
          </div>
          <div>
            <label className={`mb-1.5 block ${ROTULO_CAMPO}`} htmlFor="gasto-categoria">
              Categoría
            </label>
            <select
              id="gasto-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={CAMPO_PANEL}
            >
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`mb-1.5 block ${ROTULO_CAMPO}`} htmlFor="gasto-monto">
              Monto (₡)
            </label>
            {/* Alineado a la derecha y tabular: el campo de plata se lee
                igual que la columna de plata de la lista de abajo. */}
            <input
              id="gasto-monto"
              type="number"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="15000"
              className={`${CAMPO_PANEL} text-right tabular-nums placeholder:text-aventurea-ink-soft`}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              disabled={pending || !concepto.trim() || !monto}
              onClick={enviar}
              className={`${BOTON_PANEL_PRIMARIO} w-full`}
            >
              Agregar
            </button>
          </div>
        </div>
      </div>

      {gastos.length > 0 && (
        <div className="mt-4">
          {visibles.map((g, i) => {
            const { dia, mes } = partesFecha(g.fecha);
            return (
              <FilaPanel
                key={g.id}
                contexto={<ContextoFila fuerte={dia} suave={mes} />}
                marca="neutro"
                titulo={g.concepto}
                detalle={GASTO_LABEL[g.categoria] ?? "Otro"}
                separador={i < visibles.length - 1}
                derecha={
                  <div className="flex shrink-0 items-center gap-2.5">
                    <Monto>−{fmtColones(Number(g.monto))}</Monto>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onBorrar(g.id)}
                      aria-label={`Borrar el gasto ${g.concepto}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-aventurea-line text-aventurea-ink-soft transition-colors hover:border-red-700 hover:text-red-700 disabled:opacity-50"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </SeccionPlegable>
  );
}
