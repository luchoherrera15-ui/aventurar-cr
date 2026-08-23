import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Sombras, Tipo } from "@/constants/theme";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { useAuth } from "@/lib/auth-context";
import { cargarMisReservas, type FilaMisReserva } from "@/lib/food-datos";
import { fechaCorta, horaCorta } from "@/lib/food-tipos";
import { cancelarReserva } from "@/lib/food-acciones";

type PestanaLista = "proximas" | "pasadas" | "canceladas";

const ESTADO_LABEL: Record<FilaMisReserva["estado"], string> = {
  confirmada: "Confirmada",
  check_in: "Ya fuiste",
  no_show: "No te presentaste",
  cancelada: "Cancelada",
};

/**
 * Mis Reservas — mismo criterio de tres pestañas que /food/mis-reservas
 * en /web (reservas-tabs.tsx): Próximas (confirmada/check_in y no
 * pasada), Pasadas (pasada o no_show) y Canceladas, aparte.
 */
export default function Reservas({ activa }: { activa: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, cargando } = useAuth();
  const [reservas, setReservas] = useState<FilaMisReserva[] | null>(null);
  const [pestana, setPestana] = useState<PestanaLista>("proximas");
  const [cancelando, setCancelando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!session) return;
    let vigente = true;
    cargarMisReservas(session.user.id).then((r) => {
      if (vigente) setReservas(r);
    });
    return () => {
      vigente = false;
    };
  }, [session]);

  useFocusEffect(cargar);
  useEffect(() => {
    if (activa) cargar();
  }, [activa, cargar]);

  async function tocarCancelar(reserva: FilaMisReserva) {
    Alert.alert("Cancelar reserva", `¿Cancelar tu reserva en ${reserva.negocioNombre}?`, [
      { text: "No", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: async () => {
          setCancelando(reserva.id);
          const r = await cancelarReserva(reserva.id);
          setCancelando(null);
          if (!r.ok) {
            Alert.alert("No se pudo cancelar", r.error ?? "Intentá de nuevo.");
            return;
          }
          cargar();
        },
      },
    ]);
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.contenedor, { paddingTop: insets.top + Spacing.three }]}>
        <View style={styles.vacio}>
          <Ionicons name="calendar-outline" size={30} color={Colors.inkMuted} />
          <Text style={Tipo.titulo2}>Iniciá sesión</Text>
          <Text style={styles.vacioTexto}>Entrá a tu cuenta para ver tus reservas.</Text>
          <Pressable style={styles.botonPrimario} onPress={() => router.push("/?tab=perfil")}>
            <Text style={styles.botonPrimarioTexto}>Ir a mi perfil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const proximas = (reservas ?? []).filter(
    (r) => (r.estado === "confirmada" || r.estado === "check_in") && !r.pasada,
  );
  const pasadas = (reservas ?? []).filter(
    (r) => r.estado !== "cancelada" && (r.pasada || r.estado === "no_show"),
  );
  const canceladas = (reservas ?? []).filter((r) => r.estado === "cancelada");

  const lista = pestana === "proximas" ? proximas : pestana === "pasadas" ? pasadas : canceladas;

  return (
    <View style={[styles.contenedor, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.encabezado}>
        <Text style={Tipo.titulo1}>Mis reservas</Text>
        <View style={styles.tabs}>
          <TabBoton label={`Próximas (${proximas.length})`} activa={pestana === "proximas"} onPress={() => setPestana("proximas")} />
          <TabBoton label={`Pasadas (${pasadas.length})`} activa={pestana === "pasadas"} onPress={() => setPestana("pasadas")} />
          <TabBoton label={`Canceladas (${canceladas.length})`} activa={pestana === "canceladas"} onPress={() => setPestana("canceladas")} />
        </View>
      </View>

      {reservas === null ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.five }} />
      ) : lista.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="calendar-outline" size={26} color={Colors.inkMuted} />
          <Text style={styles.vacioTexto}>
            {pestana === "proximas"
              ? "Todavía no tenés reservas próximas."
              : pestana === "pasadas"
                ? "Acá vas a ver tus reservas pasadas."
                : "No tenés reservas canceladas."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.four, paddingTop: 0, gap: Spacing.three, paddingBottom: TAB_BAR_ESPACIO }}>
          {lista.map((r) => (
            <Pressable key={r.id} onPress={() => router.push(`/reserva/${r.id}`)} style={styles.tarjeta}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.nombre} numberOfLines={1}>{r.negocioNombre}</Text>
                <Text style={styles.meta}>
                  {r.fecha ? fechaCorta(r.fecha) : "Sin fecha"}
                  {r.hora ? ` · ${horaCorta(r.hora)}` : ""} · {r.partySize} {r.partySize === 1 ? "persona" : "personas"}
                </Text>
                <Text style={styles.codigo}>Código {r.codigoConfirmacion}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: Spacing.two }}>
                <View style={[styles.pildora, ESTILO_ESTADO[r.estado]]}>
                  <Text style={[styles.pildoraTexto, ESTILO_TEXTO_ESTADO[r.estado]]}>{ESTADO_LABEL[r.estado]}</Text>
                </View>
                {(r.estado === "confirmada" || r.estado === "check_in") && !r.pasada && (
                  <Pressable
                    onPress={() => tocarCancelar(r)}
                    disabled={cancelando === r.id}
                    hitSlop={8}
                  >
                    {cancelando === r.id ? (
                      <ActivityIndicator size="small" color={Colors.danger} />
                    ) : (
                      <Text style={styles.cancelar}>Cancelar</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function TabBoton({ label, activa, onPress }: { label: string; activa: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, activa && styles.tabActiva]}>
      <Text style={[styles.tabTexto, activa && styles.tabTextoActivo]}>{label}</Text>
    </Pressable>
  );
}

const ESTILO_ESTADO = StyleSheet.create({
  confirmada: { backgroundColor: Colors.greenLight },
  check_in: { backgroundColor: Colors.accentLight },
  no_show: { backgroundColor: Colors.dangerLight },
  cancelada: { backgroundColor: Colors.cream2 },
});
const ESTILO_TEXTO_ESTADO = StyleSheet.create({
  confirmada: { color: Colors.green },
  check_in: { color: Colors.accentDark },
  no_show: { color: Colors.danger },
  cancelada: { color: Colors.inkSoft },
});

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.canvas },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  encabezado: { paddingHorizontal: Spacing.four, marginBottom: Spacing.three },
  tabs: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.three },
  tab: {
    flex: 1,
    alignItems: "center",
    borderRadius: Radios.full,
    paddingVertical: 9,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  tabActiva: { backgroundColor: Colors.navy, borderColor: "transparent" },
  tabTexto: { fontFamily: Fonts.bold, fontSize: 11.5, color: Colors.ink },
  tabTextoActivo: { color: "#fff" },
  vacio: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.two, paddingHorizontal: Spacing.five },
  vacioTexto: { ...Tipo.cuerpo, textAlign: "center" },
  botonPrimario: { marginTop: Spacing.two, backgroundColor: Colors.navy, borderRadius: Radios.lg, paddingHorizontal: Spacing.four, paddingVertical: 12 },
  botonPrimarioTexto: { color: "#fff", fontFamily: Fonts.bold, fontSize: 14 },
  tarjeta: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.three,
    backgroundColor: Colors.surface,
    borderRadius: Radios.lg,
    padding: Spacing.three,
    ...Sombras.tarjeta,
  },
  nombre: { fontFamily: Fonts.extraBold, fontSize: 15.5, color: Colors.ink },
  meta: { marginTop: 3, fontFamily: Fonts.medium, fontSize: 12.5, color: Colors.inkSoft },
  codigo: { marginTop: 6, fontFamily: Fonts.bold, fontSize: 11.5, color: Colors.inkMuted, letterSpacing: 0.5 },
  pildora: { borderRadius: Radios.full, paddingHorizontal: 10, paddingVertical: 5 },
  pildoraTexto: { fontFamily: Fonts.extraBold, fontSize: 11 },
  cancelar: { color: Colors.danger, fontFamily: Fonts.bold, fontSize: 12 },
});
