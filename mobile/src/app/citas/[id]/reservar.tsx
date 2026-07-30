import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BarraSuperior from "@/components/barra-superior";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { pedirCorreosDeCita } from "@/lib/notificaciones";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";
import {
  DIAS_CORTO,
  MESES_CORTO,
  espaciosLibres,
  etiquetaMinutos,
  fechaISOLocal,
  horaBonita,
  horarioDeDetalles,
  sumarMinutosHora,
  type CitaOcupada,
  type HorarioSemana,
} from "@/lib/citas";

type Servicio = {
  id: string;
  nombre: string;
  precio: number | null;
  duracion_minutos: number | null;
};

type Miembro = { id: string; nombre: string; foto_url: string | null };

/** Cuatro semanas hacia adelante, igual que la agenda de la web. */
const DIAS_VISIBLES = 28;

/**
 * La agenda de citas del app — espejo del modal Fresha de la web
 * (src/app/citas/[slug]/reservar/reservar-cita.tsx): tira de fechas,
 * horas en filas, "¿con quién?", y la barra de resumen abajo con el
 * total y el botón de avanzar. Confirmar llama al mismo RPC
 * crear_cita y los avisos salen por /api/citas/[id]/confirmacion.
 * Reservar exige sesión, como todo el app.
 */
