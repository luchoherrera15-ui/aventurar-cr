import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import Buscador from "@/components/buscador";
import BuscadorDesplegable, { recordarBusqueda } from "@/components/buscador-desplegable";
import TarjetaNegocio from "@/components/tarjeta-negocio";
import { esNegocioNuevo } from "@/components/tag-nuevo";
import { Encabezado, Vacio } from "@/components/ui";
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

type IconoNombre = keyof typeof Ionicons.glyphMap;

/**
 * Un ícono por rubro. Son los MISMOS conceptos que la portada web
 * (tijeras para belleza, poste para barbería, esmalte para uñas, loto
 * para spa, estetoscopio para consultorio): la web los dibuja a mano en
 * SVG y acá se toman de Ionicons, que es lo que la app ya usa en todas
 * las demás pantallas. Traer los SVG de la web habría sido un juego de
 * íconos paralelo para nueve dibujos.
 */
const CATEGORIA_CITA_ICONO: Record<CategoriaCita, IconoNombre> = {
  belleza: "cut-outline",
  barberia: "man-outline",
  unas: "hand-left-outline",
  spa: "flower-outline",
  consultorio: "medkit-outline",
  otros: "ellipsis-horizontal-outline",
};

/**
 * Un rubro del riel: disco con ícono arriba, rótulo abajo.
 *
 * El disco es blanco SÓLIDO y no translúcido: debajo está el lavado
 * naranja, y un fondo translúcido haría que el ícono cambiara de
 * contraste según dónde caiga.
 */
