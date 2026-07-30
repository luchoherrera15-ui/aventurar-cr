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
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";
import { normalizarTexto } from "@/lib/busqueda";
import {
  CATEGORIA_CITA_LABEL,
  CATEGORIAS_CITAS,
  normalizarCategoriaCita,
  type CategoriaCita,
} from "@/lib/citas";

type Negocio = {
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

/**
 * El directorio de Citas del app — espejo de /citas en la web: las
 * cards de los negocios que atienden con turno (belleza, barbería,
 * uñas, spa...), con su nota y su "desde ₡". Tocar una entra al
 * negocio; todo desemboca en la agenda.
 */
export default function CitasDirectorioScreen() {
  const router = useRouter();
  const [negocios, setNegocios] = useState<Negocio[] | null>(null);
  const [calificaciones, setCalificaciones] = useState<Record<string, Calificacion>>({});
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaCita | null>(null);

  const cargar = useCallback(async () => {
    const [{ data: filas }, { data: califs }] = await Promise.all([
      supabase
        .from("ranchos")
        .select("id, nombre, slug, categoria, descripcion, provincia, canton, foto_url, precio_desde")
        .eq("vertical", "citas")
        .eq("estado", "aprobado")
        .order("created_at", { ascending: false }),
      supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
    ]);
    setNegocios((filas ?? []) as Negocio[]);
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

  // Conteo por categoría sobre TODOS los negocios (los chips no cambian
  // con la búsqueda), igual que en /citas de la web.
  const conteo = useMemo(() => {
    const c: Partial<Record<CategoriaCita, number>> = {};
    (negocios ?? []).forEach((n) => {
      const cat = normalizarCategoriaCita(n.categoria);
      c[cat] = (c[cat] ?? 0) + 1;
    });
    return c;
  }, [negocios]);

  // El buscador filtra en memoria por nombre, zona, rubro o descripción,
  // sin pelear con tildes: "unas" encuentra "Uñas".
  const filtrados = useMemo(() => {
    const base = categoriaActiva
      ? (negocios ?? []).filter(
          (n) => normalizarCategoriaCita(n.categoria) === categoriaActiva,
        )
      : (negocios ?? []);
    const aguja = normalizarTexto(busqueda).trim();
    if (!aguja) return base;
    return base.filter((n) =>
      normalizarTexto(
        [
          n.nombre,
          n.canton ?? "",
          n.provincia ?? "",
          n.descripcion ?? "",
          CATEGORIA_CITA_LABEL[normalizarCategoriaCita(n.categoria)],
        ].join(" "),
      ).includes(aguja),
    );
  }, [negocios, categoriaActiva, busqueda]);

  return (
    <View style={styles.contenedor}>
      {/* Volver siempre tiene a dónde: si la pila está vacía (deep
          link directo), cae a las pestañas en vez de no hacer nada. */}
      <BarraSuperior
        titulo="Citas y Reservas"
        subtitulo="Reservá tu cita en línea"
        onVolver={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />

      {negocios === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : negocios.length === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>Los primeros negocios están por llegar</Text>
          <Text style={styles.vacioTexto}>
            Estamos abriendo esta sección. Muy pronto vas a poder reservar tu
            cita de belleza, barbería o spa desde acá.
          </Text>
        </View>
      ) : (
        <>
          {/* El buscador de agendas — espejo del de /citas en la web:
              filtra en memoria por nombre, zona o rubro. */}
          <View style={styles.buscadorZona}>
            <View style={styles.buscador}>
              <Ionicons name="search" size={16} color="#3b7fc4" />
              <TextInput
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder={'Buscá por nombre, zona o rubro — ej. "uñas" o "Moravia"'}
                placeholderTextColor="#94a3bd"
                style={styles.buscadorInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* Chips de categoría con conteo: "Todos" y solo las que
              tienen negocios. */}
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
                style={[
                  styles.chipTexto,
                  categoriaActiva === null && styles.chipTextoActivo,
                ]}
              >
                Todos ({negocios.length})
              </Text>
            </Pressable>
            {CATEGORIAS_CITAS.filter((c) => (conteo[c] ?? 0) > 0).map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategoriaActiva(categoriaActiva === c ? null : c)}
                style={[styles.chip, categoriaActiva === c && styles.chipActivo]}
              >
                <Text
                  style={[
                    styles.chipTexto,
                    categoriaActiva === c && styles.chipTextoActivo,
                  ]}
                >
                  {CATEGORIA_CITA_LABEL[c]} ({conteo[c]})
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filtrados.length === 0 ? (
            /* Vacío de búsqueda: hay negocios, pero ninguno calza con
               el filtro — distinto del vacío sin negocios de arriba. */
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
                <Text style={styles.botonContornoTexto}>Ver todos los negocios</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filtrados}
              keyExtractor={(n) => n.id}
              contentContainerStyle={styles.lista}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
              renderItem={({ item: n }) => {
                const calif = calificaciones[n.id];
                const ubicacion = [n.canton, n.provincia].filter(Boolean).join(", ");
                return (
                  <Pressable
                    onPress={() => router.push(`/citas/${n.id}` as never)}
                    style={({ pressed }) => [styles.tarjeta, pressed && { opacity: 0.92 }]}
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
                          <Ionicons name="time-outline" size={34} color="#3b7fc4" />
                        </View>
                      )}
                      <View style={styles.badge}>
                        <Text style={styles.badgeTexto}>
                          {CATEGORIA_CITA_LABEL[normalizarCategoriaCita(n.categoria)]}
                        </Text>
                      </View>
                      {n.slug?.startsWith("demo-") && (
                        <View style={styles.badgeDemo}>
                          <Text style={styles.badgeDemoTexto}>Demo</Text>
                        </View>
                      )}
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
                          <Ionicons name="location-outline" size={12} color="#3b7fc4" />
                          <Text style={styles.ubicacion} numberOfLines={1}>
                            {ubicacion}
                          </Text>
                        </View>
                      )}
                      <View style={styles.filaPie}>
                        <Text style={styles.precio}>
                          {n.precio_desde ? (
                            <>
                              Desde{" "}
                              <Text style={styles.precioMonto}>{fmtColones(n.precio_desde)}</Text>
                            </>
                          ) : (
                            "Precios en línea"
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
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  centro: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
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
  lista: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.five },
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
  buscadorZona: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
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
  },
  chipsScroll: { flexGrow: 0, marginBottom: Spacing.two },
  chips: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
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
