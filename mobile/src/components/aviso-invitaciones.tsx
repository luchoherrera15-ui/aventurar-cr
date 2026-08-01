import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";

/**
 * La gemela del avisito de invitaciones de la web (ver
 * src/components/aviso-invitaciones-flotante.tsx): quien está viendo
 * dónde hacer su evento es quien va a necesitar mandar invitaciones.
 *
 * DIFERENCIA CLAVE CON LA WEB, a propósito: acá el botón lleva ADENTRO
 * de la app, a la vitrina de diseños, y no al sitio. Las invitaciones
 * son contenido digital y empujar desde la app hacia una compra por
 * fuera es justo lo que la guía 3.1.1 de Apple no permite — por eso el
 * app ya dejó de vender (crear, pedido y pago viven solo en bookea.lat).
 * Este aviso respeta esa línea: sin precios y sin botón de compra, solo
 * navegación a contenido que ya está en la app.
 *
 * La reserva manda igual que en la web: sale recién a los segundos, se
 * va mientras el calendario está abierto, se para ARRIBA de la barra de
 * reservar sin taparla, y quien lo cierra no lo ve por una semana.
 */

const CLAVE = "bookea_aviso_invitaciones";
const DIAS_SILENCIO = 7;
const DEMORA_MS = 5000;
/** Alto de la barra fija de reservar (16 + contenido + 24) más aire. */
const ALTO_BARRA = 92;

export default function AvisoInvitaciones({
  conBarraReserva = false,
  oculto = false,
}: {
  /** Los Lugares tienen barra fija abajo: hay que subirse por encima. */
  conBarraReserva?: boolean;
  /** El calendario abierto lo esconde: la reserva siempre gana. */
  oculto?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  // El valor animado se crea UNA vez y no se toca en el render: leer un
  // ref mientras se pinta rompe la regla de hooks (react-hooks/refs).
  const [entrada] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let vivo = true;
    let tempo: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      let cerradoEn = 0;
      try {
        cerradoEn = Number(await AsyncStorage.getItem(CLAVE)) || 0;
      } catch {
        // Sin storage el aviso simplemente sale: no es motivo para fallar.
      }
      if (!vivo || Date.now() - cerradoEn < DIAS_SILENCIO * 86_400_000) return;

      tempo = setTimeout(async () => {
        if (!vivo) return;
        setVisible(true);
        // Con "reducir movimiento" activo aparece sin deslizarse.
        const quieto = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
        Animated.timing(entrada, {
          toValue: 1,
          duration: quieto ? 0 : 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }, DEMORA_MS);
    })();

    return () => {
      vivo = false;
      if (tempo) clearTimeout(tempo);
    };
  }, [entrada]);

  const cerrar = useCallback(() => {
    Animated.timing(entrada, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setVisible(false));
    AsyncStorage.setItem(CLAVE, String(Date.now())).catch(() => {
      // Volverá a salir en otra pantalla: tampoco es grave.
    });
  }, [entrada]);

  if (!visible || oculto) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.contenedor,
        {
          bottom: conBarraReserva ? ALTO_BARRA : insets.bottom + Spacing.three,
          opacity: entrada,
          transform: [
            { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.tarjeta}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar el aviso"
          hitSlop={10}
          onPress={cerrar}
          style={styles.cerrar}
        >
          <Ionicons name="close" size={15} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <View style={styles.kicker}>
          <Ionicons name="mail-outline" size={11} color="#f5b98a" />
          <Text style={styles.kickerTexto}>INVITACIONES DIGITALES</Text>
        </View>

        <Text style={styles.titulo}>¡Creá tu invitación digital con Bookea!</Text>
        <Text style={styles.bajada}>
          Un link precioso para tus invitados: confirman ahí mismo y vos llevás la lista al día.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver los diseños de invitaciones"
          onPress={() => {
            cerrar();
            // El cast es el patrón de la casa con typedRoutes activo.
            router.push("/invitaciones" as never);
          }}
          style={({ pressed }) => [styles.boton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.botonTexto}>Ver los diseños</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bajada: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: Spacing.one + 1,
  },
  boton: {
    alignSelf: "flex-start",
    backgroundColor: Colors.accent,
    borderRadius: Radios.md,
    marginTop: Spacing.two + 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 1,
  },
  botonTexto: {
    color: Colors.surface,
    fontFamily: Fonts.bold,
    fontSize: 13,
  },
  cerrar: {
    padding: Spacing.one,
    position: "absolute",
    right: Spacing.two,
    top: Spacing.two,
    zIndex: 1,
  },
  contenedor: {
    left: 14,
    position: "absolute",
    right: 14,
  },
  kicker: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.one + 1,
  },
  kickerTexto: {
    color: "#f5b98a",
    fontFamily: Fonts.extraBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  tarjeta: {
    backgroundColor: Colors.navy,
    borderRadius: Radios.lg,
    elevation: 8,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingRight: Spacing.four + Spacing.one,
    paddingTop: Spacing.three,
    shadowColor: "#101a2c",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  titulo: {
    color: Colors.surface,
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 19,
    marginTop: Spacing.two,
  },
});
