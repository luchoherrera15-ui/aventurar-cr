import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { abrirHiloConsulta } from "@/lib/consulta";
import { normalizarTexto } from "@/lib/busqueda";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { Avatar, Micro, Vacio } from "@/components/ui";
import { CATEGORIA_LABEL, SUBCATEGORIA_LABEL } from "@/lib/types";
import { CATEGORIA_CITA_LABEL } from "@/lib/citas";
import { CATEGORIA_HOSPEDAJE_LABEL } from "@/lib/hospedajes";
import { CATEGORIA_RESTAURANTE_LABEL } from "@/lib/restaurantes";

/**
 * La pestaña "Explorar" de Mensajes: buscar un negocio por nombre o
 * por lo que hace ("DJ", "uñas", "catering") y abrir el chat de
 * consulta de una — espejo de la misma pestaña en el chat de la web.
 *
 * La búsqueda es la misma de la web: el nombre va con ilike a la base
 * y el término también se compara contra los labels de categoría y
 * subcategoría (normalizados, sin tildes) para traducirlo a ids —
 * así "dj" encuentra a los de subcategoría dj_discomovil aunque no se
 * llamen así. Los labels salen de las listas que la app ya mantiene
 * EN PARIDAD con la web: @/lib/types (eventos), citas, hospedajes y
 * restaurantes.
 */

type NegocioRow = {
  id: string;
  nombre: string;
  categoria: string | null;
  subcategoria: string | null;
  vertical: string | null;
  provincia: string | null;
  canton: string | null;
  foto_url: string | null;
  owner_id: string | null;
  destacado_orden: number | null;
  detalles: Record<string, unknown> | null;
};

const SELECCION =
  "id, nombre, categoria, subcategoria, vertical, provincia, canton, foto_url, owner_id, destacado_orden, detalles";

/** El rubro legible según la vertical del negocio. */
function rubroDe(n: NegocioRow): string {
  const cat = n.categoria ?? "";
  switch (n.vertical ?? "eventos") {
    case "citas":
      return (CATEGORIA_CITA_LABEL as Record<string, string>)[cat] ?? "Servicios";
    case "hospedajes":
      return (CATEGORIA_HOSPEDAJE_LABEL as Record<string, string>)[cat] ?? "Hospedajes";
    case "restaurantes":
      return (CATEGORIA_RESTAURANTE_LABEL as Record<string, string>)[cat] ?? "Restaurantes";
    default:
      return (
        SUBCATEGORIA_LABEL[n.subcategoria ?? ""] ??
        (CATEGORIA_LABEL as Record<string, string>)[cat] ??
        "Eventos"
      );
  }
}

/**
 * Qué ids de categoría/subcategoría "significa" el término: se compara
 * contra los labels de las cuatro verticales sin tildes ni mayúsculas.
 */
function categoriasQueMatchean(termNorm: string): {
  categorias: string[];
  subcategorias: string[];
} {
  const categorias = new Set<string>();
  const subcategorias = new Set<string>();
  const labelsDeCategoria: Record<string, string>[] = [
    CATEGORIA_LABEL,
    CATEGORIA_CITA_LABEL,
    CATEGORIA_HOSPEDAJE_LABEL,
    CATEGORIA_RESTAURANTE_LABEL,
  ];
  for (const labels of labelsDeCategoria) {
    for (const [id, label] of Object.entries(labels)) {
      if (normalizarTexto(label).includes(termNorm)) categorias.add(id);
    }
  }
  for (const [id, label] of Object.entries(SUBCATEGORIA_LABEL)) {
    if (normalizarTexto(label).includes(termNorm)) subcategorias.add(id);
  }
  return { categorias: [...categorias], subcategorias: [...subcategorias] };
}

