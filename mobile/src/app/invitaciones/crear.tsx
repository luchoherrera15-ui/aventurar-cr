import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/**
 * El asistente conversacional del creador de invitaciones — espejo de
 * src/components/invitaciones-bot.tsx de la web.
 *
 * La persona conversa en sus palabras con el "diseñador" (Claude, vía
 * /api/invitaciones/chat) y cuando hay acuerdo llega el brief final:
 * ahí aparece la tarjeta con el modelo y el botón de generar.
 *
 * Todo el peso vive en el servidor (la generación tarda minutos y
 * gasta tokens reales); el app solo conversa, dispara y espera.
 *
 * Lo que NO está acá y sí en la web: adjuntar fotos y videos al brief,
 * y publicar la invitación al catálogo de vitrina. Lo primero pide un
 * upload multi-archivo que merece su propia pasada; lo segundo es
 * curación interna del equipo y no tiene por qué estar en el teléfono.
 */

type Mensaje = { id: number; de: "bot" | "usuario"; texto: string };

const SALUDO =
  "¡Hola! Soy el diseñador de invitaciones de Bookea. Contame con tus palabras qué invitación necesitás: la ocasión, para quién es, el estilo que te imaginás, colores, lo que sea. Yo te voy proponiendo ideas y cuando estés conforme la generamos.";

const MODELOS: { id: "opus" | "fable"; nombre: string; desc: string }[] = [
  {
    id: "opus",
    nombre: "Opus (Equilibrado)",
    desc: "Excelente calidad a mejor precio. ~$0.05-0.15",
  },
  {
    id: "fable",
    nombre: "Fable (Premium)",
    desc: "Nuestro modelo más capaz — máximo detalle. ~$0.15-0.50",
  },
];

