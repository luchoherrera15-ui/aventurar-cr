import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { abrirHiloConsulta } from "@/lib/consulta";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import CalendarioMensual from "@/components/calendario-mensual";
import SeccionEncabezado from "@/components/seccion-encabezado";
import { BotonFlotante, FilaFlotante } from "@/components/boton-flotante";
import {
  AMENIDADES,
  AMENIDADES_GRUPOS,
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
  type PromocionDia,
  type Rancho,
  type Resena,
} from "@/lib/types";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

export default function RanchoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [abriendoChat, setAbriendoChat] = useState(false);
  const { width: anchoPantalla } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  // El calendario vive en un modal con velo, como el #reservar de la web.
  const [modalFechas, setModalFechas] = useState(false);
  const [fotoActiva, setFotoActiva] = useState(0);
  const [rancho, setRancho] = useState<Rancho | null>(null);
  const [disponibilidad, setDisponibilidad] = useState<Record<string, DiaDisponibilidad>>({});
  const [promociones, setPromociones] = useState<PromocionDia[]>([]);
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

    const [{ data: dispData }, { data: promoData }] = await Promise.all([
      supabase
        .from("disponibilidad_rancho")
        .select("fecha, estado")
        .eq("rancho_id", fila.id),
      supabase
        .from("promociones_dia")
        .select("*")
        .eq("rancho_id", fila.id)
        .eq("activo", true),
    ]);
    setPromociones((promoData ?? []) as PromocionDia[]);

    const acc: Record<string, DiaDisponibilidad> = {};
    (dispData ?? []).forEach((r) => {
      const dia = acc[r.fecha] ?? { confirmada: false, pendientes: 0, temporales: 0 };
      if (r.estado === "confirmada") dia.confirmada = true;
      else if (r.estado === "temporal") dia.temporales += 1;
      else dia.pendientes += 1;
      acc[r.fecha] = dia;
    });
    setDisponibilidad(acc);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

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
    const convId = await abrirHiloConsulta(rancho.id, session.user.id);
    setAbriendoChat(false);
    if (convId) {
      router.push(`/mensajes/hilo/${convId}` as never);
    }
  }

  return (
    <View style={styles.raiz}>
      {/* Navegación flotante sobre la foto: sin barra sólida que le
          robe pantalla a la imagen. */}
      <FilaFlotante
        derecha={
          <BotonFlotante
            icono="share-outline"
            etiqueta="Compartir"
            onPress={() =>
              Share.share({
                message: `Mirá ${rancho.nombre} en Bookea: ${SITIO_URL}/${rancho.slug ?? `ranchos-eventos/${rancho.id}`}`,
              })
            }
          />
        }
      >
        <BotonFlotante icono="chevron-back" etiqueta="Volver" />
      </FilaFlotante>

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
            <SeccionEncabezado
              kicker="Conocelo"
              titulo={esLugar ? "Sobre este lugar" : "Sobre este servicio"}
            />
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

        {/* ---------- Reservar: tarjeta de precio + depósito, y el
             calendario se abre en un modal con velo — igual que la
             tarjeta sticky y el #reservar del portal web. ---------- */}
        {esLugar && (
          <View style={styles.seccion}>
            <SeccionEncabezado kicker="Disponibilidad" titulo="Reservá tu fecha" />
            <View style={styles.tarjetaReserva}>
              <Text style={styles.tarjetaReservaPrecio}>
                {precio ? `Desde ${precio}` : "Precio a consultar"}
                {precio ? (
                  <Text style={styles.tarjetaReservaUnidad}>
                    {" "}
                    {UNIDAD_PRECIO_LABEL[rancho.unidad_precio]}
                  </Text>
                ) : null}
              </Text>
              {(rancho.capacidad_min || rancho.capacidad_max) && (
                <Text style={styles.tarjetaReservaDato}>
                  {rancho.capacidad_min ?? "?"}–{rancho.capacidad_max ?? "?"} personas
                </Text>
              )}
              <Text style={styles.tarjetaReservaDato}>
                Depósito para reservar: {fmtColones(rancho.deposito_reserva ?? 25000)}
              </Text>
              <Text style={styles.tarjetaReservaDato}>Confirmación del dueño en el día</Text>
              <Pressable style={styles.botonVerFechas} onPress={() => setModalFechas(true)}>
                <Text style={styles.botonPrimarioTexto}>Ver fechas disponibles</Text>
              </Pressable>
              <Text style={styles.tarjetaReservaNota}>
                Todavía no se te cobra nada — elegís la fecha primero.
              </Text>
            </View>
          </View>
        )}

        {/* ---------- Reservar (servicios): flujo nativo — calendario,
             catálogo con inventario por fecha y depósito, igual que /web. ---------- */}
        {!esLugar && (
          <View style={styles.seccion}>
            <Pressable
              style={styles.botonPrimario}
              onPress={() =>
                router.push({
                  pathname: "/rancho/[id]/reservar-servicio" as never,
                  params: { id: rancho.id },
                } as never)
              }
            >
              <Text style={styles.botonPrimarioTexto}>Reservar fecha y armar pedido</Text>
            </Pressable>
            <Text style={styles.hint}>
              Elegís la fecha, armás tu reserva con el catálogo y pagás el
              depósito — sin salir de la app.
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

        {/* ---------- Amenidades: agrupadas como en el portal web ---------- */}
        {rancho.amenidades.length > 0 && (
          <View style={styles.seccion}>
            <SeccionEncabezado
              kicker="Lo que incluye"
              titulo={esLugar ? "Amenidades del lugar" : "Qué incluye"}
            />
            <View style={{ gap: Spacing.three, marginTop: Spacing.two }}>
              {AMENIDADES_GRUPOS.map((g) => ({
                titulo: g.titulo,
                items: g.items.filter((i) => rancho.amenidades.includes(i.id)),
              }))
                .filter((g) => g.items.length > 0)
                .concat(
                  // Etiquetas que el dueño escribió a mano (fuera de la
                  // lista predefinida) van en un grupo aparte, como /web.
                  (() => {
                    const extras = rancho.amenidades.filter((a) => !AMENIDADES.includes(a));
                    return extras.length > 0
                      ? [{ titulo: "Otras", items: extras.map((a) => ({ id: a, label: a })) }]
                      : [];
                  })(),
                )
                .map((g) => (
                  <View key={g.titulo} style={styles.grupoAmenidades}>
                    <Text style={styles.grupoTitulo}>{g.titulo}</Text>
                    <View style={{ gap: 8 }}>
                      {g.items.map((i) => (
                        <View key={i.id} style={styles.amenidadFila}>
                          <View style={styles.amenidadCheck}>
                            <Ionicons name="checkmark" size={12} color={Colors.green} />
                          </View>
                          <Text style={styles.amenidadTexto}>{i.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* ---------- Lo que debés saber ---------- */}
        {esLugar && (
          <View style={styles.seccion}>
            <SeccionEncabezado kicker="Condiciones" titulo="Lo que debés saber" />
            <View style={{ gap: Spacing.two }}>
              {terminos.map((t, i) => (
                <View key={i} style={styles.terminoFila}>
                  <View style={styles.amenidadCheck}>
                    <Ionicons name="checkmark" size={12} color={Colors.green} />
                  </View>
                  <Text style={styles.terminoTexto}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ---------- Reseñas ---------- */}
        {resenas.length > 0 && (
          <View style={styles.seccion}>
            <SeccionEncabezado
              kicker="Opiniones"
              titulo={`★ ${calificacion ? calificacion.promedio.toFixed(2).replace(".", ",") : "—"} · ${calificacion?.total ?? resenas.length} reseña${(calificacion?.total ?? resenas.length) === 1 ? "" : "s"}`}
            />
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
            <SeccionEncabezado kicker="Ubicación" titulo="A dónde vas" />
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
          {/* El chat siempre a mano, igual que la burbuja de la web —
              acá vive en la barra fija, que es donde el pulgar lo
              espera en una app. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chateá con ${rancho.nombre}`}
            style={[styles.barraChat, abriendoChat && { opacity: 0.5 }]}
            disabled={abriendoChat}
            onPress={preguntarPorChat}
            hitSlop={6}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={21} color={Colors.navy} />
          </Pressable>
          <Pressable style={styles.barraBoton} onPress={() => setModalFechas(true)}>
            <Text style={styles.botonPrimarioTexto}>Ver fechas</Text>
          </Pressable>
        </View>
      )}

      {/* ---------- Modal del calendario: velo azulado difuminado +
           panel blanco con cabecera, el mismo patrón visual que el
           modal #reservar de la web. ---------- */}
      <Modal
        visible={modalFechas}
        transparent
        animationType="fade"
        onRequestClose={() => setModalFechas(false)}
      >
        <BlurView intensity={28} tint="dark" style={styles.veloModal}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalFechas(false)} />
          <View style={styles.panelModal}>
            <View style={styles.panelModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelModalKicker}>Reservá tu fecha</Text>
                <Text style={styles.panelModalTitulo} numberOfLines={1}>
                  {rancho.nombre}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Cerrar"
                style={styles.panelModalCerrar}
                onPress={() => setModalFechas(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={Colors.ink} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}>
              <CalendarioMensual
                disponibilidad={disponibilidad}
                promociones={promociones}
                onElegir={(fechaIso) => {
                  setModalFechas(false);
                  router.push({
                    pathname: "/rancho/[id]/reservar",
                    params: { id: rancho.id, fecha: fechaIso },
                  });
                }}
              />
              <Text style={styles.hint}>
                Tocá un día disponible para indicar tus invitados, ver el precio
                y reservar la fecha.
              </Text>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
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
  grupoAmenidades: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  grupoTitulo: {
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: Colors.inkSoft,
    marginBottom: 2,
  },
  amenidadFila: { flexDirection: "row", alignItems: "center", gap: 10 },
  amenidadCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  amenidadTexto: { fontSize: 13.5, color: Colors.ink, fontFamily: Fonts.medium, flexShrink: 1 },
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
  barraChat: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    alignItems: "center",
    justifyContent: "center",
  },
  tarjetaReserva: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 20,
    padding: Spacing.four,
    gap: 6,
  },
  tarjetaReservaPrecio: { fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.ink },
  tarjetaReservaUnidad: { fontSize: 12.5, fontFamily: Fonts.medium, color: Colors.inkSoft },
  tarjetaReservaDato: { fontSize: 13, color: Colors.inkSoft },
  botonVerFechas: {
    backgroundColor: Colors.navy,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: Spacing.two,
  },
  tarjetaReservaNota: { fontSize: 12, color: Colors.inkSoft, textAlign: "center" },
  veloModal: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.three,
    backgroundColor: "rgba(10,18,42,0.30)",
  },
  panelModal: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    maxHeight: "92%",
    overflow: "hidden",
    shadowColor: "#060c20",
    shadowOpacity: 0.45,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 24 },
    elevation: 18,
  },
  panelModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  panelModalKicker: {
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: Colors.accent,
  },
  panelModalTitulo: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink },
  panelModalCerrar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cream2,
    alignItems: "center",
    justifyContent: "center",
  },
});
