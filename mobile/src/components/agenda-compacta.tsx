import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { Estado, Micro, Ranura } from "@/components/ui";
import { DIAS_CORTO, MESES_CORTO } from "@/lib/citas";
import {
  ESTADO_LABEL,
  ESTADO_TONO,
  horaDelDia,
  type DiaAgenda,
  type ReservaPanel,
} from "@/lib/panel-reservas";

/**
 * La agenda del negocio en versión de bolsillo: la tira de días con su
 * carga a la vista y, debajo, lo que pasa el día elegido.
 *
 * Es la agenda que va en el INICIO del panel — lo primero que un dueño
 * quiere saber al abrir la app es qué tiene hoy y qué se le viene. La
 * agenda completa (crear una cita, mover, bloquear una franja, la
 * vista por persona) sigue siendo su propia pantalla, a un toque de
 * "Ver completa".
 */

/** Colores de la barrita de cada fila — mismo código que el resto. */
const BARRA: Record<string, string> = {
  pendiente: Colors.sky,
  confirmada: Colors.navy,
  cumplida: Colors.green,
  no_asistio: Colors.danger,
  bloqueada: Colors.line,
};

export default function AgendaCompacta({
  dias,
  seleccionado,
  onElegirDia,
  onVerCompleta,
  onTocarReserva,
}: {
  dias: DiaAgenda[];
  /** El día en pantalla, en ISO ("2026-08-06"). */
  seleccionado: string;
  onElegirDia: (iso: string) => void;
  onVerCompleta: () => void;
  onTocarReserva?: (reserva: ReservaPanel) => void;
}) {
  const dia = dias.find((d) => d.iso === seleccionado) ?? dias[0];
  if (!dia) return null;

  return (
    <View style={{ gap: Spacing.two + 2 }}>
      <View style={styles.encabezado}>
        <Micro>Agenda</Micro>
        <Pressable accessibilityRole="button" onPress={onVerCompleta} hitSlop={8}>
          <Text style={styles.verCompleta}>Ver completa →</Text>
        </Pressable>
      </View>

      {/* La tira de días: el número grande y, debajo, cuántas cosas hay
          ese día. Un día vacío también se ve — en una agenda el hueco
          informa tanto como la reserva. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tira}
      >
        {dias.map((d) => {
          const activo = d.iso === dia.iso;
          return (
            <Pressable
              key={d.iso}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`${DIAS_CORTO[d.fecha.getDay()]} ${d.fecha.getDate()} de ${MESES_CORTO[d.fecha.getMonth()]}`}
              onPress={() => onElegirDia(d.iso)}
              style={({ pressed }) => [
                styles.dia,
                d.esHoy && !activo && styles.diaHoy,
                activo && styles.diaActivo,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.diaSemana, activo && styles.textoActivo]}>
                {DIAS_CORTO[d.fecha.getDay()]}
              </Text>
              <Text style={[styles.diaNumero, activo && styles.textoActivo]}>
                {d.fecha.getDate()}
              </Text>
              <Text style={[styles.diaCarga, activo && styles.textoActivoSuave]}>
                {d.reservas.length > 0 ? `${d.reservas.length}` : "·"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.panel}>
        <Text style={styles.diaTitulo}>
          {dia.esHoy ? "Hoy · " : ""}
          {DIAS_CORTO[dia.fecha.getDay()]} {dia.fecha.getDate()} {MESES_CORTO[dia.fecha.getMonth()]}
        </Text>

        {dia.reservas.length === 0 ? (
          <Ranura texto="Sin nada agendado" />
        ) : (
          dia.reservas.map((r) => {
            // Un bloqueo no tiene ficha que abrir: es un rato que el
            // dueño cerró a mano, no una reserva de alguien.
            const tocable = !!onTocarReserva && r.estado !== "bloqueada";
            return (
            <Pressable
              key={r.id}
              accessibilityRole={tocable ? "button" : undefined}
              disabled={!tocable}
              onPress={() => onTocarReserva?.(r)}
              style={({ pressed }) => [styles.fila, pressed && tocable && { opacity: 0.85 }]}
            >
              <View
                style={[styles.barra, { backgroundColor: BARRA[r.estado] ?? Colors.line }]}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.hora} numberOfLines={1}>
                  {horaDelDia(r)}
                </Text>
                <Text style={styles.cliente} numberOfLines={1}>
                  {r.estado === "bloqueada"
                    ? (r.tipo_evento ?? "Bloqueado")
                    : (r.nombre ?? "Sin nombre")}
                  {r.estado !== "bloqueada" && r.tipo_evento ? ` · ${r.tipo_evento}` : ""}
                </Text>
              </View>
              {/* Con respaldo por si la base trae un estado que este
                  build todavía no conoce. */}
              <Estado
                texto={ESTADO_LABEL[r.estado] ?? r.estado}
                tono={ESTADO_TONO[r.estado] ?? "gris"}
              />
              {tocable && <Ionicons name="chevron-forward" size={15} color={Colors.inkMuted} />}
            </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  verCompleta: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 12.5 },

  tira: { gap: Spacing.two, paddingVertical: 2 },
  dia: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    gap: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    width: 54,
  },
  diaHoy: { borderColor: Colors.navy, borderWidth: 1.5 },
  diaActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  diaSemana: {
    color: Colors.inkMuted,
    fontFamily: Fonts.extraBold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  diaNumero: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 17, letterSpacing: -0.3 },
  diaCarga: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 10.5 },
  textoActivo: { color: "#ffffff" },
  textoActivoSuave: { color: "rgba(255,255,255,0.75)" },

  panel: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  diaTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 13.5,
    letterSpacing: -0.2,
  },
  fila: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    overflow: "hidden",
    paddingHorizontal: Spacing.two + 2,
    paddingLeft: Spacing.two + 6,
    paddingVertical: 10,
  },
  barra: { bottom: 0, left: 0, position: "absolute", top: 0, width: 4 },
  hora: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 12 },
  cliente: { color: Colors.ink, fontFamily: Fonts.semiBold, fontSize: 13, marginTop: 1 },
});
