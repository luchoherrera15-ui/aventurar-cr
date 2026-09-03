import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
 * ALCANCE: confirmar, cancelar, bloquear un día libre (y liberarlo) y
 * cargar una reserva manual desde el calendario — las acciones del día
 * a día del anfitrión. La web además permite editar los datos, mover
 * la fecha y validar el depósito — eso queda para cuando haga falta,
 * no se construyó acá para no inflar el corte.
 *
 * Bloquear y cargar reserva usan el MISMO baile de dos pasos que
 * `guardarWalkIn` en la agenda de citas: la política de INSERT (0109)
 * solo deja nacer una fila en 'pendiente' o 'temporal', y la de UPDATE
 * del dueño (0077) es la que después permite pasarla a 'bloqueada' o
 * 'confirmada'. Un insert directo en esos estados rebota contra la RLS.
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

/** El borrador de la reserva manual, todo en texto (viene de TextInputs). */
type BorradorReserva = {
  nombre: string;
  tipoEvento: string;
  invitados: string;
  monto: string;
  adelanto: string;
  notas: string;
};

const RESERVA_VACIA: BorradorReserva = {
  nombre: "",
  tipoEvento: "",
  invitados: "",
  monto: "",
  adelanto: "",
  notas: "",
};

const ETIQUETA: Record<string, { texto: string; tono: TonoEstado }> = {
  confirmada: { texto: "Confirmada", tono: "verde" },
  pendiente: { texto: "En aprobación", tono: "naranja" },
  bloqueada: { texto: "Bloqueado", tono: "gris" },
};

/**
 * La piel de una celda del mes — espejo del arreglo que ya se hizo en
 * la web (`ocupacion-calendario.tsx`): antes cada celda ocupada se
 * rellenaba entera con un borde grueso del mismo color, y un mes lleno
 * se leía como un semáforo. Ahora el color va en una barrita de 3px
 * debajo del número (`marca`, ver `celdaMarca` en los estilos) y el
 * relleno es apenas un tinte — el número manda, no el bloque.
 */
