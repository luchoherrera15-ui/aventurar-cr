import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import TituloPantalla from "@/components/titulo-pantalla";
import { CATEGORIA_LABEL, fmtColones, type Categoria } from "@/lib/types";

/**
 * Pestaña de reservas, espejo de los "viajes" de Airbnb: lo que viene
 * (pendiente o confirmado) arriba, y el historial abajo. La lista se
 * recarga cada vez que la pestaña gana foco porque los estados cambian
 * del lado del proveedor.
 */

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

export default function ReservasScreen() {
  const router = useRouter();
  const { session, cargando } = useAuth();
  const [reservas, setReservas] = useState<ReservaCliente[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let vigente = true;
      supabase
        .from("reservas")
        .select(
          "id, fecha, estado, monto_total, horario_bloque, ranchos(nombre, foto_url, categoria)",
        )
        .eq("cliente_id", session.user.id)
        .in("estado", ["pendiente", "confirmada", "rechazada"])
        .order("fecha", { ascending: false })
        .then(({ data }) => {
          if (vigente) setReservas((data ?? []) as unknown as ReservaCliente[]);
        });
      return () => {
        vigente = false;
      };
    }, [session]),
  );

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.raiz}>
        <TituloPantalla titulo="Reservas" />
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>Iniciá sesión</Text>
          <Text style={styles.vacioTexto}>
            Entrá a tu cuenta para ver tus reservas activas y tu historial.
          </Text>
          <Pressable style={styles.boton} onPress={() => router.replace("/cuenta")}>
            <Text style={styles.botonTexto}>Ir a mi perfil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const activas = (reservas ?? []).filter(
    (r) => r.estado !== "rechazada" && r.fecha >= hoy,
  );
  const historial = (reservas ?? []).filter(
    (r) => r.estado === "rechazada" || r.fecha < hoy,
  );

  return (
    <View style={styles.raiz}>
      <TituloPantalla
        titulo="Reservas"
        subtitulo="Lo que tenés en curso y lo que ya pasó."
      />
      {reservas === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : reservas.length === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>Todavía no tenés reservas</Text>
          <Text style={styles.vacioTexto}>
            Cuando reservés un lugar o servicio para tu evento, lo vas a ver
            acá con su estado.
          </Text>
          <Pressable style={styles.boton} onPress={() => router.replace("/")}>
            <Text style={styles.botonTexto}>Explorar proveedores</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          <Seccion titulo="En curso" vacio="Nada en curso por ahora.">
            {activas.map((r) => (
              <TarjetaReserva key={r.id} reserva={r} />
            ))}
          </Seccion>
          <Seccion titulo="Historial" vacio="Acá vas a ver tus reservas pasadas.">
            {historial.map((r) => (
              <TarjetaReserva key={r.id} reserva={r} atenuada />
            ))}
          </Seccion>
        </ScrollView>
      )}
    </View>
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
        <Text style={styles.botonMensajesTexto}>Mensajes de esta reserva</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five, gap: Spacing.two },
  lista: { padding: Spacing.three, gap: Spacing.four, paddingBottom: 100 },
  vacioTitulo: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink, textAlign: "center" },
  vacioTexto: { fontSize: 13.5, color: Colors.inkSoft, textAlign: "center", lineHeight: 19 },
  boton: {
    marginTop: Spacing.two,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
  },
  botonTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 13.5 },
  bloque: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.line,
    gap: Spacing.three,
  },
  bloqueTitulo: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink },
  hint: { fontSize: 13, color: Colors.inkSoft },
  tarjetaReserva: {
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 12,
    backgroundColor: Colors.cream,
  },
  tarjetaAtenuada: { opacity: 0.7 },
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
  badgeEstado: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  badgeEstadoTexto: { color: "#ffffff", fontSize: 10.5, fontFamily: Fonts.bold },
  botonMensajes: {
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    width: "100%",
  },
  botonMensajesTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5, paddingTop: 8 },
});