export default function CrearInvitacionScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [mensajes, setMensajes] = useState<Mensaje[]>([{ id: 0, de: "bot", texto: SALUDO }]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [gastoChat, setGastoChat] = useState(0);

  const [promptFinal, setPromptFinal] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("Invitación");
  const [modelo, setModelo] = useState<"opus" | "fable">("opus");

  const [generando, setGenerando] = useState(false);
  /** El slug de la invitación ya generada — dispara la pantalla final. */
  const [slugListo, setSlugListo] = useState<string | null>(null);
  const [direccion, setDireccion] = useState("");
  const [publicando, setPublicando] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const idRef = useRef(1);

  useEffect(() => {
    // La conversación siempre pegada abajo, como cualquier chat.
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [mensajes.length, promptFinal, enviando]);

  function agregar(de: "bot" | "usuario", texto: string) {
    setMensajes((prev) => [...prev, { id: idRef.current++, de, texto }]);
  }

  async function enviar(forzarBrief = false) {
    const texto = forzarBrief
      ? "Listo — generá mi invitación con todo lo que conversamos."
      : input.trim();
    if (!texto || enviando) return;

    const token = session?.access_token;
    if (!token) {
      router.push("/cuenta" as never);
      return;
    }

    setError("");
    if (!forzarBrief) setInput("");
    // La conversación siguió: el brief anterior ya no representa lo
    // que se está hablando, así que la tarjeta se retira.
    setPromptFinal(null);
    agregar("usuario", texto);
    setEnviando(true);

    try {
      // El saludo local (id 0) no viaja: el historial que recibe el
      // API arranca con el primer mensaje de la persona.
      const historial = [...mensajes, { id: -1, de: "usuario" as const, texto }]
        .filter((m) => m.id !== 0)
        .map((m) => ({ rol: m.de === "usuario" ? "usuario" : "asistente", texto: m.texto }));

      const res = await fetch(`${SITIO_URL}/api/invitaciones/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mensajes: historial, forzar_brief: forzarBrief }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "El asistente tuvo un problema; intentá de nuevo");
        // Mantener la alternancia usuario/asistente para el próximo envío.
        agregar("bot", "Perdoná, tuve un problema — ¿me lo repetís?");
      } else {
        if (typeof data.costo_usd === "number") setGastoChat((g) => g + data.costo_usd);
        if (data.respuesta) agregar("bot", data.respuesta);
        if (data.prompt_final) {
          setPromptFinal(data.prompt_final);
          setTitulo(data.titulo || "Invitación");
        }
        if (!data.respuesta && !data.prompt_final) {
          setError("El asistente no devolvió nada; probá de nuevo.");
        }
      }
    } catch {
      setError("No pude contactar al asistente; revisá tu conexión");
      agregar("bot", "Perdoná, tuve un problema — ¿me lo repetís?");
    } finally {
      setEnviando(false);
    }
  }

  /**
   * Los dos pasos de la generación: se crea el borrador y se manda a
   * generar. Tarda minutos — por eso el botón queda en "Generando" y
   * la pantalla no se puede perder de vista.
   */
  async function generar() {
    const token = session?.access_token;
    if (!promptFinal || !token || generando) return;

    setGenerando(true);
    setError("");
    try {
      const resBorrador = await fetch(`${SITIO_URL}/api/invitaciones/generador`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const borrador = await resBorrador.json();
      if (!resBorrador.ok || !borrador.ok) {
        setError(borrador.error || "No pudimos empezar tu invitación.");
        return;
      }

      const resGen = await fetch(`${SITIO_URL}/api/invitaciones/generar-con-ia`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invitacion_id: borrador.invitacionId,
          prompt: promptFinal,
          modelo,
          config_ia: {
            tematica: "",
            personajes: [],
            animaciones: [],
            efectos: [],
            titulo,
            mensaje: "",
          },
        }),
      });
      const generada = await resGen.json();
      if (!resGen.ok || generada.error) {
        setError(generada.error || "La generación falló. Probá de nuevo.");
        return;
      }

      setSlugListo(String(borrador.slug));
      setDireccion("");
    } catch {
      setError("Se cortó la conexión mientras generábamos. Revisá tus invitaciones antes de reintentar.");
    } finally {
      setGenerando(false);
    }
  }

  /** Publica la invitación y, si escribieron una, estrena su dirección. */
  async function publicar(invitacionSlug: string) {
    const token = session?.access_token;
    if (!token || publicando) return;

    setPublicando(true);
    setError("");
    try {
      const res = await fetch(`${SITIO_URL}/api/invitaciones/generador`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invitacionId: invitacionSlug, slug: direccion.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo publicar.");
        return;
      }
      setSlugListo(String(data.slug));
      router.replace("/invitaciones" as never);
    } catch {
      setError("No hay conexión con Bookea.");
    } finally {
      setPublicando(false);
    }
  }

  // ---------- La invitación ya se generó ----------
  if (slugListo) {
    const url = `${SITIO_URL}/i/${slugListo}`;
    return (
      <View style={styles.contenedor}>
        <BarraSuperior
          titulo="Tu invitación está lista"
          onVolver={() => router.replace("/invitaciones" as never)}
        />
        <ScrollView contentContainerStyle={styles.scrollListo}>
          <View style={styles.bloqueNavy}>
            <Ionicons name="sparkles" size={26} color={Colors.accent} />
            <Text style={styles.listoTitulo}>{titulo}</Text>
            <Text style={styles.listoTexto}>
              Ya la generamos. Mirala, y si te gusta publicala para poder
              compartirla con tus invitados.
            </Text>
          </View>

          <Pressable style={styles.botonNavy} onPress={() => void WebBrowser.openBrowserAsync(url)}>
            <Ionicons name="eye-outline" size={16} color="#ffffff" />
            <Text style={styles.botonNavyTexto}>Ver mi invitación</Text>
          </Pressable>

          <View style={styles.bloque}>
            <Text style={styles.bloqueTitulo}>Elegí tu dirección</Text>
            <Text style={styles.bloqueAyuda}>
              Opcional. Así queda: bookea.lat/i/{direccion.trim() || slugListo}
            </Text>
            <TextInput
              value={direccion}
              onChangeText={setDireccion}
              placeholder="losquincedesofia"
              placeholderTextColor={Colors.inkMuted}
              autoCapitalize="none"
              maxLength={60}
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.botonAccent, publicando && styles.botonApagado]}
            disabled={publicando}
            onPress={() => publicar(slugListo)}
          >
            {publicando ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.botonAccentTexto}>Publicar mi invitación</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.botonContorno}
            onPress={() =>
              void Share.share({ message: `Mirá la invitación "${titulo}": ${url}` })
            }
          >
            <Ionicons name="share-social-outline" size={15} color={Colors.navy} />
            <Text style={styles.botonContornoTexto}>Compartir</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ---------- La conversación ----------
  const yaHablo = mensajes.some((m) => m.de === "bot" && m.id !== 0);

  return (
    <KeyboardAvoidingView
      style={styles.contenedor}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <BarraSuperior titulo="Asistente de invitaciones" subtitulo="Contale qué necesitás" />

      {/* Lo gastado conversando, siempre a la vista — cada mensaje
          cuesta tokens reales, igual que en la web. */}
      <View style={styles.gasto}>
        <Text style={styles.gastoRotulo}>Gastado en chat</Text>
        <Text style={styles.gastoMonto}>${gastoChat.toFixed(4)}</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.conversacion}>
        {mensajes.map((m) => (
          <View
            key={m.id}
            style={[styles.burbujaFila, m.de === "usuario" && styles.burbujaFilaDerecha]}
          >
            <View style={[styles.burbuja, m.de === "usuario" ? styles.burbujaMia : styles.burbujaBot]}>
              <Text style={[styles.burbujaTexto, m.de === "usuario" && styles.burbujaTextoMio]}>
                {m.texto}
              </Text>
            </View>
          </View>
        ))}

        {enviando && (
          <View style={styles.burbujaFila}>
            <View style={[styles.burbuja, styles.burbujaBot]}>
              <ActivityIndicator color={Colors.inkSoft} size="small" />
            </View>
          </View>
        )}

        {/* La tarjeta final: modelo + generar */}
        {promptFinal && (
          <View style={styles.tarjetaFinal}>
            <Text style={styles.tarjetaRotulo}>Resumen de tu invitación</Text>
            <Text style={styles.tarjetaTitulo}>{titulo}</Text>
            <Text style={styles.tarjetaBrief} numberOfLines={4}>
              {promptFinal}
            </Text>

            <View style={styles.modelos}>
              {MODELOS.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setModelo(m.id)}
                  disabled={generando}
                  style={[styles.modeloCard, modelo === m.id && styles.modeloCardActiva]}
                >
                  <Text style={styles.modeloNombre}>{m.nombre}</Text>
                  <Text style={styles.modeloDesc}>{m.desc}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.botonAccent, generando && styles.botonApagado]}
              disabled={generando}
              onPress={generar}
            >
              {generando ? (
                <View style={styles.generandoFila}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.botonAccentTexto}>Generando tu invitación...</Text>
                </View>
              ) : (
                <Text style={styles.botonAccentTexto}>Generar invitación</Text>
              )}
            </Pressable>

            <Pressable
              disabled={generando}
              onPress={() => {
                setPromptFinal(null);
                setTitulo("Invitación");
              }}
            >
              <Text style={styles.seguirAjustando}>Seguir ajustando</Text>
            </Pressable>

            {generando && (
              <Text style={styles.avisoGenerando}>
                Esto tarda unos minutos. No cierres la pantalla.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.pie}>
        {/* El botón de cierre: cuando ya hay acuerdo, se genera sin
            esperar a que el asistente lo decida. */}
        {yaHablo && !promptFinal && (
          <Pressable
            style={styles.botonAcuerdo}
            disabled={enviando || generando}
            onPress={() => enviar(true)}
          >
            <Text style={styles.botonAcuerdoTexto}>
              Ya llegamos a un acuerdo — preparar mi invitación
            </Text>
          </Pressable>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.entradaFila}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Quiero una invitación de safari para el cumple de Mateo..."
            placeholderTextColor={Colors.inkMuted}
            editable={!generando}
            multiline
            style={styles.entrada}
          />
          <Pressable
            style={[styles.botonEnviar, (!input.trim() || enviando) && styles.botonApagado]}
            disabled={!input.trim() || enviando || generando}
            onPress={() => enviar()}
          >
            <Ionicons name="arrow-up" size={19} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },

  gasto: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: Colors.navy,
    borderRadius: Radios.full,
    marginBottom: Spacing.two,
    marginRight: Spacing.three,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  gastoRotulo: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: Fonts.bold,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  gastoMonto: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 12.5 },

  conversacion: { gap: Spacing.two, padding: Spacing.three, paddingBottom: Spacing.four },
  burbujaFila: { flexDirection: "row", justifyContent: "flex-start" },
  burbujaFilaDerecha: { justifyContent: "flex-end" },
  burbuja: { borderRadius: Radios.lg, maxWidth: "85%", paddingHorizontal: 14, paddingVertical: 10 },
  burbujaBot: { backgroundColor: Colors.cream2, borderBottomLeftRadius: 4 },
  burbujaMia: { backgroundColor: Colors.navy, borderBottomRightRadius: 4 },
  burbujaTexto: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 13.5, lineHeight: 20 },
  burbujaTextoMio: { color: "#ffffff" },

  tarjetaFinal: {
    backgroundColor: Colors.surface,
    borderColor: Colors.navy,
    borderRadius: Radios.lg,
    borderWidth: 2,
    gap: Spacing.two,
    marginTop: Spacing.two,
    padding: Spacing.three,
  },
  tarjetaRotulo: {
    color: Colors.accent,
    fontFamily: Fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  tarjetaTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  tarjetaBrief: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  modelos: { gap: Spacing.two },
  modeloCard: {
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 2,
    padding: Spacing.two,
  },
  modeloCardActiva: { borderColor: Colors.navy, backgroundColor: Colors.blueLight },
  modeloNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13 },
  modeloDesc: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 2 },
  generandoFila: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  seguirAjustando: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    textAlign: "center",
  },
  avisoGenerando: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    textAlign: "center",
  },

  pie: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  botonAcuerdo: {
    alignItems: "center",
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
    borderRadius: Radios.md,
    borderWidth: 2,
    paddingVertical: 11,
  },
  botonAcuerdoTexto: { color: Colors.accent, fontFamily: Fonts.bold, fontSize: 13 },
  entradaFila: { alignItems: "flex-end", flexDirection: "row", gap: Spacing.two },
  entrada: {
    backgroundColor: Colors.cream,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.md,
    borderWidth: 1,
    color: Colors.ink,
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: 11,
  },
  botonEnviar: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: Radios.md,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  scrollListo: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },
  bloqueNavy: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: Radios.lg,
    gap: Spacing.two,
    padding: Spacing.four,
  },
  listoTitulo: {
    color: "#ffffff",
    fontFamily: Fonts.extraBold,
    fontSize: 21,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  listoTexto: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  bloque: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  bloqueTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  bloqueAyuda: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12 },
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
  botonAccent: {
    alignItems: "center",
    backgroundColor: Colors.accent,
    borderRadius: Radios.full,
    paddingVertical: 14,
  },
  botonAccentTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 14.5 },
  botonApagado: { opacity: 0.5 },
  botonNavy: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: Radios.full,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingVertical: 14,
  },
  botonNavyTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 14.5 },
  botonContorno: {
    alignItems: "center",
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingVertical: 13,
  },
  botonContornoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 13.5 },
});
