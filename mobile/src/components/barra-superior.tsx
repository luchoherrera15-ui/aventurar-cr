import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Spacing } from "@/constants/theme";

/**
 * La barra superior de las pantallas sin foto a sangre. Reemplaza al
 * header nativo (aquel bloque navy con el "‹ index" que salía del
 * nombre del archivo de la ruta): fondo claro, botón redondo de
 * volver, título grande alineado a la izquierda y, opcionalmente, una
 * acción a la derecha.
 */
export default function BarraSuperior({
  titulo,
  subtitulo,
  accion,
  onVolver,
}: {
  titulo: string;
  subtitulo?: string;
  /** Botón opcional a la derecha (editar, filtros...). */
  accion?: { icono: keyof typeof Ionicons.glyphMap; onPress: () => void; etiqueta: string };
  onVolver?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.contenedor, { paddingTop: insets.top + 8 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver"
        onPress={onVolver ?? (() => router.back())}
        style={styles.circulo}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={20} color={Colors.ink} />
      </Pressable>

      <View style={styles.textos}>
        <Text style={styles.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={styles.subtitulo} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>

      {accion && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accion.etiqueta}
          onPress={accion.onPress}
          style={styles.circulo}
          hitSlop={8}
        >
          <Ionicons name={accion.icono} size={19} color={Colors.navy} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    backgroundColor: Colors.cream,
  },
  circulo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  textos: { flex: 1, minWidth: 0 },
  titulo: { fontSize: 20, fontFamily: Fonts.extraBold, letterSpacing: -0.4, color: Colors.ink },
  subtitulo: { fontSize: 12.5, fontFamily: Fonts.medium, color: Colors.inkSoft, marginTop: 1 },
});
