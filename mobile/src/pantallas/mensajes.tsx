import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Swipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import TituloPantalla from "@/components/titulo-pantalla";

/**
 * Bandeja de entrada tipo Airbnb: todas las conversaciones de la
 * persona (como cliente y como proveedor), ordenadas por actividad,
 * con el último mensaje y cuántos hay sin leer. Espejo de /mensajes
 * en la web, con dos gestos para mantener el orden:
 *
 * - Deslizar a la derecha marca la conversación como leída.
 * - Deslizar a la izquierda la "elimina": los mensajes nunca se
 *   borran de verdad (diseño de la migración 0034) — se oculta solo
 *   para esta persona (conversacion_ocultas) y reaparece sola si
 *   llega un mensaje nuevo, para no perder una posible venta.
 */

type ConversacionRow = {
  id: string;
  reserva_id: string | null;
  cliente_id: string;
  proveedor_id: string;
  created_at: string;
  ranchos: { nombre: string; foto_url: string | null } | null;
  reservas: { fecha: string; nombre: string | null; estado: string } | null;
};

type MensajeMin = {
  conversacion_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
};

/** La etiqueta de contexto de cada chat: qué es esta conversación. */
type TagChat = {
  texto: string;
  fondo: string;
  color: string;
};

type Fila = {
  id: string;
  /** Ruta del hilo: por reserva o por conversación (consulta). */
  href: string;
  titulo: string;
  subtitulo: string;
  foto: string | null;
  ultimoTexto: string;
  actividad: string;
  pendientes: number;
  tag: TagChat;
};

