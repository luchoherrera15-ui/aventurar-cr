import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts, Spacing, Tipo } from "@/constants/theme";

/**
 * Encabezado grande dentro de la pantalla: las pestañas raíz no llevan
 * barra de navegación nativa, así que cada una pinta su propio título
 * debajo del notch (por eso el inset superior). El rótulo en
 * micro-mayúsculas encima es la misma firma de las demás pantallas.
 */
export default function TituloPantalla({
  kicker,
  titulo,
  subtitulo,
}: {
  kicker?: string;
  titulo: string;
  subtitulo?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.contenedor, { paddingTop: insets.top + Spacing.three }]}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text style={styles.titulo}>{titulo}</Text>
      {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: Colors.canvas,
    gap: 4,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  kicker: { ...Tipo.micro, marginBottom: 2 },
  titulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 27, letterSpacing: -0.7 },
  subtitulo: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13.5 },
});
