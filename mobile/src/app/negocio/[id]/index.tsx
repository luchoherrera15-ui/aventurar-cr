import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";

/**
 * Administración de un negocio propio: todas sus reservas con las
 * acciones del panel web — confirmar (una sola por fecha; la base lo
 * garantiza), rechazar, marcar el depósito como validado y abrir el
 * comprobante. Mismas políticas RLS que /mi-rancho: el dueño solo ve
 * y edita lo suyo.
 */

type ReservaNegocio = {
  id: string;
  fecha: string;
  nombre: string | null;
  correo: string | null;
  whatsapp: string | null;
  tipo_evento: string | null;
  invitados: number | null;
  estado: "pendiente" | "confirmada" | "rechazada" | "bloqueada";
  horario_bloque: string | null;
  monto_total: number | null;
  deposito_monto: number | null;
  deposito_comprobante_url: string | null;
  deposito_validado: boolean;
  notas: string | null;
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "En aprobación",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
  bloqueada: "Bloqueada",
};
const ESTADO_COLOR: Record<string, string> = {
  pendiente: Colors.accent,
  confirmada: Colors.green,
  rechazada: Colors.danger,
  bloqueada: Colors.inkSoft,
};

const FILTROS = ["todas", "pendiente", "confirmada", "rechazada"] as const;

