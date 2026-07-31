import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import {
  Aviso,
  AvisoAgenda,
  Boton,
  Estado,
  FilaHora,
  Micro,
  Tarjeta,
  Vacio,
  type TonoEstado,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";
import {
  DIAS_CORTO,
  DIAS_SEMANA_LABEL,
  MESES_CORTO,
  fechaISOLocal,
  horaAMinutos,
  horarioDeDetalles,
  sumarMinutosHora,
  type HorarioSemana,
} from "@/lib/citas";

/**
 * La agenda del día de un negocio de citas (uñas, barbería, spa...):
 * las citas hora por hora según el horario semanal del negocio, con la
 * acción clave del mostrador — marcar si el cliente llegó o no — y el
 * botón para suscribir la agenda en Google/Apple Calendar. Espejo de
 * la agenda del panel web (/mi-rancho/[id]/citas); las políticas RLS
 * limitan la lectura y la edición al dueño del negocio.
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
};

/** Una cita con hora ya garantizada (lo que va en la línea de tiempo). */
type CitaAgenda = ReservaAgenda & { hora_inicio: string };

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
  const [filas, setFilas] = useState<ReservaAgenda[] | null>(null);
  const [cargandoDia, setCargandoDia] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

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
    const [ranchoRes, reservasRes] = await Promise.all([
      supabase.from("ranchos").select("nombre, detalles").eq("id", id).maybeSingle(),
      supabase
        .from("reservas")
        .select(
          "id, fecha, nombre, tipo_evento, estado, hora_inicio, duracion_minutos, horario_bloque, monto_total, notas",
        )
        .eq("rancho_id", id)
        .eq("fecha", consultada)
        .not("estado", "in", "(temporal,rechazada)")
        .order("hora_inicio", { ascending: true, nullsFirst: true }),
    ]);
    if (ultimaFecha.current !== consultada) return;
    const rancho = ranchoRes.data as { nombre: string; detalles: unknown } | null;
    setNombreNegocio(rancho?.nombre ?? null);
    setHorario(horarioDeDetalles(rancho?.detalles ?? null));
    setFilas((reservasRes.data ?? []) as ReservaAgenda[]);
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

  const horas: number[] = [];
  for (let h = Math.floor(inicioMin / 60); h < Math.ceil(finMin / 60); h++) horas.push(h);

  const porHora = new Map<number, CitaAgenda[]>();
  for (const c of citas) {
    const h = Math.floor(horaAMinutos(c.hora_inicio.slice(0, 5)) / 60);
    porHora.set(h, [...(porHora.get(h) ?? []), c]);
  }

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

          {cerrado && citas.length === 0 ? (
            <Vacio
              icono="moon-outline"
              titulo="Cerrado este día"
              texto="Si querés atender, ajustá tu horario en el panel de citas."
            />
          ) : (
            <View style={styles.seccion}>
              <Micro>La línea del día</Micro>
              {cerrado && (
                <Aviso
                  tono="atencion"
                  texto="Según tu horario este día está cerrado, pero tenés citas agendadas."
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
                              onMarcar={confirmarAsistencia}
                            />
                          ))
                        : undefined}
                    </FilaHora>
                  );
                })}
              </Tarjeta>
            </View>
          )}

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
 * mostrador (llegó / no llegó) solo cuando corresponde.
 */
function TarjetaCita({
  cita,
  ocupada,
  onMarcar,
}: {
  cita: CitaAgenda;
  ocupada: boolean;
  onMarcar: (cita: CitaAgenda, asistencia: "cumplida" | "no_asistio") => void;
}) {
  const inicio = cita.hora_inicio.slice(0, 5);
  const fin = sumarMinutosHora(inicio, cita.duracion_minutos ?? 30);
  const marcable = MARCABLES.includes(cita.estado);
  const monto = cita.monto_total !== null ? fmtColones(cita.monto_total) : null;
  // La cita confirmada es la que manda: sale en blanco con la barra
  // navy. Las demás quedan en gris, un escalón atrás.
  const destacada = cita.estado === "confirmada";

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
    backgroundColor: Colors.accent,
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
  filaDiaCompleto: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },

  lineaTiempo: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },

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
