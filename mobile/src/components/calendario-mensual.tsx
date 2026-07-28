import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import type { DiaDisponibilidad, PromocionDia } from "@/lib/types";

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
 * Calendario por mes, espejo del BookingCalendar del sitio: nombre del
 * mes con flechas para navegar, semanas en filas de domingo a sábado y
 * los mismos estados por color (libre, bloqueada temporal, en
 * aprobación, reservada) con su leyenda. Los días con promoción llevan
 * la etiqueta verde del descuento.
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
  // descuento en las celdas sin recalcular por celda.
  const promoPorDiaSemana = useMemo(() => {
    const mapa: Record<number, PromocionDia> = {};
    promociones
      .filter((p) => p.activo && p.porcentaje_descuento > 0)
      .forEach((p) => {
        p.dias_semana.forEach((dow) => {
          const actual = mapa[dow];
          if (!actual || p.porcentaje_descuento > actual.porcentaje_descuento) {
            mapa[dow] = p;
          }
        });
      });
    return mapa;
  }, [promociones]);

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
        <Text style={styles.mesTitulo}>
          {MESES[mes]} {anio}
        </Text>
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
                    reservada && { color: ROJO_TEXTO },
                    bloqueada && { color: CELESTE_TEXTO },
                    !deshabilitada && pendientes > 0 && { color: AMBAR_TEXTO },
                  ]}
                >
                  {d}
                </Text>
                {promoDia ? (
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoBadgeTexto}>-{promoDia.porcentaje_descuento}%</Text>
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
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  mesTitulo: { fontSize: 19, fontFamily: Fonts.extraBold, letterSpacing: -0.3, color: Colors.ink },
  navBotones: { flexDirection: "row", gap: Spacing.two },
  navBoton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  grilla: { flexDirection: "row", flexWrap: "wrap" },
  celda: { width: `${100 / 7}%`, padding: 2 },
  dowTexto: {
    textAlign: "center",
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    color: "#8a8a8a",
    textTransform: "uppercase",
    paddingBottom: 4,
  },
  dia: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  diaPasado: { borderColor: "transparent", backgroundColor: "transparent" },
  diaHoy: { borderWidth: 2, borderColor: Colors.navy },
  diaNumero: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.ink },
  diaNumeroPasado: { color: "#c9c9c9" },
  promoBadge: {
    backgroundColor: Colors.green,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  promoBadgeTexto: { color: "#ffffff", fontSize: 8.5, fontFamily: Fonts.bold },
  badgePendientes: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  badgePendientesTexto: { color: "#ffffff", fontSize: 8.5, fontFamily: Fonts.bold },
  leyenda: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingTop: Spacing.three,
  },
  leyendaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  leyendaPunto: { width: 11, height: 11, borderRadius: 3, borderWidth: 1 },
  leyendaTexto: { fontSize: 11.5, color: Colors.inkSoft, fontFamily: Fonts.medium },
});
