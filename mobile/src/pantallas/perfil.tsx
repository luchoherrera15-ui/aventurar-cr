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
import { supabase } from "@/lib/supabase";
import { desregistrarPush } from "@/lib/push";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { useAuth, type Perfil } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import TituloPantalla from "@/components/titulo-pantalla";
import PieLegal from "@/components/pie-legal";
import logoBookea from "../../assets/images/logo-bookea.png";

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
  const pideNombre = correoEsNuevo === true;

  async function enviarCodigo(esReenvio = false) {
    setError(null);
    if (!CORREO_REGEX.test(correoLimpio)) {
      setError("Ese correo no parece válido.");
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
  vecesContratado: number;
  calificacion: number | null;
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
  const { refrescarPerfil } = useAuth();
  const inicial = (perfil?.nombre || correo || "?").trim().charAt(0).toUpperCase();
  const [stats, setStats] = useState<StatsPerfil | null>(null);
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
        favoritos: favoritosRes.count ?? 0,
        negocios: negocioIds.length,
        vecesContratado,
        calificacion,
      });
    })();
    return () => {
      vigente = false;
    };
  }, [activa, clienteId]);

  const esProveedor = (stats?.negocios ?? 0) > 0;

  return (
    <View style={styles.contenedor}>
      <TituloPantalla titulo="Perfil" />
      <ScrollView contentContainerStyle={{ padding: Spacing.four, paddingBottom: TAB_BAR_ESPACIO, gap: Spacing.three }}>
        {/* Cuentas viejas sin nombre o teléfono: se completan acá una
            sola vez y las reservas quedan llenándose solas. */}
        <CompletarPerfilCard
          nombrePerfil={perfil?.nombre ?? null}
          refrescarPerfil={refrescarPerfil}
        />
        {/* Identidad: tarjeta clara con el avatar centrado y los
            números debajo — sin el bloque navy pesado de antes. */}
        <View style={styles.tarjetaIdentidad}>
          <View style={styles.avatarGrande}>
            <Text style={styles.avatarGrandeTexto}>{inicial}</Text>
          </View>
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
              <Text style={styles.nombreGrande} numberOfLines={1}>
                {perfil?.nombre || "Poné tu nombre"}
              </Text>
              <Ionicons name="pencil" size={13} color={Colors.inkSoft} />
            </Pressable>
          )}
          <Text style={styles.correoPerfil} numberOfLines={1}>
            {correo}
          </Text>
          <View style={[styles.chipRol, esProveedor && styles.chipRolProveedor]}>
            <Ionicons
              name={esProveedor ? "storefront" : "person"}
              size={12}
              color={esProveedor ? Colors.accent : Colors.navy}
            />
            <Text style={[styles.chipRolTexto, esProveedor && styles.chipRolTextoProveedor]}>
              {esProveedor ? "Proveedor" : "Cliente"}
            </Text>
          </View>

          <View style={styles.filaStats}>
            <Stat valor={stats ? String(stats.reservas) : "—"} etiqueta={stats?.reservas === 1 ? "reserva" : "reservas"} />
            <View style={styles.statDivisor} />
            <Stat valor={stats ? String(stats.resenas) : "—"} etiqueta={stats?.resenas === 1 ? "reseña" : "reseñas"} />
            <View style={styles.statDivisor} />
            <Stat valor={stats ? String(stats.favoritos) : "—"} etiqueta="favoritos" />
          </View>
        </View>

        {esProveedor && stats && (
          <Pressable style={styles.tarjetaNegocio} onPress={() => router.push("/negocio" as never)}>
            <View style={styles.negocioEncabezado}>
              <Text style={styles.negocioTitulo}>Tu negocio</Text>
              <Ionicons name="chevron-forward" size={17} color={Colors.inkSoft} />
            </View>
            <View style={styles.filaStats}>
              <Stat valor={String(stats.negocios)} etiqueta={stats.negocios === 1 ? "publicación" : "publicaciones"} />
              <View style={styles.statDivisor} />
              <Stat
                valor={String(stats.vecesContratado)}
                etiqueta={stats.vecesContratado === 1 ? "contratación" : "contrataciones"}
              />
              <View style={styles.statDivisor} />
              <Stat
                valor={stats.calificacion !== null ? `★ ${stats.calificacion.toFixed(1)}` : "—"}
                etiqueta="calificación"
              />
            </View>
          </Pressable>
        )}

        {/* Accesos en tarjetas. Reservas, favoritos y mensajes NO van
            acá: ya son pestañas de la barra inferior y repetirlos solo
            duplica caminos para llegar a lo mismo. */}
        <View style={styles.grid}>
          <TarjetaAccion
            icono={esProveedor ? "storefront-outline" : "add-circle-outline"}
            titulo={esProveedor ? "Mis publicaciones" : "Publicar"}
            detalle={esProveedor ? "Editá y administrá" : "Ofrecé tu servicio"}
            acento
            onPress={() => router.push("/negocio" as never)}
          />
          <TarjetaAccion
            icono="globe-outline"
            titulo="Sitio web"
            detalle="bookea.lat"
            onPress={() => WebBrowser.openBrowserAsync(SITIO_URL)}
          />
        </View>

        {/* Invitaciones digitales y álbumes: los eventos propios y los
            paquetes a la venta viven en su propia pantalla. Al lado,
            Lealtad — el add-on para negocios con clientela que vuelve. */}
        <View style={styles.grid}>
          <TarjetaAccion
            icono="mail-outline"
            titulo="Invitaciones y álbumes"
            detalle="Tus eventos y fotos"
            onPress={() => router.push("/invitaciones" as never)}
          />
          <TarjetaAccion
            icono="ribbon-outline"
            titulo="Lealtad"
            detalle="Clientes que vuelven"
            onPress={() => router.push("/lealtad" as never)}
          />
        </View>

        <Pressable
          style={styles.botonSalir}
          onPress={async () => {
            // El token push se suelta ANTES del signOut: la política
            // RLS solo deja borrarlo mientras la sesión sigue viva.
            await desregistrarPush();
            await supabase.auth.signOut();
          }}
        >
          <Ionicons name="log-out-outline" size={16} color={Colors.danger} />
          <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
        </Pressable>

        {/* App Store exige poder borrar la cuenta desde la app
            (guideline 5.1.1) — y además es lo correcto. */}
        <Pressable style={styles.botonEliminar} onPress={confirmarEliminarCuenta}>
          <Text style={styles.botonEliminarTexto}>Eliminar mi cuenta</Text>
        </Pressable>

        <PieLegal />
      </ScrollView>
    </View>
  );
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
          Alert.alert("Última confirmación", "¿Seguro que querés eliminar tu cuenta para siempre?", [
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
                await supabase.auth.signOut();
              },
            },
          ]),
      },
    ],
  );
}

