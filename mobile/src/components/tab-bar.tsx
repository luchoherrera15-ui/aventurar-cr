import { useState } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";
import type { IdPestana } from "@/lib/pestanas";

type IconoNombre = keyof typeof Ionicons.glyphMap;

/** Las CUATRO secciones raíz: inicio (la de aterrizaje), las promos,
 * lo reservado y la cuenta. El orden acá ES el orden de las páginas
 * del pager. El id "explorar" quedó como identificador interno (lo
 * usan `?tab=explorar` y los botones "Explorar" de los estados
 * vacíos) aunque la pestaña se llame Inicio — Eventos pasó a pantalla
 * aparte (`/eventos`).
 *
 * ── POR QUÉ YA NO ESTÁ "MENSAJES" ──────────────────────────────────
 * El producto se mueve a "lo más automatizado posible": nadie le
 * escribe a una tienda por gusto. La única conversación que queda es
 * la CONSULTA de una reserva de Eventos/Ranchos, y se abre desde el
 * botón "Consultar" de la página de ese negocio — no desde una bandeja
 * general. Las consultas abiertas se leen en Perfil › Consultas. */
export const TABS: {
  id: IdPestana;
  label: string;
  icono: IconoNombre;
  iconoActivo: IconoNombre;
}[] = [
  { id: "explorar", label: "Inicio", icono: "home-outline", iconoActivo: "home" },
  { id: "promos", label: "Promos", icono: "pricetag-outline", iconoActivo: "pricetag" },
  { id: "reservas", label: "Reservas", icono: "calendar-outline", iconoActivo: "calendar" },
  { id: "perfil", label: "Perfil", icono: "person-circle-outline", iconoActivo: "person-circle" },
];

/** Espacio inferior que las pantallas reservan para que su contenido
 * pueda pasar (y verse) por detrás del dock sin quedar tapado al
 * llegar al final del scroll. */
export const TAB_BAR_ESPACIO = 112;

/** Padding horizontal interno del dock — la burbuja se alinea con él. */
const PAD = 8;

/**
 * La barra inferior como dock flotante de vidrio: despegada de los
 * bordes, con esquinas redondas, blur y sombra — el contenido se ve
 * pasar por detrás y por debajo. Una burbuja navy suave acompaña el
 * dedo de forma continua mientras se desliza entre pestañas (recibe
 * `desplazamiento` = posición + corrimiento del pager). Es nuestra en
 * vez de un tab bar nativo para verse igual en iOS, Android y web.
 */
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
  const [ancho, setAncho] = useState(0);
  const anchoItem = ancho > 0 ? (ancho - PAD * 2) / TABS.length : 0;

  return (
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
                  translateX: desplazamiento.interpolate({
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
        return (
          <Pressable key={item.id} onPress={() => onCambiar(i)} style={styles.item}>
            <Ionicons
              name={esActiva ? item.iconoActivo : item.icono}
              size={23}
              color={esActiva ? Colors.navy : "#7a7f8c"}
            />
            <Text style={[styles.label, esActiva && styles.labelActiva]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </BlurView>
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
    // El blur pone lo suyo; este blanco al 60% mantiene el dock
    // legible incluso en Android sin blur nativo.
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(22,41,94,0.1)",
    paddingHorizontal: PAD,
    paddingVertical: 8,
    // Sombra de flote — es lo que despega el dock del contenido.
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
  label: { color: "#7a7f8c", fontFamily: Fonts.semiBold, fontSize: 10 },
  labelActiva: { color: Colors.navy, fontFamily: Fonts.bold },
});
