import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { Boton, Estado, Micro, Tarjeta, type TonoEstado } from "@/components/ui";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";

/**
 * LA AGENDA DE UN LUGAR (rancho, salón): calendario del MES, no franjas
 * de horas — un lugar se alquila por DÍA entero, no por hora. Espejo de
 * `OcupacionCalendario` de la web (src/components/ocupacion-calendario.tsx),
 * que es el ÚNICO lugar donde el dueño de un lugar maneja sus reservas
 * (a diferencia de citas, que tiene su propia pantalla dedicada).
 *
 * Antes esta ruta (`negocio/[id]/agenda.tsx`) mostraba la grilla de
 * HORAS de citas a TODO el mundo, lugares incluidos — un rancho no
 * trabaja por franjas de 30 minutos, así que ese calendario no decía
 * nada útil. `agenda.tsx` ahora bifurca: `categoria === "lugares"`
 * entra acá.
 *
 * ALCANCE DE ESTA PRIMERA VERSIÓN: confirmar y cancelar, que son las
 * dos acciones del día a día. La web además permite editar los datos,
 * mover la fecha, cargar una reserva nueva desde el calendario y
 * validar el depósito — eso queda para cuando haga falta, no se
 * construyó acá para no inflar el primer corte.
 */

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

type ReservaLugar = {
  id: string;
  fecha: string;
  estado: string;
  nombre: string | null;
  tipo_evento: string | null;
  invitados: number | null;
  notas: string | null;
  monto_total: number | null;
  deposito_monto: number | null;
  horario_bloque: string | null;
};

const ETIQUETA: Record<string, { texto: string; tono: TonoEstado }> = {
  confirmada: { texto: "Confirmada", tono: "verde" },
  pendiente: { texto: "En aprobación", tono: "naranja" },
  bloqueada: { texto: "Bloqueado", tono: "gris" },
};

/** Misma piel que ya usa `estiloBloque` en la agenda por horas, para
 *  que confirmada/pendiente/bloqueada se lean igual en las dos vistas. */
