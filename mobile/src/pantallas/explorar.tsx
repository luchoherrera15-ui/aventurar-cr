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
  SUBCATEGORIAS,
  fmtColones,
  type Categoria,
  type Rancho,
} from "@/lib/types";

type Calificacion = { promedio: number; total: number };

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
  | "destacado_orden"
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- el pager pasa `activa` a todas las pestañas; Explorar no la necesita (carga al montar y con pull-refresh)
export default function DirectorioScreen({ activa = true }: { activa?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [ranchos, setRanchos] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [filtro, setFiltro] = useState<Categoria | "todos">("todos");
  const [subcategoria, setSubcategoria] = useState("");
  const [calificaciones, setCalificaciones] = useState<Record<string, Calificacion>>({});
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
    const [{ data, error }, { data: califData }] = await Promise.all([
      supabase
        .from("ranchos")
        .select(
          "id, nombre, categoria, subcategoria, provincia, canton, precio_desde, foto_url, destacado_orden",
        )
        .eq("estado", "aprobado")
        .order("created_at", { ascending: false }),
      // Calificación real, igual que las tarjetas de la web: sin
      // reseñas no se muestran estrellas — nunca un número inventado.
      supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
    ]);

    if (error) {
      setError("No se pudo cargar el directorio: " + error.message);
      return;
    }
    const califs: Record<string, Calificacion> = {};
    for (const c of (califData ?? []) as { rancho_id: string; promedio: number; total: number }[]) {
      califs[c.rancho_id] = { promedio: c.promedio, total: c.total };
    }
    setCalificaciones(califs);
    // Destacados del admin de primeros — el mismo orden que la web.
    // (sort estable: el resto conserva el más-nuevo-primero)
    setRanchos(
      ((data ?? []) as Fila[]).sort(
        (a, b) => (a.destacado_orden ?? Infinity) - (b.destacado_orden ?? Infinity),
      ),
    );
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
      .filter((r) => !subcategoria || r.subcategoria === subcategoria)
      .filter(coincide);
  }, [ranchos, filtro, subcategoria, coincide]);

  // Conteos por subcategoría de la categoría activa, para las
  // pastillas del segundo nivel (solo se muestran las que tienen algo).
  const conteoSubcategorias = useMemo(() => {
    const acc: Record<string, number> = {};
    if (!ranchos || filtro === "todos") return acc;
    for (const r of ranchos) {
      if (r.categoria === filtro && r.subcategoria) {
        acc[r.subcategoria] = (acc[r.subcategoria] ?? 0) + 1;
      }
    }
    return acc;
  }, [ranchos, filtro]);

  const totalCategoria = useMemo(
    () =>
      !ranchos || filtro === "todos"
        ? 0
        : ranchos.filter((r) => r.categoria === filtro).length,
    [ranchos, filtro],
  );

  function elegirCategoria(c: Categoria | "todos") {
    setFiltro(c);
    setSubcategoria("");
  }

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

      {/* Barra de dos niveles, igual que la web: las categorías, y al
          entrar a una, la misma barra muta a sus subcategorías con un
          botón de volver. */}
      <View style={styles.categoriasArea}>
        {filtro === "todos" ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriasFila}>
            <CategoriaTab
              icono="compass-outline"
              label="Todos"
              activo
              onPress={() => elegirCategoria("todos")}
            />
            {CATEGORIAS.map((cat) => (
              <CategoriaTab
                key={cat}
                icono={CATEGORIA_ICONO[cat]}
                label={CATEGORIA_LABEL[cat]}
                activo={false}
                onPress={() => elegirCategoria(cat)}
              />
            ))}
          </ScrollView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subcatFila}
          >
            <Pressable style={styles.volverChip} onPress={() => elegirCategoria("todos")}>
              <Ionicons name="chevron-back" size={14} color={Colors.ink} />
              <Text style={styles.volverTexto}>Volver</Text>
            </Pressable>
            <View style={styles.subcatCategoria}>
              <Ionicons name={CATEGORIA_ICONO[filtro]} size={15} color={Colors.accent} />
              <Text style={styles.subcatCategoriaTexto}>{CATEGORIA_LABEL[filtro]}</Text>
            </View>
            <SubcatPill
              label={`Todo (${totalCategoria})`}
              activo={!subcategoria}
              onPress={() => setSubcategoria("")}
            />
            {SUBCATEGORIAS[filtro]
              .filter((s) => (conteoSubcategorias[s.id] ?? 0) > 0)
              .map((s) => (
                <SubcatPill
                  key={s.id}
                  label={`${s.label} (${conteoSubcategorias[s.id]})`}
                  activo={subcategoria === s.id}
                  onPress={() =>
                    setSubcategoria((prev) => (prev === s.id ? "" : s.id))
                  }
                />
              ))}
          </ScrollView>
        )}
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
              calificacion={calificaciones[item.id] ?? null}
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
                <Pressable style={styles.verTodosBoton} onPress={() => elegirCategoria(riel.categoria)}>
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
                    calificacion={calificaciones[item.id] ?? null}
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
  calificacion = null,
  onPress,
  favorito = false,
  onToggleFavorito,
}: {
  item: Fila;
  ancho: "riel" | "completo";
  calificacion?: Calificacion | null;
  onPress: () => void;
  favorito?: boolean;
  onToggleFavorito?: () => void;
}) {
  const ubicacion = [item.canton, item.provincia].filter(Boolean).join(", ") || "Costa Rica";
  const subLabel = item.subcategoria
    ? SUBCATEGORIAS[item.categoria]?.find((s) => s.id === item.subcategoria)?.label
    : null;
  const grande = ancho === "completo";

  const corazon = onToggleFavorito && (
    <Pressable
      style={grande ? styles.corazonChip : styles.botonFavorito}
      hitSlop={8}
      onPress={(e) => {
        e.stopPropagation();
        onToggleFavorito();
      }}
    >
      {grande ? (
        <Ionicons
          name={favorito ? "heart" : "heart-outline"}
          size={17}
          color={favorito ? Colors.accent : Colors.inkSoft}
        />
      ) : (
        /* Corazón estilo Airbnb sobre la foto: relleno translúcido con
           borde blanco, para que se lea sobre cualquier imagen. */
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
      )}
    </Pressable>
  );

  return (
    <Pressable
      style={grande ? styles.tarjetaCompleta : styles.tarjetaRiel}
      onPress={onPress}
    >
      <View>
        <Image
          source={item.foto_url ? { uri: item.foto_url } : undefined}
          style={grande ? styles.fotoCompleta : styles.fotoRiel}
          contentFit="cover"
          transition={150}
          alt={item.nombre}
        />
        {!grande && corazon}
      </View>
      <View style={grande ? styles.tarjetaCuerpoGrande : styles.tarjetaCuerpo}>
        {grande ? (
          <View style={styles.nombreFila}>
            <Text style={[styles.nombre, { flex: 1 }]} numberOfLines={1}>
              {item.nombre}
            </Text>
            {corazon}
          </View>
        ) : (
          <>
            <Text style={styles.etiqueta}>{CATEGORIA_LABEL[item.categoria]}</Text>
            <Text style={styles.nombre} numberOfLines={1}>
              {item.nombre}
            </Text>
          </>
        )}
        {calificacion ? (
          <Text style={styles.rating}>
            <Ionicons name="star" size={12} color={Colors.accent} />{" "}
            {calificacion.promedio.toFixed(2).replace(".", ",")}{" "}
            <Text style={styles.ratingSuave}>
              ({calificacion.total} reseña{calificacion.total === 1 ? "" : "s"})
            </Text>
          </Text>
        ) : (
          grande && <Text style={styles.ratingSuave}>Sin reseñas todavía</Text>
        )}
        {grande && (
          <Text style={styles.rubro} numberOfLines={1}>
            {subLabel ?? CATEGORIA_LABEL[item.categoria]}
          </Text>
        )}
        <Text style={styles.ubicacion} numberOfLines={1}>
          {ubicacion}
        </Text>
        {item.precio_desde !== null && (
          <Text style={styles.precio}>Desde {fmtColones(item.precio_desde)}</Text>
        )}
        {grande && (
          <View style={styles.ctaBarra}>
            <Text style={styles.ctaTexto}>
              {item.categoria === "lugares" ? "Reservar fecha" : "Ver y reservar"}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function SubcatPill({
  label,
  activo,
  onPress,
}: {
  label: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.subcatPill, activo && styles.subcatPillActiva]}
    >
      <Text style={[styles.subcatPillTexto, activo && styles.subcatPillTextoActivo]}>
        {label}
      </Text>
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
  tarjetaCuerpoGrande: { paddingTop: Spacing.two, gap: 3 },
  nombreFila: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  corazonChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    alignItems: "center",
    justifyContent: "center",
  },
  rating: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.ink },
  ratingSuave: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.inkSoft },
  rubro: { fontSize: 12.5, fontFamily: Fonts.medium, color: Colors.inkSoft },
  ctaBarra: {
    marginTop: Spacing.two,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  ctaTexto: { color: "#ffffff", fontSize: 13, fontFamily: Fonts.bold },
  subcatFila: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
  volverChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  volverTexto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.ink },
  subcatCategoria: { flexDirection: "row", alignItems: "center", gap: 5 },
  subcatCategoriaTexto: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.ink },
  subcatPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  subcatPillActiva: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  subcatPillTexto: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.inkSoft },
  subcatPillTextoActivo: { color: "#ffffff" },
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
