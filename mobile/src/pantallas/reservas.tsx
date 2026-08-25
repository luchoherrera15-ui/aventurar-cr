import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ResenaModal from "@/components/resena-modal";
import CancelarReservaModal from "@/components/cancelar-reserva-modal";
import { Estado, Micro, Tarjeta, Vacio, type TonoEstado } from "@/components/ui";
import { CATEGORIA_LABEL, fmtColones } from "@/lib/types";
import { CATEGORIA_CITA_LABEL, DIAS_CORTO, MESES_CORTO, horaBonita } from "@/lib/citas";
import { hoyISOLocal } from "@/lib/busqueda";
import { CATEGORIA_HOSPEDAJE_LABEL } from "@/lib/hospedajes";

/**
 * Pestaña de reservas: lo que viene (pendiente o confirmado) arriba, y
 * el historial abajo. La lista se recarga cada vez que la pestaña gana
 * foco porque los estados cambian del lado del proveedor.
 *
 * Cada reserva usa la misma barra navy a la izquierda y la misma
 * píldora de estado que la agenda del negocio — es la otra cara de la
 * misma reserva, así que se ve igual.
 */

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "En revisión",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
  // Estados de citas (0061): el negocio marca la asistencia.
  cumplida: "Cumplida",
  no_asistio: "No asististe",
  cancelada: "Cancelada",
};

const ESTADO_TONO: Record<string, TonoEstado> = {
  pendiente: "naranja",
  confirmada: "verde",
  rechazada: "rojo",
  cumplida: "verde",
  no_asistio: "rojo",
  cancelada: "gris",
};

// Estados finales: viven en el historial aunque la fecha sea hoy.
const ESTADOS_FINALES = new Set(["rechazada", "cumplida", "no_asistio", "cancelada"]);

type ReservaCliente = {
  id: string;
  fecha: string;
  estado: string;
  monto_total: number | null;
  horario_bloque: string | null;
  hora_inicio: string | null;
  rancho_id: string | null;
  ranchos: { nombre: string; foto_url: string | null; categoria: string } | null;
};

/** "2026-08-08" → "vie 8 ago 2026" sin corrimiento de zona horaria. */
function fechaBonita(fecha: string): string {
  const d = new Date(fecha + "T00:00:00");
  return `${DIAS_CORTO[d.getDay()]} ${d.getDate()} ${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}`;
}

/** Etiqueta de la categoría cruzando las cuatro verticales. */
function etiquetaCategoria(cat: string): string {
  return (
    (CATEGORIA_LABEL as Record<string, string>)[cat] ??
    (CATEGORIA_CITA_LABEL as Record<string, string>)[cat] ??
    (CATEGORIA_HOSPEDAJE_LABEL as Record<string, string>)[cat] ??
    cat
  );
}

type ResenaPropia = {
  id: string;
  reserva_id: string;
  calificacion: number;
  comentario: string | null;
};

