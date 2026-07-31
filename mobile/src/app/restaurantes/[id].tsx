import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import BarraRapida, { BARRA_RAPIDA_ESPACIO } from "@/components/barra-rapida";
import { Avatar, Boton, Micro, Tarjeta, Vacio } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { abrirHiloConsulta } from "@/lib/consulta";
import { pedirAvisoDeMensaje } from "@/lib/notificaciones";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { fmtColones, linkGoogleMaps, linkWaze } from "@/lib/types";
import {
  CATEGORIA_RESTAURANTE_LABEL,
  RANGO_PRECIO_LABEL,
  normalizarCategoriaRestaurante,
  opcionesDeDetalles,
} from "@/lib/restaurantes";

type Local = {
  id: string;
  slug: string | null;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  provincia: string | null;
  canton: string | null;
  direccion_exacta: string | null;
  foto_url: string | null;
  contacto_whatsapp: string | null;
  latitud: number | null;
  longitud: number | null;
  detalles: unknown;
};

type ItemMenu = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  unidad: string | null;
  grupo: string | null;
  foto_url: string | null;
};

type Calificacion = { promedio: number; total: number };

/**
 * La ficha del restaurante — espejo de /restaurantes/[slug] en la web:
 * el menú por secciones, cómo llegar y qué se puede hacer acá.
 *
 * Igual que en la web, la reserva de mesa con hora y el pedido para
 * recoger todavía no tienen flujo propio: los dos botones abren el chat
 * con el pedido ya escrito, que es lo que hoy funciona de punta a
 * punta. Cuando la web estrene el flujo, esta pantalla lo sigue.
 */
