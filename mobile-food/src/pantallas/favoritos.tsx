import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Tipo } from "@/constants/theme";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { useAuth } from "@/lib/auth-context";
import { cargarFavoritosIds, cargarTarjetasFood, type TarjetaFood } from "@/lib/food-datos";
import TarjetaRestaurante from "@/components/tarjeta-restaurante";

/**
 * Favoritos — espejo de /food/favoritos en /web: el mismo
 * `food_favoritos` real, no una lista local. Se recarga al ganar foco
 * porque el corazón se puede tocar desde Inicio o Descubrir y hay que
 * reflejar el quite acá también.
 */
export default function Favoritos({ activa }: { activa: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, cargando } = useAuth();
  const [tarjetas, setTarjetas] = useState<TarjetaFood[] | null>(null);
  const [favoritos, setFavoritos] = useState<Set<string> | null>(null);

  const cargar = useCallback(() => {
    if (!session) return;
    let vigente = true;
    Promise.all([cargarTarjetasFood(), cargarFavoritosIds(session.user.id)]).then(([t, f]) => {
      if (!vigente) return;
      setTarjetas(t);
      setFavoritos(f);
    });
    return () => {
      vigente = false;
    };
  }, [session]);

  useFocusEffect(cargar);
  useEffect(() => {
    if (activa) cargar();
  }, [activa, cargar]);

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.contenedor, { paddingTop: insets.top + Spacing.three }]}>
        <View style={styles.vacio}>
          <Ionicons name="heart-outline" size={30} color={Colors.inkMuted} />
          <Text style={Tipo.titulo2}>Iniciá sesión</Text>
          <Text style={styles.vacioTexto}>Guardá tus restaurantes favoritos para encontrarlos rápido.</Text>
          <Pressable style={styles.botonPrimario} onPress={() => router.push("/?tab=perfil")}>
            <Text style={styles.botonPrimarioTexto}>Ir a mi perfil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const favoritas = favoritos ? (tarjetas ?? []).filter((t) => favoritos.has(t.id)) : [];

  return (
    <View style={[styles.contenedor, { paddingTop: insets.top + Spacing.three }]}>
      <FlatList
        data={favoritas}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: TAB_BAR_ESPACIO, paddingHorizontal: Spacing.four }}
        ListHeaderComponent={<Text style={[Tipo.titulo1, { marginBottom: Spacing.three }]}>Favoritos</Text>}
        renderItem={({ item }) => <TarjetaRestaurante tarjeta={item} favorito logueado />}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        ListEmptyComponent={
          tarjetas === null ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.five }} />
          ) : (
            <View style={styles.vacioInline}>
              <Ionicons name="heart-outline" size={26} color={Colors.inkMuted} />
              <Text style={styles.vacioTexto}>
                Todavía no marcaste ningún restaurante. Tocá el corazón en cualquier tarjeta.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.canvas },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  vacio: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.two, paddingHorizontal: Spacing.five },
  vacioInline: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.six },
  vacioTexto: { ...Tipo.cuerpo, textAlign: "center" },
  botonPrimario: { marginTop: Spacing.two, backgroundColor: Colors.navy, borderRadius: Radios.lg, paddingHorizontal: Spacing.four, paddingVertical: 12 },
  botonPrimarioTexto: { color: "#fff", fontFamily: Fonts.bold, fontSize: 14 },
});
