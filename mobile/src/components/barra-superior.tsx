import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Tipo } from "@/constants/theme";

/**
 * La barra superior de las pantallas apiladas. Va sobre el lienzo gris
 * (no es una barra de otro color): botón redondo de volver, el rótulo
 * en micro-mayúsculas sobre el título, y a la derecha el contexto del
 * momento ("Hoy · martes") o un botón de acción.
 */
export default function BarraSuperior({
  kicker,
  titulo,
  subtitulo,
  contexto,
  accion,
  onVolver,
}: {
  /** Rótulo en micro-mayúsculas encima del título: "SERVICIOS". */
  kicker?: string;
  titulo: string;
  subtitulo?: string;
  /** Texto gris a la derecha, como el "Rancho Las Torres" del panel. */
  contexto?: string;
  /** Botón opcional a la derecha (editar, sincronizar, filtros...). */
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
        style={({ pressed }) => [styles.circulo, pressed && { opacity: 0.8 }]}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={20} color={Colors.ink} />
      </Pressable>

      <View style={styles.textos}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={styles.subtitulo} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>

      {contexto ? (
        <Text style={styles.contexto} numberOfLines={1}>
          {contexto}
        </Text>
      ) : null}

      {accion && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accion.etiqueta}
          onPress={accion.onPress}
          style={({ pressed }) => [styles.circulo, pressed && { opacity: 0.8 }]}
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
    alignItems: "center",
    backgroundColor: Colors.canvas,
    flexDirection: "row",
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  circulo: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.full,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  textos: { flex: 1, minWidth: 0 },
  kicker: { ...Tipo.micro, marginBottom: 3 },
  titulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 20, letterSpacing: -0.4 },
  subtitulo: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5, marginTop: 1 },
  contexto: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 12.5, maxWidth: 130, textAlign: "right" },
});