/**
 * Un número del perfil con su etiqueta. Va siempre sobre tarjeta
 * clara — antes tenía una variante para el bloque navy y el color por
 * defecto era blanco, lo que dejaba los números invisibles cuando la
 * tarjeta pasó a ser blanca.
 */
function Stat({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <View style={stylesStat.contenedor}>
      <Text style={stylesStat.valor}>{valor}</Text>
      <Text style={stylesStat.etiqueta} numberOfLines={1}>
        {etiqueta}
      </Text>
    </View>
  );
}

const stylesStat = StyleSheet.create({
  contenedor: { flex: 1, alignItems: "center", gap: 1 },
  valor: { fontSize: 19, fontFamily: Fonts.extraBold, letterSpacing: -0.3, color: Colors.ink },
  etiqueta: { fontSize: 10.5, fontFamily: Fonts.semiBold, color: Colors.inkSoft },
});

/** Un acceso del perfil como tarjeta, en vez de la vieja fila de
 * lista con chevron. */
function TarjetaAccion({
  icono,
  titulo,
  detalle,
  onPress,
  acento,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalle: string;
  onPress: () => void;
  /** true = el ícono va en naranja (la acción principal). */
  acento?: boolean;
}) {
  return (
    <Pressable style={styles.tarjetaAccion} onPress={onPress}>
      <View style={[styles.iconoBurbuja, acento && styles.iconoBurbujaAcento]}>
        <Ionicons name={icono} size={20} color={acento ? Colors.accent : Colors.navy} />
      </View>
      <Text style={styles.accionTitulo}>{titulo}</Text>
      <Text style={styles.accionDetalle} numberOfLines={1}>
        {detalle}
      </Text>
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
    borderColor: "#dbe4f2",
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  botonPegarTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
  completarCard: {
    backgroundColor: "#f4f7fd",
    borderColor: "#dbe4f2",
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
  tarjetaIdentidad: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 22,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    gap: 3,
    shadowColor: "#101a2c",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatarGrande: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    // Aro naranja: el guiño al punto del logo.
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  avatarGrandeTexto: { color: "#ffffff", fontSize: 34, fontFamily: Fonts.extraBold },
  filaNombre: { flexDirection: "row", alignItems: "center", gap: 6 },
  nombreGrande: { fontSize: 19, fontFamily: Fonts.extraBold, letterSpacing: -0.3, color: Colors.ink },
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
  correoPerfil: { fontSize: 12.5, color: Colors.inkSoft, fontFamily: Fonts.medium },
  chipRol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: "#e8ecf6",
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  chipRolProveedor: { backgroundColor: Colors.accentLight },
  chipRolTexto: { fontSize: 11.5, fontFamily: Fonts.bold, color: Colors.navy },
  chipRolTextoProveedor: { color: Colors.accent },
  filaStats: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingTop: Spacing.three,
  },
  statDivisor: { width: 1, height: 26, backgroundColor: Colors.line },
  tarjetaNegocio: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  negocioEncabezado: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  negocioTitulo: { fontSize: 14.5, fontFamily: Fonts.extraBold, color: Colors.ink },
  grid: { flexDirection: "row", gap: Spacing.three },
  tarjetaAccion: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 18,
    padding: Spacing.three,
    gap: 3,
  },
  iconoBurbuja: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e8ecf6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  iconoBurbujaAcento: { backgroundColor: Colors.accentLight },
  accionTitulo: { fontSize: 14, fontFamily: Fonts.extraBold, color: Colors.ink },
  accionDetalle: { fontSize: 11.5, color: Colors.inkSoft, fontFamily: Fonts.medium },
  botonSalir: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.three,
  },
  botonSalirTexto: { color: Colors.danger, fontFamily: Fonts.bold, fontSize: 13.5 },
  botonEliminar: { alignItems: "center", paddingBottom: Spacing.two },
  botonEliminarTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
