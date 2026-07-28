import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import {
  AMENIDAD_LABEL,
  CATEGORIA_LABEL,
  SUBCATEGORIA_LABEL,
  UNIDAD_PRECIO_LABEL,
  etiquetaHorario,
  fmtColones,
  linkGoogleMaps,
  linkWaze,
  terminosPorDefecto,
  type CalificacionRancho,
  type DiaDisponibilidad,
  type Rancho,
  type Resena,
} from "@/lib/types";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookearcr.com";
const DIAS_A_MOSTRAR = 60;
const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function fechaISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function RanchoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const [abriendoChat, setAbriendoChat] = useState(false);
  const { width: anchoPantalla } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [fechasY, setFechasY] = useState(0);
  const [fotoActiva, setFotoActiva] = useState(0);
  const [rancho, setRancho] = useState<Rancho | null>(null);
  const [disponibilidad, setDisponibilidad] = useState<Record<string, DiaDisponibilidad>>({});
  const [calificacion, setCalificacion] = useState<CalificacionRancho | null>(null);
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from("ranchos")
      .select("*")
      .eq("id", id)
      .eq("estado", "aprobado")
      .maybeSingle();

    if (error || !data) {
      setError("No encontramos esta publicación.");
      return;
    }
    const fila = data as Rancho;
    setRancho(fila);
    navigation.setOptions({ title: fila.nombre });

    // Calificación y reseñas reales — mismas fuentes que el portal web.
    const [{ data: califData }, { data: resenasData }] = await Promise.all([
      supabase
        .from("calificaciones_rancho")
        .select("rancho_id, promedio, total")
        .eq("rancho_id", fila.id)
        .maybeSingle(),
      supabase
        .from("resenas")
        .select("id, rancho_id, cliente_id, reserva_id, calificacion, comentario, created_at")
        .eq("rancho_id", fila.id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);
    setCalificacion((califData as CalificacionRancho | null) ?? null);
    setResenas((resenasData ?? []) as Resena[]);

    if (fila.categoria !== "lugares") return;

    // Limpia holds vencidos antes de leer, igual que /web, para no
    // mostrar como ocupada una fecha que ya se liberó sola.
    await supabase
      .from("reservas")
      .delete()
      .eq("rancho_id", fila.id)
      .eq("estado", "temporal")
      .lt("expira_en", new Date().toISOString());

    const { data: dispData } = await supabase
      .from("disponibilidad_rancho")
      .select("fecha, estado")
      .eq("rancho_id", fila.id);

    const acc: Record<string, DiaDisponibilidad> = {};
    (dispData ?? []).forEach((r) => {
      const dia = acc[r.fecha] ?? { confirmada: false, pendientes: 0, temporales: 0 };
      if (r.estado === "confirmada") dia.confirmada = true;
      else if (r.estado === "temporal") dia.temporales += 1;
      else dia.pendientes += 1;
      acc[r.fecha] = dia;
    });
    setDisponibilidad(acc);
  }, [id, navigation]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  const proximosDias = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Array.from({ length: DIAS_A_MOSTRAR }, (_, i) => {
      const d = new Date(hoy);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  if (error) {
    return (
      <View style={styles.centro}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!rancho) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const esLugar = rancho.categoria === "lugares";
  const ubicacion = [rancho.provincia, rancho.direccion_exacta || rancho.canton]
    .filter(Boolean)
    .join(", ");
  const precio = fmtColones(rancho.precio_desde);

  // La foto de presentación (o la de portada) primero, y la galería la
  // completa sin repetirla — igual que el hero del portal web.
  const fotoDestacada = rancho.foto_presentacion ?? rancho.foto_url;
  const fotosCarrusel = fotoDestacada
    ? [fotoDestacada, ...(rancho.fotos ?? []).filter((f) => f !== fotoDestacada)]
    : (rancho.fotos ?? []);

  const direccionBusqueda = [rancho.nombre, rancho.direccion_exacta, rancho.canton, rancho.provincia, "Costa Rica"]
    .filter(Boolean)
    .join(", ");
  const mapsHref = linkGoogleMaps(rancho.latitud, rancho.longitud, direccionBusqueda);
  const wazeHref = linkWaze(rancho.latitud, rancho.longitud, direccionBusqueda);

  const terminos =
    rancho.terminos && rancho.terminos.length > 0
      ? rancho.terminos
      : terminosPorDefecto(rancho.deposito_reserva ?? 25000, rancho.monto_minimo);

  // Abre (o retoma) el hilo de consulta con este negocio — el mismo
  // mecanismo que /mensajes/consulta/[ranchoId] en la web.
  async function preguntarPorChat() {
    if (!rancho) return;
    if (!session) {
      router.push("/cuenta");
      return;
    }
    setAbriendoChat(true);
    const { data: existente } = await supabase
      .from("conversaciones")
      .select("id")
      .eq("rancho_id", rancho.id)
      .eq("cliente_id", session.user.id)
      .is("reserva_id", null)
      .maybeSingle();

    let convId = existente?.id ?? null;
    if (!convId) {
      const { data: creada } = await supabase
        .from("conversaciones")
        .insert({ rancho_id: rancho.id })
        .select("id")
        .maybeSingle();
      convId = creada?.id ?? null;
      if (!convId) {
        // Carrera con otra pestaña/dispositivo: el hilo ya existe.
        const { data: reintento } = await supabase
          .from("conversaciones")
          .select("id")
          .eq("rancho_id", rancho.id)
          .eq("cliente_id", session.user.id)
          .is("reserva_id", null)
          .maybeSingle();
        convId = reintento?.id ?? null;
      }
    }
    setAbriendoChat(false);
    if (convId) {
      router.push(`/mensajes/hilo/${convId}` as never);
    }
  }

  return (
    <View style={styles.raiz}>
      <ScrollView
        ref={scrollRef}
        style={styles.contenedor}
        contentContainerStyle={{ paddingBottom: esLugar ? 110 : Spacing.six }}
      >
        {/* ---------- Carrusel de fotos ---------- */}
        {fotosCarrusel.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setFotoActiva(Math.round(e.nativeEvent.contentOffset.x / anchoPantalla))
              }
            >
              {fotosCarrusel.map((f) => (
                <Image
                  key={f}
                  source={{ uri: f }}
                  style={{ width: anchoPantalla, height: 280, backgroundColor: Colors.cream2 }}
                  contentFit="cover"
                  alt={rancho.nombre}
                />
              ))}
            </ScrollView>
            {fotosCarrusel.length > 1 && (
              <View style={styles.contadorFotos}>
                <Text style={styles.contadorFotosTexto}>
                  {fotoActiva + 1} / {fotosCarrusel.length}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.portadaVacia, { width: anchoPantalla }]} />
        )}

        {/* ---------- Título + línea de confianza ---------- */}
        <View style={styles.seccion}>
          <Text style={styles.etiqueta}>
            {rancho.subcategoria
              ? (SUBCATEGORIA_LABEL[rancho.subcategoria] ?? CATEGORIA_LABEL[rancho.categoria])
              : CATEGORIA_LABEL[rancho.categoria]}
          </Text>
          <Text style={styles.titulo}>{rancho.nombre}</Text>
          <Text style={styles.lineaConfianza}>
            {calificacion
              ? `★ ${calificacion.promedio.toFixed(2).replace(".", ",")} · ${calificacion.total} reseña${calificacion.total === 1 ? "" : "s"}`
              : null}
            {calificacion && (esLugar || ubicacion) ? "  ·  " : ""}
            {esLugar && (rancho.capacidad_min || rancho.capacidad_max)
              ? `${rancho.capacidad_min ?? "?"}–${rancho.capacidad_max ?? "?"} personas  ·  `
              : ""}
            {ubicacion}
          </Text>
        </View>

        {/* ---------- Sobre este lugar ---------- */}
        {(rancho.descripcion_larga || rancho.descripcion) && (
          <View style={styles.seccion}>
            <Text style={styles.bloqueTitulo}>
              {esLugar ? "Sobre este lugar" : "Sobre este servicio"}
            </Text>
            <Text style={styles.descripcion}>
              {rancho.descripcion_larga || rancho.descripcion}
            </Text>
          </View>
        )}

        {/* ---------- Horarios de alquiler ---------- */}
        {esLugar && (rancho.horarios_bloques ?? []).length > 0 && (
          <View style={styles.seccion}>
            <Text style={styles.bloqueTitulo}>Horarios de alquiler</Text>
            <View style={styles.chips}>
              {(rancho.horarios_bloques ?? []).map((h) => (
                <View key={h.id} style={styles.chipBorde}>
                  <Text style={styles.chipTexto}>{etiquetaHorario(h)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ---------- Disponibilidad (lógica intacta) ---------- */}
        {esLugar && (
          <View style={styles.seccion} onLayout={(e) => setFechasY(e.nativeEvent.layout.y)}>
            <Text style={styles.bloqueTitulo}>Reservá tu fecha</Text>
            <Text style={styles.hint}>Elegí un día libre para empezar tu reserva.</Text>
            <View style={styles.diasGrid}>
              {proximosDias.map((d) => {
                const iso = fechaISO(d);
                const info = disponibilidad[iso];
                const bloqueado = !!info?.confirmada;
                return (
                  <Pressable
                    key={iso}
                    disabled={bloqueado}
                    onPress={() =>
                      router.push({
                        pathname: "/rancho/[id]/reservar",
                        params: { id: rancho.id, fecha: iso },
                      })
                    }
                    style={[
                      styles.diaCelda,
                      bloqueado && styles.diaBloqueado,
                      !bloqueado && !!info?.pendientes && styles.diaPendiente,
                    ]}
                  >
                    <Text style={styles.diaSemana}>{DIAS_SEMANA[d.getDay()]}</Text>
                    <Text style={[styles.diaNumero, bloqueado && styles.diaNumeroBloqueado]}>
                      {d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.leyenda}>
              <View style={styles.leyendaItem}>
                <View style={[styles.leyendaPunto, { backgroundColor: Colors.surface, borderColor: Colors.line, borderWidth: 1 }]} />
                <Text style={styles.leyendaTexto}>Libre</Text>
              </View>
              <View style={styles.leyendaItem}>
                <View style={[styles.leyendaPunto, { backgroundColor: Colors.accentLight }]} />
                <Text style={styles.leyendaTexto}>Con solicitudes</Text>
              </View>
              <View style={styles.leyendaItem}>
                <View style={[styles.leyendaPunto, { backgroundColor: Colors.line }]} />
                <Text style={styles.leyendaTexto}>Ocupado</Text>
              </View>
            </View>
          </View>
        )}

        {/* ---------- Reservar (servicios): el flujo completo vive en la
             web — se abre el portal con el catálogo y el calendario. ---------- */}
        {!esLugar && (
          <View style={styles.seccion}>
            <Pressable
              style={styles.botonPrimario}
              onPress={() =>
                WebBrowser.openBrowserAsync(`${SITIO_URL}/ranchos-eventos/${rancho.id}#reservar`)
              }
            >
              <Text style={styles.botonPrimarioTexto}>Reservar fecha y armar pedido</Text>
            </Pressable>
            <Text style={styles.hint}>
              Elegís la fecha, armás tu pedido y el proveedor te confirma por el
              chat de Bookear CR.
            </Text>
          </View>
        )}

        {/* ---------- Dudas antes de reservar: chat de consulta ---------- */}
        <View style={styles.seccion}>
          <Pressable
            style={[styles.botonChat, abriendoChat && { opacity: 0.6 }]}
            disabled={abriendoChat}
            onPress={preguntarPorChat}
          >
            <Text style={styles.botonChatTexto}>
              {abriendoChat ? "Abriendo chat..." : "¿Tenés dudas? Preguntá por el chat"}
            </Text>
          </Pressable>
        </View>

        {/* ---------- Amenidades ---------- */}
        {rancho.amenidades.length > 0 && (
          <View style={styles.seccion}>
            <Text style={styles.bloqueTitulo}>
              {esLugar ? "Amenidades del lugar" : "Qué incluye"}
            </Text>
            <View style={styles.chips}>
              {rancho.amenidades.map((a) => (
                <View key={a} style={styles.chip}>
                  <Text style={styles.chipTexto}>✓ {AMENIDAD_LABEL[a] ?? a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ---------- Lo que debés saber ---------- */}
        {esLugar && (
          <View style={styles.seccion}>
            <Text style={styles.bloqueTitulo}>Lo que debés saber</Text>
            <View style={{ gap: Spacing.two }}>
              {terminos.map((t, i) => (
                <View key={i} style={styles.terminoFila}>
                  <Text style={styles.terminoCheck}>✓</Text>
                  <Text style={styles.terminoTexto}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ---------- Reseñas ---------- */}
        {resenas.length > 0 && (
          <View style={styles.seccion}>
            <Text style={styles.bloqueTitulo}>
              ★ {calificacion ? calificacion.promedio.toFixed(2).replace(".", ",") : "—"} ·{" "}
              {calificacion?.total ?? resenas.length} reseña
              {(calificacion?.total ?? resenas.length) === 1 ? "" : "s"}
            </Text>
            <View style={{ gap: Spacing.two }}>
              {resenas.map((r) => (
                <View key={r.id} style={styles.resena}>
                  <Text style={styles.resenaEstrellas}>
                    {"★".repeat(r.calificacion)}
                    <Text style={{ color: Colors.line }}>{"★".repeat(5 - r.calificacion)}</Text>
                  </Text>
                  {r.comentario ? (
                    <Text style={styles.resenaComentario}>{r.comentario}</Text>
                  ) : null}
                  <Text style={styles.resenaMeta}>
                    Cliente verificado ·{" "}
                    {new Date(r.created_at).toLocaleDateString("es-CR", {
                      timeZone: "America/Costa_Rica",
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ---------- Ubicación ---------- */}
        {esLugar && (mapsHref || wazeHref) && (
          <View style={styles.seccion}>
            <Text style={styles.bloqueTitulo}>A dónde vas</Text>
            {ubicacion ? <Text style={styles.hint}>{ubicacion}</Text> : null}
            <View style={styles.chips}>
              {mapsHref && (
                <Pressable style={styles.botonSecundario} onPress={() => Linking.openURL(mapsHref)}>
                  <Text style={styles.botonSecundarioTexto}>Cómo llegar (Google Maps)</Text>
                </Pressable>
              )}
              {wazeHref && (
                <Pressable style={styles.botonSecundario} onPress={() => Linking.openURL(wazeHref)}>
                  <Text style={styles.botonSecundarioTexto}>Abrir en Waze</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ---------- Barra fija de reserva (solo lugares) ---------- */}
      {esLugar && (
        <View style={styles.barraReserva}>
          <View style={{ flex: 1 }}>
            <Text style={styles.barraDesde}>Desde</Text>
            <Text style={styles.barraPrecio}>
              {precio ?? "A consultar"}
              {precio ? (
                <Text style={styles.barraUnidad}> {UNIDAD_PRECIO_LABEL[rancho.unidad_precio]}</Text>
              ) : null}
            </Text>
          </View>
          <Pressable
            style={styles.barraBoton}
            onPress={() => scrollRef.current?.scrollTo({ y: fechasY, animated: true })}
          >
            <Text style={styles.botonPrimarioTexto}>Ver fechas</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colors.cream },
  contenedor: { flex: 1 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five },
  error: { color: Colors.danger, textAlign: "center" },
  portadaVacia: { height: 220, backgroundColor: Colors.cream2 },
  contadorFotos: {
    position: "absolute",
    right: Spacing.three,
    bottom: Spacing.three,
    backgroundColor: "rgba(16,26,44,0.75)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  contadorFotosTexto: { color: "#ffffff", fontSize: 11.5, fontFamily: Fonts.bold },
  seccion: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  etiqueta: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: Colors.accent,
  },
  titulo: { fontSize: 24, fontFamily: Fonts.extraBold, color: Colors.ink },
  lineaConfianza: { fontSize: 13.5, color: Colors.inkSoft, lineHeight: 19 },
  bloqueTitulo: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink },
  descripcion: { fontSize: 14, color: Colors.inkSoft, lineHeight: 21 },
  hint: { fontSize: 13, color: Colors.inkSoft },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    backgroundColor: Colors.cream2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipBorde: {
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 10,
  },
  chipTexto: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.ink },
  terminoFila: { flexDirection: "row", gap: Spacing.two, alignItems: "flex-start" },
  terminoCheck: { color: Colors.green, fontFamily: Fonts.bold, fontSize: 13, marginTop: 1 },
  terminoTexto: { flex: 1, fontSize: 13, color: Colors.inkSoft, lineHeight: 19 },
  resena: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 14,
    padding: Spacing.three,
    gap: 6,
  },
  resenaEstrellas: { fontSize: 14, color: Colors.ink },
  resenaComentario: { fontSize: 13.5, color: Colors.ink, lineHeight: 20 },
  resenaMeta: { fontSize: 11.5, color: Colors.inkSoft },
  diasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  diaCelda: {
    width: 42,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  diaPendiente: { backgroundColor: Colors.accentLight },
  diaBloqueado: { backgroundColor: Colors.line, opacity: 0.6 },
  diaSemana: { fontSize: 9, color: Colors.inkSoft, fontFamily: Fonts.bold },
  diaNumero: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.ink },
  diaNumeroBloqueado: { color: Colors.inkSoft },
  leyenda: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three, marginTop: Spacing.two },
  leyendaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  leyendaPunto: { width: 12, height: 12, borderRadius: 4 },
  leyendaTexto: { fontSize: 12, color: Colors.inkSoft },
  botonPrimario: {
    backgroundColor: Colors.navy,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  botonPrimarioTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 14.5 },
  botonSecundario: {
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  botonSecundarioTexto: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.ink },
  botonChat: {
    borderWidth: 1.5,
    borderColor: Colors.navy,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  botonChatTexto: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.navy },
  barraReserva: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    paddingBottom: Spacing.four,
  },
  barraDesde: { fontSize: 11, color: Colors.inkSoft },
  barraPrecio: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink },
  barraUnidad: { fontSize: 11.5, fontFamily: Fonts.medium, color: Colors.inkSoft },
  barraBoton: {
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingHorizontal: Spacing.five,
    paddingVertical: 12,
  },
});
