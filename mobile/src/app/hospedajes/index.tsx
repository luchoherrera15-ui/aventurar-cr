import { useCallback, useEffect, useMemo, useState } from "react";
import { selloDe } from "@/components/tag-sello";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import BarraSuperior from "@/components/barra-superior";
import BarraRapida, { BARRA_RAPIDA_ESPACIO } from "@/components/barra-rapida";
import ChipsVerticales from "@/components/chips-verticales";
import Buscador from "@/components/buscador";
import TarjetaNegocio from "@/components/tarjeta-negocio";
import { esNegocioNuevo } from "@/components/tag-nuevo";
import { ChipCategoria, Vacio } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { Colors, Spacing } from "@/constants/theme";
import { normalizarTexto } from "@/lib/busqueda";
import {
  CATEGORIA_HOSPEDAJE_LABEL,
  CATEGORIAS_HOSPEDAJES,
  normalizarCategoriaHospedaje,
  type CategoriaHospedaje,
} from "@/lib/hospedajes";

type Hospedaje = {
  /** El sello de la tarjeta: los mismos que la web (0214/0217). */
  verificado?: boolean | null;
  info_publica?: boolean | null;

  id: string;
  nombre: string;
  slug: string | null;
  categoria: string | null;
  descripcion: string | null;
  provincia: string | null;
  canton: string | null;
  foto_url: string | null;
  precio_desde: number | null;
  /** Para el tag "NUEVO" (ver `esNegocioNuevo`). */
  created_at: string | null;
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
 * web y gemelo del de Servicios: buscador, chips por tipo con conteo y
 * las cards de casas, villas, cabañas y hoteles con su nota y su
 * "Desde ₡ por noche". Tocar una entra al detalle; todo desemboca en
 * la reserva por noches.
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
        .select("id, nombre, slug, categoria, descripcion, provincia, canton, foto_url, precio_desde, created_at, verificado, info_publica")
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
  // con la búsqueda), igual que en el directorio de Servicios.
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
        kicker="Hospedajes"
        titulo="Reservá tu escapada"
        subtitulo="Casas, villas, cabañas y hoteles en Costa Rica"
        onVolver={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />

      {/* El mismo menú de verticales que Explorar: saltar a Eventos o
          Servicios con un toque, sin depender de la flecha de volver. */}
      <View style={styles.verticalesZona}>
        <ChipsVerticales />
      </View>

      {errorCarga && hospedajes === null ? (
        <View style={styles.centro}>
          <Vacio
            icono="cloud-offline-outline"
            titulo="No pudimos cargar los hospedajes"
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
      ) : hospedajes === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : hospedajes.length === 0 ? (
        <View style={styles.centro}>
          <Vacio
            icono="home-outline"
            titulo="Los primeros hospedajes están por llegar"
            texto="Estamos abriendo esta vertical. ¿Tenés una casa, villa, cabaña u hotel? Publicalo gratis y recibí reservas con tu propia página."
            accion={{
              texto: "Publicar mi hospedaje",
              onPress: () => router.push("/negocio/nuevo" as never),
            }}
          />
        </View>
      ) : (
        <>
          {/* El mismo buscador que las otras tres verticales. */}
          <View style={styles.buscadorZona}>
            <Buscador
              valor={busqueda}
              onCambiar={setBusqueda}
              placeholder={'Buscá por nombre, zona o tipo — ej. "Nosara"'}
            />
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
            <ChipCategoria
              texto={`Todos (${hospedajes.length})`}
              activo={categoriaActiva === null}
              onPress={() => setCategoriaActiva(null)}
            />
            {CATEGORIAS_HOSPEDAJES.filter((c) => (conteo[c] ?? 0) > 0).map((c) => (
              <ChipCategoria
                key={c}
                texto={`${CATEGORIA_HOSPEDAJE_LABEL[c]} (${conteo[c]})`}
                activo={categoriaActiva === c}
                onPress={() => setCategoriaActiva(categoriaActiva === c ? null : c)}
              />
            ))}
          </ScrollView>

          {filtrados.length === 0 ? (
            /* Vacío de búsqueda: hay hospedajes, pero ninguno calza con
               el filtro — distinto del vacío sin hospedajes de arriba. */
            <View style={styles.centro}>
              <Vacio
                titulo="No encontramos nada con esa búsqueda"
                texto="Probá con otra palabra, otra zona, o quitá los filtros."
                accion={{
                  texto: "Ver todos los hospedajes",
                  onPress: () => {
                    setBusqueda("");
                    setCategoriaActiva(null);
                  },
                }}
              />
            </View>
          ) : (
            <FlatList
              data={filtrados}
              keyExtractor={(h) => h.id}
              contentContainerStyle={styles.lista}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
              renderItem={({ item: h }) => (
                <TarjetaNegocio
                  nombre={h.nombre}
                  foto={h.foto_url}
                  iconoVacio="home-outline"
                  etiqueta={etiquetaCategoria(h.categoria)}
                  calificacion={calificaciones[h.id] ?? null}
                  ubicacion={[h.canton, h.provincia].filter(Boolean).join(", ") || null}
                  demo={h.slug?.startsWith("demo-")}
                  nuevo={esNegocioNuevo(h.created_at)}
                  sello={selloDe(h)}
                  onPress={() => router.push(`/rancho/${h.id}` as never)}
                />
              )}
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
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  verticalesZona: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  centro: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: BARRA_RAPIDA_ESPACIO,
    paddingHorizontal: Spacing.three,
  },
  lista: { gap: Spacing.three, padding: Spacing.three, paddingBottom: BARRA_RAPIDA_ESPACIO },
  buscadorZona: { paddingBottom: Spacing.two + 2, paddingHorizontal: Spacing.three },
  // flexShrink: 0 evita que la fila se aplaste (y recorte los chips)
  // al competir por altura con la lista de abajo.
  chipsScroll: { flexGrow: 0, flexShrink: 0, marginBottom: Spacing.two + 2 },
  chips: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 2,
  },
});
