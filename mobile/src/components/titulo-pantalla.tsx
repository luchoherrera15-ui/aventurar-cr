import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";

/**
 * Encabezado grande dentro de la pantalla, al estilo Airbnb: las
 * pestañas raíz no llevan barra de navegación nativa, así que cada una
 * pinta su propio título debajo del notch (por eso el inset superior).
 */
export default function TituloPantalla({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.contenedor, { paddingTop: insets.top + Spacing.three }]}>
      <Text style={styles.titulo}>{titulo}</Text>
      {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    backgroundColor: Colors.cream,
    gap: 4,
  },
  titulo: { fontSize: 28, fontFamily: Fonts.extraBold, letterSpacing: -0.5, color: Colors.ink },
  subtitulo: { fontSize: 13.5, color: Colors.inkSoft, fontFamily: Fonts.medium },
});
