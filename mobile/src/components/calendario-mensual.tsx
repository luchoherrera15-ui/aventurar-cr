import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Tipo } from "@/constants/theme";
import type { DiaDisponibilidad, PromocionDia } from "@/lib/types";
import { fmtColones } from "@/lib/types";
import { mejorPromoPorDiaSemana } from "@/lib/promociones";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

/* Mismos colores de estado que el BookingCalendar de /web
   (red/sky/amber de Tailwind), para que el calendario se lea igual
   en la app y en el sitio. */
const ROJO_FONDO = "#fef2f2";
const ROJO_BORDE = "#fecaca";
const ROJO_TEXTO = "#b91c1c";
const CELESTE_FONDO = "#f0f9ff";
const CELESTE_BORDE = "#bae6fd";
const CELESTE_TEXTO = "#0369a1";
const AMBAR_FONDO = "#fffbeb";
const AMBAR_BORDE = "#fcd34d";
const AMBAR_TEXTO = "#92400e";

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Calendario por mes, espejo del BookingCalendar del sitio: el mes en
 * micro-mayúsculas con sus flechas, las semanas de domingo a sábado y
 * los mismos estados por color (libre, bloqueada temporal, en
 * aprobación, reservada) con su leyenda. Hoy va marcado con el
 * recuadro naranja del mockup — un contorno, no un relleno, para que
 * no compita con el estado del día. Los días con promoción llevan la
 * etiqueta verde del descuento.
 */