export default function RestauranteFichaScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [local, setLocal] = useState<Local | null>(null);
  const [items, setItems] = useState<ItemMenu[]>([]);
  const [calif, setCalif] = useState<Calificacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [noExiste, setNoExiste] = useState(false);
  const [abriendo, setAbriendo] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("ranchos")
      .select(
        "id, slug, nombre, categoria, descripcion, provincia, canton, direccion_exacta, foto_url, contacto_whatsapp, latitud, longitud, detalles",
      )
      .eq("id", id)
      .eq("vertical", "restaurantes")
      .eq("estado", "aprobado")
      .maybeSingle();

    if (!data) {
      setNoExiste(true);
      setCargando(false);
      return;
    }
    setLocal(data as Local);

    const [{ data: itemsData }, { data: califData }] = await Promise.all([
      supabase
        .from("rancho_items")
        .select("id, nombre, descripcion, precio, unidad, grupo, foto_url")
        .eq("rancho_id", data.id as string)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("calificaciones_rancho")
        .select("promedio, total")
        .eq("rancho_id", data.id as string)
        .maybeSingle(),
    ]);
    setItems((itemsData ?? []) as ItemMenu[]);
    setCalif((califData as Calificacion | null) ?? null);
    setCargando(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga la ficha al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  /**
   * El menú se agrupa por secciones ("Entradas", "Fuertes"...) y lo que
   * no tenga sección cae en una general. Se respeta el orden en que
   * aparecen los ítems, no el alfabético.
   */
  const secciones = useMemo(() => {
    const mapa = new Map<string, ItemMenu[]>();
    for (const it of items) {
      const g = (it.grupo ?? "").trim() || "Menú";
      mapa.set(g, [...(mapa.get(g) ?? []), it]);
    }
    return [...mapa.entries()];
  }, [items]);

  /** Los dos botones de acción abren el chat con el pedido escrito. */
  async function escribir(intencion: "mesa" | "pickup" | "consulta") {
    if (!local) return;
    if (!session) {
      router.push("/cuenta" as never);
      return;
    }
    if (abriendo) return;
    setAbriendo(true);
    try {
      const convId = await abrirHiloConsulta(local.id, session.user.id);
      if (!convId) {
        Alert.alert(
          "No se pudo abrir el chat",
          "Intentá de nuevo en un momento o escribinos a hola@bookea.lat.",
        );
        return;
      }

      // El primer mensaje va una sola vez: si el hilo ya tiene algo, no
      // se repite (mismo criterio que la pantalla de invitaciones).
      const { count } = await supabase
        .from("mensajes")
        .select("id", { count: "exact", head: true })
        .eq("conversacion_id", convId);

      if (!count) {
        const texto =
          intencion === "mesa"
            ? `¡Hola! Quisiera reservar una mesa en ${local.nombre}. ¿Tienen campo para (contanos día, hora y cuántas personas)?`
            : intencion === "pickup"
              ? `¡Hola! Quisiera hacer un pedido para recoger en ${local.nombre}. (Contanos qué querés y a qué hora lo pasás a traer)`
              : `¡Hola! Tengo una consulta sobre ${local.nombre}.`;
        const { data: mensaje } = await supabase
          .from("mensajes")
          .insert({ conversacion_id: convId, autor_id: session.user.id, texto })
          .select("id")
          .maybeSingle();
        if (mensaje?.id) void pedirAvisoDeMensaje(mensaje.id as string);
      }

      router.push(`/mensajes/hilo/${convId}` as never);
    } finally {
      setAbriendo(false);
    }
  }

  if (cargando) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior
          kicker="Restaurantes"
          titulo="Restaurante"
          onVolver={() =>
            router.canGoBack() ? router.back() : router.replace("/restaurantes" as never)
          }
        />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  if (noExiste || !local) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior
          kicker="Restaurantes"
          titulo="Restaurante"
          onVolver={() =>
            router.canGoBack() ? router.back() : router.replace("/restaurantes" as never)
          }
        />
        <View style={styles.centrado}>
          <Vacio
            icono="close-circle-outline"
            titulo="No encontramos este restaurante"
            texto="Puede que ya no esté publicado. Mirá el resto del directorio."
            accion={{
              texto: "Ver los restaurantes",
              onPress: () => router.replace("/restaurantes" as never),
            }}
          />
        </View>
      </View>
    );
  }

  const categoria = normalizarCategoriaRestaurante(local.categoria);
  const { aceptaReservaMesa, aceptaPickup, rangoPrecio } = opcionesDeDetalles(local.detalles);
  const ubicacion = [local.canton, local.provincia].filter(Boolean).join(", ");
  const senas = [local.direccion_exacta, ubicacion].filter(Boolean).join(", ");
  const hrefMaps = linkGoogleMaps(local.latitud, local.longitud, senas);
  const hrefWaze = linkWaze(local.latitud, local.longitud, senas);
  const whatsapp = local.contacto_whatsapp?.replace(/\D/g, "") || null;

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        kicker="Restaurantes"
        titulo={local.nombre}
        onVolver={() =>
          router.canGoBack() ? router.back() : router.replace("/restaurantes" as never)
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.portadaMarco}>
          {local.foto_url ? (
            <Image
              source={{ uri: local.foto_url }}
              alt={local.nombre}
              style={styles.portada}
              contentFit="cover"
              transition={250}
            />
          ) : (
            <View style={styles.portadaVacia}>
              <Ionicons name="restaurant-outline" size={46} color={Colors.blue} />
            </View>
          )}
          {local.slug?.startsWith("demo-") && (
            <View style={styles.badgeDemo}>
              <Text style={styles.badgeDemoTexto}>Demo</Text>
            </View>
          )}
        </View>

        {/* La identidad del local, montada sobre la foto — el mismo
            encabezado que en Servicios, Eventos y Hospedajes. */}
        <View style={styles.zonaIdentidad}>
          <Tarjeta style={styles.identidad}>
            <Micro>
              {CATEGORIA_RESTAURANTE_LABEL[categoria]}
              {rangoPrecio !== null ? ` · ${RANGO_PRECIO_LABEL[rangoPrecio]}` : ""}
            </Micro>
            <View style={styles.identidadFila}>
              <Avatar nombre={local.nombre} tamano={46} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.nombre} numberOfLines={2}>
                  {local.nombre}
                </Text>
                <View style={styles.metaFila}>
                  {calif && (
                    <>
                      <Ionicons name="star" size={12} color={Colors.accent} />
                      <Text style={styles.metaFuerte}>
                        {Number(calif.promedio).toFixed(1)}
                      </Text>
                      <Text style={styles.metaTexto}>({calif.total})</Text>
                    </>
                  )}
                  {!!ubicacion && (
                    <Text style={styles.metaTexto} numberOfLines={1}>
                      {calif ? "· " : ""}
                      {ubicacion}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {!!local.descripcion && <Text style={styles.descripcion}>{local.descripcion}</Text>}

            {/* La acción principal, en el naranja de siempre; las
                secundarias en contorno. */}
            <View style={styles.acciones}>
              {aceptaReservaMesa && (
                <Boton
                  texto="Reservar mesa"
                  icono="calendar-outline"
                  cargando={abriendo}
                  onPress={() => escribir("mesa")}
                />
              )}
              <View style={styles.accionesFila}>
                {aceptaPickup && (
                  <Boton
                    compacto
                    tono="navy"
                    texto="Pedir para recoger"
                    icono="bag-handle-outline"
                    cargando={abriendo}
                    onPress={() => escribir("pickup")}
                    style={{ flex: 1 }}
                  />
                )}
                <Boton
                  compacto
                  tono="contorno"
                  texto="Escribirle"
                  icono="chatbubble-ellipses-outline"
                  cargando={abriendo}
                  onPress={() => escribir("consulta")}
                  style={{ flex: 1 }}
                />
              </View>
              {whatsapp && (
                <Pressable
                  onPress={() => Linking.openURL(`https://wa.me/${whatsapp}`)}
                  style={({ pressed }) => [styles.filaWhatsapp, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="logo-whatsapp" size={16} color={Colors.green} />
                  <Text style={styles.filaWhatsappTexto}>Escribir por WhatsApp</Text>
                </Pressable>
              )}
            </View>
          </Tarjeta>
        </View>

        {(!!local.direccion_exacta || hrefMaps || hrefWaze) && (
          <View style={styles.bloque}>
            <Micro>Dónde queda</Micro>
            <Tarjeta style={styles.tarjetaUbicacion}>
              {!!senas && (
                <View style={styles.filaUbicacion}>
                  <Ionicons name="location-outline" size={15} color={Colors.blue} />
                  <Text style={styles.ubicacion}>{senas}</Text>
                </View>
              )}
              {(hrefMaps || hrefWaze) && (
                <View style={styles.comoLlegar}>
                  {hrefMaps && (
                    <Pressable onPress={() => Linking.openURL(hrefMaps)} hitSlop={6}>
                      <Text style={styles.enlace}>Cómo llegar (Maps) →</Text>
                    </Pressable>
                  )}
                  {hrefWaze && (
                    <Pressable onPress={() => Linking.openURL(hrefWaze)} hitSlop={6}>
                      <Text style={styles.enlace}>Waze →</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </Tarjeta>
          </View>
        )}

        <View style={styles.menuZona}>
          <Micro>El menú</Micro>

          {items.length === 0 ? (
            <View style={styles.menuVacio}>
              <Text style={styles.menuVacioTitulo}>
                Este restaurante todavía no publicó su menú
              </Text>
              <Text style={styles.menuVacioTexto}>
                Escribiles por el chat y te cuentan qué tienen hoy.
              </Text>
            </View>
          ) : (
            secciones.map(([seccion, platos]) => (
              <View key={seccion} style={styles.seccion}>
                <Text style={styles.seccionTitulo}>{seccion.toUpperCase()}</Text>
                {platos.map((p) => (
                  <View key={p.id} style={styles.plato}>
                    {!!p.foto_url && (
                      <Image
                        source={{ uri: p.foto_url }}
                        alt={p.nombre}
                        style={styles.platoFoto}
                        contentFit="cover"
                        transition={200}
                      />
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.platoEncabezado}>
                        <Text style={styles.platoNombre}>{p.nombre}</Text>
                        {p.precio !== null && (
                          <Text style={styles.platoPrecio}>
                            {fmtColones(p.precio)}
                            {!!p.unidad && <Text style={styles.platoUnidad}> {p.unidad}</Text>}
                          </Text>
                        )}
                      </View>
                      {!!p.descripcion && (
                        <Text style={styles.platoDescripcion}>{p.descripcion}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <BarraRapida />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  scroll: { gap: Spacing.four, paddingBottom: BARRA_RAPIDA_ESPACIO },
  centro: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: BARRA_RAPIDA_ESPACIO,
  },
  centrado: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: BARRA_RAPIDA_ESPACIO,
    paddingHorizontal: Spacing.three,
  },

  portadaMarco: { aspectRatio: 16 / 9, backgroundColor: Colors.blueLight, width: "100%" },
  portada: { height: "100%", width: "100%" },
  portadaVacia: { alignItems: "center", flex: 1, justifyContent: "center" },
  badgeDemo: {
    backgroundColor: "#fbbf24",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: "absolute",
    right: Spacing.three,
    top: Spacing.three,
  },
  badgeDemoTexto: {
    color: "#1c1c1c",
    fontFamily: Fonts.extraBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  zonaIdentidad: { marginTop: -Spacing.four - Spacing.two, paddingHorizontal: Spacing.three },
  identidad: { gap: Spacing.two + 2, padding: Spacing.three },
  identidadFila: { alignItems: "center", flexDirection: "row", gap: Spacing.two + 2 },
  nombre: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 20, letterSpacing: -0.5 },
  metaFila: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 3 },
  metaFuerte: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5 },
  metaTexto: { color: Colors.inkSoft, flexShrink: 1, fontFamily: Fonts.medium, fontSize: 12.5 },
  descripcion: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13.5, lineHeight: 20 },

  acciones: { gap: Spacing.two, marginTop: 2 },
  accionesFila: { flexDirection: "row", gap: Spacing.two },
  filaWhatsapp: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 6,
  },
  filaWhatsappTexto: { color: Colors.green, fontFamily: Fonts.bold, fontSize: 13 },

  bloque: { gap: Spacing.two + 2, paddingHorizontal: Spacing.three },
  tarjetaUbicacion: { gap: Spacing.two + 2, padding: Spacing.three },
  filaUbicacion: { alignItems: "flex-start", flexDirection: "row", gap: 6 },
  ubicacion: {
    color: Colors.inkSoft,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  comoLlegar: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.four,
    paddingTop: Spacing.two + 2,
  },
  enlace: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 12.5 },

  menuZona: { gap: Spacing.two + 2, paddingHorizontal: Spacing.three },
  menuVacio: {
    alignItems: "center",
    borderColor: "#cfd5e2",
    borderRadius: Radios.lg,
    borderStyle: "dashed",
    borderWidth: 1.5,
    padding: Spacing.four,
  },
  menuVacioTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    textAlign: "center",
  },
  menuVacioTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 5,
    textAlign: "center",
  },
  seccion: { gap: Spacing.two, marginTop: Spacing.two },
  seccionTitulo: {
    color: Colors.accent,
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 1.7,
  },
  plato: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two + 2,
    padding: Spacing.two + 2,
  },
  platoFoto: { borderRadius: Radios.sm, height: 60, width: 60 },
  platoEncabezado: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "space-between",
  },
  platoNombre: { color: Colors.ink, flex: 1, fontFamily: Fonts.bold, fontSize: 14 },
  platoPrecio: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 13.5 },
  platoUnidad: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 10.5 },
  platoDescripcion: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
});
