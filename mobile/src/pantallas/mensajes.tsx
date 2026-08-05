import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Swipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import TituloPantalla from "@/components/titulo-pantalla";
import { ChipCategoria } from "@/components/ui";
import { PREFIJO_ASISTENTE } from "@/lib/asistente-prefijo";
import {
  ORDEN_CATEGORIAS_CHAT,
  CATEGORIA_CHAT_LABEL,
  categorizarConversacion,
  type CategoriaChat,
} from "@/lib/chat-categorias";

/**
 * Bandeja de entrada tipo Airbnb: todas las conversaciones de la
 * persona (como cliente y como proveedor), ordenadas por actividad,
 * con el último mensaje y cuántos hay sin leer. Espejo de /mensajes
 * en la web, con dos gestos para mantener el orden:
 *
 * - Deslizar a la derecha marca la conversación como leída.
 * - Deslizar a la izquierda la "elimina": los mensajes nunca se
 *   borran de verdad (diseño de la migración 0034) — se oculta solo
 *   para esta persona (conversacion_ocultas) y reaparece sola si
 *   llega un mensaje nuevo, para no perder una posible venta.
 */

type ConversacionRow = {
  id: string;
  reserva_id: string | null;
  cliente_id: string;
  proveedor_id: string;
  created_at: string;
  resuelta: boolean;
  ranchos: {
    nombre: string;
    foto_url: string | null;
    vertical: string | null;
    categoria: string | null;
    slug: string | null;
  } | null;
  reservas: { fecha: string; nombre: string | null; estado: string } | null;
};

type MensajeMin = {
  conversacion_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
};

/** La etiqueta de contexto de cada chat: qué es esta conversación. */
type TagChat = {
  texto: string;
  fondo: string;
  color: string;
};

type Fila = {
  id: string;
  /** Ruta del hilo: por reserva o por conversación (consulta). */
  href: string;
  titulo: string;
  subtitulo: string;
  foto: string | null;
  ultimoTexto: string;
  actividad: string;
  pendientes: number;
  resuelta: boolean;
  tag: TagChat;
  categoria: CategoriaChat;
};

