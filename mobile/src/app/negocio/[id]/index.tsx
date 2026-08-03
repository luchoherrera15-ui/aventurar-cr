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
import {
  Boton,
  ChipCategoria,
  Estado,
  Micro,
  Tarjeta,
  Vacio,
  type TonoEstado,
} from "@/components/ui";
import { pedirCorreoDeAprobacion } from "@/lib/notificaciones";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";

/**
 * Administración de un negocio propio: todas sus reservas con las
 * acciones del panel web — confirmar (una sola por fecha; la base lo
 * garantiza), rechazar, marcar el depósito como validado y abrir el
 * comprobante. Mismas políticas RLS que /mi-negocio: el dueño solo ve
 * y edita lo suyo.
 */

type ReservaNegocio = {
  id: string;
  fecha: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  duracion_minutos: number | null;
  nombre: string | null;
  correo: string | null;
  whatsapp: string | null;
  tipo_evento: string | null;
  invitados: number | null;
  estado:
    | "pendiente"
    | "confirmada"
    | "rechazada"
    | "bloqueada"
    // Estados de citas (0061): la asistencia que marca el negocio.
    | "cumplida"
    | "no_asistio"
    | "cancelada";
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
  cumplida: "Cumplida",
  no_asistio: "No asistió",
  cancelada: "Cancelada",
};
/** El mismo código de color que la agenda y las reservas del cliente. */
const ESTADO_TONO: Record<string, TonoEstado> = {
  pendiente: "naranja",
  confirmada: "verde",
  rechazada: "rojo",
  bloqueada: "gris",
  cumplida: "verde",
  no_asistio: "rojo",
  cancelada: "gris",
};

/** La barra de acento a la izquierda de cada reserva. */
const ESTADO_BARRA: Record<string, string> = {
  pendiente: Colors.accent,
  confirmada: Colors.green,
  rechazada: Colors.danger,
  bloqueada: Colors.line,
  cumplida: Colors.green,
  no_asistio: Colors.danger,
  cancelada: Colors.line,
};

/** "10:00" o "10:00–10:45" si se sabe cuánto dura. */
function rangoHora(hora: string, duracionMin: number | null): string {
  const inicio = hora.slice(0, 5);
  if (!duracionMin) return inicio;
  const [h, m] = inicio.split(":").map(Number);
  const fin = h * 60 + m + duracionMin;
  const hf = String(Math.floor(fin / 60) % 24).padStart(2, "0");
  const mf = String(fin % 60).padStart(2, "0");
  return `${inicio}–${hf}:${mf}`;
}

const FILTROS = ["todas", "pendiente", "confirmada", "cumplida", "rechazada"] as const;

