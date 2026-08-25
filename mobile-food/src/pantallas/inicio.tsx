import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Sombras, Tipo } from "@/constants/theme";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { useAuth } from "@/lib/auth-context";
import { cargarFavoritosIds, cargarTarjetasFood, type TarjetaFood } from "@/lib/food-datos";
import { PROVINCIAS, PROVINCIAS_ID, TIPOS_COCINA, TIPOS_COCINA_ID, type Provincia, type TipoCocina } from "@/lib/food-tipos";
import { useModoPedido } from "@/lib/modo-pedido";
import TarjetaRestaurante from "@/components/tarjeta-restaurante";
import SelectorModo from "@/components/selector-modo";

/** "Todos" + las 10 del catálogo cerrado (0202) — icono ya viene del
 *  catálogo, pero acá se pinta como foto (ver FOTOS_CATEGORIA); "Todos"
 *  no es una categoría real, se queda con el ícono. */
type Categoria = { id: TipoCocina | "todos"; nombre: string; icono: keyof typeof Ionicons.glyphMap };
const CATEGORIAS: Categoria[] = [
  { id: "todos", nombre: "Todos", icono: "apps-outline" },
  ...TIPOS_COCINA_ID.map((id) => ({
    id,
    nombre: TIPOS_COCINA[id].nombre,
    icono: TIPOS_COCINA[id].icono as keyof typeof Ionicons.glyphMap,
  })),
];

/** Fotos de stock ya aprobadas, alojadas en el sitio web — una por
 *  categoría real (0202). "Todos" no tiene foto, sigue con ícono. */
const FOTOS_CATEGORIA: Record<TipoCocina, string> = {
  tipica: "https://bookea.lat/food-demo/cat-tipica.jpg",
  italiana: "https://bookea.lat/food-demo/cat-italiana.jpg",
  asiatica: "https://bookea.lat/food-demo/cat-asiatica.jpg",
  mexicana: "https://bookea.lat/food-demo/cat-mexicana.jpg",
  mariscos: "https://bookea.lat/food-demo/cat-mariscos.jpg",
  carnes: "https://bookea.lat/food-demo/cat-carnes.jpg",
  pizza: "https://bookea.lat/food-demo/cat-pizza.jpg",
  cafe_postres: "https://bookea.lat/food-demo/cat-cafe.jpg",
  saludable: "https://bookea.lat/food-demo/cat-mediterranea.jpg",
  comida_rapida: "https://bookea.lat/food-demo/cat-rapida.jpg",
};

/**
 * EL SELECTOR DE PAÍS (pedido del dueño): Costa Rica es hoy el único con
 * negocios reales, así que es el único elegible — el resto se PINTA
 * (nombre y bandera reales, nada inventado) pero queda deshabilitado con
 * un "Pronto", en vez de dejar elegir un país donde tocaría mostrar una
 * lista vacía sin explicación. El día que haya un negocio real en otro
 * país, ese país pasa a `disponible: true` acá y en la base entra la
 * columna `pais` que hoy no hace falta (mismo criterio que documenta la
 * 0203 para `provincia`).
 */
type PaisId = "costa_rica" | "panama" | "nicaragua" | "honduras" | "el_salvador" | "guatemala" | "colombia";
const PAISES: { id: PaisId; nombre: string; bandera: string; disponible: boolean }[] = [
  { id: "costa_rica", nombre: "Costa Rica", bandera: "🇨🇷", disponible: true },
  { id: "panama", nombre: "Panamá", bandera: "🇵🇦", disponible: false },
  { id: "nicaragua", nombre: "Nicaragua", bandera: "🇳🇮", disponible: false },
  { id: "honduras", nombre: "Honduras", bandera: "🇭🇳", disponible: false },
  { id: "el_salvador", nombre: "El Salvador", bandera: "🇸🇻", disponible: false },
  { id: "guatemala", nombre: "Guatemala", bandera: "🇬🇹", disponible: false },
  { id: "colombia", nombre: "Colombia", bandera: "🇨🇴", disponible: false },
];

/**
 * INICIO — la vitrina, no el buscador a fondo (eso es Descubrir). Mismo
 * dato real que el resto de la app (`cargarTarjetasFood`, espejo de
 * /web). La fila de categorías y el selector de ubicación filtran en el
 * cliente sobre esas mismas tarjetas ya cargadas, comparando
 * `tipoCocina` y `provincia` (0202/0203, reales desde food_businesses)
 * — no disparan una consulta nueva ni inventan categorías o países.
 */
