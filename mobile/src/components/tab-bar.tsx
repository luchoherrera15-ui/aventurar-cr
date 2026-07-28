import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";

type IconoNombre = keyof typeof Ionicons.glyphMap;

/** Las cinco secciones raíz, al estilo Airbnb: descubrir, lo guardado,
 * lo reservado, las conversaciones y la cuenta. */
const ITEMS: {
  href: "/" | "/favoritos" | "/reservas" | "/mensajes" | "/cuenta";
  label: string;
  icono: IconoNombre;
  iconoActivo: IconoNombre;
}[] = [
  { href: "/", label: "Explorar", icono: "search-outline", iconoActivo: "search" },
  { href: "/favoritos", label: "Favoritos", icono: "heart-outline", iconoActivo: "heart" },
  { href: "/reservas", label: "Reservas", icono: "calendar-outline", iconoActivo: "calendar" },
  { href: "/mensajes", label: "Mensajes", icono: "chatbubble-outline", iconoActivo: "chatbubble" },
  { href: "/cuenta", label: "Perfil", icono: "person-circle-outline", iconoActivo: "person-circle" },
];

export const RUTAS_CON_BARRA = new Set(ITEMS.map((i) => i.href as string));

/**
 * Barra propia en vez de NativeTabs (expo-router/unstable-native-tabs):
 * esa API todavía es inestable y delega el render al tab bar nativo de
 * cada plataforma, con estilos limitados. Esta versión la controlamos
 * por completo y se ve igual en iOS, Android y web.
 */
export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!RUTAS_CON_BARRA.has(pathname)) return null;

  return (
    <View style={[styles.contenedor, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {ITEMS.map((item) => {
        const activo = pathname === item.href;
        return (
          <Pressable
            key={item.href}
            onPress={() => router.replace(item.href)}
            style={styles.item}
          >
            <Ionicons
              name={activo ? item.iconoActivo : item.icono}
              size={24}
              color={activo ? Colors.navy : "#8a8a8a"}
            />
            <Text style={[styles.label, activo && styles.labelActivo]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: "center", gap: 3 },
  label: { fontFamily: Fonts.semiBold, fontSize: 10.5, color: "#8a8a8a" },
  labelActivo: { color: Colors.navy, fontFamily: Fonts.bold },
});