function fechaCorta(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString("es-CR", { timeZone: "America/Costa_Rica", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica", day: "numeric", month: "short" });
}

/** Qué es este chat, de un vistazo: una reserva real (y en qué estado
 * va) o una consulta que todavía puede convertirse en una. */
function tagDeChat(c: ConversacionRow): TagChat {
  if (!c.reserva_id) {
    return { texto: "Posible reserva", fondo: "#e8ecf6", color: Colors.navy };
  }
  if (c.reservas?.estado === "confirmada") {
    return { texto: "Reserva confirmada", fondo: Colors.greenLight, color: Colors.green };
  }
  if (c.reservas?.estado === "rechazada") {
    return { texto: "Reserva rechazada", fondo: Colors.dangerLight, color: Colors.danger };
  }
  return { texto: "Nueva reserva", fondo: Colors.accentLight, color: Colors.accent };
}

export default function BandejaMensajesScreen({ activa = true }: { activa?: boolean }) {
  const router = useRouter();
  const { session } = useAuth();
  const [filas, setFilas] = useState<Fila[] | null>(null);

  const cargar = useCallback(async () => {
    if (!session) return;
    const miId = session.user.id;

    const { data: convData } = await supabase
      .from("conversaciones")
      .select(
        "id, reserva_id, cliente_id, proveedor_id, created_at, ranchos(nombre, foto_url), reservas(fecha, nombre, estado)",
      );

    const conversaciones = (convData ?? []) as unknown as ConversacionRow[];
    const ids = conversaciones.map((c) => c.id);

    const [{ data: mensajesData }, { data: lecturasData }, { data: ocultasData }] = ids.length
      ? await Promise.all([
          supabase
            .from("mensajes")
            .select("conversacion_id, autor_id, texto, created_at")
            .in("conversacion_id", ids)
            .order("created_at", { ascending: false })
            .limit(1000),
          supabase
            .from("conversacion_lecturas")
            .select("conversacion_id, leido_hasta")
            .eq("usuario_id", miId),
          supabase
            .from("conversacion_ocultas")
            .select("conversacion_id, oculta_desde")
            .eq("usuario_id", miId),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    const leidoHasta = new Map<string, string>(
      ((lecturasData ?? []) as { conversacion_id: string; leido_hasta: string }[]).map(
        (l) => [l.conversacion_id, l.leido_hasta],
      ),
    );
    const ocultaDesde = new Map<string, string>(
      ((ocultasData ?? []) as { conversacion_id: string; oculta_desde: string }[]).map(
        (o) => [o.conversacion_id, o.oculta_desde],
      ),
    );

    const ultimo = new Map<string, MensajeMin>();
    const sinLeer = new Map<string, number>();
    for (const m of (mensajesData ?? []) as MensajeMin[]) {
      if (!ultimo.has(m.conversacion_id)) ultimo.set(m.conversacion_id, m);
      const marca = leidoHasta.get(m.conversacion_id);
      if (m.autor_id !== miId && (!marca || m.created_at > marca)) {
        sinLeer.set(m.conversacion_id, (sinLeer.get(m.conversacion_id) ?? 0) + 1);
      }
    }

    setFilas(
      conversaciones
        .map((c) => {
          const soyCliente = c.cliente_id === miId;
          const ult = ultimo.get(c.id) ?? null;
          return {
            id: c.id,
            href: c.reserva_id
              ? `/mensajes/${c.reserva_id}`
              : `/mensajes/hilo/${c.id}`,
            titulo: soyCliente
              ? (c.ranchos?.nombre ?? "Conversación")
              : c.reservas?.nombre || "Cliente interesado",
            subtitulo: [
              !soyCliente ? c.ranchos?.nombre : null,
              c.reserva_id
                ? c.reservas?.fecha
                  ? `Evento: ${c.reservas.fecha}`
                  : null
                : "Consulta directa",
            ]
              .filter(Boolean)
              .join(" · "),
            foto: c.ranchos?.foto_url ?? null,
            ultimoTexto: ult
              ? `${ult.autor_id === miId ? "Vos: " : ""}${ult.texto}`
              : "Sin mensajes todavía — escribí el primero.",
            actividad: ult?.created_at ?? c.created_at,
            pendientes: sinLeer.get(c.id) ?? 0,
            tag: tagDeChat(c),
          };
        })
        // Un chat eliminado se queda oculto mientras no pase nada
        // nuevo; si su última actividad es posterior al momento en que
        // se ocultó, vuelve a la bandeja.
        .filter((f) => {
          const oculta = ocultaDesde.get(f.id);
          return !oculta || f.actividad > oculta;
        })
        .sort((a, b) => (a.actividad < b.actividad ? 1 : -1)),
    );
  }, [session]);

  // Carga al montar y recarga cada vez que el pager llega a esta
  // pestaña — los mensajes nuevos entran mientras se navega otra cosa.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar, sin librería de data-fetching en este proyecto
    if (activa) cargar();
  }, [cargar, activa]);

  const marcarLeido = useCallback(
    async (fila: Fila) => {
      if (!session) return;
      setFilas((prev) =>
        (prev ?? []).map((f) => (f.id === fila.id ? { ...f, pendientes: 0 } : f)),
      );
      await supabase.from("conversacion_lecturas").upsert({
        conversacion_id: fila.id,
        usuario_id: session.user.id,
        leido_hasta: new Date().toISOString(),
      });
    },
    [session],
  );

  const eliminarChat = useCallback(
    async (fila: Fila) => {
      if (!session) return;
      setFilas((prev) => (prev ?? []).filter((f) => f.id !== fila.id));
      await supabase.from("conversacion_ocultas").upsert({
        conversacion_id: fila.id,
        usuario_id: session.user.id,
        oculta_desde: new Date().toISOString(),
      });
    },
    [session],
  );

  if (!session) {
    return (
      <View style={styles.contenedor}>
        <TituloPantalla titulo="Mensajes" />
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>Iniciá sesión</Text>
          <Text style={styles.vacioTexto}>
            Entrá a tu cuenta para ver tus conversaciones.
          </Text>
          <Pressable style={styles.boton} onPress={() => router.replace("/?tab=perfil" as never)}>
            <Text style={styles.botonTexto}>Ir a mi perfil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (filas === null) {
    return (
      <View style={styles.contenedor}>
        <TituloPantalla titulo="Mensajes" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <TituloPantalla
        titulo="Mensajes"
        subtitulo="Deslizá un chat: derecha lo marca leído, izquierda lo elimina."
      />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.three, paddingBottom: 100 }}
        data={filas}
        keyExtractor={(f) => f.id}
        onRefresh={cargar}
        refreshing={false}
        ListEmptyComponent={
          <View style={styles.centro}>
            <Text style={styles.vacioTitulo}>Todavía no tenés conversaciones</Text>
            <Text style={styles.vacioTexto}>
              Cuando reservés un lugar o pidás una cotización, el chat con el
              proveedor aparece acá.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <FilaChat
            fila={item}
            onAbrir={() => router.push(item.href as never)}
            onLeido={() => marcarLeido(item)}
            onEliminar={() => eliminarChat(item)}
          />
        )}
      />
    </View>
  );
}

function FilaChat({
  fila,
  onAbrir,
  onLeido,
  onEliminar,
}: {
  fila: Fila;
  onAbrir: () => void;
  onLeido: () => void;
  onEliminar: () => void;
}) {
  const swipeRef = useRef<SwipeableMethods | null>(null);
  const nuevo = fila.pendientes > 0;

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={56}
      rightThreshold={56}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={styles.swipeContenedor}
      renderLeftActions={() => (
        <View style={[styles.accion, styles.accionLeido]}>
          <Ionicons name="checkmark-done" size={22} color="#ffffff" />
          <Text style={styles.accionTexto}>Leído</Text>
        </View>
      )}
      renderRightActions={() => (
        <View style={[styles.accion, styles.accionEliminar]}>
          <Ionicons name="trash-outline" size={22} color="#ffffff" />
          <Text style={styles.accionTexto}>Eliminar</Text>
        </View>
      )}
      onSwipeableOpen={(direccion) => {
        if (direccion === SwipeDirection.LEFT) {
          onLeido();
          swipeRef.current?.close();
        } else {
          onEliminar();
        }
      }}
    >
      <Pressable style={[styles.fila, nuevo && styles.filaNoLeida]} onPress={onAbrir}>
        {fila.foto ? (
          <Image source={{ uri: fila.foto }} alt="" style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: Colors.cream2 }]} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.titulo} numberOfLines={1}>
            {fila.titulo}
          </Text>
          {!!fila.subtitulo && (
            <Text style={styles.subtitulo} numberOfLines={1}>
              {fila.subtitulo}
            </Text>
          )}
          <Text
            style={[styles.preview, nuevo && styles.previewNoLeido]}
            numberOfLines={1}
          >
            {fila.ultimoTexto}
          </Text>
          <View style={styles.tagsFila}>
            <View style={[styles.tag, { backgroundColor: fila.tag.fondo }]}>
              <Text style={[styles.tagTexto, { color: fila.tag.color }]}>
                {fila.tag.texto}
              </Text>
            </View>
            {nuevo && (
              <View style={[styles.tag, { backgroundColor: Colors.green }]}>
                <Text style={[styles.tagTexto, { color: "#ffffff" }]}>
                  {fila.pendientes === 1
                    ? "1 mensaje nuevo"
                    : `${fila.pendientes} mensajes nuevos`}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.colDerecha}>
          <View style={[styles.chipFecha, nuevo && styles.chipFechaNueva]}>
            <Text style={[styles.chipFechaTexto, nuevo && styles.chipTextoBlanco]}>
              {fechaCorta(fila.actividad)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.five,
    gap: Spacing.one,
  },
  vacioTitulo: { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.ink },
  vacioTexto: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: "center",
    maxWidth: 280,
  },
  boton: {
    marginTop: Spacing.two,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
  },
  botonTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 13.5 },
  swipeContenedor: { marginBottom: Spacing.two },
  accion: {
    width: 96,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  accionLeido: { backgroundColor: Colors.navy, marginRight: Spacing.two },
  accionEliminar: { backgroundColor: Colors.danger, marginLeft: Spacing.two },
  accionTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 11 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 16,
    padding: Spacing.two,
  },
  filaNoLeida: { backgroundColor: Colors.greenLight, borderColor: Colors.green },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  titulo: { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.ink },
  subtitulo: { fontFamily: Fonts.medium, fontSize: 11.5, color: Colors.inkSoft },
  preview: { marginTop: 2, fontFamily: Fonts.medium, fontSize: 12.5, color: Colors.inkSoft },
  previewNoLeido: { fontFamily: Fonts.bold, color: Colors.ink },
  tagsFila: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagTexto: { fontFamily: Fonts.bold, fontSize: 10 },
  colDerecha: { alignItems: "flex-end", gap: 5 },
  chipFecha: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipFechaNueva: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipFechaTexto: { fontFamily: Fonts.bold, fontSize: 10.5, color: Colors.inkSoft },
  chipTextoBlanco: { fontFamily: Fonts.bold, fontSize: 10.5, color: "#ffffff" },
});
