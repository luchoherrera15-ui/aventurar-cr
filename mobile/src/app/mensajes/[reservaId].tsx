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
import { pedirAvisoDeMensaje } from "@/lib/notificaciones";
import BarraSuperior from "@/components/barra-superior";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";

type Mensaje = {
  id: string;
  conversacion_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
};

type ReservaConRancho = {
  id: string;
  fecha: string;
  nombre: string | null;
  cliente_id: string | null;
  ranchos: { nombre: string; owner_id: string } | null;
};

export default function MensajesScreen() {
  const { reservaId } = useLocalSearchParams<{ reservaId: string }>();
  const { session } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [otroNombre, setOtroNombre] = useState<string | null>(null);
  const [resuelta, setResuelta] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [envioError, setEnvioError] = useState<string | null>(null);
  const listaRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!session || !reservaId) return;
    let vigente = true;

    (async () => {
      const { data } = await supabase
        .from("reservas")
        .select("id, fecha, nombre, cliente_id, ranchos(nombre, owner_id)")
        .eq("id", reservaId)
        .maybeSingle();

      const reserva = data as unknown as ReservaConRancho | null;
      if (!vigente) return;
      if (!reserva || !reserva.ranchos) {
        setError("No encontramos esta reserva.");
        setCargando(false);
        return;
      }

      const esCliente = reserva.cliente_id === session.user.id;
      const esProveedor = reserva.ranchos.owner_id === session.user.id;
      if (!esCliente && !esProveedor) {
        setError("Esta conversación no te pertenece.");
        setCargando(false);
        return;
      }

      let convId: string;
      let convResuelta = false;
      const { data: existente } = await supabase
        .from("conversaciones")
        .select("id, resuelta")
        .eq("reserva_id", reservaId)
        .maybeSingle();

      if (existente) {
        convId = existente.id;
        convResuelta = existente.resuelta;
      } else {
        const { data: creada, error: errorCrear } = await supabase
          .from("conversaciones")
          .insert({ reserva_id: reservaId })
          .select("id")
          .single();
        if (errorCrear || !creada) {
          const { data: reintento } = await supabase
            .from("conversaciones")
            .select("id, resuelta")
            .eq("reserva_id", reservaId)
            .maybeSingle();
          if (!reintento) {
            if (!vigente) return;
            setError("No se pudo abrir la conversación.");
            setCargando(false);
            return;
          }
          convId = reintento.id;
          convResuelta = reintento.resuelta;
        } else {
          convId = creada.id;
        }
      }

      // El nombre de perfiles está protegido por RLS (solo se ve el
      // propio): esta vista lo destraba solo para con quién ya estás
      // chateando.
      const { data: contacto } = await supabase
        .from("conversaciones_contacto")
        .select("nombre_contacto")
        .eq("conversacion_id", convId)
        .maybeSingle();

      const { data: mensajesData } = await supabase
        .from("mensajes")
        .select("id, conversacion_id, autor_id, texto, created_at")
        .eq("conversacion_id", convId)
        .order("created_at", { ascending: true });

      await supabase.from("conversacion_lecturas").upsert(
        { conversacion_id: convId, usuario_id: session.user.id, leido_hasta: new Date().toISOString() },
        { onConflict: "conversacion_id,usuario_id" },
      );

      if (!vigente) return;
      setConversacionId(convId);
      setResuelta(convResuelta);
      setOtroNombre(
        esCliente
          ? reserva.ranchos.nombre
          : reserva.nombre || contacto?.nombre_contacto || "Cliente",
      );
      setMensajes((mensajesData ?? []) as Mensaje[]);
      setCargando(false);
    })();

    return () => {
      vigente = false;
    };
  }, [session, reservaId]);

  useEffect(() => {
    if (!conversacionId) return;
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
  }, [conversacionId]);

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || !conversacionId || !session) return;
    setTexto("");
    setEnvioError(null);
    setEnviando(true);
    // Se pide la fila insertada para pintarla de una, sin depender de
    // que Realtime la haga rebotar de vuelta.
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
    // El push al otro participante lo manda la web — sin await: el
    // mensaje ya está guardado y el aviso es un plus.
    void pedirAvisoDeMensaje(nuevo.id);
  }

  // Estado compartido (migración 0054): si cualquiera de los dos la
  // marca resuelta, se archiva para ambos; un mensaje nuevo la reabre
  // sola, así que acá solo hace falta el toggle manual.
  async function alternarResuelto() {
    if (!conversacionId) return;
    const siguiente = !resuelta;
    setResuelta(siguiente);
    const { error } = await supabase
      .from("conversaciones")
      .update({ resuelta: siguiente })
      .eq("id", conversacionId);
    if (error) setResuelta(!siguiente);
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
      <BarraSuperior
        titulo={otroNombre || "Mensajes"}
        subtitulo={resuelta ? "Chat de la reserva · Resuelto" : "Chat de la reserva"}
        accion={{
          icono: resuelta ? "refresh-outline" : "checkmark-circle-outline",
          etiqueta: resuelta ? "Reabrir" : "Marcar como resuelto",
          onPress: alternarResuelto,
        }}
      />

      <FlatList
        ref={listaRef}
        data={mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.lista}
        onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Text style={styles.vacio}>Todavía no hay mensajes. Escribí el primero.</Text>
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

      {envioError && (
        <Text style={styles.envioError}>{envioError}</Text>
      )}

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
