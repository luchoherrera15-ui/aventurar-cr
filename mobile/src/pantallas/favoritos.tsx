import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import TituloPantalla from "@/components/titulo-pantalla";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { TarjetaRancho, type Fila } from "@/pantallas/explorar";

/**
 * Pestaña de favoritos, espejo de los "wishlists" de Airbnb: todo lo
 * que la persona marcó con el corazón en el directorio, en un solo
 * lugar. Se recarga cada vez que la pestaña gana foco, porque los
 * corazones se tocan desde Explorar y el detalle.
 */
export default function FavoritosScreen({ activa = true }: { activa?: boolean }) {
  const router = useRouter();
  const { session, cargando } = useAuth();
  const [favoritos, setFavoritos] = useState<Fila[] | null>(null);

  const cargar = useCallback(() => {
    if (!session) return;
    let vigente = true;
    supabase
      .from("favoritos")
      .select(
        "ranchos(id, nombre, categoria, subcategoria, provincia, canton, precio_desde, foto_url)",
      )
      .eq("cliente_id", session.user.id)
      .then(({ data }) => {
        if (!vigente) return;
        setFavoritos(
          ((data ?? []) as unknown as { ranchos: Fila | null }[])
            .map((f) => f.ranchos)
            .filter((r): r is Fila => r !== null),
        );
      });
    return () => {
      vigente = false;
    };
  }, [session]);

  // Recarga al ganar foco (volver de una pantalla de detalle) y al
  // deslizar hasta esta página del pager — los corazones se tocan
  // desde Explorar y tienen que reflejarse acá al instante.
  useFocusEffect(cargar);
  useEffect(() => {
    if (activa) return cargar();
  }, [activa, cargar]);

  async function quitar(ranchoId: string) {
    if (!session) return;
    setFavoritos((prev) => (prev ?? []).filter((r) => r.id !== ranchoId));
    await supabase
      .from("favoritos")
      .delete()
      .eq("cliente_id", session.user.id)
      .eq("rancho_id", ranchoId);
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.raiz}>
        <TituloPantalla titulo="Favoritos" />
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>Iniciá sesión</Text>
          <Text style={styles.vacioTexto}>
            Entrá a tu cuenta para guardar y ver tus proveedores favoritos.
          </Text>
          <Pressable style={styles.boton} onPress={() => router.replace("/?tab=perfil" as never)}>
            <Text style={styles.botonTexto}>Ir a mi perfil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.raiz}>
      <TituloPantalla
        titulo="Favoritos"
        subtitulo="Los proveedores que guardaste con el corazón."
      />
      {favoritos === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={favoritos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={
            <View style={styles.centro}>
              <Text style={styles.vacioTitulo}>Todavía no hay favoritos</Text>
              <Text style={styles.vacioTexto}>
                Tocá el corazón en cualquier tarjeta del directorio y aparece
                acá.
              </Text>
              <Pressable style={styles.boton} onPress={() => router.replace("/?tab=explorar" as never)}>
                <Text style={styles.botonTexto}>Explorar proveedores</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <TarjetaRancho
              item={item}
              ancho="completo"
              favorito
              onPress={() => router.push(`/rancho/${item.id}`)}
              onToggleFavorito={() => quitar(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five, gap: Spacing.two },
  lista: { padding: Spacing.three, gap: Spacing.four, paddingBottom: TAB_BAR_ESPACIO, flexGrow: 1 },
  vacioTitulo: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink, textAlign: "center" },
  vacioTexto: { fontSize: 13.5, color: Colors.inkSoft, textAlign: "center", lineHeight: 19 },
  boton: {
    marginTop: Spacing.two,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
  },
  botonTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 13.5 },
});
