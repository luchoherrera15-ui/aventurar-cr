import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";

/**
 * El buscador de los cuatro directorios (Eventos, Servicios,
 * Restaurantes, Hospedajes): campo con lupa y, opcionalmente, el botón
 * de filtros con el contador de los que están puestos. Estaba escrito
 * cuatro veces con medidas ligeramente distintas; ahora es uno solo,
 * así las cuatro verticales se buscan igual.
 */
export default function Buscador({
  valor,
  onCambiar,
  placeholder,
  filtros,
}: {
  valor: string;
  onCambiar: (v: string) => void;
  placeholder: string;
  /** El botón de al lado; `activos` pinta el contador. */
  filtros?: { activos: number; onPress: () => void };
}) {
  return (
    <View style={styles.fila}>
      <View style={styles.campo}>
        <Ionicons name="search" size={17} color={Colors.blue} />
        <TextInput
          value={valor}
          onChangeText={onCambiar}
          placeholder={placeholder}
          placeholderTextColor="#98a0b0"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {valor.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Borrar la búsqueda"
            hitSlop={8}
            onPress={() => onCambiar("")}
          >
            <Ionicons name="close-circle" size={17} color="#b3b8c4" />
          </Pressable>
        )}
      </View>

      {filtros && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtros"
          onPress={filtros.onPress}
          style={({ pressed }) => [
            styles.boton,
            filtros.activos > 0 && styles.botonActivo,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Ionicons
            name="options-outline"
            size={19}
            color={filtros.activos > 0 ? "#ffffff" : Colors.navy}
          />
          {filtros.activos > 0 && (
            <View style={styles.contador}>
              <Text style={styles.contadorTexto}>{filtros.activos}</Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

/** Un filtro puesto, con su ✕ para soltarlo. */
export function ChipFiltro({ texto, onQuitar }: { texto: string; onQuitar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Quitar ${texto}`}
      onPress={onQuitar}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.chipTexto} numberOfLines={1}>
        {texto}
      </Text>
      <Ionicons name="close" size={13} color={Colors.navy} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  campo: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: Spacing.two,
    height: 48,
    paddingHorizontal: Spacing.three,
  },
  input: {
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    // Sin esto, Android mete padding propio y el texto queda
    // descentrado dentro de la caja de 48px.
    padding: 0,
  },
  boton: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 50,
  },
  botonActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  contador: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: Radios.full,
    height: 16,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    top: 4,
    width: 16,
  },
  contadorTexto: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 9.5 },
  chip: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.navy,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipTexto: { color: Colors.navy, flexShrink: 1, fontFamily: Fonts.bold, fontSize: 12.5 },
});
