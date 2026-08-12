"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtColones } from "@/lib/finanzas";
import { IconCalendarLine, IconClock, IconPin, IconStar } from "@/components/icons";
import BotonConsultar from "@/components/boton-consultar";
import { crearCita } from "../../actions";
import { apuntarseListaEspera } from "../../lista-espera-actions";
import { etiquetaMinutos, horaBonita, type HorarioSemana } from "../../tipos";
import { seccionesEnOrden } from "@/lib/catalogo";
import {
  calcularDisponibilidad,
  instanteEnZona,
  rangosDelDia,
  type BloqueoDisponibilidad,
  type CitaExistente,
  type RecursoDisponibilidad,
} from "@/lib/agenda/disponibilidad";

/** "Corte · 45 min · ₡9.000" — la línea de una opción del select. */
function etiquetaServicio(s: Servicio) {
  const base = `${s.nombre} · ${etiquetaMinutos(s.duracion_minutos ?? 30)}`;
  return s.precio !== null ? `${base} · ${fmtColones(s.precio)}` : base;
}

type Servicio = {
  id: string;
  nombre: string;
  precio: number | null;
  duracion_minutos: number | null;
  buffer_min: number | null;
  grupo: string | null;
  /** Política de reserva del servicio (0118). Anulables: null = sin
   *  restricción. crear_cita las hace cumplir; acá se usan para no
   *  ofrecer un espacio que el motor va a rechazar. */
  anticipacion_min_horas?: number | null;
  anticipacion_max_dias?: number | null;
};

/** Fila de la vista disponibilidad_citas (desde 0081 con su buffer). */
type CitaDelDia = {
  hora_inicio: string;
  duracion_minutos: number | null;
  miembro_id: string | null;
  buffer_minutos: number | null;
};

/** Fila de bloqueos_agenda_publicos: cuándo NO se puede, jamás el porqué. */
export type BloqueoPublico = { miembro_id: string | null; inicio: string; fin: string };

/** Fila de servicios_recurso: qué recursos dan qué servicio. */
export type ServicioRecurso = { item_id: string; miembro_id: string };

/** Filas de horarios_recurso agrupadas por miembro (agruparHorarioRecurso). */
export type HorariosPorMiembro = Record<string, RecursoDisponibilidad["horario"]>;

/** El paquete de datos "pro" de la agenda (0061) que las puertas de la
 * página del negocio le pasan al modal — lo carga cargarAgendaPro. */
export type DatosAgendaPro = {
  zonaHoraria: string;
  horariosRecurso: HorariosPorMiembro;
  bloqueos: BloqueoPublico[];
  serviciosRecurso: ServicioRecurso[];
  /** Depósito para asegurar la cita (0095); null/ausente = sin depósito. */
  deposito?: number | null;
  /** Cuenta SINPE del negocio para las instrucciones del depósito. */
  sinpe?: { numero: string | null; titular: string | null } | null;
};

/** Sin horario configurado, el negocio "abre" 8–18 todos los días —
 * el mismo default de siempre de esta pantalla (el RPC tampoco
 * restringe cuando no hay horario guardado). */
const HORARIO_DEFAULT: HorarioSemana = Object.fromEntries(
  Array.from({ length: 7 }, (_, d) => [String(d), { abre: "08:00", cierra: "18:00" }]),
);

type Miembro = { id: string; nombre: string; rol: string | null; foto_url: string | null };

/** Lo que el panel de resumen muestra del negocio (foto, nota, zona). */
export type ResumenNegocio = {
  fotoUrl: string | null;
  promedio: number | null;
  totalResenas: number | null;
  ubicacion: string | null;
};

const DIAS_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** Cuatro semanas hacia adelante — con las flechas alcanza y sobra. */
const DIAS_VISIBLES = 28;

function fechaISOLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sumarMinutos(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * La agenda de citas al estilo Fresha, en dos columnas: a la izquierda
 * el paso activo (fecha y hora → confirmar) y a la derecha el resumen
 * vivo — el negocio, lo elegido y el total — con el botón de avanzar.
 * Las horas se calculan contra las citas reales (vista pública sin
 * datos de nadie) y el RPC vuelve a validar todo en el servidor.
 *
 * No trae fondo propio: quien la usa la mete en su marco — la página
 * /reservar en una tarjeta, y el negocio en el modal que se abre con
 * "Consultar fechas" (ReservarCitaModal, abajo).
 */
export default function ReservarCita({
  ranchoId,
  rutaBase,
  nombreNegocio,
  items,
  ordenSecciones = [],
  equipo,
  horario,
  zonaHoraria,
  horariosRecurso,
  bloqueos,
  serviciosRecurso,
  sesionActiva,
  nombreInicial,
  servicioInicial,
  miembroInicial = null,
  resumen,
  deposito = null,
  sinpe = null,
  onVolverServicios,
}: {
  ranchoId: string;
  rutaBase: string;
  nombreNegocio: string;
  items: Servicio[];
  /** Orden de las secciones guardado por el dueño (categorias_negocio,
   *  0119). Vacío = las secciones salen como vengan los servicios. */
  ordenSecciones?: string[];
  equipo: Miembro[];
  horario: HorarioSemana | null;
  /** Zona IANA del negocio (ranchos.zona_horaria) para los bloqueos. */
  zonaHoraria: string;
  /** Horario propio por miembro (horarios_recurso ya agrupado). */
  horariosRecurso: HorariosPorMiembro;
  /** Bloqueos vigentes del negocio (bloqueos_agenda_publicos). */
  bloqueos: BloqueoPublico[];
  /** Asignación servicio↔recurso; sin filas, lo dan todos (0061). */
  serviciosRecurso: ServicioRecurso[];
  sesionActiva: boolean;
  nombreInicial: string;
  servicioInicial: string | null;
  /** Abre la agenda con esta persona ya elegida ("Reservar con X"). */
  miembroInicial?: string | null;
  resumen?: ResumenNegocio;
  /** Depósito para asegurar la cita (ranchos.deposito_citas, 0095).
   * null o 0 = sin depósito, el flujo de siempre. */
  deposito?: number | null;
  /** La cuenta SINPE del negocio, para las instrucciones del depósito. */
  sinpe?: { numero: string | null; titular: string | null } | null;
  /** En el modal: vuelve a la lista de servicios (lo cierra). Sin esto,
   * la miga "Servicios" navega a la página del negocio. */
  onVolverServicios?: () => void;
}) {
  const [servicioId, setServicioId] = useState(() => {
    if (servicioInicial && items.some((i) => i.id === servicioInicial)) return servicioInicial;
    // "Reservar con X" entra sin servicio elegido: se arranca en el
    // primero que X SÍ da — si no, la persona que el cliente acaba de
    // tocar desaparecería sola de la lista.
    if (miembroInicial) {
      const daElServicio = (itemId: string) => {
        const asignados = serviciosRecurso.filter((sr) => sr.item_id === itemId);
        return asignados.length === 0 || asignados.some((sr) => sr.miembro_id === miembroInicial);
      };
      const suyo = items.find((i) => daElServicio(i.id));
      if (suyo) return suyo.id;
    }
    return items[0]?.id ?? "";
  });
  const [paso, setPaso] = useState<"hora" | "confirmar">("hora");
  const [miembroId, setMiembroId] = useState<string | null>(
    miembroInicial && equipo.some((m) => m.id === miembroInicial) ? miembroInicial : null,
  );
  const [hora, setHora] = useState("");
  const [ocupadas, setOcupadas] = useState<CitaDelDia[]>([]);
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null); // reservaId
  const [pending, startTransition] = useTransition();
  // Lista de espera (0095): "avisame si se libera un espacio ese día".
  const [espera, setEspera] = useState<"nada" | "guardando" | "listo">("nada");
  const [errorEspera, setErrorEspera] = useState<string | null>(null);
  const tiraRef = useRef<HTMLDivElement>(null);

  const servicio = items.find((i) => i.id === servicioId) ?? null;
  const duracion = servicio?.duracion_minutos ?? 30;
  const buffer = servicio?.buffer_min ?? 0;
  const anticipacionMin = servicio?.anticipacion_min_horas ?? 0;
  const anticipacionMax = servicio?.anticipacion_max_dias ?? null;
  // Los servicios ya vienen ordenados por la consulta; esto solo los
  // reparte en secciones y respeta el orden guardado (0119).
  const seccionesDeServicios = seccionesEnOrden(items, ordenSecciones);
  const horarioNegocio = horario ?? HORARIO_DEFAULT;

  // El equipo que da el servicio elegido: con filas en
  // servicios_recurso solo esas personas; sin filas, todas (0061).
  // `restringido` se guarda aparte porque no es lo mismo "este
  // servicio lo da cualquiera" que "lo daban dos personas y las dos
  // están inactivas" — en el segundo caso NADIE lo da, y ofrecer las
  // horas del negocio como recurso único sería mentir (el RPC las
  // rechaza siempre).
  const { equipoDelServicio, restringido } = useMemo(() => {
    const asignados = new Set(
      serviciosRecurso.filter((sr) => sr.item_id === servicioId).map((sr) => sr.miembro_id),
    );
    return asignados.size > 0
      ? { equipoDelServicio: equipo.filter((m) => asignados.has(m.id)), restringido: true }
      : { equipoDelServicio: equipo, restringido: false };
  }, [equipo, serviciosRecurso, servicioId]);

  // Nadie puede dar este servicio: estaba restringido a gente que ya
  // no atiende. Ojo con `equipo.length`: si el negocio se quedó SIN
  // equipo activo, vuelve a ser un recurso único y sus filas viejas
  // de servicios_recurso dejan de aplicar — el RPC decide igual
  // (0081), así que la agenda no puede apagarse por su cuenta.
  const sinNadieQueAtienda =
    equipo.length > 0 && restringido && equipoDelServicio.length === 0;

  // Derivada, no un efecto: si la persona marcada no da el servicio
  // recién elegido, la elección vuelve a "cualquiera".
  const miembroValido =
    miembroId && equipoDelServicio.some((m) => m.id === miembroId) ? miembroId : null;

  // Cada recurso con su horario propio (o herencia del negocio).
  const recursos = useMemo<RecursoDisponibilidad[]>(
    () =>
      equipoDelServicio.map((m) => ({ id: m.id, horario: horariosRecurso[m.id] ?? null })),
    [equipoDelServicio, horariosRecurso],
  );

  // Los próximos días: abierto si ALGÚN recurso del servicio trabaja
  // ese día (horario propio o heredado) — o el negocio, si no hay
  // equipo. Sin nadie que atienda, ningún día se ofrece.
  const diasDelHorario = useMemo(() => {
    // La tira arranca en el "hoy" DEL NEGOCIO. Antes salía del reloj
    // del aparato: en el servidor eso es UTC, así que después de las
    // 6 de la tarde en Costa Rica el HTML ya empezaba en mañana —
    // corrido un día entero, con `esHoy` marcando el día equivocado.
    const [ay, am, ad] = instanteEnZona(new Date().toISOString(), zonaHoraria)
      .fecha.split("-")
      .map(Number);
    // Medianoche local de ESA fecha: así getDate/getMonth/getDay y el
    // formato es-CR siguen leyéndose igual en cualquier huso.
    const hoy = new Date(ay, am - 1, ad);
    return Array.from({ length: DIAS_VISIBLES }, (_, i) => {
      const d = new Date(hoy);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const abierto = sinNadieQueAtienda
        ? false
        : recursos.length > 0
          ? recursos.some((r) => rangosDelDia(r, dow, horarioNegocio).length > 0)
          : rangosDelDia(null, dow, horarioNegocio).length > 0;
      return { date: d, iso: fechaISOLocal(d), dow, abierto, esHoy: i === 0 };
    });
  }, [recursos, horarioNegocio, sinNadieQueAtienda, zonaHoraria]);

  // El tope de anticipación del servicio (0118) cierra los días que el
  // motor rechazaría igual. Va FUERA del memo a propósito: depende del
  // servicio elegido, no del horario del negocio, y meterlo adentro le
  // rompe la memoización al compilador de React.
  const dias =
    anticipacionMax === null
      ? diasDelHorario
      : diasDelHorario.map((d, i) =>
          i <= anticipacionMax ? d : { ...d, abierto: false },
        );

  // Arranca en el primer día abierto de los visibles.
  const [fecha, setFecha] = useState(() => dias.find((d) => d.abierto)?.iso ?? "");

  // Derivada, no un efecto: si el día marcado dejó de estar abierto
  // (cambió el servicio y esa persona no trabaja los martes), la
  // elección se corre sola al primer día que sí — nunca queda un
  // chip en navy con la lista de horas vacía.
  const fechaElegida = dias.some((d) => d.iso === fecha && d.abierto)
    ? fecha
    : (dias.find((d) => d.abierto)?.iso ?? "");

  // Al cambiar el día se traen sus citas confirmadas (vista pública,
  // desde 0081 con el buffer de limpieza de cada una).
  useEffect(() => {
    if (!fechaElegida) return;
    let vigente = true;
    const supabase = createClient();
    supabase
      .from("disponibilidad_citas")
      .select("hora_inicio, duracion_minutos, miembro_id, buffer_minutos")
      .eq("rancho_id", ranchoId)
      .eq("fecha", fechaElegida)
      .then(({ data }) => {
        if (vigente) setOcupadas((data ?? []) as CitaDelDia[]);
      });
    return () => {
      vigente = false;
    };
  }, [ranchoId, fechaElegida]);

  // El teléfono se aprende de reservas anteriores (queda en los
  // metadatos del usuario): con sesión el formulario llega listo.
  useEffect(() => {
    if (!sesionActiva) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const guardado: unknown = user?.user_metadata?.whatsapp;
      if (typeof guardado === "string" && guardado.trim() !== "") {
        setTelefono((prev) => prev || guardado);
      }
    });
  }, [sesionActiva]);

  // Sin useMemo a propósito: el cálculo es barato (una grilla de 30
  // min) y el compilador de React memoiza solo. El motor pro (0061)
  // respeta horario por persona, bloqueos y buffers — lo mismo que el
  // RPC valida en el servidor desde la 0081.
  const diaElegido = dias.find((d) => d.iso === fechaElegida);
  const ahora = new Date();
  const disponibilidad = !diaElegido?.abierto
    ? null
    : calcularDisponibilidad({
        fecha: fechaElegida,
        zonaHoraria,
        horarioNegocio,
        recursos,
        duracionMinutos: duracion,
        bufferMinutos: buffer,
        citas: ocupadas.map<CitaExistente>((c) => ({
          miembroId: c.miembro_id,
          horaInicio: c.hora_inicio,
          duracionMinutos: c.duracion_minutos ?? 30,
          bufferMinutos: c.buffer_minutos ?? 0,
        })),
        bloqueos: bloqueos.map<BloqueoDisponibilidad>((b) => ({
          miembroId: b.miembro_id,
          inicio: b.inicio,
          fin: b.fin,
        })),
        // `ahora` va SIEMPRE, no solo hoy: la anticipación mínima
        // (0118) puede cruzar la medianoche — con 48 h, el corte cae
        // dos días adelante. Pasarlo solo el día de hoy dejaba al motor
        // sin con qué calcularlo y la página ofrecía horas que
        // crear_cita rechazaba. Para un día lejano el margen da
        // negativo y el motor lo aplana en 0, así que no filtra nada.
        ahora,
        // La media hora de gracia que esta pantalla ya tenía es el
        // piso; si el servicio pide más anticipación, manda la suya.
        anticipacionMinHoras: Math.max(0.5, anticipacionMin),
      });
  const horas = !disponibilidad
    ? []
    : miembroValido
      ? (disponibilidad.porRecurso[miembroValido] ?? [])
      : recursos.length > 0
        ? disponibilidad.cualquiera
        : (disponibilidad.porRecurso[""] ?? []);

  // Derivada, no un efecto: si la hora marcada dejó de estar libre
  // (cambió el día, la persona o el servicio), simplemente no cuenta.
  const horaElegida = horas.includes(hora) ? hora : "";

  function apuntarse() {
    if (!fechaElegida || espera !== "nada") return;
    setErrorEspera(null);
    setEspera("guardando");
    startTransition(async () => {
      const res = await apuntarseListaEspera({
        ranchoId,
        fecha: fechaElegida,
        itemId: servicio?.id ?? null,
        miembroId: miembroValido,
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        notas: "",
      });
      if (res.error) {
        setErrorEspera(res.error);
        setEspera("nada");
        return;
      }
      setEspera("listo");
    });
  }

  function confirmar() {
    if (!servicio || !fechaElegida || !horaElegida) return;
    setError(null);
    startTransition(async () => {
      const res = await crearCita({
        ranchoId,
        itemId: servicio.id,
        fecha: fechaElegida,
        hora: horaElegida,
        miembroId: miembroValido,
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        notas: notas.trim(),
      });
      if (res.error !== null) {
        setError(res.error);
        return;
      }
      // La próxima cita sale precargada: nombre y teléfono a los
      // metadatos del usuario (solo con sesión iniciada).
      if (sesionActiva) {
        const supabase = createClient();
        void supabase.auth.updateUser({
          data: { nombre: nombre.trim(), whatsapp: telefono.trim() },
        });
      }
      setExito(res.reservaId);
    });
  }

  function moverTira(direccion: -1 | 1) {
    tiraRef.current?.scrollBy({ left: direccion * 280, behavior: "smooth" });
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-[13.5px] text-aventurea-ink-soft">
        Este negocio todavía no publicó sus servicios — consultale por el chat.
      </div>
    );
  }

  if (exito) {
    return (
      <div className="p-10 text-center sm:p-14">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aventurea-green/10 text-[26px]">
          ✓
        </span>
        <h2 className="titulo mt-4 text-[22px] text-aventurea-ink">
          ¡Tu cita quedó confirmada!
        </h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          {servicio?.nombre} en {nombreNegocio} —{" "}
          {diaElegido
            ? `${DIAS_CORTO[diaElegido.dow]} ${diaElegido.date.getDate()} de ${MESES_CORTO[diaElegido.date.getMonth()]}`
            : fechaElegida}
          , {horaBonita(hora)}. Te mandamos el comprobante por correo
          {deposito !== null && deposito > 0 ? "." : "; el pago es en el local."}
        </p>
        {deposito !== null && deposito > 0 && (
          <div className="mx-auto mt-5 max-w-[420px] rounded-2xl border border-aventurea-navy/25 bg-[#f4f7fd] p-5 text-left">
            <p className="text-[13.5px] font-extrabold text-aventurea-ink">
              Aseguralo con tu depósito de {fmtColones(deposito)}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
              {sinpe?.numero ? (
                <>
                  Por SINPE Móvil al{" "}
                  <strong className="text-aventurea-ink">{sinpe.numero}</strong>
                  {sinpe.titular ? ` (a nombre de ${sinpe.titular})` : ""}.{" "}
                </>
              ) : (
                "El negocio te pasa los datos de SINPE por el chat. "
              )}
              Cuando lo hagás, mandá el comprobante por el chat de tu cita — el
              negocio lo valida y listo.
            </p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/mensajes/${exito}`}
            className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
          >
            Abrir el chat del negocio
          </Link>
          {onVolverServicios ? (
            <button
              type="button"
              onClick={onVolverServicios}
              className="rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink hover:border-aventurea-navy"
            >
              Volver al negocio
            </button>
          ) : (
            <Link
              href={rutaBase}
              className="rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink hover:border-aventurea-navy"
            >
              Volver al negocio
            </Link>
          )}
        </div>
      </div>
    );
  }

  const horaFin = horaElegida ? sumarMinutos(horaElegida, duracion) : null;
  const fechaLarga = diaElegido
    ? diaElegido.date.toLocaleDateString("es-CR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;
  const inputCls =
    "w-full rounded-xl border border-aventurea-line bg-white px-4 py-3 text-[13.5px] text-aventurea-ink placeholder:text-zinc-400 focus:border-aventurea-navy focus:outline-none";
  const puedeContinuar = !!servicio && !!fechaElegida && !!horaElegida;

  return (
    <div className="grid lg:grid-cols-[1fr_330px]">
      {/* ---------- Columna del paso activo ---------- */}
      <div className="min-w-0 p-6 sm:p-8">
        {/* Migas: Servicios › Hora › Confirmar */}
        <nav className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-bold">
          {onVolverServicios ? (
            <button
              type="button"
              onClick={onVolverServicios}
              className="text-aventurea-ink-soft hover:text-aventurea-navy"
            >
              Servicios
            </button>
          ) : (
            <Link href={rutaBase} className="text-aventurea-ink-soft hover:text-aventurea-navy">
              Servicios
            </Link>
          )}
          <Miga />
          {paso === "hora" ? (
            <span className="text-aventurea-ink">Hora</span>
          ) : (
            <button
              type="button"
              onClick={() => setPaso("hora")}
              className="text-aventurea-ink-soft hover:text-aventurea-navy"
            >
              Hora
            </button>
          )}
          <Miga />
          <span className={paso === "confirmar" ? "text-aventurea-ink" : "text-zinc-400"}>
            Confirmar
          </span>
        </nav>

        {paso === "hora" ? (
          <>
            <h2 className="titulo mt-3 text-[clamp(22px,2.6vw,30px)] text-aventurea-ink">
              Seleccioná fecha y hora
            </h2>

            {/* Servicio (por si entró sin elegir uno) */}
            <label className="mt-5 block">
              <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                Servicio
              </span>
              <select
                value={servicioId}
                onChange={(e) => setServicioId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-aventurea-line bg-white px-4 py-3 text-[13.5px] font-bold text-aventurea-ink focus:border-aventurea-navy focus:outline-none"
              >
                {/* Agrupado por sección (0119) en el orden que guardó el
                    dueño. Con una sola sección —o ninguna— el <select>
                    se ve exactamente igual que antes. */}
                {seccionesDeServicios.map((seccion) =>
                  seccion.grupo === null && seccionesDeServicios.length === 1 ? (
                    seccion.items.map((s) => (
                      <option key={s.id} value={s.id}>
                        {etiquetaServicio(s)}
                      </option>
                    ))
                  ) : (
                    <optgroup key={seccion.grupo ?? "otros"} label={seccion.grupo ?? "Otros"}>
                      {seccion.items.map((s) => (
                        <option key={s.id} value={s.id}>
                          {etiquetaServicio(s)}
                        </option>
                      ))}
                    </optgroup>
                  ),
                )}
              </select>
            </label>

            {/* ¿Con quién? — solo las personas que dan este servicio */}
            {equipoDelServicio.length > 0 && (
              <div className="mt-5">
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                  ¿Con quién?
                </span>
                <div className="flex flex-wrap gap-2">
                  <BotonMiembro
                    activo={miembroValido === null}
                    onClick={() => setMiembroId(null)}
                    nombre="Cualquiera"
                  />
                  {equipoDelServicio.map((m) => (
                    <BotonMiembro
                      key={m.id}
                      activo={miembroValido === m.id}
                      onClick={() => setMiembroId(m.id)}
                      nombre={m.nombre}
                      fotoUrl={m.foto_url}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Día — tira horizontal con flechas */}
            <div className="mt-6 flex items-center justify-between">
              <span className="text-[14px] font-extrabold text-aventurea-ink">
                Seleccioná una fecha
              </span>
              <span className="flex gap-1">
                <BotonFlecha direccion={-1} onClick={() => moverTira(-1)} />
                <BotonFlecha direccion={1} onClick={() => moverTira(1)} />
              </span>
            </div>
            <div
              ref={tiraRef}
              className="mt-2.5 flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none]"
            >
              {dias.map((d) => {
                const cerrado = !d.abierto;
                const elegido = d.iso === fechaElegida;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    disabled={cerrado}
                    onClick={() => setFecha(d.iso)}
                    className={`flex w-[62px] shrink-0 flex-col items-center gap-0.5 rounded-2xl border py-3 transition-colors ${
                      elegido
                        ? "border-aventurea-navy bg-aventurea-navy text-white shadow-[0_10px_24px_-12px_rgba(22,41,94,0.7)]"
                        : cerrado
                          ? "cursor-not-allowed border-[#eef2f9] bg-[#fafbfd] text-zinc-300"
                          : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
                    }`}
                  >
                    <span className="text-[10.5px] font-bold lowercase">{DIAS_CORTO[d.dow]}</span>
                    <span className="text-[17px] font-extrabold leading-none">
                      {d.date.getDate()}
                    </span>
                    <span className="text-[10px] font-semibold opacity-70">
                      {MESES_CORTO[d.date.getMonth()]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hora — filas anchas, como Fresha */}
            <p className="mt-6 text-[14px] font-extrabold text-aventurea-ink">Escogé una hora</p>
            {horas.length === 0 ? (
              <div className="mt-2.5 flex flex-col gap-3 rounded-2xl border border-aventurea-line bg-[#fafbfe] px-5 py-4">
                <p className="text-[13px] text-aventurea-ink-soft">
                  {sinNadieQueAtienda
                    ? "Nadie está atendiendo este servicio por ahora — elegí otro o consultale al negocio."
                    : !fechaElegida
                      ? "Este negocio no tiene días de atención abiertos por ahora — consultale por el chat."
                      : `No quedan espacios libres ese día — probá con otra fecha${equipoDelServicio.length > 0 ? " u otra persona" : ""}.`}
                </p>
                {/* Lista de espera: si el día está lleno, dejá el nombre
                    y el negocio te avisa cuando se libere un espacio. */}
                {fechaElegida && !sinNadieQueAtienda && (
                  espera === "listo" ? (
                    <p className="rounded-xl bg-aventurea-green/10 px-4 py-3 text-[13px] font-bold text-aventurea-green">
                      ✓ Quedaste en la lista de espera: si se libera un espacio
                      ese día te avisamos por correo al instante.
                    </p>
                  ) : sesionActiva ? (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={espera === "guardando"}
                        onClick={apuntarse}
                        className="w-fit rounded-xl border border-aventurea-navy bg-white px-4 py-2.5 text-[13px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white disabled:opacity-50"
                      >
                        {espera === "guardando"
                          ? "Guardando…"
                          : "🔔 Avisame si se libera un espacio"}
                      </button>
                      {errorEspera && (
                        <p className="text-[12.5px] font-semibold text-red-700">{errorEspera}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-aventurea-ink-soft">
                      <Link href="/cuenta" className="font-bold text-aventurea-navy hover:underline">
                        Iniciá sesión
                      </Link>{" "}
                      para que te avisemos si se libera un espacio ese día.
                    </p>
                  )
                )}
              </div>
            ) : (
              /* La lista scrollea dentro de su propia caja: por larga
                 que sea la jornada, el botón de Continuar no se va de
                 la pantalla. */
              <div className="mt-2.5 flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
                {horas.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHora(h)}
                    className={`rounded-2xl border px-5 py-3.5 text-left text-[14px] font-bold transition-colors ${
                      h === horaElegida
                        ? "border-2 border-aventurea-navy bg-[#f4f7fd] text-aventurea-ink"
                        : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
                    }`}
                  >
                    {horaBonita(h)}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-4 text-[12.5px] text-aventurea-ink-soft">
              ¿Ninguna hora te sirve?{" "}
              <BotonConsultar
                ranchoId={ranchoId}
                nombre={nombreNegocio}
                className="font-bold text-aventurea-navy hover:underline"
              >
                Consultale al negocio por el chat
              </BotonConsultar>
            </p>
          </>
        ) : (
          <>
            <h2 className="titulo mt-3 text-[clamp(22px,2.6vw,30px)] text-aventurea-ink">
              Confirmá tu cita
            </h2>

            {!sesionActiva ? (
              <div className="mt-5 rounded-2xl border border-aventurea-line bg-[#f4f7fd] p-5 text-[13.5px] leading-relaxed text-aventurea-ink">
                Para confirmar tu cita iniciá sesión — así te llega el
                comprobante y podés escribirle al negocio por el chat.
                <Link
                  href="/cuenta"
                  className="mt-3 block w-fit rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
                >
                  Iniciar sesión
                </Link>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre"
                    className={inputCls}
                  />
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Tu teléfono (opcional)"
                    className={inputCls}
                  />
                </div>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="¿Algo que el negocio deba saber? (opcional)"
                  rows={3}
                  className={inputCls}
                />
                {error && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
                    {error}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setPaso("hora")}
              className="mt-5 text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy"
            >
              ← Cambiar la fecha o la hora
            </button>
          </>
        )}
      </div>

      {/* ---------- Resumen vivo ---------- */}
      {/* Sticky dentro del scroll del modal: el resumen y su botón de
          Continuar acompañan siempre, sin perderse abajo. */}
      <aside className="flex flex-col gap-4 border-t border-[#e6edf8] bg-[#fafbfe] p-6 lg:sticky lg:top-0 lg:self-start lg:border-l lg:border-t-0">
        <div className="flex items-center gap-3">
          {resumen?.fotoUrl ? (
            <Image
              src={resumen.fotoUrl}
              alt={nombreNegocio}
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-aventurea-blue-light text-aventurea-navy">
              <IconClock className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-extrabold text-aventurea-ink">
              {nombreNegocio}
            </p>
            {resumen?.promedio != null && (resumen.totalResenas ?? 0) > 0 && (
              <p className="flex items-center gap-1 text-[12px] font-bold text-aventurea-ink">
                <IconStar className="h-3 w-3 text-aventurea-orange" />
                {resumen.promedio.toFixed(1)}
                <span className="font-semibold text-aventurea-ink-soft">
                  ({resumen.totalResenas})
                </span>
              </p>
            )}
            {resumen?.ubicacion && (
              <p className="flex items-center gap-1 truncate text-[11.5px] text-aventurea-ink-soft">
                <IconPin className="h-3 w-3 shrink-0 text-aventurea-navy" /> {resumen.ubicacion}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#e6edf8] pt-4 text-[13px]">
          <p className="flex items-center gap-2 text-aventurea-ink">
            <IconCalendarLine className="h-4 w-4 shrink-0 text-aventurea-navy" />
            {fechaLarga ?? <span className="text-zinc-400">Elegí la fecha</span>}
          </p>
          <p className="flex items-center gap-2 text-aventurea-ink">
            <IconClock className="h-4 w-4 shrink-0 text-aventurea-navy" />
            {horaElegida && horaFin ? (
              `${horaBonita(horaElegida)} – ${horaBonita(horaFin)} (${etiquetaMinutos(duracion)})`
            ) : (
              <span className="text-zinc-400">Elegí la hora</span>
            )}
          </p>
          {miembroValido && (
            <p className="text-[12.5px] text-aventurea-ink-soft">
              Con {equipoDelServicio.find((m) => m.id === miembroValido)?.nombre}
            </p>
          )}
        </div>

        {servicio && (
          <div className="border-t border-[#e6edf8] pt-4">
            <div className="flex items-start justify-between gap-3 text-[13px]">
              <span className="text-aventurea-ink">{servicio.nombre}</span>
              <span className="shrink-0 font-bold text-aventurea-ink">
                {servicio.precio !== null ? fmtColones(servicio.precio) : "Consultar"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#e6edf8] pt-3">
              <span className="text-[14px] font-extrabold text-aventurea-ink">Total</span>
              <span className="text-[15px] font-extrabold text-aventurea-ink">
                {servicio.precio !== null ? fmtColones(servicio.precio) : "Consultar"}
              </span>
            </div>
            {deposito !== null && deposito > 0 && (
              <div className="mt-2 flex items-center justify-between text-[12.5px]">
                <span className="text-aventurea-ink-soft">Depósito para asegurar</span>
                <span className="font-bold text-aventurea-navy">{fmtColones(deposito)}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {paso === "hora" ? (
            <button
              type="button"
              disabled={!puedeContinuar}
              onClick={() => setPaso("confirmar")}
              className="flex items-center justify-center gap-2 rounded-xl bg-aventurea-navy px-6 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          ) : sesionActiva ? (
            <button
              type="button"
              disabled={pending || !puedeContinuar || !nombre.trim()}
              onClick={confirmar}
              className="rounded-xl bg-aventurea-sky px-6 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Confirmando…" : "Confirmar cita"}
            </button>
          ) : (
            <Link
              href="/cuenta"
              className="rounded-xl bg-aventurea-navy px-6 py-3.5 text-center text-[14px] font-bold text-white hover:bg-aventurea-navy-2"
            >
              Iniciar sesión para confirmar
            </Link>
          )}
          <p className="text-center text-[11.5px] text-aventurea-ink-soft">
            {deposito !== null && deposito > 0
              ? `Este negocio pide un depósito de ${fmtColones(deposito)} por SINPE — al confirmar te damos las instrucciones.`
              : "Todavía no pagás nada — el pago es en el local."}
          </p>
          <p className="text-center text-[10.5px] text-zinc-400">
            💳 Pago con tarjeta en línea: muy pronto
          </p>
        </div>
      </aside>
    </div>
  );
}

/**
 * "Consultar fechas": la agenda de arriba desplegada en grande sobre
 * la página del negocio — sin navegar a otra ruta. Cierra con la ✕,
 * con Escape o tocando el fondo oscuro.
 */
export function ReservarCitaModal({
  abierta,
  onCerrar,
  ...propsAgenda
}: {
  abierta: boolean;
  onCerrar: () => void;
} & Omit<Parameters<typeof ReservarCita>[0], "onVolverServicios">) {
  // Con el modal abierto la página de atrás no scrollea.
  useEffect(() => {
    if (!abierta) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reservar en ${propsAgenda.nombreNegocio}`}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
    >
      <button
        type="button"
        aria-label="Cerrar la agenda"
        onClick={onCerrar}
        className="absolute inset-0 cursor-default bg-[rgba(10,18,42,0.55)] backdrop-blur-[2px]"
      />
      <div className="relative flex max-h-[92vh] w-full max-w-[1020px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_48px_120px_-40px_rgba(6,12,32,0.65)]">
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onCerrar}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-aventurea-line bg-white text-aventurea-ink shadow-sm transition-colors hover:border-aventurea-navy"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="overflow-y-auto">
          <ReservarCita {...propsAgenda} onVolverServicios={onCerrar} />
        </div>
      </div>
    </div>
  );
}

function Miga() {
  return <span className="text-zinc-300">›</span>;
}

function BotonFlecha({ direccion, onClick }: { direccion: -1 | 1; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={direccion === -1 ? "Fechas anteriores" : "Más fechas"}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-aventurea-line bg-white text-aventurea-ink transition-colors hover:border-aventurea-navy"
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

function BotonMiembro({
  activo,
  onClick,
  nombre,
  fotoUrl,
}: {
  activo: boolean;
  onClick: () => void;
  nombre: string;
  fotoUrl?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
      }`}
    >
      {fotoUrl ? (
        <Image src={fotoUrl} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${
            activo ? "bg-white/20 text-white" : "bg-aventurea-blue-light text-aventurea-navy"
          }`}
        >
          {nombre.trim().charAt(0).toUpperCase()}
        </span>
      )}
      {nombre}
    </button>
  );
}
