"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { etiquetaMinutos, horaBonita, minutosAHora, type HorarioSemana } from "@/app/citas/tipos";
import {
  diaDeSemana,
  instanteEnZona,
  rangosDelDia,
  agruparHorarioRecurso,
  type Rango,
} from "@/lib/agenda/disponibilidad";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import { fmtColones } from "@/lib/finanzas";
import {
  cancelarCita,
  crearBloqueoAgenda,
  crearCitaManual,
  eliminarBloqueoAgenda,
  marcarAsistenciaCita,
  moverCita,
  type BloqueoAgenda,
  type ClienteReincidente,
} from "./actions";
import { registrarPagoFinal, revertirPagoFinal } from "../finanzas/actions";
import type { Vocabulario } from "@/lib/business/identidad";
import { IconChevronLeft, IconChevronRight, IconX } from "@/components/icons";
import { Card, CardVacia, ContextoFila, FilaPanel, PildoraEstado } from "@/components/panel/piezas";
import {
  ACCION_ACENTO,
  BOTON_ICONO,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  CUERPO_SUAVE,
  ESTADO_AVISO,
  ESTADO_MARCA,
  EYEBROW,
  RADIO_PILDORA,
  RADIO_TILE,
  ROTULO_CAMPO,
  SUPERFICIE_HUNDIDA,
  SUPERFICIE_ACENTO,
  TITULO_CARD,
  type EstadoPanel,
} from "@/components/panel/sistema";

const inputCls = CAMPO_PANEL;
const labelCls = `mb-1.5 block ${ROTULO_CAMPO}`;
/**
 * La acción chica de una fila (32px): los mismos tokens que
 * `BOTON_PANEL` del sistema, en el tamaño que pide una lista densa —
 * en el detalle de una cita hay hasta cinco acciones seguidas y con
 * botones de 40px la fila se parte en tres renglones. Si aparece una
 * tercera pantalla que la necesite, esto sube a `panel/sistema.ts`.
 */
const btnChicoBase =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-bold transition-colors disabled:opacity-40";
const btnChico = `${btnChicoBase} border-aventurea-line bg-aventurea-surface text-aventurea-ink hover:border-aventurea-navy`;

/** Una cita del día tal como se lee de reservas (solo lo que se muestra). */
export type CitaDia = {
  id: string;
  hora_inicio: string;
  duracion_minutos: number | null;
  miembro_id: string | null;
  nombre: string | null;
  tipo_evento: string | null;
  estado:
    | "pendiente"
    | "confirmada"
    | "rechazada"
    | "bloqueada"
    | "cumplida"
    | "no_asistio"
    | "cancelada";
  correo: string | null;
  whatsapp: string | null;
  /** El teléfono de la cita manual (walk-in) — distinto de `whatsapp`,
   *  que es el de una reserva hecha por el cliente desde la página. */
  contacto: string | null;
  notas: string | null;
  monto_total: number | null;
  origen: string | null;
  /** Igual que en Eventos (lib/finanzas.ts): "ya se cobró", sin
   *  importar el medio — el dueño lo marca a mano, Bookea no procesa
   *  nada. */
  evento_pagado: boolean;
  monto_cobrado_final: number | null;
};

/**
 * LOS SIETE ESTADOS DE UNA CITA, mapeados a los CINCO del panel
 * (`components/panel/sistema`), que son los que ya tienen el contraste
 * medido. Un mapa y no siete pieles sueltas: así una cita confirmada se
 * ve igual en la lista, en la grilla, en el detalle y en la leyenda.
 *
 * Antes cada estado traía su propio color con alfa
 * (`bg-aventurea-green/15`, `bg-aventurea-navy/10`): el mismo estado se
 * veía distinto según sobre qué cayera y su contraste no se podía medir
 * una sola vez.
 *
 * Qué cambia de significado —y por qué—:
 *  · «Confirmada» pasa a INFO (azul). Es una cita que todavía no
 *    ocurrió: el verde se reserva para lo que YA se cumplió.
 *  · «Vino» es el ÉXITO: es el único desenlace bueno de verdad.
 *  · «Cancelada» sale del rojo y pasa a NEUTRO. Cancelar no es un error
 *    del negocio y no ocupa la agenda; el rojo queda para «No vino»,
 *    que sí es plata perdida.
 *
 * `glifo`: EL ESTADO NO SE COMUNICA SOLO CON EL COLOR. Cada uno lleva
 * su símbolo, y el símbolo es lo que queda visible cuando la píldora se
 * queda sin ancho en el teléfono — quien no distingue el verde del
 * ámbar lee igual «✓✓» contra «!».
 */
const ESTADO_CITA: Record<
  CitaDia["estado"],
  { label: string; estado: EstadoPanel; glifo: string }
> = {
  pendiente: { label: "Pendiente", estado: "aviso", glifo: "!" },
  confirmada: { label: "Confirmada", estado: "info", glifo: "✓" },
  cumplida: { label: "Vino", estado: "exito", glifo: "✓✓" },
  no_asistio: { label: "No vino", estado: "alerta", glifo: "✕" },
  rechazada: { label: "Cancelada", estado: "neutro", glifo: "–" },
  cancelada: { label: "Cancelada", estado: "neutro", glifo: "–" },
  bloqueada: { label: "Bloqueada", estado: "neutro", glifo: "▪" },
};

/**
 * El relleno del bloque en la grilla por persona: son los MISMOS cinco
 * rellenos tenues de `ESTADO_PILDORA`, pero sin su letra — acá encima
 * va la tinta fuerte (15,35:1 sobre el verde, 17,45:1 sobre el ámbar,
 * 15,74:1 sobre el azul, 16,54:1 sobre el rojo, 16,74:1 sobre el gris),
 * porque un bloque de 11px con el nombre de alguien tiene que leerse de
 * un vistazo desde el otro lado del mostrador. El estado lo dice la
 * barrita de la izquierda y el glifo, no el color de la letra.
 */
const BLOQUE_FONDO: Record<EstadoPanel, string> = {
  exito: "bg-aventurea-green-light",
  aviso: "bg-amber-50",
  info: "bg-aventurea-blue-light",
  neutro: "bg-aventurea-cream-2",
  alerta: "bg-red-50",
};

/**
 * El rayado de "acá no se trabaja" de la grilla. Dos tokens SÓLIDOS
 * (`--grey` de fondo, `--line` en las rayas), no los `rgba(24,28,38,…)`
 * de antes: un alfa encima de un bloque de cita se veía de otro color
 * que encima de la columna vacía, y su contraste no se podía medir una
 * sola vez. Es textura decorativa —la información también la dan la
 * leyenda y el hecho de que esa zona no acepte clics—, así que lo que
 * se mide es la separación de superficies: gris sobre la columna
 * blanca, 1,08:1, la misma que usa toda tarjeta del panel contra su
 * lienzo.
 */
const RAYADO_CERRADO =
  "repeating-linear-gradient(45deg, var(--line) 0, var(--line) 1px, transparent 1px, transparent 9px)";

/**
 * La píldora de estado de una cita, con su glifo por delante.
 *
 * `denso`: en una fila de 390px el texto «Confirmada» se come el nombre
 * de quien viene, así que ahí se esconde y queda el símbolo — que sigue
 * siendo una FORMA, no un color. El texto no desaparece del árbol de
 * accesibilidad (`sr-only`), así que un lector de pantalla lo lee
 * entero igual.
 */
function EstadoCita({
  estado,
  denso = false,
}: {
  estado: CitaDia["estado"];
  denso?: boolean;
}) {
  const e = ESTADO_CITA[estado];
  return (
    <PildoraEstado estado={e.estado}>
      <span aria-hidden="true">{e.glifo}</span>
      <span className={denso ? "sm:ml-1 max-sm:sr-only" : "ml-1"}>{e.label}</span>
    </PildoraEstado>
  );
}

/**
 * Alto fijo del encabezado de cada columna en la vista por persona
 * (foto + nombre). Es un número, no algo que se mida del DOM, a
 * propósito: el eje de horas (una columna hermana, sin encabezado
 * propio) necesita el MISMO valor para desplazar sus horas hacia
 * abajo y quedar alineado con la grilla real de cada columna — si el
 * encabezado se dejara crecer con el contenido, el eje se desalinearía
 * cada vez que cambiara el texto o la fuente.
 */
const ALTO_ENCABEZADO_COLUMNA = 52;

/** Estados que ocupan la franja de verdad (los cancelados no estorban). */
const OCUPAN = new Set<CitaDia["estado"]>([
  "pendiente",
  "confirmada",
  "bloqueada",
  "cumplida",
  "no_asistio",
]);

