import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import TarjetaVisitas from "@/components/tarjeta-visitas";
import { Avatar, Vacio, iniciales } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { enConfiguracion, fmtColones } from "@/lib/types";
import { agendaPorHoras, tocarHoraAbreChat } from "@/lib/agenda-negocio";
import {
  CATEGORIA_CITA_LABEL,
  DIAS_SEMANA_LABEL,
  etiquetaMinutos,
  horaAMinutos,
  horaBonita,
  horarioDeDetalles,
  normalizarCategoriaCita,
  type HorarioSemana,
} from "@/lib/citas";

type Negocio = {
  id: string;
  nombre: string;
  categoria: string | null;
  /** Puede llegar "eventos": esta mini-página ya no es solo de Citas. */
  vertical: string | null;
  descripcion: string | null;
  provincia: string | null;
  canton: string | null;
  direccion_exacta: string | null;
  foto_url: string | null;
  fotos: string[] | null;
  detalles: Record<string, unknown> | null;
};

type Servicio = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  duracion_minutos: number | null;
  grupo: string | null;
};

type Miembro = {
  id: string;
  nombre: string;
  rol: string | null;
  foto_url: string | null;
  // Bio pública (0192): "sobre mí" y títulos/acreditaciones, texto
  // libre que escribe el dueño desde el panel.
  bio: string | null;
  titulos: string | null;
};
type Resena = { calificacion: number; comentario: string | null; created_at: string | null };

/** Fila de la vista `estadisticas_miembro_citas` (0192): cuántas
 * citas atendió cada persona y cuántos clientes distintos, en
 * números agregados — sin nombre, correo ni fecha de nadie. */
type StatsMiembro = { citas_atendidas: number; personas_atendidas: number };

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/**
 * LA PÁGINA DE UN NEGOCIO DE SERVICIOS — barberías, uñas, salones de
 * belleza, spa, masajes, maquillaje.
 *
 * ── EL REDISEÑO ────────────────────────────────────────────────────
 * Antes esto era la misma pila de "bloques rotulados" que el resto de
 * la app: tarjeta sobre tarjeta, todo apretado, con el horario entero
 * desplegado en el medio empujando las reseñas fuera de pantalla.
 *
 * Ahora sigue el patrón que pidió el dueño (referencia: Fresha), que
 * es el estándar de la categoría:
 *
 *   · foto A SANGRE arriba, con los botones flotando encima;
 *   · una HOJA BLANCA que sube sobre la foto con la identidad:
 *     nombre grande, rubro, nota, si está abierto ahora, y la zona;
 *   · "Acerca de" con la descripción plegada en 3 renglones;
 *   · SERVICIOS sobre fondo gris —para que se despeguen— con los
 *     chips de sección arriba y una tarjeta blanca por servicio;
 *   · equipo en círculos, reseñas con la nota grande;
 *   · el HORARIO al final y PLEGADO ("Ver horario"): es lo que menos
 *     se consulta y es lo que más alto ocupaba;
 *   · una barra fija abajo con "N servicios disponibles" + Reservar.
 *
 * Todo con bastante más aire entre bloques: el pedido textual fue
 * "que las cosas estén un poco más separadas".
 */
