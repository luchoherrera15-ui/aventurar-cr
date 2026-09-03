import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";

/**
 * Los controles que van FLOTANDO sobre una foto a sangre (el carrusel
 * del detalle), en vez de una barra de navegación sólida que le roba
 * pantalla a la imagen: círculos de vidrio esmerilado, como los de
 * Airbnb. La fila se posiciona sola bajo el notch.
 */
export function FilaFlotante({
  children,
  derecha,
}: {
  children: React.ReactNode;
  /** Botones alineados a la derecha (favorito, compartir...). */
  derecha?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fila, { top: insets.top + 8 }]} pointerEvents="box-none">
      <View style={styles.grupo}>{children}</View>
      {derecha && <View style={styles.grupo}>{derecha}</View>}
    </View>
  );
}

/** Un botón redondo de vidrio. Sin `onPress` se comporta como "volver". */
export function BotonFlotante({
  icono,
  onPress,
  color = Colors.ink,
  etiqueta,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  etiqueta?: string;
}) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta ?? "Volver"}
      onPress={onPress ?? (() => router.back())}
      style={styles.boton}
      hitSlop={6}
    >
      {/* `experimentalBlurMethod` o en Android NO HAY BLUR: el default
          de expo-blur es "none", así que sin esto el botón se veía
          esmerilado en iPhone y plano en Android. Los otros tres
          BlurView de la app ya lo pasaban; a este y al del modal de
          fechas se les había pasado (3 sep 2026). */}
      <BlurView
        intensity={40}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.velo} />
      <Ionicons name={icono} size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  grupo: { flexDirection: "row", gap: 10 },
  boton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    // Sombra suave para que el círculo se despegue de fotos claras.
    shadowColor: "#101a2c",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  // El blur solo no alcanza sobre fotos muy oscuras: este velo blanco
  // garantiza que el ícono siempre se lea.
  velo: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.6)" },
});
