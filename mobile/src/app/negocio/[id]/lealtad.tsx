import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import BarraSuperior from "@/components/barra-superior";
import { acreditarSello, type SelloAcreditado } from "@/lib/lealtad-app";
import { Colors, Fonts, Radios, Sombras, Spacing } from "@/constants/theme";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL MOSTRADOR, EN EL TELÉFONO
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (26 ago 2026): «lo mismo que ven en el panel de
 * lealtad en el navegador pero optimizado para app — escanear, enviar
 * notificaciones, ver datos».
 *
 * Ésta es la primera de las tres y la que más se usa: apuntar la cámara
 * al pase del cliente y darle su sello. Hasta hoy el app abría el panel
 * de la web en un navegador embebido, que en una caja —de pie, con
 * alguien esperando— es exactamente lo que no sirve.
 *
 * ── ACÁ NO SE DECIDE NADA ───────────────────────────────────────────
 *
 * Ninguna regla de acumulación vive en este archivo. El QR lleva el
 * `serial_number` del pase y se manda tal cual a
 * `/api/lealtad/app/acreditar`, que corre `operar-core` — el MISMO
 * código que el mostrador de la web. Si acá apareciera una cuenta de
 * sellos o una consulta a `transacciones_puntos`, habría dos copias de
 * las reglas que mueven saldo.
 *
 * ── LOS DOS DETALLES QUE HACEN QUE ESTO NO ROMPA UNA CAJA ───────────
 *
 * 1. LA CÁMARA LEE UNAS DIEZ VECES POR SEGUNDO. Sin un candado, un solo
 *    pase enfrente dispara diez acreditaciones. El candado corta el
 *    bucle al primer acierto y no se abre hasta que la persona toca
 *    «Escanear otra».
 *
 * 2. `ok: true` NO SIGNIFICA QUE SE SUMÓ. Cuando el servidor contesta
 *    `yaEstaba`, esa lectura ya había entrado antes y NO se acreditó
 *    nada. Pintar los dos casos igual es un error que YA PASÓ en este
 *    producto —está escrito en `operar-core.ts`—: el dueño escaneaba de
 *    más, veía «¡Sello sumado!» cada vez, el saldo no se movía, y
 *    reportó que el sistema no entregaba los sellos.
 */

type Estado =
  | { fase: "esperando" }
  | { fase: "enviando" }
  | { fase: "listo"; sello: SelloAcreditado }
  | { fase: "error"; motivo: string };

