import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "@/constants/theme";

/**
 * LA PANTALLA DE ARRANQUE — logo + tres puntitos rebotando.
 *
 * El splash NATIVO (expo-splash-screen, app.json) es una imagen fija:
 * no puede animar nada, es lo que el sistema operativo pinta ANTES de
 * que el JS siquiera arranque. Esta pantalla es la posta: en cuanto
 * las fuentes cargan, _layout.tsx esconde el splash nativo y muestra
 * ESTA por un momento breve — mismo fondo blanco que el splash nativo
 * (ver "backgroundColor" en app.json), para que el cambio sea
 * invisible y no un parpadeo.
 */
function Punto({ demora }: { demora: number }) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(
      demora,
      withRepeat(
        withSequence(
          withTiming(-7, { duration: 340, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [demora, y]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.punto, estilo]} />;
}

export default function PantallaBoot() {
  return (
    <View style={styles.contenedor}>
      <Image source={require("../../assets/images/logo-bookea-v3.png")} style={styles.logo} resizeMode="contain" />
      <View style={styles.puntos}>
        <Punto demora={0} />
        <Punto demora={130} />
        <Punto demora={260} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  logo: { width: 180, height: 54 },
  puntos: { flexDirection: "row", gap: 9, marginTop: 30 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
});
