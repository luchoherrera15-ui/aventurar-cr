import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { abrirHiloConsulta, mandarPrimerMensajeConsulta } from "@/lib/consulta";
import { Aviso, Casilla, Micro, Opcion, RejillaHoras } from "@/components/ui";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";
import {
  DIAS_CORTO,
  MESES_CORTO,
  etiquetaMinutos,
  fechaISOLocal,
  horaBonita,
  horarioDeDetalles,
  sumarMinutosHora,
} from "@/lib/citas";
import {
  calcularDisponibilidad,
  instanteEnZona,
  rangosDelDia,
  type BloqueoDisponibilidad,
  type CitaExistente,
  type RecursoDisponibilidad,
} from "@/lib/disponibilidad";
import {
  DURACION_EVENTO_DEFAULT,
  fechaLarga,
  HORARIO_EVENTOS_DEFAULT,
  INTERVALO_EVENTO,
  mensajePrimeraConsulta,
  minutosDeServicio,
} from "@/lib/agenda-negocio";

/**
 * ============================================================
 * La agenda POR HORAS de un proveedor de eventos
 * ============================================================
 *
 * Un DJ hace una fiesta infantil a las 3 p. m. y una boda a las 9 p. m.
 * el mismo sábado. Hasta ahora el app le daba la agenda de un salón —
 * un día entero, un depósito y un comprobante — porque el corte estaba
 * escrito como `vertical === "citas"`. Acá trabaja como la vertical de
 * Citas: días, horas y servicios.
 *
 * La diferencia, que es LA regla de producto: tocar un espacio libre
 * NO reserva ni aparta nada. Abre el chat con el proveedor y deja
 * escrita la fecha, la hora y el servicio como primer mensaje. Cero
 * holds, cero depósito, cero comprobante. El proveedor contesta.
 *
 * El motor es el mismo de Citas (`calcularDisponibilidad`, gemelo del
 * de la web): respeta el horario del negocio, el horario propio de cada
 * persona del equipo, los buffers y los bloqueos que el proveedor pone
 * a mano en Configuración → Equipo, horario y bloqueos. Lo que muestra
 * como "ocupado" sale de `disponibilidad_citas`, que es agnóstica de la
 * vertical: cualquier reserva confirmada con hora y los compromisos que
 * el sync trae del calendario del dueño (0072).
 */

/** Cuatro semanas hacia adelante, la misma tira que la agenda de Citas. */
const DIAS_VISIBLES = 28;

type ServicioAgenda = {
  id: string;
  nombre: string;
  precio: number | null;
  duracion_horas: number | null;
  duracion_minutos: number | null;
  buffer_min: number | null;
};

type CitaDelDia = {
  hora_inicio: string;
  duracion_minutos: number | null;
  miembro_id: string | null;
  buffer_minutos: number | null;
};

