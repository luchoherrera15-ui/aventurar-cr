import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import BarraRapida, { BARRA_RAPIDA_ESPACIO } from "@/components/barra-rapida";
import ChipsVerticales from "@/components/chips-verticales";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { normalizarTexto } from "@/lib/busqueda";
import {
  CATEGORIAS_RESTAURANTES,
  CATEGORIA_RESTAURANTE_LABEL,
  RANGO_PRECIO_LABEL,
  normalizarCategoriaRestaurante,
  opcionesDeDetalles,
  type CategoriaRestaurante,
} from "@/lib/restaurantes";

type Local = {
  id: string;
  nombre: string;
  slug: string | null;
  categoria: string | null;
  descripcion: string | null;
  provincia: string | null;
  canton: string | null;
  foto_url: string | null;
  detalles: unknown;
};

type Calificacion = { promedio: number; total: number };

/**
 * El directorio de Restaurantes del app — espejo de /restaurantes en la
 * web: sodas, cafeterías, marisquerías y demás, con su menú, su reserva
 * de mesa y su pedido para recoger.
 *
 * Las 17 categorías NO van como fila de chips (desbordaba la pantalla y
 * obligaba a deslizar a ciegas): viven en una hoja de filtros que se
 * abre con el botón al lado de la búsqueda, igual que en la web. Lo que
 * queda a la vista es solo lo que el visitante tiene aplicado.
 */
