import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Sombras, Tipo } from "@/constants/theme";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { FoodCustomerProfile } from "@/lib/food-tipos";
import BotonesSociales from "@/components/botones-sociales";

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITIO_URL = "https://bookea.lat";
/** Opciones fijas — sin backend de catálogo para esto, es una lista corta. */
const GENERO_OPCIONES = ["Mujer", "Hombre", "Otro", "Prefiero no decir"] as const;

/**
 * Perfil — entrada sin contraseña (mismo mecanismo que Bookea normal:
 * signInWithOtp + verifyOtp, la cuenta nace `rol: cliente` si es
 * nueva), simplificada a propósito para v1: sin pedir nombre/teléfono
 * del cliente nuevo ni el caso especial de cuentas demo — eso vive en
 * la app principal, acá no hace falta.
 */
export default function Perfil({ activa }: { activa: boolean }) {
  const { session, perfil, cargando } = useAuth();
  const insets = useSafeAreaInsets();

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return <FormularioAuth activa={activa} />;
  }

  return <PerfilVista correo={session.user.email ?? null} nombre={perfil?.nombre ?? null} insetsTop={insets.top} />;
}

function FormularioAuth({ activa: _activa }: { activa: boolean }) {
  const insets = useSafeAreaInsets();
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
    const { error: err } = await supabase.auth.signInWithOtp({
      email: correoLimpio,
      options: { shouldCreateUser: true, data: { rol: "cliente" } },
    });
    setEnviando(false);
    if (err) {
      setError(
        err.status === 429
          ? "Ya te mandamos un código hace poco — esperá un minuto y probá de nuevo."
          : "No se pudo enviar el código: " + err.message,
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
    const { error: err } = await supabase.auth.verifyOtp({
      email: correoLimpio,
      token: codigoLimpio,
      type: "email",
    });
    setEnviando(false);
    if (err) {
      setError("Ese código no sirve o ya venció. Revisá que sea el del último correo, o pedí uno nuevo.");
    }
  }

  return (
    <View style={styles.contenedor}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, paddingTop: insets.top + Spacing.four, paddingBottom: TAB_BAR_ESPACIO, gap: Spacing.three }}>
        <Text style={Tipo.display}>FOOD.BOOKEA</Text>

        {paso === "correo" ? (
          <>
            <Text style={[Tipo.titulo2, { marginTop: Spacing.two }]}>Entrá con tu correo</Text>
            <Text style={styles.subtitulo}>
              Si ya tenés cuenta entrás directo; si es tu primera vez, te la creamos con un código de 6 dígitos — sin contraseñas.
            </Text>

            <View style={styles.bloque}>
              <Text style={styles.label}>Correo</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="tu@correo.com"
                placeholderTextColor={Colors.inkMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                style={styles.input}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable style={styles.botonPrimario} disabled={enviando} onPress={() => enviarCodigo()}>
                {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonPrimarioTexto}>Enviarme el código</Text>}
              </Pressable>

              {/* Google, Facebook y Apple. Si ninguno está configurado
                  en Supabase, esto no dibuja nada. */}
              <BotonesSociales />
            </View>
          </>
        ) : (
          <>
            <Text style={[Tipo.titulo2, { marginTop: Spacing.two }]}>Revisá tu correo</Text>
            <Text style={styles.subtitulo}>
              Te mandamos un código de 6 dígitos a {correoLimpio}. Puede tardar un momento — revisá spam si no aparece.
            </Text>

            <View style={styles.bloque}>
              <Text style={styles.label}>Código de 6 dígitos</Text>
              <TextInput
                value={codigo}
                onChangeText={setCodigo}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                style={styles.input}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              {reenviado && !error && <Text style={styles.aviso}>✓ Código reenviado — revisá tu correo.</Text>}
              <Pressable style={styles.botonPrimario} disabled={enviando} onPress={verificarCodigo}>
                {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonPrimarioTexto}>Entrar</Text>}
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

function PerfilVista({ correo, nombre, insetsTop }: { correo: string | null; nombre: string | null; insetsTop: number }) {
  const router = useRouter();
  const { refrescarPerfil, session } = useAuth();
  const inicial = (nombre || correo || "?").trim().charAt(0).toUpperCase();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(nombre ?? "");
  const [guardando, setGuardando] = useState(false);

  // Datos de food_customer_profiles (0204) — dirección y género del
  // cliente, aparte de `perfiles`. Se cargan una vez acá arriba (no
  // dentro del modal) para poder mostrar el badge "Incompleto" sin
  // tener que abrir nada.
  const [direccion, setDireccion] = useState<string | null>(null);
  const [genero, setGenero] = useState<string | null>(null);
  const [datosCargados, setDatosCargados] = useState(false);
  const [misDatosAbierto, setMisDatosAbierto] = useState(false);

  useEffect(() => {
    if (!session) return;
    let vigente = true;
    supabase
      .from("food_customer_profiles")
      .select("direccion, genero")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!vigente) return;
        const fila = data as Pick<FoodCustomerProfile, "direccion" | "genero"> | null;
        setDireccion(fila?.direccion ?? null);
        setGenero(fila?.genero ?? null);
        setDatosCargados(true);
      });
    return () => {
      vigente = false;
    };
  }, [session]);

  if (!session) return null;

  const datosIncompletos = datosCargados && (!direccion?.trim() || !genero?.trim());

  async function guardarNombre() {
    setGuardando(true);
    const { error } = await supabase.rpc("actualizar_mi_nombre", { p_nombre: borrador });
    setGuardando(false);
    if (error) {
      Alert.alert("No se pudo guardar", error.message);
      return;
    }
    setEditando(false);
    refrescarPerfil();
  }

  function cerrarSesion() {
    Alert.alert("Cerrar sesión", "¿Salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: Colors.canvas }}
        contentContainerStyle={{ padding: Spacing.four, paddingTop: insetsTop + Spacing.three, paddingBottom: TAB_BAR_ESPACIO, gap: Spacing.three }}
      >
        <View style={styles.encabezado}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexto}>{inicial}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {editando ? (
              <View style={styles.editorFila}>
                <TextInput value={borrador} onChangeText={setBorrador} style={styles.inputNombre} autoFocus maxLength={60} />
                <Pressable style={styles.botonGuardar} disabled={guardando} onPress={guardarNombre}>
                  {guardando ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={17} color="#fff" />}
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.filaNombre}
                onPress={() => {
                  setBorrador(nombre ?? "");
                  setEditando(true);
                }}
              >
                <Text style={styles.nombre} numberOfLines={1}>{nombre || "Poné tu nombre"}</Text>
                <Ionicons name="pencil" size={14} color={Colors.inkSoft} />
              </Pressable>
            )}
            <Text style={styles.correo} numberOfLines={1}>{correo}</Text>
            {datosIncompletos && (
              <Pressable style={styles.badgeIncompleto} onPress={() => setMisDatosAbierto(true)}>
                <Ionicons name="alert-circle" size={12} color={Colors.accentDark} />
                <Text style={styles.badgeIncompletoTexto}>Incompleto</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.grupo}>
          <FilaMenu icono="calendar-outline" texto="Mis reservas" onPress={() => router.push("/?tab=reservas")} />
          <FilaMenu icono="heart-outline" texto="Favoritos" onPress={() => router.push("/?tab=favoritos")} />
          <FilaMenu icono="person-circle-outline" texto="Mis datos" onPress={() => setMisDatosAbierto(true)} />
          <FilaMenu
            icono="pricetag-outline"
            texto="Cupones"
            onPress={() => Alert.alert("Cupones — Muy pronto", "Estamos armando esta sección. Volvé pronto.")}
          />
          <FilaMenu
            icono="trophy-outline"
            texto="Misiones"
            onPress={() =>
              Alert.alert(
                "Misiones — Muy pronto",
                "Vas a poder desbloquear logros a medida que usás la app. Estamos armando esta sección.",
              )
            }
          />
          <FilaMenu icono="help-buoy-outline" texto="Ayuda" onPress={() => WebBrowser.openBrowserAsync(`${SITIO_URL}/ayuda`)} ultima />
        </View>

        <Pressable style={styles.botonSalir} onPress={cerrarSesion}>
          <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>

      {misDatosAbierto && (
        <ModalMisDatos
          userId={session.user.id}
          direccionInicial={direccion}
          generoInicial={genero}
          onCerrar={() => setMisDatosAbierto(false)}
          onGuardado={(nuevaDireccion, nuevoGenero) => {
            setDireccion(nuevaDireccion);
            setGenero(nuevoGenero);
            setMisDatosAbierto(false);
          }}
        />
      )}
    </>
  );
}

