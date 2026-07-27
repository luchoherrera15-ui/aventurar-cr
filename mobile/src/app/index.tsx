import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Colors, Spacing } from "@/constants/theme";
import {
  CATEGORIA_LABEL,
  CATEGORIAS,
  fmtColones,
  type Categoria,
  type Rancho,
} from "@/lib/types";

type Fila = Pick<
  Rancho,
  | "id"
  | "nombre"
  | "categoria"
  | "subcategoria"
  | "provincia"
  | "canton"
  | "precio_desde"
  | "foto_url"
>;

export default function DirectorioScreen() {
  const router = useRouter();
  const [ranchos, setRanchos] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [filtro, setFiltro] = useState<Categoria | "todos">("todos");

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from("ranchos")
      .select(
        "id, nombre, categoria, subcategoria, provincia, canton, precio_desde, foto_url",
      )
      .eq("estado", "aprobado")
      .order("created_at", { ascending: false });

    if (error) {
      setError("No se pudo cargar el directorio: " + error.message);
      return;
    }
    setRanchos((data ?? []) as Fila[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  async function alRefrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  const visibles =
    filtro === "todos"
      ? ranchos
      : (ranchos ?? []).filter((r) => r.categoria === filtro);

  return (
    <View style={styles.contenedor}>
      <View style={styles.filtros}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["todos", ...CATEGORIAS] as const}
          keyExtractor={(item) => item}
          contentContainerStyle={{ gap: Spacing.two, paddingHorizontal: Spacing.three }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setFiltro(item)}
              style={[styles.chip, filtro === item && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, filtro === item && styles.chipTextoActivo]}>
                {item === "todos" ? "Todos" : CATEGORIA_LABEL[item]}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {ranchos === null && !error && (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      )}

      {error && (
        <View style={styles.centro}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      {ranchos !== null && !error && (
        <FlatList
          data={visibles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          onRefresh={alRefrescar}
          refreshing={refrescando}
          ListEmptyComponent={
            <View style={styles.centro}>
              <Text style={styles.vacioTexto}>
                Todavía no hay proveedores en esta categoría.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/rancho/${item.id}`)}
            >
              <Image
                source={item.foto_url ? { uri: item.foto_url } : undefined}
                style={styles.foto}
                contentFit="cover"
                transition={150}
                alt={item.nombre}
              />
              <View style={styles.cardCuerpo}>
                <Text style={styles.etiqueta}>
                  {CATEGORIA_LABEL[item.categoria]}
                </Text>
                <Text style={styles.nombre} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <Text style={styles.ubicacion} numberOfLines={1}>
                  {[item.canton, item.provincia].filter(Boolean).join(", ") ||
                    "Costa Rica"}
                </Text>
                {item.precio_desde !== null && (
                  <Text style={styles.precio}>
                    Desde {fmtColones(item.precio_desde)}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  filtros: { paddingVertical: Spacing.three, backgroundColor: Colors.surface },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: Colors.cream2,
  },
  chipActivo: { backgroundColor: Colors.accent },
  chipTexto: { fontSize: 13, fontWeight: "700", color: Colors.inkSoft },
  chipTextoActivo: { color: "#ffffff" },
  lista: { padding: Spacing.three, gap: Spacing.three },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five },
  error: { color: Colors.danger, textAlign: "center" },
  vacioTexto: { color: Colors.inkSoft, textAlign: "center" },
  card: {
    borderRadius: 16,
    backgroundColor: Colors.surface,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.line,
  },
  foto: { width: "100%", height: 160, backgroundColor: Colors.cream2 },
  cardCuerpo: { padding: Spacing.three, gap: 2 },
  etiqueta: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.accent,
  },
  nombre: { fontSize: 17, fontWeight: "800", color: Colors.ink },
  ubicacion: { fontSize: 13, color: Colors.inkSoft },
  precio: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginTop: 4 },
});
