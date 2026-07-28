import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";

type IconoNombre = keyof typeof Ionicons.glyphMap;

/** Las cinco secciones raíz, al estilo Airbnb: descubrir, lo guardado,
 * lo reservado, las conversaciones y la cuenta. El orden acá ES el
 * orden de las páginas del pager. */
export const TABS: {
  id: "explorar" | "favoritos" | "reservas" | "mensajes" | "perfil";
  label: string;
  icono: IconoNombre;
  iconoActivo: IconoNombre;
}[] = [
  { id: "explorar", label: "Explorar", icono: "search-outline", iconoActivo: "search" },
  { id: "favoritos", label: "Favoritos", icono: "heart-outline", iconoActivo: "heart" },
  { id: "reservas", label: "Reservas", icono: "calendar-outline", iconoActivo: "calendar" },
  { id: "mensajes", label: "Mensajes", icono: "chatbubble-outline", iconoActivo: "chatbubble" },
  { id: "perfil", label: "Perfil", icono: "person-circle-outline", iconoActivo: "person-circle" },
];

/**
 * Barra inferior controlada por el pager (las pestañas también se
 * cambian deslizando la pantalla): recibe cuál está activa y avisa
 * cuando se toca otra. Es nuestra en vez de un tab bar nativo para
 * verse igual en iOS, Android y web.
 */
export default function TabBar({
  activa,
  onCambiar,
}: {
  activa: number;
  onCambiar: (indice: number) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.contenedor, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((item, i) => {
        const esActiva = i === activa;
        return (
          <Pressable key={item.id} onPress={() => onCambiar(i)} style={styles.item}>
            <Ionicons
              name={esActiva ? item.iconoActivo : item.icono}
              size={24}
              color={esActiva ? Colors.navy : "#8a8a8a"}
            />
            <Text style={[styles.label, esActiva && styles.labelActiva]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: "center", gap: 3 },
  label: { fontFamily: Fonts.semiBold, fontSize: 10.5, color: "#8a8a8a" },
  labelActiva: { color: Colors.navy, fontFamily: Fonts.bold },
});
