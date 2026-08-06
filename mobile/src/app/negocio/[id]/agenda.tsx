import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import {
  Aviso,
  AvisoAgenda,
  Boton,
  ChipCategoria,
  Estado,
  FilaHora,
  Micro,
  Tarjeta,
  type TonoEstado,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";
import {
  DIAS_CORTO,
  DIAS_SEMANA_LABEL,
  MESES_CORTO,
  RANGO_LIBRE,
  fechaISOLocal,
  horaAMinutos,
  horarioDeDetalles,
  minutosAHora,
  sumarMinutosHora,
  utcDesdeZona,
  type HorarioSemana,
} from "@/lib/citas";
import {
  diaDeSemana,
  instanteEnZona,
  rangosDelDia,
  type Rango,
  type RecursoDisponibilidad,
} from "@/lib/disponibilidad";
import { agruparClientes } from "@/lib/crm";

/**
 * La agenda del día de un negocio de citas (uñas, barbería, spa...):
 * las citas hora por hora según el horario semanal del negocio, con la
 * acción clave del mostrador — marcar si el cliente llegó o no — y el
 * botón para suscribir la agenda en Google/Apple Calendar. Espejo de
 * la agenda del panel web (/mi-negocio/[id]/citas); las políticas RLS
 * limitan la lectura y la edición al dueño del negocio.
 *
 * Desde acá también se atiende el mostrador completo, igual que en la
 * web: cargar un walk-in con hora ("+ Nueva cita"), mover o cancelar
 * una cita, bloquear una franja (almuerzo, un mandado) y el aviso de
 * cliente reincidente al marcar un no-show.
 *
 * La línea de tiempo es la del mockup: la hora en su columna fija a la
 * izquierda, la cita a la derecha, y los huecos como ranuras punteadas
 * de "Libre" — el espacio vacío tiene que verse tan claro como la cita.
 */

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/** Cuántos días muestra la tira: una semana atrás y dos adelante. */
const DIAS_ATRAS = 7;
const DIAS_ADELANTE = 14;
/** Ancho fijo de cada chip de día + su separación, para autocentrar hoy. */
const ANCHO_DIA = 52 + 8;

type ReservaAgenda = {
  id: string;
  fecha: string;
  nombre: string | null;
  tipo_evento: string | null;
  estado: string;
  hora_inicio: string | null;
  duracion_minutos: number | null;
  horario_bloque: string | null;
  monto_total: number | null;
  notas: string | null;
  miembro_id: string | null;
  correo: string | null;
  whatsapp: string | null;
};

/** Una cita con hora ya garantizada (lo que va en la línea de tiempo). */
type CitaAgenda = ReservaAgenda & { hora_inicio: string };

/** Una persona (o recurso) del equipo, lo mínimo para la agenda. */
type Miembro = { id: string; nombre: string; activo: boolean; foto_url: string | null };

/** Un servicio de cita del catálogo (rancho_items con duración). */
type ServicioCita = {
  id: string;
  nombre: string;
  duracion_minutos: number | null;
  precio: number | null;
};

/** Un bloqueo tal como vive en bloqueos_agenda (timestamptz). */
type BloqueoAgenda = {
  id: string;
  miembro_id: string | null;
  inicio: string;
  fin: string;
  motivo: string | null;
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "En aprobación",
  confirmada: "Cita confirmada",
  cumplida: "Cumplida",
  no_asistio: "No asistió",
  cancelada: "Cancelada",
  bloqueada: "Bloqueada",
};

/**
 * Confirmada va en NAVY sólido — es la cita que está por pasar, lo
 * único que se rellena en la línea del día. Cumplida ya pasó, así que
 * baja a verde tinte; pendiente pide acción y va en naranja.
 */
const ESTADO_TONO: Record<string, TonoEstado> = {
  pendiente: "naranja",
  confirmada: "navy",
  cumplida: "verde",
  no_asistio: "rojo",
  cancelada: "gris",
  bloqueada: "gris",
};

/** Solo desde estos estados se corrige la asistencia (igual que la web). */
const MARCABLES = ["confirmada", "cumplida", "no_asistio"];

/** Estados que ocupan la franja de verdad (los cancelados no estorban). */
const OCUPAN = new Set(["pendiente", "confirmada", "bloqueada", "cumplida", "no_asistio"]);

/**
 * Alto fijo del encabezado de cada columna en la vista por persona
 * (foto + nombre). Es un número, no algo que se mida del layout, a
 * propósito: el eje de horas (una columna hermana, sin encabezado
 * propio) necesita el MISMO valor para desplazar sus horas hacia
 * abajo y quedar alineado con la grilla real de cada columna.
 */
const ALTO_ENCABEZADO_COLUMNA = 50;

/** Piel del bloque en la vista por persona — mismo criterio que ESTADO_TONO. */
function estiloBloque(estado: string) {
  switch (estado) {
    case "confirmada":
      return { backgroundColor: Colors.blueLight, borderColor: Colors.navy };
    case "pendiente":
      return { backgroundColor: Colors.skyLight, borderColor: Colors.sky };
    case "cumplida":
      return { backgroundColor: Colors.greenLight, borderColor: Colors.green };
    case "no_asistio":
    case "cancelada":
    case "rechazada":
      return { backgroundColor: Colors.dangerLight, borderColor: Colors.danger };
    case "bloqueada":
      return { backgroundColor: Colors.cream2, borderColor: Colors.line };
    default:
      return { backgroundColor: Colors.cream2, borderColor: Colors.line };
  }
}

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** El borrador del walk-in, todo en texto (viene de TextInputs). */
const CITA_VACIA = {
  servicioId: "", // "" = "Otro": el texto libre en tipoEvento
  tipoEvento: "",
  hora: "",
  duracion: "",
  miembroId: "", // "" = sin asignar
  nombre: "",
  telefono: "",
  correo: "",
  monto: "",
  notas: "",
};

const BLOQUEO_VACIO = {
  miembroId: "", // "" = todo el negocio
  diaEntero: false,
  desde: "",
  hasta: "",
  motivo: "",
};

function deISO(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

/**
 * Aviso a la web de que la cita quedó cumplida, para que otorgue los
 * puntos de lealtad (eso vive en el servidor). Nunca lanza ni bloquea:
 * la cita ya quedó marcada en la base antes de llamar acá.
 */
async function avisarCitaCumplida(reservaId: string) {
  try {
    await fetch(`${SITIO_URL}/api/citas/${reservaId}/asistencia`, { method: "POST" });
  } catch {
    // Sin drama: los puntos se pueden otorgar después desde el panel web.
  }
}

export default function AgendaNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [nombreNegocio, setNombreNegocio] = useState<string | null>(null);
  const [horario, setHorario] = useState<HorarioSemana | null>(null);
  const [zona, setZona] = useState("America/Costa_Rica");
  const [filas, setFilas] = useState<ReservaAgenda[] | null>(null);
  const [equipo, setEquipo] = useState<Miembro[]>([]);
  /** Horario propio por miembro (horarios_recurso, 0061), agrupado
   *  como lo espera el motor: claves SOLO para los días con filas —
   *  un día sin filas hereda el horario del negocio. */
  const [horariosRecurso, setHorariosRecurso] = useState<
    Record<string, RecursoDisponibilidad["horario"]>
  >({});
  const [servicios, setServicios] = useState<ServicioCita[]>([]);
  const [bloqueos, setBloqueos] = useState<BloqueoAgenda[]>([]);
  const [cargandoDia, setCargandoDia] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  // La agenda "de verdad" (columnas por persona, estilo Fresha) es el
  // punto de partida — espejo de la web (agenda-citas.tsx). La línea
  // del día agrupada por hora queda como alternativa a un toque.
  const [vista, setVista] = useState<"lista" | "personas">("personas");
  const [citaGridId, setCitaGridId] = useState<string | null>(null);

  // Solo para que la línea de "ahora" en la vista por persona avance
  // sola — no guarda datos, fuerza el re-render cada minuto.
  const [, marcarTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => marcarTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // El walk-in del mostrador ("+ Nueva cita") y el bloqueo de franja:
  // cada uno abre su tarjeta-formulario inline, nunca los dos a la vez.
  const [creando, setCreando] = useState(false);
  const [guardandoCita, setGuardandoCita] = useState(false);
  const [borrador, setBorrador] = useState(CITA_VACIA);
  const [bloqueando, setBloqueando] = useState(false);
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  const [borradorBloqueo, setBorradorBloqueo] = useState(BLOQUEO_VACIO);

  const hoyISO = useMemo(() => fechaISOLocal(new Date()), []);
  const [fecha, setFecha] = useState(hoyISO);
  // Si el dueño cambia de día rápido, solo interesa la última consulta.
  const ultimaFecha = useRef(hoyISO);
  const tiraCentrada = useRef(false);
  const tiraRef = useRef<ScrollView | null>(null);

  const dias = useMemo(() => {
    const hoy = deISO(hoyISO);
    const lista: { iso: string; numero: number; etiqueta: string }[] = [];
    for (let i = -DIAS_ATRAS; i <= DIAS_ADELANTE; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
      lista.push({
        iso: fechaISOLocal(d),
        numero: d.getDate(),
        etiqueta: DIAS_CORTO[d.getDay()],
      });
    }
    return lista;
  }, [hoyISO]);

  const cargar = useCallback(async () => {
    if (!session) return;
    const consultada = fecha;
    ultimaFecha.current = consultada;
    setCargandoDia(true);
    const [ranchoRes, reservasRes, equipoRes, serviciosRes, bloqueosRes] = await Promise.all([
      supabase
        .from("ranchos")
        .select("nombre, detalles, zona_horaria")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("reservas")
        .select(
          "id, fecha, nombre, tipo_evento, estado, hora_inicio, duracion_minutos, horario_bloque, monto_total, notas, miembro_id, correo, whatsapp",
        )
        .eq("rancho_id", id)
        .eq("fecha", consultada)
        .not("estado", "in", "(temporal,rechazada)")
        .order("hora_inicio", { ascending: true, nullsFirst: true }),
      supabase
        .from("equipo_rancho")
        .select("id, nombre, activo, foto_url")
        .eq("rancho_id", id)
        .order("orden", { ascending: true }),
      // Los servicios de cita del catálogo, para precargar el walk-in.
      supabase
        .from("rancho_items")
        .select("id, nombre, duracion_minutos, precio")
        .eq("rancho_id", id)
        .eq("activo", true)
        .not("duracion_minutos", "is", null)
        .order("orden", { ascending: true }),
      // Amplio a propósito (cubre cualquier zona horaria); el recorte
      // fino al día lo hace rangoBloqueoEnDia con la zona del negocio.
      supabase
        .from("bloqueos_agenda")
        .select("id, miembro_id, inicio, fin, motivo")
        .eq("rancho_id", id)
        .lte("inicio", `${consultada}T23:59:59+14:00`)
        .gte("fin", `${consultada}T00:00:00-12:00`)
        .order("inicio", { ascending: true }),
    ]);
    // El horario propio de cada miembro: la grilla por persona lo
    // necesita para rayar las horas en que cada quien NO trabaja ese
    // día, con la misma herencia del motor de disponibilidad (un
    // miembro sin filas trabaja el horario del negocio).
    const listaEquipo = (equipoRes.data ?? []) as Miembro[];
    const porMiembro: Record<string, RecursoDisponibilidad["horario"]> = {};
    if (listaEquipo.length > 0) {
      const horariosRes = await supabase
        .from("horarios_recurso")
        .select("miembro_id, dow, abre, cierra")
        .in("miembro_id", listaEquipo.map((m) => m.id));
      for (const fila of (horariosRes.data ?? []) as {
        miembro_id: string;
        dow: number;
        abre: string;
        cierra: string;
      }[]) {
        const horarioMiembro = (porMiembro[fila.miembro_id] ??= {});
        (horarioMiembro![String(fila.dow)] ??= []).push({
          abre: fila.abre.slice(0, 5),
          cierra: fila.cierra.slice(0, 5),
        });
      }
    }
    if (ultimaFecha.current !== consultada) return;
    const rancho = ranchoRes.data as {
      nombre: string;
      detalles: unknown;
      zona_horaria: string | null;
    } | null;
    setNombreNegocio(rancho?.nombre ?? null);
    setHorario(horarioDeDetalles(rancho?.detalles ?? null));
    setZona(rancho?.zona_horaria || "America/Costa_Rica");
    setFilas((reservasRes.data ?? []) as ReservaAgenda[]);
    setEquipo(listaEquipo);
    setHorariosRecurso(porMiembro);
    setServicios((serviciosRes.data ?? []) as ServicioCita[]);
    setBloqueos((bloqueosRes.data ?? []) as BloqueoAgenda[]);
    setCargandoDia(false);
  }, [id, session, fecha]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  /**
   * Marca la asistencia igual que la acción del panel web: solo desde
   * confirmada (o corrigiendo entre cumplida/no asistió) — el filtro de
   * estados hace que marcar una cancelada devuelva cero filas.
   */
  async function marcarAsistencia(cita: CitaAgenda, asistencia: "cumplida" | "no_asistio") {
    setOcupado(cita.id);
    const ahora = new Date().toISOString();
    const { data, error } = await supabase
      .from("reservas")
      .update(
        asistencia === "cumplida"
          ? { estado: "cumplida", cumplida_en: ahora, no_asistio_en: null }
          : { estado: "no_asistio", no_asistio_en: ahora, cumplida_en: null },
      )
      .eq("id", cita.id)
      .eq("rancho_id", id)
      .in("estado", MARCABLES)
      .select("id")
      .maybeSingle();
    setOcupado(null);

    if (error) {
      Alert.alert("No se pudo", "No se pudo actualizar la cita: " + error.message);
      return;
    }
    if (!data) {
      Alert.alert(
        "No se pudo",
        "Esa cita no se puede marcar (¿está cancelada o todavía pendiente?).",
      );
      return;
    }
    if (asistencia === "cumplida") {
      // Los puntos de lealtad los otorga la web; no se espera la respuesta.
      void avisarCitaCumplida(cita.id);
    }
    await cargar();
    if (asistencia === "no_asistio") {
      await avisarReincidente(cita.id);
    }
  }

  /**
   * ¿Con este no-show el cliente acumula dos (o más) seguidos? Se
   * agrupan las citas recientes del negocio con la MISMA lib del CRM
   * (@/lib/crm, gemela de la web) y se busca la ficha que contiene la
   * cita recién marcada. El aviso es un plus: si algo falla, la
   * marcación ya quedó y no se toca.
   */
  async function avisarReincidente(reservaId: string) {
    try {
      const { data } = await supabase
        .from("reservas")
        .select("id, fecha, hora_inicio, estado, nombre, correo, whatsapp, cliente_id, monto_total")
        .eq("rancho_id", id)
        .not("hora_inicio", "is", null)
        .order("fecha", { ascending: false })
        .limit(500);
      const ficha = agruparClientes(data ?? [], hoyISO).find((c) =>
        c.citaIds.includes(reservaId),
      );
      if (ficha && ficha.fallosSeguidos >= 2) {
        Alert.alert(
          "Cliente reincidente",
          `${ficha.nombre ?? "Este cliente"} faltó a sus últimas ${ficha.fallosSeguidos} citas seguidas. Podés mandarle una promoción desde Clientes.`,
          [
            { text: "Cerrar", style: "cancel" },
            {
              text: "Ir a Clientes",
              onPress: () => router.push(`/negocio/${id}/clientes` as never),
            },
          ],
        );
      }
    } catch {
      // El aviso de reincidencia nunca tumba la marcación.
    }
  }

  function confirmarAsistencia(cita: CitaAgenda, asistencia: "cumplida" | "no_asistio") {
    const quien = cita.nombre ?? "el cliente";
    if (asistencia === "cumplida") {
      Alert.alert("Marcar cumplida", `¿${quien} llegó a su cita? Queda marcada como cumplida.`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, cumplida", onPress: () => marcarAsistencia(cita, "cumplida") },
      ]);
    } else {
      Alert.alert("Marcar ausencia", `¿${quien} no llegó? La cita queda como "No asistió".`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "No asistió",
          style: "destructive",
          onPress: () => marcarAsistencia(cita, "no_asistio"),
        },
      ]);
    }
  }

  /** Cancela una cita pendiente o confirmada; la franja queda libre. */
  function confirmarCancelarCita(cita: CitaAgenda) {
    Alert.alert(
      "Cancelar cita",
      `¿Cancelás la cita de ${cita.nombre ?? "este cliente"}? La franja queda libre al instante.`,
      [
        { text: "No, dejarla", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: () => {
            void cancelarCita(cita);
          },
        },
      ],
    );
  }

  /**
   * Aviso a la web de que una franja quedó libre, para que les escriba
   * a los apuntados en la lista de espera de ese día (0095). El envío
   * necesita secretos del servidor; la app solo avisa. Nunca lanza ni
   * bloquea: la cancelación ya quedó en la base.
   */
  async function avisarFranjaLiberada(fechaLiberada: string) {
    try {
      await fetch(`${SITIO_URL}/api/citas/lista-espera`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ ranchoId: id, fecha: fechaLiberada }),
      });
    } catch {
      // Sin drama: el aviso también sale si se cancela desde la web.
    }
  }

  async function cancelarCita(cita: CitaAgenda) {
    setOcupado(cita.id);
    const { data, error } = await supabase
      .from("reservas")
      .update({ estado: "cancelada", cancelada_en: new Date().toISOString() })
      .eq("id", cita.id)
      .eq("rancho_id", id)
      .in("estado", ["pendiente", "confirmada"])
      .select("id")
      .maybeSingle();
    setOcupado(null);
    if (error) {
      Alert.alert("No se pudo", "No se pudo cancelar la cita: " + error.message);
      return;
    }
    if (!data) {
      Alert.alert("No se pudo", "Esa cita ya no se puede cancelar.");
      return;
    }
    // Solo una cita CONFIRMADA ocupaba franja: su cancelación sí puede
    // servirle a alguien de la lista de espera.
    if (cita.estado === "confirmada") {
      void avisarFranjaLiberada(cita.fecha);
    }
    await cargar();
  }

  /**
   * Reprograma una cita: fecha, hora y/o persona. El solape duro con la
   * misma persona lo frena el trigger de la base — acá se traduce ese
   * error a un mensaje claro. Devuelve true si quedó movida, para que
   * la tarjeta cierre su formulario.
   */
  async function moverCita(
    cita: CitaAgenda,
    destino: { fecha: string; hora: string; miembroId: string | null },
  ): Promise<boolean> {
    if (!FECHA_RE.test(destino.fecha)) {
      Alert.alert("Revisá la fecha", "La fecha va como 2026-08-15 (año-mes-día).");
      return false;
    }
    if (!HORA_RE.test(destino.hora)) {
      Alert.alert("Revisá la hora", "La hora va como 14:30 (de 00:00 a 23:59).");
      return false;
    }
    setOcupado(cita.id);
    const { data, error } = await supabase
      .from("reservas")
      .update({
        fecha: destino.fecha,
        hora_inicio: destino.hora,
        miembro_id: destino.miembroId,
        // La cita movida vuelve a merecer su recordatorio: si ya se
        // avisó para la fecha vieja, el cron tiene que avisar de nuevo
        // para la nueva.
        recordatorio_enviado: false,
        recordatorio_cobro_enviado: false,
      })
      .eq("id", cita.id)
      .eq("rancho_id", id)
      .in("estado", ["pendiente", "confirmada"])
      .select("id")
      .maybeSingle();
    setOcupado(null);
    if (error) {
      if (error.code === "23505" || /ocupad|ya hay/i.test(error.message)) {
        Alert.alert(
          "Franja ocupada",
          "Esa persona ya tiene una cita confirmada que se monta con esa franja — probá otra hora.",
        );
      } else {
        Alert.alert("No se pudo", "No se pudo mover la cita: " + error.message);
      }
      return false;
    }
    // Cero filas afectadas = la cita cambió de estado en otro lado
    // (se marcó, se canceló): reportar éxito acá sería mentir.
    if (!data) {
      Alert.alert("No se pudo", "Esa cita ya no se puede mover.");
      return false;
    }
    // El día viejo de una cita CONFIRMADA quedó con franja libre.
    if (cita.estado === "confirmada" && cita.fecha !== destino.fecha) {
      void avisarFranjaLiberada(cita.fecha);
    }
    await cargar();
    return true;
  }

  function cambiarBorrador(cambio: Partial<typeof CITA_VACIA>) {
    setBorrador((b) => ({ ...b, ...cambio }));
  }

  /** Elegir un servicio del catálogo precarga su duración y su precio. */
  function elegirServicio(servicioId: string) {
    const s = servicios.find((x) => x.id === servicioId);
    setBorrador((b) => ({
      ...b,
      servicioId,
      duracion: s?.duracion_minutos ? String(s.duracion_minutos) : b.duracion,
      monto: s && s.precio !== null ? String(Number(s.precio)) : b.monto,
    }));
  }

  /**
   * Carga el walk-in del mostrador. La política de insert solo deja
   * nacer la reserva como pendiente; el dueño la confirma con su
   * política de update. Si el trigger anti-solape de la base rechaza la
   * confirmación, el borrador se cancela para que no quede una cita
   * fantasma esperando en la agenda.
   */
  async function guardarWalkIn(ignorarChoque: boolean) {
    const hora = borrador.hora.trim();
    if (!HORA_RE.test(hora)) {
      Alert.alert("Revisá la hora", "La hora va como 14:30 (de 00:00 a 23:59).");
      return;
    }
    const durTexto = borrador.duracion.trim();
    const duracion = durTexto === "" ? 30 : Number(durTexto);
    if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
      Alert.alert("Revisá la duración", "La duración va en minutos, entre 5 y 480.");
      return;
    }
    const nombre = borrador.nombre.trim();
    if (!nombre) {
      Alert.alert("Falta el nombre", "El nombre del cliente es obligatorio.");
      return;
    }
    const montoTexto = borrador.monto.trim();
    const monto = montoTexto === "" ? null : Number(montoTexto);
    if (monto !== null && (!Number.isFinite(monto) || monto < 0)) {
      Alert.alert("Revisá el monto", "El monto va en colones, sin puntos ni comas.");
      return;
    }
    const correo = borrador.correo.trim().toLowerCase();
    if (correo && (correo.indexOf("@") < 1 || /[\s,;]/.test(correo))) {
      Alert.alert("Revisá el correo", "El correo no se ve válido.");
      return;
    }

    const servicio = servicios.find((s) => s.id === borrador.servicioId) ?? null;
    const tipoEvento = servicio ? servicio.nombre : borrador.tipoEvento.trim() || "Cita";
    const miembroId = borrador.miembroId || null;

    // Chequeo suave de choque contra las citas ya cargadas del día: sin
    // persona asignada se estorba con todo el mundo (misma regla que la
    // web). No frena — el dueño manda sobre su agenda — pero avisa.
    if (!ignorarChoque) {
      const ini = horaAMinutos(hora);
      const fin = ini + duracion;
      const citasDia = (filas ?? []).filter((f): f is CitaAgenda => f.hora_inicio !== null);
      const choque = citasDia.find((c) => {
        if (!OCUPAN.has(c.estado)) return false;
        const cIni = horaAMinutos(c.hora_inicio.slice(0, 5));
        const cFin = cIni + (c.duracion_minutos ?? 30);
        const mismaPersona =
          miembroId === null || c.miembro_id === null || c.miembro_id === miembroId;
        return mismaPersona && ini < cFin && cIni < fin;
      });
      if (choque) {
        Alert.alert(
          "Se monta con otra cita",
          `Se monta sobre otra cita de ese día (${choque.hora_inicio.slice(0, 5)}${choque.nombre ? `, ${choque.nombre}` : ""}). ¿Agendar igual?`,
          [
            { text: "Cambiar datos", style: "cancel" },
            {
              text: "Agendar igual",
              onPress: () => {
                void guardarWalkIn(true);
              },
            },
          ],
        );
        return;
      }
    }

    setGuardandoCita(true);
    const telefono = borrador.telefono.trim();
    const { data: creada, error: errorInsert } = await supabase
      .from("reservas")
      .insert({
        rancho_id: id,
        fecha,
        hora_inicio: hora,
        duracion_minutos: duracion,
        miembro_id: miembroId,
        nombre,
        contacto: telefono || null,
        whatsapp: telefono || null,
        correo: correo || null,
        tipo_evento: tipoEvento,
        notas: borrador.notas.trim() || null,
        monto_total: monto,
        deposito_monto: 0,
        estado: "pendiente",
        origen: "manual",
      })
      .select("id")
      .single();
    if (errorInsert || !creada) {
      setGuardandoCita(false);
      Alert.alert(
        "No se pudo",
        "No se pudo crear la cita: " + (errorInsert?.message ?? "error"),
      );
      return;
    }
    const reservaId = (creada as { id: string }).id;

    const { error: errorConfirmar } = await supabase
      .from("reservas")
      .update({ estado: "confirmada" })
      .eq("id", reservaId)
      .eq("rancho_id", id);
    if (errorConfirmar) {
      // El trigger anti-solape la rechazó. Borrarla no se puede (la RLS
      // de DELETE es solo del admin): el borrador pendiente se cancela.
      await supabase
        .from("reservas")
        .update({ estado: "cancelada", cancelada_en: new Date().toISOString() })
        .eq("id", reservaId)
        .eq("rancho_id", id);
      setGuardandoCita(false);
      // Solo el solape se traduce a "franja ocupada" — cualquier otro
      // error (RLS, red) se muestra tal cual para no despistar.
      if (errorConfirmar.code === "23505" || /ocupad|ya hay/i.test(errorConfirmar.message)) {
        Alert.alert(
          "Franja ocupada",
          "Esa persona ya tiene una cita confirmada que se monta con esta franja.",
        );
      } else {
        Alert.alert("No se pudo", "No se pudo confirmar la cita: " + errorConfirmar.message);
      }
      return;
    }

    setGuardandoCita(false);
    setCreando(false);
    setBorrador(CITA_VACIA);
    await cargar();
  }

  /**
   * Bloquea una franja del día visible (almuerzo, un mandado, una cita
   * externa). El dueño piensa en hora de pared de su negocio; la tabla
   * guarda instantes — utcDesdeZona hace la traducción.
   */
  async function guardarBloqueo() {
    const desde = borradorBloqueo.diaEntero ? "00:00" : borradorBloqueo.desde.trim();
    const hasta = borradorBloqueo.diaEntero ? "23:59" : borradorBloqueo.hasta.trim();
    if (!HORA_RE.test(desde) || !HORA_RE.test(hasta)) {
      Alert.alert("Revisá las horas", "Las horas van como 12:00 (de 00:00 a 23:59).");
      return;
    }
    if (horaAMinutos(hasta) <= horaAMinutos(desde)) {
      Alert.alert("Revisá las horas", "El final del bloqueo tiene que ser después del inicio.");
      return;
    }
    setGuardandoBloqueo(true);
    const { error } = await supabase.from("bloqueos_agenda").insert({
      rancho_id: id,
      miembro_id: borradorBloqueo.miembroId || null,
      inicio: utcDesdeZona(fecha, desde, zona).toISOString(),
      fin: utcDesdeZona(fecha, hasta, zona).toISOString(),
      motivo: borradorBloqueo.motivo.trim() || null,
    });
    setGuardandoBloqueo(false);
    if (error) {
      Alert.alert("No se pudo", "No se pudo bloquear la franja: " + error.message);
      return;
    }
    setBloqueando(false);
    setBorradorBloqueo(BLOQUEO_VACIO);
    await cargar();
  }

  function confirmarQuitarBloqueo(bloqueo: BloqueoAgenda) {
    Alert.alert("Quitar bloqueo", "¿Quitás este bloqueo? La franja vuelve a estar libre.", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, quitarlo",
        style: "destructive",
        onPress: () => {
          void quitarBloqueo(bloqueo);
        },
      },
    ]);
  }

  async function quitarBloqueo(bloqueo: BloqueoAgenda) {
    const { error } = await supabase
      .from("bloqueos_agenda")
      .delete()
      .eq("id", bloqueo.id)
      .eq("rancho_id", id);
    if (error) {
      Alert.alert("No se pudo", "No se pudo quitar el bloqueo: " + error.message);
      return;
    }
    await cargar();
  }

  /**
   * El feed .ics del negocio para Google/Apple Calendar: se busca (o se
   * crea) el token propio en calendario_tokens y se comparte la URL de
   * suscripción. El token lo genera la base; nunca viaja desde acá.
   */
  async function sincronizarCalendario() {
    if (sincronizando) return;
    setSincronizando(true);
    try {
      const primera = await supabase
        .from("calendario_tokens")
        .select("token")
        .eq("rancho_id", id)
        .maybeSingle();
      if (primera.error) {
        avisarSincronizacion(primera.error.message);
        return;
      }

      let token = (primera.data as { token: string } | null)?.token ?? null;
      if (!token) {
        // El token se autogenera en la base: solo se inserta la fila.
        const creada = await supabase.from("calendario_tokens").insert({ rancho_id: id });
        if (creada.error) {
          avisarSincronizacion(creada.error.message);
          return;
        }
        const segunda = await supabase
          .from("calendario_tokens")
          .select("token")
          .eq("rancho_id", id)
          .maybeSingle();
        token = (segunda.data as { token: string } | null)?.token ?? null;
        if (segunda.error || !token) {
          avisarSincronizacion(segunda.error?.message ?? "sin token");
          return;
        }
      }

      const urlFeed = `${SITIO_URL}/api/calendario/feed/${token}`;
      const mensaje =
        `Suscribí tu calendario a la agenda de ${nombreNegocio ?? "tu negocio"}: ` +
        "en Google Calendar → Otros calendarios → Desde URL; en iPhone → Ajustes → " +
        "Apps → Calendario → Cuentas → Añadir suscripción de calendario.";
      try {
        await Share.share({ message: `${mensaje}\n\n${urlFeed}` });
      } catch {
        Alert.alert("Enlace de tu calendario", `${mensaje}\n\n${urlFeed}`, [
          {
            text: "Copiar enlace",
            onPress: () => {
              void Clipboard.setStringAsync(urlFeed);
            },
          },
          { text: "Cerrar", style: "cancel" },
        ]);
      }
    } finally {
      setSincronizando(false);
    }
  }

  /** La tabla del feed llega con la migración 0071; sin ella, aviso amable. */
  function avisarSincronizacion(detalle: string) {
    if (/calendario_tokens|schema cache|does not exist/i.test(detalle)) {
      Alert.alert(
        "Todavía no está lista",
        "La sincronización se habilita con la próxima actualización de la base — intentá más tarde.",
      );
      return;
    }
    Alert.alert("No se pudo", "No se pudo preparar el enlace del calendario: " + detalle);
  }

  // Mismo resguardo que las pantallas hermanas del panel: sin sesión no
  // hay panel (y las políticas RLS ya limitan los datos al dueño).
  if (!session) {
    router.replace("/cuenta");
    return null;
  }

  const seleccionada = deISO(fecha);
  const esHoyElegido = fecha === hoyISO;
  const tituloFecha = esHoyElegido
    ? `Hoy · ${DIAS_SEMANA_LABEL[seleccionada.getDay()].toLowerCase()}`
    : `${DIAS_SEMANA_LABEL[seleccionada.getDay()]} ${seleccionada.getDate()} de ${MESES_CORTO[seleccionada.getMonth()]}`;

  const citas = (filas ?? []).filter((f): f is CitaAgenda => f.hora_inicio !== null);
  const diaCompleto = (filas ?? []).filter((f) => f.hora_inicio === null);

  const equipoActivo = equipo.filter((m) => m.activo);
  const nombreMiembro = new Map(equipo.map((m) => [m.id, m.nombre]));

  /** El pedazo de un bloqueo que cae dentro del día visible, en minutos. */
  function rangoBloqueoEnDia(b: BloqueoAgenda): { inicio: number; fin: number } | null {
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
    .map((b) => ({ bloqueo: b, rango: rangoBloqueoEnDia(b) }))
    .filter(
      (x): x is { bloqueo: BloqueoAgenda; rango: { inicio: number; fin: number } } =>
        x.rango !== null,
    );

  // El rango de horas sale del horario semanal del negocio; si no está
  // configurado se asume 8:00–18:00, y si alguna cita se sale del rango
  // la línea de tiempo se estira para no esconderla.
  const horarioDia = horario ? (horario[String(seleccionada.getDay())] ?? null) : null;
  const cerrado = horario !== null && !horarioDia;
  let inicioMin = horarioDia ? horaAMinutos(horarioDia.abre) : 8 * 60;
  let finMin = horarioDia ? horaAMinutos(horarioDia.cierra) : 18 * 60;
  for (const c of citas) {
    const ini = horaAMinutos(c.hora_inicio.slice(0, 5));
    inicioMin = Math.min(inicioMin, ini);
    finMin = Math.max(finMin, ini + (c.duracion_minutos ?? 30));
  }
  // Un bloqueo fuera del horario base (un mandado antes de abrir, algo
  // después de cerrar) también tiene que entrar en el rango visible —
  // si no, queda invisible en la grilla por persona aunque sí aparezca
  // en la lista de "Bloqueos del día".
  for (const { rango } of bloqueosDia) {
    inicioMin = Math.min(inicioMin, rango.inicio);
    finMin = Math.max(finMin, rango.fin);
  }

  const horas: number[] = [];
  for (let h = Math.floor(inicioMin / 60); h < Math.ceil(finMin / 60); h++) horas.push(h);

  const porHora = new Map<number, CitaAgenda[]>();
  for (const c of citas) {
    const h = Math.floor(horaAMinutos(c.hora_inicio.slice(0, 5)) / 60);
    porHora.set(h, [...(porHora.get(h) ?? []), c]);
  }

  // ---------- Vista por persona (columnas estilo Fresha) ----------
  const conAgenda = citas.filter((c) => OCUPAN.has(c.estado));
  const haySinAsignar = conAgenda.some((c) => c.miembro_id === null);
  // Una persona pausada con citas ese día igual necesita su columna —
  // sus citas no pueden desaparecer de la vista.
  const conCitasDelDia = new Set(conAgenda.map((c) => c.miembro_id));
  const columnasPersona: { id: string | null; nombre: string; fotoUrl: string | null }[] = [
    ...equipo
      .filter((m) => m.activo || conCitasDelDia.has(m.id))
      .map((m) => ({ id: m.id as string | null, nombre: m.nombre, fotoUrl: m.foto_url })),
    ...(haySinAsignar || equipoActivo.length === 0
      ? [{ id: null, nombre: equipo.length > 0 ? "Sin asignar" : "El negocio", fotoUrl: null }]
      : []),
  ];

  // El horario de CADA colaborador ese día de semana: hereda el del
  // negocio si no tiene horario propio, o manda el suyo — día libre
  // incluido, vía el rango centinela de horarios_recurso. El centinela
  // (RANGO_LIBRE, 00:00–00:01) NO es un turno real: se descarta como
  // rango de trabajo — sin rangos, la columna queda rayada el día
  // entero — para que no jale la grilla hacia medianoche. La columna
  // "Sin asignar"/"El negocio" (id null) usa directo el del negocio.
  const dowDia = diaDeSemana(fecha);
  const LIBRE_MIN = {
    inicio: horaAMinutos(RANGO_LIBRE.abre),
    fin: horaAMinutos(RANGO_LIBRE.cierra),
  };
  const horarioPorColumna = new Map<string | null, Rango[]>(
    columnasPersona.map((col) => {
      const rangos =
        col.id === null
          ? rangosDelDia(null, dowDia, horario)
          : rangosDelDia(
              { id: col.id, horario: horariosRecurso[col.id] ?? null },
              dowDia,
              horario,
            );
      return [
        col.id,
        rangos.filter((r) => !(r.inicio === LIBRE_MIN.inicio && r.fin === LIBRE_MIN.fin)),
      ];
    }),
  );

  // El piso de la grilla es SIEMPRE las 6am (espejo de la web): se
  // quiere ver la agenda abierta desde esa hora aunque nadie entre tan
  // temprano; cada columna igual pinta rayadas sus horas realmente
  // cerradas (abajo, segmentosCerrados). Un dato real de antes de las
  // 6am (una cita movida a mano) igual estira la grilla — nunca se
  // esconde. El cierre = el mayor fin de los rangos de los
  // colaboradores del día, con citas y bloqueos estirando si se salen.
  const PISO_GRILLA = 6 * 60;
  const CIERRE_POR_DEFECTO = 20 * 60; // nadie trabaja este día: grilla razonable igual
  const iniciosColaboradores = [...horarioPorColumna.values()].flatMap((r) =>
    r.map((x) => x.inicio),
  );
  const finesColaboradores = [...horarioPorColumna.values()].flatMap((r) => r.map((x) => x.fin));
  const baseDesdeMin =
    iniciosColaboradores.length > 0 ? Math.min(PISO_GRILLA, ...iniciosColaboradores) : PISO_GRILLA;
  const baseHastaMin =
    finesColaboradores.length > 0 ? Math.max(...finesColaboradores) : CIERRE_POR_DEFECTO;
  const minutosCitasGrilla = conAgenda.flatMap((c) => {
    const ini = horaAMinutos(c.hora_inicio.slice(0, 5));
    return [ini, ini + (c.duracion_minutos ?? 30)];
  });
  const minutosBloqueosGrilla = bloqueosDia.flatMap((x) => [
    Math.max(x.rango.inicio, 0),
    Math.min(x.rango.fin, 1440),
  ]);
  const desdeMin = Math.min(baseDesdeMin, ...minutosCitasGrilla, ...minutosBloqueosGrilla);
  const hastaMin = Math.max(baseHastaMin, ...minutosCitasGrilla, ...minutosBloqueosGrilla);
  const inicioGrilla = Math.floor(desdeMin / 60) * 60;
  const finGrilla = Math.ceil(hastaMin / 60) * 60;
  const altoGrilla = finGrilla - inicioGrilla; // 1 min = 1 punto

  /** Los huecos de una columna FUERA de su horario real ese día, para
   *  rayarlos — sin rangos = cerrado el día entero. Recortado a lo que
   *  se ve en la grilla. */
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

  // La línea de "ahora": solo tiene sentido si el día visible es HOY y
  // cae dentro del rango de la grilla.
  const ahoraZona = instanteEnZona(new Date().toISOString(), zona);
  const lineaAhoraMin =
    ahoraZona.fecha === fecha && ahoraZona.minutos >= inicioGrilla && ahoraZona.minutos <= finGrilla
      ? ahoraZona.minutos
      : null;
  const citaGrid = citaGridId ? (citas.find((c) => c.id === citaGridId) ?? null) : null;

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        kicker="Panel"
        titulo="Tu agenda"
        subtitulo={nombreNegocio ?? undefined}
        accion={{
          icono: "sync-outline",
          etiqueta: "Sincronizar calendario",
          onPress: sincronizarCalendario,
        }}
      />

      {/* La tira de días: una semana atrás, hoy y dos semanas adelante. */}
      <View style={styles.tiraBloque}>
        <ScrollView
          ref={tiraRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tiraContenido}
          onContentSizeChange={() => {
            if (tiraCentrada.current) return;
            tiraCentrada.current = true;
            tiraRef.current?.scrollTo({
              x: Math.max(0, (DIAS_ATRAS - 1) * ANCHO_DIA),
              animated: false,
            });
          }}
        >
          {dias.map((d) => {
            const activo = d.iso === fecha;
            const esHoy = d.iso === hoyISO;
            return (
              <Pressable
                key={d.iso}
                onPress={() => setFecha(d.iso)}
                style={[styles.dia, activo && styles.diaActivo]}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`Ver el ${d.etiqueta} ${d.numero}`}
              >
                <Text style={[styles.diaEtiqueta, activo && styles.diaTextoActivo]}>
                  {d.etiqueta}
                </Text>
                <Text style={[styles.diaNumero, activo && styles.diaTextoActivo]}>
                  {d.numero}
                </Text>
                {esHoy && <View style={[styles.diaPunto, activo && styles.diaPuntoActivo]} />}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.tiraPie}>
          <Micro>
            {tituloFecha}
            {cargandoDia && filas !== null ? "  ·  cargando" : ""}
          </Micro>
          {!esHoyElegido && (
            <Pressable onPress={() => setFecha(hoyISO)} style={styles.botonHoy} hitSlop={6}>
              <Text style={styles.botonHoyTexto}>Ir a hoy</Text>
            </Pressable>
          )}
        </View>
      </View>

      {filas === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.cuerpo}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={refrescar}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        >
          {/* El walk-in del mostrador: la cita del que entró por la
              puerta o escribió por WhatsApp, cargada ahí mismo. */}
          <Boton
            texto={creando ? "Cerrar" : "Nueva cita"}
            tono="reservar"
            icono={creando ? "close" : "add"}
            onPress={() => {
              setCreando(!creando);
              setBloqueando(false);
            }}
          />

          {creando && (
            <Tarjeta style={styles.formulario}>
              <Micro>Nueva cita — {fecha}</Micro>

              <Text style={styles.campoEtiqueta}>Servicio</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {servicios.map((s) => (
                  <ChipCategoria
                    key={s.id}
                    texto={s.nombre}
                    activo={borrador.servicioId === s.id}
                    onPress={() => elegirServicio(s.id)}
                  />
                ))}
                <ChipCategoria
                  texto="Otro"
                  activo={borrador.servicioId === ""}
                  onPress={() => cambiarBorrador({ servicioId: "" })}
                />
              </ScrollView>
              {borrador.servicioId === "" && (
                <TextInput
                  value={borrador.tipoEvento}
                  onChangeText={(v) => cambiarBorrador({ tipoEvento: v })}
                  placeholder="¿Qué se va a hacer? Ej. Corte y barba"
                  placeholderTextColor={Colors.inkMuted}
                  maxLength={120}
                  style={styles.input}
                />
              )}

              <View style={styles.filaCampos}>
                <View style={styles.campo}>
                  <Text style={styles.campoEtiqueta}>Hora</Text>
                  <TextInput
                    value={borrador.hora}
                    onChangeText={(v) => cambiarBorrador({ hora: v })}
                    placeholder="14:30"
                    placeholderTextColor={Colors.inkMuted}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    style={styles.input}
                  />
                </View>
                <View style={styles.campo}>
                  <Text style={styles.campoEtiqueta}>Duración (min)</Text>
                  <TextInput
                    value={borrador.duracion}
                    onChangeText={(v) => cambiarBorrador({ duracion: v })}
                    placeholder="30"
                    placeholderTextColor={Colors.inkMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                    style={styles.input}
                  />
                </View>
              </View>

              {equipoActivo.length > 0 && (
                <>
                  <Text style={styles.campoEtiqueta}>Con</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                  >
                    <ChipCategoria
                      texto="Sin asignar"
                      activo={borrador.miembroId === ""}
                      onPress={() => cambiarBorrador({ miembroId: "" })}
                    />
                    {equipoActivo.map((m) => (
                      <ChipCategoria
                        key={m.id}
                        texto={m.nombre}
                        activo={borrador.miembroId === m.id}
                        onPress={() => cambiarBorrador({ miembroId: m.id })}
                      />
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.campoEtiqueta}>Cliente</Text>
              <TextInput
                value={borrador.nombre}
                onChangeText={(v) => cambiarBorrador({ nombre: v })}
                placeholder="Nombre (obligatorio)"
                placeholderTextColor={Colors.inkMuted}
                maxLength={120}
                style={styles.input}
              />
              <View style={styles.filaCampos}>
                <View style={styles.campo}>
                  <Text style={styles.campoEtiqueta}>Teléfono</Text>
                  <TextInput
                    value={borrador.telefono}
                    onChangeText={(v) => cambiarBorrador({ telefono: v })}
                    placeholder="8888-8888"
                    placeholderTextColor={Colors.inkMuted}
                    keyboardType="phone-pad"
                    maxLength={40}
                    style={styles.input}
                  />
                </View>
                <View style={styles.campo}>
                  <Text style={styles.campoEtiqueta}>Monto en ₡</Text>
                  <TextInput
                    value={borrador.monto}
                    onChangeText={(v) => cambiarBorrador({ monto: v })}
                    placeholder="15000"
                    placeholderTextColor={Colors.inkMuted}
                    keyboardType="number-pad"
                    maxLength={9}
                    style={styles.input}
                  />
                </View>
              </View>
              <Text style={styles.campoEtiqueta}>Correo (para recordatorios)</Text>
              <TextInput
                value={borrador.correo}
                onChangeText={(v) => cambiarBorrador({ correo: v })}
                placeholder="cliente@correo.com"
                placeholderTextColor={Colors.inkMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={120}
                style={styles.input}
              />
              <Text style={styles.campoEtiqueta}>Notas (solo las ves vos)</Text>
              <TextInput
                value={borrador.notas}
                onChangeText={(v) => cambiarBorrador({ notas: v })}
                placeholder="Ej. Llega 10 minutos tarde"
                placeholderTextColor={Colors.inkMuted}
                maxLength={500}
                style={styles.input}
              />

              <Boton
                texto="Agendar"
                tono="reservar"
                icono="checkmark"
                cargando={guardandoCita}
                onPress={() => {
                  void guardarWalkIn(false);
                }}
                style={{ marginTop: Spacing.one }}
              />
            </Tarjeta>
          )}

          {/* Lo último que entró, arriba de todo — el aviso azul del
              diseño de referencia. */}
          {(() => {
            const nueva = citas.find((c) => c.estado === "pendiente");
            return nueva ? (
              <AvisoAgenda texto={`Nueva reserva de ${nueva.nombre ?? "un cliente"}`} />
            ) : null;
          })()}

          {/* Reservas sin hora: eventos de día completo o bloqueos. */}
          {diaCompleto.length > 0 && (
            <View style={styles.seccion}>
              <Micro>Todo el día</Micro>
              {diaCompleto.map((r) => (
                <Tarjeta key={r.id} style={styles.filaDiaCompleto}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.citaNombre} numberOfLines={1}>
                      {r.nombre ?? "Sin nombre"}
                      {r.tipo_evento ? ` — ${r.tipo_evento}` : ""}
                    </Text>
                    <Text style={styles.citaDetalle} numberOfLines={1}>
                      {r.horario_bloque ?? "Todo el día"}
                      {r.monto_total !== null ? ` · ${fmtColones(r.monto_total)}` : ""}
                    </Text>
                  </View>
                  <Estado
                    texto={ESTADO_LABEL[r.estado] ?? r.estado}
                    tono={ESTADO_TONO[r.estado] ?? "gris"}
                  />
                </Tarjeta>
              ))}
            </View>
          )}

          {/* Los bloqueos de agenda del día (almuerzo, un mandado...):
              nadie puede reservar en una franja bloqueada. */}
          <View style={styles.seccion}>
            <Micro>Bloqueos del día</Micro>
            {bloqueosDia.map(({ bloqueo, rango }) => (
              <Tarjeta key={bloqueo.id} style={styles.filaBloqueo}>
                <Text style={styles.bloqueoTexto} numberOfLines={2}>
                  ⛔{" "}
                  {bloqueo.miembro_id
                    ? (nombreMiembro.get(bloqueo.miembro_id) ?? "—")
                    : "Negocio"}
                  {" · "}
                  {rango.inicio === 0 && rango.fin === 1440
                    ? "todo el día"
                    : `${minutosAHora(rango.inicio)}–${minutosAHora(rango.fin)}`}
                  {bloqueo.motivo ? ` · ${bloqueo.motivo}` : ""}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar bloqueo"
                  hitSlop={8}
                  onPress={() => confirmarQuitarBloqueo(bloqueo)}
                  style={styles.botonQuitarBloqueo}
                >
                  <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                </Pressable>
              </Tarjeta>
            ))}

            {!bloqueando ? (
              <Boton
                texto="Bloquear franja"
                tono="contorno"
                icono="remove-circle-outline"
                compacto
                onPress={() => {
                  setBloqueando(true);
                  setCreando(false);
                }}
              />
            ) : (
              <Tarjeta style={styles.formulario}>
                <Micro>Bloquear franja — {fecha}</Micro>
                <Text style={styles.formularioAyuda}>
                  Nadie puede reservar en una franja bloqueada (almuerzo, un mandado, una
                  cita externa).
                </Text>

                {equipoActivo.length > 0 && (
                  <>
                    <Text style={styles.campoEtiqueta}>Aplica a</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chips}
                    >
                      <ChipCategoria
                        texto="Todo el negocio"
                        activo={borradorBloqueo.miembroId === ""}
                        onPress={() => setBorradorBloqueo({ ...borradorBloqueo, miembroId: "" })}
                      />
                      {equipoActivo.map((m) => (
                        <ChipCategoria
                          key={m.id}
                          texto={`Solo ${m.nombre}`}
                          activo={borradorBloqueo.miembroId === m.id}
                          onPress={() =>
                            setBorradorBloqueo({ ...borradorBloqueo, miembroId: m.id })
                          }
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                <View style={styles.filaSwitch}>
                  <Text style={styles.filaSwitchTexto}>Todo el día</Text>
                  <Switch
                    value={borradorBloqueo.diaEntero}
                    trackColor={{ true: Colors.navy }}
                    onValueChange={(v) =>
                      setBorradorBloqueo({ ...borradorBloqueo, diaEntero: v })
                    }
                  />
                </View>

                {!borradorBloqueo.diaEntero && (
                  <View style={styles.filaCampos}>
                    <View style={styles.campo}>
                      <Text style={styles.campoEtiqueta}>Desde</Text>
                      <TextInput
                        value={borradorBloqueo.desde}
                        onChangeText={(v) =>
                          setBorradorBloqueo({ ...borradorBloqueo, desde: v })
                        }
                        placeholder="12:00"
                        placeholderTextColor={Colors.inkMuted}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.campo}>
                      <Text style={styles.campoEtiqueta}>Hasta</Text>
                      <TextInput
                        value={borradorBloqueo.hasta}
                        onChangeText={(v) =>
                          setBorradorBloqueo({ ...borradorBloqueo, hasta: v })
                        }
                        placeholder="13:00"
                        placeholderTextColor={Colors.inkMuted}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        style={styles.input}
                      />
                    </View>
                  </View>
                )}

                <Text style={styles.campoEtiqueta}>Motivo (solo lo ves vos)</Text>
                <TextInput
                  value={borradorBloqueo.motivo}
                  onChangeText={(v) => setBorradorBloqueo({ ...borradorBloqueo, motivo: v })}
                  placeholder="Ej. Almuerzo"
                  placeholderTextColor={Colors.inkMuted}
                  maxLength={200}
                  style={styles.input}
                />

                <View style={styles.filaBotones}>
                  <Boton
                    texto="Bloquear"
                    tono="navy"
                    icono="remove-circle-outline"
                    compacto
                    cargando={guardandoBloqueo}
                    onPress={() => {
                      void guardarBloqueo();
                    }}
                  />
                  <Boton
                    texto="Cerrar"
                    tono="contorno"
                    compacto
                    onPress={() => setBloqueando(false)}
                  />
                </View>
              </Tarjeta>
            )}
          </View>

          {/* La grilla se muestra SIEMPRE — aunque el día esté cerrado
              o no tenga citas (espejo de la web): las horas en que
              nadie trabaja quedan rayadas en cada columna. */}
          <View style={styles.seccion}>
              <View style={styles.seccionCabecera}>
                <Micro>{vista === "personas" ? "Agenda por persona" : "La línea del día"}</Micro>
                <Pressable
                  onPress={() => setVista(vista === "personas" ? "lista" : "personas")}
                  style={styles.botonVista}
                  hitSlop={6}
                >
                  <Text style={styles.botonVistaTexto}>
                    {vista === "personas" ? "Ver como lista" : "Ver por persona"}
                  </Text>
                </Pressable>
              </View>
              {cerrado && (
                <Aviso
                  tono="atencion"
                  texto={
                    citas.length > 0
                      ? "Según tu horario este día está cerrado, pero tenés citas agendadas."
                      : "Según tu horario este día está cerrado — por eso se ve rayado."
                  }
                />
              )}
              {citas.length === 0 && (
                <Aviso
                  icono="calendar-clear-outline"
                  texto={
                    esHoyElegido
                      ? "Hoy no tenés citas agendadas — la agenda está libre."
                      : "Ese día no hay citas agendadas."
                  }
                />
              )}

              {vista === "lista" ? (
                <Tarjeta style={styles.lineaTiempo}>
                  {horas.map((h) => {
                    const deEstaHora = porHora.get(h) ?? [];
                    return (
                      <FilaHora key={h} hora={`${String(h).padStart(2, "0")}:00`}>
                        {deEstaHora.length > 0
                          ? deEstaHora.map((c) => (
                              <TarjetaCita
                                key={c.id}
                                cita={c}
                                ocupada={ocupado === c.id}
                                conNombre={
                                  c.miembro_id
                                    ? (nombreMiembro.get(c.miembro_id) ??
                                      "alguien que ya no está en el equipo")
                                    : null
                                }
                                equipo={equipoActivo}
                                onMarcar={confirmarAsistencia}
                                onCancelar={confirmarCancelarCita}
                                onMover={moverCita}
                              />
                            ))
                          : undefined}
                      </FilaHora>
                    );
                  })}
                </Tarjeta>
              ) : (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.grillaFila}>
                        {/* Eje de horas. Su offset compensa el alto FIJO
                            del encabezado de cada columna (foto +
                            nombre) — si no, las horas quedan pintadas
                            más arriba de la franja a la que en
                            realidad corresponden. */}
                        <View
                          style={[
                            styles.grillaEje,
                            { height: altoGrilla + ALTO_ENCABEZADO_COLUMNA },
                          ]}
                        >
                          {Array.from(
                            { length: (finGrilla - inicioGrilla) / 60 + 1 },
                            (_, i) => inicioGrilla + i * 60,
                          ).map((min) => (
                            <Text
                              key={min}
                              style={[
                                styles.grillaEjeHora,
                                { top: min - inicioGrilla + ALTO_ENCABEZADO_COLUMNA - 7 },
                              ]}
                            >
                              {String(Math.floor(min / 60)).padStart(2, "0")}:00
                            </Text>
                          ))}
                          {lineaAhoraMin !== null && (
                            <View
                              style={[
                                styles.grillaAhoraChip,
                                { top: lineaAhoraMin - inicioGrilla + ALTO_ENCABEZADO_COLUMNA - 8 },
                              ]}
                            >
                              <Text style={styles.grillaAhoraChipTexto}>
                                {minutosAHora(lineaAhoraMin)}
                              </Text>
                            </View>
                          )}
                        </View>
                        {columnasPersona.map((col) => {
                          const citasCol = conAgenda.filter((c) => c.miembro_id === col.id);
                          const bloqueosCol = bloqueosDia.filter(
                            (x) => x.bloqueo.miembro_id === col.id || x.bloqueo.miembro_id === null,
                          );
                          const cerradosCol = segmentosCerrados(
                            horarioPorColumna.get(col.id) ?? [],
                          );
                          return (
                            <View key={col.id ?? "sin"} style={styles.grillaColumna}>
                              <View
                                style={[
                                  styles.grillaColumnaCabecera,
                                  { height: ALTO_ENCABEZADO_COLUMNA },
                                ]}
                              >
                                {col.fotoUrl ? (
                                  <Image
                                    source={{ uri: col.fotoUrl }}
                                    alt={col.nombre}
                                    style={styles.grillaAvatarFoto}
                                    contentFit="cover"
                                  />
                                ) : (
                                  <View style={styles.grillaAvatar}>
                                    <Text style={styles.grillaAvatarInicial}>
                                      {col.nombre.slice(0, 1).toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                                <Text style={styles.grillaColumnaNombre} numberOfLines={1}>
                                  {col.nombre}
                                </Text>
                              </View>
                              <View style={[styles.grillaCuerpo, { height: altoGrilla }]}>
                                {/* Fuera del horario real de esta
                                    persona ese día (antes de entrar,
                                    después de salir, día libre):
                                    atenuado, para que la grilla se vea
                                    SIEMPRE desde las 6am pero quede
                                    claro cuándo no se atiende. */}
                                {cerradosCol.map((seg, i) => (
                                  <View
                                    key={`cerrado-${i}`}
                                    pointerEvents="none"
                                    style={[
                                      styles.grillaCerrado,
                                      {
                                        top: seg.inicio - inicioGrilla,
                                        height: seg.fin - seg.inicio,
                                      },
                                    ]}
                                  />
                                ))}
                                {Array.from(
                                  { length: (finGrilla - inicioGrilla) / 30 },
                                  (_, i) => inicioGrilla + i * 30,
                                ).map((min) => (
                                  <View
                                    key={min}
                                    style={[
                                      styles.grillaLinea,
                                      min % 60 === 0 && styles.grillaLineaHora,
                                      { top: min - inicioGrilla },
                                    ]}
                                  />
                                ))}
                                {bloqueosCol.map(({ bloqueo, rango }) => (
                                  <View
                                    key={bloqueo.id}
                                    style={[
                                      styles.grillaBloqueo,
                                      {
                                        top: Math.max(rango.inicio, inicioGrilla) - inicioGrilla,
                                        height:
                                          Math.min(rango.fin, finGrilla) -
                                          Math.max(rango.inicio, inicioGrilla),
                                      },
                                    ]}
                                  />
                                ))}
                                {citasCol.map((cita) => {
                                  const ini = horaAMinutos(cita.hora_inicio.slice(0, 5));
                                  const dur = cita.duracion_minutos ?? 30;
                                  // El piso de 26pt (para que el texto
                                  // entre) no puede empujar el bloque
                                  // más allá del fondo de la grilla — si
                                  // no, una cita cortita casi al cierre
                                  // se recorta contra el overflow.
                                  const inicioBloque = ini - inicioGrilla;
                                  const altoBloque = Math.min(
                                    Math.max(dur, 26),
                                    Math.max(altoGrilla - inicioBloque, 6),
                                  );
                                  return (
                                    <Pressable
                                      key={cita.id}
                                      onPress={() =>
                                        setCitaGridId(citaGridId === cita.id ? null : cita.id)
                                      }
                                      style={[
                                        styles.grillaBloque,
                                        estiloBloque(cita.estado),
                                        citaGridId === cita.id && styles.grillaBloqueSeleccionado,
                                        { top: inicioBloque, height: altoBloque },
                                      ]}
                                    >
                                      <Text style={styles.grillaBloqueTexto} numberOfLines={1}>
                                        {cita.hora_inicio.slice(0, 5)} {cita.nombre ?? ""}
                                      </Text>
                                      {dur >= 40 && (
                                        <Text style={styles.grillaBloqueSub} numberOfLines={1}>
                                          {cita.tipo_evento ?? ""}
                                        </Text>
                                      )}
                                    </Pressable>
                                  );
                                })}
                                {lineaAhoraMin !== null && (
                                  <View
                                    style={[
                                      styles.grillaAhoraLinea,
                                      { top: lineaAhoraMin - inicioGrilla },
                                    ]}
                                  />
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>

                    {citaGrid ? (
                      <TarjetaCita
                        cita={citaGrid}
                        ocupada={ocupado === citaGrid.id}
                        conNombre={
                          citaGrid.miembro_id
                            ? (nombreMiembro.get(citaGrid.miembro_id) ??
                              "alguien que ya no está en el equipo")
                            : null
                        }
                        equipo={equipoActivo}
                        onMarcar={confirmarAsistencia}
                        onCancelar={confirmarCancelarCita}
                        onMover={moverCita}
                      />
                    ) : conAgenda.length > 0 ? (
                      <Micro>Tocá una cita para ver el detalle y marcar asistencia.</Micro>
                    ) : null}
                  </>
              )}
          </View>

          {/* Suscribir la agenda en el calendario personal del dueño. */}
          <Tarjeta style={styles.tarjetaSync}>
            <Micro>Calendario</Micro>
            <Text style={styles.syncTitulo}>Que tus citas lleguen solas</Text>
            <Text style={styles.syncTexto}>
              Suscribite desde Google Calendar o el calendario del iPhone y tus citas
              aparecen ahí, siempre al día.
            </Text>
            <Boton
              texto={sincronizando ? "Preparando…" : "Sincronizar calendario"}
              tono="navy"
              icono="calendar-outline"
              cargando={sincronizando}
              onPress={sincronizarCalendario}
              style={{ marginTop: Spacing.three }}
            />
          </Tarjeta>
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Una cita en la línea de tiempo. Sigue la tarjeta del mockup: la hora
 * arriba a la izquierda, el estado a la derecha, y las dos acciones del
 * mostrador (llegó / no llegó) solo cuando corresponde. Las citas que
 * todavía no pasaron (pendiente/confirmada) suman dos acciones más
 * chicas — mover y cancelar — con el formulario de mover inline.
 */
function TarjetaCita({
  cita,
  ocupada,
  conNombre,
  equipo,
  onMarcar,
  onCancelar,
  onMover,
}: {
  cita: CitaAgenda;
  ocupada: boolean;
  /** El nombre de la persona asignada, ya resuelto (null = sin asignar). */
  conNombre: string | null;
  /** El equipo activo, para reasignar la cita al moverla. */
  equipo: Miembro[];
  onMarcar: (cita: CitaAgenda, asistencia: "cumplida" | "no_asistio") => void;
  onCancelar: (cita: CitaAgenda) => void;
  onMover: (
    cita: CitaAgenda,
    destino: { fecha: string; hora: string; miembroId: string | null },
  ) => Promise<boolean>;
}) {
  const inicio = cita.hora_inicio.slice(0, 5);
  const fin = sumarMinutosHora(inicio, cita.duracion_minutos ?? 30);
  const marcable = MARCABLES.includes(cita.estado);
  // Pendiente o confirmada: todavía se puede mover o cancelar.
  const gestionable = cita.estado === "pendiente" || cita.estado === "confirmada";
  const monto = cita.monto_total !== null ? fmtColones(cita.monto_total) : null;
  // La cita confirmada es la que manda: sale en blanco con la barra
  // navy. Las demás quedan en gris, un escalón atrás.
  const destacada = cita.estado === "confirmada";

  const [moviendo, setMoviendo] = useState(false);
  const [destino, setDestino] = useState({
    fecha: cita.fecha,
    hora: inicio,
    miembroId: cita.miembro_id ?? "",
  });

  function abrirMover() {
    // Siempre se abre precargado con lo que la cita tiene HOY.
    setDestino({
      fecha: cita.fecha,
      hora: cita.hora_inicio.slice(0, 5),
      miembroId: cita.miembro_id ?? "",
    });
    setMoviendo(true);
  }

  return (
    <View style={[styles.tarjetaCita, destacada && styles.tarjetaCitaDestacada]}>
      {destacada && <View style={styles.citaBarra} />}
      <View style={styles.citaCabecera}>
        <Text style={styles.citaHora}>
          {inicio}–{fin}
        </Text>
        <Estado
          texto={ESTADO_LABEL[cita.estado] ?? cita.estado}
          tono={ESTADO_TONO[cita.estado] ?? "gris"}
        />
      </View>
      <Text style={styles.citaNombre} numberOfLines={1}>
        {cita.nombre ?? "Cliente"}
      </Text>
      <Text style={styles.citaDetalle} numberOfLines={1}>
        {cita.tipo_evento ?? "Servicio"}
        {conNombre ? ` · con ${conNombre}` : ""}
        {monto ? ` · ${monto}` : ""}
      </Text>
      {cita.notas ? (
        <Text style={styles.citaNotas} numberOfLines={2}>
          “{cita.notas}”
        </Text>
      ) : null}

      {marcable && (
        <View style={styles.citaAcciones}>
          <Pressable
            style={[
              styles.botonAsistencia,
              styles.botonCumplida,
              (ocupada || cita.estado === "cumplida") && styles.botonApagado,
            ]}
            disabled={ocupada || cita.estado === "cumplida"}
            onPress={() => onMarcar(cita, "cumplida")}
          >
            <Ionicons name="checkmark" size={14} color={Colors.green} />
            <Text style={[styles.botonAsistenciaTexto, { color: Colors.green }]}>Llegó</Text>
          </Pressable>
          <Pressable
            style={[
              styles.botonAsistencia,
              styles.botonNoAsistio,
              (ocupada || cita.estado === "no_asistio") && styles.botonApagado,
            ]}
            disabled={ocupada || cita.estado === "no_asistio"}
            onPress={() => onMarcar(cita, "no_asistio")}
          >
            <Ionicons name="close" size={14} color={Colors.danger} />
            <Text style={[styles.botonAsistenciaTexto, { color: Colors.danger }]}>
              No llegó
            </Text>
          </Pressable>
        </View>
      )}

      {gestionable && (
        <View style={styles.citaAccionesChicas}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              moviendo ? "Cerrar el formulario de mover" : "Mover la cita a otra fecha u hora"
            }
            disabled={ocupada}
            onPress={() => (moviendo ? setMoviendo(false) : abrirMover())}
            style={[styles.botonChico, ocupada && styles.botonApagado]}
          >
            <Ionicons name="calendar-outline" size={13} color={Colors.navy} />
            <Text style={styles.botonChicoTexto}>Mover</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar la cita"
            disabled={ocupada}
            onPress={() => onCancelar(cita)}
            style={[styles.botonChico, ocupada && styles.botonApagado]}
          >
            <Ionicons name="close-circle-outline" size={13} color={Colors.danger} />
            <Text style={[styles.botonChicoTexto, { color: Colors.danger }]}>Cancelar</Text>
          </Pressable>
        </View>
      )}

      {gestionable && moviendo && (
        <View style={styles.moverFormulario}>
          <View style={styles.filaCampos}>
            <View style={styles.campo}>
              <Text style={styles.campoEtiqueta}>Nueva fecha</Text>
              <TextInput
                value={destino.fecha}
                onChangeText={(v) => setDestino((d) => ({ ...d, fecha: v }))}
                placeholder="2026-08-15"
                placeholderTextColor={Colors.inkMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={styles.input}
              />
            </View>
            <View style={styles.campo}>
              <Text style={styles.campoEtiqueta}>Hora</Text>
              <TextInput
                value={destino.hora}
                onChangeText={(v) => setDestino((d) => ({ ...d, hora: v }))}
                placeholder="14:30"
                placeholderTextColor={Colors.inkMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={styles.input}
              />
            </View>
          </View>
          {equipo.length > 0 && (
            <>
              <Text style={styles.campoEtiqueta}>Con</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                <ChipCategoria
                  texto="Sin asignar"
                  activo={destino.miembroId === ""}
                  onPress={() => setDestino((d) => ({ ...d, miembroId: "" }))}
                />
                {equipo.map((m) => (
                  <ChipCategoria
                    key={m.id}
                    texto={m.nombre}
                    activo={destino.miembroId === m.id}
                    onPress={() => setDestino((d) => ({ ...d, miembroId: m.id }))}
                  />
                ))}
              </ScrollView>
            </>
          )}
          <Boton
            texto="Mover la cita"
            tono="navy"
            icono="arrow-forward"
            compacto
            cargando={ocupada}
            onPress={() => {
              void (async () => {
                const ok = await onMover(cita, {
                  fecha: destino.fecha,
                  hora: destino.hora,
                  miembroId: destino.miembroId || null,
                });
                if (ok) setMoviendo(false);
              })();
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  cuerpo: { gap: Spacing.four, padding: Spacing.three, paddingBottom: 48 },

  tiraBloque: {
    backgroundColor: Colors.canvas,
    borderBottomColor: Colors.line,
    borderBottomWidth: 1,
    paddingBottom: Spacing.two + 2,
  },
  tiraContenido: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  dia: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    gap: 1,
    paddingVertical: 9,
    width: 52,
  },
  diaActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  diaEtiqueta: {
    color: Colors.inkMuted,
    fontFamily: Fonts.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  diaNumero: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 16 },
  diaTextoActivo: { color: "#ffffff" },
  diaPunto: {
    backgroundColor: Colors.sky,
    borderRadius: 2,
    height: 4,
    marginTop: 1,
    width: 4,
  },
  diaPuntoActivo: { backgroundColor: "#ffffff" },
  tiraPie: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two + 2,
  },
  botonHoy: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  botonHoyTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12 },

  seccion: { gap: Spacing.two + 2 },
  seccionCabecera: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  botonVista: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  botonVistaTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 11.5 },

  // La grilla por persona (columnas estilo Fresha) — espejo de la web.
  grillaFila: { flexDirection: "row", gap: Spacing.two, paddingBottom: Spacing.two },
  grillaEje: { width: 38 },
  grillaEjeHora: {
    color: Colors.inkMuted,
    fontFamily: Fonts.bold,
    fontSize: 10,
    position: "absolute",
    right: 2,
  },
  grillaAhoraChip: {
    backgroundColor: Colors.sky,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: "absolute",
    right: 2,
  },
  grillaAhoraChipTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 9.5 },
  grillaColumna: { width: 132 },
  grillaColumnaCabecera: { alignItems: "center", gap: 3, justifyContent: "center" },
  grillaAvatar: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.full,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  grillaAvatarFoto: { borderRadius: Radios.full, height: 28, width: 28 },
  grillaAvatarInicial: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 11.5 },
  grillaColumnaNombre: {
    color: Colors.navy,
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    textAlign: "center",
  },
  grillaCuerpo: {
    backgroundColor: Colors.cream2,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  /** Las horas en que esa persona NO trabaja ese día: un velo navy muy
   *  tenue sobre el cuerpo de la columna (el equivalente RN del rayado
   *  de la web, sin gradientes). */
  grillaCerrado: {
    backgroundColor: "rgba(22,41,94,0.05)",
    left: 0,
    position: "absolute",
    right: 0,
  },
  grillaLinea: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    left: 0,
    position: "absolute",
    right: 0,
  },
  grillaLineaHora: { borderTopColor: Colors.lineFuerte },
  grillaBloqueo: {
    backgroundColor: "rgba(139,143,156,0.22)",
    borderRadius: Radios.sm,
    left: 3,
    position: "absolute",
    right: 3,
  },
  grillaBloque: {
    borderRadius: Radios.sm,
    borderWidth: 1,
    left: 3,
    overflow: "hidden",
    paddingHorizontal: 5,
    paddingVertical: 3,
    position: "absolute",
    right: 3,
  },
  grillaBloqueSeleccionado: { borderWidth: 2 },
  grillaBloqueTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 10.5 },
  grillaBloqueSub: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 9.5,
    marginTop: 1,
  },
  grillaAhoraLinea: {
    backgroundColor: Colors.sky,
    height: 2,
    left: 0,
    position: "absolute",
    right: 0,
  },

  filaDiaCompleto: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },

  lineaTiempo: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },

  // Los formularios inline del mostrador (walk-in y bloqueo de franja).
  formulario: { gap: Spacing.two + 2, padding: Spacing.three },
  formularioAyuda: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  campoEtiqueta: {
    color: Colors.inkSoft,
    fontFamily: Fonts.semiBold,
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  filaCampos: { flexDirection: "row", gap: Spacing.two },
  campo: { flex: 1, gap: 4 },
  input: {
    backgroundColor: Colors.cream,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  chips: { gap: Spacing.two, paddingVertical: 2 },
  filaSwitch: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  filaSwitchTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  filaBotones: { flexDirection: "row", gap: Spacing.two },

  // Las filas de bloqueos del día.
  filaBloqueo: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  bloqueoTexto: { color: Colors.inkSoft, flex: 1, fontFamily: Fonts.medium, fontSize: 12.5 },
  botonQuitarBloqueo: {
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    height: 30,
    justifyContent: "center",
    width: 30,
  },

  // En reposo: gris plano, sin borde — como las citas de fondo del
  // diseño de referencia.
  tarjetaCita: {
    backgroundColor: "#f4f5f7",
    borderRadius: Radios.sm,
    gap: 3,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  tarjetaCitaDestacada: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderWidth: 1,
    paddingLeft: 12 + 4,
  },
  citaBarra: {
    backgroundColor: Colors.navy,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 4,
  },
  citaCabecera: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "space-between",
  },
  citaHora: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 13 },
  citaNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  citaDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5 },
  citaNotas: { color: Colors.ink, fontFamily: Fonts.regular, fontSize: 12, marginTop: 2 },
  citaAcciones: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.two },
  botonAsistencia: {
    alignItems: "center",
    borderRadius: Radios.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    paddingVertical: 9,
  },
  botonCumplida: { backgroundColor: Colors.greenLight, borderColor: Colors.green },
  botonNoAsistio: { backgroundColor: Colors.dangerLight, borderColor: Colors.danger },
  botonApagado: { opacity: 0.45 },
  botonAsistenciaTexto: { fontFamily: Fonts.bold, fontSize: 12.5 },

  // Mover y cancelar: acciones más chicas que las de asistencia.
  citaAccionesChicas: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.two },
  botonChico: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  botonChicoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 11.5 },
  moverFormulario: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    gap: Spacing.two,
    marginTop: Spacing.two,
    padding: Spacing.two + 2,
  },

  tarjetaSync: { padding: Spacing.three },
  syncTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    letterSpacing: -0.3,
    marginTop: 6,
  },
  syncTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
});
