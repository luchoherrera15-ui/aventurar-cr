import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Spacing } from "@/constants/theme";
import TituloPantalla from "@/components/titulo-pantalla";
import TarjetaNegocio from "@/components/tarjeta-negocio";
import { Vacio } from "@/components/ui";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { CATEGORIA_LABEL, SUBCATEGORIAS, fmtColones } from "@/lib/types";
import { type Fila } from "@/pantallas/explorar";

/**
 * Pestaña de favoritos: todo lo que la persona marcó con el corazón en
 * el directorio, en un solo lugar. Se recarga cada vez que la pestaña
 * gana foco, porque los corazones se tocan desde Explorar y el detalle.
 * Usa la misma `TarjetaNegocio` que los cuatro directorios.
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
        <TituloPantalla kicker="Guardados" titulo="Favoritos" />
        <View style={styles.centro}>
          <Vacio
            icono="heart-outline"
            titulo="Iniciá sesión"
            texto="Entrá a tu cuenta para guardar y ver tus proveedores favoritos."
            accion={{
              texto: "Ir a mi perfil",
              onPress: () => router.replace("/?tab=perfil" as never),
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.raiz}>
      <TituloPantalla
        kicker="Guardados"
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
            <Vacio
              icono="heart-outline"
              titulo="Todavía no hay favoritos"
              texto="Tocá el corazón en cualquier tarjeta del directorio y aparece acá."
              accion={{
                texto: "Explorar proveedores",
                onPress: () => router.replace("/?tab=explorar" as never),
              }}
            />
          }
          renderItem={({ item }) => {
            const subLabel = item.subcategoria
              ? SUBCATEGORIAS[item.categoria]?.find((s) => s.id === item.subcategoria)?.label
              : null;
            return (
              <TarjetaNegocio
                nombre={item.nombre}
                foto={item.foto_url}
                etiqueta={subLabel ?? CATEGORIA_LABEL[item.categoria]}
                ubicacion={[item.canton, item.provincia].filter(Boolean).join(", ") || "Costa Rica"}
                precio={item.precio_desde !== null ? fmtColones(item.precio_desde) : null}
                cta="Reservar"
                favorito
                onToggleFavorito={() => quitar(item.id)}
                onPress={() => router.push(`/rancho/${item.id}`)}
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { backgroundColor: Colors.canvas, flex: 1 },
  centro: { flex: 1, justifyContent: "center", paddingHorizontal: Spacing.three },
  lista: {
    flexGrow: 1,
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: TAB_BAR_ESPACIO,
  },
});
