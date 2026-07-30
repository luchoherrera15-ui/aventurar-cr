import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Spacing } from "@/constants/theme";

type Vertical = "eventos" | "citas" | "hospedajes";
type IconoNombre = keyof typeof Ionicons.glyphMap;

const VERTICALES: { id: Vertical; icono: IconoNombre; label: string; ruta: string }[] = [
  { id: "eventos", icono: "sparkles-outline", label: "Eventos", ruta: "/" },
  { id: "citas", icono: "time-outline", label: "Citas", ruta: "/citas" },
  { id: "hospedajes", icono: "home-outline", label: "Hospedajes", ruta: "/hospedajes" },
];

/**
 * La fila de chips para saltar de vertical (Eventos / Citas / Hospedajes)
 * — el mismo menú superior en las tres pantallas. El activo va en navy y
 * no navega; `router.navigate` reutiliza la pantalla si ya está en la
 * pila (volver de Citas a Eventos no apila un Explorar nuevo).
 *
 * Va en un ScrollView horizontal para que en pantallas angostas
 * (320-360dp) el tercer chip no se corte: se desliza.
 */
export default function ChipsVerticales({ activo }: { activo: Vertical }) {
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.fila}
      keyboardShouldPersistTaps="handled"
    >
      {VERTICALES.map((v) => {
        const esActivo = v.id === activo;
        return (
          <Pressable
            key={v.id}
            accessibilityRole="button"
            accessibilityLabel={v.label}
            disabled={esActivo}
            onPress={() => router.navigate(v.ruta as never)}
            style={[styles.chip, esActivo && styles.chipActivo]}
          >
            <Ionicons name={v.icono} size={14} color={esActivo ? "#ffffff" : Colors.navy} />
            <Text numberOfLines={1} style={[styles.texto, esActivo && styles.textoActivo]}>
              {v.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexShrink: 0 evita que la fila se comprima (y recorte los chips)
  // cuando compite por altura con la lista de abajo.
  scroll: { flexGrow: 0, flexShrink: 0, marginBottom: Spacing.two },
  fila: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  chip: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    height: 34,
    paddingHorizontal: 13,
  },
  chipActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  texto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5 },
  textoActivo: { color: "#ffffff" },
});
