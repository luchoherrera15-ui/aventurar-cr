import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Sombras, Tipo } from "@/constants/theme";
import { cargarReserva, type DetalleReserva } from "@/lib/food-datos";
import { fechaCorta, horaCorta } from "@/lib/food-tipos";
import { cancelarReserva } from "@/lib/food-acciones";

const ESTADO_LABEL: Record<DetalleReserva["estado"], string> = {
  confirmada: "Confirmada",
  check_in: "Ya hiciste check-in",
  no_show: "No te presentaste",
  cancelada: "Cancelada",
};

/**
 * La confirmación — lo que el cliente muestra al mesero para el
 * check-in. Espejo de /food/reserva/[id] en /web: mismo código de 6
 * caracteres, ahora también como QR (no hay cámara del lado del
 * negocio todavía, así que esto es una forma más de mostrar el mismo
 * código, no algo "escaneable" hoy).
 */
export default function ConfirmacionReserva() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reserva, setReserva] = useState<DetalleReserva | null>(null);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const cargar = useCallback(() => {
    if (!id) return;
    let vigente = true;
    cargarReserva(id).then((r) => {
      if (!vigente) return;
      if (!r) setNoEncontrada(true);
      else setReserva(r);
    });
    return () => {
      vigente = false;
    };
  }, [id]);

  useEffect(cargar, [cargar]);
  useFocusEffect(cargar);

  function tocarCancelar() {
    if (!reserva) return;
    Alert.alert("Cancelar reserva", `¿Cancelar tu reserva en ${reserva.negocioNombre}?`, [
      { text: "No", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: async () => {
          setCancelando(true);
          const r = await cancelarReserva(reserva.id);
          setCancelando(false);
          if (!r.ok) {
            Alert.alert("No se pudo cancelar", r.error ?? "Intentá de nuevo.");
            return;
          }
          cargar();
        },
      },
    ]);
  }

  if (noEncontrada) {
    return (
      <View style={[styles.centro, { paddingTop: insets.top }]}>
        <Text style={Tipo.titulo2}>No encontramos esa reserva.</Text>
        <Pressable onPress={() => router.replace("/?tab=reservas")} style={{ marginTop: Spacing.three }}>
          <Text style={styles.enlace}>Ver mis reservas</Text>
        </Pressable>
      </View>
    );
  }

  if (!reserva) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const puedeCancelar = reserva.estado === "confirmada";

  return (
    <ScrollView
      style={{ backgroundColor: Colors.canvas }}
      contentContainerStyle={{ padding: Spacing.four, paddingTop: insets.top + Spacing.four, alignItems: "center", gap: Spacing.two }}
    >
      <Text style={styles.marca}>FOOD.BOOKEA</Text>
      <Text style={[Tipo.titulo1, { textAlign: "center" }]}>¡Reserva confirmada!</Text>
      <Text style={styles.subtitulo}>{reserva.negocioNombre}</Text>

      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Código de confirmación</Text>
        <Text style={styles.codigo}>{reserva.codigoConfirmacion}</Text>

        <View style={styles.qr}>
          <QRCode value={reserva.codigoConfirmacion} size={132} color={Colors.navy} backgroundColor="#ffffff" />
        </View>

        <View style={styles.grilla}>
          {reserva.fecha && (
            <View style={styles.celda}>
              <Text style={styles.celdaEtiqueta}>Fecha</Text>
              <Text style={styles.celdaValor}>{fechaCorta(reserva.fecha)}</Text>
            </View>
          )}
          {reserva.hora && (
            <View style={styles.celda}>
              <Text style={styles.celdaEtiqueta}>Hora</Text>
              <Text style={styles.celdaValor}>{horaCorta(reserva.hora)}</Text>
            </View>
          )}
          <View style={styles.celda}>
            <Text style={styles.celdaEtiqueta}>Personas</Text>
            <Text style={styles.celdaValor}>{reserva.partySize}</Text>
          </View>
          <View style={styles.celda}>
            <Text style={styles.celdaEtiqueta}>Descuento</Text>
            <Text style={[styles.celdaValor, { color: Colors.accentDark }]}>{reserva.descuentoPorcentaje}% OFF</Text>
          </View>
        </View>

        <View style={styles.estadoBanda}>
          <Text style={styles.estadoTexto}>Estado: {ESTADO_LABEL[reserva.estado]}</Text>
        </View>

        {reserva.negocioTelefono && (
          <Pressable onPress={() => Linking.openURL(`tel:${reserva.negocioTelefono}`)} style={styles.filaTelefono}>
            <Ionicons name="call-outline" size={14} color={Colors.navy} />
            <Text style={styles.telefonoTexto}>¿No podés venir? Llamá al {reserva.negocioTelefono}</Text>
          </Pressable>
        )}

        {puedeCancelar && (
          <Pressable onPress={tocarCancelar} disabled={cancelando} style={styles.botonCancelar}>
            {cancelando ? <ActivityIndicator color={Colors.danger} /> : <Text style={styles.botonCancelarTexto}>Cancelar reserva</Text>}
          </Pressable>
        )}
      </View>

      <Text style={styles.pie}>Mostrá este código en el restaurante al llegar.</Text>

      <View style={styles.filaEnlaces}>
        <Pressable onPress={() => router.replace("/")}>
          <Text style={styles.enlace}>← Volver a FOOD.BOOKEA</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/?tab=reservas")}>
          <Text style={styles.enlace}>Ver todas mis reservas</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.two },
  marca: { color: Colors.accent, fontFamily: Fonts.extraBold, fontSize: 11, letterSpacing: 1.8, textTransform: "uppercase" },
  subtitulo: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 14 },
  tarjeta: {
    width: "100%",
    marginTop: Spacing.three,
    backgroundColor: Colors.surface,
    borderRadius: Radios.xl,
    padding: Spacing.five,
    alignItems: "center",
    ...Sombras.elevada,
  },
  etiqueta: { color: Colors.inkSoft, fontFamily: Fonts.extraBold, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" },
  codigo: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 34, letterSpacing: 3, marginTop: 4 },
  qr: { marginTop: Spacing.three },
  grilla: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.four, marginTop: Spacing.four, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.three, width: "100%" },
  celda: { minWidth: "40%" },
  celdaEtiqueta: { color: Colors.inkSoft, fontFamily: Fonts.extraBold, fontSize: 10.5, textTransform: "uppercase" },
  celdaValor: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14.5, marginTop: 2 },
  estadoBanda: { marginTop: Spacing.four, backgroundColor: Colors.cream2, borderRadius: Radios.md, paddingHorizontal: 12, paddingVertical: 9, width: "100%" },
  estadoTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5, textAlign: "center" },
  filaTelefono: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: Spacing.three },
  telefonoTexto: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, flexShrink: 1 },
  botonCancelar: { marginTop: Spacing.three, paddingVertical: 10 },
  botonCancelarTexto: { color: Colors.danger, fontFamily: Fonts.bold, fontSize: 13.5 },
  pie: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5, textAlign: "center", marginTop: Spacing.three },
  filaEnlaces: { flexDirection: "row", gap: Spacing.four, marginTop: Spacing.two },
  enlace: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 13 },
});
