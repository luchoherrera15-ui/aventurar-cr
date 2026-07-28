import { useEffect, useState } from "react";
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
export default function CuentaScreen({ activa = true }: { activa?: boolean }) {
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

  return (
    <PerfilVista
      perfil={perfil}
      correo={session.user.email ?? null}
      clienteId={session.user.id}
      creadaEn={session.user.created_at ?? null}
      activa={activa}
    />
  );
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

/** Los números del perfil, estilo tarjeta de Airbnb. */
type StatsPerfil = {
  reservas: number;
  resenas: number;
  desde: number;
  negocios: number;
  vecesContratado: number;
  calificacion: number | null;
};

function PerfilVista({
  perfil,
  correo,
  clienteId,
  creadaEn,
  activa,
}: {
  perfil: Perfil | null;
  correo: string | null;
  clienteId: string;
  creadaEn: string | null;
  activa: boolean;
}) {
  const router = useRouter();
  const inicial = (perfil?.nombre || correo || "?").trim().charAt(0).toUpperCase();
  const [stats, setStats] = useState<StatsPerfil | null>(null);

  // Los números del perfil: cuántas reservas hizo como cliente,
  // cuántas reseñas dejó y — si es anfitrión — cuántas veces lo han
  // contratado y su calificación promedio ponderada.
  useEffect(() => {
    if (!activa) return;
    let vigente = true;
    (async () => {
      const [reservasRes, resenasRes, negociosRes] = await Promise.all([
        supabase
          .from("reservas")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId)
          .in("estado", ["pendiente", "confirmada"]),
        supabase
          .from("resenas")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId),
        supabase.from("ranchos").select("id").eq("owner_id", clienteId),
      ]);

      const negocioIds = (negociosRes.data ?? []).map((r) => r.id as string);
      let vecesContratado = 0;
      let calificacion: number | null = null;
      if (negocioIds.length > 0) {
        const [{ count: contratadoCount }, { data: califs }] = await Promise.all([
          supabase
            .from("reservas")
            .select("id", { count: "exact", head: true })
            .in("rancho_id", negocioIds)
            .eq("estado", "confirmada"),
          supabase
            .from("calificaciones_rancho")
            .select("promedio, total")
            .in("rancho_id", negocioIds),
        ]);
        vecesContratado = contratadoCount ?? 0;
        const filas = (califs ?? []) as { promedio: number; total: number }[];
        const totalResenas = filas.reduce((acc, c) => acc + c.total, 0);
        calificacion =
          totalResenas > 0
            ? filas.reduce((acc, c) => acc + c.promedio * c.total, 0) / totalResenas
            : null;
      }

      if (!vigente) return;
      setStats({
        reservas: reservasRes.count ?? 0,
        resenas: resenasRes.count ?? 0,
        desde: creadaEn ? new Date(creadaEn).getFullYear() : new Date().getFullYear(),
        negocios: negocioIds.length,
        vecesContratado,
        calificacion,
      });
    })();
    return () => {
      vigente = false;
    };
  }, [activa, clienteId, creadaEn]);

  const esAnfitrion = (stats?.negocios ?? 0) > 0;

  return (
    <View style={styles.contenedor}>
      <TituloPantalla titulo="Perfil" />
      <ScrollView contentContainerStyle={{ padding: Spacing.four, paddingBottom: 100, gap: Spacing.four }}>
        {/* Tarjeta de identidad estilo Airbnb: avatar grande a la
            izquierda y la columna de números a la derecha. */}
        <View style={styles.tarjetaIdentidad}>
          <View style={styles.ladoAvatar}>
            <View style={styles.avatarGrande}>
              <Text style={styles.avatarGrandeTexto}>{inicial}</Text>
            </View>
            <Text style={styles.nombreGrande} numberOfLines={1}>
              {perfil?.nombre || "Tu cuenta"}
            </Text>
            <Text style={styles.rolPerfil}>{esAnfitrion ? "Anfitrión" : "Cliente"}</Text>
          </View>
          <View style={styles.ladoStats}>
            <Stat valor={stats ? String(stats.reservas) : "—"} etiqueta={stats?.reservas === 1 ? "reserva" : "reservas"} />
            <View style={styles.statDivisor} />
            <Stat valor={stats ? String(stats.resenas) : "—"} etiqueta={stats?.resenas === 1 ? "reseña" : "reseñas"} />
            <View style={styles.statDivisor} />
            <Stat valor={stats ? String(stats.desde) : "—"} etiqueta="en Bookea desde" invertida />
          </View>
        </View>

        {esAnfitrion && stats && (
          <View style={styles.tarjetaAnfitrion}>
            <Text style={styles.anfitrionTitulo}>Tu negocio en números</Text>
            <View style={styles.anfitrionFila}>
              <Stat valor={String(stats.negocios)} etiqueta={stats.negocios === 1 ? "publicación" : "publicaciones"} clara />
              <Stat valor={String(stats.vecesContratado)} etiqueta={stats.vecesContratado === 1 ? "vez contratado" : "veces contratado"} clara />
              <Stat
                valor={stats.calificacion !== null ? `★ ${stats.calificacion.toFixed(1)}` : "—"}
                etiqueta="calificación"
                clara
              />
            </View>
          </View>
        )}

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

/** Un número del perfil con su etiqueta, como los de Airbnb. */
function Stat({
  valor,
  etiqueta,
  invertida,
  clara,
}: {
  valor: string;
  etiqueta: string;
  /** true = etiqueta arriba y número abajo (para "en Bookea desde"). */
  invertida?: boolean;
  /** true = para tarjetas con fondo claro. */
  clara?: boolean;
}) {
  const colorValor = clara ? Colors.ink : "#ffffff";
  const colorEtiqueta = clara ? Colors.inkSoft : "#ffffffb0";
  return (
    <View style={{ alignItems: clara ? "center" : "flex-start", flex: clara ? 1 : undefined }}>
      {invertida && (
        <Text style={[stylesStat.etiqueta, { color: colorEtiqueta }]}>{etiqueta}</Text>
      )}
      <Text style={[stylesStat.valor, { color: colorValor }]}>{valor}</Text>
      {!invertida && (
        <Text style={[stylesStat.etiqueta, { color: colorEtiqueta }]}>{etiqueta}</Text>
      )}
    </View>
  );
}

const stylesStat = StyleSheet.create({
  valor: { fontSize: 19, fontFamily: Fonts.extraBold, letterSpacing: -0.3 },
  etiqueta: { fontSize: 10.5, fontFamily: Fonts.semiBold },
});

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
  tarjetaIdentidad: {
    flexDirection: "row",
    backgroundColor: Colors.navy,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.four,
    shadowColor: "#101a2c",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ladoAvatar: { flex: 1.2, alignItems: "center", gap: 4 },
  avatarGrande: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarGrandeTexto: { color: "#ffffff", fontSize: 32, fontFamily: Fonts.extraBold },
  nombreGrande: { color: "#ffffff", fontSize: 17, fontFamily: Fonts.extraBold, textAlign: "center" },
  rolPerfil: { color: "#ffffffb0", fontSize: 12, fontFamily: Fonts.semiBold },
  ladoStats: { flex: 1, justifyContent: "center", gap: 10 },
  statDivisor: { height: 1, backgroundColor: "#ffffff2e" },
  tarjetaAnfitrion: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  anfitrionTitulo: { fontSize: 14.5, fontFamily: Fonts.extraBold, color: Colors.ink },
  anfitrionFila: { flexDirection: "row", gap: Spacing.two },
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
