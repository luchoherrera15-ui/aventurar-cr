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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { abrirHiloConsulta } from "@/lib/consulta";
import { pedirAvisoDeMensaje } from "@/lib/notificaciones";
import { Colors, Fonts, Spacing } from "@/constants/theme";
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
          titulo="Restaurante"
          onVolver={() =>
            router.canGoBack() ? router.back() : router.replace("/restaurantes" as never)
          }
        />
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>No encontramos este restaurante</Text>
          <Text style={styles.vacioTexto}>
            Puede que ya no esté publicado. Mirá el resto del directorio.
          </Text>
          <Pressable
            onPress={() => router.replace("/restaurantes" as never)}
            style={({ pressed }) => [styles.botonContorno, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.botonContornoTexto}>Ver los restaurantes</Text>
          </Pressable>
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
        titulo={local.nombre}
        subtitulo={CATEGORIA_RESTAURANTE_LABEL[categoria]}
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

        <View style={styles.bloque}>
          <View style={styles.encabezado}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rubro}>
                {CATEGORIA_RESTAURANTE_LABEL[categoria]}
                {rangoPrecio !== null ? ` · ${RANGO_PRECIO_LABEL[rangoPrecio]}` : ""}
              </Text>
              <Text style={styles.nombre}>{local.nombre}</Text>
            </View>
            {calif && (
              <View style={styles.calif}>
                <Ionicons name="star" size={14} color={Colors.accent} />
                <Text style={styles.califTexto}>
                  {Number(calif.promedio).toFixed(1)}
                  <Text style={styles.califTotal}> ({calif.total})</Text>
                </Text>
              </View>
            )}
          </View>

          {!!ubicacion && (
            <View style={styles.filaUbicacion}>
              <Ionicons name="location-outline" size={14} color={Colors.navy} />
              <Text style={styles.ubicacion}>
                {local.direccion_exacta ? `${local.direccion_exacta} · ` : ""}
                {ubicacion}
              </Text>
            </View>
          )}

          {!!local.descripcion && <Text style={styles.descripcion}>{local.descripcion}</Text>}

          <View style={styles.acciones}>
            {aceptaReservaMesa && (
              <Pressable
                disabled={abriendo}
                onPress={() => escribir("mesa")}
                style={({ pressed }) => [
                  styles.botonNavy,
                  (pressed || abriendo) && { opacity: 0.88 },
                ]}
              >
                <Ionicons name="calendar-outline" size={15} color="#ffffff" />
                <Text style={styles.botonNavyTexto}>Reservar mesa</Text>
              </Pressable>
            )}
            {aceptaPickup && (
              <Pressable
                disabled={abriendo}
                onPress={() => escribir("pickup")}
                style={({ pressed }) => [
                  styles.botonNaranja,
                  (pressed || abriendo) && { opacity: 0.88 },
                ]}
              >
                <Ionicons name="bag-handle-outline" size={15} color="#ffffff" />
                <Text style={styles.botonNavyTexto}>Pedir para recoger</Text>
              </Pressable>
            )}
            <Pressable
              disabled={abriendo}
              onPress={() => escribir("consulta")}
              style={({ pressed }) => [
                styles.botonContornoChico,
                (pressed || abriendo) && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={Colors.navy} />
              <Text style={styles.botonContornoChicoTexto}>Escribirle</Text>
            </Pressable>
            {whatsapp && (
              <Pressable
                onPress={() => Linking.openURL(`https://wa.me/${whatsapp}`)}
                style={({ pressed }) => [
                  styles.botonContornoChico,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="logo-whatsapp" size={15} color={Colors.green} />
                <Text style={styles.botonContornoChicoTexto}>WhatsApp</Text>
              </Pressable>
            )}
          </View>

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
        </View>

        <View style={styles.menuZona}>
          <Text style={styles.menuTitulo}>Menú</Text>

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
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  scroll: { paddingBottom: BARRA_RAPIDA_ESPACIO },
  centro: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: BARRA_RAPIDA_ESPACIO,
    paddingHorizontal: Spacing.five,
  },
  vacioTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    textAlign: "center",
  },
  vacioTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: "center",
  },
  portadaMarco: {
    aspectRatio: 16 / 9,
    backgroundColor: Colors.blueLight,
    width: "100%",
  },
  portada: { height: "100%", width: "100%" },
  portadaVacia: { alignItems: "center", flex: 1, justifyContent: "center" },
  badgeDemo: {
    backgroundColor: "#fbbf24",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: "absolute",
    right: Spacing.three,
    top: Spacing.three,
  },
  badgeDemoTexto: {
    color: "#1c1c1c",
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  bloque: { gap: Spacing.two, padding: Spacing.three },
  encabezado: { flexDirection: "row", gap: Spacing.two },
  rubro: {
    color: Colors.navy,
    fontFamily: Fonts.extraBold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  nombre: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 22,
    letterSpacing: -0.4,
    marginTop: 3,
  },
  calif: {
    alignItems: "center",
    backgroundColor: Colors.cream2,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  califTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13 },
  califTotal: { color: Colors.inkSoft, fontFamily: Fonts.semiBold },
  filaUbicacion: { alignItems: "flex-start", flexDirection: "row", gap: 5 },
  ubicacion: {
    color: Colors.inkSoft,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  descripcion: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 2,
  },
  acciones: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, marginTop: Spacing.two },
  botonNavy: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  botonNaranja: {
    alignItems: "center",
    backgroundColor: Colors.accent,
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  botonNavyTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 13 },
  botonContornoChico: {
    alignItems: "center",
    borderColor: "#dbe4f2",
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  botonContornoChicoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 13 },
  comoLlegar: { flexDirection: "row", gap: Spacing.three, marginTop: 2 },
  enlace: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 12.5 },
  menuZona: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  menuTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  menuVacio: {
    alignItems: "center",
    borderColor: Colors.line,
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
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
    fontSize: 11,
    letterSpacing: 1,
  },
  plato: {
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.two + 2,
  },
  platoFoto: { borderRadius: 12, height: 60, width: 60 },
  platoEncabezado: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "space-between",
  },
  platoNombre: { color: Colors.ink, flex: 1, fontFamily: Fonts.extraBold, fontSize: 13.5 },
  platoPrecio: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 13.5 },
  platoUnidad: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 10.5 },
  platoDescripcion: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  botonContorno: {
    borderColor: Colors.navy,
    borderRadius: 999,
    borderWidth: 1.5,
    marginTop: Spacing.three,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  botonContornoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 13 },
});
