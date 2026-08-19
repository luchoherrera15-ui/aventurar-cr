import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { useAuth, type Perfil } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import TituloPantalla from "@/components/titulo-pantalla";
import PieLegal from "@/components/pie-legal";
import BotonesSociales from "@/components/botones-sociales";
import logoBookea from "../../assets/images/logo-bookea-v3.png";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Las cuentas de prueba (*.demo@bookea.lat) no tienen buzón real:
// entran con el código fijo 123456, igual que en la web.
const DEMO_REGEX = /\.demo@bookea\.lat$/i;
const CODIGO_DEMO = "123456";

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
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);
  // null = todavía no se comprobó ese correo; true/false = ya se sabe
  // si tiene cuenta. Si es nuevo, se pide el nombre antes de mandar el
  // código; si ya existe, el mismo click manda el código directo.
  const [correoEsNuevo, setCorreoEsNuevo] = useState<boolean | null>(null);

  const correoLimpio = email.trim().toLowerCase();
  const esCuentaDemo = DEMO_REGEX.test(correoLimpio);
  const pideNombre = correoEsNuevo === true;

  async function enviarCodigo(esReenvio = false) {
    setError(null);
    if (!CORREO_REGEX.test(correoLimpio)) {
      setError("Ese correo no parece válido.");
      return;
    }

    // Cuenta demo: no hay buzón que reciba nada y pedir el OTP igual
    // castiga el rate-limit — se salta el envío y se va directo a la
    // pantalla del código (el fijo de prueba).
    if (esCuentaDemo) {
      setCodigo("");
      setPaso("codigo");
      return;
    }

    if (correoEsNuevo === null && !esReenvio) {
      setComprobando(true);
      const { data, error: rpcError } = await supabase.rpc("existe_cuenta", {
        p_email: correoLimpio,
      });
      setComprobando(false);
      if (rpcError) {
        setError("No se pudo comprobar el correo: " + rpcError.message);
        return;
      }
      setCorreoEsNuevo(!data);
      if (!data) return; // Correo nuevo: se detiene acá a pedir el nombre.
    }

    if (pideNombre && !nombre.trim()) {
      setError("Contanos tu nombre para crear la cuenta.");
      return;
    }
    // El teléfono se pide junto al nombre: con eso las reservas y las
    // citas se llenan solas después.
    if (pideNombre && !/^[0-9+\s-]{8,16}$/.test(telefono.trim())) {
      setError("Dejanos un teléfono válido (solo números).");
      return;
    }

    setEnviando(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: correoLimpio,
      options: {
        // Si el correo es nuevo, la cuenta nace como cliente — nunca
        // como dueño de negocio (eso lo decide "Publicar tu negocio").
        shouldCreateUser: true,
        data: pideNombre
          ? { rol: "cliente", nombre: nombre.trim(), whatsapp: telefono.trim() }
          : { rol: "cliente" },
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

  // El camino rápido en Android (el correo no se autocompleta como en
  // iOS): copiás el código de la notificación y un toque lo pega —
  // se extraen los 6 dígitos aunque venga con texto alrededor.
  async function pegarCodigo() {
    try {
      const texto = await Clipboard.getStringAsync();
      const encontrado = texto.match(/\d{6}/);
      if (encontrado) setCodigo(encontrado[0]);
    } catch {
      // Sin permiso de portapapeles no pasa nada: se escribe a mano.
    }
  }

  async function verificarCodigo() {
    setError(null);
    const codigoLimpio = codigo.trim();
    if (codigoLimpio.length < 6) {
      setError("El código tiene 6 dígitos.");
      return;
    }
    // Cuenta demo: con el código de test entra por contraseña en vez
    // del OTP. Esa contraseña es SOLO de las cuentas *.demo@bookea.lat
    // (datos de mentira sembrados por scripts/seed-demo-*.mjs, donde
    // ya es pública dentro del repo) — no abre ninguna cuenta real.
    if (esCuentaDemo) {
      if (codigoLimpio !== CODIGO_DEMO) {
        setError("Ese código no sirve. Para las cuentas demo es 123456.");
        return;
      }
      setEnviando(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: correoLimpio,
        password: "BookeaDemo2026!",
      });
      setEnviando(false);
      if (error) {
        setError("No se pudo entrar a la cuenta demo: " + error.message);
      }
      // Con la sesión creada, el AuthProvider redibuja solo.
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
        {/* La marca solo aparece acá, en la puerta de entrada: dentro
            de la app el logo estorbaría en cada pestaña. */}
        <Image
          source={logoBookea}
          alt="Bookea"
          style={styles.logoMarca}
          resizeMode="contain"
        />
        {paso === "correo" ? (
          <>
            <Text style={styles.titulo}>Entrá con tu correo</Text>
            <Text style={styles.subtitulo}>
              Escribí tu correo: si ya tenés cuenta entrás directo, y si es tu
              primera vez te la creamos ahí mismo con un código de 6 dígitos
              — sin contraseñas que recordar.
            </Text>

            <View style={styles.bloque}>
              <Campo
                label="Correo"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (correoEsNuevo !== null) setCorreoEsNuevo(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />

              {pideNombre && (
                <>
                  <Text style={styles.avisoNombre}>
                    No encontramos una cuenta con ese correo — vamos a
                    crearte una nueva. Contanos tu nombre y tu teléfono
                    (así tus reservas se llenan solas):
                  </Text>
                  <Campo
                    label="Tu nombre"
                    value={nombre}
                    onChangeText={setNombre}
                    autoComplete="name"
                    textContentType="name"
                  />
                  <Campo
                    label="Tu teléfono (WhatsApp)"
                    value={telefono}
                    onChangeText={setTelefono}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                  />
                </>
              )}

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={styles.botonPrimario}
                disabled={enviando || comprobando}
                onPress={() => enviarCodigo()}
              >
                {enviando || comprobando ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.botonPrimarioTexto}>
                    {pideNombre ? "Crear mi cuenta y enviarme el código" : "Enviarme el código"}
                  </Text>
                )}
              </Pressable>

              {/* Google y Facebook, igual que en la web. Si no están
                  configurados en Supabase, esto no dibuja nada. */}
              <BotonesSociales />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.titulo}>
              {esCuentaDemo ? "Cuenta de prueba" : "Revisá tu correo"}
            </Text>
            <Text style={styles.subtitulo}>
              {esCuentaDemo
                ? `${correoLimpio} es una cuenta de prueba: no le llega correo — usá el código de test 123456.`
                : `Te mandamos un código de 6 dígitos a ${correoLimpio}. Escribilo acá — puede tardar un momento en llegar (revisá spam si no aparece).`}
            </Text>

            <View style={styles.bloque}>
              {/* oneTimeCode: iOS ofrece el código apenas llega (SMS y,
                  desde iOS 16, también Apple Mail) sobre el teclado. */}
              <Campo
                label="Código de 6 dígitos"
                value={codigo}
                onChangeText={setCodigo}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
              />

              {/* En Android el correo no se lee solo: el camino rápido
                  es copiar el código de la notificación de Gmail y
                  pegarlo con un toque. */}
              <Pressable style={styles.botonPegar} onPress={pegarCodigo}>
                <Ionicons name="clipboard-outline" size={14} color={Colors.navy} />
                <Text style={styles.botonPegarTexto}>Pegar el código copiado</Text>
              </Pressable>

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

              {/* A una cuenta demo no hay nada que reenviarle. */}
              {!esCuentaDemo && (
                <Pressable disabled={enviando} onPress={() => enviarCodigo(true)}>
                  <Text style={styles.enlace}>Reenviarme el código</Text>
                </Pressable>
              )}
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

        {/* Los legales también acá: quien revisa la app en App Store o
            Play no siempre entra con una cuenta, y la política de
            privacidad tiene que alcanzarse igual. */}
        <PieLegal />
      </ScrollView>
    </View>
  );
}

/**
 * Tarjeta "completá tu perfil" para cuentas que entraron antes de que
 * pidiéramos el teléfono (o sin nombre): con esos dos datos, las
 * reservas y citas se llenan solas. Solo aparece si falta algo y
 * desaparece al guardar.
 */
function CompletarPerfilCard({
  nombrePerfil,
  refrescarPerfil,
}: {
  nombrePerfil: string | null;
  refrescarPerfil: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!vigente || !user) return;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const nombreMeta =
        [meta.nombre, meta.full_name].find(
          (v): v is string => typeof v === "string" && v.trim() !== "",
        ) ??
        nombrePerfil ??
        "";
      const telMeta =
        typeof meta.whatsapp === "string" && meta.whatsapp.trim() !== ""
          ? meta.whatsapp
          : "";
      if (!nombreMeta || !telMeta) {
        setNombre(nombreMeta);
        setTelefono(telMeta);
        setVisible(true);
      }
    });
    return () => {
      vigente = false;
    };
  }, [nombrePerfil]);

  if (!visible) return null;

  async function guardar() {
    setError(null);
    if (!nombre.trim()) {
      setError("Contanos tu nombre.");
      return;
    }
    if (!/^[0-9+\s-]{8,16}$/.test(telefono.trim())) {
      setError("Dejanos un teléfono válido (solo números).");
      return;
    }
    setGuardando(true);
    const { data, error: err } = await supabase.auth.updateUser({
      data: { nombre: nombre.trim(), whatsapp: telefono.trim() },
    });
    setGuardando(false);
    if (err) {
      setError("No se pudo guardar: " + err.message);
      return;
    }
    // El nombre visible del perfil también, si la política lo permite.
    if (data.user) {
      await supabase.from("perfiles").update({ nombre: nombre.trim() }).eq("id", data.user.id);
    }
    refrescarPerfil();
    setVisible(false);
  }

  return (
    <View style={styles.completarCard}>
      <Text style={styles.completarTitulo}>Completá tu perfil</Text>
      <Text style={styles.completarTexto}>
        Con tu nombre y teléfono, tus reservas y citas se llenan solas —
        no volvés a escribirlos.
      </Text>
      <Campo
        label="Tu nombre"
        value={nombre}
        onChangeText={setNombre}
        autoComplete="name"
        textContentType="name"
      />
      <Campo
        label="Tu teléfono (WhatsApp)"
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.botonPrimario} disabled={guardando} onPress={guardar}>
        {guardando ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.botonPrimarioTexto}>Guardar</Text>
        )}
      </Pressable>
    </View>
  );
}

