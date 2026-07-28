import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Spacing } from "@/constants/theme";

/**
 * Dejar (o corregir) la reseña de una reserva confirmada: estrellas y
 * un comentario opcional. Las políticas RLS de la tabla `resenas`
 * (migración 0033) garantizan que solo el cliente de una reserva
 * confirmada puede reseñar, así que acá no hay validación extra que
 * hacer del lado del servidor.
 */
export default function ResenaModal({
  visible,
  reservaId,
  ranchoId,
  nombreRancho,
  clienteId,
  resenaExistente,
  onCerrar,
  onGuardada,
}: {
  visible: boolean;
  reservaId: string;
  ranchoId: string;
  nombreRancho: string;
  clienteId: string;
  resenaExistente: { id: string; calificacion: number; comentario: string | null } | null;
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const [estrellas, setEstrellas] = useState(resenaExistente?.calificacion ?? 0);
  const [comentario, setComentario] = useState(resenaExistente?.comentario ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (estrellas < 1) {
      setError("Elegí cuántas estrellas le das.");
      return;
    }
    setGuardando(true);
    setError(null);

    const { error: dbError } = resenaExistente
      ? await supabase
          .from("resenas")
          .update({ calificacion: estrellas, comentario: comentario.trim() || null })
          .eq("id", resenaExistente.id)
      : await supabase.from("resenas").insert({
          rancho_id: ranchoId,
          cliente_id: clienteId,
          reserva_id: reservaId,
          calificacion: estrellas,
          comentario: comentario.trim() || null,
        });

    setGuardando(false);
    if (dbError) {
      setError("No se pudo guardar la reseña: " + dbError.message);
      return;
    }
    onGuardada();
    onCerrar();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={styles.fondo} onPress={onCerrar}>
        <Pressable style={styles.tarjeta} onPress={() => {}}>
          <Text style={styles.titulo}>
            {resenaExistente ? "Editá tu reseña" : "¿Cómo te fue?"}
          </Text>
          <Text style={styles.subtitulo}>{nombreRancho}</Text>

          <View style={styles.estrellas}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setEstrellas(n)} hitSlop={6}>
                <Ionicons
                  name={n <= estrellas ? "star" : "star-outline"}
                  size={34}
                  color={n <= estrellas ? Colors.accent : Colors.line}
                />
              </Pressable>
            ))}
          </View>

          <TextInput
            value={comentario}
            onChangeText={setComentario}
            placeholder="Contá cómo estuvo (opcional)"
            placeholderTextColor={Colors.inkSoft}
            style={styles.input}
            multiline
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.boton, guardando && { opacity: 0.6 }]}
            disabled={guardando}
            onPress={guardar}
          >
            {guardando ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.botonTexto}>
                {resenaExistente ? "Guardar cambios" : "Publicar reseña"}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={onCerrar}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: "rgba(16,22,34,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  tarjeta: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  titulo: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.ink, textAlign: "center" },
  subtitulo: { fontSize: 13.5, color: Colors.inkSoft, textAlign: "center", marginTop: -8 },
  estrellas: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 4 },
  input: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 14.5,
    color: Colors.ink,
    backgroundColor: Colors.cream,
    minHeight: 80,
    textAlignVertical: "top",
  },
  error: { color: Colors.danger, fontSize: 12.5, textAlign: "center" },
  boton: {
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  botonTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 14 },
  cancelar: { textAlign: "center", fontSize: 13, fontFamily: Fonts.bold, color: Colors.inkSoft },
});
