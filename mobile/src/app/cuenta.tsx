import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth, type Perfil } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { CATEGORIA_LABEL, fmtColones, type Categoria } from "@/lib/types";
import { TarjetaRancho, type Fila } from "./index";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookearcr.com";
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  return <Dashboard perfil={perfil} correo={session.user.email ?? null} clienteId={session.user.id} />;
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
    // "Publicar tu negocio" del dashboard, no el registro).
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
    <ScrollView contentContainerStyle={styles.contenedorForm}>
      <Text style={styles.titulo}>{modo === "login" ? "Iniciar sesión" : "Creá tu cuenta"}</Text>
      <Text style={styles.subtitulo}>
        {modo === "login"
          ? "Entrá para ver tus reservas activas y tu historial."
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

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "En revisión",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
};
const ESTADO_COLOR: Record<string, string> = {
  pendiente: Colors.accent,
  confirmada: Colors.green,
  rechazada: Colors.danger,
};

type ReservaCliente = {
  id: string;
  fecha: string;
  estado: string;
  monto_total: number | null;
  horario_bloque: string | null;
  ranchos: { nombre: string; foto_url: string | null; categoria: Categoria } | null;
};

function Dashboard({
  perfil,
  correo,
  clienteId,
}: {
  perfil: Perfil | null;
  correo: string | null;
  clienteId: string;
}) {
  const router = useRouter();
  const [reservas, setReservas] = useState<ReservaCliente[] | null>(null);
  const [favoritos, setFavoritos] = useState<Fila[] | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("reservas")
      .select("id, fecha, estado, monto_total, horario_bloque, ranchos(nombre, foto_url, categoria)")
      .eq("cliente_id", clienteId)
      .in("estado", ["pendiente", "confirmada", "rechazada"])
      .order("fecha", { ascending: false });
    setReservas((data ?? []) as unknown as ReservaCliente[]);

    const { data: favData } = await supabase
      .from("favoritos")
      .select(
        "ranchos(id, nombre, categoria, subcategoria, provincia, canton, precio_desde, foto_url)",
      )
      .eq("cliente_id", clienteId);
    setFavoritos(
      ((favData ?? []) as unknown as { ranchos: Fila | null }[])
        .map((f) => f.ranchos)
        .filter((r): r is Fila => r !== null),
    );
  }, [clienteId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  async function quitarFavorito(ranchoId: string) {
    setFavoritos((prev) => (prev ?? []).filter((r) => r.id !== ranchoId));
    await supabase.from("favoritos").delete().eq("cliente_id", clienteId).eq("rancho_id", ranchoId);
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const activas = (reservas ?? []).filter(
    (r) => r.estado !== "rechazada" && r.fecha >= hoy,
  );
  const historial = (reservas ?? []).filter(
    (r) => r.estado === "rechazada" || r.fecha < hoy,
  );

  const inicial = (perfil?.nombre || correo || "?").trim().charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.contenedor}
      contentContainerStyle={{ padding: Spacing.four, paddingBottom: 100, gap: Spacing.four }}
    >
      <View style={styles.tarjetaPerfil}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>{inicial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nombrePerfil}>{perfil?.nombre || "Tu cuenta"}</Text>
          <Text style={styles.correoPerfil}>{correo}</Text>
        </View>
      </View>

      <Pressable style={styles.tarjetaMensajes} onPress={() => router.push("/mensajes")}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mensajesTitulo}>Mensajes</Text>
          <Text style={styles.mensajesTexto}>
            Tus conversaciones de reservas y cotizaciones.
          </Text>
        </View>
        <Text style={styles.mensajesFlecha}>→</Text>
      </Pressable>

      <Seccion titulo="Reservas activas" vacio="Todavía no tenés reservas en curso.">
        {activas.map((r) => (
          <TarjetaReserva key={r.id} reserva={r} />
        ))}
      </Seccion>

      <Seccion titulo="Historial" vacio="Acá vas a ver tus reservas pasadas.">
        {historial.map((r) => (
          <TarjetaReserva key={r.id} reserva={r} atenuada />
        ))}
      </Seccion>

      <Seccion titulo="Tus favoritos" vacio="Todavía no guardaste ningún favorito — tocá el corazón en cualquier tarjeta del directorio.">
        {(favoritos ?? []).map((item) => (
          <TarjetaRancho
            key={item.id}
            item={item}
            ancho="completo"
            favorito
            onPress={() => router.push(`/rancho/${item.id}`)}
            onToggleFavorito={() => quitarFavorito(item.id)}
          />
        ))}
      </Seccion>

      <Pressable
        style={styles.tarjetaPublicar}
        onPress={() => WebBrowser.openBrowserAsync(`${SITIO_URL}/publicar`)}
      >
        <Text style={styles.publicarTitulo}>¿Ofrecés un servicio para eventos?</Text>
        <Text style={styles.publicarTexto}>
          Publicá tu negocio en Bookear CR — lugares, catering, DJs, fotografía y más.
        </Text>
        <Text style={styles.publicarBoton}>Publicar tu negocio →</Text>
      </Pressable>

      <Pressable style={styles.botonSalir} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