/**
 * Se monta SOLO mientras está abierto (ver el `misDatosAbierto &&` que
 * la envuelve) — mismo patrón que ResenaModal/CancelarReservaModal en
 * mobile/: así el estado arranca del valor real cada vez que se abre,
 * sin un efecto que lo tenga que resincronizar.
 */
function ModalMisDatos({
  userId,
  direccionInicial,
  generoInicial,
  onCerrar,
  onGuardado,
}: {
  userId: string;
  direccionInicial: string | null;
  generoInicial: string | null;
  onCerrar: () => void;
  onGuardado: (direccion: string | null, genero: string | null) => void;
}) {
  const [direccion, setDireccion] = useState(direccionInicial ?? "");
  const [genero, setGenero] = useState<string | null>(generoInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const direccionLimpia = direccion.trim() || null;
    const { error: err } = await supabase
      .from("food_customer_profiles")
      .upsert({ id: userId, direccion: direccionLimpia, genero });
    setGuardando(false);
    if (err) {
      setError("No se pudo guardar: " + err.message);
      return;
    }
    onGuardado(direccionLimpia, genero);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={styles.fondoModal} onPress={onCerrar}>
        <Pressable style={styles.tarjetaModal} onPress={() => {}}>
          <Text style={Tipo.titulo2}>Mis datos</Text>
          <Text style={styles.subtitulo}>Para reservas y promos más a tu medida.</Text>

          <View style={{ gap: Spacing.two }}>
            <Text style={styles.label}>Dirección</Text>
            <TextInput
              value={direccion}
              onChangeText={setDireccion}
              placeholder="Barrio, calle, alguna referencia..."
              placeholderTextColor={Colors.inkMuted}
              style={[styles.input, styles.inputMultilinea]}
              multiline
              maxLength={200}
            />
          </View>

          <View style={{ gap: Spacing.two }}>
            <Text style={styles.label}>Género</Text>
            <View style={styles.chipsFila}>
              {GENERO_OPCIONES.map((opcion) => (
                <Pressable
                  key={opcion}
                  style={[styles.chip, genero === opcion && styles.chipActivo]}
                  onPress={() => setGenero(opcion)}
                >
                  <Text style={[styles.chipTexto, genero === opcion && styles.chipTextoActivo]}>{opcion}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.botonPrimario} disabled={guardando} onPress={guardar}>
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonPrimarioTexto}>Guardar</Text>}
          </Pressable>
          <Pressable disabled={guardando} onPress={onCerrar}>
            <Text style={styles.enlaceSecundario}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilaMenu({
  icono,
  texto,
  onPress,
  ultima,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
  onPress: () => void;
  ultima?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.filaMenu, !ultima && styles.filaMenuSeparador, pressed && { backgroundColor: Colors.cream2 }]}
      onPress={onPress}
    >
      <Ionicons name={icono} size={20} color={Colors.ink} />
      <Text style={styles.filaMenuTexto}>{texto}</Text>
      <Ionicons name="chevron-forward" size={17} color={Colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.canvas },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  subtitulo: { ...Tipo.cuerpo },
  bloque: { backgroundColor: Colors.surface, borderRadius: Radios.xl, padding: Spacing.four, gap: Spacing.two, ...Sombras.tarjeta },
  label: { color: Colors.inkMuted, fontFamily: Fonts.extraBold, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase" },
  input: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.ink,
    backgroundColor: Colors.canvas,
    fontFamily: Fonts.medium,
  },
  error: { color: Colors.danger, fontSize: 13, fontFamily: Fonts.medium },
  aviso: { color: Colors.green, fontFamily: Fonts.bold, fontSize: 12.5 },
  botonPrimario: { backgroundColor: Colors.navy, borderRadius: Radios.lg, paddingVertical: 14, alignItems: "center", marginTop: Spacing.two },
  botonPrimarioTexto: { color: "#fff", fontFamily: Fonts.bold, fontSize: 15 },
  enlace: { color: Colors.accent, fontFamily: Fonts.bold, fontSize: 13, textAlign: "center", marginTop: Spacing.two },
  enlaceSecundario: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 13, textAlign: "center", marginTop: Spacing.one },
  encabezado: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.navy, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: Colors.accentLight },
  avatarTexto: { color: "#fff", fontFamily: Fonts.extraBold, fontSize: 22 },
  filaNombre: { flexDirection: "row", alignItems: "center", gap: 6 },
  nombre: { fontFamily: Fonts.extraBold, fontSize: 21, letterSpacing: -0.5, color: Colors.ink },
  correo: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.inkSoft, marginTop: 2 },
  editorFila: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  inputNombre: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radios.md, paddingHorizontal: Spacing.three, paddingVertical: 8, fontSize: 16, fontFamily: Fonts.bold, color: Colors.ink, backgroundColor: Colors.canvas },
  botonGuardar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.navy, alignItems: "center", justifyContent: "center" },
  grupo: { backgroundColor: Colors.surface, borderRadius: Radios.xl, overflow: "hidden", ...Sombras.tarjeta },
  filaMenu: { flexDirection: "row", alignItems: "center", gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 15 },
  filaMenuSeparador: { borderBottomColor: Colors.line, borderBottomWidth: 1 },
  filaMenuTexto: { flex: 1, color: Colors.ink, fontFamily: Fonts.semiBold, fontSize: 15 },
  botonSalir: { alignItems: "center", paddingVertical: 12 },
  botonSalirTexto: { color: Colors.danger, fontFamily: Fonts.bold, fontSize: 14 },
  badgeIncompleto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: Colors.accentLight,
    borderRadius: Radios.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
  },
  badgeIncompletoTexto: { fontFamily: Fonts.extraBold, fontSize: 11, color: Colors.accentDark },
  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(16,22,34,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  tarjetaModal: { width: "100%", maxWidth: 420, backgroundColor: Colors.surface, borderRadius: Radios.xl, padding: Spacing.four, gap: Spacing.three },
  inputMultilinea: { minHeight: 64, textAlignVertical: "top" },
  chipsFila: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.canvas,
    borderRadius: Radios.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActivo: { borderColor: "transparent", backgroundColor: Colors.navy },
  chipTexto: { fontFamily: Fonts.bold, fontSize: 12.5, color: Colors.ink },
  chipTextoActivo: { color: "#fff" },
});
