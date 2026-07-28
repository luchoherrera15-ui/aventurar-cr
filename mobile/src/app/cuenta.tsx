import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth, type Perfil } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import TituloPantalla from "@/components/titulo-pantalla";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pestaña Perfil, al estilo Airbnb: la tarjeta de la persona arriba y
 * una lista de accesos debajo. Las reservas, favoritos y mensajes ya
 * no viven acá — cada uno tiene su propia pestaña en la barra.
 */
export default function CuentaScreen() {
  const { session, perfil, cargando } = useAuth();

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return <FormulariosAuth />;
  }

  return <PerfilVista perfil={perfil} correo={session.user.email ?? null} />;
}

/**
 * Entrada sin contraseña: se pide el correo, Supabase manda un código
 * de 6 dígitos (signInWithOtp) y con verifyOtp queda la sesión. Si el
 * correo no tiene cuenta, se crea sola como 'cliente' — login y
 * registro son el mismo flujo, no hay contraseña que olvidar.
 */
function FormulariosAuth() {
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);

  const correoLimpio = email.trim().toLowerCase();

  async function enviarCodigo(esReenvio = false) {
    setError(null);
    if (!CORREO_REGEX.test(correoLimpio)) {
      setError("Ese correo no parece válido.");
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: correoLimpio,
      options: {
        // Si el correo es nuevo, la cuenta nace como cliente — nunca
        // como dueño de negocio (eso lo decide "Publicar tu negocio").
        shouldCreateUser: true,
        data: { rol: "cliente" },
      },
    });
    setEnviando(false);

    if (error) {
      setError(
        error.status === 429
          ? "Ya te mandamos un código hace poco — esperá un minuto y probá de nuevo."
          : "No se pudo enviar el código: " + error.message,
      );
      return;
    }
    setCodigo("");
    setPaso("codigo");
    if (esReenvio) setReenviado(true);
  }

  async function verificarCodigo() {
    setError(null);
    const codigoLimpio = codigo.trim();
    if (codigoLimpio.length < 6) {
      setError("El código tiene 6 dígitos.");
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.verifyOtp({
      email: correoLimpio,
      token: codigoLimpio,
      type: "email",
    });
    setEnviando(false);

    if (error) {
      setError(
        "Ese código no sirve o ya venció. Revisá que sea el del último correo, o pedí uno nuevo.",
      );
    }
    // Con la sesión creada, el AuthProvider redibuja solo hacia el perfil.
  }

  return (
    <View style={styles.contenedor}>
      <TituloPantalla titulo="Perfil" />
      <ScrollView contentContainerStyle={styles.contenedorForm}>
        {paso === "correo" ? (
          <>
            <Text style={styles.titulo}>Entrá con tu correo</Text>
            <Text style={styles.subtitulo}>
              Sin contraseñas: te mandamos un código de 6 dígitos al correo y
              con eso entrás. Si no tenés cuenta, se crea sola.
            </Text>

            <View style={styles.bloque}>
              <Campo
                label="Correo"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={styles.botonPrimario}
                disabled={enviando}
                onPress={() => enviarCodigo()}
              >
                {enviando ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.botonPrimarioTexto}>Enviarme el código</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.titulo}>Revisá tu correo</Text>
            <Text style={styles.subtitulo}>
              Te mandamos un código de 6 dígitos a {correoLimpio}. Escribilo acá
              — puede tardar un momento en llegar (revisá spam si no aparece).
            </Text>

            <View style={styles.bloque}>
              <Campo
                label="Código de 6 dígitos"
                value={codigo}
                onChangeText={setCodigo}
                keyboardType="numeric"
                autoCapitalize="none"
              />

              {error && <Text style={styles.error}>{error}</Text>}
              {reenviado && !error && (
                <Text style={styles.avisoReenvio}>✓ Código reenviado — revisá tu correo.</Text>
              )}

              <Pressable
                style={styles.botonPrimario}
                disabled={enviando}
                onPress={verificarCodigo}
              >
                {enviando ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.botonPrimarioTexto}>Entrar</Text>
                )}
              </Pressable>

              <Pressable disabled={enviando} onPress={() => enviarCodigo(true)}>
                <Text style={styles.enlace}>Reenviarme el código</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setError(null);
                  setReenviado(false);
                  setPaso("correo");
                }}
              >
                <Text style={styles.enlaceSecundario}>← Usar otro correo</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Campo(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboardType?: "default" | "email-address" | "numeric";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.gap2}>
      <Text style={styles.campoLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secure}
        keyboardType={props.keyboardType ?? "default"}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        style={styles.input}
        placeholderTextColor={Colors.inkSoft}
      />
    </View>
  );
}

