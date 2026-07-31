import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/finanzas";
import { horarioDeDetalles, type HorarioSemana } from "@/lib/citas";

/**
 * La vertical de Citas desde el teléfono — la pantalla que en la web
 * vive en /mi-rancho/[id]/citas: quién atiende, a qué horas abre el
 * negocio y las giftcards vendidas.
 *
 * Las tres cosas son las que hacen que la agenda funcione: sin equipo
 * no hay con quién agendar, sin horario no hay cuándo, y las
 * giftcards hay que poder canjearlas en el mostrador — que es
 * justamente donde uno tiene el teléfono y no la computadora.
 */

const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

type Miembro = {
  id: string;
  nombre: string;
  rol: string | null;
  activo: boolean;
  orden: number;
};

type Giftcard = {
  id: string;
  codigo: string;
  monto: number;
  saldo: number;
  comprador_nombre: string | null;
  beneficiario_nombre: string | null;
  estado: "activa" | "canjeada" | "vencida";
};

type Seccion = "equipo" | "horario" | "giftcards";

export default function CitasNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [nombre, setNombre] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [seccion, setSeccion] = useState<Seccion>("equipo");

  const [equipo, setEquipo] = useState<Miembro[]>([]);
  const [horario, setHorario] = useState<HorarioSemana>({});
  const [giftcards, setGiftcards] = useState<Giftcard[]>([]);
  const [detalles, setDetalles] = useState<Record<string, unknown>>({});

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRol, setNuevoRol] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [guardandoHorario, setGuardandoHorario] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    const [ranchoRes, equipoRes, giftRes] = await Promise.all([
      supabase.from("ranchos").select("nombre, detalles").eq("id", id).maybeSingle(),
      supabase
        .from("equipo_rancho")
        .select("id, nombre, rol, activo, orden")
        .eq("rancho_id", id)
        .order("orden"),
      supabase
        .from("giftcards")
        .select("id, codigo, monto, saldo, comprador_nombre, beneficiario_nombre, estado")
        .eq("rancho_id", id)
        .order("created_at", { ascending: false }),
    ]);

    setNombre((ranchoRes.data?.nombre as string) ?? null);
    const d = (ranchoRes.data?.detalles ?? {}) as Record<string, unknown>;
    setDetalles(d);
    setHorario(horarioDeDetalles(d) ?? {});
    setEquipo((equipoRes.data ?? []) as Miembro[]);
    // Un error acá solo significa que la 0059 todavía no corrió: el
    // resto de la pantalla tiene que seguir funcionando igual.
    setGiftcards(giftRes.error ? [] : ((giftRes.data ?? []) as Giftcard[]));
    setCargado(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function agregarMiembro() {
    const limpio = nuevoNombre.trim();
    if (!limpio) return;
    setOcupado("nuevo");
    const { error: err } = await supabase.from("equipo_rancho").insert({
      rancho_id: id,
      nombre: limpio.slice(0, 80),
      rol: nuevoRol.trim().slice(0, 60) || null,
      activo: true,
      orden: equipo.length,
    });
    setOcupado(null);

    if (err) {
      Alert.alert("No se pudo agregar", err.message);
      return;
    }
    setNuevoNombre("");
    setNuevoRol("");
    await cargar();
  }

  async function alternarMiembro(miembro: Miembro) {
    setOcupado(miembro.id);
    // Optimista: la fila cambia ya y se revierte sola si falla.
    setEquipo((prev) =>
      prev.map((m) => (m.id === miembro.id ? { ...m, activo: !m.activo } : m)),
    );
    const { error: err } = await supabase
      .from("equipo_rancho")
      .update({ activo: !miembro.activo })
      .eq("id", miembro.id)
      .eq("rancho_id", id);
    setOcupado(null);

    if (err) {
      setEquipo((prev) =>
        prev.map((m) => (m.id === miembro.id ? { ...m, activo: miembro.activo } : m)),
      );
      Alert.alert("No se pudo guardar", err.message);
    }
  }

  function borrarMiembro(miembro: Miembro) {
    Alert.alert(
      `¿Quitar a ${miembro.nombre}?`,
      "Las citas que ya tiene agendadas no se borran, pero deja de aparecer para agendar nuevas.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Quitar",
          style: "destructive",
          onPress: async () => {
            const { error: err } = await supabase
              .from("equipo_rancho")
              .delete()
              .eq("id", miembro.id)
              .eq("rancho_id", id);
            if (err) {
              Alert.alert("No se pudo quitar", err.message);
              return;
            }
            await cargar();
          },
        },
      ],
    );
  }

  /** Guarda la semana entera, reconstruida limpia como en la web. */
  async function guardarHorario() {
    setError(null);
    setMensaje(null);

    const limpio: HorarioSemana = {};
    for (let dow = 0; dow < 7; dow++) {
      const dia = horario[String(dow)];
      if (!dia) {
        limpio[String(dow)] = null;
        continue;
      }
      if (!HORA_REGEX.test(dia.abre) || !HORA_REGEX.test(dia.cierra)) {
        setError(`Revisá las horas del ${DIAS[dow].toLowerCase()}: van como 09:00.`);
        return;
      }
      if (dia.abre >= dia.cierra) {
        setError(`El ${DIAS[dow].toLowerCase()} cierra antes de abrir.`);
        return;
      }
      limpio[String(dow)] = { abre: dia.abre, cierra: dia.cierra };
    }

    setGuardandoHorario(true);
    const { error: err } = await supabase
      .from("ranchos")
      // Se mezcla con lo que ya había: `detalles` guarda muchas otras
      // cosas del negocio y pisarlo entero las borraría.
      .update({ detalles: { ...detalles, horario_citas: limpio } })
      .eq("id", id);
    setGuardandoHorario(false);

    if (err) {
      setError("No se pudo guardar: " + err.message);
      return;
    }
    setMensaje("Horario guardado.");
    await cargar();
  }

  function cambiarDia(dow: number, campo: "abre" | "cierra", valor: string) {
    const clave = String(dow);
    const actual = horario[clave] ?? { abre: "09:00", cierra: "17:00" };
    setHorario({ ...horario, [clave]: { ...actual, [campo]: valor } });
  }

  function alternarDia(dow: number) {
    const clave = String(dow);
    setHorario({
      ...horario,
      [clave]: horario[clave] ? null : { abre: "09:00", cierra: "17:00" },
    });
  }

  if (!cargado) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Citas" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Citas" subtitulo={nombre ?? undefined} />

      <View style={styles.pestanas}>
        {(
          [
            { id: "equipo" as const, label: "Equipo" },
            { id: "horario" as const, label: "Horario" },
            { id: "giftcards" as const, label: "Giftcards" },
          ]
        ).map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setSeccion(p.id)}
            style={[styles.pestana, seccion === p.id && styles.pestanaActiva]}
          >
            <Text style={[styles.pestanaTexto, seccion === p.id && styles.pestanaTextoActiva]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {seccion === "equipo" && (
          <>
            <View style={styles.bloque}>
              <Text style={styles.bloqueTitulo}>Quién atiende</Text>
              <Text style={styles.bloqueAyuda}>
                El cliente elige con quién quiere su cita. Apagá a alguien para
                que deje de aparecer sin borrarlo.
              </Text>

              {equipo.length === 0 ? (
                <Text style={styles.vacio}>
                  Todavía no agregaste a nadie. Sin equipo, tus clientes no
                  pueden agendar.
                </Text>
              ) : (
                equipo.map((m) => (
                  <View key={m.id} style={styles.filaMiembro}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarTexto}>
                        {m.nombre.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.miembroNombre} numberOfLines={1}>
                        {m.nombre}
                      </Text>
                      {!!m.rol && (
                        <Text style={styles.miembroRol} numberOfLines={1}>
                          {m.rol}
                        </Text>
                      )}
                    </View>
                    <Switch
                      value={m.activo}
                      disabled={ocupado === m.id}
                      trackColor={{ true: Colors.navy }}
                      onValueChange={() => alternarMiembro(m)}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar a ${m.nombre}`}
                      onPress={() => borrarMiembro(m)}
                      hitSlop={8}
                      style={styles.botonQuitar}
                    >
                      <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            <View style={styles.bloque}>
              <Text style={styles.bloqueTitulo}>Agregar a alguien</Text>
              <TextInput
                value={nuevoNombre}
                onChangeText={setNuevoNombre}
                placeholder="Nombre"
                placeholderTextColor={Colors.inkMuted}
                maxLength={80}
                style={styles.input}
              />
              <TextInput
                value={nuevoRol}
                onChangeText={setNuevoRol}
                placeholder="Rol (estilista, barbero, manicurista...)"
                placeholderTextColor={Colors.inkMuted}
                maxLength={60}
                style={styles.input}
              />
              <Pressable
                style={styles.botonPrimario}
                disabled={!nuevoNombre.trim() || ocupado === "nuevo"}
                onPress={agregarMiembro}
              >
                {ocupado === "nuevo" ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.botonPrimarioTexto}>Agregar al equipo</Text>
                )}
              </Pressable>
            </View>
          </>
        )}

        {seccion === "horario" && (
          <View style={styles.bloque}>
            <Text style={styles.bloqueTitulo}>Horario de la semana</Text>
            <Text style={styles.bloqueAyuda}>
              Las horas van como 09:00. Los días apagados son los que no abrís.
            </Text>

            {DIAS.map((dia, dow) => {
              const abierto = Boolean(horario[String(dow)]);
              const d = horario[String(dow)];
              return (
                <View key={dia} style={styles.filaDia}>
                  <View style={styles.diaEncabezado}>
                    <Text style={[styles.diaNombre, !abierto && styles.diaCerrado]}>{dia}</Text>
                    <Switch
                      value={abierto}
                      trackColor={{ true: Colors.navy }}
                      onValueChange={() => alternarDia(dow)}
                    />
                  </View>
                  {abierto && (
                    <View style={styles.horas}>
                      <View style={styles.campoHora}>
                        <Text style={styles.campoHoraEtiqueta}>Abre</Text>
                        <TextInput
                          value={d?.abre ?? ""}
                          onChangeText={(v) => cambiarDia(dow, "abre", v)}
                          placeholder="09:00"
                          placeholderTextColor={Colors.inkMuted}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.campoHora}>
                        <Text style={styles.campoHoraEtiqueta}>Cierra</Text>
                        <TextInput
                          value={d?.cierra ?? ""}
                          onChangeText={(v) => cambiarDia(dow, "cierra", v)}
                          placeholder="17:00"
                          placeholderTextColor={Colors.inkMuted}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={styles.input}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {error && <Text style={styles.error}>{error}</Text>}
            {mensaje && <Text style={styles.exito}>{mensaje}</Text>}

            <Pressable
              style={styles.botonPrimario}
              disabled={guardandoHorario}
              onPress={guardarHorario}
            >
              {guardandoHorario ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.botonPrimarioTexto}>Guardar horario</Text>
              )}
            </Pressable>
          </View>
        )}

        {seccion === "giftcards" && (
          <View style={styles.bloque}>
            <Text style={styles.bloqueTitulo}>Giftcards vendidas</Text>
            <Text style={styles.bloqueAyuda}>
              Buscá el código que te muestra el cliente para ver cuánto saldo le
              queda antes de cobrarle.
            </Text>

            {giftcards.length === 0 ? (
              <Text style={styles.vacio}>Todavía no vendiste giftcards.</Text>
            ) : (
              giftcards.map((g) => (
                <View key={g.id} style={styles.filaGift}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.giftCodigo}>{g.codigo}</Text>
                    <Text style={styles.giftDetalle} numberOfLines={1}>
                      {g.beneficiario_nombre || g.comprador_nombre || "Sin nombre"}
                      {" · de "}
                      {fmtColones(Number(g.monto))}
                    </Text>
                  </View>
                  <View style={styles.giftSaldo}>
                    <Text
                      style={[
                        styles.giftSaldoMonto,
                        g.estado !== "activa" && styles.giftSaldoGastado,
                      ]}
                    >
                      {fmtColones(Number(g.saldo))}
                    </Text>
                    <Text style={styles.giftEstado}>
                      {g.estado === "activa"
                        ? "disponible"
                        : g.estado === "canjeada"
                          ? "canjeada"
                          : "vencida"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  scroll: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },

  pestanas: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pestana: {
    borderColor: Colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 9,
  },
  pestanaActiva: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pestanaTexto: {
    color: Colors.ink,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    textAlign: "center",
  },
  pestanaTextoActiva: { color: "#ffffff" },

  bloque: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  bloqueTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  bloqueAyuda: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17 },
  vacio: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    paddingVertical: Spacing.two,
  },

  filaMiembro: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: Radios.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarTexto: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 15 },
  miembroNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  miembroRol: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  botonQuitar: {
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    height: 32,
    justifyContent: "center",
    width: 32,
  },

  filaDia: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  diaEncabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  diaNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  diaCerrado: { color: Colors.inkMuted },
  horas: { flexDirection: "row", gap: Spacing.two },
  campoHora: { flex: 1, gap: 3 },
  campoHoraEtiqueta: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 10.5 },

  filaGift: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  giftCodigo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  giftDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  giftSaldo: { alignItems: "flex-end" },
  giftSaldoMonto: { color: Colors.green, fontFamily: Fonts.extraBold, fontSize: 14.5 },
  giftSaldoGastado: { color: Colors.inkMuted },
  giftEstado: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 10.5 },

  input: {
    backgroundColor: Colors.cream,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  error: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    color: Colors.danger,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    padding: Spacing.two,
  },
  exito: {
    backgroundColor: Colors.greenLight,
    borderRadius: Radios.sm,
    color: Colors.green,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    padding: Spacing.two,
  },
  botonPrimario: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 12,
    marginTop: Spacing.one,
    paddingVertical: 13,
  },
  botonPrimarioTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 14 },
});
