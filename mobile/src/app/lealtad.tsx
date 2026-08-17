import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Sombras, Spacing } from "@/constants/theme";

/**
 * Bookea Lealtad en el app: qué es el programa de clientes frecuentes,
 * cómo funciona, y —si ya lo tenés— por dónde se administra.
 *
 * ------------------------------------------------------------------
 * ACÁ NO HAY PRECIOS NI PAQUETES, Y ESO ES EL PUNTO
 * ------------------------------------------------------------------
 * Un paquete de software es CONTENIDO DIGITAL, y las tiendas (guía
 * 3.1.1 de Apple, política de pagos de Google) exigen compra in-app
 * para cobrarlo dentro de la app. Mostrar el precio acá —aunque el
 * cobro ocurra en el sitio— es señalar una vía de pago externa, que es
 * justo lo que esas reglas miran.
 *
 * Y lo que se arriesga no es esta pantalla: es la revisión del app
 * ENTERO, incluidas las reservas de espacios y las citas, que sí se
 * pueden cobrar por fuera porque son un servicio del mundo real.
 *
 * Es la MISMA decisión que ya tomó `app/invitaciones/index.tsx`: ahí
 * tampoco hay precios, ni paquetes, ni botón de compra, y el link al
 * sitio es neutro. Lealtad estaba a mitad de camino —mandaba el alta a
 * la web pero seguía pintando el catálogo con montos y botones
 * «Solicitarlo»—, y esto lo termina de cruzar.
 *
 * Por eso también desapareció el catálogo bajado de
 * `GET /api/lealtad/planes`: no era un problema de datos viejos (ese ya
 * estaba resuelto), es que ese cuerpo es precios, y precios no van.
 * El endpoint sigue vivo del lado de la web, que es donde se venden.
 *
 * ------------------------------------------------------------------
 * QUÉ SÍ HACE ESTA PANTALLA
 * ------------------------------------------------------------------
 *   · Explica el producto en lenguaje de dueño de negocio.
 *   · Al que YA tiene el programa lo lleva a administrarlo. Eso no es
 *     una compra: es entrar a algo que ya contrató.
 *   · Deja un link informativo al sitio, sin urgencia ni «contratá».
 */

/** Desvío de la web: sin sesión manda al login, con sesión al panel. */
const RUTA_PANEL = "/lealtad/entrar";
/** La página informativa del sitio — el link neutro. */
const RUTA_INFO = "/lealtad";
const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

const PASOS: { paso: string; titulo: string; texto: string }[] = [
  {
    paso: "1",
    titulo: "El cliente se afilia",
    texto:
      "Escanea tu QR una sola vez y su tarjeta queda en el Wallet del teléfono — sin descargar nada.",
  },
  {
    paso: "2",
    titulo: "Suma en cada visita",
    texto:
      "Un sello por visita o puntos por monto — vos decidís las reglas y el sistema lleva la cuenta.",
  },
  {
    paso: "3",
    titulo: "Canjea y vuelve",
    texto:
      "Al completar, canjea su premio con el QR en el local. Y la tarjeta arranca de nuevo.",
  },
];

const NEGOCIOS = [
  "Restaurantes",
  "Cafeterías",
  "Sodas",
  "Barberías",
  "Salones de belleza",
  "Spas",
  "Gimnasios",
  "Lavacars",
];

/**
 * Lo que hace el programa, en viñetas.
 *
 * Esto SÍ va escrito en el bundle, y no se contradice con la razón por
 * la que los precios se sacaron: acá no hay un solo número que pueda
 * quedar desactualizado ni insinuar un cobro. Son capacidades comunes a
 * cualquier programa —lo que se puede hacer, no cuánto sale ni cuánto
 * cabe—, así que se quedan afuera a propósito los topes de clientes y
 * los tipos de tarjeta contados, que sí cambian según el paquete.
 */
const CAPACIDADES: { icono: keyof typeof Ionicons.glyphMap; texto: string }[] = [
  { icono: "wallet-outline", texto: "La tarjeta vive en Apple Wallet y Google Wallet" },
  { icono: "color-palette-outline", texto: "Tu color, tu logo y tus textos en la tarjeta" },
  { icono: "options-outline", texto: "Tus reglas, tus límites y tus vencimientos" },
  { icono: "qr-code-outline", texto: "Póster con tu QR, listo para imprimir" },
  { icono: "storefront-outline", texto: "Modo mostrador para sellar y canjear en el local" },
  { icono: "people-outline", texto: "Tu equipo, con permisos por persona" },
  { icono: "stats-chart-outline", texto: "Métricas: altas, activos, sellos y canjes" },
];

