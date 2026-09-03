import { useCallback, useEffect, useMemo, useState } from "react";
import { selloDe } from "@/components/tag-sello";
import { IconoRubro } from "@/components/iconos-rubro";
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
 * para spa, estetoscopio para consultorio).
 *
 * ⚠️ ANTES ACÁ HABÍA UN MAPA DE IONICONS (cut-outline, man-outline…) con
 * un comentario defendiendo que traer los SVG de la web «habría sido un
 * juego de íconos paralelo». El dueño decidió lo contrario (26 ago
 * 2026): «la misma sintonía de íconos en el app, que se sincronice con
 * la web». Y tiene razón en lo que importa: la silueta del ícono es lo
 * primero que se reconoce de un producto, y el poste de barbero de la
 * web y un "man-outline" acá eran dos productos distintos.
 *
 * Los trazos viven en `components/iconos-rubro.tsx`, copiados número
 * por número de la web — no «parecidos».
 */

/**
 * Un rubro del riel: disco con ícono arriba, rótulo abajo.
 *
 * El disco es blanco SÓLIDO y no translúcido: debajo está el lavado
 * naranja, y un fondo translúcido haría que el ícono cambiara de
 * contraste según dónde caiga.
 */
function RubroIcono({
  icono,
  categoria,
  sub,
  label,
  activo,
  apagado,
  onPress,
}: {
  /** Un Ionicon suelto — solo lo usa el disco «Todos». */
  icono?: IconoNombre;
  /** El rubro: dibuja el MISMO trazo que la web (iconos-rubro.tsx). */
  categoria?: CategoriaCita;
  /** La subcategoría, si el disco es fino (Peinados, Masajes…). */
  sub?: string;
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
        {categoria ? (
          <IconoRubro
            vertical="citas"
            categoria={categoria}
            subcategoria={sub}
            size={22}
            color={activo ? "#ffffff" : Colors.navy}
          />
        ) : (
          <Ionicons
            name={icono ?? "apps-outline"}
            size={22}
            color={activo ? "#ffffff" : Colors.navy}
          />
        )}
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

/**
 * ════════════════════════════════════════════════════════════════════
 * LA GRILLA DE RUBROS EN DOS CARRILES — espejo de la portada web
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (28 ago 2026): «la lista de iconos igual, de dos
 * carriles», también en el teléfono. Las columnas son las MISMAS
 * parejas que `rubros-icono.tsx` de la web (Uñas/Pestañas,
 * Barbería/Peinados…), con la línea divisoria entre grupos. Acá solo
 * van los de Citas: Eventos tiene su propia pestaña (explorar).
 *
 * ⚠️ LOS IDS DE SUBCATEGORÍA SON LOS DE LA BASE (el CHECK de la 0188;
 * en la web viven en src/app/citas/subcategorias.ts), letra por letra.
 * Un id inventado acá sería un disco que nunca enciende: el conteo por
 * sub daría cero para siempre y quedaría apagado sin que nada avise.
 * Los labels cortos («Pestañas» por «Cejas y pestañas», «Estética» por
 * «Tratamientos faciales», «Sauna» por «Sauna y jacuzzi») son los del
 * dueño y también los de la portada web — el id no se toca.
 */
type ItemRubro = { categoria: CategoriaCita; sub?: string; label: string };

const COLUMNAS_RUBROS: (ItemRubro[] | "|")[] = [
  [
    { categoria: "unas", label: CATEGORIA_CITA_LABEL.unas },
    { categoria: "belleza", sub: "cejas_pestanas", label: "Pestañas" },
  ],
  [
    { categoria: "barberia", label: CATEGORIA_CITA_LABEL.barberia },
    { categoria: "belleza", sub: "peinados", label: "Peinados" },
  ],
  [
    { categoria: "belleza", label: CATEGORIA_CITA_LABEL.belleza },
    { categoria: "belleza", sub: "maquillaje", label: "Maquillaje" },
  ],
  [
    { categoria: "belleza", sub: "depilacion", label: "Depilación" },
    { categoria: "belleza", sub: "tratamientos_faciales", label: "Estética" },
  ],
  "|",
  [
    { categoria: "spa", label: CATEGORIA_CITA_LABEL.spa },
    { categoria: "spa", sub: "masajes", label: "Masajes" },
  ],
  [
    { categoria: "consultorio", label: CATEGORIA_CITA_LABEL.consultorio },
    { categoria: "spa", sub: "sauna_jacuzzi", label: "Sauna" },
  ],
  "|",
  [{ categoria: "otros", label: CATEGORIA_CITA_LABEL.otros }],
];

type Negocio = {
  /** El sello de la tarjeta: los mismos que la web (0214/0217). */
  verificado?: boolean | null;
  info_publica?: boolean | null;

  id: string;
  nombre: string;
  slug: string | null;
  categoria: string | null;
  subcategoria: string | null;
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
  // La subcategoría activa de la grilla (Peinados, Masajes…). Solo vive
  // junto a su categoría: elegirla la fija, y volver a «Todos» la borra.
  const [subActiva, setSubActiva] = useState<string | null>(null);
  /** El panel de atajos que se abre al tocar el buscador. */
  const [desplegable, setDesplegable] = useState(false);

  const cargar = useCallback(async () => {
    const [{ data: filas, error: errorNegocios }, { data: califs }] = await Promise.all([
      supabase
        .from("ranchos")
        .select("id, nombre, slug, categoria, subcategoria, descripcion, provincia, canton, foto_url, precio_desde, created_at, verificado, info_publica")
        .eq("vertical", "citas")
        .eq("estado", "aprobado")
        // ⚠️ Sin los negocios de la DEMO (27 ago 2026). El seed de
        // /demo-bookea siembra 99 negocios APROBADOS con
        // en_marketplace=false — la web los filtra así desde
        // home-datos.ts, pero la app no lo hacía y los 99 se le
        // colaron a los listados. `neq` y no `eq(true)`: un NULL
        // viejo no es ni igual ni distinto a true en Postgres.
        .neq("en_marketplace", false)
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
    const base = (negocios ?? []).filter(
      (n) =>
        (!categoriaActiva ||
          normalizarCategoriaCita(n.categoria) === categoriaActiva) &&
        (!subActiva || n.subcategoria === subActiva),
    );
    const aguja = normalizarTexto(busqueda).trim();
    if (!aguja) return base;
    return base.filter((n) =>
      normalizarTexto(
        [
          n.nombre,
          n.canton ?? "",
          n.provincia ?? "",
          n.descripcion ?? "",
          // El id crudo alcanza: «masajes» ya es la palabra, y en los
          // compuestos («cejas_pestanas») el includes case por la
          // palabra suelta igual. La web hace lo mismo en
          // filtrarPorBusqueda.
          n.subcategoria ?? "",
          CATEGORIA_CITA_LABEL[normalizarCategoriaCita(n.categoria)],
        ].join(" "),
      ).includes(aguja),
    );
  }, [negocios, categoriaActiva, subActiva, busqueda]);

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
      nota="Precios en línea"
      demo={n.slug?.startsWith("demo-")}
      nuevo={esNegocioNuevo(n.created_at)}
      sello={selloDe(n)}
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
            {/* «Todos» ocupa el alto de los dos carriles, centrado. */}
            <View style={styles.todosCentrado}>
              <RubroIcono
                icono="apps-outline"
                label="Todos"
                activo={categoriaActiva === null}
                onPress={() => {
                  setCategoriaActiva(null);
                  setSubActiva(null);
                }}
              />
            </View>
            {COLUMNAS_RUBROS.map((col, i) =>
              col === "|" ? (
                <View key={`div-${i}`} style={styles.divisorRubros} />
              ) : (
                <View key={`col-${i}`} style={styles.columnaRubros}>
                  {col.map((item) => {
                    // Los discos FINOS nunca se apagan (la verificación
                    // del 28 ago los cazó nacidos muertos: la
                    // subcategoría recién empieza a llenarse y un
                    // conteo en cero los dejaba grises e intocables
                    // para siempre). Igual que en la web: siempre
                    // tocables, y el que no encuentra nada aterriza en
                    // el vacío honesto con la salida puesta.
                    const n = conteo[item.categoria] ?? 0;
                    const activo = item.sub
                      ? subActiva === item.sub
                      : categoriaActiva === item.categoria && !subActiva;
                    return (
                      <RubroIcono
                        key={item.sub ?? item.categoria}
                        categoria={item.categoria}
                        sub={item.sub}
                        label={item.label}
                        activo={activo}
                        apagado={!item.sub && n === 0}
                        onPress={() => {
                          if (!item.sub && n === 0) return;
                          if (item.sub) {
                            // Elegir un sub fija también su categoría:
                            // el filtro es «peinados», no «peinados de
                            // cualquier rubro».
                            if (subActiva === item.sub) {
                              // Apagarlo quita TODO el filtro, como en
                              // la web (href="/"): dejar puesta la
                              // categoría padre sería un estado que la
                              // persona nunca eligió.
                              setSubActiva(null);
                              setCategoriaActiva(null);
                            } else {
                              setCategoriaActiva(item.categoria);
                              setSubActiva(item.sub);
                            }
                          } else {
                            // Con un sub activo, tocar la categoría
                            // AMPLÍA a toda la categoría (el disco se
                            // ve inactivo y así se comporta la web);
                            // solo apaga si de verdad estaba activa.
                            const estabaActiva =
                              categoriaActiva === item.categoria && !subActiva;
                            setSubActiva(null);
                            setCategoriaActiva(
                              estabaActiva ? null : item.categoria,
                            );
                          }
                        }}
                      />
                    );
                  })}
                </View>
              ),
            )}
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
                    setSubActiva(null);
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
  /* Los dos pisos de una columna de la grilla (28 ago 2026): cada
     columna es una pareja elegida, igual que en la portada web. */
  columnaRubros: { gap: 2 },
  divisorRubros: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: Colors.line,
    marginVertical: 10,
    marginHorizontal: 2,
  },
  todosCentrado: { justifyContent: "center" },
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
  // `elevation: 0` ADEMÁS de `shadowOpacity`: la primera apaga la
  // sombra en Android y la segunda en iOS. Con solo una, el disco
  // apagado quedaba plano en iPhone y todavía levantado en Android.
  rubroApagado: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },
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
