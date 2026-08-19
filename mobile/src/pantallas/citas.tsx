import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import ChipsVerticales from "@/components/chips-verticales";
import Buscador from "@/components/buscador";
import TarjetaNegocio from "@/components/tarjeta-negocio";
import { ChipCategoria, Encabezado, Vacio } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { Colors, Spacing } from "@/constants/theme";
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

/** Títulos de las filas del directorio — espejo de /citas en la web:
 * más vendedores que el label corto (que sigue mandando en badges). */
const TITULO_FILA: Record<CategoriaCita, string> = {
  belleza: "Salones de belleza",
  barberia: "Barberías",
  unas: "Uñas",
  spa: "Spa y masajes",
  consultorio: "Consultorios médicos",
  otros: "Otros servicios",
};

/**
 * El directorio de Servicios como pestaña de aterrizaje del pager —
 * es la que se ve al abrir la app: los negocios que atienden con
 * turno (belleza, barbería, uñas, spa...), con su nota y su "desde
 * ₡". Tocar uno entra al negocio; todo desemboca en la agenda.
 *
 * Eventos era la pestaña de aterrizaje antes; ahora es pantalla
 * aparte (`/eventos`, ver `pantallas/explorar.tsx`) y se llega con el
 * chip "Eventos" de `ChipsVerticales`, arriba.
 *
 * Usa las mismas piezas que las otras verticales: `Buscador` arriba,
 * `TarjetaNegocio` en las listas y `Vacio` en los estados sin
 * resultado — la vertical cambia el contenido, nunca el lenguaje.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- el pager pasa `activa` a todas las pestañas; Citas no la necesita (carga al montar y con pull-refresh)
export default function CitasScreen({ activa = true }: { activa?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [negocios, setNegocios] = useState<Negocio[] | null>(null);
  const [calificaciones, setCalificaciones] = useState<Record<string, Calificacion>>({});
  const [refrescando, setRefrescando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaCita | null>(null);

  const cargar = useCallback(async () => {
    const [{ data: filas, error: errorNegocios }, { data: califs }] = await Promise.all([
      supabase
        .from("ranchos")
        .select("id, nombre, slug, categoria, descripcion, provincia, canton, foto_url, precio_desde")
        .eq("vertical", "citas")
        .eq("estado", "aprobado")
        .order("created_at", { ascending: false }),
      supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
    ]);
    // Sin esto, un fallo de red se disfrazaría de "directorio vacío".
    if (errorNegocios) {
      setErrorCarga(true);
      return;
    }
    setErrorCarga(false);
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

  // Sin filtro ni búsqueda: una fila horizontal por categoría, en el
  // orden oficial y saltando las vacías — espejo de /citas en la web.
  const filas = useMemo(
    () =>
      CATEGORIAS_CITAS.map((c) => ({
        categoria: c,
        items: (negocios ?? []).filter(
          (n) => normalizarCategoriaCita(n.categoria) === c,
        ),
      })).filter((f) => f.items.length > 0),
    [negocios],
  );
  const vistaFilas = !categoriaActiva && !normalizarTexto(busqueda).trim();

  const renderTarjeta = (n: Negocio, ancho: "riel" | "completo") => (
    <TarjetaNegocio
      ancho={ancho}
      nombre={n.nombre}
      foto={n.foto_url}
      iconoVacio="time-outline"
      etiqueta={CATEGORIA_CITA_LABEL[normalizarCategoriaCita(n.categoria)]}
      calificacion={calificaciones[n.id] ?? null}
      ubicacion={[n.canton, n.provincia].filter(Boolean).join(", ") || null}
      precio={n.precio_desde ? fmtColones(n.precio_desde) : null}
      textoSinPrecio="Precios en línea"
      cta="Reservar"
      tonoCta="navy"
      demo={n.slug?.startsWith("demo-")}
      onPress={() => router.push(`/citas/${n.id}` as never)}
    />
  );

  return (
    <View style={styles.contenedor}>
      {/* Sin barra nativa en las pestañas: los chips arrancan justo
          debajo del notch, igual que hacía Explorar. */}
      <View style={[styles.verticalesZona, { paddingTop: insets.top + Spacing.two }]}>
        {/* El mismo menú de verticales que Eventos: saltar ahí con un
            toque, sin depender de la flecha de volver (acá no hay). */}
        <ChipsVerticales activo="citas" />
      </View>

      {errorCarga && negocios === null ? (
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
      ) : negocios === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : negocios.length === 0 ? (
        <View style={styles.centro}>
          <Vacio
            icono="time-outline"
            titulo="Los primeros negocios están por llegar"
            texto="Estamos abriendo esta sección. Muy pronto vas a poder reservar tu cita de belleza, barbería o spa desde acá."
          />
        </View>
      ) : (
        <>
          {/* El buscador de agendas — el mismo componente en las cuatro
              verticales: filtra en memoria por nombre, zona o rubro. */}
          <View style={styles.buscadorZona}>
            <Buscador
              valor={busqueda}
              onCambiar={setBusqueda}
              placeholder={'Buscá por nombre, zona o rubro — ej. "uñas"'}
            />
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
            <ChipCategoria
              texto={`Todos (${negocios.length})`}
              activo={categoriaActiva === null}
              onPress={() => setCategoriaActiva(null)}
            />
            {CATEGORIAS_CITAS.filter((c) => (conteo[c] ?? 0) > 0).map((c) => (
              <ChipCategoria
                key={c}
                texto={`${CATEGORIA_CITA_LABEL[c]} (${conteo[c]})`}
                activo={categoriaActiva === c}
                onPress={() => setCategoriaActiva(categoriaActiva === c ? null : c)}
              />
            ))}
          </ScrollView>

          {filtrados.length === 0 ? (
            /* Vacío de búsqueda: hay negocios, pero ninguno calza con
               el filtro — distinto del vacío sin negocios de arriba. */
            <View style={styles.centro}>
              <Vacio
                titulo="No encontramos nada con esa búsqueda"
                texto="Probá con otra palabra, otra zona, o quitá los filtros."
                accion={{
                  texto: "Ver todos los negocios",
                  onPress: () => {
                    setBusqueda("");
                    setCategoriaActiva(null);
                  },
                }}
              />
            </View>
          ) : vistaFilas ? (
            /* Una fila por categoría: título + línea horizontal de
               cards. "Ver todos" activa el chip de esa categoría. */
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
                      kicker={`${f.items.length} ${f.items.length === 1 ? "negocio" : "negocios"}`}
                      titulo={TITULO_FILA[f.categoria]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  verticalesZona: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  centro: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: TAB_BAR_ESPACIO,
    paddingHorizontal: Spacing.three,
  },
  lista: { gap: Spacing.three, padding: Spacing.three, paddingBottom: TAB_BAR_ESPACIO },
  listaFilas: {
    gap: Spacing.four,
    paddingBottom: TAB_BAR_ESPACIO,
    paddingTop: Spacing.two,
  },
  filaEncabezado: { paddingHorizontal: Spacing.three },
  filaListaCards: { gap: Spacing.three, paddingHorizontal: Spacing.three },
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
