import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/finanzas";
import {
  DIAS_CORTO,
  MESES_CORTO,
  esDiaLibre,
  horaBonita,
  horarioDeDetalles,
  minutosAHora,
  utcDesdeZona,
  type HorarioSemana,
} from "@/lib/citas";
import { instanteEnZona } from "@/lib/disponibilidad";
import { esCitas as esVerticalCitas } from "@/lib/agenda-negocio";

/**
 * La vertical de Citas desde el teléfono — la pantalla que en la web
 * vive en /mi-negocio/[id]/citas: quién atiende (con su horario propio
 * y sus servicios), a qué horas abre el negocio, las giftcards
 * vendidas y los bloqueos de agenda (vacaciones, ausencias).
 *
 * Las cuatro cosas son las que hacen que la agenda funcione: sin
 * equipo no hay con quién agendar, sin horario no hay cuándo, las
 * giftcards hay que poder canjearlas en el mostrador — que es
 * justamente donde uno tiene el teléfono — y las vacaciones se marcan
 * apenas uno se entera, no cuando vuelve a la computadora.
 */

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Un recurso físico (0061) también se agenda: la camilla del spa o el
// sillón de tatuar son "alguien" con quien reservar.
const TIPOS_MIEMBRO = [
  { id: "profesional", label: "Persona" },
  { id: "espacio", label: "Espacio (cabina, camilla...)" },
  { id: "equipo", label: "Equipo (máquina...)" },
] as const;

type TipoMiembro = (typeof TIPOS_MIEMBRO)[number]["id"];

type Miembro = {
  id: string;
  nombre: string;
  rol: string | null;
  activo: boolean;
  orden: number;
  tipo: TipoMiembro | null;
};

type Giftcard = {
  id: string;
  codigo: string;
  monto: number;
  saldo: number;
  comprador_nombre: string | null;
  beneficiario_nombre: string | null;
  estado: "activa" | "canjeada" | "vencida";
};

type ServicioCita = { id: string; nombre: string };

/** Fila de servicios_recurso: este servicio lo da este miembro. */
type Asignacion = { item_id: string; miembro_id: string };

/** Fila de horarios_recurso: un turno de un miembro en un día. */
type RangoRecurso = { miembro_id: string; dow: number; abre: string; cierra: string };

type Bloqueo = {
  id: string;
  miembro_id: string | null;
  inicio: string;
  fin: string;
  motivo: string | null;
};

/** Un día del horario propio como se edita en el teléfono. */
type DiaConf = { trabaja: boolean; abre: string; cierra: string };

type RespuestaEquipo = { ok: boolean; error?: string | null; advertencia?: string | null };

type Seccion = "equipo" | "horario" | "giftcards" | "bloqueos";

/**
 * Filas de horarios_recurso de un miembro → los 7 días editables. El
 * teléfono edita UN turno por día (el turno partido queda para la
 * web): si un día tiene dos turnos se muestra el primero, y guardar
 * desde acá lo deja como único.
 */
function diasDesdeFilas(filas: RangoRecurso[]): DiaConf[] {
  return Array.from({ length: 7 }, (_, dow) => {
    const delDia = filas
      .filter((f) => f.dow === dow)
      .sort((a, b) => a.abre.localeCompare(b.abre))
      .map((f) => ({ abre: f.abre.slice(0, 5), cierra: f.cierra.slice(0, 5) }));
    // El rango centinela (00:00–00:01) significa "ese día no trabaja".
    if (delDia.length > 0 && !esDiaLibre(delDia)) {
      return { trabaja: true, abre: delDia[0].abre, cierra: delDia[0].cierra };
    }
    return { trabaja: false, abre: "09:00", cierra: "17:00" };
  });
}