export default function AdminNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [nombreNegocio, setNombreNegocio] = useState<string | null>(null);
  const [reservas, setReservas] = useState<ReservaNegocio[] | null>(null);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("todas");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!session) return;
    const [{ data: rancho }, { data: reservasData }] = await Promise.all([
      supabase.from("ranchos").select("nombre").eq("id", id).maybeSingle(),
      supabase
        .from("reservas")
        .select(
          "id, fecha, nombre, correo, whatsapp, tipo_evento, invitados, estado, horario_bloque, monto_total, deposito_monto, deposito_comprobante_url, deposito_validado, notas",
        )
        .eq("rancho_id", id)
        .neq("estado", "temporal")
        .order("fecha", { ascending: true }),
    ]);
    setNombreNegocio(rancho?.nombre ?? null);
    setReservas((reservasData ?? []) as ReservaNegocio[]);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function cambiarEstado(reserva: ReservaNegocio, estado: "confirmada" | "rechazada") {
    setOcupado(reserva.id);
    const { error } = await supabase
      .from("reservas")
      .update({ estado })
      .eq("id", reserva.id);
    setOcupado(null);

    if (error) {
      Alert.alert(
        "No se pudo",
        estado === "confirmada"
          ? "Ya hay otra reserva confirmada para esa misma fecha."
          : error.message,
      );
      return;
    }
    setReservas((prev) =>
      (prev ?? []).map((r) => (r.id === reserva.id ? { ...r, estado } : r)),
    );
  }

  async function alternarDeposito(reserva: ReservaNegocio) {
    const nuevo = !reserva.deposito_validado;
    setReservas((prev) =>
      (prev ?? []).map((r) => (r.id === reserva.id ? { ...r, deposito_validado: nuevo } : r)),
    );
    const { error } = await supabase
      .from("reservas")
      .update({ deposito_validado: nuevo })
      .eq("id", reserva.id);
    if (error) {
      setReservas((prev) =>
        (prev ?? []).map((r) => (r.id === reserva.id ? { ...r, deposito_validado: !nuevo } : r)),
      );
    }
  }

  async function verComprobante(path: string) {
    const { data, error } = await supabase.storage
      .from("comprobantes")
      .createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      Alert.alert("No se pudo abrir", "El comprobante no está disponible.");
      return;
    }
    WebBrowser.openBrowserAsync(data.signedUrl);
  }

  const lista = (reservas ?? []).filter((r) => filtro === "todas" || r.estado === filtro);

  if (reservas === null) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo={nombreNegocio ?? "Reservas"} />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        titulo={nombreNegocio ?? "Reservas"}
        subtitulo="Reservas de este negocio"
        accion={{
          icono: "create-outline",
          etiqueta: "Editar negocio",
          onPress: () => router.push(`/negocio/${id}/editar` as never),
        }}
      />
      <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: Spacing.three, paddingBottom: 40, gap: Spacing.two }}
      data={lista}
      keyExtractor={(r) => r.id}
      onRefresh={cargar}
      refreshing={false}
      ListHeaderComponent={
        <View style={styles.filtros}>
          {FILTROS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFiltro(f)}
              style={[styles.filtroChip, filtro === f && styles.filtroChipActivo]}
            >
              <Text style={[styles.filtroTexto, filtro === f && styles.filtroTextoActivo]}>
                {f === "todas" ? "Todas" : ESTADO_LABEL[f]}
              </Text>
            </Pressable>
          ))}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>Sin reservas por aquí</Text>
          <Text style={styles.vacioTexto}>
            Cuando alguien reserve tu {""}servicio, aparece acá para que la
            revisés y la confirmés.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.tarjeta}>
          <View style={styles.filaSuperior}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fecha}>
                {item.fecha}
                {item.horario_bloque ? ` · ${item.horario_bloque}` : ""}
              </Text>
              <Text style={styles.cliente} numberOfLines={1}>
                {item.nombre ?? "Sin nombre"}
                {item.tipo_evento ? ` — ${item.tipo_evento}` : ""}
              </Text>
              <Text style={styles.detalle}>
                {item.invitados ? `${item.invitados} invitados · ` : ""}
                {item.monto_total ? `Total ${fmtColones(item.monto_total)}` : "Monto a coordinar"}
              </Text>
              {(item.correo || item.whatsapp) && (
                <Text style={styles.detalle} numberOfLines={1}>
                  {[item.correo, item.whatsapp].filter(Boolean).join(" · ")}
                </Text>
              )}
              {item.notas ? (
                <Text style={styles.notas} numberOfLines={2}>
                  “{item.notas}”
                </Text>
              ) : null}
            </View>
            <View style={[styles.badge, { backgroundColor: ESTADO_COLOR[item.estado] }]}>
              <Text style={styles.badgeTexto}>{ESTADO_LABEL[item.estado]}</Text>
            </View>
          </View>

          {/* Depósito: cuánto era, si ya se validó, y el comprobante */}
          <View style={styles.filaDeposito}>
            <Pressable style={styles.depositoCheck} onPress={() => alternarDeposito(item)}>
              <Ionicons
                name={item.deposito_validado ? "checkbox" : "square-outline"}
                size={20}
                color={item.deposito_validado ? Colors.green : Colors.inkSoft}
              />
              <Text style={styles.depositoTexto}>
                Depósito {item.deposito_monto ? fmtColones(item.deposito_monto) : ""} validado
              </Text>
            </Pressable>
            {item.deposito_comprobante_url && (
              <Pressable onPress={() => verComprobante(item.deposito_comprobante_url!)}>
                <Text style={styles.verComprobante}>Ver comprobante</Text>
              </Pressable>
            )}
          </View>

          {item.estado === "pendiente" && (
            <View style={styles.acciones}>
              <Pressable
                style={[styles.botonAccion, styles.botonConfirmar, ocupado === item.id && { opacity: 0.5 }]}
                disabled={ocupado === item.id}
                onPress={() => cambiarEstado(item, "confirmada")}
              >
                <Ionicons name="checkmark" size={16} color="#ffffff" />
                <Text style={styles.botonAccionTexto}>Confirmar</Text>
              </Pressable>
              <Pressable
                style={[styles.botonAccion, styles.botonRechazar, ocupado === item.id && { opacity: 0.5 }]}
                disabled={ocupado === item.id}
                onPress={() =>
                  Alert.alert("Rechazar reserva", "¿Seguro? El cliente verá su reserva como rechazada.", [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Rechazar", style: "destructive", onPress: () => cambiarEstado(item, "rechazada") },
                  ])
                }
              >
                <Ionicons name="close" size={16} color={Colors.danger} />
                <Text style={[styles.botonAccionTexto, { color: Colors.danger }]}>Rechazar</Text>
              </Pressable>
            </View>
          )}
          {item.estado === "confirmada" && (
            <Pressable
              style={styles.deshacer}
              onPress={() =>
                Alert.alert("Quitar confirmación", "La reserva vuelve a quedar en aprobación.", [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Quitar",
                    onPress: async () => {
                      const { error } = await supabase
                        .from("reservas")
                        .update({ estado: "pendiente" })
                        .eq("id", item.id);
                      if (!error) {
                        setReservas((prev) =>
                          (prev ?? []).map((r) =>
                            r.id === item.id ? { ...r, estado: "pendiente" } : r,
                          ),
                        );
                      }
                    },
                  },
                ])
              }
            >
              <Text style={styles.deshacerTexto}>Quitar confirmación</Text>
            </Pressable>
          )}
        </View>
      )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five, gap: Spacing.two },
  vacioTitulo: { fontSize: 16, fontFamily: Fonts.extraBold, color: Colors.ink, textAlign: "center" },
  vacioTexto: { fontSize: 13, color: Colors.inkSoft, textAlign: "center", lineHeight: 19, maxWidth: 300 },
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, marginBottom: Spacing.two },
  filtroChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.cream2,
  },
  filtroChipActivo: { backgroundColor: Colors.navy },
  filtroTexto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.inkSoft },
  filtroTextoActivo: { color: "#ffffff" },
  tarjeta: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  filaSuperior: { flexDirection: "row", gap: Spacing.two },
  fecha: { fontSize: 13, fontFamily: Fonts.extraBold, color: Colors.navy },
  cliente: { fontSize: 14.5, fontFamily: Fonts.extraBold, color: Colors.ink, marginTop: 2 },
  detalle: { fontSize: 12.5, color: Colors.inkSoft, marginTop: 1 },
  notas: { fontSize: 12.5, color: Colors.ink, marginTop: 4, fontFamily: Fonts.medium },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeTexto: { color: "#ffffff", fontSize: 10, fontFamily: Fonts.bold },
  filaDeposito: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingTop: Spacing.two,
  },
  depositoCheck: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  depositoTexto: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.ink, flexShrink: 1 },
  verComprobante: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.navy, textDecorationLine: "underline" },
  acciones: { flexDirection: "row", gap: Spacing.two },
  botonAccion: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 11,
  },
  botonConfirmar: { backgroundColor: Colors.green },
  botonRechazar: { backgroundColor: Colors.dangerLight },
  botonAccionTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 13 },
  deshacer: { alignItems: "center", paddingVertical: 4 },
  deshacerTexto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.inkSoft, textDecorationLine: "underline" },
});
