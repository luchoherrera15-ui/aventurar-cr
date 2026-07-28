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
  reserva_id: string | null;
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
  /** Ruta del hilo: por reserva o por conversación (consulta). */
  href: string;
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
      renderItem={({ item }) => {
        const nuevo = item.pendientes > 0;
        return (
          <Pressable
            style={[styles.fila, nuevo && styles.filaNoLeida]}
            onPress={() => router.push(item.href as never)}
          >
            {item.foto ? (
              <Image source={{ uri: item.foto }} alt="" style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: Colors.cream2 }]} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.titulo} numberOfLines={1}>
                {item.titulo}
              </Text>
              {!!item.subtitulo && (
                <Text style={styles.subtitulo} numberOfLines={1}>
                  {item.subtitulo}
                </Text>
              )}
              <Text
                style={[styles.preview, nuevo && styles.previewNoLeido]}
                numberOfLines={1}
              >
                {item.ultimoTexto}
              </Text>
            </View>
            <View style={styles.colDerecha}>
              <View style={[styles.chipFecha, nuevo && styles.chipFechaNueva]}>
                <Text style={[styles.chipFechaTexto, nuevo && styles.chipTextoBlanco]}>
                  {fechaCorta(item.actividad)}
                </Text>
              </View>
              {nuevo && (
                <View style={styles.chipNuevos}>
                  <Text style={styles.chipTextoBlanco}>
                    {item.pendientes} nuevo{item.pendientes === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      }}
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
  filaNoLeida: { backgroundColor: Colors.greenLight, borderColor: Colors.green },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  titulo: { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.ink },
  subtitulo: { fontFamily: Fonts.medium, fontSize: 11.5, color: Colors.inkSoft },
  preview: { marginTop: 2, fontFamily: Fonts.medium, fontSize: 12.5, color: Colors.inkSoft },
  previewNoLeido: { fontFamily: Fonts.bold, color: Colors.ink },
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
  chipNuevos: {
    borderRadius: 8,
    backgroundColor: Colors.green,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipTextoBlanco: { fontFamily: Fonts.bold, fontSize: 10.5, color: "#ffffff" },
});