function Campo(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "number-pad";
  autoCapitalize?: "none" | "sentences";
  /** Para que el sistema ofrezca llenar solo (código OTP, correo...). */
  autoComplete?: React.ComponentProps<typeof TextInput>["autoComplete"];
  textContentType?: React.ComponentProps<typeof TextInput>["textContentType"];
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
        autoComplete={props.autoComplete}
        textContentType={props.textContentType}
        style={styles.input}
        placeholderTextColor={Colors.inkSoft}
      />
    </View>
  );
}

/** Los números del perfil. */
type StatsPerfil = {
  reservas: number;
  resenas: number;
  favoritos: number;
  negocios: number;
  /** Los ids en sí -no solo el conteo- para poder ir DIRECTO al panel
   *  del único negocio sin pasar por la lista "Mis negocios" cuando
   *  hay uno solo (0 o 2+ igual van a la lista). */
  negocioIds: string[];
  vecesContratado: number;
  calificacion: number | null;
  /** true = alguno de sus negocios tiene el programa de lealtad. */
  lealtadActiva: boolean;
};

function PerfilVista({
  perfil,
  correo,
  clienteId,
  activa,
}: {
  perfil: Perfil | null;
  correo: string | null;
  clienteId: string;
  activa: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refrescarPerfil } = useAuth();
  const inicial = (perfil?.nombre || correo || "?").trim().charAt(0).toUpperCase();
  const [stats, setStats] = useState<StatsPerfil | null>(null);
  /** Mensajes sin leer en todas tus consultas — la burbujita de la
   *  fila "Consultas". */
  const [consultasSinLeer, setConsultasSinLeer] = useState(0);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreBorrador, setNombreBorrador] = useState(perfil?.nombre ?? "");
  const [guardandoNombre, setGuardandoNombre] = useState(false);

  // El acceso por código nunca pide el nombre, así que se pone acá.
  // Va por RPC porque la tabla `perfiles` solo deja editar al admin:
  // la función toca únicamente la columna `nombre` de quien la llama.
  async function guardarNombre() {
    setGuardandoNombre(true);
    const { error } = await supabase.rpc("actualizar_mi_nombre", {
      p_nombre: nombreBorrador,
    });
    setGuardandoNombre(false);
    if (error) {
      Alert.alert("No se pudo guardar", error.message);
      return;
    }
    setEditandoNombre(false);
    refrescarPerfil();
  }

  // Los números del perfil: lo que hizo como cliente (reservas,
  // reseñas, favoritos) y — si publica servicios — cuántas veces lo
  // han contratado y su calificación promedio ponderada.
  useEffect(() => {
    if (!activa) return;
    let vigente = true;
    (async () => {
      const [reservasRes, resenasRes, favoritosRes, negociosRes] = await Promise.all([
        supabase
          .from("reservas")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId)
          .in("estado", ["pendiente", "confirmada"]),
        supabase
          .from("resenas")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId),
        supabase
          .from("favoritos")
          .select("rancho_id", { count: "exact", head: true })
          .eq("cliente_id", clienteId),
        supabase.from("ranchos").select("id").eq("owner_id", clienteId),
      ]);

      const negocioIds = (negociosRes.data ?? []).map((r) => r.id as string);
      let vecesContratado = 0;
      let calificacion: number | null = null;
      let lealtadActiva = false;
      if (negocioIds.length > 0) {
        const [{ count: contratadoCount }, { data: califs }, { data: conLealtad }] =
          await Promise.all([
            supabase
              .from("reservas")
              .select("id", { count: "exact", head: true })
              .in("rancho_id", negocioIds)
              .eq("estado", "confirmada"),
            supabase
              .from("calificaciones_rancho")
              .select("promedio, total")
              .in("rancho_id", negocioIds),
            // ¿Alguno tiene el programa contratado? Con uno alcanza: la
            // tarjeta lleva al panel y ahí se elige cuál. Es la MISMA
            // consulta que hace /cuenta en la web (`cuenta/page.tsx`),
            // para que las dos decidan igual.
            supabase
              .from("addons_negocio")
              .select("rancho_id")
              .in("rancho_id", negocioIds)
              .eq("addon", "lealtad")
              .eq("activo", true)
              .limit(1),
          ]);
        vecesContratado = contratadoCount ?? 0;
        const filas = (califs ?? []) as { promedio: number; total: number }[];
        const totalResenas = filas.reduce((acc, c) => acc + c.total, 0);
        calificacion =
          totalResenas > 0
            ? filas.reduce((acc, c) => acc + c.promedio * c.total, 0) / totalResenas
            : null;
        lealtadActiva = (conLealtad ?? []).length > 0;
      }

      if (!vigente) return;
      setStats({
        reservas: reservasRes.count ?? 0,
        resenas: resenasRes.count ?? 0,
        favoritos: favoritosRes.count ?? 0,
        negocios: negocioIds.length,
        negocioIds,
        vecesContratado,
        calificacion,
        lealtadActiva,
      });

      // ── La burbujita de "Consultas" ──────────────────────────────
      // Mismo criterio que la bandeja: un mensaje cuenta como sin leer
      // si NO lo escribiste vos y es posterior a tu marca de lectura
      // de esa conversación. La RLS ya acota `conversaciones` y
      // `mensajes` a las tuyas, así que no hace falta filtrar por
      // dueño acá.
      const [{ data: convs }, { data: lecturas }] = await Promise.all([
        supabase.from("conversaciones").select("id"),
        supabase
          .from("conversacion_lecturas")
          .select("conversacion_id, leido_hasta")
          .eq("usuario_id", clienteId),
      ]);
      const idsConv = (convs ?? []).map((c) => c.id as string);
      if (idsConv.length === 0) {
        if (vigente) setConsultasSinLeer(0);
        return;
      }
      const marca = new Map(
        ((lecturas ?? []) as { conversacion_id: string; leido_hasta: string }[]).map((l) => [
          l.conversacion_id,
          l.leido_hasta,
        ]),
      );
      const { data: msgs } = await supabase
        .from("mensajes")
        .select("conversacion_id, autor_id, created_at")
        .in("conversacion_id", idsConv)
        .neq("autor_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(500);
      const sinLeer = ((msgs ?? []) as { conversacion_id: string; created_at: string }[]).filter(
        (m) => {
          const leido = marca.get(m.conversacion_id);
          return !leido || m.created_at > leido;
        },
      ).length;
      if (vigente) setConsultasSinLeer(sinLeer);
    })();
    return () => {
      vigente = false;
    };
  }, [activa, clienteId]);

  const esProveedor = (stats?.negocios ?? 0) > 0;
  // Un solo negocio: directo a su panel. Varios: a elegir cuál -misma
  // regla en las dos entradas al panel (la tarjeta "Tu negocio" y el
  // botón "Administrar mi negocio"), para que no decidan cosas distintas.
  const rutaPanel = (ids: string[]) => (ids.length === 1 ? `/negocio/${ids[0]}` : "/negocio");

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.three,
          paddingHorizontal: Spacing.four,
          paddingBottom: TAB_BAR_ESPACIO,
          gap: Spacing.three,
        }}
      >
        {/* ── ENCABEZADO: nombre grande a la izquierda, avatar a la
            derecha. Sin tarjeta ni borde — el nombre ES el título de la
            pantalla, así que ya no hace falta un "Perfil" encima
            repitiendo dónde está uno. */}
        <View style={styles.encabezado}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {editandoNombre ? (
              <View style={styles.editorNombre}>
                <TextInput
                  value={nombreBorrador}
                  onChangeText={setNombreBorrador}
                  placeholder="Tu nombre"
                  placeholderTextColor={Colors.inkSoft}
                  style={styles.inputNombre}
                  autoFocus
                  maxLength={60}
                />
                <Pressable
                  style={styles.guardarNombre}
                  disabled={guardandoNombre}
                  onPress={guardarNombre}
                >
                  {guardandoNombre ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Ionicons name="checkmark" size={18} color="#ffffff" />
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.filaNombre}
                onPress={() => {
                  setNombreBorrador(perfil?.nombre ?? "");
                  setEditandoNombre(true);
                }}
              >
                <Text style={styles.nombreTitular} numberOfLines={1}>
                  {perfil?.nombre || "Poné tu nombre"}
                </Text>
                <Ionicons name="pencil" size={14} color={Colors.inkSoft} />
              </Pressable>
            )}
            <Text style={styles.subtituloRol}>
              {esProveedor ? "Perfil de proveedor" : "Perfil personal"}
            </Text>
          </View>
          <View style={styles.avatarGrande}>
            <Text style={styles.avatarGrandeTexto}>{inicial}</Text>
          </View>
        </View>

        {/* Cuentas viejas sin nombre o teléfono: se completan acá una
            sola vez y las reservas quedan llenándose solas. */}
        <CompletarPerfilCard
          nombrePerfil={perfil?.nombre ?? null}
          refrescarPerfil={refrescarPerfil}
        />

        {/* La entrada al Panel Admin, solo para el equipo de Bookea. */}
        {perfil?.rol === "admin" && (
          <Pressable
            style={styles.tarjetaAdmin}
            accessibilityRole="button"
            onPress={() => router.push("/admin" as never)}
          >
            <View style={styles.adminIcono}>
              <Ionicons name="shield-checkmark-outline" size={19} color="#ffffff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.adminTitulo}>Panel Admin</Text>
              <Text style={styles.adminDetalle} numberOfLines={1}>
                Publicaciones, cuentas, finanzas y más
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.7)" />
          </Pressable>
        )}

        {/* ── GRUPO 1: lo que la persona TIENE en Bookea ───────────── */}
        <Grupo>
          <FilaMenu
            icono="person-outline"
            texto="Perfil"
            onPress={() => {
              setNombreBorrador(perfil?.nombre ?? "");
              setEditandoNombre(true);
            }}
          />
          <FilaMenu icono="heart-outline" texto="Favoritos" onPress={() => router.push("/favoritos" as never)} />
          {/* "Consultas" reemplaza a la pestaña Mensajes del menú
              inferior: la conversación se abre desde el botón
              "Consultar" de un negocio de Eventos/Ranchos, y desde acá
              se lee. El contador es el de mensajes sin leer. */}
          <FilaMenu
            icono="chatbubble-ellipses-outline"
            texto="Consultas"
            insignia={consultasSinLeer}
            onPress={() => router.push("/consultas" as never)}
          />
          <FilaMenu icono="calendar-outline" texto="Mis reservas" onPress={() => router.push("/reservas" as never)} />
          <FilaMenu icono="time-outline" texto="Historial" onPress={() => router.push("/historial" as never)} />
          {/* "Nivel" ya no es un Alert de "muy pronto": abre las
              tarjetas de lealtad reales de esta persona (los negocios
              donde está afiliada, con su avance). */}
          <FilaMenu icono="ribbon-outline" texto="Nivel" onPress={() => router.push("/nivel" as never)} />
          <FilaMenu
            icono="mail-outline"
            texto="Invitaciones y álbumes"
            onPress={() => router.push("/invitaciones" as never)}
          />
          <FilaMenu
            icono="settings-outline"
            texto="Ajustes"
            onPress={() => router.push("/ajustes" as never)}
            ultima
          />
        </Grupo>

        {/* ── GRUPO 2: lo de proveedor, solo si publica ─────────────
            /lealtad es venta B2B —«quiero el programa en MI negocio»—
            así que solo tiene sentido para quien publica. Sale SIEMPRE
            que `esProveedor`, tenga o no el programa: si solo se viera
            una vez contratado, nadie se enteraría de que existe. */}
        {esProveedor && (
          <Grupo>
            <FilaMenu
              icono="ribbon-outline"
              texto="Programa de lealtad"
              detalle={stats?.lealtadActiva ? "Sellos, puntos y pases" : "Clientes que vuelven"}
              onPress={() =>
                stats?.lealtadActiva
                  ? WebBrowser.openBrowserAsync(`${SITIO_URL}/lealtad/entrar`)
                  : router.push("/lealtad" as never)
              }
              ultima
            />
          </Grupo>
        )}

        {/* ── GRUPO 3: ayuda ──────────────────────────────────────── */}
        <Grupo>
          <FilaMenu
            icono="help-buoy-outline"
            texto="Ayuda"
            onPress={() => WebBrowser.openBrowserAsync(`${SITIO_URL}/ayuda`)}
            ultima
          />
        </Grupo>

        {/* «MODO NEGOCIO» entra de verdad al panel de administración,
            que tiene su PROPIA barra inferior (`PanelNav`) dedicada a
            administrar. Pasa por la pantalla de transición animada
            (`/entrando-negocio`) que pidió el dueño: la casita entra al
            centro con tres puntitos rebotando, 1,5 s, y ya está adentro.
            Con un solo negocio va derecho a su panel; con varios, a
            elegir cuál. */}
        {esProveedor && stats && (
          <Pressable
            style={styles.botonModoNegocio}
            onPress={() =>
              router.push(
                `/entrando-negocio?destino=${encodeURIComponent(rutaPanel(stats.negocioIds))}` as never,
              )
            }
          >
            <Ionicons name="storefront" size={17} color="#ffffff" />
            <Text style={styles.botonModoNegocioTexto}>Modo negocio</Text>
          </Pressable>
        )}

        <PieLegal />
      </ScrollView>
    </View>
  );
}

