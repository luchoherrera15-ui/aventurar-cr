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
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import BarraRapida, { BARRA_RAPIDA_ESPACIO } from "@/components/barra-rapida";
import ChipsVerticales from "@/components/chips-verticales";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";
import { normalizarTexto } from "@/lib/busqueda";
import {
  CATEGORIA_HOSPEDAJE_LABEL,
  CATEGORIAS_HOSPEDAJES,
  normalizarCategoriaHospedaje,
  type CategoriaHospedaje,
} from "@/lib/hospedajes";

type Hospedaje = {
  id: string;
  nombre: string;
  slug: string | null;
  categoria: string | null;
  descripcion: string | null;
  provincia: string | null;
  canton: string | null;
  foto_url: string | null;
  precio_desde: number | null;
};

type Calificacion = { promedio: number; total: number };

/** La categoría viene libre de la base; si no calza con la vertical,
 * cae en un rótulo genérico. */
function etiquetaCategoria(categoria: string | null): string {
  const cat = normalizarCategoriaHospedaje(categoria);
  return cat ? CATEGORIA_HOSPEDAJE_LABEL[cat] : "Hospedaje";
}

/**
 * El directorio de Hospedajes del app — espejo de /hospedajes en la
 * web y gemelo del directorio de Citas: buscador, chips por tipo con
 * conteo y las cards de casas, villas, cabañas y hoteles con su nota y
 * su "Desde ₡ por noche". Tocar una entra al detalle del hospedaje;
 * todo desemboca en la reserva por noches.
 */
