import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { abrirHiloConsulta } from "@/lib/consulta";
import { pedirAvisoDeMensaje } from "@/lib/notificaciones";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import {
  PAQUETES_INVITACIONES,
  PAQUETES_PRINCIPALES,
  SLUG_NEGOCIO_INVITACIONES,
  precioPaquete,
} from "@/lib/paquetes-invitaciones";
import { CATALOGO_INVITACIONES } from "@/lib/catalogo-invitaciones";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

type Invitacion = {
  id: string;
  slug: string;
  titulo: string;
  fecha_evento: string;
  estado: string;
};

type Album = {
  id: string;
  slug: string;
  titulo: string;
};

/** "2026-12-12" → "12 de diciembre de 2026". */
function fmtFechaEvento(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const ESTADO_INVITACION_LABEL: Record<string, string> = {
  borrador: "En diseño",
  activa: "Activa",
  archivada: "Archivada",
};

/**
 * Invitaciones digitales y álbumes del evento — espejo de /invitaciones
 * y /cuenta en la web: con sesión se listan las invitaciones y álbumes
 * propios (para verlos y compartirlos), y debajo SIEMPRE los tres
 * paquetes a la venta. "Quiero este paquete" abre el chat con el
 * negocio de Invitaciones de Bookea con el pedido ya escrito.
 */
export default function InvitacionesScreen() {
  const router = useRouter();
  const { session, cargando } = useAuth();
  const [invitaciones, setInvitaciones] = useState<Invitacion[] | null>(null);
  const [albumes, setAlbumes] = useState<Album[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [pidiendo, setPidiendo] = useState<string | null>(null);
  /** Qué paquete tiene abierto su "Ver más" (uno a la vez). */
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);
  const [verAlbumes, setVerAlbumes] = useState(false);

  const cargar = useCallback(async () => {
    if (!session) return;
    // Se tolera el error de tabla (base sin las migraciones 0066/0068):
    // la pantalla sigue mostrando los paquetes aunque no haya qué listar.
    const [invRes, albRes] = await Promise.all([
      supabase
        .from("invitaciones")
        .select("id, slug, titulo, fecha_evento, estado")
        .eq("cliente_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("albumes")
        .select("id, slug, titulo")
        .eq("cliente_id", session.user.id)
        .order("created_at", { ascending: false }),
    ]);
    setInvitaciones(invRes.error ? [] : ((invRes.data ?? []) as Invitacion[]));
    setAlbumes(albRes.error ? [] : ((albRes.data ?? []) as Album[]));
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  async function compartirInvitacion(inv: Invitacion) {
    try {
      await Share.share({
        message: `Mirá la invitación "${inv.titulo}": ${SITIO_URL}/i/${inv.slug}`,
      });
    } catch {
      // Cancelar la hoja de compartir no es un error.
    }
  }

  /**
   * "Quiero este paquete" ya no cae en el chat: abre el formulario de
   * pedido, igual que en la web. El chat quedó para las dudas —
   * pedir por conversación obligaba al equipo a sacarle los datos de
   * la fiesta uno por uno, y la mitad se perdía en el camino.
   */
  function pedirPaquete(paqueteId: string) {
    if (!session) {
      router.push("/cuenta" as never);
      return;
    }
    router.push(`/invitaciones/pedido/${paqueteId}` as never);
  }

  /**
   * Abre (o retoma) el hilo con el negocio de Invitaciones de Bookea
   * para consultar antes de pedir. El primer mensaje se manda solo si
   * el hilo está vacío.
   */
  async function consultarPorChat() {
    if (!session) {
      router.push("/cuenta" as never);
      return;
    }
    if (pidiendo) return;
    setPidiendo("consulta");
    try {
      const { data: negocio } = await supabase
        .from("ranchos")
        .select("id")
        .eq("slug", SLUG_NEGOCIO_INVITACIONES)
        .eq("estado", "aprobado")
        .maybeSingle();

      if (!negocio) {
        Alert.alert(
          "No se pudo abrir el pedido",
          "Intentá de nuevo en un momento o escribinos a hola@bookea.lat.",
        );
        return;
      }

      const convId = await abrirHiloConsulta(negocio.id as string, session.user.id);
      if (!convId) {
        Alert.alert(
          "No se pudo abrir el pedido",
          "Intentá de nuevo en un momento o escribinos a hola@bookea.lat.",
        );
        return;
      }

      // El primer mensaje va una sola vez: si el hilo ya tiene algo
      // (un pedido anterior, una conversación abierta), no se repite.
      const { count } = await supabase
        .from("mensajes")
        .select("id", { count: "exact", head: true })
        .eq("conversacion_id", convId);

      if (!count) {
        const texto =
          "¡Hola! Tengo una consulta sobre las invitaciones digitales de " +
          "Bookea antes de hacer mi pedido:";
        const { data: mensaje } = await supabase
          .from("mensajes")
          .insert({ conversacion_id: convId, autor_id: session.user.id, texto })
          .select("id")
          .maybeSingle();
        // El push al equipo lo manda la web — sin await: el pedido ya
        // quedó guardado y el aviso es un plus.
        if (mensaje?.id) void pedirAvisoDeMensaje(mensaje.id as string);
      }

      router.push(`/mensajes/hilo/${convId}` as never);
    } finally {
      setPidiendo(null);
    }
  }

  const listando = session && (invitaciones === null || albumes === null);

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        titulo="Invitaciones y álbumes"
        subtitulo="Tus eventos, con confirmación y fotos"
        onVolver={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />

      <ScrollView
        contentContainerStyle={styles.lista}
        refreshControl={
          session ? <RefreshControl refreshing={refrescando} onRefresh={refrescar} /> : undefined
        }
      >
        {cargando || listando ? (
          <View style={styles.cargando}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : !session ? (
          /* Sin sesión: se avisa y se invita a entrar — los paquetes
             de abajo igual se pueden ver. */
          <View style={styles.avisoSesion}>
            <Ionicons name="mail-open-outline" size={26} color={Colors.navy} />
            <Text style={styles.avisoSesionTitulo}>Entrá para ver tus invitaciones</Text>
            <Text style={styles.avisoSesionTexto}>
              Con tu cuenta vas a ver acá tus invitaciones digitales y los
              álbumes de fotos de tus eventos.
            </Text>
            <Pressable
              onPress={() => router.push("/cuenta" as never)}
              style={({ pressed }) => [styles.botonNavy, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.botonNavyTexto}>Iniciar sesión</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {invitaciones && invitaciones.length > 0 && (
              <View style={styles.seccion}>
                <Text style={styles.seccionTitulo}>Tus invitaciones</Text>
                {invitaciones.map((inv) => (
                  <View key={inv.id} style={styles.tarjeta}>
                    <View style={styles.tarjetaFila}>
                      <View style={styles.iconoBurbuja}>
                        <Ionicons name="mail-outline" size={18} color={Colors.navy} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.tarjetaTitulo} numberOfLines={1}>
                          {inv.titulo}
                        </Text>
                        <Text style={styles.tarjetaDetalle} numberOfLines={1}>
                          {fmtFechaEvento(inv.fecha_evento)}
                          {" · "}
                          {ESTADO_INVITACION_LABEL[inv.estado] ?? inv.estado}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.tarjetaBotones}>
                      <Pressable
                        onPress={() =>
                          void WebBrowser.openBrowserAsync(`${SITIO_URL}/i/${inv.slug}`)
                        }
                        style={({ pressed }) => [styles.botonNavyChico, pressed && { opacity: 0.9 }]}
                      >
                        <Ionicons name="eye-outline" size={14} color="#ffffff" />
                        <Text style={styles.botonNavyChicoTexto}>Ver invitación</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => compartirInvitacion(inv)}
                        style={({ pressed }) => [
                          styles.botonContornoChico,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons name="share-social-outline" size={14} color={Colors.navy} />
                        <Text style={styles.botonContornoChicoTexto}>Compartir</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {albumes && albumes.length > 0 && (
              <View style={styles.seccion}>
                <Text style={styles.seccionTitulo}>Tus álbumes</Text>
                {albumes.map((alb) => (
                  <View key={alb.id} style={styles.tarjeta}>
                    <View style={styles.tarjetaFila}>
                      <View style={styles.iconoBurbuja}>
                        <Ionicons name="images-outline" size={18} color={Colors.navy} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.tarjetaTitulo} numberOfLines={1}>
                          {alb.titulo}
                        </Text>
                        <Text style={styles.tarjetaDetalle}>Álbum de fotos del evento</Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          void WebBrowser.openBrowserAsync(`${SITIO_URL}/a/${alb.slug}`)
                        }
                        style={({ pressed }) => [styles.botonNavyChico, pressed && { opacity: 0.9 }]}
                      >
                        <Ionicons name="eye-outline" size={14} color="#ffffff" />
                        <Text style={styles.botonNavyChicoTexto}>Ver álbum</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {invitaciones?.length === 0 && albumes?.length === 0 && (
              <View style={styles.seccion}>
                <Text style={styles.sinNada}>
                  Todavía no tenés invitaciones ni álbumes. Elegí un paquete
                  acá abajo y el equipo de Bookea diseña el tuyo.
                </Text>
              </View>
            )}
          </>
        )}

        {/* La vitrina de diseños — espejo de "Diseños listos para
            enamorarte" de la web. Cada card abre la demo real en el
            navegador. Lienzos azules SÓLIDOS de la paleta, sin
            degradados, igual que allá. */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Diseños listos para enamorarte</Text>
          <Text style={styles.seccionSubtitulo}>
            Tocá cualquiera y vivila como la viviría tu invitado — cada una es
            una invitación real. Y si querés algo único, lo diseñamos desde cero.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vitrina}
          >
            {CATALOGO_INVITACIONES.map((d) => (
              <Pressable
                key={d.slug}
                accessibilityRole="button"
                accessibilityLabel={`Ver la demo de ${d.nombre}`}
                onPress={() =>
                  void WebBrowser.openBrowserAsync(`${SITIO_URL}/i/${d.slug}`)
                }
                style={({ pressed }) => [styles.demo, pressed && { opacity: 0.9 }]}
              >
                <View style={[styles.demoLienzo, { backgroundColor: d.lienzo }]}>
                  <Ionicons name={d.icono} size={26} color={d.tintaIcono} />
                </View>
                <View style={styles.demoCuerpo}>
                  <Text style={styles.demoOcasion} numberOfLines={1}>
                    {d.ocasion.toUpperCase()}
                  </Text>
                  <Text style={styles.demoNombre} numberOfLines={1}>
                    {d.nombre}
                  </Text>
                  <Text style={styles.demoVivir}>Vivir la demo →</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Los tres paquetes principales — siempre visibles, con o sin
            sesión, igual que la landing /invitaciones de la web. Los
            de álbumes quedan plegados abajo: son más caros y le
            robaban la atención a los de venta directa. */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Paquetes de invitación digital</Text>
          <Text style={styles.seccionSubtitulo}>
            El equipo de Bookea diseña tu invitación y tus invitados confirman
            en el link. Elegí el tuyo y contanos de tu fiesta.
          </Text>

          {PAQUETES_PRINCIPALES.map((p) => (
            <View key={p.id} style={[styles.paquete, p.destacado && styles.paqueteDestacado]}>
              <View style={styles.paqueteEncabezado}>
                <Text style={[styles.paqueteNombre, p.destacado && styles.textoBlanco]}>
                  {p.nombre}
                </Text>
                <View style={[styles.paqueteBadge, p.destacado && styles.paqueteBadgeDestacado]}>
                  <Text
                    style={[
                      styles.paqueteBadgeTexto,
                      p.destacado && styles.paqueteBadgeTextoDestacado,
                    ]}
                  >
                    {p.badge}
                  </Text>
                </View>
              </View>
              <Text style={[styles.paquetePrecio, p.destacado && styles.textoBlanco]}>
                {p.precioEtiqueta}
              </Text>
              <Text style={[styles.paqueteLema, p.destacado && styles.textoBlancoSuave]}>
                {p.lema}
              </Text>

              <View style={styles.paqueteLista}>
                {p.incluye.map((linea) => (
                  <View key={linea} style={styles.paqueteItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={15}
                      color={p.destacado ? Colors.accent : Colors.green}
                    />
                    <Text style={[styles.paqueteItemTexto, p.destacado && styles.textoBlancoSuave]}>
                      {linea}
                    </Text>
                  </View>
                ))}

                {/* El detalle fino solo si lo piden: la card compacta
                    es la que vende, la letra chica espanta. */}
                {detalleAbierto === p.id &&
                  p.detalle.map((linea) => (
                    <View key={linea} style={styles.paqueteItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={15}
                        color={p.destacado ? Colors.accent : Colors.green}
                      />
                      <Text
                        style={[styles.paqueteItemTexto, p.destacado && styles.textoBlancoSuave]}
                      >
                        {linea}
                      </Text>
                    </View>
                  ))}
              </View>

              {p.detalle.length > 0 && (
                <Pressable
                  onPress={() => setDetalleAbierto(detalleAbierto === p.id ? null : p.id)}
                  hitSlop={6}
                >
                  <Text style={[styles.verMas, p.destacado && styles.verMasDestacado]}>
                    {detalleAbierto === p.id ? "Ver menos ↑" : "Ver más ↓"}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => pedirPaquete(p.id)}
                style={({ pressed }) => [
                  styles.paqueteBoton,
                  p.destacado && styles.paqueteBotonDestacado,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.paqueteBotonTexto}>Quiero este paquete</Text>
              </Pressable>
            </View>
          ))}

          {/* Los packs con álbum, plegados. */}
          <Pressable
            onPress={() => setVerAlbumes(!verAlbumes)}
            style={({ pressed }) => [styles.plegable, pressed && { opacity: 0.85 }]}
          >
            <Ionicons
              name={verAlbumes ? "chevron-up" : "chevron-down"}
              size={16}
              color={Colors.navy}
            />
            <Text style={styles.plegableTexto}>
              {verAlbumes ? "Ocultar los packs con álbumes" : "Ver packs con álbumes digitales"}
            </Text>
          </Pressable>

          {verAlbumes &&
            PAQUETES_INVITACIONES.map((p) => (
              <View key={p.id} style={[styles.paquete, p.destacado && styles.paqueteDestacado]}>
                <View style={styles.paqueteEncabezado}>
                  <Text style={[styles.paqueteNombre, p.destacado && styles.textoBlanco]}>
                    {p.nombre}
                  </Text>
                  <View
                    style={[styles.paqueteBadge, p.destacado && styles.paqueteBadgeDestacado]}
                  >
                    <Text
                      style={[
                        styles.paqueteBadgeTexto,
                        p.destacado && styles.paqueteBadgeTextoDestacado,
                      ]}
                    >
                      {p.badge}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.paquetePrecio, p.destacado && styles.textoBlanco]}>
                  {precioPaquete(p.precio)}
                </Text>
                <Text style={[styles.paqueteLema, p.destacado && styles.textoBlancoSuave]}>
                  {p.lema}
                </Text>
                <View style={styles.paqueteLista}>
                  {p.incluye.map((linea) => (
                    <View key={linea} style={styles.paqueteItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={15}
                        color={p.destacado ? Colors.accent : Colors.green}
                      />
                      <Text
                        style={[styles.paqueteItemTexto, p.destacado && styles.textoBlancoSuave]}
                      >
                        {linea}
                      </Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={() => pedirPaquete(p.id)}
                  style={({ pressed }) => [
                    styles.paqueteBoton,
                    p.destacado && styles.paqueteBotonDestacado,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.paqueteBotonTexto}>Quiero este paquete</Text>
                </Pressable>
              </View>
            ))}

          {/* El chat queda para las dudas, no para pedir. */}
          <Pressable
            disabled={pidiendo !== null}
            onPress={consultarPorChat}
            style={({ pressed }) => [styles.consulta, pressed && { opacity: 0.85 }]}
          >
            {pidiendo === "consulta" ? (
              <ActivityIndicator color={Colors.navy} size="small" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={15} color={Colors.navy} />
                <Text style={styles.consultaTexto}>¿Dudas? Escribinos por el chat</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  lista: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },
  cargando: { alignItems: "center", paddingVertical: Spacing.five },
  avisoSesion: {
    alignItems: "center",
    backgroundColor: "#f4f7fd",
    borderColor: "#dbe4f2",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: Spacing.four,
  },
  avisoSesionTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15.5 },
  avisoSesionTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
  },
  botonNavy: {
    backgroundColor: Colors.navy,
    borderRadius: 999,
    marginTop: Spacing.two,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  botonNavyTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 13.5 },
  seccion: { gap: Spacing.two },
  seccionTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  seccionSubtitulo: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 2,
  },
  sinNada: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  // La vitrina va en riel horizontal: cinco cards apiladas empujarían
  // los paquetes (que es lo que se vende) demasiado abajo.
  vitrina: { gap: Spacing.two, paddingBottom: 4, paddingRight: Spacing.three },
  demo: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    width: 190,
  },
  demoLienzo: { alignItems: "center", height: 84, justifyContent: "center" },
  demoCuerpo: { gap: 1, padding: Spacing.two + 2 },
  demoOcasion: {
    color: Colors.navy,
    fontFamily: Fonts.extraBold,
    fontSize: 9.5,
    letterSpacing: 0.6,
  },
  demoNombre: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 14 },
  demoVivir: {
    color: Colors.accent,
    fontFamily: Fonts.extraBold,
    fontSize: 11.5,
    marginTop: 2,
  },
  tarjeta: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  tarjetaFila: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  iconoBurbuja: {
    alignItems: "center",
    backgroundColor: "#e8ecf6",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  tarjetaTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 14.5 },
  tarjetaDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, marginTop: 1 },
  tarjetaBotones: { flexDirection: "row", gap: Spacing.two },
  botonNavyChico: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  botonNavyChicoTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 12.5 },
  botonContornoChico: {
    alignItems: "center",
    borderColor: Colors.navy,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  botonContornoChicoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
  paquete: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    marginBottom: Spacing.two,
    padding: Spacing.four,
  },
  paqueteDestacado: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  paqueteEncabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paqueteNombre: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  paqueteBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paqueteBadgeDestacado: { backgroundColor: Colors.accent },
  paqueteBadgeTexto: {
    color: Colors.accent,
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  paqueteBadgeTextoDestacado: { color: "#ffffff" },
  paquetePrecio: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 26,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  paqueteLema: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  paqueteLista: { gap: 7, marginTop: Spacing.two },
  paqueteItem: { flexDirection: "row", gap: 7 },
  paqueteItemTexto: {
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  paqueteBoton: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 999,
    justifyContent: "center",
    marginTop: Spacing.three,
    paddingVertical: 12,
  },
  paqueteBotonDestacado: { backgroundColor: Colors.accent },
  paqueteBotonTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 13.5 },
  verMas: {
    color: Colors.navy,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    marginTop: Spacing.two,
  },
  verMasDestacado: { color: Colors.accent },
  // El plegable de los packs con álbum y el acceso al chat: los dos
  // son acciones de segunda fila, así que van en contorno, no sólidos.
  plegable: {
    alignItems: "center",
    alignSelf: "center",
    borderColor: Colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: Spacing.two,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  plegableTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
  consulta: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: Spacing.three,
    paddingVertical: 8,
  },
  consultaTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
  textoBlanco: { color: "#ffffff" },
  textoBlancoSuave: { color: "rgba(255,255,255,0.85)" },
});
