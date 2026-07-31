import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import {
  entrarConProveedor,
  FACEBOOK_HABILITADO,
  GOOGLE_HABILITADO,
  HAY_LOGIN_SOCIAL,
  NOMBRE_PROVEEDOR,
  type ProveedorSocial,
} from "@/lib/auth-social";

/**
 * Los botones de "entrar con Google / Facebook" — el mismo bloque que
 * src/app/cuenta/formulario-auth.tsx de la web, con su separador "o".
 *
 * Cada proveedor vive detrás de su bandera (EXPO_PUBLIC_AUTH_GOOGLE,
 * EXPO_PUBLIC_AUTH_FACEBOOK): hasta que estén configurados en Supabase,
 * mostrarlos solo produciría un error al tocarlos. Si no hay ninguno
 * habilitado, el componente no dibuja nada y la pantalla queda igual
 * que antes.
 *
 * Los logos salen de Ionicons, que el app ya usa en todas partes. La
 * alternativa era react-native-svg para dibujar la G de Google en sus
 * cuatro colores oficiales, pero no vale una dependencia nueva por dos
 * íconos: cada color de marca va en su botón y se reconocen igual.
 */
export default function BotonesSociales() {
  const [pendiente, setPendiente] = useState<ProveedorSocial | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!HAY_LOGIN_SOCIAL) return null;

  async function entrar(proveedor: ProveedorSocial) {
    if (pendiente) return;
    setError(null);
    setPendiente(proveedor);
    const resultado = await entrarConProveedor(proveedor);
    setPendiente(null);

    // Cerrar la hoja del navegador es una decisión, no una falla: no
    // se muestra nada. Con la sesión creada, el AuthProvider redibuja
    // solo hacia el perfil.
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
  pendiente: ProveedorSocial | null;
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

/** Los colores de marca de cada proveedor, para su logo. */
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