/** ¿"2026-08-15" es una fecha real? (rechaza 2026-02-31). */
function fechaValida(fecha: string): boolean {
  if (!FECHA_REGEX.test(fecha)) return false;
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** "2026-08-15" → "sáb 15 ago". */
function fmtFechaCorta(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${DIAS_CORTO[dow]} ${d} ${MESES_CORTO[m - 1]}`;
}

/** El rango de un bloqueo, legible y en la zona del negocio. */
function etiquetaBloqueo(b: Bloqueo, zona: string): string {
  const ini = instanteEnZona(b.inicio, zona);
  const fin = instanteEnZona(b.fin, zona);
  const diaEntero = ini.minutos === 0 && fin.minutos >= 23 * 60 + 59;
  if (ini.fecha === fin.fecha) {
    return diaEntero
      ? `${fmtFechaCorta(ini.fecha)} (todo el día)`
      : `${fmtFechaCorta(ini.fecha)} · ${horaBonita(minutosAHora(ini.minutos))} – ${horaBonita(minutosAHora(Math.min(fin.minutos, 1439)))}`;
  }
  return `${fmtFechaCorta(ini.fecha)} → ${fmtFechaCorta(fin.fecha)}`;
}

export default function CitasNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [nombre, setNombre] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [seccion, setSeccion] = useState<Seccion>("equipo");
  /**
   * ¿Es de la vertical de Citas? Esta pantalla la comparten ahora los
   * proveedores de eventos (equipo, horario y bloqueos les sirven
   * igual), pero las giftcards no: son un producto de barbería y spa.
   */
  const [verticalCitas, setVerticalCitas] = useState(true);

  const [equipo, setEquipo] = useState<Miembro[]>([]);
  const [horario, setHorario] = useState<HorarioSemana>({});
  const [giftcards, setGiftcards] = useState<Giftcard[]>([]);
  const [detalles, setDetalles] = useState<Record<string, unknown>>({});
  const [zona, setZona] = useState("America/Costa_Rica");

  const [servicios, setServicios] = useState<ServicioCita[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [horariosRecurso, setHorariosRecurso] = useState<Record<string, RangoRecurso[]>>({});
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRol, setNuevoRol] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<TipoMiembro>("profesional");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [guardandoHorario, setGuardandoHorario] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La configuración fina del miembro expandido (uno a la vez).
  const [configurando, setConfigurando] = useState<string | null>(null);
  const [confPropio, setConfPropio] = useState(false);
  const [confDias, setConfDias] = useState<DiaConf[]>(() => diasDesdeFilas([]));
  const [confMarcados, setConfMarcados] = useState<Set<string>>(new Set());
  const [guardandoConf, setGuardandoConf] = useState<"horario" | "servicios" | null>(null);
  const [confError, setConfError] = useState<string | null>(null);
  const [confMensaje, setConfMensaje] = useState<string | null>(null);

  // El formulario de bloqueos (vacaciones, ausencias).
  const [bloqMiembro, setBloqMiembro] = useState<string | null>(null);
  const [bloqDesde, setBloqDesde] = useState("");
  const [bloqHasta, setBloqHasta] = useState("");
  const [bloqDiasEnteros, setBloqDiasEnteros] = useState(true);
  const [bloqHoraDe, setBloqHoraDe] = useState("");
  const [bloqHoraA, setBloqHoraA] = useState("");
  const [bloqMotivo, setBloqMotivo] = useState("");
  const [bloqError, setBloqError] = useState<string | null>(null);
  const [creandoBloqueo, setCreandoBloqueo] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [ranchoRes, equipoRes, giftRes, itemsRes, bloqueosRes] = await Promise.all([
      supabase
        .from("ranchos")
        .select("nombre, detalles, zona_horaria, vertical, categoria")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("equipo_rancho")
        .select("id, nombre, rol, activo, orden, tipo")
        .eq("rancho_id", id)
        .order("orden"),
      supabase
        .from("giftcards")
        .select("id, codigo, monto, saldo, comprador_nombre, beneficiario_nombre, estado")
        .eq("rancho_id", id)
        .order("created_at", { ascending: false }),
      // Solo lo que tiene DURACIÓN entra al reparto de quién da qué:
      // sin duración no hay franja que asignarle a nadie. Citas la
      // guarda en minutos y los proveedores de eventos en horas (un DJ
      // toca 4), así que valen las dos — antes solo contaban los
      // minutos y a un proveedor de eventos la lista le salía vacía.
      supabase
        .from("rancho_items")
        .select("id, nombre")
        .eq("rancho_id", id)
        .eq("activo", true)
        .or("duracion_minutos.not.is.null,duracion_horas.not.is.null")
        .order("orden"),
      supabase
        .from("bloqueos_agenda")
        .select("id, miembro_id, inicio, fin, motivo")
        .eq("rancho_id", id)
        .gte("fin", ayer)
        .order("inicio"),
    ]);

    const listaEquipo = (equipoRes.data ?? []) as Miembro[];
    const listaServicios = itemsRes.error ? [] : ((itemsRes.data ?? []) as ServicioCita[]);

    // La configuración fina depende de quiénes son y qué servicios hay.
    const [horRes, asigRes] = await Promise.all([
      listaEquipo.length > 0
        ? supabase
            .from("horarios_recurso")
            .select("miembro_id, dow, abre, cierra")
            .in("miembro_id", listaEquipo.map((m) => m.id))
        : Promise.resolve({ data: [], error: null }),
      listaServicios.length > 0
        ? supabase
            .from("servicios_recurso")
            .select("item_id, miembro_id")
            .in("item_id", listaServicios.map((s) => s.id))
        : Promise.resolve({ data: [], error: null }),
    ]);

    setNombre((ranchoRes.data?.nombre as string) ?? null);
    // Las giftcards son de la vertical de Citas: un DJ no las vende.
    setVerticalCitas(
      esVerticalCitas({
        vertical: (ranchoRes.data?.vertical as string | null) ?? null,
        categoria: (ranchoRes.data?.categoria as string | null) ?? null,
      }),
    );
    const d = (ranchoRes.data?.detalles ?? {}) as Record<string, unknown>;
    setDetalles(d);
    setHorario(horarioDeDetalles(d) ?? {});
    setZona((ranchoRes.data?.zona_horaria as string | null) ?? "America/Costa_Rica");
    setEquipo(listaEquipo);
    // Un error acá solo significa que la 0059 todavía no corrió: el
    // resto de la pantalla tiene que seguir funcionando igual.
    setGiftcards(giftRes.error ? [] : ((giftRes.data ?? []) as Giftcard[]));
    setServicios(listaServicios);
    setBloqueos(bloqueosRes.error ? [] : ((bloqueosRes.data ?? []) as Bloqueo[]));
    setAsignaciones(asigRes.error ? [] : ((asigRes.data ?? []) as Asignacion[]));

    const porMiembro: Record<string, RangoRecurso[]> = {};
    for (const fila of (horRes.data ?? []) as RangoRecurso[]) {
      (porMiembro[fila.miembro_id] ??= []).push(fila);
    }
    setHorariosRecurso(porMiembro);
    setCargado(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function agregarMiembro() {
    const limpio = nuevoNombre.trim();
    if (!limpio) return;
    setOcupado("nuevo");
    const { error: err } = await supabase.from("equipo_rancho").insert({
      rancho_id: id,
      // El check de la base admite hasta 60 caracteres.
      nombre: limpio.slice(0, 60),
      rol: nuevoRol.trim().slice(0, 60) || null,
      tipo: nuevoTipo,
      activo: true,
      orden: equipo.length,
    });
    setOcupado(null);

    if (err) {
      Alert.alert("No se pudo agregar", err.message);
      return;
    }
    setNuevoNombre("");
    setNuevoRol("");
    setNuevoTipo("profesional");
    await cargar();
  }

  async function alternarMiembro(miembro: Miembro) {
    setOcupado(miembro.id);
    // Optimista: la fila cambia ya y se revierte sola si falla.
    setEquipo((prev) =>
      prev.map((m) => (m.id === miembro.id ? { ...m, activo: !m.activo } : m)),
    );
    const { error: err } = await supabase
      .from("equipo_rancho")
      .update({ activo: !miembro.activo })
      .eq("id", miembro.id)
      .eq("rancho_id", id);
    setOcupado(null);

    if (err) {
      setEquipo((prev) =>
        prev.map((m) => (m.id === miembro.id ? { ...m, activo: miembro.activo } : m)),
      );
      Alert.alert("No se pudo guardar", err.message);
    }
  }

  function borrarMiembro(miembro: Miembro) {
    Alert.alert(
      `¿Quitar a ${miembro.nombre}?`,
      "Las citas que ya tiene agendadas no se borran, pero deja de aparecer para agendar nuevas.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Quitar",
          style: "destructive",
          onPress: async () => {
            const { error: err } = await supabase
              .from("equipo_rancho")
              .delete()
              .eq("id", miembro.id)
              .eq("rancho_id", id);
            if (err) {
              Alert.alert("No se pudo quitar", err.message);
              return;
            }
            if (configurando === miembro.id) setConfigurando(null);
            await cargar();
          },
        },
      ],
    );
  }

  /** Abre (o cierra) la configuración fina de un miembro. */
  function abrirConfig(miembro: Miembro) {
    if (configurando === miembro.id) {
      setConfigurando(null);
      return;
    }
    const filas = horariosRecurso[miembro.id] ?? [];
    setConfPropio(filas.length > 0);
    setConfDias(diasDesdeFilas(filas));
    // Semántica de servicios_recurso: un servicio SIN filas lo dan
    // todos; con filas, solo los listados.
    const restringidos = new Set(asignaciones.map((a) => a.item_id));
    const propios = new Set(
      asignaciones.filter((a) => a.miembro_id === miembro.id).map((a) => a.item_id),
    );
    setConfMarcados(
      new Set(
        servicios
          .filter((s) => !restringidos.has(s.id) || propios.has(s.id))
          .map((s) => s.id),
      ),
    );
    setConfError(null);
    setConfMensaje(null);
    setConfigurando(miembro.id);
  }

  function cambiarDiaConf(dow: number, cambio: Partial<DiaConf>) {
    setConfDias((prev) => prev.map((d, i) => (i === dow ? { ...d, ...cambio } : d)));
    setConfMensaje(null);
  }

  function alternarServicioConf(itemId: string) {
    setConfMensaje(null);
    setConfMarcados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(itemId)) nuevo.delete(itemId);
      else nuevo.add(itemId);
      return nuevo;
    });
  }

  /**
   * La puerta a /api/citas/equipo del sitio. El app NO escribe
   * horarios_recurso/servicios_recurso directo: la semántica (el
   * centinela de "día libre", la materialización de "lo dan todos") es
   * delicada y vive en UN solo lugar — el núcleo compartido con la
   * server action del panel web.
   */
  async function llamarEquipoApi(cuerpo: {
    ranchoId: string;
    miembroId: string;
    accion: "horario" | "servicios";
    rangos?: { dow: number; abre: string; cierra: string }[] | null;
    diasLibres?: number[];
    itemIds?: string[];
  }): Promise<RespuestaEquipo | null> {
    const token = session?.access_token;
    if (!token) {
      Alert.alert("Entrá con tu cuenta", "Tu sesión expiró. Volvé a entrar para guardar cambios.");
      return null;
    }
    try {
      const res = await fetch(`${SITIO_URL}/api/citas/equipo`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(cuerpo),
      });
      return (await res.json()) as RespuestaEquipo;
    } catch {
      return { ok: false, error: "No hubo conexión con el sitio. Revisá tu internet y probá de nuevo." };
    }
  }

  async function guardarConfHorario(miembroId: string) {
    setConfError(null);
    setConfMensaje(null);

    const rangos: { dow: number; abre: string; cierra: string }[] = [];
    const diasLibres: number[] = [];
    if (confPropio) {
      for (let dow = 0; dow < 7; dow++) {
        const dia = confDias[dow];
        if (!dia.trabaja) {
          // Los días en Libre van explícitos: si no, heredarían el
          // horario del negocio y la persona seguiría reservable.
          diasLibres.push(dow);
          continue;
        }
        if (!HORA_REGEX.test(dia.abre) || !HORA_REGEX.test(dia.cierra)) {
          setConfError(`Revisá las horas del ${DIAS[dow].toLowerCase()}: van como 09:00.`);
          return;
        }
        if (dia.abre >= dia.cierra) {
          setConfError(`El ${DIAS[dow].toLowerCase()} sale antes de entrar.`);
          return;
        }
        rangos.push({ dow, abre: dia.abre, cierra: dia.cierra });
      }
    }

    setGuardandoConf("horario");
    const resp = await llamarEquipoApi({
      ranchoId: id,
      miembroId,
      accion: "horario",
      rangos: confPropio ? rangos : null,
      diasLibres,
    });
    setGuardandoConf(null);
    if (!resp) return;
    if (!resp.ok || resp.error) {
      Alert.alert("No se pudo guardar", resp.error ?? "Probá de nuevo en un rato.");
      return;
    }
    if (resp.advertencia) Alert.alert("Guardado, pero ojo", resp.advertencia);
    setConfMensaje("Horario guardado.");
    await cargar();
  }

  async function guardarConfServicios(miembroId: string) {
    setConfError(null);
    setConfMensaje(null);
    setGuardandoConf("servicios");
    const resp = await llamarEquipoApi({
      ranchoId: id,
      miembroId,
      accion: "servicios",
      itemIds: [...confMarcados],
    });
    setGuardandoConf(null);
    if (!resp) return;
    if (!resp.ok || resp.error) {
      Alert.alert("No se pudo guardar", resp.error ?? "Probá de nuevo en un rato.");
      return;
    }
    if (resp.advertencia) Alert.alert("Guardado, pero ojo", resp.advertencia);
    setConfMensaje("Servicios guardados.");
    await cargar();
  }

  async function crearBloqueo() {
    setBloqError(null);
    const fechaInicio = bloqDesde.trim();
    // Hasta vacío = el bloqueo es de un solo día.
    const fechaFin = bloqHasta.trim() || fechaInicio;
    if (!fechaValida(fechaInicio) || !fechaValida(fechaFin)) {
      setBloqError("Las fechas van como 2026-08-15 (año-mes-día).");
      return;
    }
    const horaInicio = bloqDiasEnteros ? "00:00" : bloqHoraDe.trim();
    const horaFin = bloqDiasEnteros ? "23:59" : bloqHoraA.trim();
    if (!HORA_REGEX.test(horaInicio) || !HORA_REGEX.test(horaFin)) {
      setBloqError("Las horas van como 09:00.");
      return;
    }
    // De la pared del negocio al instante real (timestamptz).
    const inicio = utcDesdeZona(fechaInicio, horaInicio, zona);
    const fin = utcDesdeZona(fechaFin, horaFin, zona);
    if (fin.getTime() <= inicio.getTime()) {
      setBloqError("El final tiene que ser después del inicio.");
      return;
    }

    setCreandoBloqueo(true);
    const { error: err } = await supabase.from("bloqueos_agenda").insert({
      rancho_id: id,
      miembro_id: bloqMiembro,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      motivo: bloqMotivo.trim().slice(0, 200) || null,
    });
    setCreandoBloqueo(false);

    if (err) {
      setBloqError("No se pudo bloquear: " + err.message);
      return;
    }
    setBloqMiembro(null);
    setBloqDesde("");
    setBloqHasta("");
    setBloqDiasEnteros(true);
    setBloqHoraDe("");
    setBloqHoraA("");
    setBloqMotivo("");
    await cargar();
  }

  function quitarBloqueo(b: Bloqueo) {
    Alert.alert(
      "¿Quitar este bloqueo?",
      "Esas horas vuelven a quedar disponibles para agendar.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Quitar",
          style: "destructive",
          onPress: async () => {
            const { error: err } = await supabase
              .from("bloqueos_agenda")
              .delete()
              .eq("id", b.id)
              .eq("rancho_id", id);
            if (err) {
              Alert.alert("No se pudo quitar", err.message);
              return;
            }
            await cargar();
          },
        },
      ],
    );
  }

  /** Guarda la semana entera, reconstruida limpia como en la web. */
  async function guardarHorario() {
    setError(null);
    setMensaje(null);

    const limpio: HorarioSemana = {};
    for (let dow = 0; dow < 7; dow++) {
      const dia = horario[String(dow)];
      if (!dia) {
        limpio[String(dow)] = null;
        continue;
      }
      if (!HORA_REGEX.test(dia.abre) || !HORA_REGEX.test(dia.cierra)) {
        setError(`Revisá las horas del ${DIAS[dow].toLowerCase()}: van como 09:00.`);
        return;
      }
      if (dia.abre >= dia.cierra) {
        setError(`El ${DIAS[dow].toLowerCase()} cierra antes de abrir.`);
        return;
      }
      limpio[String(dow)] = { abre: dia.abre, cierra: dia.cierra };
    }

    setGuardandoHorario(true);
    const { error: err } = await supabase
      .from("ranchos")
      // Se mezcla con lo que ya había: `detalles` guarda muchas otras
      // cosas del negocio y pisarlo entero las borraría.
      .update({ detalles: { ...detalles, horario_citas: limpio } })
      .eq("id", id);
    setGuardandoHorario(false);

    if (err) {
      setError("No se pudo guardar: " + err.message);
      return;
    }
    setMensaje("Horario guardado.");
    await cargar();
  }

  function cambiarDia(dow: number, campo: "abre" | "cierra", valor: string) {
    const clave = String(dow);
    const actual = horario[clave] ?? { abre: "09:00", cierra: "17:00" };
    setHorario({ ...horario, [clave]: { ...actual, [campo]: valor } });
  }

  function alternarDia(dow: number) {
    const clave = String(dow);
    setHorario({
      ...horario,
      [clave]: horario[clave] ? null : { abre: "09:00", cierra: "17:00" },
    });
  }

  if (!cargado) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Configuración" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  const nombrePorMiembro = new Map(equipo.map((m) => [m.id, m.nombre]));

  return (
    <View style={styles.contenedor}>
      {/* Bajo el esquema de 4 del panel (Inicio, Citas, Finanzas y
          Configuración), esta pantalla es la Configuración del negocio
          de citas — "Citas" a secas es la agenda del día. */}
      <BarraSuperior titulo="Configuración" subtitulo={nombre ?? undefined} />

      <View style={styles.pestanas}>
        {(
          [
            { id: "equipo" as const, label: "Equipo" },
            { id: "horario" as const, label: "Horario" },
            ...(verticalCitas ? [{ id: "giftcards" as const, label: "Giftcards" }] : []),
            { id: "bloqueos" as const, label: "Bloqueos" },
          ]
        ).map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setSeccion(p.id)}
            style={[styles.pestana, seccion === p.id && styles.pestanaActiva]}
          >
            <Text style={[styles.pestanaTexto, seccion === p.id && styles.pestanaTextoActiva]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {seccion === "equipo" && (
          <>
            <View style={styles.bloque}>
              <Text style={styles.bloqueTitulo}>Quién atiende</Text>
              <Text style={styles.bloqueAyuda}>
                El cliente elige con quién quiere su cita. Apagá a alguien para
                que deje de aparecer sin borrarlo.
              </Text>

              {equipo.length === 0 ? (
                <Text style={styles.vacio}>
                  Todavía no agregaste a nadie. Sin equipo, tus clientes no
                  pueden agendar.
                </Text>
              ) : (
                equipo.map((m) => (
                  <View key={m.id} style={styles.miembroBloque}>
                    <View style={styles.miembroFila}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarTexto}>
                          {m.nombre.trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.filaNombre}>
                          <Text
                            style={[styles.miembroNombre, styles.nombreEncoge]}
                            numberOfLines={1}
                          >
                            {m.nombre}
                          </Text>
                          {m.tipo && m.tipo !== "profesional" && (
                            <View style={styles.badgeTipo}>
                              <Text style={styles.badgeTipoTexto}>
                                {m.tipo === "espacio" ? "Espacio" : "Equipo"}
                              </Text>
                            </View>
                          )}
                        </View>
                        {!!m.rol && (
                          <Text style={styles.miembroRol} numberOfLines={1}>
                            {m.rol}
                          </Text>
                        )}
                      </View>
                      <Switch
                        value={m.activo}
                        disabled={ocupado === m.id}
                        trackColor={{ true: Colors.navy }}
                        onValueChange={() => alternarMiembro(m)}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar a ${m.nombre}`}
                        onPress={() => borrarMiembro(m)}
                        hitSlop={8}
                        style={styles.botonQuitar}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color={Colors.danger}
                          accessibilityLabel={`Quitar a ${m.nombre}`}
                        />
                      </Pressable>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Horario y servicios de ${m.nombre}`}
                      onPress={() => abrirConfig(m)}
                      hitSlop={6}
                      style={styles.botonConfig}
                    >
                      <Text style={styles.botonConfigTexto}>Horario y servicios</Text>
                      <Ionicons
                        name={configurando === m.id ? "chevron-up" : "chevron-down"}
                        size={13}
                        color={Colors.navy}
                        accessibilityLabel={
                          configurando === m.id
                            ? "Cerrar configuración"
                            : "Abrir configuración"
                        }
                      />
                    </Pressable>

                    {configurando === m.id && (
                      <View style={styles.configPanel}>
                        <Text style={styles.configEtiqueta}>Horario de esta persona</Text>
                        <View style={styles.chipsFila}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Usar el horario del negocio"
                            onPress={() => {
                              setConfPropio(false);
                              setConfMensaje(null);
                            }}
                            style={[styles.chip, !confPropio && styles.chipActivo]}
                          >
                            <Text
                              style={[styles.chipTexto, !confPropio && styles.chipTextoActivo]}
                            >
                              El del negocio
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Usar un horario propio"
                            onPress={() => {
                              setConfPropio(true);
                              setConfMensaje(null);
                            }}
                            style={[styles.chip, confPropio && styles.chipActivo]}
                          >
                            <Text
                              style={[styles.chipTexto, confPropio && styles.chipTextoActivo]}
                            >
                              Horario propio
                            </Text>
                          </Pressable>
                        </View>

                        {confPropio &&
                          confDias.map((dia, dow) => (
                            <View key={DIAS[dow]} style={styles.filaDia}>
                              <View style={styles.diaEncabezado}>
                                <Text
                                  style={[styles.diaNombre, !dia.trabaja && styles.diaCerrado]}
                                >
                                  {DIAS[dow]}
                                </Text>
                                <View style={styles.trabajaFila}>
                                  <Text style={styles.trabajaTexto}>
                                    {dia.trabaja ? "Trabaja" : "Libre"}
                                  </Text>
                                  <Switch
                                    value={dia.trabaja}
                                    trackColor={{ true: Colors.navy }}
                                    onValueChange={(v) => cambiarDiaConf(dow, { trabaja: v })}
                                  />
                                </View>
                              </View>
                              {dia.trabaja && (
                                <View style={styles.horas}>
                                  <View style={styles.campoHora}>
                                    <Text style={styles.campoHoraEtiqueta}>Entra</Text>
                                    <TextInput
                                      value={dia.abre}
                                      onChangeText={(v) => cambiarDiaConf(dow, { abre: v })}
                                      placeholder="09:00"
                                      placeholderTextColor={Colors.inkMuted}
                                      keyboardType="numbers-and-punctuation"
                                      maxLength={5}
                                      style={styles.input}
                                    />
                                  </View>
                                  <View style={styles.campoHora}>
                                    <Text style={styles.campoHoraEtiqueta}>Sale</Text>
                                    <TextInput
                                      value={dia.cierra}
                                      onChangeText={(v) => cambiarDiaConf(dow, { cierra: v })}
                                      placeholder="17:00"
                                      placeholderTextColor={Colors.inkMuted}
                                      keyboardType="numbers-and-punctuation"
                                      maxLength={5}
                                      style={styles.input}
                                    />
                                  </View>
                                </View>
                              )}
                            </View>
                          ))}

                        <Pressable
                          style={styles.botonPrimario}
                          disabled={guardandoConf !== null}
                          onPress={() => guardarConfHorario(m.id)}
                        >
                          {guardandoConf === "horario" ? (
                            <ActivityIndicator color="#ffffff" size="small" />
                          ) : (
                            <Text style={styles.botonPrimarioTexto}>Guardar horario</Text>
                          )}
                        </Pressable>

                        <Text style={styles.configEtiqueta}>Servicios que da</Text>
                        {servicios.length === 0 ? (
                          <Text style={styles.vacio}>
                            Todavía no hay servicios de cita en el catálogo.
                          </Text>
                        ) : (
                          <>
                            <View style={styles.chipsFila}>
                              {servicios.map((s) => {
                                const marcado = confMarcados.has(s.id);
                                return (
                                  <Pressable
                                    key={s.id}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                      marcado
                                        ? `Ya no da ${s.nombre}`
                                        : `Marcar que da ${s.nombre}`
                                    }
                                    onPress={() => alternarServicioConf(s.id)}
                                    style={[styles.chip, marcado && styles.chipActivo]}
                                  >
                                    <Text
                                      style={[
                                        styles.chipTexto,
                                        marcado && styles.chipTextoActivo,
                                      ]}
                                    >
                                      {s.nombre}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                            <Pressable
                              style={styles.botonPrimario}
                              disabled={guardandoConf !== null}
                              onPress={() => guardarConfServicios(m.id)}
                            >
                              {guardandoConf === "servicios" ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                              ) : (
                                <Text style={styles.botonPrimarioTexto}>
                                  Guardar servicios
                                </Text>
                              )}
                            </Pressable>
                          </>
                        )}

                        {confError && <Text style={styles.error}>{confError}</Text>}
                        {confMensaje && <Text style={styles.exito}>{confMensaje}</Text>}
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>

            <View style={styles.bloque}>
              <Text style={styles.bloqueTitulo}>Agregar a alguien</Text>
              <Text style={styles.configEtiqueta}>Qué es</Text>
              <View style={styles.chipsFila}>
                {TIPOS_MIEMBRO.map((t) => (
                  <Pressable
                    key={t.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Tipo: ${t.label}`}
                    onPress={() => setNuevoTipo(t.id)}
                    style={[styles.chip, nuevoTipo === t.id && styles.chipActivo]}
                  >
                    <Text
                      style={[styles.chipTexto, nuevoTipo === t.id && styles.chipTextoActivo]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={nuevoNombre}
                onChangeText={setNuevoNombre}
                placeholder="Nombre"
                placeholderTextColor={Colors.inkMuted}
                maxLength={60}
                style={styles.input}
              />
              <TextInput
                value={nuevoRol}
                onChangeText={setNuevoRol}
                placeholder="Rol (estilista, barbero, manicurista...)"
                placeholderTextColor={Colors.inkMuted}
                maxLength={60}
                style={styles.input}
              />
              <Pressable
                style={styles.botonPrimario}
                disabled={!nuevoNombre.trim() || ocupado === "nuevo"}
                onPress={agregarMiembro}
              >
                {ocupado === "nuevo" ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.botonPrimarioTexto}>Agregar al equipo</Text>
                )}
              </Pressable>
            </View>
          </>
        )}

        {seccion === "horario" && (
          <View style={styles.bloque}>
            <Text style={styles.bloqueTitulo}>Horario de la semana</Text>
            <Text style={styles.bloqueAyuda}>
              Las horas van como 09:00. Los días apagados son los que no abrís.
            </Text>

            {DIAS.map((dia, dow) => {
              const abierto = Boolean(horario[String(dow)]);
              const d = horario[String(dow)];
              return (
                <View key={dia} style={styles.filaDia}>
                  <View style={styles.diaEncabezado}>
                    <Text style={[styles.diaNombre, !abierto && styles.diaCerrado]}>{dia}</Text>
                    <Switch
                      value={abierto}
                      trackColor={{ true: Colors.navy }}
                      onValueChange={() => alternarDia(dow)}
                    />
                  </View>
                  {abierto && (
                    <View style={styles.horas}>
                      <View style={styles.campoHora}>
                        <Text style={styles.campoHoraEtiqueta}>Abre</Text>
                        <TextInput
                          value={d?.abre ?? ""}
                          onChangeText={(v) => cambiarDia(dow, "abre", v)}
                          placeholder="09:00"
                          placeholderTextColor={Colors.inkMuted}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.campoHora}>
                        <Text style={styles.campoHoraEtiqueta}>Cierra</Text>
                        <TextInput
                          value={d?.cierra ?? ""}
                          onChangeText={(v) => cambiarDia(dow, "cierra", v)}
                          placeholder="17:00"
                          placeholderTextColor={Colors.inkMuted}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={styles.input}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {error && <Text style={styles.error}>{error}</Text>}
            {mensaje && <Text style={styles.exito}>{mensaje}</Text>}

            <Pressable
              style={styles.botonPrimario}
              disabled={guardandoHorario}
              onPress={guardarHorario}
            >
              {guardandoHorario ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.botonPrimarioTexto}>Guardar horario</Text>
              )}
            </Pressable>
          </View>
        )}

        {seccion === "giftcards" && (
          <View style={styles.bloque}>
            <Text style={styles.bloqueTitulo}>Giftcards vendidas</Text>
            <Text style={styles.bloqueAyuda}>
              Buscá el código que te muestra el cliente para ver cuánto saldo le
              queda antes de cobrarle.
            </Text>

            {giftcards.length === 0 ? (
              <Text style={styles.vacio}>Todavía no vendiste giftcards.</Text>
            ) : (
              giftcards.map((g) => (
                <View key={g.id} style={styles.filaGift}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.giftCodigo}>{g.codigo}</Text>
                    <Text style={styles.giftDetalle} numberOfLines={1}>
                      {g.beneficiario_nombre || g.comprador_nombre || "Sin nombre"}
                      {" · de "}
                      {fmtColones(Number(g.monto))}
                    </Text>
                  </View>
                  <View style={styles.giftSaldo}>
                    <Text
                      style={[
                        styles.giftSaldoMonto,
                        g.estado !== "activa" && styles.giftSaldoGastado,
                      ]}
                    >
                      {fmtColones(Number(g.saldo))}
                    </Text>
                    <Text style={styles.giftEstado}>
                      {g.estado === "activa"
                        ? "disponible"
                        : g.estado === "canjeada"
                          ? "canjeada"
                          : "vencida"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {seccion === "bloqueos" && (
          <>
            <View style={styles.bloque}>
              <Text style={styles.bloqueTitulo}>Vacaciones y ausencias</Text>
              <Text style={styles.bloqueAyuda}>
                Nadie puede agendar dentro de un bloqueo: sirven para
                vacaciones, citas médicas o cierres. Los del día a día salen
                más rápido desde la Agenda.
              </Text>

              {bloqueos.length === 0 ? (
                <Text style={styles.vacio}>No hay bloqueos vigentes ni futuros.</Text>
              ) : (
                bloqueos.map((b) => (
                  <View key={b.id} style={styles.filaBloqueo}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.miembroNombre} numberOfLines={1}>
                        {b.miembro_id
                          ? (nombrePorMiembro.get(b.miembro_id) ?? "Alguien que ya no está")
                          : "Todo el negocio"}
                      </Text>
                      <Text style={styles.miembroRol} numberOfLines={2}>
                        {etiquetaBloqueo(b, zona)}
                        {b.motivo ? ` · ${b.motivo}` : ""}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Quitar bloqueo"
                      onPress={() => quitarBloqueo(b)}
                      hitSlop={8}
                      style={styles.botonQuitar}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color={Colors.danger}
                        accessibilityLabel="Quitar bloqueo"
                      />
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            <View style={styles.bloque}>
              <Text style={styles.bloqueTitulo}>Bloquear días u horas</Text>

              <Text style={styles.configEtiqueta}>Aplica a</Text>
              <View style={styles.chipsFila}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bloquear todo el negocio"
                  onPress={() => setBloqMiembro(null)}
                  style={[styles.chip, bloqMiembro === null && styles.chipActivo]}
                >
                  <Text
                    style={[styles.chipTexto, bloqMiembro === null && styles.chipTextoActivo]}
                  >
                    Todo el negocio
                  </Text>
                </Pressable>
                {equipo
                  .filter((m) => m.activo)
                  .map((m) => (
                    <Pressable
                      key={m.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Bloquear solo a ${m.nombre}`}
                      onPress={() => setBloqMiembro(m.id)}
                      style={[styles.chip, bloqMiembro === m.id && styles.chipActivo]}
                    >
                      <Text
                        style={[
                          styles.chipTexto,
                          bloqMiembro === m.id && styles.chipTextoActivo,
                        ]}
                      >
                        Solo {m.nombre}
                      </Text>
                    </Pressable>
                  ))}
              </View>

              <View style={styles.horas}>
                <View style={styles.campoHora}>
                  <Text style={styles.campoHoraEtiqueta}>Desde (año-mes-día)</Text>
                  <TextInput
                    value={bloqDesde}
                    onChangeText={setBloqDesde}
                    placeholder="2026-08-15"
                    placeholderTextColor={Colors.inkMuted}
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    style={styles.input}
                  />
                </View>
                <View style={styles.campoHora}>
                  <Text style={styles.campoHoraEtiqueta}>Hasta (vacío = ese día)</Text>
                  <TextInput
                    value={bloqHasta}
                    onChangeText={setBloqHasta}
                    placeholder="2026-08-20"
                    placeholderTextColor={Colors.inkMuted}
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.diaEncabezado}>
                <Text style={styles.diaNombre}>Días enteros</Text>
                <Switch
                  value={bloqDiasEnteros}
                  trackColor={{ true: Colors.navy }}
                  onValueChange={setBloqDiasEnteros}
                />
              </View>

              {!bloqDiasEnteros && (
                <View style={styles.horas}>
                  <View style={styles.campoHora}>
                    <Text style={styles.campoHoraEtiqueta}>De</Text>
                    <TextInput
                      value={bloqHoraDe}
                      onChangeText={setBloqHoraDe}
                      placeholder="09:00"
                      placeholderTextColor={Colors.inkMuted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.campoHora}>
                    <Text style={styles.campoHoraEtiqueta}>A</Text>
                    <TextInput
                      value={bloqHoraA}
                      onChangeText={setBloqHoraA}
                      placeholder="13:00"
                      placeholderTextColor={Colors.inkMuted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      style={styles.input}
                    />
                  </View>
                </View>
              )}

              <TextInput
                value={bloqMotivo}
                onChangeText={setBloqMotivo}
                placeholder="Motivo, ej. Vacaciones (solo lo ves vos)"
                placeholderTextColor={Colors.inkMuted}
                maxLength={200}
                style={styles.input}
              />

              {bloqError && <Text style={styles.error}>{bloqError}</Text>}

              <Pressable
                style={styles.botonPrimario}
                disabled={
                  creandoBloqueo ||
                  !bloqDesde.trim() ||
                  (!bloqDiasEnteros && (!bloqHoraDe.trim() || !bloqHoraA.trim()))
                }
                onPress={crearBloqueo}
              >
                {creandoBloqueo ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.botonPrimarioTexto}>Bloquear</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  scroll: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },

  pestanas: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pestana: {
    borderColor: Colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 9,
  },
  pestanaActiva: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pestanaTexto: {
    color: Colors.ink,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    textAlign: "center",
  },
  pestanaTextoActiva: { color: "#ffffff" },

  bloque: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  bloqueTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  bloqueAyuda: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17 },
  vacio: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    paddingVertical: Spacing.two,
  },

  miembroBloque: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  miembroFila: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: Radios.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarTexto: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 15 },
  filaNombre: { alignItems: "center", flexDirection: "row", gap: 6 },
  nombreEncoge: { flexShrink: 1 },
  miembroNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  miembroRol: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  badgeTipo: {
    backgroundColor: Colors.cream2,
    borderRadius: Radios.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeTipoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 10 },
  botonQuitar: {
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  botonConfig: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 4,
    paddingVertical: 4,
  },
  botonConfigTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12 },
  configPanel: {
    backgroundColor: Colors.cream,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.two,
  },
  configEtiqueta: {
    color: Colors.inkSoft,
    fontFamily: Fonts.semiBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  chipsFila: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    backgroundColor: Colors.surface,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTexto: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 12 },
  chipTextoActivo: { color: "#ffffff" },
  trabajaFila: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  trabajaTexto: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 11.5 },

  filaDia: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  diaEncabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  diaNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  diaCerrado: { color: Colors.inkMuted },
  horas: { flexDirection: "row", gap: Spacing.two },
  campoHora: { flex: 1, gap: 3 },
  campoHoraEtiqueta: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 10.5 },

  filaGift: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  giftCodigo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  giftDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  giftSaldo: { alignItems: "flex-end" },
  giftSaldoMonto: { color: Colors.green, fontFamily: Fonts.extraBold, fontSize: 14.5 },
  giftSaldoGastado: { color: Colors.inkMuted },
  giftEstado: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 10.5 },

  filaBloqueo: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },

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
  error: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    color: Colors.danger,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    padding: Spacing.two,
  },
  exito: {
    backgroundColor: Colors.greenLight,
    borderRadius: Radios.sm,
    color: Colors.green,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    padding: Spacing.two,
  },
  botonPrimario: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 12,
    marginTop: Spacing.one,
    paddingVertical: 13,
  },
  botonPrimarioTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 14 },
});