export default function ReservarCitaScreen() {
  const { id, servicio: servicioParam, miembro: miembroParam } = useLocalSearchParams<{
    id: string;
    servicio?: string;
    miembro?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, cargando: cargandoAuth } = useAuth();

  const [cargando, setCargando] = useState(true);
  const [nombreNegocio, setNombreNegocio] = useState<string | null>(null);
  const [fotoNegocio, setFotoNegocio] = useState<string | null>(null);
  const [items, setItems] = useState<Servicio[]>([]);
  const [equipo, setEquipo] = useState<Miembro[]>([]);
  const [horario, setHorario] = useState<HorarioSemana | null>(null);
  const [dias, setDias] = useState<
    { iso: string; dow: number; dia: number; mes: number; abierto: boolean; esHoy: boolean }[]
  >([]);

  const [paso, setPaso] = useState<"hora" | "confirmar">("hora");
  const [servicioId, setServicioId] = useState<string | null>(null);
  const [miembroId, setMiembroId] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [ocupadas, setOcupadas] = useState<CitaOcupada[]>([]);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null); // reservaId

  // Con sesión, el contacto llega precargado (ajuste durante el
  // render): nombre de la cuenta, teléfono aprendido de reservas
  // anteriores vía metadatos.
  const [precargado, setPrecargado] = useState(false);
  if (!precargado && session?.user) {
    setPrecargado(true);
    const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
    const nombreMeta = [meta.nombre, meta.full_name].find(
      (v): v is string => typeof v === "string" && v.trim() !== "",
    );
    const whatsappMeta = meta.whatsapp;
    if (nombreMeta && !nombre) setNombre(nombreMeta);
    if (typeof whatsappMeta === "string" && whatsappMeta.trim() !== "" && !telefono) {
      setTelefono(whatsappMeta);
    }
  }

  const cargar = useCallback(async () => {
    const [n, i, e] = await Promise.all([
      supabase
        .from("ranchos")
        .select("id, nombre, foto_url, detalles")
        .eq("id", id)
        .eq("vertical", "citas")
        .eq("estado", "aprobado")
        .maybeSingle(),
      supabase
        .from("rancho_items")
        .select("id, nombre, precio, duracion_minutos")
        .eq("rancho_id", id)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("equipo_rancho")
        .select("id, nombre, foto_url")
        .eq("rancho_id", id)
        .eq("activo", true)
        .order("orden", { ascending: true }),
    ]);

    const horarioCargado = horarioDeDetalles(n.data?.detalles);
    const listaItems = (i.data ?? []) as Servicio[];

    // Los próximos días con su estado abierto/cerrado, y el primer
    // día abierto como fecha inicial.
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const listaDias = Array.from({ length: DIAS_VISIBLES }, (_, k) => {
      const d = new Date(hoy);
      d.setDate(d.getDate() + k);
      const dow = d.getDay();
      const abierto = horarioCargado
        ? !!(horarioCargado[String(dow)] ?? null)
        : true;
      return {
        iso: fechaISOLocal(d),
        dow,
        dia: d.getDate(),
        mes: d.getMonth(),
        abierto,
        esHoy: k === 0,
      };
    });

    const listaEquipo = (e.data ?? []) as Miembro[];
    setNombreNegocio(n.data?.nombre ?? null);
    setFotoNegocio(n.data?.foto_url ?? null);
    setItems(listaItems);
    setEquipo(listaEquipo);
    setHorario(horarioCargado);
    setDias(listaDias);
    setServicioId(
      servicioParam && listaItems.some((s) => s.id === servicioParam)
        ? servicioParam
        : (listaItems[0]?.id ?? null),
    );
    // "Reservar con X" llega con la persona ya elegida en la URL.
    setMiembroId(
      miembroParam && listaEquipo.some((m) => m.id === miembroParam) ? miembroParam : null,
    );
    setFecha(listaDias.find((d) => d.abierto)?.iso ?? "");
    setCargando(false);
  }, [id, servicioParam, miembroParam]);

  useEffect(() => {
    if (cargandoAuth || !session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga la agenda al montar (con sesión), sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar, session, cargandoAuth]);

  // Al cambiar el día se traen sus citas confirmadas (vista pública).
  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    supabase
      .from("disponibilidad_citas")
      .select("hora_inicio, duracion_minutos, miembro_id")
      .eq("rancho_id", id)
      .eq("fecha", fecha)
      .then(({ data }) => {
        if (vigente) setOcupadas((data ?? []) as CitaOcupada[]);
      });
    return () => {
      vigente = false;
    };
  }, [id, fecha]);

  const servicio = items.find((s) => s.id === servicioId) ?? null;
  const duracion = servicio?.duracion_minutos ?? 30;
  const diaElegido = dias.find((d) => d.iso === fecha);
  const ahora = new Date();
  const horas =
    !diaElegido || !diaElegido.abierto
      ? []
      : espaciosLibres({
          horarioDia: horario ? (horario[String(diaElegido.dow)] ?? null) : { abre: "08:00", cierra: "18:00" },
          duracionServicio: duracion,
          ocupadas,
          miembroId,
          equipoIds: equipo.map((m) => m.id),
          minutosMinimos: diaElegido.esHoy
            ? Math.ceil((ahora.getHours() * 60 + ahora.getMinutes() + 30) / 30) * 30
            : undefined,
        });
  const horaElegida = horas.includes(hora) ? hora : "";

  async function confirmar() {
    if (!servicio || !fecha || !horaElegida || !session) return;
    setError(null);
    setEnviando(true);
    const { data, error: errorRpc } = await supabase.rpc("crear_cita", {
      p_rancho_id: id,
      p_item_id: servicio.id,
      p_fecha: fecha,
      p_hora: horaElegida,
      p_miembro_id: miembroId,
      p_nombre: nombre.trim(),
      p_telefono: telefono.trim(),
      p_notas: notas.trim(),
    });
    setEnviando(false);
    if (errorRpc || !data) {
      setError(errorRpc?.message || "No se pudo crear la cita. Intentá de nuevo.");
      return;
    }
    const reservaId = data as string;
    // Los avisos los manda la web; la próxima cita sale precargada.
    void pedirCorreosDeCita(reservaId);
    void supabase.auth.updateUser({
      data: { nombre: nombre.trim(), whatsapp: telefono.trim() },
    });
    setExito(reservaId);
  }

  if (cargandoAuth || (session && cargando)) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Reservar cita" />
        <View style={styles.centro}>
          <Text style={styles.tituloEstado}>Iniciá sesión para reservar</Text>
          <Text style={styles.textoEstado}>
            Tu cita queda ligada a tu cuenta: ahí ves el comprobante, el chat
            con el negocio y tu historial — y tus datos llegan precargados.
          </Text>
          <Pressable style={styles.botonPrimario} onPress={() => router.push("/cuenta")}>
            <Text style={styles.botonPrimarioTexto}>Iniciar sesión</Text>
          </Pressable>
          <Pressable style={styles.botonSecundario} onPress={() => router.back()}>
            <Text style={styles.botonSecundarioTexto}>Volver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!nombreNegocio) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Reservar cita" />
        <View style={styles.centro}>
          <Text style={styles.tituloEstado}>Este negocio ya no está disponible</Text>
        </View>
      </View>
    );
  }

  if (exito) {
    const dEx = diaElegido;
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Cita confirmada" subtitulo={nombreNegocio} />
        <View style={styles.centro}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={30} color={Colors.green} />
          </View>
          <Text style={styles.tituloEstado}>¡Tu cita quedó confirmada!</Text>
          <Text style={styles.textoEstado}>
            {servicio?.nombre} en {nombreNegocio}
            {dEx ? ` — ${DIAS_CORTO[dEx.dow]} ${dEx.dia} de ${MESES_CORTO[dEx.mes]}` : ""},{" "}
            {horaBonita(hora)}. Te mandamos el comprobante por correo; el pago
            es en el local.
          </Text>
          <Pressable
            style={styles.botonPrimario}
            onPress={() => router.replace(`/mensajes/${exito}` as never)}
          >
            <Text style={styles.botonPrimarioTexto}>Abrir el chat del negocio</Text>
          </Pressable>
          <Pressable style={styles.botonSecundario} onPress={() => router.back()}>
            <Text style={styles.botonSecundarioTexto}>Volver al negocio</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const horaFin = horaElegida ? sumarMinutosHora(horaElegida, duracion) : null;
  const puedeContinuar = !!servicio && !!fecha && !!horaElegida;

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        titulo={paso === "hora" ? "Seleccioná fecha y hora" : "Confirmá tu cita"}
        subtitulo={nombreNegocio}
        onVolver={paso === "confirmar" ? () => setPaso("hora") : undefined}
      />

      <ScrollView contentContainerStyle={styles.contenido}>
        {paso === "hora" ? (
          <>
            {/* Servicio */}
            <Text style={styles.etiqueta}>Servicio</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsFila}>
              {items.map((s) => {
                const activo = s.id === servicioId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setServicioId(s.id)}
                    style={[styles.chipServicio, activo && styles.chipServicioActivo]}
                  >
                    <Text style={[styles.chipServicioNombre, activo && { color: "#fff" }]}>
                      {s.nombre}
                    </Text>
                    <Text style={[styles.chipServicioDetalle, activo && { color: "rgba(255,255,255,0.8)" }]}>
                      {etiquetaMinutos(s.duracion_minutos ?? 30)}
                      {s.precio !== null ? ` · ${fmtColones(s.precio)}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* ¿Con quién? */}
            {equipo.length > 0 && (
              <>
                <Text style={styles.etiqueta}>¿Con quién?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsFila}>
                  <Pressable
                    onPress={() => setMiembroId(null)}
                    style={[styles.chipMiembro, miembroId === null && styles.chipMiembroActivo]}
                  >
                    <Text style={[styles.chipMiembroTexto, miembroId === null && { color: "#fff" }]}>
                      Cualquiera
                    </Text>
                  </Pressable>
                  {equipo.map((m) => {
                    const activo = miembroId === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setMiembroId(m.id)}
                        style={[styles.chipMiembro, activo && styles.chipMiembroActivo]}
                      >
                        {m.foto_url && (
                          <Image
                            source={{ uri: m.foto_url }}
                            alt={m.nombre}
                            style={styles.chipMiembroFoto}
                            contentFit="cover"
                          />
                        )}
                        <Text style={[styles.chipMiembroTexto, activo && { color: "#fff" }]}>
                          {m.nombre.split(" ")[0]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Fecha */}
            <Text style={styles.etiqueta}>Seleccioná una fecha</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.diasFila}>
              {dias.map((d) => {
                const elegido = d.iso === fecha;
                return (
                  <Pressable
                    key={d.iso}
                    disabled={!d.abierto}
                    onPress={() => setFecha(d.iso)}
                    style={[
                      styles.dia,
                      elegido && styles.diaActivo,
                      !d.abierto && styles.diaCerrado,
                    ]}
                  >
                    <Text style={[styles.diaDow, elegido && { color: "rgba(255,255,255,0.85)" }]}>
                      {DIAS_CORTO[d.dow]}
                    </Text>
                    <Text style={[styles.diaNumero, elegido && { color: "#fff" }, !d.abierto && { color: "#c3c8d2" }]}>
                      {d.dia}
                    </Text>
                    <Text style={[styles.diaMes, elegido && { color: "rgba(255,255,255,0.75)" }]}>
                      {MESES_CORTO[d.mes]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Hora */}
            <Text style={styles.etiqueta}>Escogé una hora</Text>
            {horas.length === 0 ? (
              <Text style={styles.sinHoras}>
                No quedan espacios libres ese día — probá con otra fecha
                {equipo.length > 0 ? " u otra persona" : ""}.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {horas.map((h) => {
                  const activa = h === horaElegida;
                  return (
                    <Pressable
                      key={h}
                      onPress={() => setHora(h)}
                      style={[styles.horaFila, activa && styles.horaFilaActiva]}
                    >
                      <Text style={styles.horaTexto}>{horaBonita(h)}</Text>
                      {activa && <Ionicons name="checkmark-circle" size={18} color={Colors.navy} />}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Resumen de lo elegido */}
            <View style={styles.resumen}>
              {fotoNegocio ? (
                <Image
                  source={{ uri: fotoNegocio }}
                  alt={nombreNegocio}
                  style={styles.resumenFoto}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.resumenFotoVacia}>
                  <Ionicons name="time-outline" size={20} color="#3b7fc4" />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.resumenNegocio}>{nombreNegocio}</Text>
                <Text style={styles.resumenDetalle}>
                  {servicio?.nombre}
                  {diaElegido
                    ? ` — ${DIAS_CORTO[diaElegido.dow]} ${diaElegido.dia} de ${MESES_CORTO[diaElegido.mes]}`
                    : ""}
                </Text>
                {horaElegida && horaFin && (
                  <Text style={styles.resumenDetalle}>
                    {horaBonita(horaElegida)} – {horaBonita(horaFin)} ({etiquetaMinutos(duracion)})
                  </Text>
                )}
              </View>
            </View>

            <Text style={styles.etiqueta}>Tus datos</Text>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              placeholder="Tu nombre"
              placeholderTextColor="#9aa1ad"
              style={styles.campo}
            />
            <TextInput
              value={telefono}
              onChangeText={setTelefono}
              placeholder="Tu teléfono (opcional)"
              placeholderTextColor="#9aa1ad"
              keyboardType="phone-pad"
              style={styles.campo}
            />
            <TextInput
              value={notas}
              onChangeText={setNotas}
              placeholder="¿Algo que el negocio deba saber? (opcional)"
              placeholderTextColor="#9aa1ad"
              multiline
              style={[styles.campo, { height: 84, textAlignVertical: "top" }]}
            />
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        )}
      </ScrollView>

      {/* Barra de resumen y avance, pegada abajo */}
      <View style={[styles.barra, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {servicio && (
            <Text style={styles.barraTotal}>
              {servicio.precio !== null ? fmtColones(servicio.precio) : "Precio a consultar"}
            </Text>
          )}
          <Text style={styles.barraNota} numberOfLines={1}>
            {horaElegida && diaElegido
              ? `${DIAS_CORTO[diaElegido.dow]} ${diaElegido.dia} · ${horaBonita(horaElegida)} — pago en el local`
              : "Elegí fecha y hora"}
          </Text>
        </View>
        {paso === "hora" ? (
          <Pressable
            disabled={!puedeContinuar}
            onPress={() => setPaso("confirmar")}
            style={[styles.botonAvanzar, !puedeContinuar && { opacity: 0.4 }]}
          >
            <Text style={styles.botonAvanzarTexto}>Continuar</Text>
            <Ionicons name="arrow-forward" size={15} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            disabled={enviando || !puedeContinuar || !nombre.trim()}
            onPress={confirmar}
            style={[
              styles.botonAvanzar,
              { backgroundColor: Colors.accent },
              (enviando || !nombre.trim()) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.botonAvanzarTexto}>
              {enviando ? "Confirmando…" : "Confirmar cita"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  centro: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center",
    padding: Spacing.five,
  },
  tituloEstado: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 18,
    textAlign: "center",
  },
  textoEstado: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 8,
    textAlign: "center",
  },
  check: {
    alignItems: "center",
    backgroundColor: Colors.greenLight,
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    marginBottom: 4,
    width: 56,
  },
  botonPrimario: {
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  botonPrimarioTexto: { color: "#fff", fontFamily: Fonts.bold, fontSize: 14 },
  botonSecundario: {
    borderColor: "#dbe4f2",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  botonSecundarioTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  contenido: { padding: Spacing.three, paddingBottom: Spacing.five },
  etiqueta: {
    color: Colors.inkSoft,
    fontFamily: Fonts.extraBold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: Spacing.three,
    textTransform: "uppercase",
  },
  chipsFila: { gap: 8, paddingRight: Spacing.three },
  chipServicio: {
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipServicioActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipServicioNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13 },
  chipServicioDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  chipMiembro: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipMiembroActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipMiembroFoto: { borderRadius: 999, height: 22, width: 22 },
  chipMiembroTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5 },
  diasFila: { gap: 8, paddingRight: Spacing.three },
  dia: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 10,
    width: 58,
  },
  diaActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  diaCerrado: { backgroundColor: "#fafbfd", borderColor: "#eef2f9" },
  diaDow: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 10.5 },
  diaNumero: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 16, marginVertical: 1 },
  diaMes: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 10 },
  sinHoras: {
    backgroundColor: "#fafbfe",
    borderColor: "#dbe4f2",
    borderRadius: 14,
    borderWidth: 1,
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    padding: Spacing.three,
  },
  horaFila: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  horaFilaActiva: { borderColor: Colors.navy, borderWidth: 2 },
  horaTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  resumen: {
    alignItems: "center",
    backgroundColor: "#fafbfe",
    borderColor: "#dbe4f2",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: Spacing.two,
    padding: Spacing.three,
  },
  resumenFoto: { borderRadius: 12, height: 48, width: 48 },
  resumenFotoVacia: {
    alignItems: "center",
    backgroundColor: "#e8f0f9",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  resumenNegocio: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 14 },
  resumenDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5, marginTop: 1 },
  campo: {
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 12,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  error: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    color: Colors.danger,
    fontFamily: Fonts.semiBold,
    fontSize: 12.5,
    padding: 12,
  },
  barra: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderTopColor: "#e6edf8",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
  },
  barraTotal: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 17 },
  barraNota: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  botonAvanzar: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 14,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  botonAvanzarTexto: { color: "#fff", fontFamily: Fonts.bold, fontSize: 14 },
});
