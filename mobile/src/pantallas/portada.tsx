import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts } from "@/constants/theme";
import logoBlanco from "../../assets/images/logo-bookea-blanco-v3.png";

/**
 * La misma portada que la web (src/app/page.tsx), adaptada al
 * teléfono: fondo navy de marca y cuatro tarjetas de vidrio en fila
 * compacta para escoger qué se quiere reservar — una por vertical.
 * Eventos entra a la app de siempre; Citas, Hospedajes y Restaurantes
 * navegan a su directorio. Debajo, dos píldoras: publicar un negocio y
 * el programa de Lealtad.
 */

type IconoNombre = keyof typeof Ionicons.glyphMap;

export default function Portada({ onEntrar }: { onEntrar: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.contenedor}>
      {/* Fondo navy sólido de marca (sin foto, pedido del dueño); los
          íconos del sistema van claros sobre el azul. */}
      <StatusBar style="light" />
      <View style={styles.orbe} />
      <View style={styles.orbeAbajo} />

      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={[
          styles.contenido,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 },
        ]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <Image source={logoBlanco} alt="Bookea" style={styles.logo} contentFit="contain" />

        <View style={styles.centro}>
          <View style={styles.kicker}>
            <View style={styles.kickerBarra} />
            <Text style={styles.kickerTexto}>Reservas en línea</Text>
            <View style={styles.kickerBarra} />
          </View>
          <Text style={styles.titulo}>Todo lo que se reserva, en un solo lugar</Text>
          <Text style={styles.subtitulo}>
            Un evento, una cita, una mesa o una escapada: elegí lo que
            necesitás y reservalo directo, con confirmación y chat
            incluidos.
          </Text>

          <View style={styles.tarjetas}>
            <TarjetaSeccion
              activa
              icono="sparkles-outline"
              titulo="Eventos"
              descripcion="Salones y fincas, catering, música y decoración para tu evento completo."
              onPress={onEntrar}
            />
            <TarjetaSeccion
              activa
              icono="time-outline"
              titulo="Servicios"
              descripcion="Belleza, barbería, uñas y spa — elegí el servicio, la hora y con quién."
              onPress={() => {
                // Solo push, SIN descartar la portada: así "volver"
                // desde Citas regresa acá — al selector de las cuatro
                // verticales — y nunca a una pantalla muerta.
                router.push("/citas" as never);
              }}
            />
            <TarjetaSeccion
              activa
              icono="restaurant-outline"
              titulo="Restaurantes"
              descripcion="Sodas, marisquerías y cafeterías: mirá el menú, reservá mesa o pedí para recoger."
              onPress={() => {
                router.push("/restaurantes" as never);
              }}
            />
            <TarjetaSeccion
              activa
              icono="home-outline"
              titulo="Hospedajes"
              descripcion="Casas, villas y hoteles para reservar tu próxima escapada directo."
              onPress={() => {
                // Solo push, SIN descartar la portada: así "volver"
                // desde Hospedajes regresa acá — al selector de las
                // cuatro verticales — y nunca a una pantalla muerta.
                router.push("/hospedajes" as never);
              }}
            />
          </View>
        </View>

        <View style={styles.pie}>
          {[
            "Reservá directo con cada negocio",
            "Confirmación y chat en el mismo lugar",
            "Publicá tu negocio gratis",
          ].map((t) => (
            <View key={t} style={styles.pieFila}>
              <View style={styles.piePunto} />
              <Text style={styles.pieTexto}>{t}</Text>
            </View>
          ))}
        </View>

        {/* Accesos como en la web: publicar un negocio y Lealtad. */}
        <View style={styles.pildoras}>
          <Pressable
            style={[styles.pildora, styles.pildoraSolida]}
            onPress={() => router.push("/negocio/nuevo" as never)}
          >
            <Text style={styles.pildoraTexto}>Publicá tu negocio</Text>
          </Pressable>
          <Pressable
            style={styles.pildora}
            onPress={() => router.push("/lealtad" as never)}
          >
            <Text style={styles.pildoraTexto}>Lealtad</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function TarjetaSeccion({
  activa,
  icono,
  titulo,
  descripcion,
  onPress,
}: {
  activa?: boolean;
  icono: IconoNombre;
  titulo: string;
  descripcion: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.tarjetaPresionada]}>
      <View style={styles.tarjetaMarco}>
        <BlurView
          intensity={30}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={styles.tarjeta}
        >
          <View style={styles.tarjetaIcono}>
            <Ionicons name={icono} size={20} color="#fff" />
          </View>
          <View style={styles.tarjetaCuerpo}>
            <View style={styles.tarjetaTituloFila}>
              <Text style={styles.tarjetaTitulo}>{titulo}</Text>
              {!activa && <Text style={styles.tarjetaBadge}>Muy pronto</Text>}
            </View>
            <Text style={styles.tarjetaDescripcion} numberOfLines={2}>
              {descripcion}
            </Text>
          </View>
          <View style={[styles.tarjetaFlecha, activa && styles.tarjetaFlechaActiva]}>
            <Ionicons name="arrow-forward" size={15} color="#fff" />
          </View>
        </BlurView>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.navy },
  // Dos orbes suaves para que el navy no sea plano — el mismo recurso
  // de los bentos de la web.
  orbe: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(47,74,148,0.35)",
  },
  orbeAbajo: {
    position: "absolute",
    bottom: -110,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(238,116,32,0.12)",
  },
  contenido: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 22,
  },
  logo: { alignSelf: "center", height: 30, width: 128 },
  // La cuarta tarjeta (Restaurantes) alarga la columna: el aire de
  // arriba y abajo se recorta para que las cuatro sigan entrando sin
  // scroll en un teléfono normal.
  centro: { paddingVertical: 18 },
  kicker: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginBottom: 14,
  },
  kickerBarra: {
    backgroundColor: Colors.sky,
    borderRadius: 2,
    height: 2,
    width: 22,
  },
  // El mismo micro-rótulo que rotula los bloques del resto de la app
  // (Tipo.micro), en claro sobre el navy.
  kickerTexto: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  titulo: {
    color: "#fff",
    fontFamily: Fonts.extraBold,
    fontSize: 30,
    letterSpacing: -0.8,
    lineHeight: 34,
    textAlign: "center",
  },
  subtitulo: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 12,
    textAlign: "center",
  },
  tarjetas: { gap: 10, marginTop: 20 },
  tarjetaPresionada: { transform: [{ scale: 0.98 }] },
  tarjetaMarco: {
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  tarjeta: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  tarjetaIcono: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  tarjetaCuerpo: { flex: 1 },
  tarjetaTituloFila: { alignItems: "center", flexDirection: "row", gap: 8 },
  tarjetaTitulo: {
    color: "#fff",
    fontFamily: Fonts.extraBold,
    fontSize: 15.5,
    letterSpacing: -0.3,
  },
  tarjetaBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 99,
    borderWidth: 1,
    color: "rgba(255,255,255,0.9)",
    fontFamily: Fonts.extraBold,
    fontSize: 8.5,
    letterSpacing: 0.5,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  tarjetaDescripcion: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  tarjetaFlecha: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 99,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  tarjetaFlechaActiva: { backgroundColor: Colors.sky },
  pie: { gap: 7 },
  pieFila: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  piePunto: {
    backgroundColor: Colors.sky,
    borderRadius: 99,
    height: 5,
    width: 5,
  },
  pieTexto: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  pildoras: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
  },
  pildora: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  pildoraSolida: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.5)",
  },
  pildoraTexto: {
    color: "#ffffff",
    fontFamily: Fonts.bold,
    fontSize: 12.5,
  },
});
