import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Colors, Fonts } from "@/constants/theme";

/**
 * EL PRIMER TAG DEL SISTEMA DE TAGS.
 *
 * "NUEVO": va abajo de la foto del negocio, con glow azul y un punto
 * verde que parpadea como un indicador de "en línea". Se lo lleva todo
 * el que se registre mientras el sistema de tags crece — por eso el
 * criterio vive en UN solo lugar (`esNegocioNuevo`, abajo) y no
 * repartido por cada pantalla.
 *
 * El glow es una sombra azul de verdad (shadow + elevation), no un
 * borde de color: en un card chico un borde compite con la foto y en
 * Android sin sombra el tag igual se lee por su fondo sólido.
 */

/** Días que un negocio se considera "nuevo" desde que lo aprobaron. */
export const DIAS_NUEVO = 30;

/**
 * ¿Este negocio lleva el tag "NUEVO"?
 *
 * Mientras el sistema de tags se termina, el criterio es simple y
 * honesto: se registró hace poco. Nada de marcar todo el directorio
 * como nuevo —eso vacía la palabra— ni de una lista a mano que haya
 * que mantener.
 */
export function esNegocioNuevo(creadoEn: string | null | undefined): boolean {
  if (!creadoEn) return false;
  const t = new Date(creadoEn).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < DIAS_NUEVO * 86_400_000;
}

export default function TagNuevo() {
  const opacidad = useSharedValue(1);

  useEffect(() => {
    opacidad.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [opacidad]);

  const estiloPunto = useAnimatedStyle(() => ({ opacity: opacidad.value }));

  return (
    <View style={styles.tag}>
      <Animated.View style={[styles.punto, estiloPunto]} />
      <Text style={styles.texto}>NUEVO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 7,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    // El glow azul: sombra de color, no borde.
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 8,
    elevation: 8,
  },
  punto: {
    backgroundColor: "#22c55e",
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  texto: {
    color: "#ffffff",
    fontFamily: Fonts.extraBold,
    fontSize: 8.5,
    letterSpacing: 1,
  },
});
