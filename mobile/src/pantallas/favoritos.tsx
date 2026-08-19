import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Spacing } from "@/constants/theme";
import BarraSuperior from "@/components/barra-superior";
import TarjetaNegocio from "@/components/tarjeta-negocio";
import { Vacio } from "@/components/ui";
import { CATEGORIA_LABEL, SUBCATEGORIAS, enConfiguracion, fmtColones } from "@/lib/types";
import { type Fila } from "@/pantallas/explorar";

/**
 * FAVORITOS — lo que esta persona guardó con el corazón.
 *
 * ── POR QUÉ YA NO ES UNA PESTAÑA ───────────────────────────────────
 * Esta pantalla compartía la segunda pestaña con las promos, y el
 * dueño lo cortó: «Promos es una cosa y Favoritos es otra». Tenía
 * razón — una es lo que los negocios ofrecen (les sirve a ellos) y la
 * otra es lo que esta persona guardó (le sirve a ella). Mezcladas, la
 * pestaña no era de ninguna de las dos.
 *
 * Ahora es pantalla propia y se entra por Perfil › Favoritos, que es
 * donde ya estaba la puerta (`perfil.tsx`, la fila del corazón).
 *
 * Por eso lleva `BarraSuperior` con su flecha de volver: una pantalla
 * a la que se ENTRA necesita salida, cosa que una pestaña no.
 */
export default function FavoritosScreen() {
  const router = useRouter();
  const { session, cargando } = useAuth();
  const [favoritos, setFavoritos] = useState<Fila[] | null>(null);

  const cargar = useCallback(() => {
    if (!session) return;
    let vigente = true;
    supabase
      .from("favoritos")
      // `detalles` trae `en_configuracion`: un favorito que el dueño
      // puso en pausa se marca y no se abre, igual que en el directorio.
      .select(
        "ranchos(id, nombre, categoria, subcategoria, provincia, canton, precio_desde, foto_url, detalles)",
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

  // Recarga al ganar foco: los corazones se tocan desde el directorio
  // y desde la ficha de cada negocio, y al volver acá tienen que estar
  // reflejados.
  useFocusEffect(cargar);

  useEffect(() => {
    return cargar();
  }, [cargar]);

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
      <View style={estilos.raiz}>
        <BarraSuperior titulo="Favoritos" />
        <View style={estilos.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={estilos.raiz}>
        <BarraSuperior titulo="Favoritos" />
        <View style={estilos.centro}>
          <Vacio
            icono="heart-outline"
            titulo="Iniciá sesión"
            texto="Entrá a tu cuenta para guardar y ver tus negocios favoritos."
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
    <View style={estilos.raiz}>
      <BarraSuperior titulo="Favoritos" />
      {favoritos === null ? (
        <View style={estilos.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={favoritos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[estilos.lista, favoritos.length === 0 && estilos.listaVacia]}
          ListEmptyComponent={
            <Vacio
              icono="heart-outline"
              titulo="Todavía no guardaste ninguno"
              texto="Tocá el corazón en cualquier tarjeta del directorio y aparece acá."
              accion={{
                texto: "Ver negocios",
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
                ubicacion={
                  [item.canton, item.provincia].filter(Boolean).join(", ") || "Costa Rica"
                }
                precio={item.precio_desde !== null ? fmtColones(item.precio_desde) : null}
                pausado={enConfiguracion(item.detalles)}
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

const estilos = StyleSheet.create({
  raiz: { backgroundColor: Colors.canvas, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center", padding: Spacing.three },
  lista: { gap: Spacing.three, padding: Spacing.three },
  listaVacia: { flexGrow: 1, justifyContent: "center" },
});