/** Un bloque de filas con fondo blanco y esquinas redondeadas — el
 * agrupador del menú, igual que el de la referencia. */
function Grupo({ children }: { children: React.ReactNode }) {
  return <View style={styles.grupo}>{children}</View>;
}

/** Una fila del menú: ícono, texto y chevron. */
function FilaMenu({
  icono,
  texto,
  detalle,
  insignia,
  onPress,
  ultima,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
  detalle?: string;
  /** La burbujita con un número — 0 o ausente no dibuja nada. */
  insignia?: number;
  onPress: () => void;
  /** La última del grupo no lleva la línea separadora de abajo. */
  ultima?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.filaMenu,
        !ultima && styles.filaMenuSeparador,
        pressed && { backgroundColor: Colors.cream2 },
      ]}
      onPress={onPress}
    >
      <Ionicons name={icono} size={21} color={Colors.ink} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.filaMenuTexto}>{texto}</Text>
        {!!detalle && (
          <Text style={styles.filaMenuDetalle} numberOfLines={1}>
            {detalle}
          </Text>
        )}
      </View>
      {!!insignia && insignia > 0 && (
        <View style={styles.insignia}>
          <Text style={styles.insigniaTexto}>{insignia > 99 ? "99+" : insignia}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={17} color={Colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five, gap: Spacing.three },
  contenedorForm: { flexGrow: 1, padding: Spacing.four, paddingBottom: TAB_BAR_ESPACIO, gap: Spacing.two },
  logoMarca: { width: 170, height: 60, marginBottom: Spacing.two },
  botonPegar: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: Colors.line,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  botonPegarTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
  completarCard: {
    backgroundColor: Colors.blueLight,
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  completarTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15.5 },
  completarTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 4,
  },
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
  // El mismo micro-rótulo (Tipo.micro) que encabeza los bloques en el
  // resto de la app, para que los formularios no hablen otro idioma.
  campoLabel: {
    color: Colors.inkMuted,
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
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
  avisoNombre: {
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.inkSoft,
    backgroundColor: Colors.cream,
    borderRadius: 10,
    padding: 10,
  },
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
  // El encabezado: el nombre ES el título de la pantalla (no hay
  // "Perfil" encima repitiéndolo) y el avatar va a la derecha.
  encabezado: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.three,
    marginBottom: Spacing.one,
  },
  nombreTitular: { fontSize: 27, fontFamily: Fonts.extraBold, letterSpacing: -0.7, color: Colors.ink },
  subtituloRol: { fontSize: 13.5, color: Colors.inkSoft, fontFamily: Fonts.medium, marginTop: 2 },
  avatarGrande: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
    // Aro naranja: el guiño al punto del logo.
    borderWidth: 2.5,
    borderColor: Colors.sky,
  },
  avatarGrandeTexto: { color: "#ffffff", fontSize: 23, fontFamily: Fonts.extraBold },
  // Los grupos del menú: bloque blanco con filas adentro, como la
  // referencia. La línea separadora solo entre filas, nunca al final.
  grupo: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  filaMenu: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 15,
  },
  filaMenuSeparador: { borderBottomColor: Colors.line, borderBottomWidth: 1 },
  filaMenuTexto: { color: Colors.ink, fontFamily: Fonts.semiBold, fontSize: 15.5 },
  filaMenuDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  insignia: {
    alignItems: "center",
    backgroundColor: Colors.accent,
    borderRadius: 11,
    justifyContent: "center",
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  insigniaTexto: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 11 },
  botonModoNegocio: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 15,
  },
  botonModoNegocioTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },
  filaNombre: { flexDirection: "row", alignItems: "center", gap: 6 },
  editorNombre: { flexDirection: "row", alignItems: "center", gap: Spacing.two, alignSelf: "stretch" },
  inputNombre: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.ink,
    backgroundColor: Colors.cream,
  },
  guardarNombre: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  // Navy sólido: el admin es sobrio y se distingue de las tarjetas
  // blancas del perfil sin gritar.
  tarjetaAdmin: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 18,
    flexDirection: "row",
    gap: Spacing.two + 2,
    padding: Spacing.three,
  },
  adminIcono: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  adminTitulo: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 14.5 },
  adminDetalle: { color: "rgba(255,255,255,0.72)", fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
});
