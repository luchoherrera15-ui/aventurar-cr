import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { Estado } from "@/components/ui";
import { fmtColones } from "@/lib/types";
import {
  ESTADO_LABEL,
  ESTADO_TONO,
  METODO_PAGO_LABEL,
  ORIGEN_LABEL,
  fechaDelEvento,
  horarioDelEvento,
  montosDe,
  selloDeTiempo,
  type ReservaPanel,
} from "@/lib/panel-reservas";

/**
 * Una reserva del histórico, auditada: quién la hizo, con qué correo,
 * cuándo la hizo (con hora), qué día es el evento, cuánto depositó,
 * cuánto queda pendiente y cuánto es en total.
 *
 * En un teléfono esto NO va en tabla — una fila de ocho columnas se
 * vuelve ilegible antes de la segunda. Va como tarjeta compacta: lo
 * que se mira de un vistazo arriba, y el resto de la auditoría
 * (validación del adelanto, cuándo se pagó, método, descuento, origen,
 * invitados, notas) se abre al tocarla.
 */

export default function ReservaAuditoria({
  reserva,
  abierta,
  onAlternar,
  onValidarAdelanto,
  onVerComprobante,
  onQuitarConfirmacion,
  onRegistrarCobro,
  ocupada = false,
}: {
  reserva: ReservaPanel;
  abierta: boolean;
  onAlternar: () => void;
  /** Marcar (o desmarcar) el adelanto como recibido. */
  onValidarAdelanto?: (reserva: ReservaPanel) => void;
  onVerComprobante?: (path: string) => void;
  /** Devolver una confirmada a "por aceptar". */
  onQuitarConfirmacion?: (reserva: ReservaPanel) => void;
  /** Cerrar el cobro del evento (el resto, no el adelanto). */
  onRegistrarCobro?: (reserva: ReservaPanel) => void;
  ocupada?: boolean;
}) {
  const { adelanto, pendiente, total } = montosDe(reserva);
  const hecha = selloDeTiempo(reserva.created_at);
  const horario = horarioDelEvento(reserva);
  const deposito = Number(reserva.deposito_monto ?? 0);
  const descuento = Number(reserva.descuento_monto ?? 0);
  const telefono = reserva.whatsapp ?? reserva.contacto;

  return (
    <View style={styles.tarjeta}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierta }}
        accessibilityLabel={`Detalle de la reserva de ${reserva.nombre ?? "sin nombre"}`}
        onPress={onAlternar}
        style={({ pressed }) => [styles.resumen, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.filaTitulo}>
          <Text style={styles.cliente} numberOfLines={1}>
            {reserva.nombre ?? "Sin nombre"}
          </Text>
          <Estado
            texto={ESTADO_LABEL[reserva.estado] ?? reserva.estado}
            tono={ESTADO_TONO[reserva.estado] ?? "gris"}
          />
        </View>

        {/* La auditoría de arriba: cuándo se hizo y quién la hizo. */}
        {hecha ? <Text style={styles.linea}>Reservó el {hecha}</Text> : null}
        {reserva.correo ? (
          <Text style={styles.linea} numberOfLines={1}>
            {reserva.correo}
          </Text>
        ) : null}
        <Text style={styles.lineaEvento} numberOfLines={1}>
          Evento {fechaDelEvento(reserva)}
          {horario ? ` · ${horario}` : ""}
        </Text>

        {/* La plata en tres columnas: lo que entró, lo que falta, el total. */}
        <View style={styles.plata}>
          <Monto etiqueta="Adelanto" valor={adelanto} tono={adelanto > 0 ? "verde" : "apagado"} />
          <Monto
            etiqueta="Pendiente"
            valor={pendiente}
            tono={pendiente > 0 ? "fuerte" : "apagado"}
          />
          <Monto etiqueta="Total" valor={total} tono="normal" />
          <Ionicons
            name={abierta ? "chevron-up" : "chevron-down"}
            size={16}
            color={Colors.inkMuted}
          />
        </View>
      </Pressable>

      {abierta && (
        <View style={styles.detalle}>
          <Dato
            etiqueta="Adelanto"
            valor={
              deposito > 0
                ? `${fmtColones(deposito)} · ${reserva.deposito_validado ? "validado" : "sin validar"}`
                : "Sin adelanto"
            }
            tono={deposito > 0 && !reserva.deposito_validado ? "atencion" : "normal"}
          />
          <Dato etiqueta="Adelanto pagado el" valor={selloDeTiempo(reserva.deposito_pagado_en)} />
          <Dato
            etiqueta="Saldo"
            valor={
              reserva.evento_pagado
                ? `Cobrado${selloDeTiempo(reserva.saldo_pagado_en) ? ` el ${selloDeTiempo(reserva.saldo_pagado_en)}` : ""}`
                : pendiente > 0
                  ? `Faltan ${fmtColones(pendiente)}`
                  : "Nada pendiente"
            }
            tono={!reserva.evento_pagado && pendiente > 0 ? "atencion" : "normal"}
          />
          <Dato
            etiqueta="Método de pago"
            valor={
              reserva.metodo_pago
                ? (METODO_PAGO_LABEL[reserva.metodo_pago] ?? reserva.metodo_pago)
                : null
            }
          />
          <Dato
            etiqueta="Descuento"
            valor={
              descuento > 0
                ? `${fmtColones(descuento)}${reserva.codigo_descuento ? ` · ${reserva.codigo_descuento}` : ""}`
                : null
            }
          />
          <Dato
            etiqueta="Reservó desde"
            valor={reserva.origen ? (ORIGEN_LABEL[reserva.origen] ?? reserva.origen) : null}
          />
          <Dato etiqueta="Servicio" valor={reserva.tipo_evento} />
          <Dato
            etiqueta="Invitados"
            valor={reserva.invitados ? `${reserva.invitados} personas` : null}
          />
          <Dato etiqueta="Teléfono" valor={telefono} />
          <Dato etiqueta="Cédula" valor={reserva.cedula} />

          {reserva.notas?.trim() ? (
            <View style={styles.nota}>
              <Text style={styles.notaEtiqueta}>Nota</Text>
              <Text style={styles.notaTexto}>{reserva.notas.trim()}</Text>
            </View>
          ) : null}

          <View style={styles.acciones}>
            {onValidarAdelanto && deposito > 0 && (
              <Pressable
                accessibilityRole="button"
                disabled={ocupada}
                onPress={() => onValidarAdelanto(reserva)}
                style={({ pressed }) => [
                  styles.accion,
                  (pressed || ocupada) && { opacity: 0.6 },
                ]}
              >
                <Ionicons
                  name={reserva.deposito_validado ? "checkbox" : "square-outline"}
                  size={17}
                  color={reserva.deposito_validado ? Colors.green : Colors.navy}
                />
                <Text style={styles.accionTexto}>
                  {reserva.deposito_validado ? "Adelanto recibido" : "Marcar recibido"}
                </Text>
              </Pressable>
            )}

            {onVerComprobante && reserva.deposito_comprobante_url && (
              <Pressable
                accessibilityRole="button"
                onPress={() => onVerComprobante(reserva.deposito_comprobante_url!)}
                style={({ pressed }) => [styles.accion, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="document-attach-outline" size={16} color={Colors.navy} />
                <Text style={styles.accionTexto}>Ver comprobante</Text>
              </Pressable>
            )}

            {onRegistrarCobro && !reserva.evento_pagado && pendiente > 0 && (
              <Pressable
                accessibilityRole="button"
                disabled={ocupada}
                onPress={() => onRegistrarCobro(reserva)}
                style={({ pressed }) => [
                  styles.accion,
                  (pressed || ocupada) && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="cash-outline" size={16} color={Colors.green} />
                <Text style={[styles.accionTexto, { color: Colors.green }]}>
                  Marcar resto pagado
                </Text>
              </Pressable>
            )}

            {onQuitarConfirmacion && reserva.estado === "confirmada" && (
              <Pressable
                accessibilityRole="button"
                disabled={ocupada}
                onPress={() => onQuitarConfirmacion(reserva)}
                style={({ pressed }) => [
                  styles.accion,
                  (pressed || ocupada) && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="arrow-undo-outline" size={16} color={Colors.inkSoft} />
                <Text style={[styles.accionTexto, { color: Colors.inkSoft }]}>
                  Quitar confirmación
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

/** Una columna de plata del resumen: rótulo chiquito arriba, monto abajo. */
function Monto({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string;
  valor: number;
  tono: "verde" | "fuerte" | "normal" | "apagado";
}) {
  const color =
    tono === "verde"
      ? Colors.green
      : tono === "apagado"
        ? Colors.inkMuted
        : tono === "fuerte"
          ? Colors.ink
          : Colors.inkSoft;
  return (
    <View style={styles.columnaMonto}>
      <Text style={styles.montoEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.montoValor, { color }]} numberOfLines={1}>
        {fmtColones(valor)}
      </Text>
    </View>
  );
}

/** Una línea de la ficha abierta. Se calla sola si no hay dato. */
function Dato({
  etiqueta,
  valor,
  tono = "normal",
}: {
  etiqueta: string;
  valor: string | null;
  tono?: "normal" | "atencion";
}) {
  if (!valor) return null;
  return (
    <View style={styles.dato}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text
        style={[styles.datoValor, tono === "atencion" && { color: Colors.skyInk }]}
        numberOfLines={2}
      >
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  resumen: { gap: 2, padding: Spacing.three },
  filaTitulo: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    marginBottom: 2,
  },
  cliente: {
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  linea: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12 },
  lineaEvento: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5, marginTop: 2 },

  plata: {
    alignItems: "flex-end",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.two + 2,
    paddingTop: Spacing.two + 2,
  },
  columnaMonto: { flex: 1, minWidth: 0 },
  montoEtiqueta: {
    color: Colors.inkMuted,
    fontFamily: Fonts.extraBold,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  montoValor: { fontFamily: Fonts.extraBold, fontSize: 13, marginTop: 2 },

  detalle: {
    backgroundColor: "#fbfcfe",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    gap: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  dato: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.three,
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  datoEtiqueta: { color: Colors.inkMuted, fontFamily: Fonts.semiBold, fontSize: 11.5 },
  datoValor: {
    color: Colors.ink,
    flexShrink: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 12.5,
    textAlign: "right",
  },

  nota: {
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.sm,
    marginTop: Spacing.two,
    padding: Spacing.two + 2,
  },
  notaEtiqueta: {
    color: Colors.navy,
    fontFamily: Fonts.extraBold,
    fontSize: 9,
    letterSpacing: 0.9,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  notaTexto: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 12.5, lineHeight: 18 },

  acciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: Spacing.two + 2,
  },
  accion: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  accionTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12 },
});