function pielDelDia(estado: string | null) {
  if (estado === "confirmada") return { fondo: Colors.blueLight, marca: Colors.navy, texto: Colors.ink };
  if (estado === "pendiente") return { fondo: Colors.skyLight, marca: Colors.sky, texto: Colors.ink };
  if (estado === "bloqueada") return { fondo: Colors.cream2, marca: Colors.inkMuted, texto: Colors.inkSoft };
  return { fondo: "transparent", marca: null, texto: Colors.ink };
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
  // Las acciones del día LIBRE: bloquear o cargar una reserva manual.
  const [creando, setCreando] = useState(false);
  const [borrador, setBorrador] = useState<BorradorReserva>(RESERVA_VACIA);
  const [guardando, setGuardando] = useState(false);

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
    elegirDia(null);
  }

  /** Cambia el día elegido y descarta el formulario a medio llenar:
   *  un borrador del martes no puede terminar guardado en el jueves. */
  function elegirDia(fecha: string | null) {
    setSeleccion(fecha);
    setCreando(false);
    setBorrador(RESERVA_VACIA);
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

  function confirmarBloqueo() {
    if (!seleccion) return;
    Alert.alert(
      "Bloquear este día",
      `¿Bloqueás el ${fechaLarga(seleccion)}? Nadie va a poder reservarlo hasta que lo liberes.`,
      [
        { text: "Mejor no", style: "cancel" },
        {
          text: "Sí, bloquear",
          onPress: () => {
            void bloquearDia();
          },
        },
      ],
    );
  }

  /**
   * Tapa un día libre (mantenimiento, un evento propio, una reserva por
   * fuera). Dos pasos por la RLS — ver el comentario de arriba del
   * archivo. 'bloqueada' no consume el cupo del día (el trigger de 0049
   * solo cuenta 'confirmada') pero sí ocupa la disponibilidad pública,
   * igual que los bloqueos que llegan del sync de agendas externas.
   */
  async function bloquearDia() {
    if (!seleccion) return;
    setGuardando(true);
    const { data: creada, error: errorInsert } = await supabase
      .from("reservas")
      .insert({
        rancho_id: id,
        fecha: seleccion,
        estado: "pendiente",
        origen: "manual",
        nombre: "Bloqueado por el anfitrión",
      })
      .select("id")
      .single();
    if (errorInsert || !creada) {
      setGuardando(false);
      Alert.alert("No se pudo", "No se pudo bloquear: " + (errorInsert?.message ?? "error"));
      return;
    }
    const reservaId = (creada as { id: string }).id;
    const { error: errorBloquear } = await supabase
      .from("reservas")
      .update({ estado: "bloqueada" })
      .eq("id", reservaId)
      .eq("rancho_id", id);
    if (errorBloquear) {
      // Borrarla no se puede (la RLS de DELETE es solo del admin): el
      // borrador pendiente se rechaza para que no tape el día.
      await supabase
        .from("reservas")
        .update({ estado: "rechazada", cancelada_en: new Date().toISOString() })
        .eq("id", reservaId)
        .eq("rancho_id", id);
      setGuardando(false);
      Alert.alert("No se pudo", "No se pudo bloquear: " + errorBloquear.message);
      return;
    }
    setGuardando(false);
    await cargar();
  }

  /**
   * Carga una reserva que llegó por teléfono o en persona — espejo de
   * `crearReservaManual` de la web: mismos campos obligatorios (nombre,
   * invitados, monto) y mismo insert 'pendiente' → update 'confirmada'.
   * El chequeo de cupo de antes es el aviso amable; el índice único y
   * el trigger de la base (23505) son la red contra dos a la vez.
   */
  async function guardarReserva() {
    if (!seleccion) return;
    const nombre = borrador.nombre.trim().slice(0, 120);
    if (!nombre) {
      Alert.alert("Falta el nombre", "Escribí el nombre de quien reserva.");
      return;
    }
    const invitados = Number(borrador.invitados.trim());
    if (!borrador.invitados.trim() || !Number.isInteger(invitados) || invitados <= 0) {
      Alert.alert("Revisá los invitados", "Indicá para cuántas personas es la reserva.");
      return;
    }
    const monto = Number(borrador.monto.trim());
    if (!borrador.monto.trim() || !Number.isFinite(monto) || monto <= 0) {
      Alert.alert("Revisá el monto", "El monto va en colones, sin puntos ni comas.");
      return;
    }
    const adelanto = borrador.adelanto.trim() === "" ? 0 : Number(borrador.adelanto.trim());
    if (!Number.isFinite(adelanto) || adelanto < 0) {
      Alert.alert("Revisá el adelanto", "El adelanto va en colones, sin puntos ni comas.");
      return;
    }
    if (adelanto > monto) {
      Alert.alert("Revisá el adelanto", "El adelanto no puede ser mayor que el total del evento.");
      return;
    }

    setGuardando(true);

    // Chequeo suave de capacidad y cupo, igual que la web: no frena
    // condiciones de carrera (eso lo hace la base al confirmar), pero
    // da el mensaje bueno antes del error críptico del trigger.
    const { data: negocio } = await supabase
      .from("ranchos")
      .select("eventos_por_dia, capacidad_max")
      .eq("id", id)
      .maybeSingle();
    const capacidad = (negocio?.capacidad_max as number | null) ?? null;
    if (capacidad && invitados > capacidad) {
      setGuardando(false);
      Alert.alert("Demasiadas personas", `Este lugar recibe hasta ${capacidad} personas.`);
      return;
    }
    // Un lugar sin `eventos_por_dia` configurado atiende 1 evento por
    // día — el mismo default que usa la web para la categoría.
    const cupo = (negocio?.eventos_por_dia as number | null) ?? 1;
    const { count } = await supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("rancho_id", id)
      .eq("fecha", seleccion)
      .in("estado", ["pendiente", "confirmada"]);
    if ((count ?? 0) >= cupo) {
      setGuardando(false);
      Alert.alert(
        "Fecha ocupada",
        cupo === 1
          ? "Esa fecha ya tiene una reserva pendiente o confirmada."
          : `Esa fecha ya tiene ${cupo} reservas — es tu cupo del día.`,
      );
      return;
    }

    const { data: creada, error: errorInsert } = await supabase
      .from("reservas")
      .insert({
        rancho_id: id,
        fecha: seleccion,
        estado: "pendiente",
        origen: "manual",
        nombre,
        tipo_evento: borrador.tipoEvento.trim().slice(0, 60) || null,
        invitados,
        notas: borrador.notas.trim().slice(0, 500) || null,
        monto_total: monto,
        deposito_monto: adelanto,
      })
      .select("id")
      .single();
    if (errorInsert || !creada) {
      setGuardando(false);
      if (errorInsert?.code === "23505") {
        Alert.alert("Fecha ocupada", "Esa fecha ya está tomada.");
      } else {
        Alert.alert("No se pudo", "No se pudo crear la reserva: " + (errorInsert?.message ?? "error"));
      }
      return;
    }
    const reservaId = (creada as { id: string }).id;

    const { error: errorConfirmar } = await supabase
      .from("reservas")
      .update({ estado: "confirmada" })
      .eq("id", reservaId)
      .eq("rancho_id", id);
    if (errorConfirmar) {
      // Igual que el bloqueo: sin DELETE, el borrador se rechaza.
      await supabase
        .from("reservas")
        .update({ estado: "rechazada", cancelada_en: new Date().toISOString() })
        .eq("id", reservaId)
        .eq("rancho_id", id);
      setGuardando(false);
      if (errorConfirmar.code === "23505") {
        Alert.alert("Fecha ocupada", "Esa fecha ya está tomada.");
      } else {
        Alert.alert("No se pudo", "No se pudo confirmar la reserva: " + errorConfirmar.message);
      }
      return;
    }

    setGuardando(false);
    setCreando(false);
    setBorrador(RESERVA_VACIA);
    await cargar();
  }

  function cambiarBorrador(cambio: Partial<BorradorReserva>) {
    setBorrador((b) => ({ ...b, ...cambio }));
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
                    onPress={() => elegirDia(elegida ? null : fecha)}
                    accessibilityLabel={`${fechaLarga(fecha)}${lista ? ` — ${lista.length} reserva${lista.length === 1 ? "" : "s"}` : " — libre"}`}
                    style={[
                      styles.celda,
                      {
                        backgroundColor: elegida ? Colors.navy : piel.fondo,
                        borderColor: elegida ? Colors.navy : Colors.line,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.celdaNumero,
                        { color: elegida ? "#ffffff" : esHoy ? Colors.accent : piel.texto },
                        esHoy && styles.celdaNumeroHoy,
                      ]}
                    >
                      {d}
                      {lista && lista.length > 1 ? ` ×${lista.length}` : ""}
                    </Text>
                    {esHoy && !elegida && (
                      <Text style={[styles.celdaHoyTexto, { color: Colors.accent }]}>Hoy</Text>
                    )}
                    {/* La barrita del estado — nunca sobre la celda ya
                        elegida (navy sólido), ahí no aporta nada. */}
                    {piel.marca && !elegida && (
                      <View style={[styles.celdaMarca, { backgroundColor: piel.marca }]} />
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
            <Pressable onPress={() => elegirDia(null)} hitSlop={8}>
              <Text style={styles.cerrarDia}>Cerrar</Text>
            </Pressable>
          </View>

          {delDia.length === 0 ? (
            <View style={{ gap: Spacing.two + 2 }}>
              <Text style={styles.libreTexto}>Este día está libre.</Text>

              <View style={styles.accionesLibre}>
                <Boton
                  texto="Bloquear este día"
                  tono="contorno"
                  icono="lock-closed-outline"
                  compacto
                  cargando={guardando && !creando}
                  deshabilitado={guardando && creando}
                  onPress={confirmarBloqueo}
                />
                <Boton
                  texto={creando ? "Cerrar" : "Cargar reserva"}
                  tono="navy"
                  icono={creando ? "close" : "add"}
                  compacto
                  deshabilitado={guardando}
                  onPress={() => setCreando(!creando)}
                />
              </View>

              {creando && (
                <View style={styles.formulario}>
                  <Micro>Nueva reserva — {seleccion}</Micro>

                  <Text style={styles.campoEtiqueta}>Cliente</Text>
                  <TextInput
                    value={borrador.nombre}
                    onChangeText={(v) => cambiarBorrador({ nombre: v })}
                    placeholder="Nombre (obligatorio)"
                    placeholderTextColor={Colors.inkMuted}
                    maxLength={120}
                    style={styles.input}
                  />

                  <Text style={styles.campoEtiqueta}>Tipo de evento</Text>
                  <TextInput
                    value={borrador.tipoEvento}
                    onChangeText={(v) => cambiarBorrador({ tipoEvento: v })}
                    placeholder="Ej. Boda, cumpleaños"
                    placeholderTextColor={Colors.inkMuted}
                    maxLength={60}
                    style={styles.input}
                  />

                  <View style={styles.filaCampos}>
                    <View style={styles.campo}>
                      <Text style={styles.campoEtiqueta}>Invitados</Text>
                      <TextInput
                        value={borrador.invitados}
                        onChangeText={(v) => cambiarBorrador({ invitados: v })}
                        placeholder="50"
                        placeholderTextColor={Colors.inkMuted}
                        keyboardType="number-pad"
                        maxLength={5}
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.campo}>
                      <Text style={styles.campoEtiqueta}>Monto en ₡</Text>
                      <TextInput
                        value={borrador.monto}
                        onChangeText={(v) => cambiarBorrador({ monto: v })}
                        placeholder="250000"
                        placeholderTextColor={Colors.inkMuted}
                        keyboardType="number-pad"
                        maxLength={9}
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.campo}>
                      <Text style={styles.campoEtiqueta}>Adelanto en ₡</Text>
                      <TextInput
                        value={borrador.adelanto}
                        onChangeText={(v) => cambiarBorrador({ adelanto: v })}
                        placeholder="0"
                        placeholderTextColor={Colors.inkMuted}
                        keyboardType="number-pad"
                        maxLength={9}
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <Text style={styles.campoEtiqueta}>Notas (solo las ves vos)</Text>
                  <TextInput
                    value={borrador.notas}
                    onChangeText={(v) => cambiarBorrador({ notas: v })}
                    placeholder="Ej. Pagan el resto el día del evento"
                    placeholderTextColor={Colors.inkMuted}
                    maxLength={500}
                    style={styles.input}
                  />

                  <Boton
                    texto="Guardar reserva"
                    tono="reservar"
                    icono="checkmark"
                    cargando={guardando}
                    onPress={() => {
                      void guardarReserva();
                    }}
                    style={{ marginTop: Spacing.one }}
                  />
                </View>
              )}
            </View>
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
    borderColor: Colors.line,
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
  // La barrita de estado: 3px, pegada abajo — el color dice el estado
  // sin necesitar rellenar la celda entera. Centrada a mano (`left:
  // 50% + marginLeft` en vez de `alignSelf`): un hijo con position
  // absolute no lo respeta el `alignItems` del padre.
  celdaMarca: {
    borderRadius: 2,
    bottom: 5,
    height: 3,
    left: "50%",
    marginLeft: -7,
    position: "absolute",
    width: 14,
  },
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
  accionesLibre: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  // El formulario inline de la reserva manual — mismos huesos que el
  // walk-in de la agenda de citas (`agenda.tsx`).
  formulario: {
    backgroundColor: Colors.cream,
    borderRadius: Radios.md,
    gap: Spacing.two + 2,
    padding: Spacing.two + 4,
  },
  campoEtiqueta: {
    color: Colors.inkSoft,
    fontFamily: Fonts.semiBold,
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  filaCampos: { flexDirection: "row", gap: Spacing.two },
  campo: { flex: 1, gap: 4 },
  input: {
    backgroundColor: "#ffffff",
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
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
