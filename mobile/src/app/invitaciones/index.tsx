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
import { SLUG_NEGOCIO_INVITACIONES } from "@/lib/paquetes-invitaciones";
import {
  CATALOGO_INVITACIONES,
  CATEGORIAS_INVITACIONES,
  type CategoriaInvitacion,
} from "@/lib/catalogo-invitaciones";

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
 * Invitaciones digitales y álbumes del evento: acá se VEN y se
 * comparten los propios, y se puede recorrer la vitrina de diseños.
 *
 * Contratar, pedir y pagar viven SOLO en bookea.lat, a propósito. Son
 * contenido digital, y las tiendas (guía 3.1.1 de Apple, política de
 * pagos de Google) exigen compra in-app para cobrarlo dentro de la app
 * — meterlo acá pone en riesgo la revisión del app entero, incluidas
 * las reservas de espacios, que sí pueden cobrarse por fuera porque son
 * un servicio del mundo real.
 *
 * Por lo mismo esta pantalla no muestra precios, paquetes ni botones de
 * compra: el link al sitio es neutro, sin llamada a la acción de venta.
 */
export default function InvitacionesScreen() {
  const router = useRouter();
  const { session, cargando } = useAuth();
  const [invitaciones, setInvitaciones] = useState<Invitacion[] | null>(null);
  const [albumes, setAlbumes] = useState<Album[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [pidiendo, setPidiendo] = useState<string | null>(null);
  /** El plegable de "Invitaciones recibidas" — cerrado por defecto. */
  const [recibidasAbierto, setRecibidasAbierto] = useState(false);
  // La pestaña de la vitrina: arranca en la primera que tenga ejemplos.
  const [categoria, setCategoria] = useState<CategoriaInvitacion>(
    () =>
      CATEGORIAS_INVITACIONES.find((c) =>
        CATALOGO_INVITACIONES.some((d) => d.categoria === c.id),
      )?.id ?? CATEGORIAS_INVITACIONES[0].id,
  );
  const demosVisibles = CATALOGO_INVITACIONES.filter((d) => d.categoria === categoria);

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
            {/* ── 1. LA PUERTA AL PRODUCTO ─────────────────────────
                Un card que explica qué son las invitaciones digitales
                y lleva a la página de información. Va primero porque
                es lo único que le sirve a quien todavía no tiene
                ninguna — que es casi todo el mundo la primera vez. */}
            <View style={styles.seccion}>
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void WebBrowser.openBrowserAsync(`${SITIO_URL}/invitaciones`)
                }
                style={({ pressed }) => [styles.cardProducto, pressed && { opacity: 0.92 }]}
              >
                <View style={styles.cardProductoIcono}>
                  <Ionicons name="mail-open" size={24} color="#ffffff" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardProductoTitulo}>Invitaciones digitales</Text>
                  <Text style={styles.cardProductoTexto}>
                    Una invitación que se vive en el teléfono, con confirmación de
                    asistencia y álbum de fotos.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
              </Pressable>
            </View>

            {/* ── 2. INVITACIONES RECIBIDAS, plegable ──────────────
                Las que te mandaron a VOS. Hoy la base no las sabe
                relacionar con tu cuenta: `invitacion_rsvp` guarda el
                nombre que escribió el invitado, sin `cliente_id` ni
                correo (migración 0066), así que no hay forma honesta
                de decir "estas son tuyas". Se deja el lugar hecho y
                se dice la verdad en vez de inventar una lista. */}
            <View style={styles.seccion}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: recibidasAbierto }}
                onPress={() => setRecibidasAbierto((v) => !v)}
                style={({ pressed }) => [styles.plegable, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.iconoBurbuja}>
                  <Ionicons name="download-outline" size={18} color={Colors.navy} />
                </View>
                <Text style={styles.plegableTitulo}>Invitaciones recibidas</Text>
                <Ionicons
                  name={recibidasAbierto ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={Colors.inkSoft}
                />
              </Pressable>
              {recibidasAbierto && (
                <View style={styles.plegableCuerpo}>
                  <Text style={styles.sinNada}>
                    Todavía no tenemos cómo saber cuáles te mandaron a vos: cuando
                    confirmás asistencia se guarda tu nombre, no tu cuenta. Estamos
                    conectándolo — mientras tanto, abrí la invitación con el link que
                    te compartieron.
                  </Text>
                </View>
              )}
            </View>

            {/* ── 3. MIS INVITACIONES ─────────────────────────────── */}
            <View style={styles.seccion}>
              <Text style={styles.seccionTitulo}>Mis invitaciones</Text>
              {invitaciones && invitaciones.length > 0 ? (
                invitaciones.map((inv) => (
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
                        <Text style={styles.botonNavyChicoTexto}>Ver</Text>
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
                      {/* Administrar: la lista de asistencia y el resto
                          viven en `/cuenta/evento/[id]` de la web — es
                          el panel real de la invitación (confirmados,
                          acompañantes, mensajes), no una pantalla nueva
                          acá. Va por id, no por slug: esa ruta es
                          privada y el slug es el link público. */}
                      <Pressable
                        onPress={() =>
                          void WebBrowser.openBrowserAsync(
                            `${SITIO_URL}/cuenta/evento/${inv.id}`,
                          )
                        }
                        style={({ pressed }) => [
                          styles.botonContornoChico,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons name="people-outline" size={14} color={Colors.navy} />
                        <Text style={styles.botonContornoChicoTexto}>Administrar</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.sinNada}>
                  Todavía no tenés ninguna. Cuando el equipo termine la tuya, aparece
                  acá para verla, compartirla y ver quién confirmó.
                </Text>
              )}
            </View>

            {/* ── 4. ÁLBUMES DIGITALES ────────────────────────────── */}
            <View style={styles.seccion}>
              <Text style={styles.seccionTitulo}>Álbumes digitales</Text>
              {albumes && albumes.length > 0 ? (
                albumes.map((alb) => (
                  <View key={alb.id} style={styles.tarjeta}>
                    <View style={styles.tarjetaFila}>
                      <View style={styles.iconoBurbuja}>
                        <Ionicons name="images-outline" size={18} color={Colors.navy} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.tarjetaTitulo} numberOfLines={1}>
                          {alb.titulo}
                        </Text>
                        <Text style={styles.tarjetaDetalle}>Fotos del evento</Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          void WebBrowser.openBrowserAsync(`${SITIO_URL}/a/${alb.slug}`)
                        }
                        style={({ pressed }) => [styles.botonNavyChico, pressed && { opacity: 0.9 }]}
                      >
                        <Ionicons name="eye-outline" size={14} color="#ffffff" />
                        <Text style={styles.botonNavyChicoTexto}>Ver</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.sinNada}>
                  Los álbumes que adquieras para tus eventos aparecen acá, con todas
                  las fotos que suban tus invitados.
                </Text>
              )}
            </View>
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
          {/* Las pestañas por ocasión — espejo de la web. También en
              riel horizontal: cinco etiquetas no caben en 390px. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pestanas}
          >
            {CATEGORIAS_INVITACIONES.map((c) => {
              const activa = c.id === categoria;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activa }}
                  onPress={() => setCategoria(c.id)}
                  style={[styles.pestana, activa && styles.pestanaActiva]}
                >
                  <Text style={[styles.pestanaTexto, activa && styles.pestanaTextoActiva]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {demosVisibles.length === 0 ? (
            <Text style={styles.sinNada}>
              Estamos preparando los ejemplos de esta categoría. Escribinos y te
              diseñamos la tuya desde cero.
            </Text>
          ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vitrina}
          >
            {demosVisibles.map((d) => (
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
          )}
        </View>

        {/* El link al sitio, deliberadamente neutro: informa dónde se
            administran las invitaciones, sin precios, sin paquetes y sin
            llamada a la compra (ver la nota de arriba). */}
        <View style={styles.seccion}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Abrir bookea.lat para administrar tus invitaciones"
            onPress={() =>
              void WebBrowser.openBrowserAsync(`${SITIO_URL}/invitaciones`)
            }
            style={({ pressed }) => [styles.enlaceSitio, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="globe-outline" size={17} color={Colors.navy} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.enlaceSitioTitulo}>
                Tus invitaciones se administran en bookea.lat
              </Text>
              <Text style={styles.enlaceSitioTexto}>
                Ahí encontrás toda la información de las invitaciones digitales.
              </Text>
            </View>
            <Ionicons name="open-outline" size={15} color={Colors.inkSoft} />
          </Pressable>
        </View>

        <View style={styles.seccion}>
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
    borderRadius: 12,
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
  // El card de arriba: navy sólido, es la puerta al producto.
  cardProducto: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 18,
    flexDirection: "row",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  cardProductoIcono: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  cardProductoTitulo: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 15.5 },
  cardProductoTexto: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  // El plegable de "Invitaciones recibidas".
  plegable: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two + 2,
    padding: Spacing.three,
  },
  plegableTitulo: { color: Colors.ink, flex: 1, fontFamily: Fonts.extraBold, fontSize: 14.5 },
  plegableCuerpo: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
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
  pestanas: { gap: 8, paddingBottom: Spacing.two, paddingRight: Spacing.three },
  pestana: {
    backgroundColor: Colors.cream2,
    borderColor: Colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pestanaActiva: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  pestanaTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.extraBold,
    fontSize: 12,
  },
  pestanaTextoActiva: { color: "#ffffff" },
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
    borderRadius: 12,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  botonNavyChicoTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 12.5 },
  botonContornoChico: {
    alignItems: "center",
    borderColor: Colors.navy,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  botonContornoChicoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
  // El link al sitio: informativo, con el peso visual de una nota y no
  // el de un botón de compra.
  enlaceSitio: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
  },
  enlaceSitioTitulo: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13.5 },
  enlaceSitioTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  consulta: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: Spacing.three,
    paddingVertical: 8,
  },
  consultaTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
});