function fechaCorta(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString("es-CR", { timeZone: "America/Costa_Rica", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica", day: "numeric", month: "short" });
}

/** Qué es este chat, de un vistazo: una reserva real (y en qué estado
 * va) o una consulta que todavía puede convertirse en una. */
function tagDeChat(c: ConversacionRow): TagChat {
  if (!c.reserva_id) {
    return { texto: "Posible reserva", fondo: "#e8ecf6", color: Colors.navy };
  }
  if (c.reservas?.estado === "confirmada") {
    return { texto: "Reserva confirmada", fondo: Colors.greenLight, color: Colors.green };
  }
  if (c.reservas?.estado === "rechazada") {
    return { texto: "Reserva rechazada", fondo: Colors.dangerLight, color: Colors.danger };
  }
  return { texto: "Nueva reserva", fondo: Colors.accentLight, color: Colors.accent };
}

export default function BandejaMensajesScreen({ activa = true }: { activa?: boolean }) {
  const router = useRouter();
  const { session } = useAuth();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [tab, setTab] = useState<"activas" | "resueltas">("activas");
  const [categoria, setCategoria] = useState<CategoriaChat | "todas">("todas");

  const cargar = useCallback(async () => {
    if (!session) return;
    const miId = session.user.id;

    const { data: convData } = await supabase
      .from("conversaciones")
      .select(
        "id, reserva_id, cliente_id, proveedor_id, created_at, resuelta, ranchos(nombre, foto_url, vertical, categoria, slug), reservas(fecha, nombre, estado)",
      );

    const conversaciones = (convData ?? []) as unknown as ConversacionRow[];
    const ids = conversaciones.map((c) => c.id);

    const [{ data: mensajesData }, { data: lecturasData }, { data: ocultasData }, { data: contactosData }] =
      ids.length
        ? await Promise.all([
            supabase
              .from("mensajes")
              .select("conversacion_id, autor_id, texto, created_at")
              .in("conversacion_id", ids)
              .order("created_at", { ascending: false })
              .limit(1000),
            supabase
              .from("conversacion_lecturas")
              .select("conversacion_id, leido_hasta")
              .eq("usuario_id", miId),
            supabase
              .from("conversacion_ocultas")
              .select("conversacion_id, oculta_desde")
              .eq("usuario_id", miId),
            // El nombre (o correo) de la otra persona — RLS solo deja ver
            // el propio perfil, así que esta vista lo destraba nada más
            // para con quién ya estás chateando (las consultas sin
            // reserva, que si no quedan como "Cliente interesado").
            supabase.from("conversaciones_contacto").select("conversacion_id, nombre_contacto"),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

    const leidoHasta = new Map<string, string>(
      ((lecturasData ?? []) as { conversacion_id: string; leido_hasta: string }[]).map(
        (l) => [l.conversacion_id, l.leido_hasta],
      ),
    );
    const ocultaDesde = new Map<string, string>(
      ((ocultasData ?? []) as { conversacion_id: string; oculta_desde: string }[]).map(
        (o) => [o.conversacion_id, o.oculta_desde],
      ),
    );
    const contactoPorConversacion = new Map<string, string>(
      ((contactosData ?? []) as { conversacion_id: string; nombre_contacto: string | null }[])
        .filter((c) => !!c.nombre_contacto)
        .map((c) => [c.conversacion_id, c.nombre_contacto as string]),
    );

    const ultimo = new Map<string, MensajeMin>();
    const sinLeer = new Map<string, number>();
    for (const m of (mensajesData ?? []) as MensajeMin[]) {
      if (!ultimo.has(m.conversacion_id)) ultimo.set(m.conversacion_id, m);
      const marca = leidoHasta.get(m.conversacion_id);
      if (m.autor_id !== miId && (!marca || m.created_at > marca)) {
        sinLeer.set(m.conversacion_id, (sinLeer.get(m.conversacion_id) ?? 0) + 1);
      }
    }

    setFilas(
      conversaciones
        .map((c) => {
          const soyCliente = c.cliente_id === miId;
          const ult = ultimo.get(c.id) ?? null;
          return {
            id: c.id,
            href: c.reserva_id
              ? `/mensajes/${c.reserva_id}`
              : `/mensajes/hilo/${c.id}`,
            titulo: soyCliente
              ? (c.ranchos?.nombre ?? "Conversación")
              : c.reservas?.nombre || contactoPorConversacion.get(c.id) || "Cliente interesado",
            subtitulo: [
              !soyCliente ? c.ranchos?.nombre : null,
              c.reserva_id
                ? c.reservas?.fecha
                  ? `Evento: ${c.reservas.fecha}`
                  : null
                : "Consulta directa",
            ]
              .filter(Boolean)
              .join(" · "),
            foto: c.ranchos?.foto_url ?? null,
            ultimoTexto: ult
              ? `${ult.autor_id === miId ? "Vos: " : ""}${ult.texto}`
              : "Sin mensajes todavía — escribí el primero.",
            actividad: ult?.created_at ?? c.created_at,
            pendientes: sinLeer.get(c.id) ?? 0,
            resuelta: c.resuelta,
            tag: tagDeChat(c),
            categoria: categorizarConversacion({
              proveedorId: c.proveedor_id,
              miId,
              ranchoSlug: c.ranchos?.slug ?? "",
              vertical: c.ranchos?.vertical ?? "eventos",
              categoria: c.ranchos?.categoria ?? "otros",
            }),
          };
        })
        // Un chat eliminado se queda oculto mientras no pase nada
        // nuevo; si su última actividad es posterior al momento en que
        // se ocultó, vuelve a la bandeja.
        .filter((f) => {
          const oculta = ocultaDesde.get(f.id);
          return !oculta || f.actividad > oculta;
        })
        .sort((a, b) => (a.actividad < b.actividad ? 1 : -1)),
    );
  }, [session]);

  // Carga al montar y recarga cada vez que el pager llega a esta
  // pestaña — los mensajes nuevos entran mientras se navega otra cosa.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar, sin librería de data-fetching en este proyecto
    if (activa) cargar();
  }, [cargar, activa]);

  const marcarLeido = useCallback(
    async (fila: Fila) => {
      if (!session) return;
      setFilas((prev) =>
        (prev ?? []).map((f) => (f.id === fila.id ? { ...f, pendientes: 0 } : f)),
      );
      await supabase.from("conversacion_lecturas").upsert({
        conversacion_id: fila.id,
        usuario_id: session.user.id,
        leido_hasta: new Date().toISOString(),
      });
    },
    [session],
  );

  const ocultar = useCallback(
    async (ids: string[]) => {
      if (!session || ids.length === 0) return;
      const ahora = new Date().toISOString();
      setFilas((prev) => (prev ?? []).filter((f) => !ids.includes(f.id)));
      await supabase.from("conversacion_ocultas").upsert(
        ids.map((id) => ({
          conversacion_id: id,
          usuario_id: session.user.id,
          oculta_desde: ahora,
        })),
      );
      // Eliminar es también decir "ya lo vi": si el hilo se va de la
      // bandeja con pendientes sin marcar, esos pendientes se quedan
      // sumando en la burbuja de chat de la web sin forma de bajarlos.
      await supabase.from("conversacion_lecturas").upsert(
        ids.map((id) => ({
          conversacion_id: id,
          usuario_id: session.user.id,
          leido_hasta: ahora,
        })),
      );
    },
    [session],
  );

  const eliminarChat = useCallback((fila: Fila) => ocultar([fila.id]), [ocultar]);

  /** Vaciar de un golpe todo lo archivado — el caso real de una bandeja
   *  saturada, sin tener que deslizar hilo por hilo. */
  const vaciarResueltas = useCallback(() => {
    const ids = (filas ?? []).filter((f) => f.resuelta).map((f) => f.id);
    if (ids.length === 0) return;
    Alert.alert(
      "Vaciar resueltas",
      `¿Eliminar ${ids.length} ${ids.length === 1 ? "conversación resuelta" : "conversaciones resueltas"} de tu bandeja?\n\nLos mensajes no se borran y el chat vuelve solo si la otra persona escribe.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => void ocultar(ids) },
      ],
    );
  }, [filas, ocultar]);

  // Estado compartido (migración 0054): si cualquiera de los dos la
  // marca resuelta, se archiva para ambos — y un mensaje nuevo la
  // reabre sola, así que no hace falta tocar nada acá para eso.
  //
  // Archivar cuenta como "ya lo vi": se marca leído también. Si no, los
  // pendientes del hilo se quedan sumando en el contador de la web
  // (burbuja de chat) sin forma de bajarlos desde las activas.
  const alternarResuelto = useCallback(
    async (fila: Fila) => {
      const siguiente = !fila.resuelta;
      setFilas((prev) =>
        (prev ?? []).map((f) =>
          f.id === fila.id
            ? { ...f, resuelta: siguiente, pendientes: siguiente ? 0 : f.pendientes }
            : f,
        ),
      );
      const { error } = await supabase
        .from("conversaciones")
        .update({ resuelta: siguiente })
        .eq("id", fila.id);
      if (error) {
        setFilas((prev) =>
          (prev ?? []).map((f) =>
            f.id === fila.id
              ? { ...f, resuelta: !siguiente, pendientes: fila.pendientes }
              : f,
          ),
        );
        return;
      }
      if (siguiente && session) {
        await supabase.from("conversacion_lecturas").upsert({
          conversacion_id: fila.id,
          usuario_id: session.user.id,
          leido_hasta: new Date().toISOString(),
        });
      }
    },
    [session],
  );

  if (!session) {
    return (
      <View style={styles.contenedor}>
        <TituloPantalla kicker="Tu actividad" titulo="Mensajes" />
        <View style={styles.centro}>
          <Text style={styles.vacioTitulo}>Iniciá sesión</Text>
          <Text style={styles.vacioTexto}>
            Entrá a tu cuenta para ver tus conversaciones.
          </Text>
          <Pressable style={styles.boton} onPress={() => router.replace("/?tab=perfil" as never)}>
            <Text style={styles.botonTexto}>Ir a mi perfil</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (filas === null) {
    return (
      <View style={styles.contenedor}>
        <TituloPantalla kicker="Tu actividad" titulo="Mensajes" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  const porCategoria =
    categoria === "todas" ? filas : filas.filter((f) => f.categoria === categoria);
  const activas = porCategoria.filter((f) => !f.resuelta);
  const resueltas = porCategoria.filter((f) => f.resuelta);
  const visibles = tab === "activas" ? activas : resueltas;

  // Solo se muestran chips de las categorías que de verdad tienen
  // chats — no tiene sentido ofrecer "Citas" si esta persona nunca
  // tuvo un chat de esa vertical.
  const categoriasConDatos = ORDEN_CATEGORIAS_CHAT.filter((cat) =>
    filas.some((f) => f.categoria === cat),
  );

  return (
    <View style={styles.contenedor}>
      <TituloPantalla
        kicker="Tu actividad"
        titulo="Mensajes"
        subtitulo="Deslizá un chat: derecha lo marca leído, izquierda lo elimina."
      />
      {categoriasConDatos.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsFila}
        >
          <ChipCategoria texto="Todas" activo={categoria === "todas"} onPress={() => setCategoria("todas")} />
          {categoriasConDatos.map((cat) => (
            <ChipCategoria
              key={cat}
              texto={CATEGORIA_CHAT_LABEL[cat]}
              activo={categoria === cat}
              onPress={() => setCategoria(cat)}
            />
          ))}
        </ScrollView>
      )}
      {filas.length > 0 && (
        <View style={styles.tabsFila}>
          <Pressable
            style={[styles.tabBoton, tab === "activas" && styles.tabBotonActivo]}
            onPress={() => setTab("activas")}
          >
            <Text style={[styles.tabTexto, tab === "activas" && styles.tabTextoActivo]}>
              Activas {activas.length}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBoton, tab === "resueltas" && styles.tabBotonActivo]}
            onPress={() => setTab("resueltas")}
          >
            <Text style={[styles.tabTexto, tab === "resueltas" && styles.tabTextoActivo]}>
              Resueltas {resueltas.length}
            </Text>
          </Pressable>
          {tab === "resueltas" && resueltas.length > 0 && (
            <Pressable style={styles.tabVaciar} onPress={vaciarResueltas}>
              <Ionicons name="trash-outline" size={14} color={Colors.inkSoft} />
              <Text style={styles.tabVaciarTexto}>Vaciar</Text>
            </Pressable>
          )}
        </View>
      )}
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.three, paddingBottom: TAB_BAR_ESPACIO }}
        data={visibles}
        keyExtractor={(f) => f.id}
        onRefresh={cargar}
        refreshing={false}
        ListEmptyComponent={
          <View style={styles.centro}>
            <Text style={styles.vacioTitulo}>
              {tab === "activas" ? "Todavía no tenés conversaciones" : "No hay chats resueltos"}
            </Text>
            {tab === "activas" && (
              <Text style={styles.vacioTexto}>
                Cuando reservés un lugar o pidás una cotización, el chat con el
                proveedor aparece acá.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <FilaChat
            fila={item}
            onAbrir={() => router.push(item.href as never)}
            onLeido={() => marcarLeido(item)}
            onEliminar={() => eliminarChat(item)}
            onResuelto={() => alternarResuelto(item)}
          />
        )}
      />
    </View>
  );
}

function FilaChat({
  fila,
  onAbrir,
  onLeido,
  onEliminar,
  onResuelto,
}: {
  fila: Fila;
  onAbrir: () => void;
  onLeido: () => void;
  onEliminar: () => void;
  onResuelto: () => void;
}) {
  const swipeRef = useRef<SwipeableMethods | null>(null);
  const nuevo = fila.pendientes > 0;

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={56}
      rightThreshold={56}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={styles.swipeContenedor}
      renderLeftActions={() => (
        <View style={[styles.accion, styles.accionLeido]}>
          <Ionicons name="checkmark-done" size={22} color="#ffffff" />
          <Text style={styles.accionTexto}>Leído</Text>
        </View>
      )}
      renderRightActions={() => (
        <View style={[styles.accion, styles.accionEliminar]}>
          <Ionicons name="trash-outline" size={22} color="#ffffff" />
          <Text style={styles.accionTexto}>Eliminar</Text>
        </View>
      )}
      onSwipeableOpen={(direccion) => {
        if (direccion === SwipeDirection.LEFT) {
          onLeido();
          swipeRef.current?.close();
        } else {
          onEliminar();
        }
      }}
    >
      <Pressable style={[styles.fila, nuevo && styles.filaNoLeida]} onPress={onAbrir}>
        {fila.foto ? (
          <Image source={{ uri: fila.foto }} alt="" style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: Colors.cream2 }]} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.titulo} numberOfLines={1}>
            {fila.titulo}
          </Text>
          {!!fila.subtitulo && (
            <Text style={styles.subtitulo} numberOfLines={1}>
              {fila.subtitulo}
            </Text>
          )}
          <Text
            style={[styles.preview, nuevo && styles.previewNoLeido]}
            numberOfLines={1}
          >
            {(() => {
              // Los mensajes del asistente vienen marcados con el
              // prefijo en la base: en la vista previa se muestra como
              // ícono, igual que dentro del hilo — nunca el emoji crudo.
              for (const antes of ["", "Vos: "]) {
                const marca = antes + PREFIJO_ASISTENTE;
                if (!fila.ultimoTexto.startsWith(marca)) continue;
                return (
                  <>
                    {antes}
                    <Ionicons name="sparkles" size={12} color={Colors.accent} />{" "}
                    {fila.ultimoTexto.slice(marca.length)}
                  </>
                );
              }
              return fila.ultimoTexto;
            })()}
          </Text>
          <View style={styles.tagsFila}>
            <View style={[styles.tag, { backgroundColor: fila.tag.fondo }]}>
              <Text style={[styles.tagTexto, { color: fila.tag.color }]}>
                {fila.tag.texto}
              </Text>
            </View>
            {nuevo && (
              <View style={[styles.tag, { backgroundColor: Colors.green }]}>
                <Text style={[styles.tagTexto, { color: "#ffffff" }]}>
                  {fila.pendientes === 1
                    ? "1 mensaje nuevo"
                    : `${fila.pendientes} mensajes nuevos`}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.colDerecha}>
          <View style={[styles.chipFecha, nuevo && styles.chipFechaNueva]}>
            <Text style={[styles.chipFechaTexto, nuevo && styles.chipTextoBlanco]}>
              {fechaCorta(fila.actividad)}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onResuelto();
            }}
            style={styles.botonResuelto}
            hitSlop={8}
          >
            <Ionicons
              name={fila.resuelta ? "refresh-outline" : "checkmark-circle-outline"}
              size={13}
              color={Colors.navy}
            />
            <Text style={styles.botonResueltoTexto}>
              {fila.resuelta ? "Reabrir" : "Resuelto"}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.five,
    gap: Spacing.one,
  },
  vacioTitulo: { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.ink },
  vacioTexto: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: "center",
    maxWidth: 280,
  },
  boton: {
    marginTop: Spacing.two,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
  },
  botonTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 13.5 },
  chipsFila: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  tabsFila: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  tabBoton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  tabBotonActivo: { borderColor: Colors.navy, backgroundColor: Colors.navy },
  tabVaciar: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabVaciarTexto: { fontFamily: Fonts.bold, fontSize: 12.5, color: Colors.inkSoft },
  tabTexto: { fontFamily: Fonts.bold, fontSize: 12.5, color: Colors.inkSoft },
  tabTextoActivo: { color: "#ffffff" },
  swipeContenedor: { marginBottom: Spacing.two },
  accion: {
    width: 96,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  accionLeido: { backgroundColor: Colors.navy, marginRight: Spacing.two },
  accionEliminar: { backgroundColor: Colors.danger, marginLeft: Spacing.two },
  accionTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 11 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 16,
    padding: Spacing.two,
  },
  filaNoLeida: { backgroundColor: Colors.greenLight, borderColor: Colors.green },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  titulo: { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.ink },
  subtitulo: { fontFamily: Fonts.medium, fontSize: 11.5, color: Colors.inkSoft },
  preview: { marginTop: 2, fontFamily: Fonts.medium, fontSize: 12.5, color: Colors.inkSoft },
  previewNoLeido: { fontFamily: Fonts.bold, color: Colors.ink },
  tagsFila: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
  tag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagTexto: { fontFamily: Fonts.bold, fontSize: 10 },
  colDerecha: { alignItems: "flex-end", gap: 5 },
  chipFecha: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipFechaNueva: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipFechaTexto: { fontFamily: Fonts.bold, fontSize: 10.5, color: Colors.inkSoft },
  chipTextoBlanco: { fontFamily: Fonts.bold, fontSize: 10.5, color: "#ffffff" },
  botonResuelto: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3 },
  botonResueltoTexto: { fontFamily: Fonts.bold, fontSize: 10.5, color: Colors.navy },
});
