import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";

/**
 * Hilo por id de conversación — lo usan las consultas directas (sin
 * reserva). Los hilos de reserva siguen en /mensajes/[reservaId].
 * Mismo chat: realtime con fallback a polling, burbujas navy.
 */

type Mensaje = {
  id: string;
  conversacion_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
};

type ConversacionRow = {
  id: string;
  reserva_id: string | null;
  cliente_id: string;
  proveedor_id: string;
  ranchos: { nombre: string } | null;
};

export default function HiloConsultaScreen() {
  const { conversacionId } = useLocalSearchParams<{ conversacionId: string }>();
  const { session } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [envioError, setEnvioError] = useState<string | null>(null);
  const listaRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!session || !conversacionId) return;
    let vigente = true;

    (async () => {
      // RLS ya limita a los participantes: si no es tuya, viene null.
      const { data } = await supabase
        .from("conversaciones")
        .select("id, reserva_id, cliente_id, proveedor_id, ranchos(nombre)")
        .eq("id", conversacionId)
        .maybeSingle();

      const conversacion = data as unknown as ConversacionRow | null;
      if (!vigente) return;
      if (!conversacion) {
        setError("Esta conversación no existe o no te pertenece.");
        setCargando(false);
        return;
      }

      const esCliente = conversacion.cliente_id === session.user.id;
      const { data: perfilOtro } = await supabase
        .from("perfiles")
        .select("nombre")
        .eq("id", esCliente ? conversacion.proveedor_id : conversacion.cliente_id)
        .maybeSingle();

      const { data: mensajesData } = await supabase
        .from("mensajes")
        .select("id, conversacion_id, autor_id, texto, created_at")
        .eq("conversacion_id", conversacion.id)
        .order("created_at", { ascending: true });

      await supabase.from("conversacion_lecturas").upsert(
        {
          conversacion_id: conversacion.id,
          usuario_id: session.user.id,
          leido_hasta: new Date().toISOString(),
        },
        { onConflict: "conversacion_id,usuario_id" },
      );

      if (!vigente) return;
      setTitulo(
        esCliente
          ? (conversacion.ranchos?.nombre ?? "Consulta")
          : perfilOtro?.nombre || "Cliente interesado",
      );
      setMensajes((mensajesData ?? []) as Mensaje[]);
      setCargando(false);
    })();

    return () => {
      vigente = false;
    };
  }, [session, conversacionId]);

  useEffect(() => {
    if (cargando || error || !conversacionId) return;
    let pollId: ReturnType<typeof setInterval> | null = null;

    async function refrescar() {
      const { data } = await supabase
        .from("mensajes")
        .select("id, conversacion_id, autor_id, texto, created_at")
        .eq("conversacion_id", conversacionId)
        .order("created_at", { ascending: true });
      if (data) setMensajes(data as Mensaje[]);
    }

    const canal = supabase
      .channel(`mensajes-${conversacionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes",
          filter: `conversacion_id=eq.${conversacionId}`,
        },
        (payload) => {
          const nuevo = payload.new as Mensaje;
          setMensajes((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
        },
      )
      // Si Realtime no conecta, el chat no puede quedar muerto: se cae
      // a refrescar la lista cada pocos segundos.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (pollId) {
            clearInterval(pollId);
            pollId = null;
          }
        } else if (
          !pollId &&
          (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
        ) {
          pollId = setInterval(refrescar, 4000);
        }
      });

    return () => {
      if (pollId) clearInterval(pollId);
      supabase.removeChannel(canal);
    };
  }, [cargando, error, conversacionId]);

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || !conversacionId || !session) return;
    setTexto("");
    setEnvioError(null);
    setEnviando(true);
    const { data, error: errorEnvio } = await supabase
      .from("mensajes")
      .insert({
        conversacion_id: conversacionId,
        autor_id: session.user.id,
        texto: limpio,
      })
      .select("id, conversacion_id, autor_id, texto, created_at")
      .single();
    setEnviando(false);

    if (errorEnvio || !data) {
      setEnvioError("No se pudo enviar el mensaje. Intentá de nuevo.");
      setTexto(limpio);
      return;
    }
    const nuevo = data as Mensaje;
    setMensajes((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centro}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.contenedor}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {titulo && (
        <View style={styles.encabezado}>
          <Text style={styles.encabezadoTexto} numberOfLines={1}>
            {titulo}
          </Text>
          <Text style={styles.encabezadoSub}>Consulta directa</Text>
        </View>
      )}

      <FlatList
        ref={listaRef}
        data={mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.lista}
        onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Text style={styles.vacio}>
            Contale qué estás organizando y qué necesitás saber.
          </Text>
        }
        renderItem={({ item }) => {
          const esMio = item.autor_id === session?.user.id;
          return (
            <View style={[styles.fila, esMio ? styles.filaMia : styles.filaOtro]}>
              <View style={[styles.burbuja, esMio ? styles.burbujaMia : styles.burbujaOtro]}>
                <Text style={esMio ? styles.textoMio : styles.textoOtro}>{item.texto}</Text>
              </View>
            </View>
          );
        }}
      />

      {envioError && <Text style={styles.envioError}>{envioError}</Text>}

      <View style={styles.barraEnvio}>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribí un mensaje..."
          placeholderTextColor={Colors.inkSoft}
          style={styles.input}
          multiline
        />
        <Pressable
          style={[styles.botonEnviar, (!texto.trim() || enviando) && { opacity: 0.5 }]}
          disabled={!texto.trim() || enviando}
          onPress={enviar}
        >
          <Ionicons name="send" size={17} color="#ffffff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five },
  error: { color: Colors.danger, fontFamily: Fonts.medium, textAlign: "center" },
  encabezado: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  encabezadoTexto: { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.ink },
  encabezadoSub: { fontFamily: Fonts.medium, fontSize: 11.5, color: Colors.inkSoft },
  lista: { padding: Spacing.three, gap: Spacing.two, flexGrow: 1 },
  vacio: { textAlign: "center", color: Colors.inkSoft, fontFamily: Fonts.medium, marginTop: Spacing.five },
  fila: { flexDirection: "row" },
  filaMia: { justifyContent: "flex-end" },
  filaOtro: { justifyContent: "flex-start" },
  burbuja: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  burbujaMia: { backgroundColor: Colors.navy },
  burbujaOtro: { backgroundColor: Colors.cream2 },
  textoMio: { color: "#ffffff", fontFamily: Fonts.medium, fontSize: 13.5 },
  textoOtro: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 13.5 },
  envioError: {
    color: Colors.danger,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    textAlign: "center",
  },
  barraEnvio: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.ink,
  },
  botonEnviar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  botonEnviarTexto: { color: "#ffffff", fontSize: 17, fontFamily: Fonts.bold },
});