export default function NegocioCitasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [items, setItems] = useState<Servicio[]>([]);
  const [equipo, setEquipo] = useState<Miembro[]>([]);
  const [calif, setCalif] = useState<{ promedio: number; total: number } | null>(null);
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [horario, setHorario] = useState<HorarioSemana | null>(null);
  const [cargando, setCargando] = useState(true);
  const [statsEquipo, setStatsEquipo] = useState<Record<string, StatsMiembro>>({});
  const [perfilMiembro, setPerfilMiembro] = useState<Miembro | null>(null);
  /** Orden de las secciones guardado por el dueño (0119). */
  const [ordenSecciones, setOrdenSecciones] = useState<string[]>([]);

  // ── Estado de la pantalla nueva ─────────────────────────────────
  /** La sección de servicios elegida en los chips. null = la primera. */
  const [seccionActiva, setSeccionActiva] = useState<string | null>(null);
  /** La descripción larga desplegada. */
  const [verDescripcion, setVerDescripcion] = useState(false);
  /** El horario plegado al final. */
  const [verHorario, setVerHorario] = useState(false);
  /** El servicio abierto en la hoja de detalle. */
  const [servicioAbierto, setServicioAbierto] = useState<Servicio | null>(null);
  /** Qué foto de la galería se está viendo. */
  const [foto, setFoto] = useState(0);

  const cargar = useCallback(async () => {
    const [n, i, e, c, r, sec, st] = await Promise.all([
      // Ya no se filtra `.eq("vertical", "citas")` en la consulta: esta
      // mini-página sirve a cualquier negocio que trabaje POR HORAS, y
      // un proveedor de eventos también lo hace. El corte se hace abajo
      // con el helper, así el día que aparezca otra vertical por horas
      // no hay que volver a tocar el `select`.
      supabase
        .from("ranchos")
        .select(
          "id, nombre, categoria, vertical, descripcion, provincia, canton, direccion_exacta, foto_url, fotos, detalles",
        )
        .eq("id", id)
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
        .select("id, nombre, rol, foto_url, bio, titulos")
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
        .select("calificacion, comentario, created_at")
        .eq("rancho_id", id)
        .order("created_at", { ascending: false })
        .limit(6),
      // El orden de las secciones (0119). El teléfono puede estar contra
      // una base sin la migración: ahí esto viene con error y las
      // secciones salen como vengan los servicios, igual que antes.
      supabase
        .from("categorias_negocio")
        .select("nombre")
        .eq("rancho_id", id)
        .order("orden", { ascending: true }),
      // Atendidos y citas por persona (0192): vista pública agregada,
      // el mismo criterio que ya usaba /api/citas/[id]/stats pero por
      // miembro — el teléfono la lee directo, sin pasar por el sitio.
      supabase
        .from("estadisticas_miembro_citas")
        .select("miembro_id, citas_atendidas, personas_atendidas")
        .eq("rancho_id", id),
    ]);
    const fila = (n.data ?? null) as Negocio | null;
    // Un Lugar, un restaurante o un hospedaje no se ven acá: su página
    // es otra. Y una publicación en pausa no se abre para nadie.
    setNegocio(
      fila && agendaPorHoras(fila) && !enConfiguracion(fila.detalles) ? fila : null,
    );
    setItems((i.data ?? []) as Servicio[]);
    setEquipo((e.data ?? []) as Miembro[]);
    setCalif((c.data ?? null) as { promedio: number; total: number } | null);
    setResenas((r.data ?? []) as Resena[]);
    setOrdenSecciones(((sec.data ?? []) as { nombre: string }[]).map((s) => s.nombre));
    setHorario(horarioDeDetalles(n.data?.detalles));
    // La 0192 puede no estar corrida todavía en alguna base contra la
    // que hable el teléfono: si la vista no existe, `st` viene con
    // error y la bio se ve igual, solo sin los números.
    const filasStats = (st.data ?? []) as {
      miembro_id: string;
      citas_atendidas: number;
      personas_atendidas: number;
    }[];
    setStatsEquipo(
      Object.fromEntries(
        filasStats.map((f) => [
          f.miembro_id,
          { citas_atendidas: f.citas_atendidas, personas_atendidas: f.personas_atendidas },
        ]),
      ),
    );
    setCargando(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga el negocio al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

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
  const rubro = CATEGORIA_CITA_LABEL[normalizarCategoriaCita(negocio.categoria)];

  // La galería: la foto principal primero y después las demás, sin
  // repetirla si ya viene en el array.
  const galeria = [
    ...(negocio.foto_url ? [negocio.foto_url] : []),
    ...((negocio.fotos ?? []).filter((f) => f && f !== negocio.foto_url)),
  ];

  // Agrupar servicios por sección del catálogo, respetando el orden que
  // el dueño guardó (0119). Las secciones que no ordenó quedan detrás,
  // en el orden en que aparecen sus servicios — que es como era antes.
  const grupos = new Map<string, Servicio[]>();
  items.forEach((s) => {
    const g = s.grupo?.trim() || "Servicios";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(s);
  });

  const seccionesOrdenadas = (() => {
    if (ordenSecciones.length === 0) return [...grupos.entries()];
    const clave = (n: string) => n.trim().toLowerCase();
    const posicion = new Map(ordenSecciones.map((n, i) => [clave(n), i]));
    const conPosicion: [string, Servicio[]][] = [];
    const resto: [string, Servicio[]][] = [];
    for (const entrada of grupos.entries()) {
      if (posicion.has(clave(entrada[0]))) conPosicion.push(entrada);
      else resto.push(entrada);
    }
    conPosicion.sort((a, b) => posicion.get(clave(a[0]))! - posicion.get(clave(b[0]))!);
    return [...conPosicion, ...resto];
  })();

  const nombresSeccion = seccionesOrdenadas.map(([g]) => g);
  const seccionElegida = seccionActiva ?? nombresSeccion[0] ?? null;
  const serviciosVisibles =
    seccionesOrdenadas.find(([g]) => g === seccionElegida)?.[1] ?? items;

  const irAReservar = (servicioId?: string, miembroId?: string) => {
    // Un proveedor de eventos NO reserva la hora: su ficha de Eventos
    // es la que tiene la agenda que abre el chat. Mandarlo al flujo de
    // `crear_cita` le apartaría una franja, que es justo lo que la
    // regla de producto prohíbe.
    if (tocarHoraAbreChat(negocio)) {
      router.push(`/rancho/${negocio.id}` as never);
      return;
    }
    const params = new URLSearchParams();
    if (servicioId) params.set("servicio", servicioId);
    if (miembroId) params.set("miembro", miembroId);
    const query = params.toString();
    router.push(`/citas/${negocio.id}/reservar${query ? `?${query}` : ""}` as never);
  };

  const abierto = estaAbiertoAhora(horario);

  return (
    <View style={styles.contenedor}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── LA FOTO A SANGRE, con los botones flotando ─────────── */}
        <View style={styles.hero}>
          {galeria.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setFoto(Math.round(e.nativeEvent.contentOffset.x / ANCHO_HERO))
              }
            >
              {galeria.map((f, i) => (
                <Image
                  key={`${f}-${i}`}
                  source={{ uri: f }}
                  alt={negocio.nombre}
                  style={styles.heroFoto}
                  contentFit="cover"
                  transition={250}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.heroVacio}>
              <Ionicons name="cut-outline" size={44} color={Colors.blue} />
            </View>
          )}

          <View style={[styles.heroBotones, { top: insets.top + 8 }]}>
            <Pressable
              style={styles.heroBoton}
              accessibilityLabel="Volver"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/citas" as never)
              }
            >
              <Ionicons name="arrow-back" size={20} color={Colors.ink} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              style={styles.heroBoton}
              accessibilityLabel="Compartir"
              onPress={() =>
                Share.share({
                  message: `${negocio.nombre} en Bookea: ${SITIO_URL}/citas/${negocio.id}`,
                }).catch(() => {})
              }
            >
              <Ionicons name="share-outline" size={19} color={Colors.ink} />
            </Pressable>
          </View>

          {galeria.length > 1 && (
            <View style={styles.contadorFotos}>
              <Text style={styles.contadorFotosTexto}>
                {foto + 1}/{galeria.length}
              </Text>
            </View>
          )}
        </View>

        {/* ── LA HOJA BLANCA, montada sobre la foto ──────────────── */}
        <View style={styles.hoja}>
          <Text style={styles.nombre}>{negocio.nombre}</Text>
          <Text style={styles.rubro}>{rubro}</Text>

          <View style={styles.filaNota}>
            {calif && calif.total > 0 ? (
              <>
                <Ionicons name="star" size={15} color="#f5a623" />
                <Text style={styles.notaFuerte}>{calif.promedio.toFixed(1).replace(".", ",")}</Text>
                <Text style={styles.notaSuave}>({calif.total})</Text>
              </>
            ) : (
              <Text style={styles.notaSuave}>Sin reseñas todavía</Text>
            )}
            {abierto !== null && (
              <>
                <Text style={styles.notaSuave}>·</Text>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={abierto.abierto ? Colors.green : Colors.accent}
                />
                <Text
                  style={[
                    styles.estadoHorario,
                    { color: abierto.abierto ? Colors.green : Colors.accent },
                  ]}
                >
                  {abierto.abierto ? "Abierto" : "Cerrado"}
                </Text>
                {!!abierto.detalle && <Text style={styles.notaSuave}>{abierto.detalle}</Text>}
              </>
            )}
          </View>

          {!!(ubicacion || negocio.direccion_exacta) && (
            <View style={styles.chipUbicacion}>
              <Ionicons name="location" size={15} color={Colors.ink} />
              <Text style={styles.chipUbicacionTexto} numberOfLines={2}>
                {negocio.direccion_exacta
                  ? `${negocio.direccion_exacta}${ubicacion ? ` · ${ubicacion}` : ""}`
                  : ubicacion}
              </Text>
            </View>
          )}

          {!!negocio.descripcion && (
            <View style={styles.acercaDe}>
              <Text style={styles.tituloSeccion}>Acerca de</Text>
              <Text
                style={styles.descripcion}
                numberOfLines={verDescripcion ? undefined : 3}
              >
                {negocio.descripcion}
              </Text>
              {negocio.descripcion.length > 120 && (
                <Pressable onPress={() => setVerDescripcion((v) => !v)} hitSlop={6}>
                  <Text style={styles.leerMas}>
                    {verDescripcion ? "Leer menos" : "Leer más"}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Prueba social real: solo aparece si el número da (la regla
              de los 3, en lib/visitas.ts). */}
          <View style={{ marginTop: Spacing.three }}>
            <TarjetaVisitas ranchoId={negocio.id} vertical="citas" />
          </View>
        </View>

        {/* ── SERVICIOS, sobre fondo gris para que se despeguen ──── */}
        <View style={styles.zonaGris}>
          <Text style={styles.tituloGrande}>Servicios</Text>

          {items.length === 0 ? (
            <Text style={styles.aviso}>Este negocio todavía no publicó sus servicios.</Text>
          ) : (
            <>
              {nombresSeccion.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsFila}
                >
                  {nombresSeccion.map((g) => {
                    const puesta = g === seccionElegida;
                    return (
                      <Pressable
                        key={g}
                        onPress={() => setSeccionActiva(g)}
                        style={[styles.chipSeccion, puesta && styles.chipSeccionActivo]}
                      >
                        <Text
                          style={[
                            styles.chipSeccionTexto,
                            puesta && styles.chipSeccionTextoActivo,
                          ]}
                        >
                          {g}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <View style={{ gap: Spacing.three }}>
                {serviciosVisibles.map((s) => (
                  <Pressable
                    key={s.id}
                    style={({ pressed }) => [styles.servicio, pressed && { opacity: 0.92 }]}
                    onPress={() => setServicioAbierto(s)}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Text style={styles.servicioNombre}>{s.nombre}</Text>
                      <Text style={styles.servicioDuracion}>
                        {etiquetaMinutos(s.duracion_minutos ?? 30)}
                      </Text>
                      <Text style={styles.servicioPrecio}>
                        {s.precio !== null ? fmtColones(s.precio) : "Consultar"}
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.botonReservar, pressed && { opacity: 0.85 }]}
                      onPress={() => irAReservar(s.id)}
                    >
                      <Text style={styles.botonReservarTexto}>Reservar</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── EQUIPO ─────────────────────────────────────────────── */}
        {equipo.length > 0 && (
          <View style={styles.bloque}>
            <Text style={styles.tituloGrande}>Equipo</Text>
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
                    <Avatar nombre={m.nombre} tamano={84} />
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

        {/* ── RESEÑAS ────────────────────────────────────────────── */}
        {resenas.length > 0 && (
          <View style={styles.bloque}>
            <Text style={styles.tituloGrande}>Reseñas</Text>
            {calif && calif.total > 0 && (
              <View style={styles.notaGrande}>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  {Array.from({ length: 5 }, (_, j) => (
                    <Ionicons
                      key={j}
                      name={j < Math.round(calif.promedio) ? "star" : "star-outline"}
                      size={22}
                      color="#f5a623"
                    />
                  ))}
                </View>
                <Text style={styles.notaGrandeTexto}>
                  {calif.promedio.toFixed(1).replace(".", ",")}{" "}
                  <Text style={styles.notaGrandeTotal}>({calif.total})</Text>
                </Text>
              </View>
            )}
            <View style={{ gap: Spacing.four }}>
              {resenas.map((r, i) => (
                <View key={i} style={styles.resena}>
                  <View style={{ flexDirection: "row", gap: 1 }}>
                    {Array.from({ length: r.calificacion }, (_, j) => (
                      <Ionicons key={j} name="star" size={13} color="#f5a623" />
                    ))}
                  </View>
                  {!!r.comentario && <Text style={styles.resenaTexto}>{r.comentario}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── HORARIO, plegado al final ──────────────────────────── */}
        {horario && (
          <View style={styles.bloque}>
            <Pressable
              style={styles.plegable}
              accessibilityState={{ expanded: verHorario }}
              onPress={() => setVerHorario((v) => !v)}
            >
              <Ionicons name="time-outline" size={19} color={Colors.ink} />
              <Text style={styles.plegableTexto}>Ver horario</Text>
              <Ionicons
                name={verHorario ? "chevron-up" : "chevron-down"}
                size={18}
                color={Colors.inkSoft}
              />
            </Pressable>
            {verHorario && (
              <View style={styles.horarioLista}>
                {DIAS_SEMANA_LABEL.map((dia, dow) => {
                  const d = horario[String(dow)];
                  return (
                    <View key={dia} style={styles.horarioFila}>
                      <Text style={styles.horarioDia}>{dia}</Text>
                      <Text style={d ? styles.horarioHoras : styles.horarioCerrado}>
                        {d ? `${horaBonita(d.abre)} – ${horaBonita(d.cierra)}` : "Cerrado"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── LA BARRA FIJA DE ABAJO ──────────────────────────────── */}
      {items.length > 0 && (
        <View style={[styles.barraFija, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={styles.barraFijaTexto}>
            {items.length} servicio{items.length === 1 ? "" : "s"} disponible
            {items.length === 1 ? "" : "s"}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.barraFijaBoton, pressed && { opacity: 0.9 }]}
            onPress={() => irAReservar()}
          >
            <Text style={styles.barraFijaBotonTexto}>Reservar ahora</Text>
          </Pressable>
        </View>
      )}

      {/* ── LA HOJA DE DETALLE DE UN SERVICIO ───────────────────── */}
      <Modal
        visible={servicioAbierto !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setServicioAbierto(null)}
      >
        <View style={styles.hojaFondo}>
          <View style={[styles.hojaServicio, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              style={styles.hojaCerrar}
              accessibilityLabel="Cerrar"
              onPress={() => setServicioAbierto(null)}
            >
              <Ionicons name="close" size={24} color={Colors.ink} />
            </Pressable>

            {servicioAbierto && (
              <>
                <ScrollView contentContainerStyle={{ paddingBottom: Spacing.four }}>
                  <Text style={styles.hojaTitulo}>{servicioAbierto.nombre}</Text>
                  {!!servicioAbierto.descripcion && (
                    <Text style={styles.hojaDescripcion}>{servicioAbierto.descripcion}</Text>
                  )}
                </ScrollView>

                <View style={styles.hojaPie}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.hojaPrecio}>
                      {servicioAbierto.precio !== null
                        ? fmtColones(servicioAbierto.precio)
                        : "Consultar"}
                    </Text>
                    <Text style={styles.hojaDuracion}>
                      {etiquetaMinutos(servicioAbierto.duracion_minutos ?? 30)}
                    </Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.barraFijaBoton, pressed && { opacity: 0.9 }]}
                    onPress={() => {
                      const s = servicioAbierto;
                      setServicioAbierto(null);
                      irAReservar(s.id);
                    }}
                  >
                    <Text style={styles.barraFijaBotonTexto}>Reservar</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── LA BIO COMPLETA DE LA PERSONA DEL EQUIPO ────────────── */}
      {/* Hoja que sube desde abajo, igual que la del servicio: la bio
          (sobre mí + títulos) puede ser larga y una tarjeta chica al
          centro se quedaba corta apenas alguien escribía dos líneas. */}
      <Modal
        visible={perfilMiembro !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPerfilMiembro(null)}
      >
        <View style={styles.hojaFondo}>
          <View style={[styles.hojaServicio, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              style={styles.hojaCerrar}
              accessibilityLabel="Cerrar"
              onPress={() => setPerfilMiembro(null)}
            >
              <Ionicons name="close" size={24} color={Colors.ink} />
            </Pressable>

            {perfilMiembro && (
              <>
                <ScrollView contentContainerStyle={{ paddingBottom: Spacing.four }}>
                  <View style={styles.perfilEncabezado}>
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
                    {!!perfilMiembro.rol && (
                      <Text style={styles.perfilRol}>{perfilMiembro.rol}</Text>
                    )}
                  </View>

                  {/* "Atendidos: N personas" / "Citas: N citas" — números
                      reales de la vista `estadisticas_miembro_citas`
                      (0192), no un contador inventado. */}
                  <View style={styles.perfilStatsFila}>
                    <View style={styles.perfilStat}>
                      <Text style={styles.perfilStatNumero}>
                        {statsEquipo[perfilMiembro.id]?.personas_atendidas ?? 0}
                      </Text>
                      <Text style={styles.perfilStatEtiqueta}>
                        persona{(statsEquipo[perfilMiembro.id]?.personas_atendidas ?? 0) === 1
                          ? ""
                          : "s"}{" "}
                        atendida{(statsEquipo[perfilMiembro.id]?.personas_atendidas ?? 0) === 1
                          ? ""
                          : "s"}
                      </Text>
                    </View>
                    <View style={styles.perfilStatDivisor} />
                    <View style={styles.perfilStat}>
                      <Text style={styles.perfilStatNumero}>
                        {statsEquipo[perfilMiembro.id]?.citas_atendidas ?? 0}
                      </Text>
                      <Text style={styles.perfilStatEtiqueta}>
                        cita{(statsEquipo[perfilMiembro.id]?.citas_atendidas ?? 0) === 1 ? "" : "s"}{" "}
                        en Bookea
                      </Text>
                    </View>
                  </View>

                  {!!perfilMiembro.bio && (
                    <View style={styles.perfilSeccion}>
                      <Text style={styles.tituloSeccion}>Sobre mí</Text>
                      <Text style={styles.descripcion}>{perfilMiembro.bio}</Text>
                    </View>
                  )}

                  {!!perfilMiembro.titulos && (
                    <View style={styles.perfilSeccion}>
                      <Text style={styles.tituloSeccion}>Títulos y acreditaciones</Text>
                      <View style={{ gap: 8 }}>
                        {perfilMiembro.titulos
                          .split("\n")
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .map((t, i) => (
                            <View key={i} style={styles.perfilTituloFila}>
                              <Ionicons name="ribbon-outline" size={16} color={Colors.navy} />
                              <Text style={styles.perfilTituloTexto}>{t}</Text>
                            </View>
                          ))}
                      </View>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.hojaPie}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.barraFijaBoton,
                      { flex: 1 },
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={() => {
                      const m = perfilMiembro;
                      setPerfilMiembro(null);
                      irAReservar(undefined, m.id);
                    }}
                  >
                    <Text style={styles.barraFijaBotonTexto}>
                      Reservar con {perfilMiembro.nombre.split(" ")[0]}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Ancho de una foto del carrusel: el de la pantalla, no un número
 * fijo. Con 390 hardcodeado el contador "1/10" se desincronizaba en
 * cualquier teléfono más ancho o más angosto — y en un iPhone Pro Max
 * la foto quedaba con una franja al lado.
 */
const ANCHO_HERO = Dimensions.get("window").width;

/**
 * ¿Está abierto AHORA, y qué se dice al lado?
 *
 * Devuelve null si el negocio no publicó horario: ahí no se afirma
 * nada (decir "cerrado" porque falta el dato sería mentir). El día y
 * la hora se leen en hora de Costa Rica, igual que el resto del motor
 * de citas.
 */
function estaAbiertoAhora(
  horario: HorarioSemana | null,
): { abierto: boolean; detalle: string } | null {
  if (!horario) return null;
  const ahora = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" }),
  );
  const dow = ahora.getDay();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  const hoy = horario[String(dow)];
  if (hoy) {
    const abre = horaAMinutos(hoy.abre);
    const cierra = horaAMinutos(hoy.cierra);
    if (minutosAhora >= abre && minutosAhora < cierra) {
      return { abierto: true, detalle: `– cierra a las ${horaBonita(hoy.cierra)}` };
    }
    if (minutosAhora < abre) {
      return { abierto: false, detalle: `– abre a las ${horaBonita(hoy.abre)}` };
    }
  }

  // Cerrado hoy (o ya cerró): se busca el próximo día con horario.
  for (let i = 1; i <= 7; i++) {
    const d = horario[String((dow + i) % 7)];
    if (d) {
      const nombre = i === 1 ? "mañana" : DIAS_SEMANA_LABEL[(dow + i) % 7].toLowerCase();
      return { abierto: false, detalle: `– abre ${nombre} a las ${horaBonita(d.abre)}` };
    }
  }
  return { abierto: false, detalle: "" };
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.surface, flex: 1 },
  centro: {
    alignItems: "center",
    backgroundColor: Colors.canvas,
    flex: 1,
    justifyContent: "center",
  },
  centrado: { flex: 1, justifyContent: "center", paddingHorizontal: Spacing.three },

  // ── El hero ───────────────────────────────────────────────────
  hero: { backgroundColor: Colors.blueLight, height: 300 },
  heroFoto: { height: 300, width: ANCHO_HERO },
  heroVacio: { alignItems: "center", flex: 1, justifyContent: "center" },
  heroBotones: {
    alignItems: "center",
    flexDirection: "row",
    left: Spacing.three,
    position: "absolute",
    right: Spacing.three,
  },
  heroBoton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  contadorFotos: {
    backgroundColor: "rgba(20,25,40,0.72)",
    borderRadius: 10,
    bottom: 42,
    paddingHorizontal: 9,
    paddingVertical: 4,
    position: "absolute",
    right: Spacing.three,
  },
  contadorFotosTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 11.5 },

  // ── La hoja blanca ────────────────────────────────────────────
  hoja: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    marginTop: -26,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
  },
  nombre: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 27, letterSpacing: -0.7 },
  rubro: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 14.5, marginTop: 2 },
  filaNota: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: Spacing.three,
  },
  notaFuerte: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  notaSuave: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13.5 },
  estadoHorario: { fontFamily: Fonts.bold, fontSize: 13.5 },
  chipUbicacion: {
    alignItems: "center",
    backgroundColor: Colors.cream2,
    borderRadius: 14,
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.three,
    padding: Spacing.three,
  },
  chipUbicacionTexto: { color: Colors.ink, flex: 1, fontFamily: Fonts.medium, fontSize: 13.5 },
  acercaDe: { gap: 6, marginTop: Spacing.five },
  tituloSeccion: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 19, letterSpacing: -0.4 },
  descripcion: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 14.5, lineHeight: 22 },
  leerMas: { color: Colors.accent, fontFamily: Fonts.bold, fontSize: 14 },

  // ── Servicios, sobre gris ─────────────────────────────────────
  zonaGris: {
    backgroundColor: Colors.canvas,
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  tituloGrande: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 23, letterSpacing: -0.6 },
  aviso: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13.5 },
  chipsFila: { flexDirection: "row", gap: Spacing.two, paddingVertical: 2 },
  chipSeccion: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  chipSeccionActivo: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipSeccionTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13.5 },
  chipSeccionTextoActivo: { color: "#ffffff" },
  servicio: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 18,
    flexDirection: "row",
    gap: Spacing.three,
    padding: Spacing.four,
  },
  servicioNombre: { color: Colors.ink, fontFamily: Fonts.semiBold, fontSize: 16, lineHeight: 22 },
  servicioDuracion: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13.5 },
  servicioPrecio: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  botonReservar: {
    borderColor: Colors.lineFuerte,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  botonReservarTexto: { color: Colors.ink, fontFamily: Fonts.semiBold, fontSize: 14.5 },

  // ── Bloques de abajo ──────────────────────────────────────────
  bloque: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  equipoFila: { flexDirection: "row", gap: Spacing.four, paddingVertical: 2 },
  miembro: { alignItems: "center", gap: 6, width: 96 },
  miembroFoto: { borderRadius: 42, height: 84, width: 84 },
  miembroNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  miembroRol: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5 },
  notaGrande: { gap: 6 },
  notaGrandeTexto: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 17 },
  notaGrandeTotal: { color: Colors.accent, fontFamily: Fonts.bold },
  resena: { gap: 6 },
  resenaTexto: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 14.5, lineHeight: 21 },
  plegable: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.three,
    paddingVertical: 4,
  },
  plegableTexto: { color: Colors.ink, flex: 1, fontFamily: Fonts.bold, fontSize: 16 },
  horarioLista: { gap: 2 },
  horarioFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
  },
  horarioDia: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 14 },
  horarioHoras: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  horarioCerrado: { color: Colors.inkMuted, fontFamily: Fonts.medium, fontSize: 14 },

  // ── La barra fija ─────────────────────────────────────────────
  barraFija: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    gap: Spacing.three,
    left: 0,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    position: "absolute",
    right: 0,
  },
  barraFijaTexto: { color: Colors.inkSoft, flex: 1, fontFamily: Fonts.medium, fontSize: 14 },
  barraFijaBoton: {
    alignItems: "center",
    backgroundColor: Colors.ink,
    borderRadius: 99,
    paddingHorizontal: 26,
    paddingVertical: 15,
  },
  barraFijaBotonTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },

  // ── La hoja del servicio ──────────────────────────────────────
  hojaFondo: { backgroundColor: "rgba(20,25,40,0.35)", flex: 1, justifyContent: "flex-end" },
  hojaServicio: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "88%",
    minHeight: "55%",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  hojaCerrar: { alignSelf: "flex-end", padding: 6 },
  hojaTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 27,
    letterSpacing: -0.7,
    marginBottom: Spacing.three,
  },
  hojaDescripcion: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 15, lineHeight: 23 },
  hojaPie: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  hojaPrecio: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 20 },
  hojaDuracion: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13.5, marginTop: 1 },

  // ── La bio completa del equipo ──────────────────────────────────
  perfilEncabezado: { alignItems: "center", paddingTop: Spacing.two },
  perfilFoto: { borderRadius: 48, height: 96, width: 96 },
  perfilFotoVacia: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    justifyContent: "center",
  },
  perfilInicial: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 30 },
  perfilNombre: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 21,
    marginTop: Spacing.three,
    textAlign: "center",
  },
  perfilRol: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 14, marginTop: 2 },
  perfilStatsFila: {
    alignItems: "center",
    backgroundColor: Colors.cream2,
    borderRadius: 16,
    flexDirection: "row",
    marginTop: Spacing.four,
    paddingVertical: Spacing.three,
  },
  perfilStat: { alignItems: "center", flex: 1, gap: 2 },
  perfilStatDivisor: { alignSelf: "stretch", backgroundColor: Colors.line, width: 1 },
  perfilStatNumero: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 19 },
  perfilStatEtiqueta: {
    color: Colors.inkSoft,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    textAlign: "center",
  },
  perfilSeccion: { gap: 6, marginTop: Spacing.five },
  perfilTituloFila: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  perfilTituloTexto: { color: Colors.ink, flex: 1, fontFamily: Fonts.medium, fontSize: 14.5 },
});