export default function ReservasScreen({ activa = true }: { activa?: boolean }) {
  const router = useRouter();
  const { session, cargando } = useAuth();
  const [reservas, setReservas] = useState<ReservaCliente[] | null>(null);
  const [resenasPropias, setResenasPropias] = useState<Map<string, ResenaPropia>>(new Map());
  const [resenaAbierta, setResenaAbierta] = useState<ReservaCliente | null>(null);
  const [cancelarAbierta, setCancelarAbierta] = useState<ReservaCliente | null>(null);

  const cargar = useCallback(() => {
    if (!session) return;
    let vigente = true;
    Promise.all([
      supabase
        .from("reservas")
        .select(
          "id, fecha, estado, monto_total, horario_bloque, hora_inicio, rancho_id, ranchos(nombre, foto_url, categoria)",
        )
        .eq("cliente_id", session.user.id)
        // Con los estados de citas: una cita cumplida sigue siendo
        // historial (y habilita la reseña), no puede desaparecer.
        .in("estado", [
          "pendiente",
          "confirmada",
          "rechazada",
          "cumplida",
          "no_asistio",
          "cancelada",
        ])
        .order("fecha", { ascending: false }),
      supabase
        .from("resenas")
        .select("id, reserva_id, calificacion, comentario")
        .eq("cliente_id", session.user.id),
    ]).then(([{ data }, { data: resenasData }]) => {
      if (!vigente) return;
      setReservas((data ?? []) as unknown as ReservaCliente[]);
      setResenasPropias(
        new Map(((resenasData ?? []) as ResenaPropia[]).map((r) => [r.reserva_id, r])),
      );
    });
    return () => {
      vigente = false;
    };
  }, [session]);

  // Recarga al ganar foco y al deslizar hasta esta página del pager.
  useFocusEffect(cargar);
  useEffect(() => {
    if (activa) return cargar();
  }, [activa, cargar]);

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.raiz}>
        <EspacioBarraEstado />
        <View style={styles.centrado}>
          <Vacio
            icono="calendar-outline"
            titulo="Iniciá sesión"
            texto="Entrá a tu cuenta para ver tus reservas activas y tu historial."
            accion={{
              texto: "Ir a mi perfil",
              onPress: () => router.replace("/?tab=perfil" as never),
            }}
          />
        </View>
      </View>
    );
  }

  // OJO: nunca `new Date().toISOString().slice(0, 10)` acá — eso da la
  // fecha en UTC, y entre las 6pm y medianoche hora CR ya es "mañana"
  // en UTC. La política de la base habilita reseñar una reserva
  // confirmada recién AL DÍA SIGUIENTE (hora de Costa Rica): con la
  // fecha en UTC, esas horas mostraban el botón de reseña un día antes
  // de que la base lo fuera a aceptar, y el guardado fallaba con un
  // error de RLS. `hoyISOLocal` (mismo helper que ya usa Explorar) lee
  // el reloj del teléfono, no UTC.
  const hoy = hoyISOLocal();
  const activas = (reservas ?? []).filter(
    (r) => !ESTADOS_FINALES.has(r.estado) && r.fecha >= hoy,
  );
  const historial = (reservas ?? []).filter(
    (r) => ESTADOS_FINALES.has(r.estado) || r.fecha < hoy,
  );

  return (
    <View style={styles.raiz}>
      <EspacioBarraEstado />
      {reservas === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : reservas.length === 0 ? (
        <View style={styles.centrado}>
          <Vacio
            icono="calendar-outline"
            titulo="Todavía no tenés reservas"
            texto="Cuando reservés un lugar, una cita, una mesa o una noche, lo vas a ver acá con su estado."
            accion={{
              texto: "Explorar",
              onPress: () => router.replace("/?tab=explorar" as never),
            }}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          <Seccion titulo="En curso" vacio="Nada en curso por ahora.">
            {activas.map((r) => (
              <TarjetaReserva
                key={r.id}
                reserva={r}
                onCancelar={
                  r.estado === "pendiente" || r.estado === "confirmada"
                    ? () => setCancelarAbierta(r)
                    : undefined
                }
              />
            ))}
          </Seccion>
          <Seccion titulo="Historial" vacio="Acá vas a ver tus reservas pasadas.">
            {historial.map((r) => (
              <TarjetaReserva
                key={r.id}
                reserva={r}
                atenuada
                resena={resenasPropias.get(r.id) ?? null}
                onResena={
                  (r.estado === "confirmada" || r.estado === "cumplida") && r.rancho_id
                    ? () => setResenaAbierta(r)
                    : undefined
                }
                /* ── SIN «Cancelar reserva» EN EL HISTORIAL ──────────
                   Acá había el mismo `onCancelar` que la lista de «En
                   curso», y eso dejaba cancelar algo que YA PASÓ: una
                   reserva `confirmada` con fecha de ayer cae en este
                   historial (ver el filtro de arriba: entra por estado
                   final O por fecha vencida) y seguía mostrando el
                   botón en rojo.

                   No lleva condición porque no hace falta: TODO lo que
                   está en esta lista o terminó en un estado final o ya
                   pasó de fecha, y ninguno de los dos se cancela. Lo
                   que sí queda es «Dejá tu reseña», que es lo que de
                   verdad se hace con una reserva cumplida. */
              />
            ))}
          </Seccion>
        </ScrollView>
      )}

      {resenaAbierta && resenaAbierta.rancho_id && (
        <ResenaModal
          visible
          reservaId={resenaAbierta.id}
          ranchoId={resenaAbierta.rancho_id}
          nombreRancho={resenaAbierta.ranchos?.nombre ?? "el proveedor"}
          clienteId={session.user.id}
          resenaExistente={resenasPropias.get(resenaAbierta.id) ?? null}
          onCerrar={() => setResenaAbierta(null)}
          onGuardada={() => cargar()}
        />
      )}

      {cancelarAbierta && (
        <CancelarReservaModal
          visible
          reservaId={cancelarAbierta.id}
          clienteId={session.user.id}
          nombreRancho={cancelarAbierta.ranchos?.nombre ?? "el proveedor"}
          onCerrar={() => setCancelarAbierta(null)}
          onCancelada={() => cargar()}
        />
      )}
    </View>
  );
}

function Seccion({
  titulo,
  vacio,
  children,
}: {
  titulo: string;
  vacio: string;
  children: React.ReactNode;
}) {
  const hayContenido = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <View style={styles.bloque}>
      <Micro>{titulo}</Micro>
      {hayContenido ? (
        <View style={{ gap: Spacing.two }}>{children}</View>
      ) : (
        <Text style={styles.hint}>{vacio}</Text>
      )}
    </View>
  );
}

