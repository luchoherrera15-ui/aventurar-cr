import { useState } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";
import type { IdPestana } from "@/lib/pestanas";
import { useModoPedido } from "@/lib/modo-pedido";

type IconoNombre = keyof typeof Ionicons.glyphMap;

/**
 * Las cinco pestañas de FOOD.BOOKEA — mismo dock flotante de vidrio
 * que Bookea (mobile/src/components/tab-bar.tsx), con el mismo gesto
 * de arrastre directo sobre el dock y el mismo efecto "lupa" en el
 * ícono más cercano a la posición actual. Es un archivo APARTE (dos
 * proyectos Expo independientes) y no un import cruzado — Metro de
 * cada proyecto solo conoce su propio `src/`.
 */
export const TABS: {
  id: IdPestana;
  label: string;
  icono: IconoNombre;
  iconoActivo: IconoNombre;
}[] = [
  { id: "inicio", label: "Inicio", icono: "home-outline", iconoActivo: "home" },
  { id: "descubrir", label: "Descubrir", icono: "compass-outline", iconoActivo: "compass" },
  { id: "reservas", label: "Reservas", icono: "calendar-outline", iconoActivo: "calendar" },
  { id: "favoritos", label: "Favoritos", icono: "heart-outline", iconoActivo: "heart" },
  { id: "perfil", label: "Perfil", icono: "person-circle-outline", iconoActivo: "person-circle" },
];

/** Espacio inferior que las pantallas reservan para su contenido. */
export const TAB_BAR_ESPACIO = 112;

const PAD = 8;
const ESCALA_LUPA = 1.24;

export default function TabBar({
  activa,
  desplazamiento,
  onCambiar,
}: {
  activa: number;
  desplazamiento: Animated.AnimatedAddition<number>;
  onCambiar: (indice: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { modo } = useModoPedido();
  const [ancho, setAncho] = useState(0);
  const anchoItem = ancho > 0 ? (ancho - PAD * 2) / TABS.length : 0;

  const [arrastrando, setArrastrando] = useState(false);
  const [arrastreX] = useState(() => new Animated.Value(activa));

  const posicionVisual = arrastrando ? arrastreX : desplazamiento;

  function posicionDesdeX(x: number): number {
    if (anchoItem <= 0) return activa;
    const cruda = (x - PAD) / anchoItem;
    return Math.min(TABS.length - 1, Math.max(0, cruda));
  }

  function iniciarArrastre(x: number) {
    setArrastrando(true);
    arrastreX.setValue(posicionDesdeX(x));
  }
  function actualizarArrastre(x: number) {
    arrastreX.setValue(posicionDesdeX(x));
  }
  function soltarArrastre(x: number) {
    setArrastrando(false);
    onCambiar(Math.round(posicionDesdeX(x)));
  }

  const gesto = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(iniciarArrastre)(e.x);
    })
    .onUpdate((e) => {
      runOnJS(actualizarArrastre)(e.x);
    })
    .onFinalize((e) => {
      runOnJS(soltarArrastre)(e.x);
    });

  return (
    <GestureDetector gesture={gesto}>
      <BlurView
        intensity={55}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={[styles.dock, { bottom: Math.max(insets.bottom, 14) + 4 }]}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      >
        {anchoItem > 0 && (
          <Animated.View
            style={[
              styles.burbuja,
              {
                width: anchoItem - 8,
                transform: [
                  {
                    translateX: posicionVisual.interpolate({
                      inputRange: [0, TABS.length - 1],
                      outputRange: [PAD + 4, PAD + 4 + anchoItem * (TABS.length - 1)],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
        {TABS.map((item, i) => {
          const esActiva = i === activa;
          const escala = posicionVisual.interpolate({
            inputRange: [i - 1, i, i + 1],
            outputRange: [1, ESCALA_LUPA, 1],
            extrapolate: "clamp",
          });
          // La pestaña "Reservas" es la misma pantalla para Mesa y
          // To Go (0207) — el rótulo sigue el modo global para no
          // decir "Reservas" mientras adentro se ven pedidos.
          const label = item.id === "reservas" && modo === "togo" ? "Pedidos" : item.label;
          const icono = item.id === "reservas" && modo === "togo" ? "bag-handle-outline" : item.icono;
          const iconoActivo = item.id === "reservas" && modo === "togo" ? "bag-handle" : item.iconoActivo;
          return (
            <Pressable key={item.id} onPress={() => onCambiar(i)} style={styles.item}>
              <Animated.View style={{ transform: [{ scale: escala }] }}>
                <Ionicons
                  name={esActiva ? iconoActivo : icono}
                  size={21}
                  color={esActiva ? Colors.navy : Colors.inkMuted}
                />
              </Animated.View>
              <Text style={[styles.label, esActiva && styles.labelActiva]}>{label}</Text>
            </Pressable>
          );
        })}
      </BlurView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(22,41,94,0.1)",
    paddingHorizontal: PAD,
    paddingVertical: 8,
    shadowColor: "#101a2c",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 12,
  },
  burbuja: {
    backgroundColor: "rgba(22,41,94,0.08)",
    borderRadius: 21,
    bottom: 6,
    left: 0,
    position: "absolute",
    top: 6,
  },
  item: { alignItems: "center", flex: 1, gap: 2, paddingVertical: 4 },
  label: { color: Colors.inkMuted, fontFamily: Fonts.semiBold, fontSize: 9.5 },
  labelActiva: { color: Colors.navy, fontFamily: Fonts.bold },
});