/** Los sellos del mock: 7 de 10 llenos, como en la web. */
const SELLOS_LLENOS = 7;
const SELLOS_TOTAL = 10;

export default function LealtadScreen() {
  const { session } = useAuth();
  // Arranca en false y solo se prende cuando la consulta contestó que
  // sí: prometerle un panel a quien no tiene programa es peor que no
  // ofrecerlo. Sin sesión ni siquiera se consulta —la tarjeta se
  // esconde en el render—, y al cambiar de cuenta el efecto vuelve a
  // correr y la reescribe.
  const [tienePrograma, setTienePrograma] = useState(false);

  useEffect(() => {
    if (!session) return;
    let vigente = true;
    void (async () => {
      // La MISMA consulta que hace el perfil (`pantallas/perfil.tsx`) y
      // que hace /cuenta en la web: con un negocio con el add-on activo
      // alcanza — el panel resuelve solo cuál se administra.
      const { data: negocios } = await supabase
        .from("ranchos")
        .select("id")
        .eq("owner_id", session.user.id);
      const ids = (negocios ?? []).map((n) => n.id as string);
      if (ids.length === 0) {
        if (vigente) setTienePrograma(false);
        return;
      }
      const { data: conLealtad } = await supabase
        .from("addons_negocio")
        .select("rancho_id")
        .in("rancho_id", ids)
        .eq("addon", "lealtad")
        .eq("activo", true)
        .limit(1);
      if (vigente) setTienePrograma((conLealtad ?? []).length > 0);
    })();
    return () => {
      vigente = false;
    };
  }, [session]);

  function abrirPanel() {
    void WebBrowser.openBrowserAsync(`${SITIO_URL}${RUTA_PANEL}`);
  }

  function abrirInfo() {
    void WebBrowser.openBrowserAsync(`${SITIO_URL}${RUTA_INFO}`);
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Bookea Lealtad" subtitulo="Clientes que vuelven" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ---------- El acceso al panel, arriba de todo ----------
            Quien ya tiene el programa no viene a que le expliquen qué
            es: viene a entrar. Por eso va antes del hero. */}
        {session !== null && tienePrograma && (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Abrir el panel de tu programa de lealtad en bookea.lat"
            onPress={abrirPanel}
            style={({ pressed }) => [styles.tarjetaPanel, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.panelIcono}>
              <Ionicons name="ribbon" size={20} color={Colors.navy} />
            </View>
            <View style={styles.panelCuerpo}>
              <Text style={styles.panelTitulo}>Tu programa está activo</Text>
              <Text style={styles.panelTexto}>
                Sellos, canjes, pases y métricas se administran en bookea.lat —
                el panel todavía no tiene versión nativa.
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={Colors.inkSoft} />
          </Pressable>
        )}

        {/* ---------- Hero navy ---------- */}
        {/* Sin botón: el hero explica, no vende. El único camino que
            sale de acá es el link informativo del final. */}
        <View style={styles.hero}>
          <View style={styles.orbe} />
          <View style={styles.kicker}>
            <Ionicons name="sparkles" size={13} color={Colors.accent} />
            <Text style={styles.kickerTexto}>Bookea Lealtad</Text>
          </View>
          <Text style={styles.heroTitulo}>Que tus clientes vuelvan — y lo sientan</Text>
          <Text style={styles.heroTexto}>
            El programa de clientes frecuentes para tu restaurante, café o
            salón: sellos y puntos digitales, la tarjeta vive en el teléfono,
            y el canje es un escaneo de QR en el local.
          </Text>
        </View>

        {/* ---------- La tarjeta de sellos, protagonista ---------- */}
        <View style={styles.bloqueNaranja}>
          <View style={styles.tarjetaWallet}>
            <View style={styles.walletEncabezado}>
              <Text style={styles.walletNegocio}>Café La Esquina</Text>
              <Ionicons name="ellipse" size={12} color={Colors.accent} />
            </View>
            <Text style={styles.walletRotulo}>Cliente frecuente</Text>

            <View style={styles.sellos}>
              {Array.from({ length: SELLOS_TOTAL }, (_, i) => (
                <View
                  key={i}
                  style={[styles.sello, i < SELLOS_LLENOS ? styles.selloLleno : styles.selloVacio]}
                >
                  {i < SELLOS_LLENOS && (
                    <Ionicons name="checkmark" size={12} color="#ffffff" />
                  )}
                </View>
              ))}
            </View>

            <Text style={styles.walletPie}>
              {SELLOS_LLENOS} de {SELLOS_TOTAL} sellos —{" "}
              <Text style={styles.walletPieAccent}>
                ¡te faltan {SELLOS_TOTAL - SELLOS_LLENOS} para tu café gratis!
              </Text>
            </Text>
          </View>
          <Text style={styles.bloqueNaranjaPie}>
            Funciona en Apple Wallet y Google Wallet — sin apps que instalar
          </Text>
        </View>

        <View style={styles.tarjetaAviso}>
          <View style={styles.avisoIcono}>
            <Ionicons name="heart" size={20} color={Colors.navy} />
          </View>
          <Text style={styles.avisoTexto}>
            <Text style={styles.avisoFuerte}>Se actualiza solo: </Text>
            el cliente suma puntos y su tarjeta cambia en el teléfono al
            instante — sin apps que instalar.
          </Text>
        </View>

        {/* ---------- Cómo funciona ---------- */}
        <View style={styles.bloqueAzul}>
          <Text style={styles.rotuloCentro}>Así de simple</Text>
          <Text style={styles.tituloSeccion}>Tres pasos y la clientela vuelve</Text>
          <View style={styles.pasos}>
            {PASOS.map((p) => (
              <View key={p.paso} style={styles.paso}>
                <View style={styles.pasoNumero}>
                  <Text style={styles.pasoNumeroTexto}>{p.paso}</Text>
                </View>
                <View style={styles.pasoCuerpo}>
                  <Text style={styles.pasoTitulo}>{p.titulo}</Text>
                  <Text style={styles.pasoTexto}>{p.texto}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ---------- Para quién ---------- */}
        <View style={styles.paraQuien}>
          <Text style={styles.rotuloAccent}>Hecho para negocios con clientela que vuelve</Text>
          <View style={styles.chips}>
            {NEGOCIOS.map((n) => (
              <View key={n} style={styles.chip}>
                <Text style={styles.chipTexto}>{n}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ---------- Qué hace ----------
            Ocupa el lugar donde vivían los paquetes. Es la misma
            información útil que la gente iba a buscar ahí —qué se
            puede hacer con el programa— sin lo que no puede estar:
            montos, topes por paquete y botones de compra. */}
        <View style={styles.capacidades}>
          <Text style={styles.rotuloAccent}>Lo que incluye</Text>
          <Text style={styles.tituloSeccion}>Todo lo que necesitás para operarlo</Text>
          <View style={styles.capacidadLista}>
            {CAPACIDADES.map((c) => (
              <View key={c.texto} style={styles.capacidadFila}>
                <View style={styles.capacidadIcono}>
                  <Ionicons name={c.icono} size={15} color={Colors.navy} />
                </View>
                <Text style={styles.capacidadTexto}>{c.texto}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ---------- El link al sitio ----------
            Deliberadamente neutro, igual que el de invitaciones:
            informa DÓNDE está todo, sin precio, sin «contratá» y sin
            urgencia. No es un botón de compra y no debe parecerlo. */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Abrir bookea.lat para ver la información de Bookea Lealtad"
          onPress={abrirInfo}
          style={({ pressed }) => [styles.enlaceSitio, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="globe-outline" size={17} color={Colors.navy} />
          <View style={styles.enlaceCuerpo}>
            <Text style={styles.enlaceSitioTitulo}>
              Bookea Lealtad se administra en bookea.lat
            </Text>
            <Text style={styles.enlaceSitioTexto}>
              Ahí encontrás toda la información del programa de clientes
              frecuentes.
            </Text>
          </View>
          <Ionicons name="open-outline" size={15} color={Colors.inkSoft} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  scroll: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },

  // ---- El acceso al panel ----
  tarjetaPanel: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  panelIcono: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.md,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  panelCuerpo: { flex: 1, minWidth: 0 },
  panelTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 14.5 },
  panelTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  // ---- Hero navy ----
  hero: {
    backgroundColor: Colors.navy,
    borderRadius: Radios.xl,
    overflow: "hidden",
    padding: Spacing.four,
  },
  orbe: {
    backgroundColor: "rgba(47,74,148,0.55)",
    borderRadius: 130,
    height: 220,
    position: "absolute",
    right: -80,
    top: -90,
    width: 220,
  },
  kicker: { alignItems: "center", flexDirection: "row", gap: 6 },
  kickerTexto: {
    color: Colors.accent,
    fontFamily: Fonts.extraBold,
    fontSize: 10.5,
    letterSpacing: 1.9,
    textTransform: "uppercase",
  },
  heroTitulo: {
    color: "#ffffff",
    fontFamily: Fonts.extraBold,
    fontSize: 28,
    letterSpacing: -0.8,
    lineHeight: 33,
    marginTop: Spacing.three,
  },
  heroTexto: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: Fonts.medium,
    fontSize: 14,
    lineHeight: 21,
    marginTop: Spacing.two,
  },

  // ---- La tarjeta de sellos ----
  bloqueNaranja: {
    backgroundColor: Colors.sky,
    borderRadius: Radios.xl,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  tarjetaWallet: {
    backgroundColor: Colors.surface,
    borderRadius: Radios.lg,
    padding: Spacing.three,
    ...Sombras.elevada,
  },
  walletEncabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  walletNegocio: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 12.5 },
  walletRotulo: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: "uppercase",
  },
  // Cinco por fila, como el grid de la web.
  sellos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.two,
  },
  sello: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: Radios.full,
    flexBasis: "17%",
    justifyContent: "center",
  },
  selloLleno: { backgroundColor: Colors.sky },
  selloVacio: {
    borderColor: Colors.line,
    borderStyle: "dashed",
    borderWidth: 2,
  },
  walletPie: {
    color: Colors.ink,
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    marginTop: Spacing.three,
  },
  walletPieAccent: { color: Colors.accent },
  bloqueNaranjaPie: {
    color: "#ffffff",
    fontFamily: Fonts.extraBold,
    fontSize: 13,
    textAlign: "center",
  },

  // ---- "Se actualiza solo" ----
  tarjetaAviso: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  avisoIcono: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.md,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  avisoTexto: {
    color: Colors.inkSoft,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  avisoFuerte: { color: Colors.ink, fontFamily: Fonts.extraBold },

  // ---- Cómo funciona ----
  bloqueAzul: {
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.xl,
    padding: Spacing.four,
  },
  rotuloCentro: {
    color: Colors.navy,
    fontFamily: Fonts.extraBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textAlign: "center",
    textTransform: "uppercase",
  },
  rotuloAccent: {
    color: Colors.accent,
    fontFamily: Fonts.extraBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textAlign: "center",
    textTransform: "uppercase",
  },
  tituloSeccion: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 23,
    letterSpacing: -0.6,
    marginTop: Spacing.two,
    textAlign: "center",
  },
  // En el teléfono los tres pasos se leen mejor en fila vertical con el
  // número al lado que como tres columnas apretadas.
  pasos: { gap: Spacing.two, marginTop: Spacing.four },
  paso: {
    backgroundColor: Colors.surface,
    borderRadius: Radios.lg,
    flexDirection: "row",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  pasoNumero: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: Radios.full,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  pasoNumeroTexto: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 15 },
  pasoCuerpo: { flex: 1, gap: 3 },
  pasoTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  pasoTexto: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5, lineHeight: 18 },

  // ---- Para quién ----
  paraQuien: { gap: Spacing.three, paddingVertical: Spacing.two },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    justifyContent: "center",
  },
  chip: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5 },

  // ---- Lo que incluye ----
  capacidades: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.xl,
    borderWidth: 1,
    padding: Spacing.four,
  },
  capacidadLista: { gap: Spacing.two, marginTop: Spacing.four },
  capacidadFila: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  capacidadIcono: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.full,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  capacidadTexto: {
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },

  // ---- El link al sitio: peso visual de nota, no de botón ----
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
  enlaceCuerpo: { flex: 1, minWidth: 0 },
  enlaceSitioTitulo: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13.5 },
  enlaceSitioTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
});
