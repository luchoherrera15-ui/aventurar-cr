import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BarraSuperior from "@/components/barra-superior";
import {
  Aviso,
  BarraAccion,
  BarraConfirmacion,
  Boton,
  Casilla,
  Identidad,
  Micro,
  Opcion,
  RejillaHoras,
  Tarjeta,
  Vacio,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { pedirCorreosDeCita } from "@/lib/notificaciones";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { enConfiguracion, fmtColones } from "@/lib/types";
import { esCitas as esVerticalCitas, tocarHoraAbreChat } from "@/lib/agenda-negocio";
import {
  DIAS_CORTO,
  MESES_CORTO,
  etiquetaMinutos,
  fechaISOLocal,
  horaBonita,
  horarioDeDetalles,
  sumarMinutosHora,
  type HorarioSemana,
} from "@/lib/citas";
import {
  calcularDisponibilidad,
  instanteEnZona,
  rangosDelDia,
  type BloqueoDisponibilidad,
  type CitaExistente,
  type RecursoDisponibilidad,
} from "@/lib/disponibilidad";

type Servicio = {
  id: string;
  nombre: string;
  precio: number | null;
  duracion_minutos: number | null;
  buffer_min: number | null;
  /** Política de reserva del servicio (0118). Anulables: null = sin
   *  restricción. crear_cita las hace cumplir; acá se usan para no
   *  ofrecer un espacio que el motor va a rechazar. */
  anticipacion_min_horas?: number | null;
  anticipacion_max_dias?: number | null;
};

type Miembro = { id: string; nombre: string; foto_url: string | null };

/** Fila de la vista disponibilidad_citas (desde 0081 con su buffer). */
type CitaDelDia = {
  hora_inicio: string;
  duracion_minutos: number | null;
  miembro_id: string | null;
  buffer_minutos: number | null;
};

/** Cuatro semanas hacia adelante, igual que la agenda de la web. */
const DIAS_VISIBLES = 28;

const CAMPOS_SERVICIO = "id, nombre, precio, duracion_minutos, buffer_min";
/** Política de reserva (0118). La app vive en un teléfono que puede
 *  estar contra una base donde el dueño todavía no pegó la migración:
 *  si las columnas no existen se reintenta sin ellas y la pantalla de
 *  reservar sigue funcionando, solo que sin política. */
const CAMPOS_POLITICA = "anticipacion_min_horas, anticipacion_max_dias";

async function cargarServicios(ranchoId: string): Promise<{ data: Servicio[] | null }> {
  const consulta = (campos: string) =>
    supabase
      .from("rancho_items")
      .select(campos)
      .eq("rancho_id", ranchoId)
      .eq("activo", true)
      .order("orden", { ascending: true });

  const conPolitica = await consulta(`${CAMPOS_SERVICIO}, ${CAMPOS_POLITICA}`);
  const res = conPolitica.error ? await consulta(CAMPOS_SERVICIO) : conPolitica;
  // El select con una lista de campos armada en runtime no se puede
  // inferir; el shape lo garantizan las dos constantes de arriba.
  return { data: (res.data as unknown as Servicio[] | null) ?? null };
}

/** Sin horario configurado, el negocio "abre" 8–18 todos los días —
 * el mismo default de siempre de esta pantalla. */
const HORARIO_DEFAULT: HorarioSemana = Object.fromEntries(
  Array.from({ length: 7 }, (_, d) => [String(d), { abre: "08:00", cierra: "18:00" }]),
);

/**
 * La agenda de citas del app — espejo del modal Fresha de la web
 * (src/app/citas/[slug]/reservar/reservar-cita.tsx), en el lenguaje de
 * la marca: el servicio y la persona se eligen en filas de ancho
 * completo (no chips), las horas en rejilla, y la barra de abajo lleva
 * el total y el paso siguiente. Confirmar llama al mismo RPC crear_cita
 * y los avisos salen por /api/citas/[id]/confirmacion. Reservar exige
 * sesión, como todo el app.
 */
export default function ReservarCitaScreen() {
  const { id, servicio: servicioParam, miembro: miembroParam } = useLocalSearchParams<{
    id: string;
    servicio?: string;
    miembro?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, cargando: cargandoAuth } = useAuth();

  const [cargando, setCargando] = useState(true);
  const [nombreNegocio, setNombreNegocio] = useState<string | null>(null);
  const [fotoNegocio, setFotoNegocio] = useState<string | null>(null);
  const [items, setItems] = useState<Servicio[]>([]);
  const [equipo, setEquipo] = useState<Miembro[]>([]);
  const [horario, setHorario] = useState<HorarioSemana | null>(null);
  const [zonaHoraria, setZonaHoraria] = useState("America/Costa_Rica");
  // Los datos "pro" de la agenda (0061): horario propio por persona,
  // bloqueos vigentes y qué recursos dan qué servicio.
  const [horariosRecurso, setHorariosRecurso] = useState<
    Record<string, RecursoDisponibilidad["horario"]>
  >({});
  const [bloqueos, setBloqueos] = useState<
    { miembro_id: string | null; inicio: string; fin: string }[]
  >([]);
  const [serviciosRecurso, setServiciosRecurso] = useState<
    { item_id: string; miembro_id: string }[]
  >([]);

  const [paso, setPaso] = useState<"hora" | "confirmar">("hora");
  const [servicioId, setServicioId] = useState<string | null>(null);
  const [miembroId, setMiembroId] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [ocupadas, setOcupadas] = useState<CitaDelDia[]>([]);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null); // reservaId

  // Con sesión, el contacto llega precargado (ajuste durante el
  // render): nombre de la cuenta, teléfono aprendido de reservas
  // anteriores vía metadatos.
  const [precargado, setPrecargado] = useState(false);
  if (!precargado && session?.user) {
    setPrecargado(true);
    const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
    const nombreMeta = [meta.nombre, meta.full_name].find(
      (v): v is string => typeof v === "string" && v.trim() !== "",
    );
    const whatsappMeta = meta.whatsapp;
    if (nombreMeta && !nombre) setNombre(nombreMeta);
    if (typeof whatsappMeta === "string" && whatsappMeta.trim() !== "" && !telefono) {
      setTelefono(whatsappMeta);
    }
  }

  const cargar = useCallback(async () => {
    const [n, i, e] = await Promise.all([
      // Sin `.eq("vertical", "citas")` en la consulta: el corte se hace
      // abajo con el helper, para poder distinguir "no es de acá" de
      // "es un proveedor de eventos, que va por otro camino".
      supabase
        .from("ranchos")
        .select("id, nombre, foto_url, detalles, zona_horaria, vertical, categoria")
        .eq("id", id)
        .eq("estado", "aprobado")
        .maybeSingle(),
      cargarServicios(id),
      supabase
        .from("equipo_rancho")
        .select("id, nombre, foto_url")
        .eq("rancho_id", id)
        .eq("activo", true)
        .order("orden", { ascending: true }),
    ]);

    const fila = (n.data ?? null) as {
      nombre?: string;
      foto_url?: string | null;
      detalles?: Record<string, unknown> | null;
      zona_horaria?: string | null;
      vertical?: string | null;
      categoria?: string | null;
    } | null;

    // ESTA PANTALLA RESERVA DE VERDAD: llama a `crear_cita`, que aparta
    // la franja. Un proveedor de eventos no aparta nada — su hora se
    // consulta por chat — así que si alguien llega acá por un enlace
    // viejo se lo manda a su ficha, donde está la agenda que abre el
    // chat. Y una publicación en pausa no recibe citas de nadie.
    if (fila && tocarHoraAbreChat(fila)) {
      router.replace(`/rancho/${id}` as never);
      return;
    }
    // Lo que no es de Citas (un Lugar, un restaurante, un hospedaje) y
    // lo que está en pausa caen en el "ya no está disponible" de
    // siempre — es lo que hacía el `.eq("vertical", "citas")`.
    if (!fila || !esVerticalCitas(fila) || enConfiguracion(fila.detalles)) {
      setNombreNegocio(null);
      setCargando(false);
      return;
    }

    const horarioCargado = horarioDeDetalles(n.data?.detalles);
    const listaItems = (i.data ?? []) as Servicio[];
    const listaEquipo = (e.data ?? []) as Miembro[];

    // Los datos "pro" (0061): horario por persona, bloqueos vigentes y
    // la asignación servicio↔recurso — el motor y el RPC los respetan.
    const [h, b, sr] = await Promise.all([
      listaEquipo.length > 0
        ? supabase
            .from("horarios_recurso")
            .select("miembro_id, dow, abre, cierra")
            .in("miembro_id", listaEquipo.map((m) => m.id))
        : Promise.resolve({ data: [] }),
      supabase
        .from("bloqueos_agenda_publicos")
        .select("miembro_id, inicio, fin")
        .eq("rancho_id", id)
        .gte("fin", new Date().toISOString()),
      listaItems.length > 0
        ? supabase
            .from("servicios_recurso")
            .select("item_id, miembro_id")
            .in("item_id", listaItems.map((s) => s.id))
        : Promise.resolve({ data: [] }),
    ]);

    // Filas → objeto por miembro, claves SOLO para los días con filas
    // (la convención de herencia del motor y del RPC 0081).
    const porMiembro: Record<string, RecursoDisponibilidad["horario"]> = {};
    for (const fila of (h.data ?? []) as {
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

    setNombreNegocio(n.data?.nombre ?? null);
    setFotoNegocio(n.data?.foto_url ?? null);
    setItems(listaItems);
    setEquipo(listaEquipo);
    setHorario(horarioCargado);
    setZonaHoraria((n.data?.zona_horaria as string | null) ?? "America/Costa_Rica");
    setHorariosRecurso(porMiembro);
    setBloqueos((b.data ?? []) as { miembro_id: string | null; inicio: string; fin: string }[]);
    setServiciosRecurso((sr.data ?? []) as { item_id: string; miembro_id: string }[]);
    // "Reservar con X" entra sin servicio elegido: se arranca en el
    // primero que X SÍ da — si no, la persona que el cliente acaba de
    // tocar desaparecería sola de la lista. (Igual que la web.)
    const asignaciones = (sr.data ?? []) as { item_id: string; miembro_id: string }[];
    const daElServicio = (itemId: string, miembroId: string) => {
      const deEse = asignaciones.filter((a) => a.item_id === itemId);
      return deEse.length === 0 || deEse.some((a) => a.miembro_id === miembroId);
    };
    const miembroElegido =
      miembroParam && listaEquipo.some((m) => m.id === miembroParam) ? miembroParam : null;
    setServicioId(
      servicioParam && listaItems.some((s) => s.id === servicioParam)
        ? servicioParam
        : (miembroElegido
            ? (listaItems.find((s) => daElServicio(s.id, miembroElegido))?.id ?? null)
            : null) ?? (listaItems[0]?.id ?? null),
    );
    // "Reservar con X" llega con la persona ya elegida en la URL.
    setMiembroId(miembroElegido);
    // La fecha inicial NO se calcula acá: `fechaElegida` (en el
    // render) ya se corre sola al primer día abierto, y ahí sí se
    // conoce el servicio elegido y la zona del negocio. Duplicar el
    // barrido de días era la forma segura de que las dos versiones se
    // fueran separando.
    setCargando(false);
  }, [id, servicioParam, miembroParam, router]);

  useEffect(() => {
    if (cargandoAuth || !session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga la agenda al montar (con sesión), sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar, session, cargandoAuth]);

  const servicio = items.find((s) => s.id === servicioId) ?? null;
  const duracion = servicio?.duracion_minutos ?? 30;
  const buffer = servicio?.buffer_min ?? 0;
  const anticipacionMin = servicio?.anticipacion_min_horas ?? 0;
  const anticipacionMax = servicio?.anticipacion_max_dias ?? null;
  const horarioNegocio = horario ?? HORARIO_DEFAULT;

  // El equipo que da el servicio elegido: con filas en
  // servicios_recurso solo esas personas; sin filas, todas (0061).
  const asignados = new Set(
    serviciosRecurso.filter((sr) => sr.item_id === servicioId).map((sr) => sr.miembro_id),
  );
  const restringido = asignados.size > 0;
  const equipoDelServicio = restringido ? equipo.filter((m) => asignados.has(m.id)) : equipo;
  // Nadie da este servicio: estaba restringido a gente que ya no
  // atiende. Ojo con `equipo.length`: si el negocio se quedó SIN
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
  const recursos: RecursoDisponibilidad[] = equipoDelServicio.map((m) => ({
    id: m.id,
    horario: horariosRecurso[m.id] ?? null,
  }));

  // Los próximos días: abierto si ALGÚN recurso del servicio trabaja
  // ese día — o el negocio, si no hay equipo. (Cálculo barato: una
  // grilla de 28 días.)
  // La tira arranca en el "hoy" DEL NEGOCIO, no en el del teléfono:
  // un cliente en otro huso (o con el reloj corrido) veía la agenda
  // empezada un día antes o después.
  const [ay, am, ad] = instanteEnZona(new Date().toISOString(), zonaHoraria)
    .fecha.split("-")
    .map(Number);
  const hoyBase = new Date(ay, am - 1, ad);
  const dias = Array.from({ length: DIAS_VISIBLES }, (_, k) => {
    const d = new Date(hoyBase);
    d.setDate(d.getDate() + k);
    const dow = d.getDay();
    // Más allá del tope de anticipación del servicio (0118) el día se
    // muestra cerrado: crear_cita rechazaría la cita igual.
    const dentroDelTope = anticipacionMax === null || k <= anticipacionMax;
    const abierto = sinNadieQueAtienda
      ? false
      : !dentroDelTope
        ? false
        : recursos.length > 0
          ? recursos.some((r) => rangosDelDia(r, dow, horarioNegocio).length > 0)
          : rangosDelDia(null, dow, horarioNegocio).length > 0;
    return { iso: fechaISOLocal(d), dow, dia: d.getDate(), mes: d.getMonth(), abierto, esHoy: k === 0 };
  });

  // Derivada, no un efecto: si el día marcado dejó de estar abierto
  // (cambió el servicio y esa persona no trabaja los martes), la
  // elección se corre sola al primer día que sí.
  const fechaElegida = dias.some((d) => d.iso === fecha && d.abierto)
    ? fecha
    : (dias.find((d) => d.abierto)?.iso ?? "");

  // Al cambiar el día se traen sus citas ocupadas (vista pública,
  // desde 0081 con el buffer de limpieza de cada una). Va después de
  // las derivaciones porque depende del día realmente elegido.
  useEffect(() => {
    // Mientras carga, `fechaElegida` sale del horario por defecto y
    // caería en HOY: pedir esas citas sería una consulta al pedo y,
    // peor, pintaría la grilla del primer día abierto restando las
    // citas de hoy hasta que llegue la respuesta buena.
    if (cargando || !fechaElegida) return;
    let vigente = true;
    supabase
      .from("disponibilidad_citas")
      .select("hora_inicio, duracion_minutos, miembro_id, buffer_minutos")
      .eq("rancho_id", id)
      .eq("fecha", fechaElegida)
      .then(({ data }) => {
        if (vigente) setOcupadas((data ?? []) as CitaDelDia[]);
      });
    return () => {
      vigente = false;
    };
  }, [id, fechaElegida, cargando]);

  const diaElegido = dias.find((d) => d.iso === fechaElegida);
  const ahora = new Date();
  // El motor pro (0061) respeta horario por persona, bloqueos y
  // buffers — lo mismo que el RPC valida en el servidor desde la 0081.
  const disponibilidad =
    !diaElegido || !diaElegido.abierto
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
          // dos días adelante. Pasarlo solo el día de hoy dejaba al
          // motor sin con qué calcularlo y la pantalla ofrecía horas
          // que crear_cita rechazaba. Para un día lejano el margen da
          // negativo y el motor lo aplana en 0, así que no filtra nada.
          ahora,
          // La media hora de gracia que ya existía es el piso; si el
          // servicio pide más anticipación, manda la suya.
          anticipacionMinHoras: Math.max(0.5, anticipacionMin),
        });
  const horas = !disponibilidad
    ? []
    : miembroValido
      ? (disponibilidad.porRecurso[miembroValido] ?? [])
      : recursos.length > 0
        ? disponibilidad.cualquiera
        : (disponibilidad.porRecurso[""] ?? []);
  const horaElegida = horas.includes(hora) ? hora : "";

  async function confirmar() {
    if (!servicio || !fechaElegida || !horaElegida || !session) return;
    setError(null);
    setEnviando(true);
    const { data, error: errorRpc } = await supabase.rpc("crear_cita", {
      p_rancho_id: id,
      p_item_id: servicio.id,
      p_fecha: fechaElegida,
      p_hora: horaElegida,
      p_miembro_id: miembroValido,
      p_nombre: nombre.trim(),
      p_telefono: telefono.trim(),
      p_notas: notas.trim(),
    });
    setEnviando(false);
    if (errorRpc || !data) {
      setError(errorRpc?.message || "No se pudo crear la cita. Intentá de nuevo.");
      return;
    }
    const reservaId = data as string;
    // Los avisos los manda la web; la próxima cita sale precargada.
    void pedirCorreosDeCita(reservaId);
    void supabase.auth.updateUser({
      data: { nombre: nombre.trim(), whatsapp: telefono.trim() },
    });
    setExito(reservaId);
  }

  if (cargandoAuth || (session && cargando)) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior kicker="Servicios" titulo="Reservar cita" />
        <View style={styles.centrado}>
          <Vacio
            icono="lock-closed-outline"
            titulo="Iniciá sesión para reservar"
            texto="Tu cita queda ligada a tu cuenta: ahí ves el comprobante, el chat con el negocio y tu historial — y tus datos llegan precargados."
          />
          <View style={styles.botonesEstado}>
            <Boton texto="Iniciar sesión" tono="navy" onPress={() => router.push("/cuenta")} />
            <Boton texto="Volver" tono="contorno" onPress={() => router.back()} />
          </View>
        </View>
      </View>
    );
  }

  if (!nombreNegocio) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior kicker="Servicios" titulo="Reservar cita" />
        <View style={styles.centrado}>
          <Vacio
            icono="close-circle-outline"
            titulo="Este negocio ya no está disponible"
            texto="Puede que haya cerrado su agenda. Mirá el resto del directorio."
            accion={{ texto: "Ver otros negocios", onPress: () => router.replace("/citas" as never) }}
          />
        </View>
      </View>
    );
  }

  // ---------- Cita confirmada ----------
  if (exito) {
    const dEx = diaElegido;
    return (
      <View style={styles.contenedor}>
        <BarraSuperior kicker="Servicios" titulo="Cita confirmada" contexto={nombreNegocio} />
        <ScrollView contentContainerStyle={styles.contenido}>
          <Tarjeta style={styles.tarjetaExito}>
            <View style={styles.exitoCheck}>
              <Ionicons name="checkmark" size={28} color={Colors.green} />
            </View>
            <Text style={styles.exitoTitulo}>¡Tu cita quedó confirmada!</Text>
            <Text style={styles.exitoTexto}>
              Te mandamos el comprobante por correo. El pago es en el local.
            </Text>

            <View style={styles.exitoResumen}>
              <FilaResumen etiqueta="Servicio" valor={servicio?.nombre ?? "—"} />
              <FilaResumen etiqueta="Negocio" valor={nombreNegocio} />
              <FilaResumen
                etiqueta="Cuándo"
                valor={`${dEx ? `${DIAS_CORTO[dEx.dow]} ${dEx.dia} de ${MESES_CORTO[dEx.mes]} · ` : ""}${horaBonita(hora)}`}
              />
            </View>
          </Tarjeta>

          <BarraConfirmacion
            tono="verde"
            titulo="Cita confirmada"
            nota="Se le avisó al negocio"
          />

          <View style={{ gap: Spacing.two }}>
            <Boton
              texto="Abrir el chat del negocio"
              tono="navy"
              icono="chatbubble-outline"
              onPress={() => router.replace(`/mensajes/${exito}` as never)}
            />
            <Boton texto="Volver al negocio" tono="contorno" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const horaFin = horaElegida ? sumarMinutosHora(horaElegida, duracion) : null;
  const puedeContinuar = !!servicio && !!fechaElegida && !!horaElegida;

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        kicker="Servicios"
        titulo={paso === "hora" ? "Elegí fecha y hora" : "Confirmá tu cita"}
        contexto={nombreNegocio}
        onVolver={paso === "confirmar" ? () => setPaso("hora") : undefined}
      />

      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        {/* La identidad del negocio arriba de todo, como en el mockup. */}
        <Tarjeta style={styles.identidadTarjeta}>
          <Identidad
            nombre={nombreNegocio}
            meta={["Servicios", diaElegido ? `${DIAS_CORTO[diaElegido.dow]} ${diaElegido.dia} de ${MESES_CORTO[diaElegido.mes]}` : null]}
            derecha={
              fotoNegocio ? (
                <Image
                  source={{ uri: fotoNegocio }}
                  alt={nombreNegocio}
                  style={styles.fotoMini}
                  contentFit="cover"
                />
              ) : undefined
            }
          />
        </Tarjeta>

        {paso === "hora" ? (
          <>
            {/* ---------- Servicio ---------- */}
            <View style={styles.bloque}>
              <Micro tono="navy">Elegí tu servicio</Micro>
              <View style={styles.opciones}>
                {items.map((s) => (
                  <Opcion
                    key={s.id}
                    titulo={s.nombre}
                    detalle={etiquetaMinutos(s.duracion_minutos ?? 30)}
                    derecha={fmtColones(s.precio) ?? "Consultar"}
                    seleccionada={s.id === servicioId}
                    onPress={() => setServicioId(s.id)}
                  />
                ))}
              </View>
            </View>

            {/* ---------- ¿Con quién? — solo quienes dan este servicio ---------- */}
            {equipoDelServicio.length > 0 && (
              <View style={styles.bloque}>
                <Micro tono="navy">¿Con quién?</Micro>
                <View style={styles.opciones}>
                  <Opcion
                    titulo="Cualquiera"
                    detalle="La primera persona disponible"
                    seleccionada={miembroValido === null}
                    onPress={() => setMiembroId(null)}
                  />
                  {equipoDelServicio.map((m) => (
                    <Opcion
                      key={m.id}
                      titulo={m.nombre}
                      seleccionada={miembroValido === m.id}
                      onPress={() => setMiembroId(m.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* ---------- Fecha ---------- */}
            <View style={styles.bloque}>
              <Micro tono="navy">Elegí la fecha</Micro>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.diasFila}
              >
                {dias.map((d) => {
                  const elegido = d.iso === fechaElegida;
                  return (
                    <Pressable
                      key={d.iso}
                      accessibilityRole="button"
                      accessibilityState={{ selected: elegido, disabled: !d.abierto }}
                      disabled={!d.abierto}
                      onPress={() => setFecha(d.iso)}
                      style={[
                        styles.dia,
                        elegido && styles.diaActivo,
                        !d.abierto && styles.diaCerrado,
                      ]}
                    >
                      <Text style={[styles.diaDow, elegido && styles.diaTextoActivo]}>
                        {DIAS_CORTO[d.dow]}
                      </Text>
                      <Text
                        style={[
                          styles.diaNumero,
                          elegido && styles.diaTextoActivo,
                          !d.abierto && styles.diaTextoCerrado,
                        ]}
                      >
                        {d.dia}
                      </Text>
                      <Text style={[styles.diaMes, elegido && styles.diaTextoActivo]}>
                        {MESES_CORTO[d.mes]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* ---------- Hora ---------- */}
            <View style={styles.bloque}>
              <Micro tono="navy">Elegí la hora</Micro>
              {horas.length === 0 ? (
                <Aviso
                  tono="atencion"
                  icono="calendar-outline"
                  texto={
                    sinNadieQueAtienda
                      ? "Nadie está atendiendo este servicio por ahora — elegí otro o consultale al negocio."
                      : !fechaElegida
                        ? "Este negocio no tiene días de atención abiertos por ahora — consultale por el chat."
                        : `No quedan espacios libres ese día — probá con otra fecha${equipoDelServicio.length > 0 ? " u otra persona" : ""}.`
                  }
                />
              ) : (
                <RejillaHoras>
                  {horas.map((h) => (
                    <Casilla
                      key={h}
                      texto={horaBonita(h)}
                      seleccionada={h === horaElegida}
                      onPress={() => setHora(h)}
                    />
                  ))}
                </RejillaHoras>
              )}
            </View>

            {/* El botón principal, en el navy de Servicios — como el
                "Reservar" del diseño de referencia. */}
            <Boton
              texto="Reservar"
              tono="navy"
              deshabilitado={!puedeContinuar}
              onPress={() => setPaso("confirmar")}
            />
          </>
        ) : (
          <>
            {/* ---------- Resumen de lo elegido ---------- */}
            <View style={styles.bloque}>
              <Micro tono="navy">Tu cita</Micro>
              <Tarjeta style={styles.resumen}>
                <FilaResumen etiqueta="Servicio" valor={servicio?.nombre ?? "—"} />
                <FilaResumen
                  etiqueta="Fecha"
                  valor={
                    diaElegido
                      ? `${DIAS_CORTO[diaElegido.dow]} ${diaElegido.dia} de ${MESES_CORTO[diaElegido.mes]}`
                      : "—"
                  }
                />
                {horaElegida && horaFin && (
                  <FilaResumen
                    etiqueta="Hora"
                    valor={`${horaBonita(horaElegida)} – ${horaBonita(horaFin)} (${etiquetaMinutos(duracion)})`}
                  />
                )}
                <FilaResumen
                  etiqueta="Total"
                  valor={(servicio ? fmtColones(servicio.precio) : null) ?? "A consultar"}
                  fuerte
                />
              </Tarjeta>
            </View>

            {/* ---------- Datos de contacto ---------- */}
            <View style={styles.bloque}>
              <Micro tono="navy">Tus datos</Micro>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Tu nombre"
                placeholderTextColor="#98a0b0"
                style={styles.campo}
              />
              <TextInput
                value={telefono}
                onChangeText={setTelefono}
                placeholder="Tu teléfono (opcional)"
                placeholderTextColor="#98a0b0"
                keyboardType="phone-pad"
                style={styles.campo}
              />
              <TextInput
                value={notas}
                onChangeText={setNotas}
                placeholder="¿Algo que el negocio deba saber? (opcional)"
                placeholderTextColor="#98a0b0"
                multiline
                style={[styles.campo, styles.campoLargo]}
              />
            </View>

            {error && <Aviso tono="error" texto={error} />}
          </>
        )}
      </ScrollView>

      {/* Barra de resumen y avance, pegada abajo. */}
      <BarraAccion
        paddingBottom={Math.max(insets.bottom, 12)}
        total={servicio ? (fmtColones(servicio.precio) ?? "A consultar") : undefined}
        nota={
          horaElegida && diaElegido
            ? `${DIAS_CORTO[diaElegido.dow]} ${diaElegido.dia} · ${horaBonita(horaElegida)} — pago en el local`
            : "Elegí fecha y hora"
        }
      >
        {paso === "hora" ? (
          <Boton
            compacto
            texto="Continuar"
            icono="arrow-forward"
            tono="navy"
            deshabilitado={!puedeContinuar}
            onPress={() => setPaso("confirmar")}
          />
        ) : (
          <Boton
            compacto
            tono="navy"
            texto="Confirmar cita"
            cargando={enviando}
            deshabilitado={!puedeContinuar || !nombre.trim()}
            onPress={confirmar}
          />
        )}
      </BarraAccion>
    </View>
  );
}

/** Una línea del resumen: etiqueta gris a la izquierda, dato a la derecha. */
function FilaResumen({
  etiqueta,
  valor,
  fuerte = false,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <View style={styles.filaResumen}>
      <Text style={styles.filaResumenEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.filaResumenValor, fuerte && styles.filaResumenFuerte]} numberOfLines={2}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  centro: {
    alignItems: "center",
    backgroundColor: Colors.canvas,
    flex: 1,
    justifyContent: "center",
  },
  centrado: { flex: 1, justifyContent: "center", paddingHorizontal: Spacing.three },
  botonesEstado: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  contenido: { gap: Spacing.four, padding: Spacing.three, paddingBottom: Spacing.five },

  identidadTarjeta: { padding: Spacing.three },
  fotoMini: { borderRadius: Radios.sm, height: 44, width: 44 },

  bloque: { gap: Spacing.two + 2 },
  opciones: { gap: 6 },

  diasFila: { gap: Spacing.two, paddingRight: Spacing.three },
  dia: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 10,
    width: 58,
  },
  diaActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  diaCerrado: { backgroundColor: "#fafbfc", borderColor: "#eef0f5" },
  diaDow: { color: Colors.inkMuted, fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" },
  diaNumero: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 17, marginVertical: 1 },
  diaMes: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 9.5, textTransform: "uppercase" },
  diaTextoActivo: { color: "#ffffff" },
  diaTextoCerrado: { color: "#c3c8d2" },

  resumen: { gap: 10, padding: Spacing.three },
  filaResumen: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.three,
    justifyContent: "space-between",
  },
  filaResumenEtiqueta: { color: Colors.inkMuted, fontFamily: Fonts.bold, fontSize: 12 },
  filaResumenValor: {
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 13.5,
    textAlign: "right",
  },
  filaResumenFuerte: { fontFamily: Fonts.extraBold, fontSize: 15 },

  campo: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  campoLargo: { height: 88, textAlignVertical: "top" },

  tarjetaExito: { alignItems: "center", padding: Spacing.four },
  exitoCheck: {
    alignItems: "center",
    backgroundColor: Colors.greenLight,
    borderRadius: Radios.full,
    height: 58,
    justifyContent: "center",
    marginBottom: Spacing.three,
    width: 58,
  },
  exitoTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 19,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  exitoTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
  exitoResumen: {
    alignSelf: "stretch",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    gap: 10,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
  },
});
