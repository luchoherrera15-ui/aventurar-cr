import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";
import {
  CATEGORIA_CITA_LABEL,
  DIAS_SEMANA_LABEL,
  etiquetaMinutos,
  horaBonita,
  horarioDeDetalles,
  normalizarCategoriaCita,
  type HorarioSemana,
} from "@/lib/citas";

type Negocio = {
  id: string;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  provincia: string | null;
  canton: string | null;
  direccion_exacta: string | null;
  foto_url: string | null;
  detalles: unknown;
};

type Servicio = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  duracion_minutos: number | null;
  grupo: string | null;
};

type Miembro = { id: string; nombre: string; rol: string | null; foto_url: string | null };
type Resena = { calificacion: number; comentario: string | null };

type Stats = {
  citasTotales: number;
  clientesAtendidos: number;
  citasPorMiembro: Record<string, number>;
};

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/**
 * La mini-página de un negocio de citas en el app — espejo de
 * /citas/[slug] en la web: servicios con precio y duración, equipo
 * con fotos, horario y reseñas. "Consultar fechas" (o el Reservar de
 * cada servicio) abre la agenda.
 */
export default function NegocioCitasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [items, setItems] = useState<Servicio[]>([]);
  const [equipo, setEquipo] = useState<Miembro[]>([]);
  const [calif, setCalif] = useState<{ promedio: number; total: number } | null>(null);
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [horario, setHorario] = useState<HorarioSemana | null>(null);
  const [cargando, setCargando] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [perfilMiembro, setPerfilMiembro] = useState<Miembro | null>(null);

  const cargar = useCallback(async () => {
    const [n, i, e, c, r] = await Promise.all([
      supabase
        .from("ranchos")
        .select(
          "id, nombre, categoria, descripcion, provincia, canton, direccion_exacta, foto_url, detalles",
        )
        .eq("id", id)
        .eq("vertical", "citas")
        .eq("estado", "aprobado")
        .maybeSingle(),
      supabase
        .from("rancho_items")
        .select("id, nombre, descripcion, precio, duracion_minutos, grupo")
        .eq("rancho_id", id)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("equipo_rancho")
        .select("id, nombre, rol, foto_url")
        .eq("rancho_id", id)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("calificaciones_rancho")
        .select("promedio, total")
        .eq("rancho_id", id)
        .maybeSingle(),
      supabase
        .from("resenas")
        .select("calificacion, comentario")
        .eq("rancho_id", id)
        .order("created_at", { ascending: false })
        .limit(4),
    ]);
    setNegocio((n.data ?? null) as Negocio | null);
    setItems((i.data ?? []) as Servicio[]);
    setEquipo((e.data ?? []) as Miembro[]);
    setCalif((c.data ?? null) as { promedio: number; total: number } | null);
    setResenas((r.data ?? []) as Resena[]);
    setHorario(horarioDeDetalles(n.data?.detalles));
    setCargando(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga el negocio al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  // Los contadores (citas agendadas, clientes atendidos, citas por
  // persona) los sirve la web con números agregados — si falla, la
  // pantalla vive igual sin ellos.
  useEffect(() => {
    let vigente = true;
    fetch(`${SITIO_URL}/api/citas/${id}/stats`)
      .then((r) => r.json())
      .then((d: Stats) => {
        if (vigente) setStats(d);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [id]);

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!negocio) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Citas" />
        <View style={styles.centro}>
          <Text style={styles.tituloEstado}>Este negocio ya no está disponible</Text>
        </View>
      </View>
    );
  }

  const ubicacion = [negocio.canton, negocio.provincia].filter(Boolean).join(", ");

  // Agrupar servicios por sección del catálogo.
  const grupos = new Map<string, Servicio[]>();
  items.forEach((s) => {
    const g = s.grupo?.trim() || "Servicios";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(s);
  });

  const irAReservar = (servicioId?: string, miembroId?: string) => {
    const params = new URLSearchParams();
    if (servicioId) params.set("servicio", servicioId);
    if (miembroId) params.set("miembro", miembroId);
    const query = params.toString();
    router.push(`/citas/${negocio.id}/reservar${query ? `?${query}` : ""}` as never);
  };

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        titulo={negocio.nombre}
        subtitulo="Citas y Reservas"
        onVolver={() => (router.canGoBack() ? router.back() : router.replace("/citas" as never))}
      />
      <ScrollView contentContainerStyle={styles.contenido}>
        {/* ---------- Presentación ---------- */}
        <View style={styles.hero}>
          {negocio.foto_url ? (
            <Image
              source={{ uri: negocio.foto_url }}
              alt={negocio.nombre}
              style={styles.heroFoto}
              contentFit="cover"
              transition={250}
            />
          ) : (
            <View style={styles.heroVacio}>
              <Ionicons name="time-outline" size={40} color="#3b7fc4" />
            </View>
          )}
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeTexto}>
            {CATEGORIA_CITA_LABEL[normalizarCategoriaCita(negocio.categoria)]}
          </Text>
        </View>
        <Text style={styles.nombre}>{negocio.nombre}</Text>
        <View style={styles.filaDatos}>
          {calif && calif.total > 0 && (
            <View style={styles.dato}>
              <Ionicons name="star" size={13} color={Colors.accent} />
              <Text style={styles.datoTexto}>
                {calif.promedio.toFixed(1)}{" "}
                <Text style={styles.datoSuave}>
                  ({calif.total} {calif.total === 1 ? "reseña" : "reseñas"})
                </Text>
              </Text>
            </View>
          )}
          {!!ubicacion && (
            <View style={styles.dato}>
              <Ionicons name="location-outline" size={13} color="#3b7fc4" />
              <Text style={styles.datoSuave}>{ubicacion}</Text>
            </View>
          )}
        </View>
        {!!negocio.descripcion && <Text style={styles.descripcion}>{negocio.descripcion}</Text>}

        {/* Los números que dan confianza — espejo de la web. */}
        {stats && (stats.citasTotales > 0 || stats.clientesAtendidos > 0) && (
          <View style={styles.statsFila}>
            <View style={styles.stat}>
              <Text style={styles.statNumero}>{stats.citasTotales}</Text>
              <Text style={styles.statLabel}>
                cita{stats.citasTotales === 1 ? "" : "s"} agendada{stats.citasTotales === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumero}>{stats.clientesAtendidos}</Text>
              <Text style={styles.statLabel}>
                cliente{stats.clientesAtendidos === 1 ? "" : "s"} atendido{stats.clientesAtendidos === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
        )}

        {items.length > 0 && (
          <Pressable style={styles.botonAgenda} onPress={() => irAReservar()}>
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={styles.botonAgendaTexto}>Consultar fechas</Text>
          </Pressable>
        )}

        {/* ---------- Servicios ---------- */}
        <Text style={styles.seccion}>Servicios</Text>
        {items.length === 0 ? (
          <Text style={styles.aviso}>
            Este negocio todavía no publicó sus servicios.
          </Text>
        ) : (
          [...grupos.entries()].map(([grupo, lista]) => (
            <View key={grupo} style={{ marginTop: Spacing.two }}>
              {grupos.size > 1 && <Text style={styles.grupo}>{grupo}</Text>}
              <View style={styles.tarjetaLista}>
                {lista.map((s, i) => (
                  <View key={s.id} style={[styles.servicio, i > 0 && styles.servicioBorde]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.servicioNombre}>{s.nombre}</Text>
                      <Text style={styles.servicioDetalle} numberOfLines={1}>
                        {etiquetaMinutos(s.duracion_minutos ?? 30)}
                        {s.descripcion ? ` · ${s.descripcion}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.servicioPrecio}>
                      {s.precio !== null ? fmtColones(s.precio) : "Consultar"}
                    </Text>
                    <Pressable style={styles.servicioBoton} onPress={() => irAReservar(s.id)}>
                      <Text style={styles.servicioBotonTexto}>Reservar</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        {/* ---------- Equipo ---------- */}
        {equipo.length > 0 && (
          <>
            <Text style={styles.seccion}>El equipo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.equipoFila}>
              {equipo.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setPerfilMiembro(m)}
                  style={({ pressed }) => [styles.miembro, pressed && { transform: [{ scale: 1.06 }] }]}
                >
                  {m.foto_url ? (
                    <Image
                      source={{ uri: m.foto_url }}
                      alt={m.nombre}
                      style={styles.miembroFoto}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.miembroInicial}>
                      <Text style={styles.miembroInicialTexto}>
                        {m.nombre.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.miembroNombre} numberOfLines={1}>
                    {m.nombre}
                  </Text>
                  {!!m.rol && (
                    <Text style={styles.miembroRol} numberOfLines={1}>
                      {m.rol}
                    </Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* ---------- Horario ---------- */}
        {horario && (
          <>
            <Text style={styles.seccion}>Horario</Text>
            <View style={styles.tarjetaLista}>
              {DIAS_SEMANA_LABEL.map((dia, dow) => {
                const d = horario[String(dow)];
                return (
                  <View key={dia} style={[styles.horarioFila, dow > 0 && styles.servicioBorde]}>
                    <Text style={styles.horarioDia}>{dia}</Text>
                    <Text style={d ? styles.horarioHoras : styles.horarioCerrado}>
                      {d ? `${horaBonita(d.abre)} – ${horaBonita(d.cierra)}` : "Cerrado"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ---------- Reseñas ---------- */}
        {resenas.length > 0 && (
          <>
            <Text style={styles.seccion}>Reseñas</Text>
            {resenas.map((r, i) => (
              <View key={i} style={styles.resena}>
                <View style={{ flexDirection: "row", gap: 1 }}>
                  {Array.from({ length: r.calificacion }, (_, j) => (
                    <Ionicons key={j} name="star" size={12} color={Colors.accent} />
                  ))}
                </View>
                {!!r.comentario && <Text style={styles.resenaTexto}>“{r.comentario}”</Text>}
              </View>
            ))}
          </>
        )}

        {!!negocio.direccion_exacta && (
          <View style={styles.direccion}>
            <Ionicons name="location-outline" size={15} color="#3b7fc4" />
            <Text style={styles.direccionTexto}>{negocio.direccion_exacta}</Text>
          </View>
        )}
      </ScrollView>

      {/* ---------- El perfil de la persona del equipo ---------- */}
      <Modal
        visible={perfilMiembro !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPerfilMiembro(null)}
      >
        <Pressable style={styles.perfilVelo} onPress={() => setPerfilMiembro(null)} />
        <View style={styles.perfilCentro} pointerEvents="box-none">
          {perfilMiembro && (
            <View style={styles.perfilTarjeta}>
              {perfilMiembro.foto_url ? (
                <Image
                  source={{ uri: perfilMiembro.foto_url }}
                  alt={perfilMiembro.nombre}
                  style={styles.perfilFoto}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.perfilFoto, styles.perfilFotoVacia]}>
                  <Text style={styles.perfilInicial}>
                    {perfilMiembro.nombre.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.perfilNombre}>{perfilMiembro.nombre}</Text>
              {!!perfilMiembro.rol && (
                <Text style={styles.perfilRol}>{perfilMiembro.rol}</Text>
              )}
              <View style={styles.perfilChip}>
                <Text style={styles.perfilChipTexto}>
                  {stats?.citasPorMiembro[perfilMiembro.id] ?? 0} cita
                  {(stats?.citasPorMiembro[perfilMiembro.id] ?? 0) === 1 ? "" : "s"}{" "}
                  atendida{(stats?.citasPorMiembro[perfilMiembro.id] ?? 0) === 1 ? "" : "s"} en Bookea
                </Text>
              </View>
              <Pressable
                style={styles.perfilBoton}
                onPress={() => {
                  const m = perfilMiembro;
                  setPerfilMiembro(null);
                  irAReservar(undefined, m.id);
                }}
              >
                <Text style={styles.perfilBotonTexto}>
                  Reservar con {perfilMiembro.nombre.split(" ")[0]}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center", padding: Spacing.five },
  tituloEstado: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 16 },
  contenido: { padding: Spacing.three, paddingBottom: Spacing.six },
  hero: {
    aspectRatio: 16 / 9,
    backgroundColor: "#e8f0f9",
    borderRadius: 20,
    overflow: "hidden",
  },
  heroFoto: { height: "100%", width: "100%" },
  heroVacio: { alignItems: "center", flex: 1, justifyContent: "center" },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#e8f0f9",
    borderRadius: 99,
    marginTop: Spacing.three,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeTexto: {
    color: Colors.navy,
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  nombre: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 24,
    letterSpacing: -0.5,
    marginTop: 6,
  },
  filaDatos: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 },
  dato: { alignItems: "center", flexDirection: "row", gap: 4 },
  datoTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13 },
  datoSuave: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13 },
  descripcion: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 10,
  },
  botonAgenda: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: Spacing.three,
    paddingVertical: 14,
  },
  botonAgendaTexto: { color: "#fff", fontFamily: Fonts.bold, fontSize: 14.5 },
  seccion: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.3,
    marginBottom: Spacing.two,
    marginTop: Spacing.four,
  },
  grupo: {
    color: "#3b7fc4",
    fontFamily: Fonts.extraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  aviso: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13 },
  tarjetaLista: {
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  servicio: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  servicioBorde: { borderTopColor: "#eef3fb", borderTopWidth: 1 },
  servicioNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13.5 },
  servicioDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, marginTop: 1 },
  servicioPrecio: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 13.5 },
  servicioBoton: {
    borderColor: Colors.navy,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  servicioBotonTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
  equipoFila: { gap: Spacing.three, paddingRight: Spacing.three },
  miembro: { alignItems: "center", width: 92 },
  miembroFoto: { borderRadius: 999, height: 72, width: 72 },
  miembroInicial: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 999,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  miembroInicialTexto: { color: "#fff", fontFamily: Fonts.extraBold, fontSize: 24 },
  miembroNombre: {
    color: Colors.ink,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    marginTop: 6,
    textAlign: "center",
  },
  miembroRol: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11 },
  horarioFila: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
  },
  horarioDia: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13 },
  horarioHoras: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13 },
  horarioCerrado: { color: "#9aa1ad", fontFamily: Fonts.semiBold, fontSize: 13 },
  resena: {
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.two,
    padding: Spacing.three,
  },
  resenaTexto: {
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  direccion: {
    alignItems: "flex-start",
    backgroundColor: Colors.surface,
    borderColor: "#dbe4f2",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: Spacing.four,
    padding: Spacing.three,
  },
  direccionTexto: {
    color: Colors.inkSoft,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  statsFila: { flexDirection: "row", gap: 10, marginTop: 12 },
  stat: {
    alignItems: "center",
    backgroundColor: "#f4f7fd",
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  statNumero: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  statLabel: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 11.5 },
  perfilVelo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,18,42,0.5)",
  },
  perfilCentro: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: Spacing.four,
  },
  perfilTarjeta: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: Spacing.four,
    width: "100%",
    maxWidth: 340,
  },
  perfilFoto: { borderRadius: 999, height: 104, width: 104 },
  perfilFotoVacia: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    justifyContent: "center",
  },
  perfilInicial: { color: "#fff", fontFamily: Fonts.extraBold, fontSize: 36 },
  perfilNombre: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 19,
    letterSpacing: -0.4,
    marginTop: 12,
  },
  perfilRol: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 13, marginTop: 2 },
  perfilChip: {
    backgroundColor: "#e8f0f9",
    borderRadius: 99,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  perfilChipTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
  perfilBoton: {
    alignItems: "center",
    backgroundColor: Colors.accent,
    borderRadius: 999,
    marginTop: 16,
    paddingVertical: 13,
    width: "100%",
  },
  perfilBotonTexto: { color: "#fff", fontFamily: Fonts.bold, fontSize: 14 },
});
