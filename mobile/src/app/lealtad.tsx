import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { Colors, Fonts, Radios, Sombras, Spacing } from "@/constants/theme";
import {
  CATALOGO_RESPALDO,
  catalogoInicial,
  refrescarCatalogo,
  type CatalogoConOrigen,
  type PlanLealtad,
} from "@/lib/planes-lealtad";

/**
 * Bookea Lealtad en el app — espejo de /lealtad en la web. Es una
 * landing de venta B2B: le explica al dueño de un negocio qué es el
 * programa de clientes frecuentes, cómo funciona y cuánto cuesta.
 *
 * El bento de la web (bloques de color con esquinas redondas sobre
 * lienzo crema) se traduce a una columna de bloques: en un teléfono
 * los cuatro paquetes son cuatro tarjetas apiladas, y el destacado se
 * distingue por color, no por posición.
 *
 * ------------------------------------------------------------------
 * LOS PRECIOS NO ESTÁN ACÁ, Y ESO ES EL PUNTO
 * ------------------------------------------------------------------
 * Acá vivía el catálogo escrito a mano, con un comentario que pedía
 * mantenerlo al día contra la web. No se mantuvo: esta pantalla llegó
 * a ofrecer un plan gratis PERMANENTE de 50 clientes (son 25, y son 14
 * días), «Lealtad» a ₡12 900 (es Arranque, y son $12) y un paquete
 * «Pro» a ₡24 900 que la web retiró hace dos catálogos. Tres precios
 * falsos publicados en una tienda de aplicaciones.
 *
 * Ahora los paquetes se bajan de `GET /api/lealtad/planes`
 * (`lib/planes-lealtad.ts`), que los saca de la única fuente de verdad
 * —`src/lib/lealtad/planes.ts` de la web— y los deja cacheados. Un
 * precio nuevo llega con un deploy del sitio, sin esperar la revisión
 * de la App Store.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EL CTA SE VA AL NAVEGADOR
 * ------------------------------------------------------------------
 * Antes los dos botones mandaban a `/negocio/nuevo`, que NO puede
 * abrir un programa de lealtad: ofrece eventos, citas y hospedajes, y
 * no tiene ni paquete ni depósito. O sea que la pantalla vendía y
 * después no dejaba comprar.
 *
 * El alta de verdad es `/lealtad/nuevo` en el sitio, y es un camino
 * completo por sí solo: si no hay sesión crea la cuenta ahí mismo,
 * después el negocio, el paquete y el depósito con comprobante.
 * Rehacerlo nativo sería rehacer un flujo de PAGO de una suscripción
 * digital dentro del app, que es justo lo que este proyecto ya decidió
 * no hacer para las invitaciones (ver `lib/paquetes-invitaciones.ts`).
 */

const RUTA_ALTA = "/lealtad/nuevo";
const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/** Cuántas viñetas se ven antes del «ver todo», igual que en la web. */
const VISIBLES = 4;

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

/** Los sellos del mock: 7 de 10 llenos, como en la web. */
const SELLOS_LLENOS = 7;
const SELLOS_TOTAL = 10;