export default function RestaurantesDirectorioScreen() {
  const router = useRouter();
  const [locales, setLocales] = useState<Local[] | null>(null);
  const [calificaciones, setCalificaciones] = useState<Record<string, Calificacion>>({});
  const [refrescando, setRefrescando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaRestaurante | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const cargar = useCallback(async () => {
    const [{ data: filas, error: errorLocales }, { data: califs }] = await Promise.all([
      supabase
        .from("ranchos")
        .select(
          "id, nombre, slug, categoria, descripcion, provincia, canton, foto_url, detalles",
        )
        .eq("vertical", "restaurantes")
        .eq("estado", "aprobado")
        .order("created_at", { ascending: false }),
      supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
    ]);
    // Sin esto, un fallo de red se disfrazaría de "directorio vacío".
    if (errorLocales) {
      setErrorCarga(true);
      return;
    }
    setErrorCarga(false);
    setLocales((filas ?? []) as Local[]);
    setCalificaciones(
      Object.fromEntries(
        ((califs ?? []) as (Calificacion & { rancho_id: string })[]).map((c) => [
          c.rancho_id,
          { promedio: c.promedio, total: c.total },
        ]),
      ),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga el directorio al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  const aguja = normalizarTexto(busqueda).trim();

  // La búsqueda se aplica ANTES que la categoría, para que el conteo de
  // cada filtro prometa justo lo que el toque entrega.
  const baseBusqueda = useMemo(() => {
    const todos = locales ?? [];
    if (!aguja) return todos;
    return todos.filter((n) =>
      normalizarTexto(
        [
          n.nombre,
          n.canton ?? "",
          n.provincia ?? "",
          n.descripcion ?? "",
          CATEGORIA_RESTAURANTE_LABEL[normalizarCategoriaRestaurante(n.categoria)],
        ].join(" "),
      ).includes(aguja),
    );
  }, [locales, aguja]);

  const filtrados = useMemo(
    () =>
      categoriaActiva
        ? baseBusqueda.filter(
            (n) => normalizarCategoriaRestaurante(n.categoria) === categoriaActiva,
          )
        : baseBusqueda,
    [baseBusqueda, categoriaActiva],
  );

  const conteo = useMemo(() => {
    const c: Partial<Record<CategoriaRestaurante, number>> = {};
    baseBusqueda.forEach((n) => {
      const cat = normalizarCategoriaRestaurante(n.categoria);
      c[cat] = (c[cat] ?? 0) + 1;
    });
    return c;
  }, [baseBusqueda]);

  // Sin filtro ni búsqueda: una fila horizontal por categoría, en el
  // orden oficial y saltando las vacías — espejo de la web.
  const filas = useMemo(
    () =>
      CATEGORIAS_RESTAURANTES.map((c) => ({
        categoria: c,
        items: (locales ?? []).filter(
          (n) => normalizarCategoriaRestaurante(n.categoria) === c,
        ),
      })).filter((f) => f.items.length > 0),
    [locales],
  );
  const vistaFilas = !categoriaActiva && !aguja;

  const renderTarjeta = (n: Local, extra?: object) => {
    const calif = calificaciones[n.id];
    const ubicacion = [n.canton, n.provincia].filter(Boolean).join(", ");
    const { aceptaReservaMesa, aceptaPickup, rangoPrecio } = opcionesDeDetalles(n.detalles);
    return (
      <Pressable
        onPress={() => router.push(`/restaurantes/${n.id}` as never)}
        style={({ pressed }) => [styles.tarjeta, extra, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.fotoMarco}>
          {n.foto_url ? (
            <Image
              source={{ uri: n.foto_url }}
              alt={n.nombre}
              style={styles.foto}
              contentFit="cover"
              transition={250}
            />
          ) : (
            <View style={styles.fotoVacia}>
              <Ionicons name="restaurant-outline" size={34} color={Colors.blue} />
            </View>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeTexto}>
              {CATEGORIA_RESTAURANTE_LABEL[normalizarCategoriaRestaurante(n.categoria)]}
            </Text>
          </View>
          <View style={styles.badgesDerecha}>
            {rangoPrecio !== null && (
              <View style={styles.badgePrecio}>
                <Text style={styles.badgePrecioTexto}>{RANGO_PRECIO_LABEL[rangoPrecio]}</Text>
              </View>
            )}
            {n.slug?.startsWith("demo-") && (
              <View style={styles.badgeDemo}>
                <Text style={styles.badgeDemoTexto}>Demo</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.cuerpo}>
          <View style={styles.filaNombre}>
            <Text style={styles.nombre} numberOfLines={1}>
              {n.nombre}
            </Text>
            {calif && (
              <View style={styles.calif}>
                <Ionicons name="star" size={12} color={Colors.accent} />
                <Text style={styles.califTexto}>
                  {calif.promedio.toFixed(1)}
                  <Text style={styles.califTotal}> ({calif.total})</Text>
                </Text>
              </View>
            )}
          </View>
          {!!ubicacion && (
            <View style={styles.filaUbicacion}>
              <Ionicons name="location-outline" size={12} color={Colors.blue} />
              <Text style={styles.ubicacion} numberOfLines={1}>
                {ubicacion}
              </Text>
            </View>
          )}
          {/* Lo que se puede hacer acá: reservar mesa, pedir para
              recoger, o simplemente mirar el menú. */}
          <View style={styles.filaPie}>
            <View style={styles.etiquetas}>
              {aceptaReservaMesa && <Etiqueta texto="Reservá mesa" />}
              {aceptaPickup && <Etiqueta texto="Pedí y recogé" />}
              {!aceptaReservaMesa && !aceptaPickup && <Etiqueta texto="Ver el menú" />}
            </View>
            <Text style={styles.ver}>Ver →</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        titulo="Restaurantes"
        subtitulo="Reservá mesa y pedí para recoger"
        onVolver={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />

      <View style={styles.verticalesZona}>
        <ChipsVerticales activo="restaurantes" />
      </View>

      {errorCarga && locales === null ? (
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>No pudimos cargar el directorio</Text>
          <Text style={styles.vacioTexto}>Revisá tu conexión e intentá de nuevo.</Text>
          <Pressable
            onPress={() => {
              setErrorCarga(false);
              cargar();
            }}
            style={({ pressed }) => [styles.botonContorno, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.botonContornoTexto}>Reintentar</Text>
          </Pressable>
        </View>
      ) : locales === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : locales.length === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>Los primeros restaurantes están por llegar</Text>
          <Text style={styles.vacioTexto}>
            Estamos abriendo esta sección. Muy pronto vas a poder ver el menú,
            reservar mesa y pedir para recoger desde acá.
          </Text>
        </View>
      ) : (
        <>
          {/* Barra de búsqueda + botón de filtros, igual que la web. */}
          <View style={styles.buscadorZona}>
            <View style={styles.buscador}>
              <Ionicons name="search" size={16} color={Colors.blue} />
              <TextInput
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder={'Buscá por nombre, zona o comida — ej. "mariscos"'}
                placeholderTextColor="#94a3bd"
                style={styles.buscadorInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filtros"
              onPress={() => setFiltrosAbiertos(true)}
              style={({ pressed }) => [
                styles.botonFiltros,
                categoriaActiva !== null && styles.botonFiltrosActivo,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons
                name="options-outline"
                size={18}
                color={categoriaActiva !== null ? "#ffffff" : Colors.ink}
              />
              {categoriaActiva !== null && (
                <View style={styles.filtrosPunto}>
                  <Text style={styles.filtrosPuntoTexto}>1</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Lo aplicado, a la vista y con su ✕: si el filtro se
              esconde en la hoja, tiene que notarse acá. */}
          {(categoriaActiva !== null || !!aguja) && (
            <View style={styles.activosZona}>
              {!!aguja && (
                <ChipActivo texto={`“${busqueda.trim()}”`} onQuitar={() => setBusqueda("")} />
              )}
              {categoriaActiva !== null && (
                <ChipActivo
                  texto={CATEGORIA_RESTAURANTE_LABEL[categoriaActiva]}
                  onQuitar={() => setCategoriaActiva(null)}
                />
              )}
              <Text style={styles.activosConteo}>
                {filtrados.length} {filtrados.length === 1 ? "resultado" : "resultados"}
              </Text>
            </View>
          )}

          {filtrados.length === 0 ? (
            <View style={styles.centro}>
              <Text style={styles.vacioTitulo}>No encontramos nada con esa búsqueda</Text>
              <Text style={styles.vacioTexto}>
                Probá con otra palabra, otra zona, o quitá los filtros.
              </Text>
              <Pressable
                onPress={() => {
                  setBusqueda("");
                  setCategoriaActiva(null);
                }}
                style={({ pressed }) => [styles.botonContorno, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.botonContornoTexto}>Ver todos los restaurantes</Text>
              </Pressable>
            </View>
          ) : vistaFilas ? (
            <ScrollView
              contentContainerStyle={styles.listaFilas}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
              showsVerticalScrollIndicator={false}
            >
              {filas.map((f) => (
                <View key={f.categoria}>
                  <View style={styles.filaEncabezado}>
                    <Text style={styles.filaTitulo}>
                      {CATEGORIA_RESTAURANTE_LABEL[f.categoria]}{" "}
                      <Text style={styles.filaConteo}>({f.items.length})</Text>
                    </Text>
                    <Pressable onPress={() => setCategoriaActiva(f.categoria)} hitSlop={8}>
                      <Text style={styles.filaVerTodos}>Ver todos →</Text>
                    </Pressable>
                  </View>
                  <FlatList
                    horizontal
                    data={f.items}
                    keyExtractor={(n) => n.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filaListaCards}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item: n }) => renderTarjeta(n, styles.tarjetaRiel)}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <FlatList
              data={filtrados}
              keyExtractor={(n) => n.id}
              contentContainerStyle={styles.lista}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
              renderItem={({ item: n }) => renderTarjeta(n)}
            />
          )}
        </>
      )}

      {/* La hoja de filtros: las 17 categorías con su conteo. En móvil
          un modal de abajo es el equivalente del panel de la web —
          además se cierra tocando fuera, que el <details> no hace. */}
      <Modal
        visible={filtrosAbiertos}
        animationType="slide"
        transparent
        onRequestClose={() => setFiltrosAbiertos(false)}
      >
        <Pressable style={styles.hojaFondo} onPress={() => setFiltrosAbiertos(false)}>
          <Pressable style={styles.hoja} onPress={() => {}}>
            <View style={styles.hojaAgarre} />
            <View style={styles.hojaEncabezado}>
              <Text style={styles.hojaTitulo}>Tipo de comida</Text>
              <Pressable onPress={() => setFiltrosAbiertos(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={Colors.inkSoft} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.hojaLista}>
              <OpcionFiltro
                label="Todos"
                conteo={baseBusqueda.length}
                activo={categoriaActiva === null}
                onPress={() => {
                  setCategoriaActiva(null);
                  setFiltrosAbiertos(false);
                }}
              />
              {CATEGORIAS_RESTAURANTES.filter((c) => (conteo[c] ?? 0) > 0).map((c) => (
                <OpcionFiltro
                  key={c}
                  label={CATEGORIA_RESTAURANTE_LABEL[c]}
                  conteo={conteo[c] ?? 0}
                  activo={categoriaActiva === c}
                  onPress={() => {
                    setCategoriaActiva(c);
                    setFiltrosAbiertos(false);
                  }}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <BarraRapida />
    </View>
  );
}

/** Una opción de la hoja de filtros: nombre y cuántos hay. */
function OpcionFiltro({
  label,
  conteo,
  activo,
  onPress,
}: {
  label: string;
  conteo: number;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.opcion,
        activo && styles.opcionActiva,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.opcionTexto, activo && styles.opcionTextoActivo]}>{label}</Text>
      <Text style={[styles.opcionConteo, activo && styles.opcionConteoActivo]}>{conteo}</Text>
    </Pressable>
  );
}

/** Un filtro aplicado, con su ✕ para soltarlo. */
function ChipActivo({ texto, onQuitar }: { texto: string; onQuitar: () => void }) {
  return (
    <Pressable
      onPress={onQuitar}
      accessibilityRole="button"
      accessibilityLabel={`Quitar ${texto}`}
      style={({ pressed }) => [styles.chipActivo, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.chipActivoTexto} numberOfLines={1}>
        {texto}
      </Text>
      <Ionicons name="close" size={12} color={Colors.navy} />
    </Pressable>
  );
}

function Etiqueta({ texto }: { texto: string }) {
  return (
    <View style={styles.etiqueta}>
      <Text style={styles.etiquetaTexto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  verticalesZona: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  centro: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: BARRA_RAPIDA_ESPACIO,
    paddingHorizontal: Spacing.five,
  },
  vacioTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    textAlign: "center",
  },
  vacioTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: "center",
  },
  lista: { gap: Spacing.three, padding: Spacing.three, paddingBottom: BARRA_RAPIDA_ESPACIO },
  listaFilas: { gap: Spacing.four, paddingBottom: BARRA_RAPIDA_ESPACIO, paddingTop: Spacing.two },
  filaEncabezado: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  filaTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 16 },
  filaConteo: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 13 },
  filaVerTodos: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 12.5 },
  filaListaCards: { gap: Spacing.three, paddingHorizontal: Spacing.three },
  tarjetaRiel: { width: 264 },
  tarjeta: {
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  fotoMarco: { aspectRatio: 16 / 10, backgroundColor: Colors.blueLight },
  foto: { height: "100%", width: "100%" },
  fotoVacia: { alignItems: "center", flex: 1, justifyContent: "center" },
  badge: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 99,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    position: "absolute",
    top: 10,
  },
  badgeTexto: {
    color: Colors.navy,
    fontFamily: Fonts.extraBold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  badgesDerecha: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    position: "absolute",
    right: 10,
    top: 10,
  },
  badgePrecio: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgePrecioTexto: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 10.5 },
  badgeDemo: {
    backgroundColor: "#fbbf24",
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeDemoTexto: {
    color: "#1c1c1c",
    fontFamily: Fonts.extraBold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cuerpo: { padding: Spacing.three },
  filaNombre: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  nombre: { color: Colors.ink, flex: 1, fontFamily: Fonts.extraBold, fontSize: 15 },
  calif: { alignItems: "center", flexDirection: "row", gap: 3 },
  califTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5 },
  califTotal: { color: Colors.inkSoft, fontFamily: Fonts.semiBold },
  filaUbicacion: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 3 },
  ubicacion: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5 },
  filaPie: {
    alignItems: "center",
    borderTopColor: "#eef3fb",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
  },
  etiquetas: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 5 },
  etiqueta: {
    backgroundColor: "#e8ecf6",
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  etiquetaTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 10.5 },
  ver: { color: Colors.accent, fontFamily: Fonts.extraBold, fontSize: 13 },
  buscadorZona: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  buscador: {
    alignItems: "center",
    backgroundColor: Colors.cream2,
    borderRadius: 14,
    flex: 1,
    flexDirection: "row",
    gap: Spacing.two,
    height: 46,
    paddingHorizontal: Spacing.three,
  },
  buscadorInput: {
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    // Sin esto, Android mete padding propio y el texto queda
    // descentrado dentro de la caja de 46px.
    padding: 0,
  },
  botonFiltros: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 14,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 50,
  },
  botonFiltrosActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filtrosPunto: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 99,
    height: 16,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    top: 4,
    width: 16,
  },
  filtrosPuntoTexto: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 9.5 },
  activosZona: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  chipActivo: {
    alignItems: "center",
    borderColor: Colors.navy,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    maxWidth: 210,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActivoTexto: {
    color: Colors.navy,
    flexShrink: 1,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
  },
  activosConteo: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 12.5 },
  hojaFondo: { backgroundColor: "rgba(10,16,34,0.45)", flex: 1, justifyContent: "flex-end" },
  hoja: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "78%",
    paddingBottom: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  hojaAgarre: {
    alignSelf: "center",
    backgroundColor: "#d6dae6",
    borderRadius: 99,
    height: 4,
    marginBottom: Spacing.two,
    width: 44,
  },
  hojaEncabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: Spacing.two,
  },
  hojaTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 16.5 },
  hojaLista: { gap: 6, paddingBottom: Spacing.three },
  opcion: {
    alignItems: "center",
    backgroundColor: Colors.cream2,
    borderRadius: 14,
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  opcionActiva: { backgroundColor: Colors.navy },
  opcionTexto: { color: Colors.ink, flex: 1, fontFamily: Fonts.bold, fontSize: 13.5 },
  opcionTextoActivo: { color: "#ffffff" },
  opcionConteo: { color: Colors.inkSoft, fontFamily: Fonts.extraBold, fontSize: 12.5 },
  opcionConteoActivo: { color: "rgba(255,255,255,0.75)" },
  botonContorno: {
    borderColor: Colors.navy,
    borderRadius: 999,
    borderWidth: 1.5,
    marginTop: Spacing.three,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  botonContornoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 13 },
});
