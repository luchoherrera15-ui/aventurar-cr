import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";

/**
 * La card de venta cruzada post-reserva — gemela de
 * src/components/oferta-invitacion-card.tsx en la web: quien acaba de
 * reservar un salón recibe la oferta de la invitación digital base.
 */
export default function OfertaInvitacion() {
  const router = useRouter();
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Oferta por tu reserva</Text>
      <Text style={styles.titulo}>¡Creá tu invitación digital!</Text>
      <Text style={styles.precioLinea}>
        Por tan solo <Text style={styles.precio}>{fmtColones(12500)}</Text>
      </Text>
      <Text style={styles.texto}>
        Un link precioso para tus invitados: confirman ahí mismo y vos ves la
        lista en tiempo real.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/invitaciones" as never)}
        style={({ pressed }) => [styles.boton, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.botonTexto}>Crear mi invitación</Text>
      </Pressable>
      <Text style={styles.letraChica}>
        * Aplica a la versión base de nuestras invitaciones digitales. Precio
        especial por haber reservado tu espacio en Bookea.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.navy,
    borderRadius: 20,
    marginTop: Spacing.four,
    padding: Spacing.four,
    width: "100%",
  },
  kicker: {
    color: "#f5b98a",
    fontFamily: Fonts.extraBold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  titulo: {
    color: "#ffffff",
    fontFamily: Fonts.extraBold,
    fontSize: 19,
    marginTop: 8,
  },
  precioLinea: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: Fonts.medium,
    fontSize: 14,
    marginTop: 4,
  },
  precio: { color: "#f5b98a", fontFamily: Fonts.extraBold, fontSize: 17 },
  texto: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 8,
  },
  boton: {
    alignItems: "center",
    backgroundColor: Colors.accent,
    borderRadius: 12,
    marginTop: 14,
    paddingVertical: 11,
  },
  botonTexto: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 13.5 },
  letraChica: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: Fonts.medium,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 10,
  },
});
