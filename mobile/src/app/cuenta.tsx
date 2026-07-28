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

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookeacr.com";
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

function FormulariosAuth() {
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoConfirmacion, setAvisoConfirmacion] = useState(false);

  async function enviar() {
    setError(null);
    const correoLimpio = email.trim().toLowerCase();

    if (!CORREO_REGEX.test(correoLimpio)) {
      setError("Ese correo no parece válido.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña necesita al menos 6 caracteres.");
      return;
    }
    if (modo === "registro" && password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    if (modo === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: correoLimpio,
        password,
      });
      setEnviando(false);
      if (error) setError("No pudimos iniciar sesión: " + error.message);
      return;
    }

    // Registro: siempre queda como 'cliente' — nunca como dueño de
    // negocio, incluso si después publica uno (eso lo decide el botón
    // "Publicar tu negocio" del perfil, no el registro).
    const { data, error } = await supabase.auth.signUp({
      email: correoLimpio,
      password,
      options: { data: { nombre: nombre.trim() || null, rol: "cliente" } },
    });
    setEnviando(false);

    if (error) {
      setError("No se pudo crear la cuenta: " + error.message);
      return;
    }
    if (!data.session) {
      setAvisoConfirmacion(true);
    }
  }

  if (avisoConfirmacion) {
    return (
      <View style={styles.centro}>
        <Text style={styles.tituloConfirmacion}>Revisá tu correo</Text>
        <Text style={styles.textoConfirmacion}>
          Te mandamos un enlace a {email.trim()} para confirmar tu cuenta. Una vez confirmada,
          volvé acá e iniciá sesión.
        </Text>
        <Pressable
          style={styles.botonSecundario}
          onPress={() => {
            setAvisoConfirmacion(false);
            setModo("login");
          }}
        >
          <Text style={styles.botonSecundarioTexto}>Ir a iniciar sesión</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <TituloPantalla titulo="Perfil" />
      <ScrollView contentContainerStyle={styles.contenedorForm}>
        <Text style={styles.titulo}>{modo === "login" ? "Iniciar sesión" : "Creá tu cuenta"}</Text>
        <Text style={styles.subtitulo}>
          {modo === "login"
            ? "Entrá para ver tus reservas, favoritos y mensajes."
            : "Registrarte es opcional — igual podés reservar sin cuenta."}
        </Text>

        <View style={styles.bloque}>
          {modo === "registro" && (
            <Campo label="Nombre" value={nombre} onChangeText={setNombre} />
          )}
          <Campo
            label="Correo"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Campo label="Contraseña" value={password} onChangeText={setPassword} secure />
          {modo === "registro" && (
            <Campo label="Confirmar contraseña" value={confirmar} onChangeText={setConfirmar} secure />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.botonPrimario} disabled={enviando} onPress={enviar}>
            {enviando ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.botonPrimarioTexto}>
                {modo === "login" ? "Entrar" : "Crear cuenta"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setError(null);
              setModo(modo === "login" ? "registro" : "login");
            }}
          >
            <Text style={styles.enlace}>
              {modo === "login"
                ? "¿No tenés cuenta? Registrate"
                : "¿Ya tenés cuenta? Iniciá sesión"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Campo(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboardType?: "default" | "email-address";
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
            detalle="bookeacr.com en el navegador"
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
            Publicá tu negocio en Bookear CR — lugares, catering, DJs, fotografía y más.
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
  botonSecundario: { paddingVertical: 10, paddingHorizontal: Spacing.four },
  botonSecundarioTexto: { color: Colors.accent, fontFamily: Fonts.bold },
  tituloConfirmacion: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.ink, textAlign: "center" },
  textoConfirmacion: { fontSize: 14, color: Colors.inkSoft, textAlign: "center" },
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
