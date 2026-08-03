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
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import BarraRapida, { BARRA_RAPIDA_ESPACIO } from "@/components/barra-rapida";
import ChipsVerticales from "@/components/chips-verticales";
import Buscador, { ChipFiltro } from "@/components/buscador";
import TarjetaNegocio from "@/components/tarjeta-negocio";
import { Encabezado, Micro, Opcion, Vacio } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
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

  const renderTarjeta = (n: Local, ancho: "riel" | "completo") => {
    const { aceptaReservaMesa, aceptaPickup, rangoPrecio } = opcionesDeDetalles(n.detalles);
    const distintivos: string[] = [];
    if (aceptaReservaMesa) distintivos.push("Reservá mesa");
    if (aceptaPickup) distintivos.push("Pedí y recogé");
    if (distintivos.length === 0) distintivos.push("Ver el menú");

    return (
      <TarjetaNegocio
        ancho={ancho}
        nombre={n.nombre}
        foto={n.foto_url}
        iconoVacio="restaurant-outline"
        etiqueta={CATEGORIA_RESTAURANTE_LABEL[normalizarCategoriaRestaurante(n.categoria)]}
        calificacion={calificaciones[n.id] ?? null}
        ubicacion={[n.canton, n.provincia].filter(Boolean).join(", ") || null}
        precio={null}
        textoSinPrecio={rangoPrecio !== null ? RANGO_PRECIO_LABEL[rangoPrecio] : "Ver el menú"}
        distintivos={distintivos}
        cta={aceptaReservaMesa ? "Reservar" : "Ver"}
        demo={n.slug?.startsWith("demo-")}
        onPress={() => router.push(`/restaurantes/${n.id}` as never)}
      />
    );
  };

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        kicker="Restaurantes"
        titulo="Reservá tu mesa"
        subtitulo="Mirá el menú, reservá y pedí para recoger"
        onVolver={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />

      <View style={styles.verticalesZona}>
        <ChipsVerticales />
      </View>

      {errorCarga && locales === null ? (
        <View style={styles.centro}>
          <Vacio
            icono="cloud-offline-outline"
            titulo="No pudimos cargar el directorio"
            texto="Revisá tu conexión e intentá de nuevo."
            accion={{
              texto: "Reintentar",
              onPress: () => {
                setErrorCarga(false);
                cargar();
              },
            }}
          />
        </View>
      ) : locales === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : locales.length === 0 ? (
        <View style={styles.centro}>
          <Vacio
            icono="restaurant-outline"
            titulo="Los primeros restaurantes están por llegar"
            texto="Estamos abriendo esta sección. Muy pronto vas a poder ver el menú, reservar mesa y pedir para recoger desde acá."
          />
        </View>
      ) : (
        <>
          {/* Barra de búsqueda + botón de filtros, igual que la web. */}
          <View style={styles.buscadorZona}>
            <Buscador
              valor={busqueda}
              onCambiar={setBusqueda}
              placeholder={'Buscá por nombre, zona o comida — ej. "mariscos"'}
              filtros={{
                activos: categoriaActiva !== null ? 1 : 0,
                onPress: () => setFiltrosAbiertos(true),
              }}
            />
          </View>

          {/* Lo aplicado, a la vista y con su ✕: si el filtro se
              esconde en la hoja, tiene que notarse acá. */}
          {(categoriaActiva !== null || !!aguja) && (
            <View style={styles.activosZona}>
              {!!aguja && (
                <ChipFiltro texto={`“${busqueda.trim()}”`} onQuitar={() => setBusqueda("")} />
              )}
              {categoriaActiva !== null && (
                <ChipFiltro
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
              <Vacio
                titulo="No encontramos nada con esa búsqueda"
                texto="Probá con otra palabra, otra zona, o quitá los filtros."
                accion={{
                  texto: "Ver todos los restaurantes",
                  onPress: () => {
                    setBusqueda("");
                    setCategoriaActiva(null);
                  },
                }}
              />
            </View>
          ) : vistaFilas ? (
            <ScrollView
              contentContainerStyle={styles.listaFilas}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
              showsVerticalScrollIndicator={false}
            >
              {filas.map((f) => (
                <View key={f.categoria} style={{ gap: Spacing.two + 2 }}>
                  <View style={styles.filaEncabezado}>
                    <Encabezado
                      kicker={`${f.items.length} ${f.items.length === 1 ? "lugar" : "lugares"}`}
                      titulo={CATEGORIA_RESTAURANTE_LABEL[f.categoria]}
                      accion={{
                        texto: "Ver todos",
                        onPress: () => setCategoriaActiva(f.categoria),
                      }}
                    />
                  </View>
                  <FlatList
                    horizontal
                    data={f.items}
                    keyExtractor={(n) => n.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filaListaCards}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item: n }) => renderTarjeta(n, "riel")}
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
              renderItem={({ item: n }) => renderTarjeta(n, "completo")}
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
              <View>
                <Micro>Filtrar</Micro>
                <Text style={styles.hojaTitulo}>Tipo de comida</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar filtros"
                onPress={() => setFiltrosAbiertos(false)}
                hitSlop={10}
                style={styles.hojaCerrar}
              >
                <Ionicons name="close" size={18} color={Colors.ink} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.hojaLista}>
              <Opcion
                titulo="Todos"
                derecha={String(baseBusqueda.length)}
                seleccionada={categoriaActiva === null}
                onPress={() => {
                  setCategoriaActiva(null);
                  setFiltrosAbiertos(false);
                }}
              />
              {CATEGORIAS_RESTAURANTES.filter((c) => (conteo[c] ?? 0) > 0).map((c) => (
                <Opcion
                  key={c}
                  titulo={CATEGORIA_RESTAURANTE_LABEL[c]}
                  derecha={String(conteo[c] ?? 0)}
                  seleccionada={categoriaActiva === c}
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

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  verticalesZona: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  centro: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: BARRA_RAPIDA_ESPACIO,
    paddingHorizontal: Spacing.three,
  },
  lista: { gap: Spacing.three, padding: Spacing.three, paddingBottom: BARRA_RAPIDA_ESPACIO },
  listaFilas: { gap: Spacing.four, paddingBottom: BARRA_RAPIDA_ESPACIO, paddingTop: Spacing.two },
  filaEncabezado: { paddingHorizontal: Spacing.three },
  filaListaCards: { gap: Spacing.three, paddingHorizontal: Spacing.three },
  buscadorZona: { paddingBottom: Spacing.two + 2, paddingHorizontal: Spacing.three },
  activosZona: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    paddingBottom: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  activosConteo: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 12.5 },

  hojaFondo: { backgroundColor: "rgba(10,16,34,0.45)", flex: 1, justifyContent: "flex-end" },
  hoja: {
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: Radios.xl,
    borderTopRightRadius: Radios.xl,
    maxHeight: "78%",
    paddingBottom: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  hojaAgarre: {
    alignSelf: "center",
    backgroundColor: "#d6dae6",
    borderRadius: Radios.full,
    height: 4,
    marginBottom: Spacing.three,
    width: 44,
  },
  hojaEncabezado: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: Spacing.three,
  },
  hojaTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 19,
    letterSpacing: -0.4,
    marginTop: 3,
  },
  hojaCerrar: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.full,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  hojaLista: { gap: Spacing.two, paddingBottom: Spacing.three },
});
