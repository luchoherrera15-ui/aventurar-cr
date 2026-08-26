import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { desregistrarPush } from "@/lib/push";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import BarraSuperior from "@/components/barra-superior";
import PieLegal from "@/components/pie-legal";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/**
 * AJUSTES — todo lo que antes vivía suelto al fondo de Perfil (cerrar
 * sesión, eliminar cuenta) más lo que faltaba: notificaciones y los
 * tres documentos legales, cada uno linkeado a su página real en
 * bookea.lat (no texto inventado acá adentro — la fuente de verdad
 * legal es una sola, la web).
 *
 * Ojo con lo que NO está: nada de "idioma" (la app es solo español,
 * CLAUDE.md) ni "cambiar contraseña" (el login es por código al
 * correo, no hay contraseña que cambiar) — un ajuste que no hace nada
 * es peor que no tenerlo.
 */
export default function AjustesScreen() {
  const router = useRouter();

  async function cerrarSesion() {
    // El token push se suelta ANTES del signOut: la política RLS solo
    // deja borrarlo mientras la sesión sigue viva.
    await desregistrarPush();
    // `scope: "local"` — cierra ESTA sesión y nada más.
    //
    // ⚠️ EL DEFAULT DE SUPABASE ES GLOBAL. `signOut()` a secas es
    // `signOut({ scope: "global" })` (auth-js, GoTrueClient), y eso REVOCA
    // los refresh tokens de TODOS los aparatos: quien cerraba sesión acá
    // quedaba también deslogueado del teléfono, sin ninguna pista de por
    // qué. Un botón que dice «cerrar sesión» cierra la de acá.
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/?tab=perfil" as never);
  }

  /**
   * Borrar la cuenta es irreversible, así que se confirma dos veces.
   * La función de la base borra el usuario y todo lo suyo en cascada;
   * las reservas que hizo quedan (anónimas) porque son parte de la
   * historia del negocio que las recibió.
   */
  function confirmarEliminarCuenta() {
    Alert.alert(
      "¿Eliminar tu cuenta?",
      "Se borran tu perfil, tus favoritos, tus reseñas, tus chats y tus negocios publicados. Esto no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, continuar",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Última confirmación",
              "¿Seguro que querés eliminar tu cuenta para siempre?",
              [
                { text: "No, conservarla", style: "cancel" },
                {
                  text: "Eliminar definitivamente",
                  style: "destructive",
                  onPress: async () => {
                    const { error } = await supabase.rpc("eliminar_mi_cuenta");
                    if (error) {
                      Alert.alert(
                        "No se pudo eliminar",
                        "Intentá de nuevo en un momento o escribinos a hola@bookea.lat.",
                      );
                      return;
                    }
                    // `scope: "local"` — cierra ESTA sesión y nada más.
                    //
                    // ⚠️ EL DEFAULT DE SUPABASE ES GLOBAL. `signOut()` a secas es
                    // `signOut({ scope: "global" })` (auth-js, GoTrueClient), y eso REVOCA
                    // los refresh tokens de TODOS los aparatos: quien cerraba sesión acá
                    // quedaba también deslogueado del teléfono, sin ninguna pista de por
                    // qué. Un botón que dice «cerrar sesión» cierra la de acá.
                    await supabase.auth.signOut({ scope: "local" });
                    router.replace("/?tab=perfil" as never);
                  },
                },
              ],
            ),
        },
      ],
    );
  }

  const version = Constants.expoConfig?.version ?? "—";

  return (
    <View style={styles.contenedor}>
      <BarraSuperior kicker="Tu cuenta" titulo="Ajustes" />
      <View style={styles.lista}>
        <Fila
          icono="notifications-outline"
          texto="Notificaciones"
          onPress={() => Linking.openSettings()}
        />
        <Fila
          icono="shield-checkmark-outline"
          texto="Política de privacidad"
          onPress={() => WebBrowser.openBrowserAsync(`${SITIO_URL}/privacidad`)}
        />
        <Fila
          icono="document-text-outline"
          texto="Condiciones del servicio"
          onPress={() => WebBrowser.openBrowserAsync(`${SITIO_URL}/terminos`)}
        />
        <Fila
          icono="information-circle-outline"
          texto="Políticas de la plataforma"
          detalle="Cancelaciones, pagos y reseñas"
          onPress={() => WebBrowser.openBrowserAsync(`${SITIO_URL}/politicas`)}
        />

        <View style={styles.separador} />

        <Fila icono="log-out-outline" texto="Cerrar sesión" onPress={cerrarSesion} />
        <Fila
          icono="trash-outline"
          texto="Eliminar cuenta"
          tono="peligro"
          onPress={confirmarEliminarCuenta}
          sinFlecha
        />
      </View>

      <Text style={styles.version}>Versión de la app: {version}</Text>
      <PieLegal />
    </View>
  );
}

function Fila({
  icono,
  texto,
  detalle,
  tono = "normal",
  sinFlecha = false,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
  detalle?: string;
  tono?: "normal" | "peligro";
  /** El de "eliminar cuenta" no lleva flecha: no navega a nada, actúa. */
  sinFlecha?: boolean;
  onPress: () => void;
}) {
  const color = tono === "peligro" ? Colors.danger : Colors.navy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.fila, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icono} size={19} color={color} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.filaTexto, tono === "peligro" && { color: Colors.danger }]}>
          {texto}
        </Text>
        {detalle ? <Text style={styles.filaDetalle}>{detalle}</Text> : null}
      </View>
      {!sinFlecha && <Ionicons name="chevron-forward" size={16} color={Colors.inkMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  lista: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    overflow: "hidden",
  },
  fila: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  filaTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  filaDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  separador: { backgroundColor: Colors.line, height: 1, marginVertical: 4 },
  version: {
    color: Colors.inkMuted,
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    marginTop: Spacing.four,
    textAlign: "center",
  },
});
