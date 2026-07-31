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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  fmtFechaCortaISO,
  hoyISOLocal,
  interpretarBusqueda,
  normalizarTexto,
} from "@/lib/busqueda";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import ChipsVerticales from "@/components/chips-verticales";
import Buscador, { ChipFiltro } from "@/components/buscador";
import TarjetaNegocio from "@/components/tarjeta-negocio";
import { Boton, ChipCategoria, Encabezado, Micro, Vacio } from "@/components/ui";
import {
  CANTONES,
  CATEGORIA_LABEL,
  CATEGORIAS,
  PROVINCIAS,
  SUBCATEGORIAS,
  fmtColones,
  type Categoria,
  type Provincia,
  type Rancho,
} from "@/lib/types";

type Calificacion = { promedio: number; total: number };

type IconoNombre = keyof typeof Ionicons.glyphMap;

/** Íconos de línea (nada de emojis) para la barra de categorías —
 * los mismos conceptos que la web: disco para animación, calendario
 * para organización, varita para otros. */
const CATEGORIA_ICONO: Record<Categoria, IconoNombre> = {
  lugares: "home-outline",
  alimentacion: "restaurant-outline",
  animacion: "disc-outline",
  organizacion: "calendar-outline",
  decoracion: "balloon-outline",
  otros: "color-wand-outline",
};

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
> & {
  /** Opcional: los filtros de invitados lo usan si viene en el select;
   * favoritos.tsx no lo trae y la tarjeta no lo necesita. */
  capacidad_max?: number | null;
};

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

  // Filtros avanzados (el botón de opciones junto al buscador): zona,
  // cantidad de invitados y precio tope. Viven aparte de la búsqueda
  // por texto y de las categorías — se combinan todos.
  const [modalFiltros, setModalFiltros] = useState(false);
  const [filtroProvincia, setFiltroProvincia] = useState<Provincia | null>(null);
  const [filtroCanton, setFiltroCanton] = useState<string | null>(null);
  const [filtroInvitados, setFiltroInvitados] = useState("");
  const [filtroPrecioMax, setFiltroPrecioMax] = useState("");

  const invitadosNum = parseInt(filtroInvitados.replace(/\D/g, ""), 10) || 0;
  const precioMaxNum = parseInt(filtroPrecioMax.replace(/\D/g, ""), 10) || 0;
  const filtrosPuestos =
    (filtroProvincia !== null ? 1 : 0) +
    (filtroCanton !== null ? 1 : 0) +
    (invitadosNum > 0 ? 1 : 0) +
    (precioMaxNum > 0 ? 1 : 0);
  const hayFiltros = filtrosPuestos > 0;

  function limpiarFiltros() {
    setFiltroProvincia(null);
    setFiltroCanton(null);
    setFiltroInvitados("");
    setFiltroPrecioMax("");
  }

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
        .select("*")
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
    // Solo la vertical de eventos: los negocios de citas (0055) llegan
    // a la app en su propia fase. Se filtra en JS para que la pantalla
    // siga viva aunque la migración no se haya corrido.
    setRanchos(
      ((data ?? []) as (Fila & { vertical?: string })[])
        .filter((r) => (r.vertical ?? "eventos") === "eventos")
        .sort(
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

  // La lupa entiende fechas ("3 de agosto", "este viernes"): esa parte
  // se vuelve filtro de disponibilidad y el resto busca por texto.
  const hoy = useMemo(() => hoyISOLocal(), []);
  const interpretada = useMemo(() => interpretarBusqueda(query, hoy), [query, hoy]);

  // Con fecha detectada se trae qué Lugares ya están confirmados ese
  // día (la vista pública, sin datos de nadie) para poder excluirlos.
  const [ocupadosFecha, setOcupadosFecha] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fecha = interpretada.fecha;
    if (!fecha) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia al borrar la fecha de la búsqueda
      setOcupadosFecha(new Set());
      return;
    }
    let vigente = true;
    supabase
      .from("disponibilidad_rancho")
      .select("rancho_id")
      .eq("estado", "confirmada")
      .eq("fecha", fecha)
      .then(({ data }) => {
        if (vigente) setOcupadosFecha(new Set((data ?? []).map((d) => d.rancho_id as string)));
      });
    return () => {
      vigente = false;
    };
  }, [interpretada.fecha]);

  const q = interpretada.texto;
  const coincide = useCallback(
    (r: Fila) =>
      (!q ||
        normalizarTexto(`${r.nombre} ${r.provincia ?? ""} ${r.canton ?? ""}`).includes(q)) &&
      // Solo Lugares bloquean fechas — los demás servicios no.
      !(interpretada.fecha && r.categoria === "lugares" && ocupadosFecha.has(r.id)),
    [q, interpretada.fecha, ocupadosFecha],
  );

  // Los filtros del panel: zona exacta, capacidad e importe tope. Los
  // de invitados y precio solo excluyen cuando el dato existe — un
  // proveedor sin capacidad o sin "desde ₡" no desaparece por eso.
  const pasaFiltros = useCallback(
    (r: Fila) =>
      (!filtroProvincia || r.provincia === filtroProvincia) &&
      (!filtroCanton || r.canton === filtroCanton) &&
      (invitadosNum <= 0 || r.capacidad_max == null || r.capacidad_max >= invitadosNum) &&
      (precioMaxNum <= 0 || r.precio_desde == null || r.precio_desde <= precioMaxNum),
    [filtroProvincia, filtroCanton, invitadosNum, precioMaxNum],
  );

  const buscando = q.length > 0 || !!interpretada.fecha || filtro !== "todos" || hayFiltros;

  const listaFiltrada = useMemo(() => {
    if (!ranchos) return [];
    return ranchos
      .filter((r) => filtro === "todos" || r.categoria === filtro)
      .filter((r) => !subcategoria || r.subcategoria === subcategoria)
      .filter(coincide)
      .filter(pasaFiltros);
  }, [ranchos, filtro, subcategoria, coincide, pasaFiltros]);

  // Conteos para el panel de filtros: cuántos proveedores hay por
  // provincia, y por cantón dentro de la provincia elegida.
  const conteoProvincias = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of ranchos ?? []) {
      if (r.provincia) acc[r.provincia] = (acc[r.provincia] ?? 0) + 1;
    }
    return acc;
  }, [ranchos]);

  const conteoCantones = useMemo(() => {
    const acc: Record<string, number> = {};
    if (!filtroProvincia) return acc;
    for (const r of ranchos ?? []) {
      if (r.provincia === filtroProvincia && r.canton) {
        acc[r.canton] = (acc[r.canton] ?? 0) + 1;
      }
    }
    return acc;
  }, [ranchos, filtroProvincia]);

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

  const renderTarjeta = (item: Fila, ancho: "riel" | "completo") => {
    const subLabel = item.subcategoria
      ? SUBCATEGORIAS[item.categoria]?.find((s) => s.id === item.subcategoria)?.label
      : null;
    return (
      <TarjetaNegocio
        ancho={ancho}
        nombre={item.nombre}
        foto={item.foto_url}
        iconoVacio={CATEGORIA_ICONO[item.categoria]}
        etiqueta={subLabel ?? CATEGORIA_LABEL[item.categoria]}
        calificacion={calificaciones[item.id] ?? null}
        ubicacion={[item.canton, item.provincia].filter(Boolean).join(", ") || "Costa Rica"}
        precio={item.precio_desde !== null ? fmtColones(item.precio_desde) : null}
        cta={item.categoria === "lugares" ? "Reservar fecha" : "Reservar"}
        favorito={favoritos.has(item.id)}
        onToggleFavorito={() => alternarFavorito(item.id)}
        onPress={() => router.push(`/rancho/${item.id}`)}
      />
    );
  };

  return (
    <View style={styles.contenedor}>
      {/* Sin barra nativa en las pestañas: el buscador arranca justo
          debajo del notch. */}
      <View style={[styles.busquedaArea, { paddingTop: insets.top + Spacing.three }]}>
        {/* Cambio de vertical al toque, sin pasar por la portada. */}
        <ChipsVerticales activo="eventos" />

        <Buscador
          valor={query}
          onCambiar={setQuery}
          placeholder="Buscá por nombre, zona o fecha (ej. 3 de agosto)"
          filtros={{ activos: filtrosPuestos, onPress: () => setModalFiltros(true) }}
        />

        {interpretada.fecha && (
          <View style={styles.fechaDetectada}>
            <Ionicons name="calendar-outline" size={13} color={Colors.accent} />
            <Text style={styles.fechaDetectadaTexto}>
              Mostrando lo libre el {fmtFechaCortaISO(interpretada.fecha)}
            </Text>
          </View>
        )}

        {/* Los filtros activos como chips removibles: un toque en la ×
            quita ese filtro sin abrir el panel. */}
        {hayFiltros && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtrosActivosScroll}
            contentContainerStyle={styles.filtrosActivosFila}
            keyboardShouldPersistTaps="handled"
          >
            {filtroProvincia && (
              <ChipFiltro
                texto={filtroProvincia}
                onQuitar={() => {
                  setFiltroProvincia(null);
                  setFiltroCanton(null);
                }}
              />
            )}
            {filtroCanton && (
              <ChipFiltro texto={filtroCanton} onQuitar={() => setFiltroCanton(null)} />
            )}
            {invitadosNum > 0 && (
              <ChipFiltro
                texto={`${invitadosNum}+ invitados`}
                onQuitar={() => setFiltroInvitados("")}
              />
            )}
            {precioMaxNum > 0 && (
              <ChipFiltro
                texto={`Hasta ${fmtColones(precioMaxNum)}`}
                onQuitar={() => setFiltroPrecioMax("")}
              />
            )}
            <Pressable onPress={limpiarFiltros} style={styles.limpiarTodo} hitSlop={6}>
              <Text style={styles.limpiarTodoTexto}>Limpiar todo</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>

      {/* Barra de dos niveles, igual que la web: las categorías, y al
          entrar a una, la misma barra muta a sus subcategorías con un
          botón de volver. */}
      <View style={styles.categoriasArea}>
        {filtro === "todos" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriasFila}
          >
            <ChipCategoria
              icono="compass-outline"
              texto="Todos"
              activo
              onPress={() => elegirCategoria("todos")}
            />
            {CATEGORIAS.map((cat) => (
              <ChipCategoria
                key={cat}
                icono={CATEGORIA_ICONO[cat]}
                texto={CATEGORIA_LABEL[cat]}
                activo={false}
                onPress={() => elegirCategoria(cat)}
              />
            ))}
          </ScrollView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriasFila}
          >
            <Pressable style={styles.volverChip} onPress={() => elegirCategoria("todos")}>
              <Ionicons name="chevron-back" size={14} color={Colors.ink} />
              <Text style={styles.volverTexto}>Volver</Text>
            </Pressable>
            <ChipCategoria
              icono={CATEGORIA_ICONO[filtro]}
              texto={`Todo (${totalCategoria})`}
              activo={!subcategoria}
              onPress={() => setSubcategoria("")}
            />
            {SUBCATEGORIAS[filtro]
              .filter((s) => (conteoSubcategorias[s.id] ?? 0) > 0)
              .map((s) => (
                <ChipCategoria
                  key={s.id}
                  texto={`${s.label} (${conteoSubcategorias[s.id]})`}
                  activo={subcategoria === s.id}
                  onPress={() => setSubcategoria((prev) => (prev === s.id ? "" : s.id))}
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
          <Vacio
            icono="cloud-offline-outline"
            titulo="No pudimos cargar el directorio"
            texto={error}
            accion={{ texto: "Reintentar", onPress: () => cargar() }}
          />
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
            <Vacio
              titulo="No encontramos proveedores con esa búsqueda"
              texto="Probá con otra palabra, otra zona, o quitá los filtros."
              accion={{
                texto: "Limpiar la búsqueda",
                onPress: () => {
                  setQuery("");
                  elegirCategoria("todos");
                  limpiarFiltros();
                },
              }}
            />
          }
          renderItem={({ item }) => renderTarjeta(item, "completo")}
        />
      )}

      {ranchos !== null && !error && !buscando && (
        <ScrollView
          contentContainerStyle={styles.rieles}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={alRefrescar} />}
        >
          {rieles.length === 0 && (
            <Vacio
              icono="sparkles-outline"
              titulo="Todavía no hay proveedores publicados"
              texto="Estamos abriendo el directorio de eventos. Muy pronto vas a ver salones, catering, música y decoración acá."
            />
          )}
          {rieles.map((riel) => (
            <View key={riel.categoria} style={styles.riel}>
              <View style={styles.rielEncabezado}>
                <Encabezado
                  kicker={`${riel.items.length} ${riel.items.length === 1 ? "proveedor" : "proveedores"}`}
                  titulo={`${CATEGORIA_LABEL[riel.categoria]} para tu evento`}
                  accion={{ texto: "Ver todos", onPress: () => elegirCategoria(riel.categoria) }}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rielLista}
              >
                {riel.items.map((item) => (
                  <View key={item.id}>{renderTarjeta(item, "riel")}</View>
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}

      {/* El panel de filtros como hoja inferior: provincia, cantón,
          invitados y precio tope. Se cierra tocando el velo o con
          "Ver resultados". */}
      <Modal
        visible={modalFiltros}
        transparent
        animationType="slide"
        onRequestClose={() => setModalFiltros(false)}
      >
        <View style={styles.veloModal}>
          <Pressable style={{ flex: 1 }} onPress={() => setModalFiltros(false)} />
          <View style={[styles.panelFiltros, { paddingBottom: insets.bottom + Spacing.three }]}>
            <View style={styles.panelAgarre} />
            <View style={styles.panelEncabezado}>
              <View>
                <Micro>Afinar</Micro>
                <Text style={styles.panelTitulo}>Filtros</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar filtros"
                onPress={() => setModalFiltros(false)}
                style={styles.panelCerrar}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={Colors.ink} />
              </Pressable>
            </View>

            <ScrollView
              style={{ flexGrow: 0 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Micro style={styles.panelSeccion}>Provincia</Micro>
              <View style={styles.panelChips}>
                {PROVINCIAS.map((p) => (
                  <ChipCategoria
                    key={p}
                    texto={`${p} (${conteoProvincias[p] ?? 0})`}
                    activo={filtroProvincia === p}
                    onPress={() => {
                      setFiltroProvincia((prev) => (prev === p ? null : p));
                      setFiltroCanton(null);
                    }}
                  />
                ))}
              </View>

              {filtroProvincia && (
                <>
                  <Micro style={styles.panelSeccion}>Cantón</Micro>
                  <View style={styles.panelChips}>
                    {CANTONES[filtroProvincia].map((c) => (
                      <ChipCategoria
                        key={c}
                        texto={`${c} (${conteoCantones[c] ?? 0})`}
                        activo={filtroCanton === c}
                        onPress={() => setFiltroCanton((prev) => (prev === c ? null : c))}
                      />
                    ))}
                  </View>
                </>
              )}

              <Micro style={styles.panelSeccion}>Invitados</Micro>
              <TextInput
                value={filtroInvitados}
                onChangeText={setFiltroInvitados}
                placeholder="¿Cuántas personas van? Ej. 80"
                placeholderTextColor="#98a0b0"
                keyboardType="number-pad"
                style={styles.panelInput}
              />
              <Text style={styles.panelAyuda}>
                Se muestran los que aguantan esa cantidad (y los que no indican capacidad).
              </Text>

              <Micro style={styles.panelSeccion}>Precio máximo (₡)</Micro>
              <TextInput
                value={filtroPrecioMax}
                onChangeText={setFiltroPrecioMax}
                placeholder="Ej. 150000"
                placeholderTextColor="#98a0b0"
                keyboardType="number-pad"
                style={styles.panelInput}
              />
              <Text style={styles.panelAyuda}>
                Compara contra el “desde ₡” de cada proveedor (los sin precio no se excluyen).
              </Text>
            </ScrollView>

            <View style={styles.panelBotones}>
              <Boton compacto tono="contorno" texto="Limpiar" onPress={limpiarFiltros} />
              <Boton
                tono="navy"
                texto={`Ver resultados${ranchos ? ` (${listaFiltrada.length})` : ""}`}
                onPress={() => setModalFiltros(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  busquedaArea: {
    backgroundColor: Colors.canvas,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  fechaDetectada: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  fechaDetectadaTexto: {
    color: Colors.inkSoft,
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 11.5,
  },
  filtrosActivosScroll: { flexGrow: 0, marginTop: Spacing.two },
  filtrosActivosFila: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  limpiarTodo: { paddingHorizontal: 4, paddingVertical: 6 },
  limpiarTodoTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bold,
    fontSize: 12,
    textDecorationLine: "underline",
  },

  categoriasArea: {
    backgroundColor: Colors.canvas,
    borderBottomColor: Colors.line,
    borderBottomWidth: 1,
  },
  categoriasFila: {
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  volverChip: {
    alignItems: "center",
    backgroundColor: Colors.cream2,
    borderColor: Colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  volverTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5 },

  centro: { alignItems: "center", flex: 1, justifyContent: "center", padding: Spacing.three },
  listaVertical: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: TAB_BAR_ESPACIO,
  },
  rieles: { gap: Spacing.five, paddingBottom: TAB_BAR_ESPACIO, paddingTop: Spacing.four },
  riel: { gap: Spacing.three },
  rielEncabezado: { paddingHorizontal: Spacing.three },
  rielLista: { gap: Spacing.three, paddingHorizontal: Spacing.three },

  veloModal: { backgroundColor: "rgba(10,18,42,0.45)", flex: 1 },
  panelFiltros: {
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: Radios.xl,
    borderTopRightRadius: Radios.xl,
    maxHeight: "82%",
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  panelAgarre: {
    alignSelf: "center",
    backgroundColor: "#d6dae6",
    borderRadius: Radios.full,
    height: 4,
    marginBottom: Spacing.three,
    width: 44,
  },
  panelEncabezado: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.two,
  },
  panelTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 19,
    letterSpacing: -0.4,
    marginTop: 3,
  },
  panelCerrar: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.full,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  panelSeccion: { marginBottom: Spacing.two, marginTop: Spacing.three },
  panelChips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  panelInput: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  panelAyuda: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 6 },
  panelBotones: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
  },
});