export default function Inicio({ activa }: { activa: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { modo } = useModoPedido();
  const [tarjetas, setTarjetas] = useState<TarjetaFood[] | null>(null);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [refrescando, setRefrescando] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState<Categoria["id"]>("todos");
  const [provinciaActiva, setProvinciaActiva] = useState<Provincia | null>(null);
  const [ubicacionAbierta, setUbicacionAbierta] = useState(false);
  const [pasoUbicacion, setPasoUbicacion] = useState<"pais" | "provincia">("pais");

  const cargar = useCallback(() => {
    return Promise.all([
      cargarTarjetasFood(),
      session ? cargarFavoritosIds(session.user.id) : Promise.resolve(new Set<string>()),
    ]).then(([t, f]) => {
      setTarjetas(t);
      setFavoritos(f);
    });
  }, [session]);

  useEffect(() => {
    if (activa && tarjetas === null) cargar();
  }, [activa, tarjetas, cargar]);

  const tarjetasFiltradas = useMemo(() => {
    if (!tarjetas) return [];
    let lista = tarjetas;
    // En "To Go" solo entran los negocios que lo tienen prendido Y ya
    // tienen menú cargado (0207) — sin menú no hay qué pedir.
    if (modo === "togo") lista = lista.filter((t) => t.aceptaParaLlevar && t.platos.length > 0);
    if (categoriaActiva !== "todos") lista = lista.filter((t) => t.tipoCocina === categoriaActiva);
    if (provinciaActiva) lista = lista.filter((t) => t.provincia === provinciaActiva);
    return lista;
  }, [tarjetas, modo, categoriaActiva, provinciaActiva]);

  const categoriaLabel = CATEGORIAS.find((c) => c.id === categoriaActiva)?.nombre ?? "";
  const ubicacionLabel = provinciaActiva ? PROVINCIAS[provinciaActiva] : "Costa Rica";

  return (
    <View style={[styles.contenedor, { paddingTop: insets.top + Spacing.three }]}>
      <FlatList
        data={tarjetasFiltradas}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: TAB_BAR_ESPACIO, paddingHorizontal: Spacing.four }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={async () => {
              setRefrescando(true);
              await cargar();
              setRefrescando(false);
            }}
            tintColor={Colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: Spacing.four }}>
            <View style={{ marginBottom: Spacing.four }}>
              <SelectorModo />
            </View>

            <Pressable
              onPress={() => {
                setPasoUbicacion("pais");
                setUbicacionAbierta(true);
              }}
              style={styles.ubicador}
              hitSlop={4}
            >
              <Ionicons name="location-outline" size={15} color={Colors.accent} />
              <Text style={styles.ubicadorTexto}>{ubicacionLabel}</Text>
              <Ionicons name="chevron-down" size={13} color={Colors.inkMuted} />
            </Pressable>

            <Pressable
              onPress={() => router.push("/?tab=descubrir")}
              style={styles.buscador}
            >
              <Ionicons name="search" size={17} color={Colors.inkMuted} />
              <Text style={styles.buscadorTexto}>Restaurante, comida o zona</Text>
            </Pressable>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: Spacing.five }}
              contentContainerStyle={styles.categorias}
            >
              {CATEGORIAS.map((cat) => {
                const activa = categoriaActiva === cat.id;
                const foto = cat.id === "todos" ? null : FOTOS_CATEGORIA[cat.id];
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategoriaActiva(cat.id)}
                    style={styles.categoriaItem}
                    hitSlop={4}
                  >
                    <View
                      style={[
                        styles.categoriaCirculo,
                        activa && (foto ? styles.categoriaCirculoAro : styles.categoriaCirculoActiva),
                      ]}
                    >
                      {foto ? (
                        <Image source={{ uri: foto }} style={styles.categoriaFoto} resizeMode="cover" />
                      ) : (
                        <Ionicons name={cat.icono} size={24} color={activa ? "#ffffff" : Colors.accent} />
                      )}
                    </View>
                    <Text
                      style={[styles.categoriaTexto, activa && styles.categoriaTextoActivo]}
                      numberOfLines={1}
                    >
                      {cat.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[Tipo.titulo2, { marginTop: Spacing.five }]}>
              {modo === "togo" ? "Para llevar cerca de vos" : "Ofertas cerca de vos"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TarjetaRestaurante
            tarjeta={item}
            favorito={session ? favoritos.has(item.id) : undefined}
            logueado={!!session}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        ListEmptyComponent={
          tarjetas === null ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.five }} />
          ) : tarjetasFiltradas.length === 0 && modo === "togo" && categoriaActiva === "todos" && !provinciaActiva ? (
            <View style={styles.vacio}>
              <Ionicons name="bag-handle-outline" size={28} color={Colors.inkMuted} />
              <Text style={styles.vacioTexto}>
                Todavía ningún restaurante ofrece pedidos para llevar. Volvé pronto.
              </Text>
            </View>
          ) : tarjetas.length === 0 ? (
            <View style={styles.vacio}>
              <Ionicons name="restaurant-outline" size={28} color={Colors.inkMuted} />
              <Text style={styles.vacioTexto}>
                Todavía no hay restaurantes publicados. Volvé pronto.
              </Text>
            </View>
          ) : (
            <View style={styles.vacio}>
              <Ionicons name="search-outline" size={28} color={Colors.inkMuted} />
              <Text style={styles.vacioTexto}>
                Todavía no hay restaurantes en {categoriaLabel}. Probá con otra categoría.
              </Text>
            </View>
          )
        }
      />

      <Modal
        visible={ubicacionAbierta}
        transparent
        animationType="fade"
        onRequestClose={() => setUbicacionAbierta(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setUbicacionAbierta(false)} />
          <View style={[styles.modalHoja, { paddingBottom: insets.bottom + Spacing.four }]}>
            {pasoUbicacion === "pais" ? (
              <>
                <Text style={[Tipo.titulo3, { marginBottom: Spacing.three }]}>Elegí tu país</Text>
                {PAISES.map((pais) => (
                  <Pressable
                    key={pais.id}
                    disabled={!pais.disponible}
                    style={styles.modalFila}
                    onPress={() => setPasoUbicacion("provincia")}
                  >
                    <View style={styles.modalFilaPais}>
                      <Text style={styles.modalBandera}>{pais.bandera}</Text>
                      <Text
                        style={[styles.modalFilaTexto, !pais.disponible && styles.modalFilaTextoDeshabilitado]}
                      >
                        {pais.nombre}
                      </Text>
                    </View>
                    {pais.disponible ? (
                      <Ionicons name="chevron-forward" size={16} color={Colors.inkMuted} />
                    ) : (
                      <View style={styles.pillPronto}>
                        <Text style={styles.pillProntoTexto}>Pronto</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => setPasoUbicacion("pais")}
                  style={styles.modalVolver}
                  hitSlop={6}
                >
                  <Ionicons name="chevron-back" size={16} color={Colors.inkSoft} />
                  <Text style={styles.modalVolverTexto}>Países</Text>
                </Pressable>
                <Text style={[Tipo.titulo3, { marginTop: Spacing.two, marginBottom: Spacing.three }]}>
                  🇨🇷 Costa Rica
                </Text>
                <Pressable
                  style={styles.modalFila}
                  onPress={() => {
                    setProvinciaActiva(null);
                    setUbicacionAbierta(false);
                  }}
                >
                  <Text style={[styles.modalFilaTexto, !provinciaActiva && styles.modalFilaTextoActiva]}>
                    Todo Costa Rica
                  </Text>
                  {!provinciaActiva && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                </Pressable>
                {PROVINCIAS_ID.map((id) => (
                  <Pressable
                    key={id}
                    style={styles.modalFila}
                    onPress={() => {
                      setProvinciaActiva(id);
                      setUbicacionAbierta(false);
                    }}
                  >
                    <Text
                      style={[styles.modalFilaTexto, provinciaActiva === id && styles.modalFilaTextoActiva]}
                    >
                      {PROVINCIAS[id]}
                    </Text>
                    {provinciaActiva === id && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                  </Pressable>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.canvas },
  ubicador: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radios.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
    ...Sombras.tarjeta,
  },
  ubicadorTexto: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.ink },
  buscador: {
    marginTop: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Colors.surface,
    borderRadius: Radios.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    ...Sombras.tarjeta,
  },
  buscadorTexto: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.inkMuted },
  categorias: { gap: Spacing.three, paddingRight: Spacing.two },
  categoriaItem: { alignItems: "center", width: 66 },
  categoriaCirculo: {
    width: 62,
    height: 62,
    borderRadius: Radios.full,
    overflow: "hidden",
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    ...Sombras.tarjeta,
  },
  categoriaCirculoActiva: { backgroundColor: Colors.accent },
  categoriaCirculoAro: { borderColor: Colors.accent, borderWidth: 3 },
  categoriaFoto: { width: "100%", height: "100%" },
  categoriaTexto: {
    marginTop: 6,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.inkSoft,
    textAlign: "center",
  },
  categoriaTextoActivo: { color: Colors.ink, fontFamily: Fonts.bold },
  vacio: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.six },
  vacioTexto: { ...Tipo.cuerpo, textAlign: "center", maxWidth: 240 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(11,11,14,0.45)" },
  modalHoja: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radios.xl,
    borderTopRightRadius: Radios.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    ...Sombras.flotante,
  },
  modalFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
  },
  modalFilaTexto: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.inkSoft },
  modalFilaTextoActiva: { fontFamily: Fonts.bold, color: Colors.ink },
  modalFilaPais: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  modalBandera: { fontSize: 20 },
  modalFilaTextoDeshabilitado: { color: Colors.inkMuted },
  pillPronto: {
    backgroundColor: Colors.cream2,
    borderRadius: Radios.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillProntoTexto: { fontFamily: Fonts.bold, fontSize: 10.5, color: Colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  modalVolver: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  modalVolverTexto: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.inkSoft },
});