function minutosDe(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** El lunes de la semana ISO que contiene esa fecha. */
function lunesDeSemana(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = domingo … 6 = sábado
  const offset = dow === 0 ? -6 : 1 - dow;
  return sumarDiasISO(iso, offset);
}

type Miembro = {
  id: string;
  nombre: string;
  tipo: string;
  activo: boolean;
  fotoUrl?: string | null;
};
type Servicio = {
  id: string;
  nombre: string;
  duracionMinutos: number | null;
  precio: number | null;
};

const CAMPOS_CITA =
  "id, hora_inicio, duracion_minutos, miembro_id, nombre, tipo_evento, estado, correo, whatsapp, contacto, notas, monto_total, origen, evento_pagado, monto_cobrado_final";

/** La secuencia "normal" de una cita, para las pills del detalle — los
 *  desenlaces (no_asistio/cancelada/rechazada/bloqueada) se muestran
 *  aparte, no como un paso más de esta fila. */
const PASOS_ESTADO: CitaDia["estado"][] = ["pendiente", "confirmada", "cumplida"];

/**
 * La agenda del día del negocio de citas — el mostrador. Se ve como
 * lista o como columnas por persona (estilo Fresha), y desde acá se
 * marca la asistencia, se agenda un walk-in con hora, se reprograma,
 * se cancela y se bloquea una franja. La primera carga viene del
 * servidor (hoy); al cambiar la fecha se consulta directo desde el
 * navegador — las políticas de la base limitan la lectura al dueño.
 */
export default function AgendaCitas({
  ranchoId,
  zona,
  equipo,
  servicios,
  horario,
  horariosPorMiembro,
  initialFecha,
  initialCitas,
  initialBloqueos,
  vocabulario,
}: {
  ranchoId: string;
  zona: string;
  equipo: Miembro[];
  servicios: Servicio[];
  /** El horario semanal del negocio: lo que hereda cada colaborador
   *  sin horario propio, y el rango por defecto cuando nadie trabaja
   *  ese día. */
  horario: HorarioSemana | null;
  /** Horario propio por persona (0061) — sin filas para alguien, esa
   *  persona hereda `horario`; con filas manda lo que digan (día libre
   *  incluido, vía el rango centinela de horarios_recurso). */
  horariosPorMiembro: Record<string, { dow: number; abre: string; cierra: string }[]>;
  initialFecha: string;
  initialCitas: CitaDia[];
  initialBloqueos: BloqueoAgenda[];
  /**
   * Cómo le dice ESTE negocio a lo que agenda y a quien viene (del
   * catálogo de tipos, lib/business/identidad): cita/cliente en una
   * barbería, consulta/paciente en un consultorio, sesión/miembro en un
   * gimnasio. La agenda no decide ninguna de las dos palabras.
   */
  vocabulario: Vocabulario;
}) {
  const { persona, visita } = vocabulario;
  const [fecha, setFecha] = useState(initialFecha);
  const [citas, setCitas] = useState<CitaDia[]>(initialCitas);
  const [bloqueos, setBloqueos] = useState<BloqueoAgenda[]>(initialBloqueos);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Por persona es la agenda "de verdad" (estilo Fresha): quién atiende
  // qué y a qué hora, de un vistazo. Arranca ahí por defecto — la lista
  // plana queda como alternativa a un clic, no como punto de partida.
  const [vista, setVista] = useState<"lista" | "personas" | "persona">("personas");
  // Índice de quién se ve en la vista "una persona a la vez" — con
  // wraparound, así las flechas dan la vuelta sin trabarse en la punta.
  const [personaIndice, setPersonaIndice] = useState(0);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Si el dueño cambia la fecha rápido, solo interesa la última consulta.
  const ultimaFecha = useRef(initialFecha);

  // Aviso de re-enganche tras marcar un no-show.
  const [reincidente, setReincidente] = useState<ClienteReincidente | null>(null);

  // Reprogramar.
  const [reprogramando, setReprogramando] = useState<string | null>(null);
  const [destino, setDestino] = useState({ fecha: initialFecha, hora: "", miembroId: "" });
  const [avisosMover, setAvisosMover] = useState<string[]>([]);

  // Cancelar pide segundo clic (nada de confirm()).
  const [cancelando, setCancelando] = useState<string | null>(null);

  // Walk-in.
  const [creando, setCreando] = useState(false);
  const [avisosCrear, setAvisosCrear] = useState<string[]>([]);
  const CITA_VACIA = {
    servicioId: "",
    tipoEvento: "",
    hora: "",
    duracion: "",
    miembroId: "",
    nombre: "",
    telefono: "",
    correo: "",
    monto: "",
    notas: "",
  };
  const [borradorCita, setBorradorCita] = useState(CITA_VACIA);

  // Bloquear franja.
  const [bloqueando, setBloqueando] = useState(false);
  const BLOQUEO_VACIO = { miembroId: "", desde: "", hasta: "", motivo: "", diaEntero: false };
  const [borradorBloqueo, setBorradorBloqueo] = useState(BLOQUEO_VACIO);

  // Editar el formulario invalida los avisos de choque: eran de OTROS
  // datos, y dejar "agendar igual" armado saltaría la verificación.
  function cambiarCita(cambio: Partial<typeof CITA_VACIA>) {
    setBorradorCita((b) => ({ ...b, ...cambio }));
    setAvisosCrear([]);
  }
  function cambiarDestino(cambio: Partial<{ fecha: string; hora: string; miembroId: string }>) {
    setDestino((d) => ({ ...d, ...cambio }));
    setAvisosMover([]);
  }

  const nombreMiembro = new Map(equipo.map((m) => [m.id, m.nombre]));
  const hoy = hoyISOCR();
  const esHoy = fecha === hoy;
  const esPasadoOHoy = fecha <= hoy;

  async function cargar(nueva: string) {
    setFecha(nueva);
    ultimaFecha.current = nueva;
    setSeleccionada(null);
    setCancelando(null);
    setReprogramando(null);
    // Los avisos de choque eran de OTRA consulta: con la fecha nueva
    // ya no aplican y "agendar igual" no debe quedar armado.
    setAvisosCrear([]);
    setAvisosMover([]);
    if (!nueva) return;
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const [citasRes, bloqueosRes] = await Promise.all([
      supabase
        .from("reservas")
        .select(CAMPOS_CITA)
        .eq("rancho_id", ranchoId)
        .eq("fecha", nueva)
        .not("hora_inicio", "is", null)
        .neq("estado", "temporal")
        .order("hora_inicio", { ascending: true }),
      // Amplio a propósito: el recorte fino al día lo hace bloqueoDelDia.
      supabase
        .from("bloqueos_agenda")
        .select("id, rancho_id, miembro_id, inicio, fin, motivo")
        .eq("rancho_id", ranchoId)
        .lte("inicio", `${nueva}T23:59:59+14:00`)
        .gte("fin", `${nueva}T00:00:00-12:00`),
    ]);

    if (ultimaFecha.current !== nueva) return;
    setCargando(false);
    if (citasRes.error) {
      setError(`No se pudieron cargar las ${visita.plural}: ` + citasRes.error.message);
      return;
    }
    setCitas((citasRes.data ?? []) as CitaDia[]);
    // Si los bloqueos fallan no se pintan como "no hay": se avisa y se
    // conserva lo último que sí se pudo leer.
    if (bloqueosRes.error) {
      setError("No se pudieron cargar los bloqueos: " + bloqueosRes.error.message);
    } else {
      setBloqueos((bloqueosRes.data ?? []) as BloqueoAgenda[]);
    }
  }

  // La misma página tiene otro panel de bloqueos (Bloqueos y
  // ausencias): cuando uno cambia algo, el otro se entera por este
  // evento y refresca — sin compartir estado entre secciones. El
  // `detail` dice quién lo disparó, para no refrescarse a sí mismo.
  useEffect(() => {
    const refrescarPorEvento = (e: Event) => {
      if ((e as CustomEvent).detail === "agenda") return;
      void cargar(ultimaFecha.current);
    };
    window.addEventListener("bookea:bloqueos", refrescarPorEvento);
    return () => window.removeEventListener("bookea:bloqueos", refrescarPorEvento);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargar es estable por cierre sobre refs/estado
  }, []);

  // Solo para que la línea de "ahora" en la vista por persona avance
  // sola sin recargar la página — no guarda ningún dato, solo fuerza
  // el re-render cada minuto para releer new Date() en el render.
  const [, marcarTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => marcarTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  /** El pedazo de un bloqueo que cae dentro del día visible, en minutos. */
  function bloqueoDelDia(b: BloqueoAgenda): { inicio: number; fin: number } | null {
    const ini = instanteEnZona(b.inicio, zona);
    const fin = instanteEnZona(b.fin, zona);
    if (fin.fecha < fecha || ini.fecha > fecha) return null;
    const rango = {
      inicio: ini.fecha === fecha ? ini.minutos : 0,
      fin: fin.fecha === fecha ? fin.minutos : 1440,
    };
    // Un bloqueo que termina justo a medianoche "toca" el día pero no
    // ocupa ni un minuto — no hay nada que pintar.
    return rango.fin > rango.inicio ? rango : null;
  }
  const bloqueosDia = bloqueos
    .map((b) => ({ bloqueo: b, rango: bloqueoDelDia(b) }))
    .filter((x): x is { bloqueo: BloqueoAgenda; rango: { inicio: number; fin: number } } =>
      x.rango !== null,
    );

  function marcar(cita: CitaDia, asistencia: "cumplida" | "no_asistio") {
    setError(null);
    setReincidente(null);
    startTransition(async () => {
      const res = await marcarAsistenciaCita(ranchoId, cita.id, asistencia);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.reincidente) setReincidente(res.reincidente);
      await cargar(fecha);
    });
  }

  function marcarCobrado(cita: CitaDia, monto: string) {
    setError(null);
    const montoNum = monto.trim() ? Number(monto) : null;
    startTransition(async () => {
      const res = await registrarPagoFinal(ranchoId, cita.id, montoNum);
      if (res.error) {
        setError(res.error);
        return;
      }
      await cargar(fecha);
    });
  }

  function deshacerCobro(cita: CitaDia) {
    setError(null);
    startTransition(async () => {
      const res = await revertirPagoFinal(ranchoId, cita.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      await cargar(fecha);
    });
  }

  function cancelar(cita: CitaDia) {
    if (cancelando !== cita.id) {
      setCancelando(cita.id);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cancelarCita(ranchoId, cita.id);
      setCancelando(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      await cargar(fecha);
    });
  }

  function abrirReprogramar(cita: CitaDia) {
    setReprogramando(cita.id);
    setAvisosMover([]);
    setDestino({
      fecha,
      hora: cita.hora_inicio.slice(0, 5),
      miembroId: cita.miembro_id ?? "",
    });
  }

  function reprogramar(citaId: string, ignorarAvisos: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await moverCita(
        ranchoId,
        citaId,
        {
          fecha: destino.fecha,
          hora: destino.hora,
          miembroId: destino.miembroId || null,
        },
        { ignorarAvisos },
      );
      if (res.advertencias && res.advertencias.length > 0) {
        setAvisosMover(res.advertencias);
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      setReprogramando(null);
      setAvisosMover([]);
      await cargar(fecha);
    });
  }

  function elegirServicio(servicioId: string) {
    setAvisosCrear([]);
    const servicio = servicios.find((s) => s.id === servicioId);
    setBorradorCita((b) => ({
      ...b,
      servicioId,
      duracion: servicio?.duracionMinutos ? String(servicio.duracionMinutos) : b.duracion,
      monto: servicio?.precio !== null && servicio?.precio !== undefined ? String(servicio.precio) : b.monto,
    }));
  }

  function crearWalkIn(ignorarAvisos: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await crearCitaManual(
        ranchoId,
        {
          fecha,
          hora: borradorCita.hora,
          duracionMinutos: borradorCita.duracion ? Number(borradorCita.duracion) : null,
          miembroId: borradorCita.miembroId || null,
          itemId: borradorCita.servicioId || null,
          tipoEvento: borradorCita.tipoEvento,
          nombre: borradorCita.nombre,
          telefono: borradorCita.telefono,
          correo: borradorCita.correo,
          notas: borradorCita.notas,
          monto: borradorCita.monto ? Number(borradorCita.monto) : null,
        },
        { ignorarAvisos },
      );
      if (res.advertencias && res.advertencias.length > 0) {
        setAvisosCrear(res.advertencias);
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      setCreando(false);
      setAvisosCrear([]);
      setBorradorCita(CITA_VACIA);
      await cargar(fecha);
    });
  }

  function crearBloqueo() {
    setError(null);
    const desde = borradorBloqueo.diaEntero ? "00:00" : borradorBloqueo.desde;
    const hasta = borradorBloqueo.diaEntero ? "23:59" : borradorBloqueo.hasta;
    startTransition(async () => {
      const res = await crearBloqueoAgenda(ranchoId, {
        miembroId: borradorBloqueo.miembroId || null,
        fechaInicio: fecha,
        horaInicio: desde,
        fechaFin: fecha,
        horaFin: hasta,
        motivo: borradorBloqueo.motivo,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setBloqueando(false);
      setBorradorBloqueo(BLOQUEO_VACIO);
      await cargar(fecha);
      window.dispatchEvent(new CustomEvent("bookea:bloqueos", { detail: "agenda" }));
    });
  }

  function quitarBloqueo(bloqueoId: string) {
    setError(null);
    startTransition(async () => {
      const res = await eliminarBloqueoAgenda(ranchoId, bloqueoId);
      if (res.error) {
        setError(res.error);
        return;
      }
      await cargar(fecha);
      window.dispatchEvent(new CustomEvent("bookea:bloqueos", { detail: "agenda" }));
    });
  }

  // ---------- Vista por persona (columnas estilo Fresha) ----------

  const conAgenda = citas.filter((c) => OCUPAN.has(c.estado));
  // Los estados que DE VERDAD aparecen en el día que se está mirando —
  // es lo que pinta la leyenda de la grilla. Se recorren en el orden
  // del catálogo (no en el de las citas) para que la leyenda no baile
  // de posición al cambiar de día.
  const estadosDelDia = (Object.keys(ESTADO_CITA) as CitaDia["estado"][]).filter((e) =>
    conAgenda.some((c) => c.estado === e),
  );
  // Los bloqueos del negocio entero se pintan en TODAS las columnas —
  // no ameritan una columna "Sin asignar" propia.
  const haySinAsignar = conAgenda.some((c) => c.miembro_id === null);
  // Una persona pausada con citas ese día igual necesita su columna —
  // sus citas no pueden desaparecer de la vista.
  const conCitasDelDia = new Set(conAgenda.map((c) => c.miembro_id));
  const columnas: { id: string | null; nombre: string; fotoUrl: string | null }[] = [
    ...equipo
      .filter((m) => m.activo || conCitasDelDia.has(m.id))
      .map((m) => ({ id: m.id as string | null, nombre: m.nombre, fotoUrl: m.fotoUrl ?? null })),
    ...(haySinAsignar || equipo.filter((m) => m.activo).length === 0
      ? [{ id: null, nombre: equipo.length > 0 ? "Sin asignar" : "El negocio", fotoUrl: null }]
      : []),
  ];

  // El horario de CADA colaborador ese día de semana: hereda el del
  // negocio si no tiene horario propio, o manda el suyo — día libre
  // incluido, vía el rango centinela de horarios_recurso. La columna
  // "Sin asignar"/"El negocio" (id null) usa directo el del negocio.
  const dow = diaDeSemana(fecha);
  const horarioPorColumna = new Map<string | null, Rango[]>(
    columnas.map((col) => {
      if (col.id === null) return [col.id, rangosDelDia(null, dow, horario)];
      const recurso = {
        id: col.id,
        horario: agruparHorarioRecurso(horariosPorMiembro[col.id] ?? []),
      };
      return [col.id, rangosDelDia(recurso, dow, horario)];
    }),
  );

  // El piso de la grilla es SIEMPRE las 6am — se quiere ver la agenda
  // abierta desde esa hora aunque nadie entre tan temprano; cada
  // columna igual pinta atenuadas sus horas realmente cerradas (abajo,
  // segmentosCerrados). Un dato real de antes de las 6am (una cita
  // movida a mano) igual estira la grilla — nunca se esconde.
  const PISO_GRILLA = 6 * 60;
  const CIERRE_POR_DEFECTO = 20 * 60; // nadie trabaja este día: grilla razonable igual
  // El rango centinela de "día libre" (00:00–00:01, ver RANGO_LIBRE en
  // src/app/citas/tipos.ts) NO es horario de trabajo: si se cuela acá,
  // un colaborador con día libre hunde el piso de la grilla a
  // medianoche. Para `segmentosCerrados` sí se conserva — ahí es
  // justamente lo que raya la columna entera.
  const esRangoLibre = (r: Rango) => r.inicio === 0 && r.fin <= 1;
  const rangosTrabajo = [...horarioPorColumna.values()].flat().filter((r) => !esRangoLibre(r));
  const baseDesdeMin =
    rangosTrabajo.length > 0
      ? Math.min(PISO_GRILLA, ...rangosTrabajo.map((r) => r.inicio))
      : PISO_GRILLA;
  const baseHastaMin =
    rangosTrabajo.length > 0
      ? Math.max(...rangosTrabajo.map((r) => r.fin))
      : CIERRE_POR_DEFECTO;

  const minutosDia = conAgenda.flatMap((c) => {
    const ini = minutosDe(c.hora_inicio.slice(0, 5));
    return [ini, ini + (c.duracion_minutos ?? 30)];
  });
  const minutosBloqueos = bloqueosDia.flatMap((x) => [x.rango.inicio, x.rango.fin]);
  const desdeMin = Math.min(
    baseDesdeMin,
    ...minutosDia,
    ...minutosBloqueos.map((m) => Math.max(m, 0)),
  );
  const hastaMin = Math.max(
    baseHastaMin,
    ...minutosDia,
    ...minutosBloqueos.map((m) => Math.min(m, 1440)),
  );
  const inicioGrilla = Math.floor(desdeMin / 60) * 60;
  const finGrilla = Math.ceil(hastaMin / 60) * 60;
  const altoGrilla = finGrilla - inicioGrilla; // 1 min = 1 px

  /** Los huecos de una columna FUERA de su horario real ese día, para
   *  atenuarlos — sin rangos = cerrado el día entero. Recortado a lo
   *  que se ve en la grilla. */
  function segmentosCerrados(rangosTrabajo: Rango[]): Rango[] {
    if (rangosTrabajo.length === 0) return [{ inicio: inicioGrilla, fin: finGrilla }];
    const ordenados = [...rangosTrabajo].sort((a, b) => a.inicio - b.inicio);
    const cerrados: Rango[] = [];
    let cursor = inicioGrilla;
    for (const r of ordenados) {
      const ini = Math.max(r.inicio, inicioGrilla);
      const fin = Math.min(r.fin, finGrilla);
      if (ini > cursor) cerrados.push({ inicio: cursor, fin: ini });
      cursor = Math.max(cursor, fin);
    }
    if (cursor < finGrilla) cerrados.push({ inicio: cursor, fin: finGrilla });
    return cerrados;
  }

  // La línea de "ahora": solo tiene sentido si el día que se está
  // viendo es HOY y cae dentro del rango visible de la grilla.
  const ahora = instanteEnZona(new Date().toISOString(), zona);
  const lineaAhoraMin =
    ahora.fecha === fecha && ahora.minutos >= inicioGrilla && ahora.minutos <= finGrilla
      ? ahora.minutos
      : null;

  /** Fila de pills del "viaje" normal de una cita, con la actual
   *  destacada — los desenlaces alternos (canceló, no vino) se
   *  muestran como una sola pill terminal, no como parte de la fila. */
  const pillsEstado = (cita: CitaDia) => {
    const esTerminalAlterno = ["rechazada", "cancelada", "no_asistio"].includes(cita.estado);
    if (esTerminalAlterno) {
      return <EstadoCita estado={cita.estado} />;
    }
    const indiceActual = PASOS_ESTADO.indexOf(cita.estado);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {PASOS_ESTADO.map((paso, i) => {
          const esActual = i === indiceActual;
          const yaPaso = i < indiceActual;
          // El paso que todavía no llegó se pinta con marco punteado y
          // el gris de texto (7,11:1) en vez del `text-zinc-400` de
          // antes, que sobre blanco daba 2,56:1 — o sea, ilegible.
          if (!esActual && !yaPaso) {
            return (
              <span
                key={paso}
                className={`inline-flex items-center ${RADIO_PILDORA} border border-dashed border-aventurea-line px-2 py-1 text-[11px] font-extrabold uppercase leading-none tracking-wide text-aventurea-ink-soft`}
              >
                {ESTADO_CITA[paso].label}
              </span>
            );
          }
          return (
            <PildoraEstado key={paso} estado={yaPaso ? "exito" : ESTADO_CITA[paso].estado}>
              <span aria-hidden="true">{yaPaso ? "✓" : ESTADO_CITA[paso].glifo}</span>
              <span className="ml-1">{ESTADO_CITA[paso].label}</span>
            </PildoraEstado>
          );
        })}
      </div>
    );
  };

  const seccionCobro = (cita: CitaDia) => {
    if (cita.estado === "bloqueada") return null;
    if (cita.evento_pagado) {
      return (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 ${RADIO_TILE} px-3.5 py-2.5 text-[13px] font-bold ${ESTADO_AVISO.exito}`}
        >
          <span>
            ✓ Cobrado ·{" "}
            {fmtColones(Number(cita.monto_cobrado_final ?? cita.monto_total ?? 0))}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => deshacerCobro(cita)}
            className="text-[12px] font-bold underline hover:no-underline disabled:opacity-40"
          >
            Deshacer
          </button>
        </div>
      );
    }
    return (
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const monto = new FormData(e.currentTarget).get("monto");
          marcarCobrado(cita, String(monto ?? ""));
        }}
      >
        <div className="min-w-[140px] flex-1">
          <label className={labelCls}>Monto cobrado (₡)</label>
          <input
            type="number"
            name="monto"
            min={0}
            defaultValue={cita.monto_total ?? ""}
            className={inputCls}
          />
        </div>
        <button type="submit" disabled={pending} className={BOTON_PANEL_PRIMARIO}>
          Marcar como cobrado
        </button>
      </form>
    );
  };

  const detalle = (cita: CitaDia) => (
    <div className="flex flex-col gap-4">
      {/* El titular del detalle: qué es, cuánto vale y cuándo. El monto
          va en la tinta fuerte y NO en verde: el verde es un estado
          («se cobró»), no la etiqueta de todo lo que sea plata. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-tight text-aventurea-ink">
            {cita.tipo_evento ?? (cita.estado === "bloqueada" ? "Franja bloqueada" : "Servicio")}
          </p>
          {cita.monto_total !== null && (
            <p className="mt-1 text-[16px] font-extrabold tabular-nums tracking-[-0.02em] text-aventurea-ink">
              {fmtColones(Number(cita.monto_total))}
            </p>
          )}
        </div>
        <p className={`shrink-0 text-right ${CUERPO_SUAVE}`}>
          {horaBonita(cita.hora_inicio.slice(0, 5))}
          {cita.duracion_minutos && ` · ${etiquetaMinutos(cita.duracion_minutos)}`}
        </p>
      </div>

      {cita.miembro_id && (
        <p className="text-[13px] text-aventurea-ink-soft">
          Se atenderá con{" "}
          <span className="font-bold text-aventurea-navy">
            {nombreMiembro.get(cita.miembro_id) ?? "alguien que ya no está en el equipo"}
          </span>
        </p>
      )}

      {cita.estado !== "bloqueada" && (
        <div className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-3`}>
          <p className={ROTULO_CAMPO}>{persona.Singular}</p>
          <p className="mt-0.5 text-[14px] font-bold text-aventurea-ink">
            {cita.nombre ?? persona.Singular}
          </p>
          {(cita.contacto || cita.whatsapp || cita.correo) && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {cita.contacto && (
                <a href={`tel:${cita.contacto}`} className={btnChico}>
                  Llamar
                </a>
              )}
              {cita.correo && (
                <a href={`mailto:${cita.correo}`} className={btnChico}>
                  Escribirle
                </a>
              )}
              {cita.whatsapp && (
                <a
                  href={`https://wa.me/${cita.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnChico}
                >
                  WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <p className={`mb-2 ${ROTULO_CAMPO}`}>Estado</p>
        {pillsEstado(cita)}
      </div>

      <div>
        <p className={`mb-2 ${ROTULO_CAMPO}`}>Cobro</p>
        {seccionCobro(cita)}
      </div>

      {cita.notas && (
        <p className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-3 text-[12.5px] leading-relaxed text-aventurea-ink`}>
          {cita.notas}
        </p>
      )}
      {cita.origen === "sync" && (
        <p className={CUERPO_SUAVE}>Viene de tu calendario externo.</p>
      )}

      {cita.estado !== "bloqueada" && (
        <div className="flex flex-wrap gap-1.5">
          {esPasadoOHoy && ["confirmada", "cumplida", "no_asistio"].includes(cita.estado) && (
            <>
              {/* Marcar asistencia: la acción ELEGIDA se queda rellena
                  con el color de su estado y la otra queda como botón
                  normal. Antes la de «Vino» era verde sobre blanco
                  (5,32:1) y la de «No vino» roja: dos colores fuertes
                  compitiendo antes de que el dueño decidiera nada. */}
              <button
                type="button"
                disabled={pending || cita.estado === "cumplida"}
                onClick={() => marcar(cita, "cumplida")}
                className={
                  cita.estado === "cumplida"
                    ? `${btnChicoBase} border-transparent bg-aventurea-green-light text-aventurea-green`
                    : btnChico
                }
              >
                <span aria-hidden="true">✓</span> Vino
              </button>
              <button
                type="button"
                disabled={pending || cita.estado === "no_asistio"}
                onClick={() => marcar(cita, "no_asistio")}
                className={
                  cita.estado === "no_asistio"
                    ? `${btnChicoBase} border-transparent bg-red-50 text-red-700`
                    : btnChico
                }
              >
                <span aria-hidden="true">✕</span> No vino
              </button>
            </>
          )}
          {["pendiente", "confirmada"].includes(cita.estado) && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  reprogramando === cita.id ? setReprogramando(null) : abrirReprogramar(cita)
                }
                className={btnChico}
              >
                Reprogramar
              </button>
              {/* Cancelar pide segundo clic. El primer estado es un
                  botón normal con la letra roja (6,47:1 sobre blanco);
                  solo el «¿confirmar?» se rellena de rojo con letra
                  blanca (4,83:1 sobre red-600), que es cuando de verdad
                  hay que frenar a alguien. */}
              <button
                type="button"
                disabled={pending}
                onClick={() => cancelar(cita)}
                className={
                  cancelando === cita.id
                    ? `${btnChicoBase} border-transparent bg-red-600 text-white`
                    : `${btnChicoBase} border-aventurea-line bg-aventurea-surface text-red-700 hover:border-red-600`
                }
              >
                {cancelando === cita.id
                  ? "¿Confirmar cancelación?"
                  : `Cancelar ${visita.singular}`}
              </button>
            </>
          )}
        </div>
      )}

      {reprogramando === cita.id && (
        <div className={`flex flex-col gap-3 ${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-3`}>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className={labelCls}>Nueva fecha</label>
              <input
                type="date"
                value={destino.fecha}
                onChange={(e) => cambiarDestino({ fecha: e.target.value })}
                className={`${inputCls} min-w-[150px]`}
              />
            </div>
            <div>
              <label className={labelCls}>Hora</label>
              <input
                type="time"
                value={destino.hora}
                onChange={(e) => cambiarDestino({ hora: e.target.value })}
                className={`${inputCls} min-w-[110px]`}
              />
            </div>
            {equipo.length > 0 && (
              <div className="min-w-0 max-w-full">
                <label className={labelCls}>Con</label>
                <select
                  value={destino.miembroId}
                  onChange={(e) => cambiarDestino({ miembroId: e.target.value })}
                  className={`${inputCls} max-w-full`}
                >
                  <option value="">Sin asignar</option>
                  {equipo
                    .filter((m) => m.activo)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <button
              type="button"
              disabled={pending || !destino.hora}
              onClick={() => reprogramar(cita.id, false)}
              className={BOTON_PANEL_PRIMARIO}
            >
              Mover
            </button>
          </div>
          {avisosMover.length > 0 && (
            <div className={`${RADIO_TILE} p-3 text-[12.5px] leading-relaxed ${ESTADO_AVISO.aviso}`}>
              <p className="font-bold">Ojo antes de mover:</p>
              <ul className="mt-1 list-disc pl-4">
                {avisosMover.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled={pending}
                onClick={() => reprogramar(cita.id, true)}
                className={`mt-2.5 ${btnChico}`}
              >
                Mover igual
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  /**
   * LA FILA DE LA LISTA — la fila canónica del panel (`FilaPanel`):
   * hora y duración a la izquierda, la barrita del estado, qué es y con
   * quién, y la píldora a la derecha. Es la MISMA fila que usan el
   * histórico, las giftcards y la lista de espera; lo único propio de
   * acá es que se puede tocar para abrir el detalle.
   */
  const tarjetaCita = (cita: CitaDia, ultima: boolean) => (
    <button
      key={cita.id}
      type="button"
      onClick={() => setSeleccionada(seleccionada === cita.id ? null : cita.id)}
      className="block w-full rounded-xl text-left transition-colors hover:bg-aventurea-cream-2"
    >
      <FilaPanel
        separador={!ultima}
        contexto={
          <ContextoFila
            fuerte={horaBonita(cita.hora_inicio.slice(0, 5))}
            suave={etiquetaMinutos(cita.duracion_minutos ?? 30)}
          />
        }
        marca={ESTADO_CITA[cita.estado].estado}
        titulo={cita.tipo_evento ?? (cita.estado === "bloqueada" ? "Franja bloqueada" : "Servicio")}
        detalle={
          <>
            {cita.nombre ?? (cita.estado === "bloqueada" ? "—" : persona.Singular)}
            {cita.miembro_id && (
              <>
                {" · con "}
                <span className="font-bold text-aventurea-navy">
                  {nombreMiembro.get(cita.miembro_id) ?? "alguien que ya no está en el equipo"}
                </span>
              </>
            )}
          </>
        }
        derecha={<EstadoCita estado={cita.estado} denso />}
      />
    </button>
  );

  // El día que se está mirando, escrito largo — es el TÍTULO de la
  // tarjeta y cambia con la tira de días, así que no repite el kicker
  // de la pantalla (que siempre habla de hoy). Mismo criterio que el
  // encabezado: mediodía UTC + zona fija, o la fecha se corre un día
  // para quien mira de noche.
  const diaLargo = new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T12:00:00Z`));

  return (
    /* LA AGENDA ES UNA TARJETA DEL PANEL (`.card` de la maqueta):
       kicker + título a la izquierda, el selector de vista pegado al
       borde derecho. Antes era una pila de controles sueltos sobre el
       fondo de la página, y por eso la pantalla se leía como un
       formulario largo y no como el mostrador del negocio. */
    <Card
      eyebrow={esHoy ? "Agenda de hoy" : "Agenda del día"}
      titulo={diaLargo}
      accion={
        <div className={`flex ${RADIO_TILE} border border-aventurea-line p-0.5`}>
          {(
            [
              ["personas", "Equipo"],
              ["persona", "Una persona"],
              ["lista", "Lista"],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setVista(valor)}
              aria-pressed={vista === valor}
              // La vista elegida lleva el acento del tipo de negocio
              // (relleno sólido + su letra, ≥5,18:1 en los ocho
              // acentos del catálogo).
              style={vista === valor ? (ACCION_ACENTO as CSSProperties) : undefined}
              className={`h-8 rounded-lg px-2.5 text-[12px] font-bold transition-colors ${
                vista === valor ? "" : "text-aventurea-ink-soft hover:text-aventurea-ink"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        {/* LA TIRA DE DÍAS (`.date-strip` de la maqueta): una superficie
            hundida con las flechas de semana en las puntas y los siete
            días repartiéndose el ancho. A 390px cada día queda en ~45px
            —por encima del mínimo táctil— sin scroll horizontal. */}
        <div
          className={`grid grid-cols-[36px_repeat(7,minmax(0,1fr))_36px] items-center gap-0.5 sm:gap-1 ${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-1`}
        >
          <button
            type="button"
            onClick={() => cargar(sumarDiasISO(fecha, -7))}
            aria-label="Semana anterior"
            className={BOTON_ICONO}
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: 7 }, (_, i) => sumarDiasISO(lunesDeSemana(fecha), i)).map((diaIso) => {
            const dow = new Date(
              Number(diaIso.slice(0, 4)),
              Number(diaIso.slice(5, 7)) - 1,
              Number(diaIso.slice(8, 10)),
            ).getDay();
            const esSel = diaIso === fecha;
            const esHoyChip = diaIso === hoy;
            return (
              <button
                key={diaIso}
                type="button"
                onClick={() => cargar(diaIso)}
                aria-pressed={esSel}
                // El día elegido y el "hoy" llevan el acento del tipo:
                // sólido el seleccionado, tenue el de hoy. Se fue el
                // `opacity-80` del día de la semana: era un alfa
                // decidiendo cuánto se lee un texto.
                style={
                  esSel
                    ? (ACCION_ACENTO as CSSProperties)
                    : esHoyChip
                      ? ({ ...SUPERFICIE_ACENTO, color: "var(--acento)" } as CSSProperties)
                      : undefined
                }
                className={`flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg ${
                  esSel || esHoyChip ? "" : "text-aventurea-ink-soft hover:bg-aventurea-surface"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  {DIAS_CORTO[dow]}
                </span>
                <span className="text-[13px] font-extrabold tabular-nums">
                  {Number(diaIso.slice(8, 10))}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => cargar(sumarDiasISO(fecha, 7))}
            aria-label="Semana siguiente"
            className={BOTON_ICONO}
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={CUERPO_SUAVE}>
            {cargando
              ? "Cargando..."
              : `${citas.length} ${citas.length === 1 ? visita.singular : visita.plural}${
                  esHoy ? " hoy" : ""
                }`}
          </span>
          <div className="ml-auto flex flex-wrap justify-end gap-1.5">
            {!esHoy && (
              <button type="button" onClick={() => cargar(hoyISOCR())} className={btnChico}>
                Volver a hoy
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setBloqueando(!bloqueando);
                setCreando(false);
              }}
              className={btnChico}
            >
              {bloqueando ? "Cerrar" : "Bloquear franja"}
            </button>
          </div>
        </div>

      {/* El "+" flotante de siempre: agendar un walk-in es lo que más
          se toca desde acá, así que queda a mano sin ocupar la barra
          de arriba (mismo patrón que la burbuja de chat). */}
      <button
        type="button"
        onClick={() => {
          setCreando(!creando);
          setBloqueando(false);
          setAvisosCrear([]);
        }}
        aria-label={creando ? "Cerrar el formulario" : `Agendar ${visita.singular}`}
        // El botón que más se toca de la pantalla lleva el acento del
        // tipo de negocio, con la elevación del sistema.
        style={ACCION_ACENTO as CSSProperties}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-flotante transition-transform hover:scale-105 lg:bottom-8 lg:right-8"
      >
        <span className="text-[26px] leading-none">{creando ? "×" : "+"}</span>
      </button>

      {error && (
        <p className={`${RADIO_TILE} p-3 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}>
          {error}
        </p>
      )}

      {reincidente && (
        <div
          className={`flex flex-wrap items-center gap-3 ${RADIO_TILE} p-3.5 text-[13px] leading-relaxed ${ESTADO_AVISO.aviso}`}
        >
          <span className="min-w-0 flex-1">
            <strong>{reincidente.nombre ?? `Este ${persona.singular}`}</strong> faltó a sus
            últimas {reincidente.fallosSeguidos} {visita.plural} seguidas.
            {reincidente.correo
              ? ` Podés mandarle una promoción para recuperarlo desde la pestaña ${persona.Plural}.`
              : " No dejó correo — quizá valga un mensaje por WhatsApp."}
          </span>
          {reincidente.correo && (
            // `?tab=clientes`: la sección de clientes ya no es un ancla
            // de esta misma columna sino una pestaña del rail — el Link
            // actualiza el query y PanelSidebar la trae al frente.
            <Link href="?tab=clientes" className={btnChico} onClick={() => setReincidente(null)}>
              Ir a {persona.Plural}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setReincidente(null)}
            aria-label="Cerrar el aviso"
            className={BOTON_ICONO}
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      {creando && (
        <div className={`flex flex-col gap-3.5 ${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-4`}>
          <h3 className={TITULO_CARD}>
            Agendar {visita.singular} — {diaLargo}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {servicios.length > 0 && (
              <div>
                <label className={labelCls}>Servicio</label>
                <select
                  value={borradorCita.servicioId}
                  onChange={(e) => elegirServicio(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Otro (texto libre)</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                      {s.duracionMinutos ? ` · ${etiquetaMinutos(s.duracionMinutos)}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!borradorCita.servicioId && (
              <div>
                <label className={labelCls}>¿Qué se va a hacer?</label>
                <input
                  type="text"
                  value={borradorCita.tipoEvento}
                  onChange={(e) =>
                    cambiarCita({ tipoEvento: e.target.value })
                  }
                  placeholder="Ej. Corte y barba"
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>Hora</label>
              <input
                type="time"
                value={borradorCita.hora}
                onChange={(e) => cambiarCita({ hora: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Duración (min)</label>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={borradorCita.duracion}
                onChange={(e) =>
                  cambiarCita({ duracion: e.target.value })
                }
                placeholder="30"
                className={inputCls}
              />
            </div>
            {equipo.filter((m) => m.activo).length > 0 && (
              <div>
                <label className={labelCls}>Con</label>
                <select
                  value={borradorCita.miembroId}
                  onChange={(e) =>
                    cambiarCita({ miembroId: e.target.value })
                  }
                  className={inputCls}
                >
                  <option value="">Sin asignar</option>
                  {equipo
                    .filter((m) => m.activo)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>{persona.Singular}</label>
              <input
                type="text"
                value={borradorCita.nombre}
                onChange={(e) => cambiarCita({ nombre: e.target.value })}
                placeholder="Nombre"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Teléfono (opcional)</label>
              <input
                type="tel"
                value={borradorCita.telefono}
                onChange={(e) =>
                  cambiarCita({ telefono: e.target.value })
                }
                placeholder="8888-8888"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Correo (opcional, para recordatorios)</label>
              <input
                type="email"
                value={borradorCita.correo}
                onChange={(e) => cambiarCita({ correo: e.target.value })}
                placeholder="cliente@correo.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Monto en ₡ (opcional)</label>
              <input
                type="number"
                min={0}
                value={borradorCita.monto}
                onChange={(e) => cambiarCita({ monto: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notas (opcional)</label>
              <input
                type="text"
                value={borradorCita.notas}
                onChange={(e) => cambiarCita({ notas: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {avisosCrear.length > 0 && (
            <div className={`${RADIO_TILE} p-3 text-[12.5px] leading-relaxed ${ESTADO_AVISO.aviso}`}>
              <p className="font-bold">Ojo antes de agendar:</p>
              <ul className="mt-1 list-disc pl-4">
                {avisosCrear.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !borradorCita.hora || !borradorCita.nombre.trim()}
              onClick={() => crearWalkIn(avisosCrear.length > 0)}
              className={BOTON_PANEL_PRIMARIO}
            >
              {pending
                ? "Guardando..."
                : avisosCrear.length > 0
                  ? "Agendar igual"
                  : "Agendar"}
            </button>
            {avisosCrear.length > 0 && (
              <button type="button" onClick={() => setAvisosCrear([])} className={btnChico}>
                Cambiar datos
              </button>
            )}
          </div>
        </div>
      )}

      {bloqueando && (
        <div className={`flex flex-col gap-3.5 ${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-4`}>
          <h3 className={TITULO_CARD}>Bloquear franja — {diaLargo}</h3>
          <p className={CUERPO_SUAVE}>
            Nadie puede reservar en una franja bloqueada (almuerzo, un mandado,
            un compromiso de afuera). Para vacaciones de varios días usá la
            sección Bloqueos y ausencias.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            {equipo.filter((m) => m.activo).length > 0 && (
              <div className="min-w-0 max-w-full">
                <label className={labelCls}>Aplica a</label>
                <select
                  value={borradorBloqueo.miembroId}
                  onChange={(e) =>
                    setBorradorBloqueo({ ...borradorBloqueo, miembroId: e.target.value })
                  }
                  className={`${inputCls} max-w-full`}
                >
                  <option value="">Todo el negocio</option>
                  {equipo
                    .filter((m) => m.activo)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        Solo {m.nombre}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 pb-2.5 text-[13px] text-aventurea-ink">
              <input
                type="checkbox"
                checked={borradorBloqueo.diaEntero}
                onChange={(e) =>
                  setBorradorBloqueo({ ...borradorBloqueo, diaEntero: e.target.checked })
                }
              />
              Todo el día
            </label>
            {!borradorBloqueo.diaEntero && (
              <>
                <div>
                  <label className={labelCls}>Desde</label>
                  <input
                    type="time"
                    value={borradorBloqueo.desde}
                    onChange={(e) =>
                      setBorradorBloqueo({ ...borradorBloqueo, desde: e.target.value })
                    }
                    className={`${inputCls} min-w-[110px]`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Hasta</label>
                  <input
                    type="time"
                    value={borradorBloqueo.hasta}
                    onChange={(e) =>
                      setBorradorBloqueo({ ...borradorBloqueo, hasta: e.target.value })
                    }
                    className={`${inputCls} min-w-[110px]`}
                  />
                </div>
              </>
            )}
            <div className="min-w-[180px] flex-1">
              <label className={labelCls}>Motivo (solo lo ves vos)</label>
              <input
                type="text"
                value={borradorBloqueo.motivo}
                onChange={(e) =>
                  setBorradorBloqueo({ ...borradorBloqueo, motivo: e.target.value })
                }
                placeholder="Ej. Almuerzo"
                className={inputCls}
              />
            </div>
            <button
              type="button"
              disabled={
                pending ||
                (!borradorBloqueo.diaEntero &&
                  (!borradorBloqueo.desde || !borradorBloqueo.hasta))
              }
              onClick={crearBloqueo}
              className={BOTON_PANEL_PRIMARIO}
            >
              Bloquear
            </button>
          </div>
        </div>
      )}

      {/* Las franjas bloqueadas del día, como chips: la barrita gris del
          estado NEUTRO adelante (la misma que lleva un bloqueo en la
          grilla y en la lista) y la equis para quitarlo. */}
      {bloqueosDia.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {bloqueosDia.map(({ bloqueo, rango }) => (
            <span
              key={bloqueo.id}
              className={`flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 ${RADIO_PILDORA} border border-aventurea-line bg-aventurea-cream-2 py-1 pl-1.5 pr-2 text-[12px] text-aventurea-ink`}
            >
              <span
                aria-hidden="true"
                className={`h-4 w-1 shrink-0 rounded-full ${ESTADO_MARCA.neutro}`}
              />
              {bloqueo.miembro_id ? (nombreMiembro.get(bloqueo.miembro_id) ?? "—") : "Negocio"}
              {" · "}
              {rango.inicio === 0 && rango.fin === 1440
                ? "todo el día"
                : `${horaBonita(`${String(Math.floor(rango.inicio / 60)).padStart(2, "0")}:${String(rango.inicio % 60).padStart(2, "0")}`)} – ${horaBonita(`${String(Math.floor(rango.fin / 60)).padStart(2, "0")}:${String(rango.fin % 60).padStart(2, "0")}`)}`}
              {bloqueo.motivo ? ` · ${bloqueo.motivo}` : ""}
              <button
                type="button"
                disabled={pending}
                onClick={() => quitarBloqueo(bloqueo.id)}
                aria-label="Quitar bloqueo"
                className="font-bold text-red-700 hover:underline disabled:opacity-40"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* La grilla por persona se ve SIEMPRE (columnas + horas desde
          las 6am), aunque no haya ni una cita ese día — es el mostrador
          y sirve para agendar en un hueco libre. El aviso de "no hay
          citas" solo aplica a la vista de lista, que sin citas no
          tiene nada que listar. */}
      {vista === "lista" && !cargando && citas.length === 0 && !error && (
        <CardVacia>
          {esHoy
            ? `Hoy no tenés ${visita.plural} agendadas.`
            : `Ese día no hay ${visita.plural} agendadas.`}
        </CardVacia>
      )}

      {vista === "lista" && citas.length > 0 && (
        <div>{citas.map((cita, i) => tarjetaCita(cita, i === citas.length - 1))}</div>
      )}

      {(vista === "personas" || vista === "persona") && (
        <div className={`overflow-x-auto ${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-3`}>
          {vista === "persona" && columnas.length > 0 && (
            <div className="mb-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setPersonaIndice((i) => (i - 1 + columnas.length) % columnas.length)
                }
                aria-label="Persona anterior"
                className={BOTON_ICONO}
              >
                <IconChevronLeft className="h-4 w-4" />
              </button>
              {(() => {
                const col = columnas[((personaIndice % columnas.length) + columnas.length) % columnas.length];
                return (
                  <div className="flex min-w-0 items-center gap-2">
                    {col.fotoUrl ? (
                      <Image src={col.fotoUrl} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      /* La inicial va sobre el navy sólido con letra
                         blanca (13,88:1), no sobre un `navy/10` que era
                         un alfa haciendo de superficie. */
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[12px] font-bold text-white">
                        {col.nombre.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <p className="max-w-[220px] truncate text-[14px] font-bold text-aventurea-navy">
                      {col.nombre}
                    </p>
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => setPersonaIndice((i) => (i + 1) % columnas.length)}
                aria-label="Persona siguiente"
                className={BOTON_ICONO}
              >
                <IconChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex min-w-fit gap-3">
            {/* Eje de horas. Su offset tiene que compensar el alto FIJO
                del encabezado de cada columna (ALTO_ENCABEZADO_COLUMNA,
                foto + nombre) — si no, las horas quedan pintadas más
                arriba de la franja a la que en realidad corresponden. */}
            <div
              className="relative w-[46px] shrink-0"
              style={{ height: altoGrilla + ALTO_ENCABEZADO_COLUMNA }}
            >
              {Array.from(
                { length: (finGrilla - inicioGrilla) / 60 + 1 },
                (_, i) => inicioGrilla + i * 60,
              ).map((min) => (
                <span
                  key={min}
                  // Era `text-zinc-400`: 2,56:1 sobre blanco, o sea el
                  // eje de horas de la agenda no se leía. Ahora es el
                  // gris de texto del sistema (6,58:1 sobre el gris de
                  // esta caja).
                  className="absolute right-1 text-[10.5px] font-bold tabular-nums text-aventurea-ink-soft"
                  style={{ top: min - inicioGrilla + ALTO_ENCABEZADO_COLUMNA - 7 }}
                >
                  {String(Math.floor(min / 60)).padStart(2, "0")}:00
                </span>
              ))}
              {lineaAhoraMin !== null && (
                // La hora de AHORA: navy con letra blanca (13,88:1). El
                // celeste de antes daba 4,42:1 con letra blanca — bajo
                // AA, y encima en 9,5px.
                <span
                  className="absolute right-1 z-10 rounded bg-aventurea-navy px-1 py-0.5 text-[10px] font-bold tabular-nums text-white"
                  style={{ top: lineaAhoraMin - inicioGrilla + ALTO_ENCABEZADO_COLUMNA - 8 }}
                >
                  {horaBonita(minutosAHora(lineaAhoraMin))}
                </span>
              )}
            </div>
            {(vista === "persona" && columnas.length > 0
              ? [columnas[((personaIndice % columnas.length) + columnas.length) % columnas.length]]
              : columnas
            ).map((col) => {
              const citasCol = conAgenda.filter((c) => c.miembro_id === col.id);
              const bloqueosCol = bloqueosDia.filter(
                (x) => x.bloqueo.miembro_id === col.id || x.bloqueo.miembro_id === null,
              );
              const cerradosCol = segmentosCerrados(horarioPorColumna.get(col.id) ?? []);
              return (
                <div
                  key={col.id ?? "sin"}
                  className={
                    vista === "persona"
                      ? "w-full max-w-[420px] shrink-0"
                      : "w-[160px] shrink-0 sm:w-[190px]"
                  }
                >
                  {/* En "persona" el nombre ya se ve arriba, en la
                      navegación con flechas — este encabezado se deja
                      vacío pero con la MISMA altura reservada, para no
                      desalinear el eje de horas (que asume siempre
                      ALTO_ENCABEZADO_COLUMNA de offset). */}
                  <div
                    className="flex flex-col items-center justify-center gap-1"
                    style={{ height: ALTO_ENCABEZADO_COLUMNA }}
                  >
                    {vista !== "persona" &&
                      (col.fotoUrl ? (
                        <Image
                          src={col.fotoUrl}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-aventurea-navy text-[11px] font-bold text-white">
                          {col.nombre.slice(0, 1).toUpperCase()}
                        </span>
                      ))}
                    {vista !== "persona" && (
                      <p className="w-full truncate text-center text-[12px] font-bold text-aventurea-navy">
                        {col.nombre}
                      </p>
                    )}
                  </div>
                  {/* LA COLUMNA. Blanca sobre la caja gris de la
                      grilla: lo BLANCO es lo que se puede vender, y lo
                      gris rayado (abajo) lo que no. Era
                      `bg-aventurea-cream-2/60` — un alfa haciendo de
                      superficie, que se veía distinto según lo que
                      tuviera detrás. */}
                  <div
                    className="relative cursor-pointer rounded-xl border border-aventurea-line bg-aventurea-surface"
                    style={{ height: altoGrilla }}
                    title="Hacé clic en un hueco libre para agendar ahí"
                    onClick={(e) => {
                      // getBoundingClientRect() da el borde EXTERIOR del
                      // borde de 1px de esta caja, pero las citas/líneas
                      // de adentro están posicionadas desde el borde
                      // INTERIOR (la caja de relleno) — sin el -1 el
                      // cálculo queda sistemáticamente un minuto tarde.
                      const rect = e.currentTarget.getBoundingClientRect();
                      const minutosClic = inicioGrilla + Math.round(e.clientY - rect.top - 1);
                      const redondeado = Math.min(
                        Math.max(Math.round(minutosClic / 15) * 15, 0),
                        1439,
                      );
                      const enBloqueo = bloqueosCol.some(
                        ({ rango }) => redondeado >= rango.inicio && redondeado < rango.fin,
                      );
                      const enCerrado = cerradosCol.some(
                        (seg) => redondeado >= seg.inicio && redondeado < seg.fin,
                      );
                      if (enBloqueo || enCerrado) return;
                      setSeleccionada(null);
                      setBloqueando(false);
                      setAvisosCrear([]);
                      setCreando(true);
                      setBorradorCita((b) => ({
                        ...b,
                        hora: minutosAHora(redondeado),
                        miembroId: col.id ?? "",
                      }));
                    }}
                  >
                    {/* Fuera del horario real de esta persona ese día
                        (antes de entrar, después de salir, día libre):
                        atenuado con rayas, para que la grilla se vea
                        SIEMPRE desde las 6am pero quede claro dónde no
                        se puede agendar. */}
                    {/* Las horas que esta persona NO trabaja: relleno
                        gris con rayas del color de los bordes. Los dos
                        son tokens SÓLIDOS (`--grey` y `--line`), no
                        alfas: antes eran `rgba(24,28,38,…)` y encima de
                        un bloque de cita se veían de otro color. */}
                    {cerradosCol.map((seg, i) => (
                      <div
                        key={`cerrado-${i}`}
                        aria-hidden
                        className="pointer-events-none absolute left-0 right-0"
                        style={{
                          top: seg.inicio - inicioGrilla,
                          height: seg.fin - seg.inicio,
                          backgroundColor: "var(--grey)",
                          backgroundImage: RAYADO_CERRADO,
                        }}
                      />
                    ))}
                    {/* Las líneas de la grilla: la hora en punto va
                        sólida y la media hora punteada. Antes eran el
                        mismo color a dos alfas distintos
                        (`line/50` y `line/25`), o sea la jerarquía la
                        hacía la transparencia; ahora la hace la FORMA de
                        la línea, que se ve igual sobre cualquier fondo. */}
                    {Array.from(
                      { length: (finGrilla - inicioGrilla) / 30 },
                      (_, i) => inicioGrilla + i * 30,
                    ).map((min) => (
                      <div
                        key={min}
                        className={`pointer-events-none absolute left-0 right-0 border-t border-aventurea-line ${
                          min % 60 === 0 ? "" : "border-dashed"
                        }`}
                        style={{ top: min - inicioGrilla }}
                      />
                    ))}
                    {/* Una franja bloqueada: superficie hundida con la
                        barrita del estado NEUTRO, la misma que lleva en
                        la lista y en los chips de arriba. */}
                    {bloqueosCol.map(({ bloqueo, rango }) => (
                      <div
                        key={bloqueo.id}
                        title={bloqueo.motivo ?? "Bloqueado"}
                        className={`pointer-events-none absolute left-1 right-1 overflow-hidden rounded-lg border border-aventurea-line ${BLOQUE_FONDO.neutro}`}
                        style={{
                          top: Math.max(rango.inicio, inicioGrilla) - inicioGrilla,
                          height:
                            Math.min(rango.fin, finGrilla) -
                            Math.max(rango.inicio, inicioGrilla),
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-0 left-0 w-1 ${ESTADO_MARCA.neutro}`}
                        />
                      </div>
                    ))}
                    {citasCol.map((cita) => {
                      const ini = minutosDe(cita.hora_inicio.slice(0, 5));
                      const dur = cita.duracion_minutos ?? 30;
                      const semaforo = ESTADO_CITA[cita.estado];
                      return (
                        <button
                          key={cita.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSeleccionada(seleccionada === cita.id ? null : cita.id);
                          }}
                          // El bloque lleva el relleno tenue del estado y
                          // su barrita de 4px pegada al borde izquierdo
                          // (el `.mark` de la maqueta): el estado se lee
                          // por la POSICIÓN de la barra y por el glifo,
                          // no solo por el color. El seleccionado se
                          // marca con un anillo navy sólido — el celeste
                          // de antes casi no se despegaba del relleno.
                          className={`absolute left-1 right-1 overflow-hidden rounded-lg border border-aventurea-line pl-2.5 pr-1.5 py-0.5 text-left ${BLOQUE_FONDO[semaforo.estado]} ${
                            seleccionada === cita.id ? "ring-2 ring-aventurea-navy" : ""
                          }`}
                          style={{ top: ini - inicioGrilla, height: Math.max(dur, 22) }}
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute inset-y-0 left-0 w-1 ${ESTADO_MARCA[semaforo.estado]}`}
                          />
                          <span className="block truncate text-[11px] font-bold text-aventurea-ink">
                            <span aria-hidden="true">{semaforo.glifo} </span>
                            {cita.hora_inicio.slice(0, 5)} {cita.nombre ?? ""}
                          </span>
                          <span className="sr-only">{semaforo.label}</span>
                          {dur >= 40 && (
                            <span className="block truncate text-[10.5px] text-aventurea-ink-soft">
                              {cita.tipo_evento ?? ""}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {/* La línea de AHORA, en navy: es un elemento
                        gráfico y sobre blanco da 13,88:1. */}
                    {lineaAhoraMin !== null && (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-aventurea-navy"
                        style={{ top: lineaAhoraMin - inicioGrilla }}
                      >
                        <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-aventurea-navy" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* LA LEYENDA, dentro de la misma caja que explica y con las
              MISMAS píldoras que se ven en los bloques — la leyenda
              tiene que verse igual a lo que explica.

              Solo se listan los estados que de verdad hay ese día
              (`estadosDelDia`, derivado de las citas cargadas): una
              leyenda con siete estados de los que se ven dos no explica
              nada, la llena de ruido. */}
          <div className="mt-3 flex flex-col gap-2">
            {estadosDelDia.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {estadosDelDia.map((e) => (
                  <EstadoCita key={e} estado={e} />
                ))}
              </div>
            )}
            <p className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${CUERPO_SUAVE}`}>
              <span>
                Tocá una {visita.singular} para ver el detalle y marcar asistencia, o un
                hueco libre para agendar ahí mismo.
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-3.5 w-3.5 shrink-0 rounded border border-aventurea-line"
                  style={{
                    backgroundColor: "var(--grey)",
                    backgroundImage: RAYADO_CERRADO,
                  }}
                />
                Rayado = esa persona no trabaja esa hora
              </span>
            </p>
          </div>
        </div>
      )}

      {/* El modal de detalle: un solo lugar para las dos vistas (lista
          y personas) en vez de un panel inline por cada una — así el
          detalle siempre se ve completo, sin competir por espacio con
          la grilla. */}
      {seleccionada &&
        citas.find((c) => c.id === seleccionada) &&
        (() => {
          const cita = citas.find((c) => c.id === seleccionada)!;
          return (
            <div
              onClick={() => setSeleccionada(null)}
              className="fixed inset-0 z-[90] flex items-end justify-center bg-aventurea-ink/35 backdrop-blur-sm sm:items-center sm:p-6"
            >
              {/* La hoja del detalle: `drawer-head` de la maqueta —
                  kicker + qué es, y el cerrar como botón de ícono del
                  sistema. Sube desde abajo en el teléfono y se centra
                  desde sm, como estaba. */}
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`Detalle de la ${visita.singular}`}
                onClick={(e) => e.stopPropagation()}
                className="flex h-full w-full flex-col overflow-hidden bg-aventurea-surface shadow-flotante sm:h-auto sm:max-h-[88vh] sm:max-w-[460px] sm:rounded-3xl sm:border sm:border-aventurea-line"
              >
                <div className="flex items-center justify-between gap-3 border-b border-aventurea-line px-5 py-3.5">
                  <div className="min-w-0">
                    <p className={EYEBROW}>{visita.Singular}</p>
                    <p className={`mt-1 truncate ${TITULO_CARD}`}>
                      {horaBonita(cita.hora_inicio.slice(0, 5))} ·{" "}
                      {cita.nombre ?? persona.Singular}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSeleccionada(null)}
                    aria-label="Cerrar"
                    className={BOTON_ICONO}
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">{detalle(cita)}</div>
              </div>
            </div>
          );
        })()}
      </div>
    </Card>
  );
}
