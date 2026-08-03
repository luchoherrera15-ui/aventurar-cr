import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";

type IconoNombre = keyof typeof Ionicons.glyphMap;

const VERTICALES = [
  { id: "eventos", icono: "sparkles-outline", label: "Eventos", ruta: "/" },
  { id: "citas", icono: "time-outline", label: "Servicios", ruta: "/citas" },
] as const satisfies { id: string; icono: IconoNombre; label: string; ruta: string }[];

export type VerticalActiva = (typeof VERTICALES)[number]["id"];

/**
 * La fila de chips para saltar de vertical (Eventos / Citas) — el
 * mismo menú superior en ambas pantallas. El activo va en navy y no
 * navega; `router.navigate` reutiliza la pantalla si ya está en la
 * pila (volver de Citas a Eventos no apila un Explorar nuevo).
 *
 * Hospedajes y Restaurantes ya no aparecen acá — se resumió a las dos
 * verticales principales. Sus pantallas siguen vivas; solo se sacaron
 * de este switcher rápido. Por eso `activo` es opcional: esas dos
 * pantallas montan la fila sin ningún chip resaltado.
 */
export default function ChipsVerticales({ activo }: { activo?: VerticalActiva }) {
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
  // flexGrow + justifyContent centran los chips cuando caben en el
  // ancho; si no caben (pantallas angostas), la fila sigue scrolleando.
  fila: {
    alignItems: "center",
    flexDirection: "row",
    flexGrow: 1,
    gap: Spacing.two,
    justifyContent: "center",
  },
  chip: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
  },
  chipActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  texto: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 12.5 },
  textoActivo: { color: "#ffffff" },
});
