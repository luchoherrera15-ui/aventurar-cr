import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Spacing } from "@/constants/theme";

/**
 * Cancelar la propia reserva, con motivo obligatorio -pedido explícito
 * del dueño. Mismo patrón que `resena-modal.tsx`: la política RLS
 * "El cliente cancela su propia reserva" (0185, mismo estilo que ya
 * usa `resenas` para "el cliente edita lo suyo") es la que de verdad
 * autoriza esto -acá no hay validación de dueño que hacer, la base ya
 * la hace.
 *
 * Sin restricción de horario a propósito: se puede cancelar el mismo
 * día. La plata no se toca -un adelanto ya validado queda retenido por
 * política, mismo criterio que el cancelarReserva del negocio (web).
 */
export default function CancelarReservaModal({
  visible,
  reservaId,
  clienteId,
  nombreRancho,
  onCerrar,
  onCancelada,
}: {
  visible: boolean;
  reservaId: string;
  clienteId: string;
  nombreRancho: string;
  onCerrar: () => void;
  onCancelada: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    const motivoLimpio = motivo.trim();
    if (motivoLimpio.length < 3) {
      setError("Contanos por qué cancelás.");
      return;
    }
    setEnviando(true);
    setError(null);

    const { error: dbError, data } = await supabase
      .from("reservas")
      .update({
        estado: "cancelada",
        cancelada_en: new Date().toISOString(),
        motivo_cancelacion: motivoLimpio.slice(0, 500),
      })
      .eq("id", reservaId)
      .eq("cliente_id", clienteId)
      .in("estado", ["pendiente", "confirmada"])
      .select("id");

    setEnviando(false);
    if (dbError) {
      setError("No se pudo cancelar: " + dbError.message);
      return;
    }
    // La RLS deja pasar un UPDATE con 0 filas si el filtro no matchea
    // (no tira error) -pasa si ya se había cancelado en otro lado.
    if (!data || data.length === 0) {
      setError("Esa reserva ya no se puede cancelar.");
      return;
    }
    setMotivo("");
    onCancelada();
    onCerrar();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={styles.fondo} onPress={onCerrar}>
        <Pressable style={styles.tarjeta} onPress={() => {}}>
          <Text style={styles.titulo}>Cancelar reserva</Text>
          <Text style={styles.subtitulo}>{nombreRancho}</Text>
          <Text style={styles.aviso}>
            Si dejaste un adelanto, no se devuelve solo por cancelar — el negocio lo revisa a
            mano.
          </Text>

          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            placeholder="¿Por qué cancelás? (obligatorio)"
            placeholderTextColor={Colors.inkSoft}
            style={styles.input}
            maxLength={500}
            multiline
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.boton, enviando && { opacity: 0.6 }]}
            disabled={enviando}
            onPress={confirmar}
          >
            {enviando ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.botonTexto}>Confirmar cancelación</Text>
            )}
          </Pressable>
          <Pressable onPress={onCerrar}>
            <Text style={styles.cerrar}>Ya no</Text>
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
  aviso: {
    fontSize: 12,
    color: Colors.inkSoft,
    textAlign: "center",
    lineHeight: 17,
  },
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
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  botonTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 14 },
  cerrar: { textAlign: "center", fontSize: 13, fontFamily: Fonts.bold, color: Colors.inkSoft },
});
