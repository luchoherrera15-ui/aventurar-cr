import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
  isAvailableAsync as appleDisponibleAsync,
} from "expo-apple-authentication";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import {
  APPLE_HABILITADO,
  entrarConApple,
  entrarConProveedor,
  FACEBOOK_HABILITADO,
  GOOGLE_HABILITADO,
  HAY_LOGIN_SOCIAL,
  NOMBRE_PROVEEDOR,
  type ProveedorSocial,
} from "@/lib/auth-social";

type Proveedor = ProveedorSocial | "apple";

/**
 * Los botones de "entrar con Google / Facebook / Apple" — espejo de
 * mobile/src/components/botones-sociales.tsx (Bookea normal), en este
 * proyecto aparte. Cada uno detrás de su bandera: hasta que esté
 * configurado en Supabase, mostrarlo solo produciría un error al
 * tocarlo.
 */
export default function BotonesSociales() {
  const [pendiente, setPendiente] = useState<Proveedor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleDisponible, setAppleDisponible] = useState(false);

  useEffect(() => {
    if (!APPLE_HABILITADO) return;
    appleDisponibleAsync().then(setAppleDisponible);
  }, []);

  if (!HAY_LOGIN_SOCIAL) return null;

  async function entrar(proveedor: ProveedorSocial) {
    if (pendiente) return;
    setError(null);
    setPendiente(proveedor);
    const resultado = await entrarConProveedor(proveedor);
    setPendiente(null);
    if (!resultado.ok && !resultado.cancelado) setError(resultado.error);
  }

  async function entrarApple() {
    if (pendiente) return;
    setError(null);
    setPendiente("apple");
    const resultado = await entrarConApple();
    setPendiente(null);
    if (!resultado.ok && !resultado.cancelado) setError(resultado.error);
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.separador}>
        <View style={styles.linea} />
        <Text style={styles.separadorTexto}>o</Text>
        <View style={styles.linea} />
      </View>

      {GOOGLE_HABILITADO && (
        <Boton proveedor="google" pendiente={pendiente} onPress={() => entrar("google")} />
      )}
      {FACEBOOK_HABILITADO && (
        <Boton proveedor="facebook" pendiente={pendiente} onPress={() => entrar("facebook")} />
      )}
      {APPLE_HABILITADO && appleDisponible && (
        pendiente === "apple" ? (
          <View style={[styles.boton, styles.botonApagado]}>
            <ActivityIndicator color={Colors.navy} size="small" />
          </View>
        ) : (
          // Apple prohíbe fijar backgroundColor/borderRadius por `style`
          // en su propio botón: el color sale de `buttonStyle`, el
          // radio de `cornerRadius`.
          <AppleAuthenticationButton
            buttonType={AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthenticationButtonStyle.WHITE_OUTLINE}
            cornerRadius={Radios.md}
            style={[styles.botonApple, pendiente !== null && styles.botonApagado]}
            onPress={entrarApple}
          />
        )
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function Boton({
  proveedor,
  pendiente,
  onPress,
}: {
  proveedor: ProveedorSocial;
  pendiente: Proveedor | null;
  onPress: () => void;
}) {
  const esteEsperando = pendiente === proveedor;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Entrar con ${NOMBRE_PROVEEDOR[proveedor]}`}
      disabled={pendiente !== null}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        pendiente !== null && !esteEsperando && styles.botonApagado,
        pressed && { opacity: 0.9 },
      ]}
    >
      {esteEsperando ? (
        <ActivityIndicator color={Colors.navy} size="small" />
      ) : (
        <>
          <Logo proveedor={proveedor} />
          <Text style={styles.botonTexto}>Continuar con {NOMBRE_PROVEEDOR[proveedor]}</Text>
        </>
      )}
    </Pressable>
  );
}

const TINTA_PROVEEDOR: Record<ProveedorSocial, string> = {
  google: "#4285F4",
  facebook: "#1877F2",
};

function Logo({ proveedor }: { proveedor: ProveedorSocial }) {
  return (
    <Ionicons
      name={proveedor === "google" ? "logo-google" : "logo-facebook"}
      size={18}
      color={TINTA_PROVEEDOR[proveedor]}
    />
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: Spacing.two, marginTop: Spacing.three },
  separador: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  linea: { backgroundColor: Colors.line, flex: 1, height: 1 },
  separadorTexto: {
    color: Colors.inkMuted,
    fontFamily: Fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  boton: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: 13,
  },
  botonApple: { height: 48, width: "100%" },
  botonApagado: { opacity: 0.5 },
  botonTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  error: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    color: Colors.danger,
    fontFamily: Fonts.semiBold,
    fontSize: 12.5,
    padding: Spacing.two,
  },
});