export default function CalendarioMensual({
  disponibilidad,
  promociones = [],
  onElegir,
}: {
  disponibilidad: Record<string, DiaDisponibilidad>;
  promociones?: PromocionDia[];
  onElegir: (fechaIso: string) => void;
}) {
  const hoy = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());

  function cambiarMes(dir: number) {
    let m = mes + dir;
    let y = anio;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMes(m);
    setAnio(y);
  }

  // La mejor promoción activa de cada día de la semana, para marcar el
  // descuento en las celdas sin recalcular por celda (ignora
  // personas_max a propósito: acá es publicidad del día, todavía no
  // se sabe cuántos invitados va a traer quien reserva).
  const promoPorDiaSemana = useMemo(() => mejorPromoPorDiaSemana(promociones), [promociones]);

  const primerDow = new Date(anio, mes, 1).getDay();
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(primerDow).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => i + 1),
  ];

  const hayPromos = Object.keys(promoPorDiaSemana).length > 0;

  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <View>
          <Text style={styles.mesMicro}>{MESES[mes]}</Text>
          <Text style={styles.mesAnio}>{anio}</Text>
        </View>
        <View style={styles.navBotones}>
          <Pressable style={styles.navBoton} onPress={() => cambiarMes(-1)} hitSlop={6}>
            <Ionicons name="chevron-back" size={17} color={Colors.ink} />
          </Pressable>
          <Pressable style={styles.navBoton} onPress={() => cambiarMes(1)} hitSlop={6}>
            <Ionicons name="chevron-forward" size={17} color={Colors.ink} />
          </Pressable>
        </View>
      </View>

      <View style={styles.grilla}>
        {DOW.map((d, i) => (
          <View key={`dow-${i}`} style={styles.celda}>
            <Text style={styles.dowTexto}>{d}</Text>
          </View>
        ))}
        {celdas.map((d, i) => {
          if (d === null) return <View key={`v-${i}`} style={styles.celda} />;

          const fecha = iso(anio, mes, d);
          const fechaObj = new Date(anio, mes, d);
          const esPasado = fechaObj < hoy;
          const esHoy = fechaObj.getTime() === hoy.getTime();
          const info = disponibilidad[fecha];
          const reservada = !!info?.confirmada;
          const bloqueada = !reservada && (info?.temporales ?? 0) > 0;
          const pendientes = info?.pendientes ?? 0;
          const deshabilitada = esPasado || reservada || bloqueada;
          const promoDia = deshabilitada ? null : promoPorDiaSemana[fechaObj.getDay()] ?? null;

          return (
            <View key={fecha} style={styles.celda}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: deshabilitada }}
                disabled={deshabilitada}
                onPress={() => onElegir(fecha)}
                style={[
                  styles.dia,
                  reservada && { backgroundColor: ROJO_FONDO, borderColor: ROJO_BORDE },
                  bloqueada && { backgroundColor: CELESTE_FONDO, borderColor: CELESTE_BORDE },
                  !deshabilitada && pendientes > 0 && { backgroundColor: AMBAR_FONDO, borderColor: AMBAR_BORDE },
                  esPasado && styles.diaPasado,
                  esHoy && styles.diaHoy,
                ]}
              >
                <Text
                  style={[
                    styles.diaNumero,
                    esPasado && styles.diaNumeroPasado,
                    esHoy && styles.diaNumeroHoy,
                    reservada && { color: ROJO_TEXTO },
                    bloqueada && { color: CELESTE_TEXTO },
                    !deshabilitada && pendientes > 0 && { color: AMBAR_TEXTO },
                  ]}
                >
                  {d}
                </Text>
                {promoDia ? (
                  <View style={styles.promoBadge}>
                    <Text
                      style={styles.promoBadgeTexto}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {promoDia.tipo === "precio_fijo"
                        ? `${fmtColones(promoDia.precio_fijo ?? 0)} fijo`
                        : `-${promoDia.porcentaje_descuento}%`}
                    </Text>
                  </View>
                ) : !deshabilitada && pendientes > 0 ? (
                  <View style={styles.badgePendientes}>
                    <Text style={styles.badgePendientesTexto}>{pendientes}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.leyenda}>
        <LeyendaItem fondo={Colors.surface} borde={Colors.line} label="Disponible" />
        <LeyendaItem fondo={CELESTE_FONDO} borde={CELESTE_BORDE} label="Bloqueada temporal" />
        <LeyendaItem fondo={AMBAR_FONDO} borde={AMBAR_BORDE} label="En aprobación" />
        <LeyendaItem fondo={ROJO_FONDO} borde={ROJO_BORDE} label="Reservada" />
        {hayPromos && <LeyendaItem fondo={Colors.green} borde={Colors.green} label="Día con descuento" />}
      </View>
    </View>
  );
}

function LeyendaItem({ fondo, borde, label }: { fondo: string; borde: string; label: string }) {
  return (
    <View style={styles.leyendaItem}>
      <View style={[styles.leyendaPunto, { backgroundColor: fondo, borderColor: borde }]} />
      <Text style={styles.leyendaTexto}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  encabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  mesMicro: { ...Tipo.micro, color: Colors.accent },
  mesAnio: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 20,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  navBotones: { flexDirection: "row", gap: Spacing.two },
  navBoton: {
    alignItems: "center",
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  grilla: { flexDirection: "row", flexWrap: "wrap" },
  celda: { padding: 2, width: `${100 / 7}%` },
  dowTexto: {
    color: Colors.inkMuted,
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 1,
    paddingBottom: 6,
    textAlign: "center",
    textTransform: "uppercase",
  },
  dia: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 46,
  },
  diaPasado: { backgroundColor: "transparent", borderColor: "transparent" },
  // Hoy va con el contorno naranja del mockup: se nota sin taparle el
  // estado (reservada, en aprobación) al día.
  diaHoy: { borderColor: Colors.sky, borderWidth: 1.5 },
  diaNumero: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  diaNumeroHoy: { color: Colors.accent, fontFamily: Fonts.extraBold },
  diaNumeroPasado: { color: "#c9cdd6" },
  promoBadge: {
    backgroundColor: Colors.green,
    borderRadius: 8,
    maxWidth: "92%",
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  promoBadgeTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 8.5 },
  badgePendientes: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 8,
    height: 15,
    justifyContent: "center",
    position: "absolute",
    right: 3,
    top: 3,
    width: 15,
  },
  badgePendientesTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 8.5 },
  leyenda: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  leyendaItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  leyendaPunto: { borderRadius: 3, borderWidth: 1, height: 11, width: 11 },
  leyendaTexto: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5 },
});