function RubroIcono({
  icono,
  label,
  activo,
  apagado,
  onPress,
}: {
  icono: IconoNombre;
  label: string;
  activo: boolean;
  apagado?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={apagado ? `${label} — todavía sin negocios` : label}
      accessibilityState={{ selected: activo, disabled: apagado }}
      disabled={apagado}
      onPress={onPress}
      style={styles.rubro}
    >
      <View
        style={[
          styles.rubroDisco,
          activo && styles.rubroDiscoActivo,
          apagado && styles.rubroApagado,
        ]}
      >
        <Ionicons
          name={icono}
          size={22}
          color={activo ? "#ffffff" : Colors.navy}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[styles.rubroTexto, apagado && styles.rubroTextoApagado]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

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
  /** Para el tag "NUEVO" (ver `esNegocioNuevo`). */
  created_at: string | null;
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
 * chip "Eventos" que vivía arriba (ver el comentario del lavado).
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
  /** El panel de atajos que se abre al tocar el buscador. */
  const [desplegable, setDesplegable] = useState(false);

  const cargar = useCallback(async () => {
    const [{ data: filas, error: errorNegocios }, { data: califs }] = await Promise.all([
      supabase
        .from("ranchos")
        .select("id, nombre, slug, categoria, subcategoria, descripcion, provincia, canton, foto_url, precio_desde, created_at")
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

  // Se recuerda la búsqueda solo si DIO algo: guardar un término que no
  // encontró nada llenaría las recientes de intentos fallidos.
  useEffect(() => {
    const termino = busqueda.trim();
    if (termino.length < 2 || filtrados.length === 0) return;
    const timer = setTimeout(() => void recordarBusqueda(termino), 1200);
    return () => clearTimeout(timer);
  }, [busqueda, filtrados.length]);

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
      demo={n.slug?.startsWith("demo-")}
      nuevo={esNegocioNuevo(n.created_at)}
      onPress={() => router.push(`/citas/${n.id}` as never)}
    />
  );

  return (
    <View style={styles.contenedor}>
      {/* ── EL LAVADO NARANJA, igual que la portada web ────────────────
          Tres capas de color que se apagan hacia abajo. En React Native
          no hay radial-gradient ni CSS mask, así que el degradado se
          arma apilando vistas con opacidad decreciente: es la misma
          idea —color arriba, nada abajo— con las herramientas que hay.

          `pointerEvents="none"` para que la capa no se coma los toques
          del buscador que va encima, y `position: absolute` para que no
          empuje el layout ni un píxel.

          ⚠️ ACÁ VIVÍA `ChipsVerticales` (el selector Eventos /
          Servicios). Se fue (pedido del dueño, ago 2026) por lo mismo
          que en la web: «Eventos» y «Servicios» son NUESTRA
          arquitectura, no la de quien entra a reservar. La fila de
          rubros de abajo dice directo lo que se puede pedir. La
          pantalla de Eventos sigue viva en `/eventos`. */}
      <View pointerEvents="none" style={styles.auroraCaja}>
        <View style={[styles.auroraCapa, styles.auroraUno]} />
        <View style={[styles.auroraCapa, styles.auroraDos]} />
        <View style={[styles.auroraCapa, styles.auroraTres]} />
      </View>

      <View style={{ paddingTop: insets.top + Spacing.two }} />

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
              verticales: filtra en memoria por nombre, zona o rubro.
              Al enfocarlo se abre el desplegable con Cerca / Ver mapa /
              búsquedas recientes. */}
          <View style={styles.buscadorZona}>
            <Buscador
              valor={busqueda}
              onCambiar={(v) => {
                setBusqueda(v);
                // Escribir cierra los atajos: ya está buscando.
                if (v.trim()) setDesplegable(false);
              }}
              onFocus={() => setDesplegable(true)}
              placeholder={'Buscá por nombre, zona o rubro — ej. "uñas"'}
            />
            <BuscadorDesplegable
              visible={desplegable}
              vertical="citas"
              onElegirTermino={setBusqueda}
              onCerrar={() => setDesplegable(false)}
            />
          </View>

          {/* EL SLIDEBAR DE RUBROS, completo.
              Antes solo se dibujaban las categorías CON negocios
              (`.filter(conteo > 0)`), así que el riel cambiaba de
              contenido según qué hubiera cargado y nunca se veía el
              catálogo real de lo que Bookea cubre. Ahora salen todas
              siempre, en el orden oficial: las vacías van apagadas y no
              se pueden tocar, pero se ven — es la vitrina de rubros,
              no un filtro de resultados. */}
          {/* ── LOS RUBROS COMO ÍCONOS, igual que la portada web ───────
              Eran chips de texto con el conteo entre paréntesis. Ahora
              son discos con ícono, que es lo que se reconoce de un
              vistazo con el teléfono en la mano.

              ⚠️ EL CONTEO SALIÓ DEL RÓTULO. «Belleza (0)» delante de
              alguien que llega es un cartel que dice que Bookea está
              vacío. Lo que quedó es el mismo criterio de antes —el
              rubro sin negocios se ve APAGADO y no se puede tocar— pero
              sin poner el número enfrente. Se siguen mostrando todos:
              es la vitrina de lo que Bookea cubre, no un filtro de
              resultados. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.rubros}
            keyboardShouldPersistTaps="handled"
          >
            <RubroIcono
              icono="apps-outline"
              label="Todos"
              activo={categoriaActiva === null}
              onPress={() => setCategoriaActiva(null)}
            />
            {CATEGORIAS_CITAS.map((c) => {
              const n = conteo[c] ?? 0;
              return (
                <RubroIcono
                  key={c}
                  icono={CATEGORIA_CITA_ICONO[c]}
                  label={CATEGORIA_CITA_LABEL[c]}
                  activo={categoriaActiva === c}
                  apagado={n === 0}
                  onPress={() => n > 0 && setCategoriaActiva(categoriaActiva === c ? null : c)}
                />
              );
            })}
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

  // ── LOS RUBROS CON ÍCONO ─────────────────────────────────────────
  rubros: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 2,
  },
  rubro: { alignItems: "center", gap: 6, width: 68 },
  rubroDisco: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    width: 52,
    // La sombra es la que despega el disco del lavado naranja. Va suave:
    // ocho discos con sombra fuerte se leen como ocho botones gritando.
    elevation: 2,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  rubroDiscoActivo: { backgroundColor: Colors.navy },
  // Apagado = todavía no hay negocios de ese rubro. Se ve, pero no se
  // toca: es la vitrina de lo que Bookea cubre.
  rubroApagado: { opacity: 0.4, shadowOpacity: 0 },
  rubroTexto: {
    color: Colors.navy,
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    textAlign: "center",
  },
  rubroTextoApagado: { opacity: 0.55 },

  // ── EL LAVADO NARANJA ────────────────────────────────────────────
  // Tres bandas apiladas con opacidad decreciente. React Native no tiene
  // radial-gradient ni máscara, así que el apagado se consigue con la
  // altura y el alfa de cada banda: la de arriba es la más saturada y la
  // de abajo casi no se ve. El resultado es el mismo que en la web
  // —color arriba, blanco abajo, sin un borde donde termina— con lo que
  // hay en la plataforma.
  auroraCaja: { height: 320, left: 0, position: "absolute", right: 0, top: 0 },
  auroraCapa: { left: 0, position: "absolute", right: 0 },
  auroraUno: { backgroundColor: "#fdf0e2", height: 190, top: 0 },
  auroraDos: { backgroundColor: "#fdf0e2", height: 70, opacity: 0.55, top: 190 },
  auroraTres: { backgroundColor: "#fdf0e2", height: 60, opacity: 0.22, top: 260 },
});