export default function AdminNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [nombreNegocio, setNombreNegocio] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  /** La vertical decide qué atajos tienen sentido (equipo y horario
   *  solo existen en Citas). */
  const [vertical, setVertical] = useState<string | null>(null);
  const [reservas, setReservas] = useState<ReservaNegocio[] | null>(null);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("todas");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!session) return;
    const [{ data: rancho }, { data: reservasData }] = await Promise.all([
      supabase.from("ranchos").select("nombre, categoria, vertical").eq("id", id).maybeSingle(),
      supabase
        .from("reservas")
        .select(
          "id, fecha, fecha_fin, hora_inicio, duracion_minutos, nombre, correo, whatsapp, tipo_evento, invitados, estado, horario_bloque, monto_total, deposito_monto, deposito_comprobante_url, deposito_validado, notas",
        )
        .eq("rancho_id", id)
        .neq("estado", "temporal")
        .order("fecha", { ascending: true }),
    ]);
    setNombreNegocio(rancho?.nombre ?? null);
    setCategoria((rancho?.categoria as string) ?? null);
    setVertical((rancho?.vertical as string) ?? null);
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

    // El correo lo manda la web (Resend vive en el servidor). Sin await
    // que bloquee: la aprobación ya quedó guardada, así que si esto
    // falla el proveedor igual ve la reserva confirmada.
    if (estado === "confirmada") {
      void pedirCorreoDeAprobacion(reserva.id);
    }
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
        <BarraSuperior kicker="Panel" titulo="Panel de reservas" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  const pendientes = (reservas ?? []).filter((r) => r.estado === "pendiente").length;

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        kicker="Panel"
        titulo="Panel de reservas"
        subtitulo={nombreNegocio ?? undefined}
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
        <View style={styles.cabecera}>
          {/* Administración del negocio, todo desde la app: la agenda,
              la página, el catálogo reservable y los cobros. */}
          <View style={{ gap: Spacing.two }}>
            <Micro>Tu negocio</Micro>
            <View style={styles.adminFila}>
              {/* La agenda por horas: el día a día del negocio de citas
                  y el feed para sincronizar Google/Apple Calendar. */}
              <AtajoPanel
                icono="calendar-outline"
                texto="Agenda"
                onPress={() => router.push(`/negocio/${id}/agenda` as never)}
              />
              {/* Importar el calendario viejo (Google/Apple) como bloqueos. */}
              <AtajoPanel
                icono="sync-outline"
                texto="Sincronizar"
                onPress={() => router.push(`/negocio/${id}/sincronizar` as never)}
              />
              <AtajoPanel
                icono="create-outline"
                texto="Editar página"
                onPress={() => router.push(`/negocio/${id}/editar` as never)}
              />
              {categoria && categoria !== "lugares" && (
                <AtajoPanel
                  icono="list-outline"
                  texto="Catálogo"
                  onPress={() => router.push(`/negocio/${id}/catalogo` as never)}
                />
              )}
              <AtajoPanel
                icono="wallet-outline"
                texto="Cobros y tarifas"
                onPress={() => router.push(`/negocio/${id}/cobros` as never)}
              />
              {/* Rangos por invitados, extras y descuentos. */}
              <AtajoPanel
                icono="pricetags-outline"
                texto="Precios"
                onPress={() => router.push(`/negocio/${id}/precios` as never)}
              />
              {/* Lo que entró, lo que falta cobrar y los gastos. */}
              <AtajoPanel
                icono="trending-up-outline"
                texto="Finanzas"
                onPress={() => router.push(`/negocio/${id}/finanzas` as never)}
              />
              {/* Equipo, horario y giftcards — solo la vertical de citas. */}
              {vertical === "citas" && (
                <>
                  <AtajoPanel
                    icono="people-outline"
                    texto="Equipo y horario"
                    onPress={() => router.push(`/negocio/${id}/citas` as never)}
                  />
                  {/* El CRM: quién viene, quién falta y las promos. */}
                  <AtajoPanel
                    icono="people-outline"
                    texto="Clientes"
                    onPress={() => router.push(`/negocio/${id}/clientes` as never)}
                  />
                </>
              )}
            </View>
          </View>

          <View style={{ gap: Spacing.two }}>
            <Micro>
              {pendientes > 0
                ? `${pendientes} ${pendientes === 1 ? "espera" : "esperan"} tu aprobación`
                : "Todo al día"}
            </Micro>
            <View style={styles.filtros}>
              {FILTROS.map((f) => (
                <ChipCategoria
                  key={f}
                  texto={f === "todas" ? "Todas" : ESTADO_LABEL[f]}
                  activo={filtro === f}
                  onPress={() => setFiltro(f)}
                />
              ))}
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        <Vacio
          icono="calendar-clear-outline"
          titulo="Sin reservas por aquí"
          texto="Cuando alguien reserve, aparece acá para que la revisés y la confirmés."
        />
      }
      renderItem={({ item }) => (
        // La que espera aprobación se contornea en naranja: es la única
        // que pide algo del dueño, y tiene que saltar en la lista.
        <Tarjeta
          style={[
            styles.tarjeta,
            item.estado === "pendiente" && styles.tarjetaPendiente,
          ]}
        >
          {item.estado !== "pendiente" && (
            <View
              style={[
                styles.barraEstado,
                { backgroundColor: ESTADO_BARRA[item.estado] ?? Colors.line },
              ]}
            />
          )}
          <View style={styles.filaSuperior}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.fecha}>
                {item.fecha}
                {item.fecha_fin && item.fecha_fin !== item.fecha ? ` → ${item.fecha_fin}` : ""}
                {item.hora_inicio
                  ? ` · ${rangoHora(item.hora_inicio, item.duracion_minutos)}`
                  : item.horario_bloque
                    ? ` · ${item.horario_bloque}`
                    : ""}
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
            <Estado
              texto={ESTADO_LABEL[item.estado]}
              tono={ESTADO_TONO[item.estado] ?? "gris"}
            />
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

          {/* La acción del mockup: aprobar con un toque. */}
          {item.estado === "pendiente" && (
            <View style={styles.acciones}>
              <Boton
                compacto
                tono="verde"
                icono="checkmark"
                texto="Aprobar"
                deshabilitado={ocupado === item.id}
                onPress={() => cambiarEstado(item, "confirmada")}
                style={{ flex: 1 }}
              />
              {/* Secundaria en contorno, como el "Ver detalle" del
                  diseño — el verde de aprobar es lo único sólido. */}
              <Pressable
                style={({ pressed }) => [
                  styles.botonRechazar,
                  (pressed || ocupado === item.id) && { opacity: 0.6 },
                ]}
                disabled={ocupado === item.id}
                onPress={() =>
                  Alert.alert("Rechazar reserva", "¿Seguro? El cliente verá su reserva como rechazada.", [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Rechazar", style: "destructive", onPress: () => cambiarEstado(item, "rechazada") },
                  ])
                }
              >
                <Text style={styles.botonRechazarTexto}>Rechazar</Text>
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
        </Tarjeta>
      )}
      />
    </View>
  );
}