export default function HospedajesDirectorioScreen() {
  const router = useRouter();
  const [hospedajes, setHospedajes] = useState<Hospedaje[] | null>(null);
  const [calificaciones, setCalificaciones] = useState<Record<string, Calificacion>>({});
  const [refrescando, setRefrescando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaHospedaje | null>(null);

  const cargar = useCallback(async () => {
    const [{ data: filas, error: errorHospedajes }, { data: califs }] = await Promise.all([
      supabase
        .from("ranchos")
        .select("id, nombre, slug, categoria, descripcion, provincia, canton, foto_url, precio_desde")
        .eq("vertical", "hospedajes")
        .eq("estado", "aprobado")
        .order("created_at", { ascending: false }),
      supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
    ]);
    // Sin esto, un fallo de red se disfrazaría de "vertical vacía".
    if (errorHospedajes) {
      setErrorCarga(true);
      return;
    }
    setErrorCarga(false);
    setHospedajes((filas ?? []) as Hospedaje[]);
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

  // Conteo por tipo sobre TODOS los hospedajes (los chips no cambian
  // con la búsqueda), igual que en el directorio de Citas.
  const conteo = useMemo(() => {
    const c: Partial<Record<CategoriaHospedaje, number>> = {};
    (hospedajes ?? []).forEach((h) => {
      const cat = normalizarCategoriaHospedaje(h.categoria);
      if (cat) c[cat] = (c[cat] ?? 0) + 1;
    });
    return c;
  }, [hospedajes]);

  // El buscador filtra en memoria por nombre, zona, tipo o descripción,
  // sin pelear con tildes: "cabana" encuentra "Cabaña".
  const filtrados = useMemo(() => {
    const base = categoriaActiva
      ? (hospedajes ?? []).filter(
          (h) => normalizarCategoriaHospedaje(h.categoria) === categoriaActiva,
        )
      : (hospedajes ?? []);
    const aguja = normalizarTexto(busqueda).trim();
    if (!aguja) return base;
    return base.filter((h) =>
      normalizarTexto(
        [
          h.nombre,
          h.canton ?? "",
          h.provincia ?? "",
          h.descripcion ?? "",
          etiquetaCategoria(h.categoria),
        ].join(" "),
      ).includes(aguja),
    );
  }, [hospedajes, categoriaActiva, busqueda]);

  return (
    <View style={styles.contenedor}>
      {/* Volver siempre tiene a dónde: si la pila está vacía (deep
          link directo), cae a las pestañas en vez de no hacer nada. */}
      <BarraSuperior
        titulo="Booking Hospedajes"
        subtitulo="Casas, villas y hoteles en Costa Rica"
        onVolver={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />

      {/* El mismo menú de verticales que Explorar: saltar a Eventos o
          Citas con un toque, sin depender de la flecha de volver. */}
      <View style={styles.verticalesZona}>
        <ChipsVerticales activo="hospedajes" />
      </View>

      {errorCarga && hospedajes === null ? (
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>No pudimos cargar los hospedajes</Text>
          <Text style={styles.vacioTexto}>
            Revisá tu conexión e intentá de nuevo.
          </Text>
          <Pressable
            onPress={() => {
              setErrorCarga(false);
              cargar();
            }}
            style={({ pressed }) => [styles.vacioBoton, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.vacioBotonTexto}>Reintentar</Text>
          </Pressable>
        </View>
      ) : hospedajes === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : hospedajes.length === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>Los primeros hospedajes están por llegar</Text>
          <Text style={styles.vacioTexto}>
            Estamos abriendo esta vertical. ¿Tenés una casa, villa, cabaña u
            hotel? Publicalo gratis y recibí reservas con tu propia página.
          </Text>
          <Pressable
            onPress={() => router.push("/negocio/nuevo" as never)}
            style={({ pressed }) => [styles.vacioBoton, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.vacioBotonTexto}>Publicar mi hospedaje</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* El buscador de hospedajes — espejo del de /hospedajes en
              la web: filtra en memoria por nombre, zona o tipo. */}
          <View style={styles.buscadorZona}>
            <View style={styles.buscador}>
              <Ionicons name="search" size={16} color="#3b7fc4" />
              <TextInput
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder={'Buscá por nombre, zona o tipo — ej. "villa" o "Nosara"'}
                placeholderTextColor="#94a3bd"
                style={styles.buscadorInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* Chips de tipo con conteo: "Todos" y solo los que tienen
              hospedajes publicados. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={() => setCategoriaActiva(null)}
              style={[styles.chip, categoriaActiva === null && styles.chipActivo]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.chipTexto,
                  categoriaActiva === null && styles.chipTextoActivo,
                ]}
              >
                Todos ({hospedajes.length})
              </Text>
            </Pressable>
            {CATEGORIAS_HOSPEDAJES.filter((c) => (conteo[c] ?? 0) > 0).map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategoriaActiva(categoriaActiva === c ? null : c)}
                style={[styles.chip, categoriaActiva === c && styles.chipActivo]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.chipTexto,
                    categoriaActiva === c && styles.chipTextoActivo,
                  ]}
                >
                  {CATEGORIA_HOSPEDAJE_LABEL[c]} ({conteo[c]})
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filtrados.length === 0 ? (
            /* Vacío de búsqueda: hay hospedajes, pero ninguno calza con
               el filtro — distinto del vacío sin hospedajes de arriba. */
            <View style={styles.centro}>
              <Text style={styles.vacioTitulo}>
                No encontramos nada con esa búsqueda
              </Text>
              <Text style={styles.vacioTexto}>
                Probá con otra palabra, otra zona, o quitá los filtros.
              </Text>
              <Pressable
                onPress={() => {
                  setBusqueda("");
                  setCategoriaActiva(null);
                }}
                style={({ pressed }) => [
                  styles.botonContorno,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.botonContornoTexto}>Ver todos los hospedajes</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filtrados}
              keyExtractor={(h) => h.id}
              contentContainerStyle={styles.lista}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
              renderItem={({ item: h }) => {
                const calif = calificaciones[h.id];
                const ubicacion = [h.canton, h.provincia].filter(Boolean).join(", ");
                return (
                  <Pressable
                    onPress={() => router.push(`/rancho/${h.id}` as never)}
                    style={({ pressed }) => [styles.tarjeta, pressed && { opacity: 0.92 }]}
                  >
                    <View style={styles.fotoMarco}>
                      {h.foto_url ? (
                        <Image
                          source={{ uri: h.foto_url }}
                          alt={h.nombre}
                          style={styles.foto}
                          contentFit="cover"
                          transition={250}
                        />
                      ) : (
                        <View style={styles.fotoVacia}>
                          <Ionicons name="home-outline" size={34} color="#3b7fc4" />
                        </View>
                      )}
                      <View style={styles.badge}>
                        <Text style={styles.badgeTexto}>{etiquetaCategoria(h.categoria)}</Text>
                      </View>
                      {h.slug?.startsWith("demo-") && (
                        <View style={styles.badgeDemo}>
                          <Text style={styles.badgeDemoTexto}>Demo</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cuerpo}>
                      <View style={styles.filaNombre}>
                        <Text style={styles.nombre} numberOfLines={1}>
                          {h.nombre}
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
                          <Ionicons name="location-outline" size={12} color="#3b7fc4" />
                          <Text style={styles.ubicacion} numberOfLines={1}>
                            {ubicacion}
                          </Text>
                        </View>
                      )}
                      <View style={styles.filaPie}>
                        <Text style={styles.precio}>
                          {h.precio_desde ? (
                            <>
                              Desde{" "}
                              <Text style={styles.precioMonto}>{fmtColones(h.precio_desde)}</Text>{" "}
                              por noche
                            </>
                          ) : (
                            "Consultar"
                          )}
                        </Text>
                        <Text style={styles.reservar}>Reservar →</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </>
      )}

      {/* El dock de atajos: desde el directorio siempre se puede
          saltar a cualquiera de las cinco pestañas de la app. */}
      <BarraRapida />
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
  vacioBoton: {
    backgroundColor: Colors.accent,
    borderRadius: 99,
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  vacioBotonTexto: { color: "#fff", fontFamily: Fonts.extraBold, fontSize: 14 },
  lista: { gap: Spacing.three, padding: Spacing.three, paddingBottom: BARRA_RAPIDA_ESPACIO },
  tarjeta: {
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  fotoMarco: { aspectRatio: 16 / 10, backgroundColor: "#e8f0f9" },
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
  badgeDemo: {
    backgroundColor: "#fbbf24",
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
    position: "absolute",
    right: 10,
    top: 10,
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
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
  },
  precio: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5 },
  precioMonto: { color: Colors.ink, fontFamily: Fonts.extraBold },
  reservar: { color: Colors.accent, fontFamily: Fonts.extraBold, fontSize: 13 },
  buscadorZona: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  buscador: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Colors.cream2,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    height: 46,
  },
  buscadorInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.ink,
    // Sin esto, Android mete padding propio y el texto queda
    // descentrado dentro de la píldora de 46px.
    padding: 0,
  },
  // flexShrink: 0 evita que la fila se aplaste (y recorte los chips)
  // al competir por altura con la lista de abajo.
  chipsScroll: { flexGrow: 0, flexShrink: 0, marginBottom: Spacing.two },
  chips: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 2,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe4f2",
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTexto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.inkSoft },
  chipTextoActivo: { color: "#ffffff" },
  botonContorno: {
    marginTop: Spacing.three,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.navy,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  botonContornoTexto: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.navy },
});