function PerfilVista({ perfil, correo }: { perfil: Perfil | null; correo: string | null }) {
  const router = useRouter();
  const inicial = (perfil?.nombre || correo || "?").trim().charAt(0).toUpperCase();

  return (
    <View style={styles.contenedor}>
      <TituloPantalla titulo="Perfil" />
      <ScrollView contentContainerStyle={{ padding: Spacing.four, paddingBottom: 100, gap: Spacing.four }}>
        <View style={styles.tarjetaPerfil}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexto}>{inicial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombrePerfil}>{perfil?.nombre || "Tu cuenta"}</Text>
            <Text style={styles.correoPerfil}>{correo}</Text>
          </View>
        </View>

        <View style={styles.listaEnlaces}>
          <FilaEnlace
            icono="storefront-outline"
            titulo="Mi negocio"
            detalle="Publicá y administrá tus servicios y reservas"
            onPress={() => router.push("/negocio" as never)}
          />
          <FilaEnlace
            icono="calendar-outline"
            titulo="Mis reservas"
            detalle="Estado de tus fechas y tu historial"
            onPress={() => router.replace("/reservas")}
          />
          <FilaEnlace
            icono="heart-outline"
            titulo="Mis favoritos"
            detalle="Los proveedores que guardaste"
            onPress={() => router.replace("/favoritos")}
          />
          <FilaEnlace
            icono="chatbubble-outline"
            titulo="Mensajes"
            detalle="Tus conversaciones con proveedores"
            onPress={() => router.replace("/mensajes")}
          />
          <FilaEnlace
            icono="globe-outline"
            titulo="Abrir el sitio web"
            detalle="bookea.lat en el navegador"
            onPress={() => WebBrowser.openBrowserAsync(SITIO_URL)}
            ultima
          />
        </View>

        <Pressable
          style={styles.tarjetaPublicar}
          onPress={() => WebBrowser.openBrowserAsync(`${SITIO_URL}/publicar`)}
        >
          <Text style={styles.publicarTitulo}>¿Ofrecés un servicio para eventos?</Text>
          <Text style={styles.publicarTexto}>
            Publicá tu negocio en Bookea — lugares, catering, DJs, fotografía y más.
            La administración de tu negocio se hace desde el sitio web.
          </Text>
          <Text style={styles.publicarBoton}>Publicar tu negocio →</Text>
        </Pressable>

        <Pressable style={styles.botonSalir} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function FilaEnlace({
  icono,
  titulo,
  detalle,
  onPress,
  ultima,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalle: string;
  onPress: () => void;
  ultima?: boolean;
}) {
  return (
    <Pressable style={[styles.filaEnlace, !ultima && styles.filaEnlaceBorde]} onPress={onPress}>
      <Ionicons name={icono} size={22} color={Colors.navy} />
      <View style={{ flex: 1 }}>
        <Text style={styles.enlaceTitulo}>{titulo}</Text>
        <Text style={styles.enlaceDetalle}>{detalle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five, gap: Spacing.three },
  contenedorForm: { flexGrow: 1, padding: Spacing.four, paddingBottom: 100, gap: Spacing.two },
  titulo: { fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.ink },
  subtitulo: { fontSize: 13.5, color: Colors.inkSoft, marginBottom: Spacing.two },
  bloque: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.line,
    gap: Spacing.three,
  },
  gap2: { gap: 6 },
  campoLabel: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.inkSoft, textTransform: "uppercase" },
  input: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.ink,
    backgroundColor: Colors.cream,
  },
  error: { color: Colors.danger, fontSize: 13 },
  botonPrimario: {
    backgroundColor: Colors.navy,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.two,
  },
  botonPrimarioTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },
  enlace: { color: Colors.accent, fontFamily: Fonts.bold, fontSize: 13, textAlign: "center", marginTop: Spacing.two },
  enlaceSecundario: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 13, textAlign: "center", marginTop: Spacing.one },
  avisoReenvio: { color: Colors.green, fontFamily: Fonts.bold, fontSize: 12.5 },
  tarjetaPerfil: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: Colors.navy,
    borderRadius: 16,
    padding: Spacing.four,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: "#ffffff", fontSize: 20, fontFamily: Fonts.extraBold },
  nombrePerfil: { color: "#ffffff", fontSize: 16, fontFamily: Fonts.extraBold },
  correoPerfil: { color: "#ffffffb0", fontSize: 12.5 },
  listaEnlaces: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: Spacing.three,
  },
  filaEnlace: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  filaEnlaceBorde: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  enlaceTitulo: { fontSize: 14.5, fontFamily: Fonts.bold, color: Colors.ink },
  enlaceDetalle: { fontSize: 12, color: Colors.inkSoft, marginTop: 1 },
  tarjetaPublicar: {
    backgroundColor: Colors.accentLight,
    borderRadius: 16,
    padding: Spacing.four,
    gap: 4,
  },
  publicarTitulo: { fontSize: 15.5, fontFamily: Fonts.extraBold, color: Colors.ink },
  publicarTexto: { fontSize: 13, color: Colors.inkSoft, lineHeight: 18 },
  publicarBoton: { fontSize: 13.5, fontFamily: Fonts.extraBold, color: Colors.accent, marginTop: 6 },
  botonSalir: { alignItems: "center", paddingVertical: Spacing.three },
  botonSalirTexto: { color: Colors.danger, fontFamily: Fonts.bold, fontSize: 13.5 },
});
