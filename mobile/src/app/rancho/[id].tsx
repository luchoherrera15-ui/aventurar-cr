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
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import CalendarioMensual from "@/components/calendario-mensual";
import SeccionEncabezado from "@/components/seccion-encabezado";
import TarjetaVisitas from "@/components/tarjeta-visitas";
import { BotonFlotante, FilaFlotante } from "@/components/boton-flotante";
import { Avatar, Boton, Micro, Tarjeta, Vacio } from "@/components/ui";
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
  type Resena,
} from "@/lib/types";
import { COLUMNAS_FICHA, type RanchoPublico } from "@/lib/ranchos-publicos";

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
  const [rancho, setRancho] = useState<RanchoPublico | null>(null);
  const [disponibilidad, setDisponibilidad] = useState<Record<string, DiaDisponibilidad>>({});
  const [promociones, setPromociones] = useState<PromocionDia[]>([]);
  const [calificacion, setCalificacion] = useState<CalificacionRancho | null>(null);
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    // Lista explícita, nunca `*`: esta ficha se la sirve la app a
    // cualquiera sin sesión, y `*` bajaba también el SINPE y la cuenta
    // bancaria del proveedor. Ver lib/ranchos-publicos.ts.
    const { data, error } = await supabase
      .from("ranchos")
      .select(COLUMNAS_FICHA)
      .eq("id", id)
      .eq("estado", "aprobado")
      .maybeSingle();

    if (error || !data) {
      setError("No encontramos esta publicación.");
      return;
    }
    const fila = data as unknown as RanchoPublico;
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
        <Vacio
          icono="close-circle-outline"
          titulo="No encontramos esta publicación"
          texto="Puede que ya no esté disponible."
          accion={{ texto: "Volver", onPress: () => router.back() }}
        />
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
      : // La vertical manda: esta ficha no filtra por vertical, así que
        // un negocio de citas caía en el contrato de eventos (daños a
        // las instalaciones, tipo de evento, invitados) en vez del suyo.
        terminosPorDefecto(
          rancho.deposito_reserva ?? 25000,
          rancho.monto_minimo,
          rancho.vertical ?? "eventos",
        );

  // No tiene sentido chatear con tu propio negocio — mismo check que
  // el fix de `rancho-portal.tsx` en la web (comparar owner_id, nunca
  // un rol de admin: eso ocultaría el chat a un admin en un negocio
  // ajeno, que sí debe poder chatear).
  const esPropioDueno = !!session && session.user.id === rancho.owner_id;

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

        {/* ---------- Identidad del lugar: el mismo encabezado que en
             Servicios y Restaurantes — iniciales, nombre y la línea de
             contexto con nota, capacidad y zona. ---------- */}
        <View style={styles.seccionIdentidad}>
          <Tarjeta style={styles.identidad}>
            <Micro>
              {rancho.subcategoria
                ? (SUBCATEGORIA_LABEL[rancho.subcategoria] ?? CATEGORIA_LABEL[rancho.categoria])
                : CATEGORIA_LABEL[rancho.categoria]}
            </Micro>
            <View style={styles.identidadFila}>
              <Avatar nombre={rancho.nombre} tamano={46} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.titulo} numberOfLines={2}>
                  {rancho.nombre}
                </Text>
                <View style={styles.metaFila}>
                  {calificacion && (
                    <>
                      <Ionicons name="star" size={12} color={Colors.accent} />
                      <Text style={styles.metaFuerte}>
                        {calificacion.promedio.toFixed(1).replace(".", ",")}
                      </Text>
                      <Text style={styles.metaTexto}>({calificacion.total})</Text>
                    </>
                  )}
                  <Text style={styles.metaTexto} numberOfLines={1}>
                    {calificacion ? "· " : ""}
                    {esLugar && (rancho.capacidad_min || rancho.capacidad_max)
                      ? `${rancho.capacidad_min ?? "?"}–${rancho.capacidad_max ?? "?"} personas · `
                      : ""}
                    {ubicacion}
                  </Text>
                </View>
              </View>
            </View>
          </Tarjeta>

          {/* Prueba social real, apenas debajo del encabezado: solo
              aparece si el número da (ver la regla de los 3 en
              lib/visitas.ts). Esta pantalla también sirve a Hospedajes
              y va toda en el acento naranja, así que el punto la sigue. */}
          <TarjetaVisitas ranchoId={rancho.id} vertical="eventos" />
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
            <Micro>Horarios de alquiler</Micro>
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
            <Tarjeta style={styles.tarjetaReserva}>
              <Text style={styles.tarjetaReservaPrecio}>
                {precio ? `Desde ${precio}` : "Precio a consultar"}
                {precio ? (
                  <Text style={styles.tarjetaReservaUnidad}>
                    {" "}
                    {UNIDAD_PRECIO_LABEL[rancho.unidad_precio]}
                  </Text>
                ) : null}
              </Text>
              <View style={styles.tarjetaReservaDatos}>
                {(rancho.capacidad_min || rancho.capacidad_max) && (
                  <FilaDato
                    icono="people-outline"
                    texto={`${rancho.capacidad_min ?? "?"}–${rancho.capacidad_max ?? "?"} personas`}
                  />
                )}
                <FilaDato
                  icono="wallet-outline"
                  texto={`Depósito para reservar: ${fmtColones(rancho.deposito_reserva ?? 25000)}`}
                />
                <FilaDato
                  icono="checkmark-circle-outline"
                  texto="Confirmación del dueño en el día"
                />
              </View>
              <Boton
                texto="Ver fechas disponibles"
                icono="calendar-outline"
                onPress={() => setModalFechas(true)}
                style={{ marginTop: Spacing.three }}
              />
              <Text style={styles.tarjetaReservaNota}>
                Todavía no se te cobra nada — elegís la fecha primero.
              </Text>
            </Tarjeta>
          </View>
        )}

        {/* ---------- Reservar (servicios): flujo nativo — calendario,
             catálogo con inventario por fecha y depósito, igual que /web. ---------- */}
        {!esLugar && (
          <View style={styles.seccion}>
            <Boton
              texto="Reservar fecha y armar pedido"
              icono="calendar-outline"
              onPress={() =>
                router.push({
                  pathname: "/rancho/[id]/reservar-servicio" as never,
                  params: { id: rancho.id },
                } as never)
              }
            />
            <Text style={styles.hint}>
              Elegís la fecha, armás tu reserva con el catálogo y pagás el
              depósito — sin salir de la app.
            </Text>
          </View>
        )}

        {/* ---------- Dudas antes de reservar: chat de consulta ---------- */}
        {!esPropioDueno && (
          <View style={styles.seccion}>
            <Boton
              tono="contorno"
              icono="chatbubble-ellipses-outline"
              texto={abriendoChat ? "Abriendo chat…" : "¿Tenés dudas? Preguntá por el chat"}
              cargando={abriendoChat}
              onPress={preguntarPorChat}
            />
          </View>
        )}

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
                  <Tarjeta key={g.titulo} style={styles.grupoAmenidades}>
                    <Micro>{g.titulo}</Micro>
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
                  </Tarjeta>
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
                <Tarjeta key={r.id} style={styles.resena}>
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
                </Tarjeta>
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

      {/* ---------- El avisito de invitaciones digitales ----------
           APAGADO hasta nuevo aviso (decisión de producto, igual que en
           la web). El componente sigue en components/aviso-invitaciones
           .tsx: para reactivarlo, volver a montarlo acá — va ANTES de la
           barra en el árbol a propósito, para que si alguna vez llegaran
           a solaparse, la barra de reservar pinte encima. ---- */}

      {/* ---------- Barra fija de reserva (solo lugares) ---------- */}
      {esLugar && (
        <View style={styles.barraReserva}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Micro>Desde</Micro>
            <Text style={styles.barraPrecio}>
              {precio ?? "A consultar"}
              {precio ? (
                <Text style={styles.barraUnidad}> {UNIDAD_PRECIO_LABEL[rancho.unidad_precio]}</Text>
              ) : null}
            </Text>
          </View>
          {/* El chat siempre a mano, igual que la burbuja de la web —
              acá vive en la barra fija, que es donde el pulgar lo
              espera en una app. Salvo que sea tu propio negocio: no
              tiene sentido chatear con vos mismo. */}
          {!esPropioDueno && (
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
          )}
          <Boton compacto texto="Ver fechas" onPress={() => setModalFechas(true)} />
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
              <View style={{ flex: 1, minWidth: 0 }}>
                <Micro style={{ color: Colors.accent }}>Reservá tu fecha</Micro>
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

/** Una línea de dato de la tarjeta de reserva: ícono gris + texto. */
function FilaDato({
  icono,
  texto,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
}) {
  return (
    <View style={styles.filaDato}>
      <Ionicons name={icono} size={14} color={Colors.inkMuted} />
      <Text style={styles.filaDatoTexto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { backgroundColor: Colors.canvas, flex: 1 },
  contenedor: { flex: 1 },
  centro: {
    backgroundColor: Colors.canvas,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  portadaVacia: { backgroundColor: Colors.cream2, height: 220 },
  contadorFotos: {
    backgroundColor: "rgba(16,26,44,0.75)",
    borderRadius: 8,
    bottom: Spacing.four,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: "absolute",
    right: Spacing.three,
  },
  contadorFotosTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 11.5 },

  seccion: { gap: Spacing.two + 2, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  // La identidad monta sobre la foto, como el encabezado del mockup.
  // El `gap` es para la tarjetita de visitas que va debajo; sin ella no
  // separa nada, porque queda un solo hijo.
  seccionIdentidad: {
    gap: Spacing.two,
    marginTop: -Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  identidad: { gap: Spacing.two + 2, padding: Spacing.three },
  identidadFila: { alignItems: "center", flexDirection: "row", gap: Spacing.two + 2 },
  titulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 20, letterSpacing: -0.5 },
  metaFila: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 3 },
  metaFuerte: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5 },
  metaTexto: { color: Colors.inkSoft, flexShrink: 1, fontFamily: Fonts.medium, fontSize: 12.5 },

  descripcion: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 14, lineHeight: 21 },
  hint: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chipBorde: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },
  chipTexto: { color: Colors.ink, fontFamily: Fonts.semiBold, fontSize: 12.5 },

  terminoFila: { alignItems: "flex-start", flexDirection: "row", gap: Spacing.two },
  terminoTexto: { color: Colors.inkSoft, flex: 1, fontFamily: Fonts.medium, fontSize: 13, lineHeight: 19 },

  resena: { gap: 6, padding: Spacing.three },
  resenaEstrellas: { color: Colors.accent, fontSize: 14 },
  resenaComentario: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 13.5, lineHeight: 20 },
  resenaMeta: { color: Colors.inkMuted, fontFamily: Fonts.semiBold, fontSize: 11.5 },

  grupoAmenidades: { gap: Spacing.two, padding: Spacing.three },
  amenidadFila: { alignItems: "center", flexDirection: "row", gap: 10 },
  amenidadCheck: {
    alignItems: "center",
    backgroundColor: Colors.greenLight,
    borderRadius: Radios.full,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  amenidadTexto: { color: Colors.ink, flexShrink: 1, fontFamily: Fonts.medium, fontSize: 13.5 },

  botonSecundario: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 11,
  },
  botonSecundarioTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13 },

  barraReserva: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    gap: Spacing.two + 2,
    left: 0,
    paddingBottom: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    position: "absolute",
    right: 0,
  },
  barraPrecio: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 18, marginTop: 2 },
  barraUnidad: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5 },
  barraChat: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },

  tarjetaReserva: { padding: Spacing.three },
  tarjetaReservaPrecio: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 24,
    letterSpacing: -0.6,
  },
  tarjetaReservaUnidad: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5 },
  tarjetaReservaDatos: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    gap: 8,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
  },
  filaDato: { alignItems: "center", flexDirection: "row", gap: 8 },
  filaDatoTexto: { color: Colors.inkSoft, flex: 1, fontFamily: Fonts.medium, fontSize: 12.5 },
  tarjetaReservaNota: {
    color: Colors.inkMuted,
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    marginTop: 10,
    textAlign: "center",
  },

  veloModal: {
    backgroundColor: "rgba(10,18,42,0.30)",
    flex: 1,
    justifyContent: "center",
    padding: Spacing.three,
  },
  panelModal: {
    backgroundColor: Colors.canvas,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: Radios.xl,
    borderWidth: 1,
    elevation: 18,
    maxHeight: "92%",
    overflow: "hidden",
    shadowColor: "#060c20",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.45,
    shadowRadius: 40,
  },
  panelModalHeader: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderBottomColor: Colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  panelModalTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 18,
    letterSpacing: -0.4,
    marginTop: 3,
  },
  panelModalCerrar: {
    alignItems: "center",
    backgroundColor: Colors.canvas,
    borderColor: Colors.line,
    borderRadius: Radios.full,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
});
