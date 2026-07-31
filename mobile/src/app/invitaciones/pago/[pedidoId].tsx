import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { decode as decodeBase64 } from "base64-arraybuffer";
import BarraSuperior from "@/components/barra-superior";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/**
 * El pago del pedido de invitación — espejo de
 * /invitaciones/pago/[pedidoId] en la web: SINPE Móvil o transferencia
 * con comprobante adjunto.
 *
 * El comprobante SÍ sube directo a Supabase Storage (igual que en la
 * reserva de un salón), pero el pedido lo cierra el servidor: así el
 * cambio de estado y los correos salen por el mismo camino que en la
 * web, sin duplicar la lógica.
 *
 * Los datos de cobro (SINPE, banco) llegan del endpoint, no del app:
 * viven en variables de entorno del servidor y cambiar una cuenta no
 * puede obligar a publicar una versión nueva en las tiendas.
 */

type Pedido = {
  id: string;
  paquete: string;
  nombre_evento: string | null;
  fecha_evento: string | null;
  estado: string;
  contacto_correo: string;
};

type DatosPago = {
  pedido: Pedido;
  paquete: { nombre: string; etiqueta: string; precioUSD: number | null; tienePanel: boolean };
  monto: string;
  sinpe: { numero: string; titular: string };
  banco: { nombre: string; cuenta: string; titular: string };
};

type Metodo = "sinpe" | "transferencia";