function Seccion({
  titulo,
  vacio,
  children,
}: {
  titulo: string;
  vacio: string;
  children: React.ReactNode;
}) {
  const hayContenido = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <View style={styles.bloque}>
      <Text style={styles.bloqueTitulo}>{titulo}</Text>
      {hayContenido ? (
        <View style={{ gap: Spacing.two }}>{children}</View>
      ) : (
        <Text style={styles.hint}>{vacio}</Text>
      )}
    </View>
  );
}

function TarjetaReserva({ reserva, atenuada }: { reserva: ReservaCliente; atenuada?: boolean }) {
  const router = useRouter();
  return (
    <View style={[styles.tarjetaReserva, atenuada && styles.tarjetaAtenuada]}>
      <View style={{ flexDirection: "row", gap: Spacing.three }}>
        <Image
          source={reserva.ranchos?.foto_url ? { uri: reserva.ranchos.foto_url } : undefined}
          style={styles.fotoReserva}
          contentFit="cover"
          alt={reserva.ranchos?.nombre ?? ""}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.categoriaReserva}>
            {reserva.ranchos ? CATEGORIA_LABEL[reserva.ranchos.categoria] : ""}
          </Text>
          <Text style={styles.nombreReserva} numberOfLines={1}>
            {reserva.ranchos?.nombre ?? "Proveedor"}
          </Text>
          <Text style={styles.fechaReserva}>
            {reserva.fecha}
            {reserva.horario_bloque ? ` · ${reserva.horario_bloque}` : ""}
          </Text>
          {reserva.monto_total !== null && (
            <Text style={styles.montoReserva}>{fmtColones(reserva.monto_total)}</Text>
          )}
        </View>
        <View
          style={[styles.badgeEstado, { backgroundColor: ESTADO_COLOR[reserva.estado] ?? Colors.inkSoft }]}
        >
          <Text style={styles.badgeEstadoTexto}>{ESTADO_LABEL[reserva.estado] ?? reserva.estado}</Text>
        </View>
      </View>
      <Pressable style={styles.botonMensajes} onPress={() => router.push(`/mensajes/${reserva.id}`)}>
        <Text style={styles.botonMensajesTexto}>Mensajes</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five, gap: Spacing.three },
  contenedorForm: { flexGrow: 1, padding: Spacing.four, paddingBottom: 100, gap: Spacing.two, backgroundColor: Colors.cream },
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
  bloqueTitulo: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink },
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
  hint: { fontSize: 13, color: Colors.inkSoft },
  tarjetaReserva: {
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 12,
    backgroundColor: Colors.cream,
  },
  tarjetaAtenuada: { opacity: 0.7 },
  tarjetaMensajes: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 16,
    padding: Spacing.three,
  },
  mensajesTitulo: { fontFamily: Fonts.extraBold, fontSize: 14.5, color: Colors.ink },
  mensajesTexto: { marginTop: 2, fontFamily: Fonts.medium, fontSize: 12, color: Colors.inkSoft },
  mensajesFlecha: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.navy },
  botonMensajes: {
    alignSelf: "flex-start",
    paddingTop: Spacing.one,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    width: "100%",
  },
  botonMensajesTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5, paddingTop: 4 },
  fotoReserva: { width: 56, height: 56, borderRadius: 10, backgroundColor: Colors.cream2 },
  categoriaReserva: {
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: Colors.accent,
  },
  nombreReserva: { fontSize: 14.5, fontFamily: Fonts.extraBold, color: Colors.ink },
  fechaReserva: { fontSize: 12.5, color: Colors.inkSoft },
  montoReserva: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.ink },
  badgeEstado: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeEstadoTexto: { color: "#ffffff", fontSize: 10.5, fontFamily: Fonts.bold },
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
