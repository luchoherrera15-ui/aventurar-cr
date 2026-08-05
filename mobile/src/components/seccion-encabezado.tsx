import { StyleSheet, Text, View } from "react-native";
import { Colors, Fonts, Tipo } from "@/constants/theme";

/**
 * El encabezado de sección de la marca: el rótulo en micro-mayúsculas
 * con su guioncito naranja adelante, y debajo el título en ExtraBold
 * con tracking cerrado (la clase `titulo` de globals.css en /web).
 * Es la versión con guión de `Micro` — misma familia, mismo tamaño.
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
  kickerFila: { alignItems: "center", flexDirection: "row", gap: 8 },
  kickerGuion: { backgroundColor: Colors.sky, height: 1.5, width: 18 },
  kickerTexto: { ...Tipo.micro, color: Colors.accent },
  titulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 20, letterSpacing: -0.5 },
});