export default function PagoInvitacionScreen() {
  const { pedidoId } = useLocalSearchParams<{ pedidoId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [datos, setDatos] = useState<DatosPago | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<Metodo>("sinpe");
  const [comprobanteUri, setComprobanteUri] = useState<string | null>(null);
  const [referencia, setReferencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** true cuando el pago ya quedó registrado: la pantalla del "listo". */
  const [listo, setListo] = useState(false);

  const cargar = useCallback(async () => {
    const token = session?.access_token;
    if (!token || !pedidoId) return;
    try {
      const respuesta = await fetch(
        `${SITIO_URL}/api/invitaciones/pedido?id=${encodeURIComponent(String(pedidoId))}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const cuerpo = await respuesta.json();
      if (!respuesta.ok || !cuerpo.ok) {
        setFallo(cuerpo.error ?? "No pudimos abrir tu pedido.");
        return;
      }
      setDatos(cuerpo as DatosPago);
      // Un pedido que ya no está esperando pago cae directo en el
      // "listo": volver atrás no debe dejar pagar dos veces.
      if ((cuerpo as DatosPago).pedido.estado !== "pendiente_pago") setListo(true);
    } catch {
      setFallo("No hay conexión con Bookea. Revisá tu internet.");
    }
  }, [pedidoId, session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  async function elegirComprobante() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        "Permiso necesario",
        "Necesitamos acceso a tus fotos para adjuntar el comprobante.",
      );
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!resultado.canceled && resultado.assets[0]) {
      setComprobanteUri(resultado.assets[0].uri);
    }
  }

  async function pagar() {
    const token = session?.access_token;
    if (!comprobanteUri || !token) return;
    setEnviando(true);
    setError(null);

    try {
      // 1. El comprobante va directo al storage, como en las reservas.
      const base64 = await FileSystem.readAsStringAsync(comprobanteUri, {
        encoding: "base64",
      });
      const extension = comprobanteUri.split(".").pop()?.toLowerCase() || "jpg";
      const path = `pedidos-invitacion/${pedidoId}-${Date.now()}.${extension}`;
      const { error: errorSubida } = await supabase.storage
        .from("comprobantes")
        .upload(path, decodeBase64(base64), {
          contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
        });

      if (errorSubida) {
        setError("No se pudo subir el comprobante: " + errorSubida.message);
        return;
      }

      const { data: publica } = supabase.storage.from("comprobantes").getPublicUrl(path);

      // 2. El pedido lo cierra el servidor (y de ahí salen los correos).
      const respuesta = await fetch(`${SITIO_URL}/api/invitaciones/pedido`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pedidoId,
          metodo,
          comprobanteUrl: publica?.publicUrl ?? path,
          referencia: referencia.trim(),
        }),
      });

      const cuerpo = await respuesta.json();
      if (!respuesta.ok || !cuerpo.ok) {
        setError(cuerpo.error ?? "No pudimos registrar tu pago. Intentá de nuevo.");
        return;
      }

      setListo(true);
    } catch {
      setError("No hay conexión con Bookea. Revisá tu internet y probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (fallo) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Pago" />
        <View style={styles.centro}>
          <Text style={styles.vacio}>{fallo}</Text>
        </View>
      </View>
    );
  }

  if (!datos) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Pago" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  // ---------- El "listo": el pedido ya entró ----------
  if (listo) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior
          titulo="Pedido recibido"
          onVolver={() => router.replace("/invitaciones" as never)}
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.resumen}>
            <Text style={styles.resumenPaso}>Paso 2 de 2 · Listo</Text>
            <Text style={styles.resumenTitulo}>¡Recibimos tu pedido!</Text>
            <Text style={styles.resumenDetalle}>
              Estamos verificando tu pago. Apenas quede confirmado, el equipo
              empieza a diseñar la invitación de{" "}
              {datos.pedido.nombre_evento ?? "tu evento"}.
            </Text>
          </View>

          <View style={styles.bloque}>
            <Text style={styles.bloqueTituloOscuro}>¿Qué sigue?</Text>
            {[
              `Te llega un correo de confirmación a ${datos.pedido.contacto_correo}.`,
              "Cuando tu invitación esté lista te avisamos por correo con el link para compartir.",
              datos.paquete.tienePanel
                ? "Entrá con esta misma cuenta para ver tu invitación y abrir tu panel de confirmaciones, donde vas a ver en vivo quién asiste."
                : "Entrá con esta misma cuenta para ver tu invitación.",
            ].map((texto, i) => (
              <View key={texto} style={styles.pasoFila}>
                <View style={styles.pasoNumero}>
                  <Text style={styles.pasoNumeroTexto}>{i + 1}</Text>
                </View>
                <Text style={styles.pasoTexto}>{texto}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={styles.botonAccent}
            onPress={() => router.replace("/invitaciones" as never)}
          >
            <Text style={styles.botonAccentTexto}>Ver mis invitaciones</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ---------- El pago ----------
  const cuentaLista = metodo === "sinpe" ? Boolean(datos.sinpe.numero) : Boolean(datos.banco.cuenta);

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Pagá tu invitación" subtitulo={datos.pedido.nombre_evento ?? ""} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.resumen}>
          <Text style={styles.resumenPaso}>Paso 2 de 2 · Pago</Text>
          <Text style={styles.resumenTitulo}>Invitación {datos.paquete.nombre}</Text>
          <Text style={styles.resumenDetalle}>
            {datos.pedido.nombre_evento} · {datos.pedido.fecha_evento}
          </Text>
          <Text style={styles.resumenMonto}>
            {datos.monto}
            {datos.paquete.precioUSD !== null && (
              <Text style={styles.resumenMontoUSD}> ({datos.paquete.etiqueta} USD)</Text>
            )}
          </Text>
        </View>

        {/* Cómo querés pagar */}
        <View style={styles.bloque}>
          <Text style={styles.bloqueTituloOscuro}>¿Cómo querés pagar?</Text>
          <View style={styles.metodos}>
            {(
              [
                { id: "sinpe" as const, label: "SINPE Móvil" },
                { id: "transferencia" as const, label: "Transferencia" },
              ]
            ).map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMetodo(m.id)}
                style={[styles.metodo, metodo === m.id && styles.metodoActivo]}
              >
                <Text style={[styles.metodoTexto, metodo === m.id && styles.metodoTextoActivo]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.datosCobro}>
            {!cuentaLista ? (
              <Text style={styles.datosVacio}>
                Todavía no configuramos este medio de pago. Escribinos por el
                chat y coordinamos el pago a mano.
              </Text>
            ) : metodo === "sinpe" ? (
              <>
                <Dato etiqueta="Número SINPE" valor={datos.sinpe.numero} copiable />
                {!!datos.sinpe.titular && (
                  <Dato etiqueta="A nombre de" valor={datos.sinpe.titular} />
                )}
                <Dato etiqueta="Monto" valor={datos.monto} copiable />
                <Dato etiqueta="Detalle" valor={`Invitación ${String(pedidoId).slice(0, 8)}`} />
              </>
            ) : (
              <>
                {!!datos.banco.nombre && <Dato etiqueta="Banco" valor={datos.banco.nombre} />}
                <Dato etiqueta="Cuenta / IBAN" valor={datos.banco.cuenta} copiable />
                {!!datos.banco.titular && (
                  <Dato etiqueta="A nombre de" valor={datos.banco.titular} />
                )}
                <Dato etiqueta="Monto" valor={datos.monto} copiable />
                <Dato etiqueta="Detalle" valor={`Invitación ${String(pedidoId).slice(0, 8)}`} />
              </>
            )}
          </View>
        </View>

        {/* El comprobante */}
        <View style={styles.bloque}>
          <Text style={styles.bloqueTituloOscuro}>Adjuntá tu comprobante</Text>
          <Text style={styles.bloqueAyuda}>
            Una captura del SINPE o de la transferencia. Lo verificamos y
            arrancamos con tu diseño.
          </Text>

          <Pressable style={styles.zonaFoto} onPress={elegirComprobante}>
            {comprobanteUri ? (
              <Image
                source={{ uri: comprobanteUri }}
                alt="Comprobante adjunto"
                style={styles.foto}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.zonaFotoVacia}>
                <Ionicons name="camera-outline" size={26} color={Colors.navy} />
                <Text style={styles.zonaFotoTexto}>Tocá para subir una foto del comprobante</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.campo}>
            <Text style={styles.campoEtiqueta}>Número de referencia (opcional)</Text>
            <TextInput
              value={referencia}
              onChangeText={setReferencia}
              placeholder="Ej: 123456789"
              placeholderTextColor={Colors.inkMuted}
              maxLength={120}
              style={styles.input}
            />
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.botonAccent, (!comprobanteUri || enviando) && styles.botonApagado]}
          disabled={!comprobanteUri || enviando}
          onPress={pagar}
        >
          {enviando ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.botonAccentTexto}>Ya pagué — enviar comprobante</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** Un dato de la cuenta, con su toque para copiar al portapapeles. */
function Dato({
  etiqueta,
  valor,
  copiable,
}: {
  etiqueta: string;
  valor: string;
  copiable?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!copiable) return;
    await Clipboard.setStringAsync(valor);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <Pressable style={styles.dato} onPress={copiar} disabled={!copiable}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <View style={styles.datoValorFila}>
        <Text style={styles.datoValor}>{valor}</Text>
        {copiable && (
          <Ionicons
            name={copiado ? "checkmark" : "copy-outline"}
            size={14}
            color={copiado ? Colors.green : Colors.inkSoft}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center", padding: Spacing.four },
  vacio: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 14, textAlign: "center" },
  scroll: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },

  resumen: { backgroundColor: Colors.navy, borderRadius: Radios.lg, padding: Spacing.three },
  resumenPaso: {
    color: "#f5b98a",
    fontFamily: Fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  resumenTitulo: {
    color: "#ffffff",
    fontFamily: Fonts.extraBold,
    fontSize: 21,
    letterSpacing: -0.4,
    marginTop: 5,
  },
  resumenDetalle: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },
  resumenMonto: {
    color: "#f5b98a",
    fontFamily: Fonts.extraBold,
    fontSize: 27,
    letterSpacing: -0.7,
    marginTop: Spacing.two,
  },
  resumenMontoUSD: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: Fonts.semiBold,
    fontSize: 13,
  },

  bloque: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  bloqueTituloOscuro: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  bloqueAyuda: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5, lineHeight: 18 },

  metodos: { flexDirection: "row", gap: Spacing.two },
  metodo: {
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 2,
    flex: 1,
    paddingVertical: 12,
  },
  metodoActivo: { backgroundColor: Colors.blueLight, borderColor: Colors.navy },
  metodoTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bold,
    fontSize: 13,
    textAlign: "center",
  },
  metodoTextoActivo: { color: Colors.ink },

  datosCobro: {
    backgroundColor: Colors.cream2,
    borderRadius: Radios.sm,
    gap: Spacing.two,
    marginTop: Spacing.one,
    padding: Spacing.three,
  },
  datosVacio: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 13, lineHeight: 19 },
  dato: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  datoEtiqueta: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13 },
  datoValorFila: { alignItems: "center", flexDirection: "row", gap: 6, flexShrink: 1 },
  datoValor: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 13.5,
    textAlign: "right",
  },

  zonaFoto: {
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.md,
    borderStyle: "dashed",
    borderWidth: 2,
    overflow: "hidden",
  },
  zonaFotoVacia: { alignItems: "center", gap: 6, paddingVertical: Spacing.four },
  zonaFotoTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.semiBold,
    fontSize: 12.5,
    textAlign: "center",
  },
  foto: { height: 200, width: "100%" },

  campo: { gap: 5, marginTop: Spacing.one },
  campoEtiqueta: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13 },
  input: {
    backgroundColor: Colors.surface,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },

  pasoFila: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.one },
  pasoNumero: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: Radios.full,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  pasoNumeroTexto: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 11.5 },
  pasoTexto: {
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },

  error: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    color: Colors.danger,
    fontFamily: Fonts.bold,
    fontSize: 13,
    padding: Spacing.three,
  },
  botonAccent: {
    alignItems: "center",
    backgroundColor: Colors.accent,
    borderRadius: Radios.full,
    paddingVertical: 15,
  },
  botonApagado: { opacity: 0.5 },
  botonAccentTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },
});
