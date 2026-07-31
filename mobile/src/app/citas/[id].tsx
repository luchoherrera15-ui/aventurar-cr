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
import {
  Avatar,
  Boton,
  Estado,
  FilaLista,
  Lista,
  Micro,
  Tarjeta,
  Vacio,
  iniciales,
} from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
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
 * La mini-página de un negocio de servicios — espejo de /citas/[slug]
 * en la web, en el lenguaje de la marca: la foto a sangre arriba, la
 * identidad del negocio (iniciales, nota y zona) sobre ella, y debajo
 * los bloques rotulados — servicios, equipo, horario, reseñas. El
 * "Reservar" naranja es siempre el mismo botón que en las otras tres
 * verticales.
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
        <BarraSuperior kicker="Servicios" titulo="Negocio" />
        <View style={styles.centrado}>
          <Vacio
            icono="close-circle-outline"
            titulo="Este negocio ya no está disponible"
            accion={{
              texto: "Ver otros negocios",
              onPress: () => router.replace("/citas" as never),
            }}
          />
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
        kicker="Servicios"
        titulo={negocio.nombre}
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
              <Ionicons name="time-outline" size={40} color={Colors.blue} />
            </View>
          )}
          <View style={styles.heroEtiqueta}>
            <Text style={styles.heroEtiquetaTexto}>
              {CATEGORIA_CITA_LABEL[normalizarCategoriaCita(negocio.categoria)]}
            </Text>
          </View>
        </View>

        {/* La identidad, montada sobre la foto: el encabezado del mockup. */}
        <Tarjeta style={styles.identidad}>
          <View style={styles.identidadFila}>
            <Avatar nombre={negocio.nombre} tamano={46} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.nombre} numberOfLines={2}>
                {negocio.nombre}
              </Text>
              <View style={styles.meta}>
                {calif && calif.total > 0 && (
                  <>
                    <Ionicons name="star" size={12} color={Colors.accent} />
                    <Text style={styles.metaFuerte}>{calif.promedio.toFixed(1)}</Text>
                    <Text style={styles.metaTexto}>({calif.total})</Text>
                  </>
                )}
                <Text style={styles.metaTexto} numberOfLines={1}>
                  {calif && calif.total > 0 ? "· " : ""}
                  {CATEGORIA_CITA_LABEL[normalizarCategoriaCita(negocio.categoria)]}
                  {ubicacion ? ` · ${ubicacion}` : ""}
                </Text>
              </View>
            </View>
          </View>

          {!!negocio.descripcion && (
            <Text style={styles.descripcion}>{negocio.descripcion}</Text>
          )}

          {/* Los números que dan confianza — espejo de la web. */}
          {stats && (stats.citasTotales > 0 || stats.clientesAtendidos > 0) && (
            <View style={styles.statsFila}>
              {stats.citasTotales > 0 && (
                <Estado
                  tono="gris"
                  texto={`${stats.citasTotales} cita${stats.citasTotales === 1 ? "" : "s"} agendada${stats.citasTotales === 1 ? "" : "s"}`}
                />
              )}
              {stats.clientesAtendidos > 0 && (
                <Estado
                  tono="gris"
                  texto={`${stats.clientesAtendidos} cliente${stats.clientesAtendidos === 1 ? "" : "s"}`}
                />
              )}
            </View>
          )}

          {items.length > 0 && (
            <Boton
              texto="Ver fechas disponibles"
              tono="navy"
              icono="calendar-outline"
              onPress={() => irAReservar()}
              style={{ marginTop: Spacing.three }}
            />
          )}
        </Tarjeta>

        {/* ---------- Servicios ---------- */}
        <View style={styles.bloque}>
          <Micro>Elegí tu servicio</Micro>
          {items.length === 0 ? (
            <Text style={styles.aviso}>Este negocio todavía no publicó sus servicios.</Text>
          ) : (
            [...grupos.entries()].map(([grupo, lista]) => (
              <View key={grupo} style={{ gap: Spacing.two }}>
                {grupos.size > 1 && <Text style={styles.grupo}>{grupo}</Text>}
                <Lista>
                  {lista.map((s, i) => (
                    <FilaLista key={s.id} primera={i === 0}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.servicioNombre} numberOfLines={1}>
                          {s.nombre}
                        </Text>
                        <Text style={styles.servicioDetalle} numberOfLines={1}>
                          {etiquetaMinutos(s.duracion_minutos ?? 30)}
                          {s.precio !== null ? ` · ${fmtColones(s.precio)}` : " · Consultar"}
                          {s.descripcion ? ` · ${s.descripcion}` : ""}
                        </Text>
                      </View>
                      <Pressable
                        style={({ pressed }) => [
                          styles.servicioBoton,
                          pressed && { opacity: 0.85 },
                        ]}
                        onPress={() => irAReservar(s.id)}
                      >
                        <Text style={styles.servicioBotonTexto}>Reservar</Text>
                      </Pressable>
                    </FilaLista>
                  ))}
                </Lista>
              </View>
            ))
          )}
        </View>

        {/* ---------- Equipo ---------- */}
        {equipo.length > 0 && (
          <View style={styles.bloque}>
            <Micro>¿Con quién?</Micro>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.equipoFila}
            >
              {equipo.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setPerfilMiembro(m)}
                  style={({ pressed }) => [styles.miembro, pressed && { opacity: 0.85 }]}
                >
                  {m.foto_url ? (
                    <Image
                      source={{ uri: m.foto_url }}
                      alt={m.nombre}
                      style={styles.miembroFoto}
                      contentFit="cover"
                    />
                  ) : (
                    <Avatar nombre={m.nombre} tamano={68} />
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
          </View>
        )}

        {/* ---------- Horario ---------- */}
        {horario && (
          <View style={styles.bloque}>
            <Micro>Horario</Micro>
            <Lista>
              {DIAS_SEMANA_LABEL.map((dia, dow) => {
                const d = horario[String(dow)];
                return (
                  <FilaLista key={dia} primera={dow === 0}>
                    <Text style={styles.horarioDia}>{dia}</Text>
                    <Text style={d ? styles.horarioHoras : styles.horarioCerrado}>
                      {d ? `${horaBonita(d.abre)} – ${horaBonita(d.cierra)}` : "Cerrado"}
                    </Text>
                  </FilaLista>
                );
              })}
            </Lista>
          </View>
        )}

        {/* ---------- Reseñas ---------- */}
        {resenas.length > 0 && (
          <View style={styles.bloque}>
            <Micro>Lo que dicen</Micro>
            {resenas.map((r, i) => (
              <Tarjeta key={i} style={styles.resena}>
                <View style={{ flexDirection: "row", gap: 1 }}>
                  {Array.from({ length: r.calificacion }, (_, j) => (
                    <Ionicons key={j} name="star" size={12} color={Colors.accent} />
                  ))}
                </View>
                {!!r.comentario && <Text style={styles.resenaTexto}>“{r.comentario}”</Text>}
              </Tarjeta>
            ))}
          </View>
        )}

        {!!negocio.direccion_exacta && (
          <View style={styles.bloque}>
            <Micro>Dónde queda</Micro>
            <Tarjeta style={styles.direccion}>
              <Ionicons name="location-outline" size={16} color={Colors.blue} />
              <Text style={styles.direccionTexto}>{negocio.direccion_exacta}</Text>
            </Tarjeta>
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
                  <Text style={styles.perfilInicial}>{iniciales(perfilMiembro.nombre)}</Text>
                </View>
              )}
              <Text style={styles.perfilNombre}>{perfilMiembro.nombre}</Text>
              {!!perfilMiembro.rol && <Text style={styles.perfilRol}>{perfilMiembro.rol}</Text>}
              <View style={{ marginTop: Spacing.three }}>
                <Estado
                  tono="gris"
                  texto={`${stats?.citasPorMiembro[perfilMiembro.id] ?? 0} cita${(stats?.citasPorMiembro[perfilMiembro.id] ?? 0) === 1 ? "" : "s"} en Bookea`}
                />
              </View>
              <Boton
                texto={`Reservar con ${perfilMiembro.nombre.split(" ")[0]}`}
                onPress={() => {
                  const m = perfilMiembro;
                  setPerfilMiembro(null);
                  irAReservar(undefined, m.id);
                }}
                style={{ marginTop: Spacing.four }}
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  centro: {
    alignItems: "center",
    backgroundColor: Colors.canvas,
    flex: 1,
    justifyContent: "center",
  },
  centrado: { flex: 1, justifyContent: "center", paddingHorizontal: Spacing.three },
  contenido: { gap: Spacing.four, padding: Spacing.three, paddingBottom: Spacing.six },

  hero: {
    aspectRatio: 16 / 9,
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.lg,
    overflow: "hidden",
  },
  heroFoto: { height: "100%", width: "100%" },
  heroVacio: { alignItems: "center", flex: 1, justifyContent: "center" },
  heroEtiqueta: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 8,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: "absolute",
    top: 12,
  },
  heroEtiquetaTexto: {
    color: Colors.navy,
    fontFamily: Fonts.extraBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  identidad: { marginTop: -Spacing.four, padding: Spacing.three },
  identidadFila: { alignItems: "center", flexDirection: "row", gap: Spacing.two + 2 },
  nombre: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 19, letterSpacing: -0.5 },
  meta: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 3 },
  metaFuerte: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5 },
  metaTexto: { color: Colors.inkSoft, flexShrink: 1, fontFamily: Fonts.medium, fontSize: 12.5 },
  descripcion: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: Spacing.three,
  },
  statsFila: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.three },

  bloque: { gap: Spacing.two + 2 },
  aviso: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13 },
  grupo: {
    color: Colors.blue,
    fontFamily: Fonts.extraBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  servicioNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  servicioDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, marginTop: 2 },
  // Acción secundaria en el navy de Servicios (no en naranja): el
  // naranja es de Eventos y Restaurantes.
  servicioBoton: {
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.sm,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  servicioBotonTexto: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 12.5 },

  equipoFila: { gap: Spacing.three, paddingRight: Spacing.three },
  miembro: { alignItems: "center", width: 92 },
  miembroFoto: { borderRadius: Radios.full, height: 68, width: 68 },
  miembroNombre: {
    color: Colors.ink,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    marginTop: 8,
    textAlign: "center",
  },
  miembroRol: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11 },

  horarioDia: { color: Colors.ink, flex: 1, fontFamily: Fonts.bold, fontSize: 13 },
  horarioHoras: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13 },
  horarioCerrado: { color: Colors.inkMuted, fontFamily: Fonts.semiBold, fontSize: 13 },

  resena: { padding: Spacing.three },
  resenaTexto: {
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  direccion: { alignItems: "flex-start", flexDirection: "row", gap: Spacing.two, padding: Spacing.three },
  direccionTexto: {
    color: Colors.inkSoft,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },

  perfilVelo: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,18,42,0.5)" },
  perfilCentro: { alignItems: "center", flex: 1, justifyContent: "center", padding: Spacing.four },
  perfilTarjeta: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radios.xl,
    maxWidth: 340,
    padding: Spacing.four,
    width: "100%",
  },
  perfilFoto: { borderRadius: Radios.full, height: 104, width: 104 },
  perfilFotoVacia: { alignItems: "center", backgroundColor: Colors.navy, justifyContent: "center" },
  perfilInicial: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 34 },
  perfilNombre: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 19,
    letterSpacing: -0.4,
    marginTop: 12,
  },
  perfilRol: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 13, marginTop: 2 },
});
