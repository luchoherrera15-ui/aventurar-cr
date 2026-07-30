import { Pressable, StyleSheet, Text } from "react-native";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TABS } from "@/components/tab-bar";
import { Colors, Fonts } from "@/constants/theme";

/** Espacio inferior que las listas deben reservar para que el dock no
 * tape el final del contenido al llegar abajo. */
export const BARRA_RAPIDA_ESPACIO = 104;

/**
 * Dock compacto para las pantallas apiladas (Citas, Hospedajes...):
 * las cinco secciones raíz siempre a un toque, con el mismo lenguaje
 * de vidrio del tab-bar. A diferencia de aquel, acá no hay pestaña
 * activa ni burbuja — cada atajo simplemente reemplaza la ruta por la
 * pestaña correspondiente del pager (/?tab=...).
 */
export default function BarraRapida() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={55}
      tint="light"
      experimentalBlurMethod="dimezisBlurView"
      style={[styles.dock, { bottom: Math.max(insets.bottom, 14) + 4 }]}
    >
      {TABS.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={() => router.replace(`/?tab=${item.id}` as never)}
          style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name={item.icono} size={22} color={Colors.navy} />
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    borderRadius: 30,
    overflow: "hidden",
    // El blur pone lo suyo; este blanco al 60% mantiene el dock
    // legible incluso en Android sin blur nativo.
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(22,41,94,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 7,
    shadowColor: "#101a2c",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 12,
  },
  item: { alignItems: "center", flex: 1, gap: 2, paddingVertical: 3 },
  label: { color: Colors.navy, fontFamily: Fonts.semiBold, fontSize: 9.5 },
});