export default function ExplorarChat({ miId }: { miId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<NegocioRow[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  // Para descartar respuestas viejas si se siguió escribiendo.
  const pedidoRef = useRef(0);

  const hayTermino = normalizarTexto(query).trim().length > 0;

  const buscar = useCallback(
    async (termino: string) => {
      const pedido = ++pedidoRef.current;
      const termNorm = normalizarTexto(termino).trim();
      setBuscando(true);

      let data: NegocioRow[] = [];
      if (termNorm.length === 0) {
        // Sin término: sugerencias — los destacados del admin primero y
        // después lo más nuevo, igual que la portada.
        const { data: sugeridos } = await supabase
          .from("ranchos")
          .select(SELECCION)
          .eq("estado", "aprobado")
          .order("destacado_orden", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(20);
        data = (sugeridos ?? []) as NegocioRow[];
      } else {
        const { categorias, subcategorias } = categoriasQueMatchean(termNorm);
        // Los caracteres con significado en el filtro `or` de PostgREST
        // se neutralizan para que un término raro no rompa la consulta.
        const seguro = termino.replace(/[%_,()]/g, " ").trim();
        const partes: string[] = [];
        if (seguro.length > 0) partes.push(`nombre.ilike.%${seguro}%`);
        if (categorias.length > 0) partes.push(`categoria.in.(${categorias.join(",")})`);
        if (subcategorias.length > 0)
          partes.push(`subcategoria.in.(${subcategorias.join(",")})`);
        if (partes.length === 0) {
          data = [];
        } else {
          const { data: encontrados } = await supabase
            .from("ranchos")
            .select(SELECCION)
            .eq("estado", "aprobado")
            .or(partes.join(","))
            .limit(30);
          data = (encontrados ?? []) as NegocioRow[];
        }
      }

      if (pedido !== pedidoRef.current) return;
      setResultados(
        data
          // Un negocio pausado ("en configuración") no recibe consultas,
          // y escribirse a uno mismo no tiene sentido.
          .filter((n) => n.detalles?.en_configuracion !== true && n.owner_id !== miId)
          .sort((a, b) => (a.destacado_orden ?? Infinity) - (b.destacado_orden ?? Infinity))
          .slice(0, termNorm.length === 0 ? 8 : 12),
      );
      setBuscando(false);
    },
    [miId],
  );

  // Debounce: se busca cuando la persona deja de escribir un momento.
  useEffect(() => {
    const timer = setTimeout(() => {
      void buscar(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, buscar]);

  const abrirChat = useCallback(
    async (negocio: NegocioRow) => {
      if (abriendo) return;
      setAbriendo(negocio.id);
      const convId = await abrirHiloConsulta(negocio.id, miId);
      setAbriendo(null);
      if (convId) {
        router.push(`/mensajes/hilo/${convId}` as never);
      } else {
        Alert.alert(
          "No se pudo abrir el chat",
          "Probá de nuevo en un momento.",
        );
      }
    },
    [abriendo, miId, router],
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.buscadorFila}>
        <View style={styles.buscador}>
          <Ionicons name="search-outline" size={17} color={Colors.inkSoft} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder='Buscá un negocio o servicio (ej. "DJ")'
            placeholderTextColor={Colors.inkSoft}
            style={styles.buscadorInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={Colors.inkSoft} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.three, paddingTop: 0, paddingBottom: TAB_BAR_ESPACIO }}
        data={resultados ?? []}
        keyExtractor={(n) => n.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          resultados !== null && resultados.length > 0 ? (
            <Micro style={{ marginBottom: Spacing.two }}>
              {hayTermino ? "Resultados" : "Sugerencias para vos"}
            </Micro>
          ) : null
        }
        ListEmptyComponent={
          resultados === null || buscando ? (
            <View style={styles.centro}>
              <ActivityIndicator color={Colors.sky} />
            </View>
          ) : (
            <Vacio
              icono="search-outline"
              titulo={hayTermino ? "No encontramos negocios" : "Nada que sugerir todavía"}
              texto={
                hayTermino
                  ? 'Probá con otra palabra: el nombre del negocio o lo que hace (ej. "DJ", "uñas", "catering").'
                  : "Cuando haya negocios publicados van a aparecer acá."
              }
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.fila, pressed && { opacity: 0.85 }]}
            onPress={() => void abrirChat(item)}
            disabled={abriendo !== null}
          >
            {item.foto_url ? (
              <Image source={{ uri: item.foto_url }} alt="" style={styles.foto} />
            ) : (
              <Avatar nombre={item.nombre} tamano={44} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.nombre} numberOfLines={1}>
                {item.nombre}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[rubroDe(item), item.canton ?? item.provincia]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            {abriendo === item.id ? (
              <ActivityIndicator color={Colors.sky} />
            ) : (
              <Ionicons name="chatbubble-ellipses-outline" size={19} color={Colors.sky} />
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  buscadorFila: {
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  buscador: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: 12,
  },
  buscadorInput: {
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    paddingVertical: 10,
  },
  centro: { alignItems: "center", paddingVertical: Spacing.five },
  fila: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two + 2,
    marginBottom: Spacing.two,
    padding: Spacing.two + 2,
  },
  foto: { borderRadius: 22, height: 44, width: 44 },
  nombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  meta: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, marginTop: 1 },
});
