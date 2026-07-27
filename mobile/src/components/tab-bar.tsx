import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts } from "@/constants/theme";

const ITEMS = [
  { href: "/", label: "Explorar", icono: "🧭" },
  { href: "/cuenta", label: "Cuenta", icono: "👤" },
] as const;

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

  if (pathname !== "/" && pathname !== "/cuenta") return null;

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
            <Text style={[styles.icono, activo && styles.iconoActivo]}>{item.icono}</Text>
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
  item: { flex: 1, alignItems: "center", gap: 2 },
  icono: { fontSize: 20, opacity: 0.45 },
  iconoActivo: { opacity: 1 },
  label: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.inkSoft },
  labelActivo: { color: Colors.ink },
});
