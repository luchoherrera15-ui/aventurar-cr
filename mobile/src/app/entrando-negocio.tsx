import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Colors, Fonts, Spacing } from "@/constants/theme";

/**
 * LA TRANSICIÓN ENTRE MODOS.
 *
 * Pedido textual del dueño: al presionar "Modo negocio", la casita/
 * local entra animada al centro con tres puntitos rebotando debajo, y
 * en menos de dos segundos (1,5) se activa el modo. Al volver a "Modo
 * usuario" pasa lo mismo, con el ícono de una persona.
 *
 * Es una pantalla de TRANSICIÓN, no un loader falso: mientras dura,
 * la pantalla destino ya se está montando detrás. Se sale sola con
 * `router.replace` — nunca queda en el historial, así que el botón
 * "atrás" no vuelve a caer acá.
 *
 * Una sola pantalla para los dos sentidos: lo único que cambia es el
 * ícono y el texto, y tener dos archivos casi iguales garantizaba que
 * se desincronizaran.
 */

const DURACION_MS = 1500;

export default function EntrandoModoScreen() {
  const router = useRouter();
  // `destino`: a dónde va después. `modo`: qué ícono y qué texto —
  // "negocio" (casita) o "usuario" (persona).
  const { destino, modo } = useLocalSearchParams<{ destino?: string; modo?: string }>();
  const aUsuario = modo === "usuario";

  const escala = useSharedValue(0.4);
  const opacidad = useSharedValue(0);

  useEffect(() => {
    escala.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.6)) });
    opacidad.value = withTiming(1, { duration: 300 });

    const salto = setTimeout(() => {
      router.replace((destino || (aUsuario ? "/" : "/negocio")) as never);
    }, DURACION_MS);
    return () => clearTimeout(salto);
  }, [router, destino, aUsuario, escala, opacidad]);

  const estiloIcono = useAnimatedStyle(() => ({
    opacity: opacidad.value,
    transform: [{ scale: escala.value }],
  }));

  return (
    <View style={styles.contenedor}>
      <Animated.View style={[styles.burbuja, estiloIcono]}>
        <Ionicons name={aUsuario ? "person" : "storefront"} size={44} color="#ffffff" />
      </Animated.View>

      <View style={styles.puntos}>
        {[0, 1, 2].map((i) => (
          <Punto key={i} indice={i} />
        ))}
      </View>

      <Text style={styles.texto}>
        {aUsuario ? "Volviendo al modo usuario…" : "Entrando al modo negocio…"}
      </Text>
    </View>
  );
}

/** Un puntito que rebota, desfasado del anterior. */
function Punto({ indice }: { indice: number }) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(
      indice * 130,
      withRepeat(
        withSequence(
          withTiming(-9, { duration: 300, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [indice, y]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return <Animated.View style={[styles.punto, estilo]} />;
}

const styles = StyleSheet.create({
  contenedor: {
    alignItems: "center",
    backgroundColor: Colors.cream,
    flex: 1,
    gap: Spacing.four,
    justifyContent: "center",
  },
  burbuja: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 30,
    height: 96,
    justifyContent: "center",
    width: 96,
  },
  puntos: { flexDirection: "row", gap: 8, height: 12 },
  punto: {
    backgroundColor: Colors.accent,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  texto: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 13.5 },
});