export default function LealtadScreen() {
  // Arranca con el respaldo del bundle para que la sección de paquetes
  // nunca se vea vacía ni salte de alto cuando llega la red.
  const [datos, setDatos] = useState<CatalogoConOrigen>({
    catalogo: CATALOGO_RESPALDO,
    origen: "respaldo",
  });

  useEffect(() => {
    let vigente = true;
    void (async () => {
      // Primero lo que ya está en el teléfono (instantáneo), después
      // lo del sitio. Si la red no contesta, se queda lo primero.
      const guardado = await catalogoInicial();
      if (vigente) setDatos(guardado);
      const fresco = await refrescarCatalogo();
      if (vigente && fresco) setDatos({ catalogo: fresco, origen: "red" });
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const { catalogo, origen } = datos;

  function empezar() {
    void WebBrowser.openBrowserAsync(`${SITIO_URL}${RUTA_ALTA}`);
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Bookea Lealtad" subtitulo="Clientes que vuelven" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ---------- Hero navy ---------- */}
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
          <Pressable style={styles.botonAccent} onPress={empezar}>
            <Text style={styles.botonAccentTexto}>Quiero el programa en mi negocio</Text>
          </Pressable>
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
          {/* Acá abajo, en la nota de precios, esta pantalla decía que
              los pases «están en fase de habilitación — los primeros
              negocios en afiliarse los estrenan». Era falso y además se
              contradecía con esta misma línea: Wallet está en
              producción hace meses (src/lib/wallet, /api/pases,
              /api/pases-google y /api/wallet/v1 en la web). Se sacó, y
              lo que queda lo dice en presente, como la landing. */}
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

        {/* ---------- Paquetes ---------- */}
        {/* El rótulo y el título son los de la web (/lealtad, sección
            «Paquetes»). Antes decían «Precios de lanzamiento» y «Menos
            que un combo al mes»: lo primero dejó de ser cierto hace dos
            catálogos, y lo segundo nunca lo fue para los paquetes de
            arriba. */}
        <View style={styles.precios}>
          <Text style={styles.rotuloAccent}>Paquetes</Text>
          <Text style={styles.tituloSeccion}>Elegí el tamaño de tu programa</Text>
          <Text style={styles.subtituloSeccion}>
            Dejás la solicitud con tu depósito y el equipo de Bookea genera el
            programa y la tarjeta por vos — con tus colores, tu logo y tu
            regalía. Sin contratos ni permanencia mínima.
          </Text>

          <View style={styles.planes}>
            {catalogo.planes.map((plan) => (
              <TarjetaPlan key={plan.id} plan={plan} onEmpezar={empezar} />
            ))}
          </View>

          <Text style={styles.notaPie}>{catalogo.notaPago}</Text>

          {/* El único caso en que los números de arriba podrían estar
              viejos: instalación nueva, sin red y sin nada guardado.
              Se dice, en vez de hacerlos pasar por los de hoy. */}
          {origen === "respaldo" && (
            <Text style={styles.notaSinRed}>
              Sin conexión: estos paquetes son los que traía esta versión del
              app. Confirmalos en bookea.lat/lealtad.
            </Text>
          )}
        </View>

        {/* ---------- Cierre ---------- */}
        <View style={styles.cierre}>
          <View style={styles.orbeCierre} />
          <View style={styles.kicker}>
            <Ionicons name="star" size={13} color={Colors.accent} />
            <Text style={styles.kickerTexto}>Bookea Lealtad</Text>
          </View>
          <Text style={styles.cierreTitulo}>
            Tu competencia reparte tarjetas de cartón. Vos, sellos en el
            teléfono.
          </Text>
          <Pressable style={styles.botonAccent} onPress={empezar}>
            <Text style={styles.botonAccentTexto}>Quiero mi programa de lealtad</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Un paquete del catálogo.
 *
 * Todo lo que pinta viene del endpoint YA ESCRITO —el precio con su
 * moneda, la línea del anual, el cupo de clientes, las viñetas—: esta
 * pantalla no formatea un solo número. Es a propósito. En cuanto acá
 * se decidiera cómo se escribe un monto, habría dos lugares donde un
 * precio puede quedar mal escrito, y uno de los dos vive dentro de un
 * bundle que solo cambia con una versión nueva del app.
 *
 * Muestra CUATRO viñetas y esconde el resto detrás de «ver todo», igual
 * que `paquetes-cliente.tsx` en la web: con las diez de Ilimitado
 * abiertas ninguna tarjeta se puede comparar con la de al lado.
 */
function TarjetaPlan({ plan, onEmpezar }: { plan: PlanLealtad; onEmpezar: () => void }) {
  const [abierto, setAbierto] = useState(false);

  // Con UNA sola de más no se corta: un «ver todo (+1)» que ahorra una
  // línea es más ruido que la línea que esconde.
  const corta = plan.incluye.length > VISIBLES + 1;
  const ocultas = corta ? plan.incluye.length - VISIBLES : 0;
  const lista = corta && !abierto ? plan.incluye.slice(0, VISIBLES) : plan.incluye;

  return (
    <View style={[styles.plan, plan.destacado && styles.planDestacado]}>
      {plan.destacado && <Text style={styles.planCinta}>El más popular</Text>}

      <Text style={[styles.planNombre, plan.destacado && styles.planNombreDestacado]}>
        {plan.nombre}
      </Text>

      <Text style={[styles.planPrecio, plan.destacado && styles.planTextoClaro]}>
        {plan.precio ?? "A convenir"}
        {plan.precio !== null && !plan.esGratis && (
          <Text style={[styles.planPorMes, plan.destacado && styles.planDetalleDestacado]}>
            /mes
          </Text>
        )}
      </Text>

      <Text style={[styles.planDetalle, plan.destacado && styles.planDetalleDestacado]}>
        {plan.notaPrecio}
      </Text>

      {/* El cupo de clientes va destacado y aparte de las viñetas: es
          el número por el que se elige un paquete. */}
      <View style={[styles.planCupo, plan.destacado && styles.planCupoDestacado]}>
        <Text style={[styles.planCupoTexto, plan.destacado && styles.planTextoClaro]}>
          {plan.etiquetaClientes}
        </Text>
      </View>

      <View style={styles.planLista}>
        {lista.map((item) => (
          <View key={item} style={styles.planFila}>
            <View style={[styles.planCheck, plan.destacado && styles.planCheckDestacado]}>
              <Ionicons
                name="checkmark"
                size={10}
                color={plan.destacado ? Colors.accent : Colors.green}
              />
            </View>
            <Text style={[styles.planItem, plan.destacado && styles.planTextoClaro]}>
              {item}
            </Text>
          </View>
        ))}
      </View>

      {ocultas > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAbierto((v) => !v)}
          style={styles.planVerTodo}
        >
          <Text style={[styles.planVerTodoTexto, plan.destacado && styles.planDetalleDestacado]}>
            {abierto ? "Ver menos" : `Ver todo (+${ocultas})`}
          </Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        style={[styles.planBoton, plan.destacado && styles.planBotonDestacado]}
        onPress={onEmpezar}
      >
        <Text style={[styles.planBotonTexto, plan.destacado && styles.planBotonTextoDestacado]}>
          {plan.esGratis ? "Empezar gratis" : plan.precio === null ? "Hablemos" : "Solicitarlo"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  scroll: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },

  // ---- Hero y cierre navy ----
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
  botonAccent: {
    alignItems: "center",
    backgroundColor: Colors.sky,
    borderRadius: 12,
    marginTop: Spacing.four,
    paddingVertical: 15,
  },
  botonAccentTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 14.5 },

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
  subtituloSeccion: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    lineHeight: 20,
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

  // ---- Precios ----
  precios: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.xl,
    borderWidth: 1,
    padding: Spacing.four,
  },
  planes: { gap: Spacing.three, marginTop: Spacing.four },
  plan: {
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    padding: Spacing.three,
  },
  planDestacado: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
    ...Sombras.elevada,
  },
  planNombre: {
    color: Colors.inkSoft,
    fontFamily: Fonts.extraBold,
    fontSize: 11.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  planNombreDestacado: { color: Colors.accent },
  planCinta: {
    color: Colors.accent,
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  planPrecio: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 30,
    letterSpacing: -0.9,
    marginTop: 4,
  },
  planPorMes: { fontFamily: Fonts.bold, fontSize: 12.5 },
  planDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12 },
  planCupo: {
    backgroundColor: Colors.blueLight,
    borderRadius: 8,
    marginTop: Spacing.two,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  planCupoDestacado: { backgroundColor: "rgba(255,255,255,0.1)" },
  planCupoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12 },
  planVerTodo: { alignSelf: "flex-start", marginTop: Spacing.two, paddingVertical: 4 },
  planVerTodoTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bold,
    fontSize: 12,
    textDecorationLine: "underline",
  },
  planDetalleDestacado: { color: "rgba(255,255,255,0.7)" },
  planTextoClaro: { color: "#ffffff" },
  planLista: { gap: Spacing.two, marginTop: Spacing.three },
  planFila: { flexDirection: "row", gap: Spacing.two },
  planCheck: {
    alignItems: "center",
    backgroundColor: Colors.greenLight,
    borderRadius: Radios.full,
    height: 18,
    justifyContent: "center",
    marginTop: 1,
    width: 18,
  },
  planCheckDestacado: { backgroundColor: "rgba(255,255,255,0.15)" },
  planItem: {
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  planBoton: {
    alignItems: "center",
    borderColor: Colors.navy,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.three,
    paddingVertical: 12,
  },
  planBotonDestacado: { backgroundColor: Colors.sky, borderColor: Colors.sky },
  planBotonTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 13.5 },
  planBotonTextoDestacado: { color: "#ffffff" },
  notaPie: {
    color: Colors.inkMuted,
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: Spacing.three,
    textAlign: "center",
  },
  notaSinRed: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: Spacing.two,
    textAlign: "center",
  },

  // ---- Cierre ----
  cierre: {
    backgroundColor: Colors.navy,
    borderRadius: Radios.xl,
    overflow: "hidden",
    padding: Spacing.four,
  },
  orbeCierre: {
    backgroundColor: "rgba(47,74,148,0.55)",
    borderRadius: 120,
    height: 200,
    left: -70,
    position: "absolute",
    top: -80,
    width: 200,
  },
  cierreTitulo: {
    color: "#ffffff",
    fontFamily: Fonts.extraBold,
    fontSize: 23,
    letterSpacing: -0.6,
    lineHeight: 28,
    marginTop: Spacing.three,
  },
});