export default function AgendaEventos({
  ranchoId,
  nombreNegocio,
  detalles,
  zonaHoraria = "America/Costa_Rica",
  onArmarPedido,
}: {
  ranchoId: string;
  nombreNegocio: string;
  /** `ranchos.detalles` — de ahí sale `horario_citas`. */
  detalles: Record<string, unknown> | null | undefined;
  zonaHoraria?: string | null;
  /** El otro camino: armar el pedido completo con el cotizador. */
  onArmarPedido?: () => void;
}) {
  const router = useRouter();
  const { session } = useAuth();

  const [cargando, setCargando] = useState(true);
  const [servicios, setServicios] = useState<ServicioAgenda[]>([]);
  const [equipo, setEquipo] = useState<{ id: string }[]>([]);
  const [horariosRecurso, setHorariosRecurso] = useState<
    Record<string, RecursoDisponibilidad["horario"]>
  >({});
  const [bloqueos, setBloqueos] = useState<
    { miembro_id: string | null; inicio: string; fin: string }[]
  >([]);
  const [ocupadas, setOcupadas] = useState<CitaDelDia[]>([]);

  const [servicioId, setServicioId] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const zona = zonaHoraria ?? "America/Costa_Rica";

  const cargar = useCallback(async () => {
    const [itemsRes, equipoRes, bloqueosRes] = await Promise.all([
      // Los mismos ítems del catálogo que el cotizador: acá se usan
      // para saber cuánto dura cada cosa y poder pintar la grilla.
      supabase
        .from("rancho_items")
        .select("id, nombre, precio, duracion_horas, duracion_minutos, buffer_min")
        .eq("rancho_id", ranchoId)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("equipo_rancho")
        .select("id")
        .eq("rancho_id", ranchoId)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("bloqueos_agenda_publicos")
        .select("miembro_id, inicio, fin")
        .eq("rancho_id", ranchoId)
        .gte("fin", new Date().toISOString()),
    ]);

    const listaEquipo = (equipoRes.data ?? []) as { id: string }[];
    // Horario propio por persona (0061). Sin equipo no hay a quién
    // pedírselo, y el negocio entero es un recurso único.
    const horRes =
      listaEquipo.length > 0
        ? await supabase
            .from("horarios_recurso")
            .select("miembro_id, dow, abre, cierra")
            .in("miembro_id", listaEquipo.map((m) => m.id))
        : { data: [] };

    const porMiembro: Record<string, RecursoDisponibilidad["horario"]> = {};
    for (const fila of (horRes.data ?? []) as {
      miembro_id: string;
      dow: number;
      abre: string;
      cierra: string;
    }[]) {
      const delMiembro = (porMiembro[fila.miembro_id] ??= {});
      (delMiembro![String(fila.dow)] ??= []).push({
        abre: fila.abre.slice(0, 5),
        cierra: fila.cierra.slice(0, 5),
      });
    }

    // Un catálogo con error (una base sin la columna) no puede dejar la
    // agenda muda: se sigue con la duración por defecto.
    const listaItems = itemsRes.error ? [] : ((itemsRes.data ?? []) as ServicioAgenda[]);
    setServicios(listaItems);
    setEquipo(listaEquipo);
    setHorariosRecurso(porMiembro);
    setBloqueos(
      (bloqueosRes.data ?? []) as { miembro_id: string | null; inicio: string; fin: string }[],
    );
    setServicioId(listaItems[0]?.id ?? null);
    setCargando(false);
  }, [ranchoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga la agenda al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  const servicio = servicios.find((s) => s.id === servicioId) ?? null;
  const duracion =
    (servicio ? minutosDeServicio(servicio) : null) ?? DURACION_EVENTO_DEFAULT;
  const buffer = servicio?.buffer_min ?? 0;
  const horarioNegocio = horarioDeDetalles(detalles) ?? HORARIO_EVENTOS_DEFAULT;

  const recursos: RecursoDisponibilidad[] = equipo.map((m) => ({
    id: m.id,
    horario: horariosRecurso[m.id] ?? null,
  }));

  // La tira arranca en el "hoy" DEL NEGOCIO, no en el del teléfono.
  const [ay, am, ad] = instanteEnZona(new Date().toISOString(), zona)
    .fecha.split("-")
    .map(Number);
  const hoyBase = new Date(ay, am - 1, ad);
  const dias = Array.from({ length: DIAS_VISIBLES }, (_, k) => {
    const d = new Date(hoyBase);
    d.setDate(d.getDate() + k);
    const dow = d.getDay();
    const abierto =
      recursos.length > 0
        ? recursos.some((r) => rangosDelDia(r, dow, horarioNegocio).length > 0)
        : rangosDelDia(null, dow, horarioNegocio).length > 0;
    return { iso: fechaISOLocal(d), dow, dia: d.getDate(), mes: d.getMonth(), abierto };
  });

  // Derivada, no un efecto: si el día marcado dejó de estar abierto, la
  // elección se corre sola al primero que sí — igual que en Citas.
  const fechaElegida = dias.some((d) => d.iso === fecha && d.abierto)
    ? fecha
    : (dias.find((d) => d.abierto)?.iso ?? "");

  useEffect(() => {
    if (cargando || !fechaElegida) return;
    let vigente = true;
    supabase
      .from("disponibilidad_citas")
      .select("hora_inicio, duracion_minutos, miembro_id, buffer_minutos")
      .eq("rancho_id", ranchoId)
      .eq("fecha", fechaElegida)
      .then(({ data }) => {
        if (vigente) setOcupadas((data ?? []) as CitaDelDia[]);
      });
    return () => {
      vigente = false;
    };
  }, [ranchoId, fechaElegida, cargando]);

  const diaElegido = dias.find((d) => d.iso === fechaElegida);
  const disponibilidad =
    !diaElegido || !diaElegido.abierto
      ? null
      : calcularDisponibilidad({
          fecha: fechaElegida,
          zonaHoraria: zona,
          horarioNegocio,
          recursos,
          duracionMinutos: duracion,
          bufferMinutos: buffer,
          citas: ocupadas.map<CitaExistente>((c) => ({
            miembroId: c.miembro_id,
            horaInicio: c.hora_inicio,
            duracionMinutos: c.duracion_minutos ?? DURACION_EVENTO_DEFAULT,
            bufferMinutos: c.buffer_minutos ?? 0,
          })),
          bloqueos: bloqueos.map<BloqueoDisponibilidad>((b) => ({
            miembroId: b.miembro_id,
            inicio: b.inicio,
            fin: b.fin,
          })),
          // En punto: nadie contrata un DJ para las 3 y media.
          intervaloMinutos: INTERVALO_EVENTO,
          ahora: new Date(),
          // Media hora de gracia, como en Citas: no ofrecer una hora
          // que empieza en cinco minutos.
          anticipacionMinHoras: 0.5,
        });

  const horas = !disponibilidad
    ? []
    : recursos.length > 0
      ? disponibilidad.cualquiera
      : (disponibilidad.porRecurso[""] ?? []);

  /**
   * Tocar una hora ABRE EL CHAT — no reserva ni aparta nada. El primer
   * mensaje lleva fecha, hora y servicio ya escritos, que es lo que el
   * proveedor necesita para contestar en una línea.
   */
  async function consultarPorHora(hora: string) {
    if (!session) {
      router.push("/cuenta");
      return;
    }
    if (!diaElegido) return;
    setAbriendo(hora);
    setError(null);

    const convId = await abrirHiloConsulta(ranchoId, session.user.id);
    if (!convId) {
      setAbriendo(null);
      setError("No se pudo abrir el chat con este proveedor. Probá de nuevo.");
      return;
    }

    const texto = mensajePrimeraConsulta({
      fechaLarga: fechaLarga(fechaElegida),
      hora: horaBonita(hora),
      horaFin: horaBonita(sumarMinutosHora(hora, duracion)),
      servicio: servicio ? `${servicio.nombre} (${etiquetaMinutos(duracion)})` : null,
      precio: servicio ? fmtColones(servicio.precio) : null,
    });

    // Si el insert falla, el hilo igual quedó abierto: es mejor llevar a
    // la persona al chat vacío que dejarla tocando un botón muerto. El
    // helper también le pide al servidor que avise al proveedor (push y
    // correo): sin eso, la consulta se queda esperando en un chat que
    // nadie abre.
    await mandarPrimerMensajeConsulta({
      conversacionId: convId,
      autorId: session.user.id,
      texto,
    });

    setAbriendo(null);
    router.push(`/mensajes/hilo/${convId}` as never);
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.three }}>
      {/* ---------- Qué servicio ---------- */}
      {servicios.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <Micro>¿Qué necesitás?</Micro>
          <View style={{ gap: 6 }}>
            {servicios.map((s) => {
              const min = minutosDeServicio(s);
              return (
                <Opcion
                  key={s.id}
                  titulo={s.nombre}
                  detalle={min ? etiquetaMinutos(min) : "Duración a coordinar"}
                  derecha={fmtColones(s.precio) ?? "A cotizar"}
                  seleccionada={s.id === servicioId}
                  onPress={() => setServicioId(s.id)}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* ---------- Qué día ---------- */}
      <View style={{ gap: Spacing.two }}>
        <Micro>¿Qué día?</Micro>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.diasFila}
        >
          {dias.map((d) => {
            const elegido = d.iso === fechaElegida;
            return (
              <Pressable
                key={d.iso}
                accessibilityRole="button"
                accessibilityState={{ selected: elegido, disabled: !d.abierto }}
                disabled={!d.abierto}
                onPress={() => setFecha(d.iso)}
                style={[styles.dia, elegido && styles.diaActivo, !d.abierto && styles.diaCerrado]}
              >
                <Text style={[styles.diaDow, elegido && styles.diaTextoActivo]}>
                  {DIAS_CORTO[d.dow]}
                </Text>
                <Text
                  style={[
                    styles.diaNumero,
                    elegido && styles.diaTextoActivo,
                    !d.abierto && styles.diaTextoCerrado,
                  ]}
                >
                  {d.dia}
                </Text>
                <Text style={[styles.diaMes, elegido && styles.diaTextoActivo]}>
                  {MESES_CORTO[d.mes]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ---------- Qué hora ---------- */}
      <View style={{ gap: Spacing.two }}>
        <Micro>¿A qué hora?</Micro>
        {horas.length === 0 ? (
          <Aviso
            tono="atencion"
            icono="calendar-outline"
            texto={
              !fechaElegida
                ? "Este proveedor todavía no publicó sus horarios — preguntale por el chat."
                : "No quedan espacios libres ese día — probá con otra fecha o escribile."
            }
          />
        ) : (
          <RejillaHoras>
            {horas.map((h) => (
              <Casilla
                key={h}
                texto={horaBonita(h)}
                deshabilitada={abriendo !== null}
                seleccionada={abriendo === h}
                onPress={() => consultarPorHora(h)}
              />
            ))}
          </RejillaHoras>
        )}
        {error && <Aviso tono="error" texto={error} />}
        <Text style={styles.nota}>
          Tocá una hora y se abre el chat con {nombreNegocio} con tu fecha y tu
          servicio ya escritos. No se reserva ni se aparta nada — el precio y la
          disponibilidad los confirma el proveedor.
        </Text>
      </View>

      {onArmarPedido && (
        <Pressable
          accessibilityRole="button"
          onPress={onArmarPedido}
          style={({ pressed }) => [styles.secundario, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.secundarioTexto}>
            ¿Preferís armar el pedido completo y ver el estimado? →
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { alignItems: "center", paddingVertical: Spacing.five },

  diasFila: { gap: Spacing.two, paddingRight: Spacing.three },
  dia: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 10,
    width: 58,
  },
  diaActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  diaCerrado: { backgroundColor: "#fafbfc", borderColor: "#eef0f5" },
  diaDow: {
    color: Colors.inkMuted,
    fontFamily: Fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  diaNumero: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 17, marginVertical: 1 },
  diaMes: {
    color: Colors.inkSoft,
    fontFamily: Fonts.semiBold,
    fontSize: 9.5,
    textTransform: "uppercase",
  },
  diaTextoActivo: { color: "#ffffff" },
  diaTextoCerrado: { color: "#c3c8d2" },

  nota: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, lineHeight: 18 },

  secundario: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  secundarioTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 13 },
});
