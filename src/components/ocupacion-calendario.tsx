"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { hoyISOCR } from "@/lib/fechas";
import { formatearHora } from "@/lib/agenda/importar-agenda";
import { IconChevronLeft, IconChevronRight } from "./icons";
import { Card, PildoraEstado, PuntoEstado } from "./panel/piezas";
import {
  BOTON_AGREGAR,
  BOTON_ICONO,
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  ESTADO_MARCA,
  MARCA_ACENTO,
  RADIO_TILE,
  ROTULO_CAMPO,
  SUPERFICIE_ACENTO,
  SUPERFICIE_HUNDIDA,
  SUPERFICIE_PANEL,
  type EstadoPanel,
} from "./panel/sistema";
import ReservaManualForm from "./reserva-manual-form";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fechaLarga(isoFecha: string) {
  const [y, m, d] = isoFecha.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function colones(n: number | null) {
  return n === null ? null : "₡" + Number(n).toLocaleString("es-CR");
}

export type DiaOcupado = {
  id: string;
  fecha: string;
  estado: string;
  nombre: string | null;
  tipo_evento?: string | null;
  invitados?: number | null;
  notas?: string | null;
  montoTotal?: number | null;
  depositoMonto?: number | null;
  horarioBloque?: string | null;
  /** "HH:MM[:SS]" — lo que de verdad le tapa la franja a la agenda
   *  pública. Un lugar de alquiler no lo lleva. */
  horaInicio?: string | null;
};

/** Lo que acepta `actualizarReservaManual` (la fecha no se toca acá). */
export type ReservaEditable = {
  nombre: string;
  tipo_evento: string | null;
  invitados: number | null;
  notas: string | null;
  montoTotal: number | null;
  depositoMonto: number | null;
  horarioBloque: string | null;
};

/** Lo que acepta `crearReservaManual`. */
export type ReservaNueva = {
  fecha: string;
  /** "HH:MM" — obligatoria donde se agenda por franjas (ver `pideHora`). */
  horaInicio: string | null;
  /** "HH:MM" de cierre; opcional. */
  horaFin: string | null;
  nombre: string;
  tipo_evento: string;
  invitados: number | null;
  notas: string | null;
  montoTotal: number;
  depositoMonto: number;
  depositoRecibido: boolean;
  eventoPagado: boolean;
};

type Resultado = { error: string | null };

/**
 * ══ EL SIGNIFICADO DE CADA ESTADO, EN UN SOLO LUGAR ══════════════════
 *
 * Los tres estados que puede tener un día, con la palabra que se lee y
 * el estado del sistema al que corresponden. Los COLORES no están acá:
 * están en `components/panel/sistema.ts`, con su contraste medido.
 *
 * «CONFIRMADA» SALIÓ DEL ROJO, y es el arreglo más importante de esta
 * pantalla. Un día confirmado es un día VENDIDO —la mejor noticia que
 * puede dar este calendario— y se estaba pintando con `bg-red-100`, o
 * sea con el color que en todo el resto del producto significa «algo
 * salió mal». Un mes lleno se leía como un mes en llamas.
 *
 * Ahora lo confirmado se pinta con el ACENTO DEL TIPO DE NEGOCIO (el
 * color de la marca del dueño: naranja en una barbería, verde en un
 * consultorio) y la píldora usa el verde de éxito del sistema. El rojo
 * queda para lo que de verdad es un error.
 */
const ETIQUETA: Record<string, { texto: string; estado: EstadoPanel }> = {
  confirmada: { texto: "Confirmada", estado: "exito" },
  pendiente: { texto: "En aprobación", estado: "aviso" },
  bloqueada: { texto: "Bloqueado", estado: "neutro" },
};

/**
 * LA PIEL DE UNA CELDA DEL MES.
 *
 * La maqueta comunica el estado con una BARRITA de 4px (`.mark`), no
 * pintando el bloque entero: por eso su agenda se lee y la nuestra se
 * leía como un semáforo. Acá la barrita va horizontal, debajo del
 * número, y el relleno de la celda es apenas un tinte.
 *
 *   celda: el tinte de fondo (o el borde, cuando el día está libre)
 *   barra: las clases de la barrita, cuando el color es una constante
 *   estiloCelda / estiloBarra: cuando el color es el acento del tipo,
 *     que llega como variable CSS y no como clase
 *
 * Contraste (número sobre la celda, medido en sistema.ts):
 *   confirmada  --text sobre --acento-suave ..... ≥15,9:1 ✅
 *   pendiente   amber-800 sobre amber-50 ........   6,84:1 ✅
 *   bloqueada   --muted sobre --grey ............   6,58:1 ✅
 *   libre       --muted sobre blanco ............   7,12:1 ✅
 * Y cada barrita pasa el 3:1 de elemento gráfico contra su celda.
 */
function pielDelDia(estado: string | null): {
  celda: string;
  barra: string;
  estiloCelda?: CSSProperties;
  estiloBarra?: CSSProperties;
} {
  if (estado === "confirmada") {
    return {
      celda: "font-bold text-aventurea-ink",
      barra: "",
      estiloCelda: SUPERFICIE_ACENTO as CSSProperties,
      estiloBarra: MARCA_ACENTO as CSSProperties,
    };
  }
  if (estado === "pendiente") {
    return { celda: "bg-amber-50 font-bold text-amber-800", barra: ESTADO_MARCA.aviso };
  }
  if (estado === "bloqueada") {
    return {
      celda: "bg-aventurea-cream-2 font-bold text-aventurea-ink-soft",
      barra: ESTADO_MARCA.neutro,
    };
  }
  return { celda: "border border-aventurea-line text-aventurea-ink-soft", barra: "" };
}

/**
 * Calendario mensual de ocupación, y el lugar desde donde se maneja la
 * agenda del día a día.
 *
 * Antes era de solo lectura: se veía qué días estaban tomados y para
 * tocar algo había que irse a otra pantalla. Ahora se toca un día y
 * ahí mismo se confirma, se corrige o se cancela lo que haya — que es
 * como se trabaja cuando alguien llama para mover su fiesta.
 *
 * Si no se le pasan acciones, se comporta como antes (solo lectura):
 * así la misma pieza sirve para una vista donde nadie puede editar.
 */
export default function OcupacionCalendario({
  dias,
  onConfirmar,
  onCancelar,
  onEditar,
  onMover,
  onCrear,
  capacidadMax = null,
  pideHora = false,
}: {
  dias: DiaOcupado[];
  onConfirmar?: (reservaId: string) => Promise<Resultado>;
  onCancelar?: (reservaId: string) => Promise<Resultado>;
  onEditar?: (reservaId: string, datos: ReservaEditable) => Promise<Resultado>;
  /** Mover una reserva (o un bloqueo) a otra fecha. */
  onMover?: (reservaId: string, nuevaFecha: string) => Promise<Resultado>;
  /** Con esto, el panel del día deja cargar una reserva nueva sin salir
   *  del calendario — la fecha ya viene puesta, es la que se clickeó. */
  onCrear?: (datos: ReservaNueva) => Promise<Resultado>;
  capacidadMax?: number | null;
  /** El negocio agenda por FRANJAS (un proveedor de eventos, una mesa):
   *  la reserva que se carga desde acá necesita hora de inicio o no le
   *  tapa la franja a nadie en la agenda pública. */
  pideHora?: boolean;
}) {
  const hoy = hoyISOCR();
  const [y0, m0] = hoy.split("-").map(Number);
  const [viewYear, setViewYear] = useState(y0);
  const [viewMonth, setViewMonth] = useState(m0 - 1);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);

  const editable = Boolean(onConfirmar || onCancelar || onEditar || onMover);

  // Un mismo día puede tener varias reservas (un bloqueo y una fiesta,
  // o dos eventos si el negocio admite más de uno por día), así que se
  // agrupa en lista y no en un solo valor por fecha.
  const porFecha = new Map<string, DiaOcupado[]>();
  for (const d of dias) {
    const lista = porFecha.get(d.fecha);
    if (lista) lista.push(d);
    else porFecha.set(d.fecha, [d]);
  }

  /** Lo confirmado manda sobre lo pendiente, y eso sobre un bloqueo. */
  function estadoDelDia(lista: DiaOcupado[]): string {
    if (lista.some((r) => r.estado === "confirmada")) return "confirmada";
    if (lista.some((r) => r.estado === "pendiente")) return "pendiente";
    return "bloqueada";
  }

  function cambiarMes(dir: number) {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
    setSeleccion(null);
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const delDia = seleccion ? (porFecha.get(seleccion) ?? []) : [];

  return (
    <Card
      eyebrow="Agenda del mes"
      titulo={<span className="capitalize">{`${MESES[viewMonth]} ${viewYear}`}</span>}
      accion={
        /* Las flechas eran «‹» y «›» de TEXTO dentro de un cuadrito de
           32px: un glifo tipográfico haciendo de ícono, con el tamaño y
           la posición que le dé la fuente. Ahora son los chevrones del
           sistema en el botón de ícono del panel (36px, radio 12). */
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            aria-label="Mes anterior"
            className={BOTON_ICONO}
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            aria-label="Mes siguiente"
            className={BOTON_ICONO}
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {DOW.map((d, i) => (
          <div
            key={i}
            className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
          >
            {d}
          </div>
        ))}
        {celdas.map((d, i) => {
          if (d === null) return <div key={i} />;
          const fecha = iso(viewYear, viewMonth, d);
          const lista = porFecha.get(fecha);
          const estado = lista ? estadoDelDia(lista) : null;
          const esHoy = fecha === hoy;
          const elegido = fecha === seleccion;
          const piel = pielDelDia(estado);

          /* ══ UN SOLO MARCADOR DE INTERACCIÓN, Y SÓLIDO ══════════════
             Antes había DOS anillos peleándose encima de los rellenos:
             `ring-1 ring-aventurea-sky` para hoy y
             `ring-2 ring-aventurea-navy ring-offset-1` para el día
             abierto — más un `hover:ring-white/60` que sobre un relleno
             claro era, literalmente, invisible.

             Ahora el día ABIERTO se pinta como el `.date-strip
             .selected` de la maqueta: celda navy sólida con el número
             en blanco (13,88:1). Es un estado, así que gana sobre el
             tinte del día; el estado del día se sigue leyendo en la
             barrita, que en ese caso pasa a blanco. */
          const cls = elegido
            ? "relative flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl bg-aventurea-navy text-[12.5px] font-bold text-white transition-colors sm:min-h-[56px] sm:text-[13.5px]"
            : `relative flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl text-[12.5px] transition-colors sm:min-h-[56px] sm:text-[13.5px] ${piel.celda}`;

          /* HOY se marca en el NÚMERO, no con un anillo: el número va en
             la tinta del acento del tipo de negocio y en negrita. Se
             eligió el número y no un anillo porque un día puede ser hoy
             Y estar vendido a la vez, y dos anillos encima de un relleno
             era exactamente el ruido de antes. La tinta del acento pasa
             AA contra las cuatro celdas posibles: ≥6,22:1 sobre blanco,
             ≥5,56:1 sobre el tinte del acento, y ≥5:1 sobre el ámbar y
             el gris. Si el día además está abierto, manda el blanco de
             la celda navy. */
          const estiloNumero: CSSProperties | undefined =
            esHoy && !elegido ? { color: "var(--acento, var(--navy))" } : undefined;

          const contenido = (
            <>
              <span
                className={`flex items-center gap-1 leading-none ${esHoy ? "font-extrabold" : ""}`}
                style={estiloNumero}
              >
                {d}
                {/* Varias reservas el mismo día: el conteo iba con
                    `opacity-70`, o sea un alfa sobre un relleno de
                    color — no se podía medir. Ahora hereda la tinta de
                    la celda, que ya está medida. */}
                {lista && lista.length > 1 && (
                  <span className="text-[9px] font-bold leading-none">×{lista.length}</span>
                )}
              </span>
              {/* LA BARRITA: el `.mark` de la maqueta, girado. Es lo que
                  reemplazó al manchón rojo — el estado se comunica con
                  4px de color y no pintando el día entero. */}
              {estado && (
                <span
                  aria-hidden="true"
                  className={`h-1 w-5 rounded-full ${elegido ? "bg-white" : piel.barra}`}
                  style={elegido ? undefined : piel.estiloBarra}
                />
              )}
              {/* El punto de HOY solo aparece en un día LIBRE, que es
                  donde no hay barrita: si estuvieran los dos, el día se
                  llenaría de marcas. En un día ocupado el «hoy» ya lo
                  dice el número en el acento. */}
              {esHoy && !estado && (
                <span
                  aria-hidden="true"
                  className={`h-1 w-1 rounded-full ${elegido ? "bg-white" : ""}`}
                  style={elegido ? undefined : (MARCA_ACENTO as CSSProperties)}
                />
              )}
            </>
          );

          if (!editable) {
            return (
              <div
                key={i}
                className={cls}
                style={elegido ? undefined : piel.estiloCelda}
                title={lista?.[0]?.nombre ?? undefined}
              >
                {contenido}
              </div>
            );
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSeleccion(elegido ? null : fecha);
                setAgregando(false);
              }}
              aria-pressed={elegido}
              aria-label={`${fechaLarga(fecha)}${
                lista ? ` — ${lista.length} reserva${lista.length === 1 ? "" : "s"}` : " — libre"
              }${esHoy ? " — hoy" : ""}`}
              style={elegido ? undefined : piel.estiloCelda}
              /* El hover es un anillo NAVY SÓLIDO hacia adentro: se lee
                 igual sobre los cuatro fondos posibles y no depende de
                 un alfa, que era el problema del blanco al 60%. */
              className={`${cls} cursor-pointer hover:ring-2 hover:ring-inset hover:ring-aventurea-navy`}
            >
              {contenido}
            </button>
          );
        })}
      </div>

      {/* LA LEYENDA ES INFORMACIÓN, no adorno: sin ella los tintes no
          significan nada. Va dentro de la tarjeta, en una caja hundida,
          y sus puntos son los MISMOS colores que las barritas de los
          días — una leyenda que no se parece a lo que explica no
          explica nada.
          El punto de «Confirmada» se pinta con el acento del negocio,
          igual que su barrita. */}
      <div className={`mt-4 flex flex-wrap gap-x-4 gap-y-2 ${RADIO_TILE} ${SUPERFICIE_HUNDIDA} px-3 py-2.5 text-[11.5px] text-aventurea-ink-soft`}>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={MARCA_ACENTO as CSSProperties}
          />
          Confirmada
        </span>
        <span className="flex items-center gap-1.5">
          <PuntoEstado estado="aviso" /> En aprobación
        </span>
        <span className="flex items-center gap-1.5">
          <PuntoEstado estado="neutro" /> Bloqueado / agenda externa
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full border border-aventurea-line"
          />
          Libre
        </span>
      </div>

      {editable && (
        <p className="mt-3 text-[12px] text-aventurea-ink-soft">
          Tocá un día para ver lo que hay y confirmarlo, corregirlo o cancelarlo.
        </p>
      )}

      {seleccion && (
        /* El día abierto ya no es un bloque crema suelto: es una
           superficie HUNDIDA con borde, el `#f8fafc` de la maqueta.
           Así se lee como un cajón que se abrió dentro de la tarjeta y
           no como otra tarjeta empujando la página hacia abajo. */
        <div className={`mt-4 ${RADIO_TILE} ${SUPERFICIE_HUNDIDA} p-3.5 sm:p-4`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-[14px] font-bold capitalize text-aventurea-ink">
              {fechaLarga(seleccion)}
            </p>
            <button
              type="button"
              onClick={() => {
                setSeleccion(null);
                setAgregando(false);
              }}
              className="shrink-0 text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
            >
              Cerrar
            </button>
          </div>

          {delDia.length === 0 && !onCrear && (
            <p className="mt-2 text-[13px] text-aventurea-ink-soft">
              Este día está libre. Podés cargar una reserva con el formulario de
              más abajo.
            </p>
          )}

          {delDia.length > 0 && (
            <div className="mt-3 flex flex-col gap-3">
              {delDia.map((r) => (
                <FilaReserva
                  key={r.id}
                  reserva={r}
                  onConfirmar={onConfirmar}
                  onCancelar={onCancelar}
                  onMover={onMover}
                  onEditar={onEditar}
                />
              ))}
            </div>
          )}

          {/* Cargar una reserva sin salir del calendario: la fecha ya
              es la que se clickeó, no hay que volver a elegirla. */}
          {onCrear &&
            (agregando ? (
              <div className="mt-3">
                <ReservaManualForm
                  capacidadMax={capacidadMax}
                  onCrear={onCrear}
                  fechaFija={seleccion}
                  pideHora={pideHora}
                  onCancelar={() => setAgregando(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAgregando(true)}
                className={`mt-3 ${BOTON_AGREGAR}`}
              >
                + Agregar {delDia.length > 0 ? "otra reserva" : "una reserva"} este día
              </button>
            ))}
        </div>
      )}
    </Card>
  );
}

/** Una reserva del día abierto: su resumen y lo que se puede hacer con ella. */
function FilaReserva({
  reserva,
  onConfirmar,
  onCancelar,
  onEditar,
  onMover,
}: {
  reserva: DiaOcupado;
  onConfirmar?: (reservaId: string) => Promise<Resultado>;
  onCancelar?: (reservaId: string) => Promise<Resultado>;
  onEditar?: (reservaId: string, datos: ReservaEditable) => Promise<Resultado>;
  onMover?: (reservaId: string, nuevaFecha: string) => Promise<Resultado>;
}) {
  const [editando, setEditando] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  // Cancelar pide un segundo clic en vez de un confirm() del navegador:
  // liberar un día por accidente se arregla volviendo a cargar la
  // reserva a mano, y eso nadie quiere hacerlo un sábado.
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const badge = ETIQUETA[reserva.estado] ?? {
    texto: reserva.estado,
    estado: "neutro" as EstadoPanel,
  };

  function correr(accion: () => Promise<Resultado>) {
    setError(null);
    startTransition(async () => {
      const res = await accion();
      if (res.error) setError(res.error);
      else {
        setEditando(false);
        setConfirmandoBaja(false);
        setMoviendo(false);
      }
    });
  }

  const detalle = [
    reserva.tipo_evento,
    reserva.invitados ? `${reserva.invitados} personas` : null,
    // El texto del bloque manda si lo hay; si no, la hora de inicio
    // suelta — una reserva por franja sin hora de cierre igual tiene
    // que verse a qué hora es.
    reserva.horarioBloque ??
      (reserva.horaInicio ? formatearHora(reserva.horaInicio.slice(0, 5)) : null),
    colones(reserva.montoTotal ?? null),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    /* Vuelve a ser una tarjeta BLANCA porque ahora está adentro de la
       superficie hundida del día: es el escalón de arriba. */
    <div className={`${RADIO_TILE} ${SUPERFICIE_PANEL} p-3.5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] font-bold text-aventurea-ink">
          {reserva.nombre ?? "Sin nombre"}
        </p>
        <PildoraEstado estado={badge.estado}>{badge.texto}</PildoraEstado>
      </div>
      {detalle && (
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">{detalle}</p>
      )}
      {reserva.notas && (
        <p className="mt-1 text-[12px] italic text-aventurea-ink-soft">{reserva.notas}</p>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">
          {error}
        </p>
      )}

      {editando && onEditar ? (
        <FormularioReserva
          reserva={reserva}
          pendiente={pendiente}
          onCancelarEdicion={() => setEditando(false)}
          onGuardar={(datos) => correr(() => onEditar(reserva.id, datos))}
        />
      ) : moviendo && onMover ? (
        <FormularioMover
          fechaActual={reserva.fecha}
          pendiente={pendiente}
          onCancelarMovida={() => setMoviendo(false)}
          onMover={(nuevaFecha) => correr(() => onMover(reserva.id, nuevaFecha))}
        />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {onConfirmar && reserva.estado === "pendiente" && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => onConfirmar(reserva.id))}
              className={BOTON_PANEL_PRIMARIO}
            >
              Confirmar
            </button>
          )}
          {onEditar && reserva.estado !== "bloqueada" && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => setEditando(true)}
              className={BOTON_PANEL}
            >
              Modificar
            </button>
          )}
          {onMover && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => setMoviendo(true)}
              className={BOTON_PANEL}
            >
              Mover
            </button>
          )}
          {/* Cancelar sigue siendo lo único rojo de esta pantalla, y
              ahora que «Confirmada» dejó el rojo, ese rojo por fin
              significa una sola cosa. */}
          {onCancelar &&
            (confirmandoBaja ? (
              <>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => correr(() => onCancelar(reserva.id))}
                  className={`${BOTON_PANEL} border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700`}
                >
                  {pendiente ? "Cancelando…" : "Sí, cancelar y liberar el día"}
                </button>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => setConfirmandoBaja(false)}
                  className={BOTON_PANEL}
                >
                  Mejor no
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pendiente}
                onClick={() => setConfirmandoBaja(true)}
                className={`${BOTON_PANEL} border-red-200 text-red-700 hover:border-red-600`}
              >
                {reserva.estado === "bloqueada" ? "Liberar el día" : "Cancelar"}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * El formulario de corrección. La FECHA no está: mover una reserva de
 * día cambia el cupo, puede chocar con otra confirmada y afecta al
 * cliente — es otra operación, no un campo más de este formulario. Esa
 * operación es `FormularioMover`, más abajo.
 */
function FormularioReserva({
  reserva,
  pendiente,
  onGuardar,
  onCancelarEdicion,
}: {
  reserva: DiaOcupado;
  pendiente: boolean;
  onGuardar: (datos: ReservaEditable) => void;
  onCancelarEdicion: () => void;
}) {
  const numero = (v: FormDataEntryValue | null): number | null => {
    const t = String(v ?? "").trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const texto = (v: FormDataEntryValue | null): string | null => {
    const t = String(v ?? "").trim();
    return t || null;
  };

  const campo = CAMPO_PANEL;
  const rotulo = ROTULO_CAMPO;

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onGuardar({
          nombre: String(f.get("nombre") ?? "").trim(),
          tipo_evento: texto(f.get("tipo_evento")),
          invitados: numero(f.get("invitados")),
          notas: texto(f.get("notas")),
          montoTotal: numero(f.get("montoTotal")),
          depositoMonto: numero(f.get("depositoMonto")),
          horarioBloque: texto(f.get("horarioBloque")),
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className={rotulo}>Nombre de quien reserva</span>
        <input name="nombre" defaultValue={reserva.nombre ?? ""} required className={campo} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Tipo de evento</span>
          <input name="tipo_evento" defaultValue={reserva.tipo_evento ?? ""} className={campo} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Personas</span>
          <input
            name="invitados"
            type="number"
            min={0}
            defaultValue={reserva.invitados ?? ""}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Horario</span>
          <input
            name="horarioBloque"
            defaultValue={reserva.horarioBloque ?? ""}
            placeholder="Ej: 2 p. m. a 10 p. m."
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Total del evento (₡)</span>
          <input
            name="montoTotal"
            type="number"
            min={0}
            defaultValue={reserva.montoTotal ?? ""}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={rotulo}>Adelanto (₡)</span>
          <input
            name="depositoMonto"
            type="number"
            min={0}
            defaultValue={reserva.depositoMonto ?? ""}
            className={campo}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={rotulo}>Notas</span>
        <textarea name="notas" rows={2} defaultValue={reserva.notas ?? ""} className={campo} />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pendiente} className={BOTON_PANEL_PRIMARIO}>
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={onCancelarEdicion}
          className={BOTON_PANEL}
        >
          Descartar
        </button>
      </div>
    </form>
  );
}

/** Elegir la fecha nueva y mover — el cupo del día se revisa en el
 *  servidor, así que acá solo hace falta la fecha. */
function FormularioMover({
  fechaActual,
  pendiente,
  onMover,
  onCancelarMovida,
}: {
  fechaActual: string;
  pendiente: boolean;
  onMover: (nuevaFecha: string) => void;
  onCancelarMovida: () => void;
}) {
  const [nuevaFecha, setNuevaFecha] = useState(fechaActual);
  const campo = CAMPO_PANEL;

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (nuevaFecha && nuevaFecha !== fechaActual) onMover(nuevaFecha);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className={ROTULO_CAMPO}>Mover al día</span>
        <input
          type="date"
          value={nuevaFecha}
          onChange={(e) => setNuevaFecha(e.target.value)}
          className={campo}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendiente || !nuevaFecha || nuevaFecha === fechaActual}
          className={BOTON_PANEL_PRIMARIO}
        >
          {pendiente ? "Moviendo…" : "Mover reserva"}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={onCancelarMovida}
          className={BOTON_PANEL}
        >
          Descartar
        </button>
      </div>
    </form>
  );
}
