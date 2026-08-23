import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Sombras, Tipo } from "@/constants/theme";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { useAuth } from "@/lib/auth-context";
import { cargarFavoritosIds, cargarTarjetasFood, type TarjetaFood } from "@/lib/food-datos";
import { hoyISOCR, normalizarBusquedaFood } from "@/lib/food-tipos";
import TarjetaRestaurante from "@/components/tarjeta-restaurante";

type ChipFecha = "hoy" | "manana" | "semana" | null;

function fechaISO(offsetDias: number): string {
  const [y, m, d] = hoyISOCR().split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() + offsetDias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * DESCUBRIR — la pantalla de búsqueda/filtro dedicada (2ª pestaña),
 * espejo de /food/descubrir en /web: mismos chips (con descuento,
 * hoy, mañana, esta semana), mismo orden, mismo dato real.
 */
export default function Descubrir({ activa }: { activa: boolean }) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [tarjetas, setTarjetas] = useState<TarjetaFood[] | null>(null);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [texto, setTexto] = useState("");
  const [soloDescuento, setSoloDescuento] = useState(false);
  const [chipFecha, setChipFecha] = useState<ChipFecha>(null);

  useEffect(() => {
    if (!activa || tarjetas !== null) return;
    Promise.all([
      cargarTarjetasFood(),
      session ? cargarFavoritosIds(session.user.id) : Promise.resolve(new Set<string>()),
    ]).then(([t, f]) => {
      setTarjetas(t);
      setFavoritos(f);
    });
  }, [activa, tarjetas, session]);

  const hoy = hoyISOCR();
  const manana = useMemo(() => fechaISO(1), []);
  const semana = useMemo(() => Array.from({ length: 7 }, (_, i) => fechaISO(i)), []);

  const filtrados = useMemo(() => {
    let lista = tarjetas ?? [];
    if (texto) {
      const aguja = normalizarBusquedaFood(texto);
      lista = lista.filter((n) =>
        normalizarBusquedaFood([n.nombre, n.descripcion ?? "", ...n.platos].join(" ")).includes(aguja),
      );
    }
    if (soloDescuento) lista = lista.filter((n) => n.descuentoPorcentaje > 0);
    if (chipFecha === "hoy") lista = lista.filter((n) => n.fechasConOferta.includes(hoy));
    else if (chipFecha === "manana") lista = lista.filter((n) => n.fechasConOferta.includes(manana));
    else if (chipFecha === "semana")
      lista = lista.filter((n) => n.fechasConOferta.some((f) => semana.includes(f)));
    return [...lista].sort((a, b) => b.descuentoPorcentaje - a.descuentoPorcentaje);
  }, [tarjetas, texto, soloDescuento, chipFecha, hoy, manana, semana]);

  return (
    <View style={[styles.contenedor, { paddingTop: insets.top + Spacing.three }]}>
      <FlatList
        data={filtrados}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: TAB_BAR_ESPACIO, paddingHorizontal: Spacing.four }}
        ListHeaderComponent={
          <View style={{ marginBottom: Spacing.three }}>
            <Text style={Tipo.titulo1}>Descubrir</Text>
            <View style={styles.buscador}>
              <Ionicons name="search" size={16} color={Colors.inkMuted} />
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="Restaurante, comida o zona"
                placeholderTextColor={Colors.inkMuted}
                style={styles.buscadorInput}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.filaChips}>
              <Chip label="Con descuento" activo={soloDescuento} onPress={() => setSoloDescuento((v) => !v)} />
              <Chip label="Hoy" activo={chipFecha === "hoy"} onPress={() => setChipFecha((c) => (c === "hoy" ? null : "hoy"))} />
              <Chip label="Mañana" activo={chipFecha === "manana"} onPress={() => setChipFecha((c) => (c === "manana" ? null : "manana"))} />
              <Chip label="Esta semana" activo={chipFecha === "semana"} onPress={() => setChipFecha((c) => (c === "semana" ? null : "semana"))} />
            </View>
            {tarjetas !== null && (
              <Text style={[Tipo.meta, { marginTop: Spacing.two }]}>
                {filtrados.length} {filtrados.length === 1 ? "restaurante" : "restaurantes"}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TarjetaRestaurante
            tarjeta={item}
            favorito={session ? favoritos.has(item.id) : undefined}
            logueado={!!session}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        ListEmptyComponent={
          tarjetas === null ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.five }} />
          ) : (
            <View style={styles.vacio}>
              <Text style={styles.vacioTexto}>No encontramos restaurantes con esos filtros.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

function Chip({ label, activo, onPress }: { label: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, activo && styles.chipActivo]}>
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.canvas },
  buscador: {
    marginTop: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Colors.surface,
    borderRadius: Radios.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    ...Sombras.tarjeta,
  },
  buscadorInput: { flex: 1, fontFamily: Fonts.medium, fontSize: 14, color: Colors.ink },
  filaChips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, marginTop: Spacing.three },
  chip: {
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    borderRadius: Radios.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActivo: { borderColor: "transparent", backgroundColor: Colors.navy },
  chipTexto: { fontFamily: Fonts.bold, fontSize: 12.5, color: Colors.ink },
  chipTextoActivo: { color: "#fff" },
  vacio: { alignItems: "center", paddingVertical: Spacing.six },
  vacioTexto: { ...Tipo.cuerpo, textAlign: "center" },
});
