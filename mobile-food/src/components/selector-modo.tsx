import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios } from "@/constants/theme";
import { useModoPedido, type ModoPedido } from "@/lib/modo-pedido";

const OPCIONES: { id: ModoPedido; label: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { id: "togo", label: "To Go", icono: "bag-handle-outline" },
  { id: "mesa", label: "Mesa", icono: "restaurant-outline" },
];

/**
 * Los dos botones centrados de arriba (pedido del dueño): "To Go"
 * (pedidos para llevar, sin comisión) y "Mesa" (la reserva con
 * descuento que ya existía). Cambia un modo global (useModoPedido) que
 * Inicio, Descubrir, la ficha del restaurante y "Mis reservas/pedidos"
 * leen — no navega a otra pantalla, solo cambia qué muestran las de
 * siempre.
 */
export default function SelectorModo() {
  const { modo, setModo } = useModoPedido();

  return (
    <View style={styles.contenedor}>
      <View style={styles.pastilla}>
        {OPCIONES.map((op) => {
          const activo = modo === op.id;
          return (
            <Pressable
              key={op.id}
              onPress={() => setModo(op.id)}
              style={[styles.opcion, activo && styles.opcionActiva]}
              hitSlop={4}
            >
              <Ionicons name={op.icono} size={15} color={activo ? "#fff" : Colors.inkSoft} />
              <Text style={[styles.texto, activo && styles.textoActivo]}>{op.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { alignItems: "center" },
  pastilla: {
    flexDirection: "row",
    backgroundColor: Colors.cream2,
    borderRadius: Radios.full,
    padding: 4,
    gap: 4,
  },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: Radios.full,
  },
  opcionActiva: { backgroundColor: Colors.navy },
  texto: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.inkSoft },
  textoActivo: { color: "#fff" },
});