/** Un atajo del panel: ícono en burbuja + rótulo, todos del mismo alto. */
function AtajoPanel({
  icono,
  texto,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      onPress={onPress}
      style={({ pressed }) => [styles.atajo, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name={icono} size={15} color={Colors.navy} />
      <Text style={styles.atajoTexto}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  cabecera: { gap: Spacing.four, marginBottom: Spacing.two },

  adminFila: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  atajo: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  atajoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },

  filtros: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },

  tarjeta: {
    gap: Spacing.two + 2,
    overflow: "hidden",
    paddingHorizontal: Spacing.three,
    paddingLeft: Spacing.three + 4,
    paddingVertical: Spacing.three,
  },
  // La que espera aprobación se contornea en naranja, sin barra: es la
  // única que le pide algo al dueño.
  tarjetaPendiente: {
    borderColor: Colors.accent,
    borderWidth: 1.5,
    paddingLeft: Spacing.three,
  },
  barraEstado: { bottom: 0, left: 0, position: "absolute", top: 0, width: 4 },
  filaSuperior: { flexDirection: "row", gap: Spacing.two },
  fecha: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 13 },
  cliente: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    letterSpacing: -0.2,
    marginTop: 3,
  },
  detalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5, marginTop: 2 },
  notas: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 12.5, marginTop: 5 },

  filaDeposito: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.two + 2,
  },
  depositoCheck: { alignItems: "center", flexDirection: "row", flexShrink: 1, gap: 7 },
  depositoTexto: { color: Colors.ink, flexShrink: 1, fontFamily: Fonts.semiBold, fontSize: 12.5 },
  verComprobante: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 12.5 },

  acciones: { flexDirection: "row", gap: Spacing.two },
  botonRechazar: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 13,
  },
  botonRechazarTexto: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 13.5 },
  deshacer: { alignItems: "center", paddingVertical: 4 },
  deshacerTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    textDecorationLine: "underline",
  },
});