function TarjetaReserva({
  reserva,
  atenuada,
  resena,
  onResena,
  onCancelar,
}: {
  reserva: ReservaCliente;
  atenuada?: boolean;
  resena?: ResenaPropia | null;
  /** Presente solo cuando la reserva se puede reseñar (confirmada). */
  onResena?: () => void;
  /** Presente solo cuando la reserva se puede cancelar (pendiente/confirmada). */
  onCancelar?: () => void;
}) {
  const router = useRouter();
  const tono = ESTADO_TONO[reserva.estado] ?? "gris";
  return (
    <Tarjeta style={[styles.tarjetaReserva, atenuada && styles.tarjetaAtenuada]}>
      {/* La barra de estado a la izquierda: verde cerrado, naranja
          esperando, gris pasado — se lee de un vistazo en la lista. */}
      <View
        style={[
          styles.barraEstado,
          {
            backgroundColor:
              tono === "verde"
                ? Colors.green
                : tono === "naranja"
                  ? Colors.accent
                  : tono === "rojo"
                    ? Colors.danger
                    : Colors.line,
          },
        ]}
      />
      <View style={styles.filaPrincipal}>
        <Image
          source={reserva.ranchos?.foto_url ? { uri: reserva.ranchos.foto_url } : undefined}
          style={styles.fotoReserva}
          contentFit="cover"
          alt={reserva.ranchos?.nombre ?? ""}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Micro>{reserva.ranchos ? etiquetaCategoria(reserva.ranchos.categoria) : ""}</Micro>
          <Text style={styles.nombreReserva} numberOfLines={1}>
            {reserva.ranchos?.nombre ?? "Proveedor"}
          </Text>
          <Text style={styles.fechaReserva}>
            {fechaBonita(reserva.fecha)}
            {reserva.hora_inicio
              ? ` · ${horaBonita(reserva.hora_inicio)}`
              : reserva.horario_bloque
                ? ` · ${reserva.horario_bloque}`
                : ""}
          </Text>
          {reserva.monto_total !== null && (
            <Text style={styles.montoReserva}>{fmtColones(reserva.monto_total)}</Text>
          )}
        </View>
        <Estado texto={ESTADO_LABEL[reserva.estado] ?? reserva.estado} tono={tono} />
      </View>

      <View style={styles.filaAcciones}>
        <Pressable onPress={() => router.push(`/mensajes/${reserva.id}`)} hitSlop={8}>
          <Text style={styles.botonMensajesTexto}>Mensajes →</Text>
        </Pressable>
        {onResena && (
          <Pressable onPress={onResena} style={styles.botonResena} hitSlop={8}>
            <Ionicons name={resena ? "star" : "star-outline"} size={13} color={Colors.accent} />
            <Text style={styles.botonResenaTexto}>
              {resena ? `Tu reseña: ${resena.calificacion}★ — editar` : "Dejar reseña"}
            </Text>
          </Pressable>
        )}
        {onCancelar && (
          <Pressable onPress={onCancelar} hitSlop={8}>
            <Text style={styles.botonCancelarTexto}>Cancelar reserva</Text>
          </Pressable>
        )}
      </View>
    </Tarjeta>
  );
}

/**
 * El único aire de arriba: el de la barra de estado del teléfono.
 *
 * Antes acá iba `TituloPantalla` con «Tu actividad · Reservas · Lo que
 * tenés en curso y lo que ya pasó». El dueño lo sacó para aprovechar
 * la pantalla, y tiene razón: la pestaña de abajo ya dice «Reservas»,
 * así que el título repetía el rótulo y se comía los primeros 90px —
 * en un teléfono, media reserva.
 *
 * Sin ESTE hueco el contenido queda debajo de la hora y la batería.
 */
function EspacioBarraEstado() {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top + 8 }} />;
}

const styles = StyleSheet.create({
  raiz: { backgroundColor: Colors.canvas, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  centrado: { flex: 1, justifyContent: "center", paddingHorizontal: Spacing.three },
  lista: { gap: Spacing.four, padding: Spacing.three, paddingBottom: TAB_BAR_ESPACIO },

  bloque: { gap: Spacing.two + 2 },
  hint: {
    backgroundColor: Colors.cream2,
    borderRadius: Radios.md,
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    padding: Spacing.three,
    textAlign: "center",
  },

  tarjetaReserva: {
    gap: Spacing.two,
    overflow: "hidden",
    paddingHorizontal: Spacing.three,
    paddingLeft: Spacing.three + 4,
    paddingVertical: Spacing.three,
  },
  tarjetaAtenuada: { opacity: 0.72 },
  barraEstado: { bottom: 0, left: 0, position: "absolute", top: 0, width: 4 },
  filaPrincipal: { alignItems: "center", flexDirection: "row", gap: Spacing.two + 2 },
  fotoReserva: {
    backgroundColor: Colors.cream2,
    borderRadius: Radios.sm,
    height: 56,
    width: 56,
  },
  nombreReserva: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    letterSpacing: -0.2,
    marginTop: 3,
  },
  fechaReserva: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5, marginTop: 2 },
  montoReserva: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5, marginTop: 2 },

  filaAcciones: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  botonMensajesTexto: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 12.5 },
  botonResena: { alignItems: "center", flexDirection: "row", gap: 4 },
  botonResenaTexto: { color: Colors.accent, fontFamily: Fonts.extraBold, fontSize: 12.5 },
  botonCancelarTexto: { color: Colors.danger, fontFamily: Fonts.extraBold, fontSize: 12.5 },
});
