import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import {
  CATEGORIA_LABEL,
  CATEGORIAS,
  fmtColones,
  type Categoria,
  type Rancho,
} from "@/lib/types";

type IconoNombre = keyof typeof Ionicons.glyphMap;

/** Íconos de línea (nada de emojis) para la barra de categorías, en
 * el mismo espíritu sobrio de la fila de categorías de Airbnb. */
const CATEGORIA_ICONO: Record<Categoria, IconoNombre> = {
  lugares: "home-outline",
  alimentacion: "restaurant-outline",
  animacion: "musical-notes-outline",
  organizacion: "clipboard-outline",
  decoracion: "balloon-outline",
  otros: "sparkles-outline",
};

const TAB_BAR_ESPACIO = 84;

export type Fila = Pick<
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
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [ranchos, setRanchos] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [filtro, setFiltro] = useState<Categoria | "todos">("todos");
  const [query, setQuery] = useState("");
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia al cerrar sesión
      setFavoritos(new Set());
      return;
    }
    let vigente = true;
    supabase
      .from("favoritos")
      .select("rancho_id")
      .eq("cliente_id", session.user.id)
      .then(({ data }) => {
        if (vigente) setFavoritos(new Set((data ?? []).map((f) => f.rancho_id as string)));
      });
    return () => {
      vigente = false;
    };
  }, [session]);

  const alternarFavorito = useCallback(
    async (ranchoId: string) => {
      if (!session) {
        router.push("/cuenta");
        return;
      }
      const yaEsFavorito = favoritos.has(ranchoId);
      setFavoritos((prev) => {
        const siguiente = new Set(prev);
        if (yaEsFavorito) siguiente.delete(ranchoId);
        else siguiente.add(ranchoId);
        return siguiente;
      });
      const { error } = yaEsFavorito
        ? await supabase
            .from("favoritos")
            .delete()
            .eq("cliente_id", session.user.id)
            .eq("rancho_id", ranchoId)
        : await supabase.from("favoritos").insert({ cliente_id: session.user.id, rancho_id: ranchoId });
      if (error) {
        // Revierte si el servidor lo rechazó — no dejamos el corazón mintiendo.
        setFavoritos((prev) => {
          const siguiente = new Set(prev);
          if (yaEsFavorito) siguiente.add(ranchoId);
          else siguiente.delete(ranchoId);
          return siguiente;
        });
      }
    },
    [session, favoritos, router],
  );

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

  const q = query.trim().toLowerCase();
  const coincide = useCallback(
    (r: Fila) =>
      !q ||
      r.nombre.toLowerCase().includes(q) ||
      (r.provincia ?? "").toLowerCase().includes(q) ||
      (r.canton ?? "").toLowerCase().includes(q),
    [q],
  );

  const buscando = q.length > 0 || filtro !== "todos";

  const listaFiltrada = useMemo(() => {
    if (!ranchos) return [];
    return ranchos
      .filter((r) => filtro === "todos" || r.categoria === filtro)
      .filter(coincide);
  }, [ranchos, filtro, coincide]);

  const rieles = useMemo(() => {
    if (!ranchos) return [];
    return CATEGORIAS.map((cat) => ({
      categoria: cat,
      items: ranchos.filter((r) => r.categoria === cat).filter(coincide),
    })).filter((r) => r.items.length > 0);
  }, [ranchos, coincide]);

  return (
    <View style={styles.contenedor}>
      {/* Sin barra nativa en las pestañas: el buscador arranca justo
          debajo del notch, como el Explore de Airbnb. */}
      <View style={[styles.busquedaArea, { paddingTop: insets.top + Spacing.three }]}>
        <View style={styles.busquedaPill}>
          <Ionicons name="search" size={17} color={Colors.ink} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscá por nombre, provincia o cantón"
            placeholderTextColor={Colors.inkSoft}
            style={styles.busquedaInput}
          />
        </View>
      </View>

      <View style={styles.categoriasArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriasFila}>
          <CategoriaTab
            icono="compass-outline"
            label="Todos"
            activo={filtro === "todos"}
            onPress={() => setFiltro("todos")}
          />
          {CATEGORIAS.map((cat) => (
            <CategoriaTab
              key={cat}
              icono={CATEGORIA_ICONO[cat]}
              label={CATEGORIA_LABEL[cat]}
              activo={filtro === cat}
              onPress={() => setFiltro(cat)}
            />
          ))}
        </ScrollView>
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

      {ranchos !== null && !error && buscando && (
        <FlatList
          data={listaFiltrada}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listaVertical}
          onRefresh={alRefrescar}
          refreshing={refrescando}
          ListEmptyComponent={
            <View style={styles.centro}>
              <Text style={styles.vacioTexto}>
                No encontramos proveedores con esa búsqueda.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TarjetaRancho
              item={item}
              ancho="completo"
              onPress={() => router.push(`/rancho/${item.id}`)}
              favorito={favoritos.has(item.id)}
              onToggleFavorito={() => alternarFavorito(item.id)}
            />
          )}
        />
      )}

      {ranchos !== null && !error && !buscando && (
        <ScrollView
          contentContainerStyle={styles.rieles}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={alRefrescar} />}
        >
          {rieles.length === 0 && (
            <View style={styles.centro}>
              <Text style={styles.vacioTexto}>Todavía no hay proveedores publicados.</Text>
            </View>
          )}
          {rieles.map((riel) => (
            <View key={riel.categoria} style={styles.riel}>
              <View style={styles.rielTitulo}>
                <Text style={styles.rielTituloTexto}>
                  {CATEGORIA_LABEL[riel.categoria]} para tu evento
                </Text>
                <Pressable style={styles.verTodosBoton} onPress={() => setFiltro(riel.categoria)}>
                  <Ionicons name="chevron-forward" size={16} color={Colors.ink} />
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rielLista}
              >
                {riel.items.map((item) => (
                  <TarjetaRancho
                    key={item.id}
                    item={item}
                    ancho="riel"
                    onPress={() => router.push(`/rancho/${item.id}`)}
                    favorito={favoritos.has(item.id)}
                          onToggleFavorito={() => alternarFavorito(item.id)}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function CategoriaTab({
  icono,
  label,
  activo,
  onPress,
}: {
  icono: IconoNombre;
  label: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.categoriaTab, activo && styles.categoriaTabActiva]}>
      <Ionicons name={icono} size={22} color={activo ? Colors.ink : "#8a8a8a"} />
      <Text style={[styles.categoriaLabel, activo && styles.categoriaLabelActiva]}>{label}</Text>
    </Pressable>
  );
}

export function TarjetaRancho({
  item,
  ancho,
  onPress,
  favorito = false,
  onToggleFavorito,
}: {
  item: Fila;
  ancho: "riel" | "completo";
  onPress: () => void;
  favorito?: boolean;
  onToggleFavorito?: () => void;
}) {
  const ubicacion = [item.canton, item.provincia].filter(Boolean).join(", ") || "Costa Rica";
  return (
    <Pressable
      style={ancho === "riel" ? styles.tarjetaRiel : styles.tarjetaCompleta}
      onPress={onPress}
    >
      <View>
        <Image
          source={item.foto_url ? { uri: item.foto_url } : undefined}
          style={ancho === "riel" ? styles.fotoRiel : styles.fotoCompleta}
          contentFit="cover"
          transition={150}
          alt={item.nombre}
        />
        {onToggleFavorito && (
          <Pressable
            style={styles.botonFavorito}
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorito();
            }}
          >
            {/* Corazón estilo Airbnb: relleno translúcido con borde
                blanco encima, para que se lea sobre cualquier foto. */}
            <View>
              <Ionicons
                name="heart"
                size={24}
                color={favorito ? Colors.navy : "rgba(16,22,34,0.5)"}
              />
              <Ionicons
                name="heart-outline"
                size={24}
                color="#ffffff"
                style={StyleSheet.absoluteFill}
              />
            </View>
          </Pressable>
        )}
      </View>
      <View style={styles.tarjetaCuerpo}>
        <Text style={styles.etiqueta}>{CATEGORIA_LABEL[item.categoria]}</Text>
        <Text style={styles.nombre} numberOfLines={1}>
          {item.nombre}
        </Text>
        <Text style={styles.ubicacion} numberOfLines={1}>
          {ubicacion}
        </Text>
        {item.precio_desde !== null && (
          <Text style={styles.precio}>Desde {fmtColones(item.precio_desde)}</Text>
        )}
      </View>
    </Pressable>
  );
}

const ANCHO_RIEL = 220;

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  busquedaArea: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, backgroundColor: Colors.surface },
  busquedaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Colors.cream2,
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: 13,
  },
  busquedaInput: { flex: 1, fontFamily: Fonts.semiBold, fontSize: 14.5, color: Colors.ink, padding: 0 },
  categoriasArea: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.line },
  categoriasFila: { gap: Spacing.four, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  categoriaTab: { alignItems: "center", gap: 6, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  categoriaTabActiva: { borderBottomColor: Colors.ink },
  categoriaLabel: { fontFamily: Fonts.semiBold, fontSize: 11.5, color: Colors.inkSoft },
  categoriaLabelActiva: { color: Colors.ink },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five },
  error: { color: Colors.danger, textAlign: "center", fontFamily: Fonts.medium },
  vacioTexto: { color: Colors.inkSoft, textAlign: "center", fontFamily: Fonts.medium },
  listaVertical: { padding: Spacing.three, gap: Spacing.four, paddingBottom: TAB_BAR_ESPACIO },
  rieles: { paddingVertical: Spacing.four, paddingBottom: TAB_BAR_ESPACIO, gap: Spacing.five },
  riel: { gap: Spacing.three },
  rielTitulo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
  },
  rielTituloTexto: {
    fontFamily: Fonts.extraBold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: Colors.ink,
    flexShrink: 1,
  },
  verTodosBoton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.cream2,
    alignItems: "center",
    justifyContent: "center",
  },
  rielLista: { gap: Spacing.three, paddingHorizontal: Spacing.three },
  tarjetaRiel: { width: ANCHO_RIEL },
  tarjetaCompleta: {},
  fotoRiel: { width: ANCHO_RIEL, height: 170, borderRadius: 16, backgroundColor: Colors.cream2 },
  fotoCompleta: { width: "100%", height: 200, borderRadius: 16, backgroundColor: Colors.cream2 },
  botonFavorito: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tarjetaCuerpo: { paddingTop: Spacing.two, gap: 2 },
  etiqueta: {
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.accent,
  },
  nombre: { fontSize: 16, fontFamily: Fonts.extraBold, letterSpacing: -0.2, color: Colors.ink },
  ubicacion: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.inkSoft },
  precio: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.ink, marginTop: 2 },
});
