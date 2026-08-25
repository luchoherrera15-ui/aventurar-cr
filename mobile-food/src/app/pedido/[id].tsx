import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Sombras, Tipo } from "@/constants/theme";
import { cargarPedido, type DetallePedido } from "@/lib/food-datos";
import { CRC, type FoodPedidoEstado } from "@/lib/food-tipos";
import { cancelarPedido } from "@/lib/food-acciones";

const ESTADO_LABEL: Record<FoodPedidoEstado, string> = {
  pendiente: "Recibido, esperando confirmación",
  confirmado: "El restaurante lo está preparando",
  listo: "¡Listo para retirar!",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/**
 * Confirmación de pedido "To Go" (0207) — espejo de reserva/[id].tsx:
 * mismo código de 6 caracteres + QR para mostrar en el mostrador, y el
 * mismo `useFocusEffect` para que el estado se refresque solo al
 * volver a esta pantalla (sin websocket todavía, v1 simple).
 */
export default function ConfirmacionPedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pedido, setPedido] = useState<DetallePedido | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const cargar = useCallback(() => {
    if (!id) return;
    let vigente = true;
    cargarPedido(id).then((p) => {
      if (!vigente) return;
      if (!p) setNoEncontrado(true);
      else setPedido(p);
    });
    return () => {
      vigente = false;
    };
  }, [id]);

  useEffect(cargar, [cargar]);
  useFocusEffect(cargar);

  function tocarCancelar() {
    if (!pedido) return;
    Alert.alert("Cancelar pedido", `¿Cancelar tu pedido en ${pedido.negocioNombre}?`, [
      { text: "No", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: async () => {
          setCancelando(true);
          const r = await cancelarPedido(pedido.id);
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

  if (noEncontrado) {
    return (
      <View style={[styles.centro, { paddingTop: insets.top }]}>
        <Text style={Tipo.titulo2}>No encontramos ese pedido.</Text>
        <Pressable onPress={() => router.replace("/?tab=reservas")} style={{ marginTop: Spacing.three }}>
          <Text style={styles.enlace}>Ver mis pedidos</Text>
        </Pressable>
      </View>
    );
  }

  if (!pedido) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const puedeCancelar = pedido.estado === "pendiente";

  return (
    <ScrollView
      style={{ backgroundColor: Colors.canvas }}
      contentContainerStyle={{ padding: Spacing.four, paddingTop: insets.top + Spacing.four, alignItems: "center", gap: Spacing.two }}
    >
      <Text style={styles.marca}>FOOD.BOOKEA · TO GO</Text>
      <Text style={[Tipo.titulo1, { textAlign: "center" }]}>¡Pedido recibido!</Text>
      <Text style={styles.subtitulo}>{pedido.negocioNombre}</Text>

      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Código de confirmación</Text>
        <Text style={styles.codigo}>{pedido.codigoConfirmacion}</Text>

        <View style={styles.qr}>
          <QRCode value={pedido.codigoConfirmacion} size={132} color={Colors.navy} backgroundColor="#ffffff" />
        </View>

        <View style={styles.listaItems}>
          {pedido.items.map((it, i) => (
            <View key={i} style={styles.filaItem}>
              <Text style={styles.filaItemNombre} numberOfLines={1}>{it.cantidad}× {it.nombre}</Text>
              <Text style={styles.filaItemPrecio}>{CRC.format(it.subtotal)}</Text>
            </View>
          ))}
          <View style={[styles.filaItem, styles.filaTotal]}>
            <Text style={styles.filaTotalTexto}>Total a pagar al retirar</Text>
            <Text style={styles.filaTotalValor}>{CRC.format(pedido.total)}</Text>
          </View>
        </View>

        {pedido.horaRetiro && (
          <View style={styles.grilla}>
            <View style={styles.celda}>
              <Text style={styles.celdaEtiqueta}>Retiro</Text>
              <Text style={styles.celdaValor}>{pedido.horaRetiro}</Text>
            </View>
          </View>
        )}
        {pedido.notas && (
          <Text style={styles.notas}>“{pedido.notas}”</Text>
        )}

        <View style={styles.estadoBanda}>
          <Text style={styles.estadoTexto}>{ESTADO_LABEL[pedido.estado]}</Text>
        </View>

        {pedido.negocioTelefono && (
          <Pressable onPress={() => Linking.openURL(`tel:${pedido.negocioTelefono}`)} style={styles.filaTelefono}>
            <Ionicons name="call-outline" size={14} color={Colors.navy} />
            <Text style={styles.telefonoTexto}>¿Alguna duda? Llamá al {pedido.negocioTelefono}</Text>
          </Pressable>
        )}

        {puedeCancelar && (
          <Pressable onPress={tocarCancelar} disabled={cancelando} style={styles.botonCancelar}>
            {cancelando ? <ActivityIndicator color={Colors.danger} /> : <Text style={styles.botonCancelarTexto}>Cancelar pedido</Text>}
          </Pressable>
        )}
      </View>

      <Text style={styles.pie}>Mostrá este código en el restaurante al retirar. Se paga ahí mismo.</Text>

      <View style={styles.filaEnlaces}>
        <Pressable onPress={() => router.replace("/")}>
          <Text style={styles.enlace}>← Volver a FOOD.BOOKEA</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/?tab=reservas")}>
          <Text style={styles.enlace}>Ver todos mis pedidos</Text>
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
  listaItems: { width: "100%", marginTop: Spacing.four, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.three },
  filaItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.two, paddingVertical: 5 },
  filaItemNombre: { flex: 1, fontFamily: Fonts.medium, fontSize: 13, color: Colors.ink },
  filaItemPrecio: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.ink },
  filaTotal: { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.line },
  filaTotalTexto: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.inkSoft },
  filaTotalValor: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.navy },
  grilla: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.four, marginTop: Spacing.three, width: "100%" },
  celda: { minWidth: "40%" },
  celdaEtiqueta: { color: Colors.inkSoft, fontFamily: Fonts.extraBold, fontSize: 10.5, textTransform: "uppercase" },
  celdaValor: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14.5, marginTop: 2 },
  notas: { marginTop: Spacing.two, fontFamily: Fonts.regular, fontStyle: "italic", fontSize: 12.5, color: Colors.inkSoft, alignSelf: "flex-start" },
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
