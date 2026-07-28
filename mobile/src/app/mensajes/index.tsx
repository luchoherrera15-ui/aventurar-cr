import { useCallback, useEffect, useState } from "react";
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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";

/**
 * Bandeja de entrada tipo Airbnb: todas las conversaciones de la
 * persona (como cliente y como proveedor), ordenadas por actividad,
 * con el último mensaje y cuántos hay sin leer. Espejo de /mensajes
 * en la web.
 */

type ConversacionRow = {
  id: string;
  reserva_id: string;
  cliente_id: string;
  proveedor_id: string;
  created_at: string;
  ranchos: { nombre: string; foto_url: string | null } | null;
  reservas: { fecha: string; nombre: string | null } | null;
};

type MensajeMin = {
  conversacion_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
};

type Fila = {
  id: string;
  reservaId: string;
  titulo: string;
  subtitulo: string;
  foto: string | null;
  ultimoTexto: string;
  actividad: string;
  pendientes: number;
};

function fechaCorta(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

export default function BandejaMensajesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [filas, setFilas] = useState<Fila[] | null>(null);

  const cargar = useCallback(async () => {
    if (!session) return;
    const miId = session.user.id;

    const { data: convData } = await supabase
      .from("conversaciones")
      .select(
        "id, reserva_id, cliente_id, proveedor_id, created_at, ranchos(nombre, foto_url), reservas(fecha, nombre)",
      );

    const conversaciones = (convData ?? []) as unknown as ConversacionRow[];
    const ids = conversaciones.map((c) => c.id);

    const [{ data: mensajesData }, { data: lecturasData }] = ids.length
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
        ])
      : [{ data: [] }, { data: [] }];

    const leidoHasta = new Map<string, string>(
      ((lecturasData ?? []) as { conversacion_id: string; leido_hasta: string }[]).map(
        (l) => [l.conversacion_id, l.leido_hasta],
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
            reservaId: c.reserva_id,
            titulo: soyCliente
              ? (c.ranchos?.nombre ?? "Conversación")
              : c.reservas?.nombre || "Cliente",
            subtitulo: [
              !soyCliente ? c.ranchos?.nombre : null,
              c.reservas?.fecha ? `Evento: ${c.reservas.fecha}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
            foto: c.ranchos?.foto_url ?? null,
            ultimoTexto: ult
              ? `${ult.autor_id === miId ? "Vos: " : ""}${ult.texto}`
              : "Sin mensajes todavía — escribí el primero.",
            actividad: ult?.created_at ?? c.created_at,
            pendientes: sinLeer.get(c.id) ?? 0,
          };
        })
        .sort((a, b) => (a.actividad < b.actividad ? 1 : -1)),
    );
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  if (!session) {
    return (
      <View style={styles.centro}>
        <Text style={styles.vacioTitulo}>Iniciá sesión</Text>
        <Text style={styles.vacioTexto}>
          Entrá a tu cuenta para ver tus conversaciones.
        </Text>
        <Pressable style={styles.boton} onPress={() => router.push("/cuenta")}>
          <Text style={styles.botonTexto}>Ir a mi cuenta</Text>
        </Pressable>
      </View>
    );
  }

  if (filas === null) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.contenedor}
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
        <Pressable
          style={styles.fila}
          onPress={() => router.push(`/mensajes/${item.reservaId}`)}
        >
          {item.foto ? (
            <Image source={{ uri: item.foto }} alt="" style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: Colors.cream2 }]} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.filaTop}>
              <Text style={styles.titulo} numberOfLines={1}>
                {item.titulo}
              </Text>
              <Text style={styles.hora}>{fechaCorta(item.actividad)}</Text>
            </View>
            {!!item.subtitulo && (
              <Text style={styles.subtitulo} numberOfLines={1}>
                {item.subtitulo}
              </Text>
            )}
            <Text
              style={[styles.preview, item.pendientes > 0 && styles.previewNoLeido]}
              numberOfLines={1}
            >
              {item.ultimoTexto}
            </Text>
          </View>
          {item.pendientes > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{item.pendientes}</Text>
            </View>
          )}
        </Pressable>
      )}
    />
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
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 16,
    padding: Spacing.two,
    marginBottom: Spacing.two,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  filaTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: Spacing.two },
  titulo: { flex: 1, fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.ink },
  hora: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.inkSoft },
  subtitulo: { fontFamily: Fonts.medium, fontSize: 11.5, color: Colors.inkSoft },
  preview: { marginTop: 2, fontFamily: Fonts.medium, fontSize: 12.5, color: Colors.inkSoft },
  previewNoLeido: { fontFamily: Fonts.bold, color: Colors.ink },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 11 },
});
