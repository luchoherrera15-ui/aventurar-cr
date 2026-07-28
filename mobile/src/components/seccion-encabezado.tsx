import { StyleSheet, Text, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

/**
 * El encabezado de sección de la marca, igual que en el sitio web: un
 * "kicker" naranja en mayúsculas con su guioncito adelante, y debajo
 * el título en ExtraBold con tracking cerrado (la clase `titulo` de
 * globals.css en /web).
 */
export default function SeccionEncabezado({
  kicker,
  titulo,
}: {
  kicker: string;
  titulo: string;
}) {
  return (
    <View style={styles.contenedor}>
      <View style={styles.kickerFila}>
        <View style={styles.kickerGuion} />
        <Text style={styles.kickerTexto}>{kicker}</Text>
      </View>
      <Text style={styles.titulo}>{titulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 6 },
  kickerFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  kickerGuion: { width: 18, height: 1.5, backgroundColor: Colors.accent },
  kickerTexto: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    color: Colors.accent,
  },
  titulo: { fontSize: 22, fontFamily: Fonts.extraBold, letterSpacing: -0.5, color: Colors.ink },
});