export default function EscanerLealtad() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [estado, setEstado] = useState<Estado>({ fase: "esperando" });

  /**
   * El candado del bucle de lectura.
   *
   * Va en un `ref` y NO en el estado: `onBarcodeScanned` se dispara
   * muchas veces por segundo, y un `setState` no se ve reflejado en las
   * llamadas que ya están en vuelo. Con el ref, la segunda lectura ve el
   * candado puesto de inmediato.
   */
  const leyendo = useRef(false);

  const alLeer = useCallback(
    async ({ data }: { data: string }) => {
      if (leyendo.current) return;
      const serial = (data ?? "").trim();
      if (!serial) return;
      leyendo.current = true;
      setEstado({ fase: "enviando" });

      /**
       * UNO POR LECTURA, y generado ACÁ.
       *
       * El endpoint responde 400 sin tocar la base si falta. Es lo que
       * hace que un reintento por señal mala sea seguro: el segundo
       * envío con el MISMO id no acredita dos veces. Si se generara
       * adentro de `acreditarSello`, cada reintento traería uno nuevo y
       * el cliente se llevaría dos sellos por una lectura.
       */
      const intentoId = Crypto.randomUUID();
      const r = await acreditarSello({ negocioId: String(id), serial, intentoId });
      setEstado(r.ok ? { fase: "listo", sello: r.datos } : { fase: "error", motivo: r.motivo });
    },
    [id],
  );

  function volverAEscanear() {
    leyendo.current = false;
    setEstado({ fase: "esperando" });
  }

  // `permiso` es null mientras se resuelve. Sin este caso, la pantalla
  // parpadea el pedido de permiso un instante en cada apertura.
  if (!permiso) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!permiso.granted) {
    return (
      <View style={styles.pantalla}>
        <BarraSuperior kicker="En el mostrador" titulo="Escanear" onVolver={() => router.back()} />
        <View style={styles.centro}>
          <Ionicons name="camera-outline" size={44} color={Colors.inkMuted} />
          <Text style={styles.permisoTitulo}>Necesitamos la cámara</Text>
          <Text style={styles.permisoTexto}>
            Es para leer el código de la tarjeta de tu cliente. No se guarda ninguna foto ni se
            graba nada.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void pedirPermiso()}
            style={({ pressed }) => [styles.boton, pressed && styles.botonTocado]}
          >
            <Text style={styles.botonTexto}>Permitir la cámara</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.pantalla}>
      <BarraSuperior
        kicker="En el mostrador"
        titulo="Escanear"
        subtitulo="Apuntá al código de la tarjeta del cliente."
        onVolver={() => router.back()}
      />

      <View style={styles.visor}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          // Solo QR: el pase lleva un QR, y limitar los formatos le ahorra
          // trabajo al decodificador en un teléfono de gama baja.
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          // Con el candado puesto se deja de escuchar del todo, en vez de
          // recibir y descartar diez lecturas por segundo.
          onBarcodeScanned={estado.fase === "esperando" ? alLeer : undefined}
        />
        {/* La mira. Sin una guía, la gente acerca demasiado el teléfono y
            el código sale desenfocado. */}
        <View pointerEvents="none" style={styles.mira} />
      </View>

      <ScrollView contentContainerStyle={styles.panel}>
        {estado.fase === "esperando" && <Text style={styles.pista}>Buscando el código…</Text>}

        {estado.fase === "enviando" && (
          <View style={styles.fila}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.pista}>Acreditando…</Text>
          </View>
        )}

        {estado.fase === "listo" && <Resultado sello={estado.sello} />}

        {estado.fase === "error" && (
          <View style={[styles.tarjeta, styles.tarjetaError]}>
            <Ionicons name="alert-circle" size={22} color={Colors.danger} />
            <Text style={styles.errorTexto}>{estado.motivo}</Text>
          </View>
        )}

        {(estado.fase === "listo" || estado.fase === "error") && (
          <Pressable
            accessibilityRole="button"
            onPress={volverAEscanear}
            style={({ pressed }) => [styles.boton, pressed && styles.botonTocado]}
          >
            <Text style={styles.botonTexto}>Escanear otra</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * EL RESULTADO, CON LOS DOS CASOS SEPARADOS.
 *
 * `yaEstaba` es la diferencia entre «le sumaste un sello» y «esta
 * lectura ya había entrado». Ver el aviso de la cabecera.
 */
function Resultado({ sello }: { sello: SelloAcreditado }) {
  if (sello.yaEstaba) {
    return (
      <View style={[styles.tarjeta, styles.tarjetaAviso]}>
        <Ionicons name="information-circle" size={22} color={Colors.skyInk} />
        <View style={styles.tarjetaCuerpo}>
          <Text style={styles.tituloAviso}>Ese sello ya estaba</Text>
          <Text style={styles.detalle}>
            Esta lectura ya se había acreditado antes, así que no se sumó de nuevo.{" "}
            {sello.cliente || "El cliente"} va en {sello.saldo}.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.tarjeta, styles.tarjetaOk]}>
      <Ionicons name="checkmark-circle" size={22} color={Colors.green} />
      <View style={styles.tarjetaCuerpo}>
        <Text style={styles.tituloOk}>
          {sello.puntos === 1 ? "Sello acreditado" : `+${sello.puntos} acreditados`}
        </Text>
        <Text style={styles.detalle}>
          {sello.cliente || "El cliente"} va en {sello.saldo}.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boton: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: Radios.lg,
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
  },
  botonTexto: {
    color: Colors.surface,
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  botonTocado: { opacity: 0.8 },
  centro: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.two,
    justifyContent: "center",
    padding: Spacing.four,
  },
  detalle: {
    color: Colors.inkSoft,
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
  },
  errorTexto: {
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  fila: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  mira: {
    borderColor: Colors.surface,
    borderRadius: Radios.xl,
    borderWidth: 3,
    height: 210,
    opacity: 0.9,
    width: 210,
  },
  panel: { padding: Spacing.three },
  pantalla: { backgroundColor: Colors.cream, flex: 1 },
  permisoTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
  },
  permisoTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.bold,
    fontSize: 17,
  },
  pista: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
  },
  tarjeta: {
    alignItems: "flex-start",
    backgroundColor: Colors.surface,
    borderRadius: Radios.lg,
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    ...Sombras.tarjeta,
  },
  tarjetaAviso: { backgroundColor: Colors.skyLight },
  tarjetaCuerpo: { flex: 1, gap: Spacing.one },
  tarjetaError: { backgroundColor: Colors.dangerLight },
  tarjetaOk: { backgroundColor: Colors.greenLight },
  tituloAviso: {
    color: Colors.skyInk,
    fontFamily: Fonts.bold,
    fontSize: 15.5,
  },
  tituloOk: {
    color: Colors.green,
    fontFamily: Fonts.bold,
    fontSize: 15.5,
  },
  visor: {
    alignItems: "center",
    backgroundColor: "#000",
    height: 320,
    justifyContent: "center",
    overflow: "hidden",
  },
});