function pielDelDia(estado: string | null) {
  if (estado === "confirmada") return { fondo: Colors.blueLight, borde: Colors.navy };
  if (estado === "pendiente") return { fondo: Colors.skyLight, borde: Colors.sky };
  if (estado === "bloqueada") return { fondo: Colors.cream2, borde: Colors.line };
  return { fondo: "transparent", borde: Colors.line };
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fechaLarga(fechaIso: string) {
  const [y, m, d] = fechaIso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return `${DIAS[dow]} ${d} de ${MESES[m - 1]}`;
}

function hoyISO() {
  const hoy = new Date();
  return iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
}

/** Avisa al cliente por correo que le confirmaron la reserva — mismo
 *  endpoint que ya usa la agenda de citas para su propio aviso: la app
 *  escribe directo contra Supabase y no tiene el secreto de Resend. */
async function avisarReservaAprobada(reservaId: string) {
  try {
    await fetch(`${SITIO_URL}/api/reservas/${reservaId}/aprobacion`, { method: "POST" });
  } catch {
    // Sin drama: la reserva ya quedó confirmada en la base.
  }
}

export default function AgendaLugar({ id }: { id: string }) {
  const hoy = useMemo(() => hoyISO(), []);
  const [y0, m0] = hoy.split("-").map(Number);
  const [viewYear, setViewYear] = useState(y0);
  const [viewMonth, setViewMonth] = useState(m0 - 1);
  const [filas, setFilas] = useState<ReservaLugar[] | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const primerDia = iso(viewYear, viewMonth, 1);
    const ultimoDia = iso(viewYear, viewMonth, new Date(viewYear, viewMonth + 1, 0).getDate());
    const { data } = await supabase
      .from("reservas")
      .select(
        "id, fecha, estado, nombre, tipo_evento, invitados, notas, monto_total, deposito_monto, horario_bloque",
      )
      .eq("rancho_id", id)
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia)
      // Mismo filtro que el calendario de la web: lo que de verdad
      // ocupa el día. Rechazada/cancelada dejan el día libre otra vez.
      .in("estado", ["pendiente", "confirmada", "bloqueada"])
      .order("fecha", { ascending: true });
    setFilas((data ?? []) as ReservaLugar[]);
  }, [id, viewYear, viewMonth]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  function cambiarMes(dir: number) {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
    setSeleccion(null);
  }

  const porFecha = new Map<string, ReservaLugar[]>();
  for (const f of filas ?? []) {
    const lista = porFecha.get(f.fecha);
    if (lista) lista.push(f);
    else porFecha.set(f.fecha, [f]);
  }

  function estadoDelDia(lista: ReservaLugar[]): string {
    if (lista.some((r) => r.estado === "confirmada")) return "confirmada";
    if (lista.some((r) => r.estado === "pendiente")) return "pendiente";
    return "bloqueada";
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const diasEnMes = new Date(viewYear, viewMonth + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  async function confirmar(reserva: ReservaLugar) {
    setOcupado(reserva.id);
    const { data, error } = await supabase
      .from("reservas")
      .update({ estado: "confirmada" })
      .eq("id", reserva.id)
      .eq("rancho_id", id)
      .eq("estado", "pendiente")
      .select("id")
      .maybeSingle();
    setOcupado(null);
    if (error) {
      Alert.alert("No se pudo", "No se pudo confirmar: " + error.message);
      return;
    }
    if (!data) {
      Alert.alert("No se pudo", "Esa reserva ya no está pendiente.");
      return;
    }
    void avisarReservaAprobada(reserva.id);
    await cargar();
  }

  function confirmarCancelacion(reserva: ReservaLugar) {
    Alert.alert(
      reserva.estado === "bloqueada" ? "Liberar el día" : "Cancelar reserva",
      reserva.estado === "bloqueada"
        ? "¿Liberás este día?"
        : `¿Cancelás la reserva de ${reserva.nombre ?? "este cliente"}? El día queda libre al instante.`,
      [
        { text: "Mejor no", style: "cancel" },
        {
          text: reserva.estado === "bloqueada" ? "Sí, liberar" : "Sí, cancelar",
          style: "destructive",
          onPress: () => {
            void cancelar(reserva);
          },
        },
      ],
    );
  }

  async function cancelar(reserva: ReservaLugar) {
    setOcupado(reserva.id);
    // 'rechazada' y no 'cancelada': es el estado final de EVENTOS
    // (0001) -'cancelada' (0061) solo lo escribe la vertical de citas.
    const { data, error } = await supabase
      .from("reservas")
      .update({ estado: "rechazada", cancelada_en: new Date().toISOString() })
      .eq("id", reserva.id)
      .eq("rancho_id", id)
      .in("estado", ["pendiente", "confirmada", "bloqueada"])
      .select("id")
      .maybeSingle();
    setOcupado(null);
    if (error) {
      Alert.alert("No se pudo", "No se pudo cancelar: " + error.message);
      return;
    }
    if (!data) {
      Alert.alert("No se pudo", "Esa reserva ya no se puede cancelar.");
      return;
    }
    await cargar();
  }

  const delDia = seleccion ? (porFecha.get(seleccion) ?? []) : [];

  return (
    <View style={styles.contenedor}>
      <Tarjeta>
        <View style={styles.encabezado}>
          <Micro>Agenda del mes</Micro>
          <View style={styles.filaMes}>
            <Pressable onPress={() => cambiarMes(-1)} hitSlop={8} accessibilityLabel="Mes anterior">
              <Ionicons name="chevron-back" size={20} color={Colors.ink} />
            </Pressable>
            <Text style={styles.tituloMes}>
              {MESES[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={() => cambiarMes(1)} hitSlop={8} accessibilityLabel="Mes siguiente">
              <Ionicons name="chevron-forward" size={20} color={Colors.ink} />
            </Pressable>
          </View>
        </View>

        {filas === null ? (
          <View style={styles.centro}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          <>
            <View style={styles.filaDow}>
              {DOW.map((d, i) => (
                <Text key={i} style={styles.dowTexto}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.grilla}>
              {celdas.map((d, i) => {
                if (d === null) return <View key={i} style={styles.celdaVacia} />;
                const fecha = iso(viewYear, viewMonth, d);
                const lista = porFecha.get(fecha);
                const estado = lista ? estadoDelDia(lista) : null;
                const esHoy = fecha === hoy;
                const elegida = fecha === seleccion;
                const piel = pielDelDia(estado);
                return (
                  <Pressable
                    key={i}
                    onPress={() => setSeleccion(elegida ? null : fecha)}
                    accessibilityLabel={`${fechaLarga(fecha)}${lista ? ` — ${lista.length} reserva${lista.length === 1 ? "" : "s"}` : " — libre"}`}
                    style={[
                      styles.celda,
                      { backgroundColor: elegida ? Colors.navy : piel.fondo, borderColor: elegida ? Colors.navy : piel.borde },
                    ]}
                  >
                    <Text
                      style={[
                        styles.celdaNumero,
                        { color: elegida ? "#ffffff" : esHoy ? Colors.accent : Colors.ink },
                        esHoy && styles.celdaNumeroHoy,
                      ]}
                    >
                      {d}
                      {lista && lista.length > 1 ? ` ×${lista.length}` : ""}
                    </Text>
                    {esHoy && (
                      <Text style={[styles.celdaHoyTexto, { color: elegida ? "#ffffff" : Colors.accent }]}>
                        Hoy
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.leyenda}>
              <LeyendaItem color={Colors.navy} texto="Confirmada" />
              <LeyendaItem color={Colors.sky} texto="En aprobación" />
              <LeyendaItem color={Colors.inkMuted} texto="Bloqueado" />
              <LeyendaItem color={Colors.line} texto="Libre" hueco />
            </View>
          </>
        )}
      </Tarjeta>

      {seleccion && (
        <Tarjeta style={styles.panelDia}>
          <View style={styles.encabezadoDia}>
            <Text style={styles.tituloDia}>{fechaLarga(seleccion)}</Text>
            <Pressable onPress={() => setSeleccion(null)} hitSlop={8}>
              <Text style={styles.cerrarDia}>Cerrar</Text>
            </Pressable>
          </View>

          {delDia.length === 0 ? (
            <Text style={styles.libreTexto}>Este día está libre.</Text>
          ) : (
            <View style={{ gap: Spacing.two + 2 }}>
              {delDia.map((r) => (
                <FilaReserva
                  key={r.id}
                  reserva={r}
                  ocupado={ocupado === r.id}
                  onConfirmar={() => void confirmar(r)}
                  onCancelar={() => confirmarCancelacion(r)}
                />
              ))}
            </View>
          )}
        </Tarjeta>
      )}
    </View>
  );
}

function LeyendaItem({ color, texto, hueco }: { color: string; texto: string; hueco?: boolean }) {
  return (
    <View style={styles.leyendaItem}>
      <View
        style={[
          styles.leyendaPunto,
          hueco ? { borderWidth: 1, borderColor: color } : { backgroundColor: color },
        ]}
      />
      <Text style={styles.leyendaTexto}>{texto}</Text>
    </View>
  );
}

function FilaReserva({
  reserva,
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  reserva: ReservaLugar;
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const badge = ETIQUETA[reserva.estado] ?? { texto: reserva.estado, tono: "gris" as TonoEstado };
  const detalle = [
    reserva.tipo_evento,
    reserva.invitados ? `${reserva.invitados} personas` : null,
    reserva.horario_bloque,
    reserva.monto_total !== null ? fmtColones(reserva.monto_total) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.filaReserva}>
      <View style={styles.filaReservaEncabezado}>
        <Text style={styles.filaReservaNombre} numberOfLines={1}>
          {reserva.nombre ?? "Sin nombre"}
        </Text>
        <Estado texto={badge.texto} tono={badge.tono} />
      </View>
      {detalle ? <Text style={styles.filaReservaDetalle}>{detalle}</Text> : null}
      {reserva.notas ? <Text style={styles.filaReservaNotas}>{reserva.notas}</Text> : null}

      <View style={styles.filaReservaAcciones}>
        {reserva.estado === "pendiente" && (
          <Boton texto="Confirmar" tono="navy" compacto cargando={ocupado} onPress={onConfirmar} />
        )}
        <Boton
          texto={reserva.estado === "bloqueada" ? "Liberar el día" : "Cancelar"}
          tono="contorno"
          compacto
          deshabilitado={ocupado}
          onPress={onCancelar}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: Spacing.three },
  centro: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing.six },
  encabezado: { gap: Spacing.one },
  filaMes: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  tituloMes: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    textTransform: "capitalize",
  },
  filaDow: { flexDirection: "row", marginTop: Spacing.three },
  dowTexto: {
    color: Colors.inkSoft,
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 10,
    textAlign: "center",
    textTransform: "uppercase",
  },
  grilla: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  celdaVacia: { height: 46, width: `${100 / 7}%` },
  celda: {
    alignItems: "center",
    borderRadius: Radios.md,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    marginVertical: 2,
    width: `${100 / 7 - 0.6}%`,
  },
  celdaNumero: { fontFamily: Fonts.semiBold, fontSize: 12.5 },
  celdaNumeroHoy: { fontFamily: Fonts.extraBold },
  celdaHoyTexto: { fontFamily: Fonts.extraBold, fontSize: 8, letterSpacing: 0.5, marginTop: 1, textTransform: "uppercase" },
  leyenda: {
    backgroundColor: Colors.cream2,
    borderRadius: Radios.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two + 2,
    marginTop: Spacing.three,
    padding: Spacing.two + 2,
  },
  leyendaItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  leyendaPunto: { borderRadius: 5, height: 10, width: 10 },
  leyendaTexto: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5 },
  panelDia: { gap: Spacing.two + 2 },
  encabezadoDia: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  tituloDia: { color: Colors.ink, flex: 1, fontFamily: Fonts.extraBold, fontSize: 14, textTransform: "capitalize" },
  cerrarDia: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 12.5 },
  libreTexto: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13 },
  filaReserva: {
    backgroundColor: Colors.cream,
    borderRadius: Radios.md,
    gap: 4,
    padding: Spacing.two + 4,
  },
  filaReservaEncabezado: { alignItems: "center", flexDirection: "row", gap: Spacing.two, justifyContent: "space-between" },
  filaReservaNombre: { color: Colors.ink, flex: 1, fontFamily: Fonts.bold, fontSize: 13.5 },
  filaReservaDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12 },
  filaReservaNotas: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, fontStyle: "italic" },
  filaReservaAcciones: { flexDirection: "row", gap: Spacing.two, marginTop: 4 },
});
