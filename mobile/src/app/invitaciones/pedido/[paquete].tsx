import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import {
  TIPOS_EVENTO,
  montoEnColones,
  precioPaquete,
  resolverPaquete,
} from "@/lib/paquetes-invitaciones";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/**
 * Los datos que el diseñador necesita para armar la invitación —
 * espejo de src/app/invitaciones/pedido/[paquete] en la web.
 *
 * Solo cuatro campos son obligatorios (tipo, nombre, fecha y
 * contacto): el resto se completa después por el chat. Pedirlo todo
 * de golpe, en un teléfono, espantaría a medio mundo.
 *
 * El pedido NO se inserta desde acá: va a /api/invitaciones/pedido con
 * el token de la sesión. El precio lo resuelve el servidor a partir
 * del id del paquete — si el teléfono mandara el monto, nada impediría
 * pagar ₡100 por el paquete Plus.
 */

const IDIOMAS: { id: string; label: string }[] = [
  { id: "es", label: "Español" },
  { id: "en", label: "Inglés" },
  { id: "bilingue", label: "Bilingüe (español e inglés)" },
];

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default function PedidoInvitacionScreen() {
  const { paquete: paqueteId } = useLocalSearchParams<{ paquete: string }>();
  const router = useRouter();
  const { session, perfil } = useAuth();

  const paquete = resolverPaquete(String(paqueteId ?? ""));

  // La fiesta
  const [tipoEvento, setTipoEvento] = useState("");
  const [nombreEvento, setNombreEvento] = useState("");
  const [fechaEvento, setFechaEvento] = useState("");
  const [hora, setHora] = useState("");
  const [anfitriones, setAnfitriones] = useState("");
  const [cantidadInvitados, setCantidadInvitados] = useState("");
  // El lugar
  const [lugarNombre, setLugarNombre] = useState("");
  const [lugarDireccion, setLugarDireccion] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  // El estilo
  const [tematica, setTematica] = useState("");
  const [colores, setColores] = useState("");
  const [idioma, setIdioma] = useState("es");
  const [mensaje, setMensaje] = useState("");
  // El contacto
  const [contactoNombre, setContactoNombre] = useState(perfil?.nombre ?? "");
  const [contactoWhatsapp, setContactoWhatsapp] = useState("");
  const [contactoCorreo, setContactoCorreo] = useState(session?.user.email ?? "");

  const [tipoAbierto, setTipoAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!paquete) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Pedido" />
        <View style={styles.centro}>
          <Text style={styles.vacio}>Ese paquete no existe.</Text>
        </View>
      </View>
    );
  }

  const colones = montoEnColones(paquete);

  async function enviar() {
    setError(null);

    if (!tipoEvento) return setError("Elegí el tipo de evento");
    if (!nombreEvento.trim()) return setError("Contanos cómo se llama tu evento");
    if (!ES_FECHA.test(fechaEvento.trim())) {
      return setError("La fecha del evento va como 2026-12-24");
    }
    if (!contactoNombre.trim()) return setError("Necesitamos tu nombre para contactarte");
    if (!contactoCorreo.includes("@")) return setError("Necesitamos un correo válido");

    const token = session?.access_token;
    if (!token) {
      router.push("/cuenta" as never);
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await fetch(`${SITIO_URL}/api/invitaciones/pedido`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paquete: paquete!.id,
          datos: {
            tipo_evento: tipoEvento,
            nombre_evento: nombreEvento.trim(),
            anfitriones: anfitriones.trim(),
            fecha_evento: fechaEvento.trim(),
            hora: hora.trim(),
            lugar_nombre: lugarNombre.trim(),
            lugar_direccion: lugarDireccion.trim(),
            maps_url: mapsUrl.trim(),
            tematica: tematica.trim(),
            colores: colores.trim(),
            cantidad_invitados: cantidadInvitados.trim(),
            fecha_limite_confirmacion: fechaLimite.trim(),
            mensaje: mensaje.trim(),
            idioma,
            contacto_nombre: contactoNombre.trim(),
            contacto_whatsapp: contactoWhatsapp.trim(),
            contacto_correo: contactoCorreo.trim(),
          },
        }),
      });

      const cuerpo = (await respuesta.json()) as { ok?: boolean; error?: string; pedidoId?: string };
      if (!respuesta.ok || !cuerpo.ok || !cuerpo.pedidoId) {
        setError(cuerpo.error ?? "No pudimos guardar tu pedido. Intentá de nuevo.");
        return;
      }

      // `replace`: volver desde el pago no debe traer de vuelta un
      // formulario que ya se envió.
      router.replace(`/invitaciones/pago/${cuerpo.pedidoId}` as never);
    } catch {
      setError("No hay conexión con Bookea. Revisá tu internet y probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Tu pedido" subtitulo={`Invitación ${paquete.nombre}`} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Lo que está comprando, siempre a la vista */}
        <View style={styles.resumen}>
          <Text style={styles.resumenPaso}>Paso 1 de 2 · Tu pedido</Text>
          <Text style={styles.resumenTitulo}>
            Invitación {paquete.nombre} <Text style={styles.resumenPrecio}>{paquete.etiqueta}</Text>
          </Text>
          <Text style={styles.resumenDetalle}>
            {paquete.precioUSD !== null
              ? `≈${precioPaquete(colones)} · pagás en colones por SINPE o transferencia`
              : "Pago único por evento"}
            {paquete.tienePanel
              ? " · incluye panel de confirmaciones"
              : " · confirmaciones por WhatsApp"}
          </Text>
        </View>

        <Bloque titulo="Tu fiesta">
          <Campo etiqueta="Tipo de evento" requerido>
            <Pressable style={styles.selector} onPress={() => setTipoAbierto(true)}>
              <Text style={[styles.selectorTexto, !tipoEvento && styles.selectorVacio]}>
                {tipoEvento || "Elegí una opción"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={Colors.inkSoft} />
            </Pressable>
          </Campo>

          <Campo etiqueta="¿Cómo se llama?" requerido ayuda="Ej: Los 15 de Sofía">
            <Entrada value={nombreEvento} onChangeText={setNombreEvento} placeholder="Los 15 de Sofía" maxLength={160} />
          </Campo>

          <Campo etiqueta="Fecha del evento" requerido ayuda="Año-mes-día, ej: 2026-12-24">
            <Entrada
              value={fechaEvento}
              onChangeText={setFechaEvento}
              placeholder="2026-12-24"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </Campo>

          <Campo etiqueta="Hora" ayuda="Ej: 6:00 p. m.">
            <Entrada value={hora} onChangeText={setHora} placeholder="6:00 p. m." maxLength={20} />
          </Campo>

          <Campo etiqueta="Anfitriones" ayuda="Los nombres que van en la invitación">
            <Entrada
              value={anfitriones}
              onChangeText={setAnfitriones}
              placeholder="Familia Vargas Solís"
              maxLength={200}
            />
          </Campo>

          <Campo etiqueta="Cantidad de invitados (aprox.)">
            <Entrada
              value={cantidadInvitados}
              onChangeText={setCantidadInvitados}
              placeholder="80"
              keyboardType="number-pad"
              maxLength={5}
            />
          </Campo>
        </Bloque>

        <Bloque titulo="El lugar">
          <Campo etiqueta="Nombre del lugar">
            <Entrada
              value={lugarNombre}
              onChangeText={setLugarNombre}
              placeholder="Hacienda La Ceiba"
              maxLength={160}
            />
          </Campo>
          <Campo etiqueta="Dirección o señas">
            <Entrada
              value={lugarDireccion}
              onChangeText={setLugarDireccion}
              placeholder="Alajuela, 500 m norte de..."
              maxLength={300}
            />
          </Campo>
          <Campo etiqueta="Link de Google Maps" ayuda="Opcional — así tus invitados llegan de un toque">
            <Entrada
              value={mapsUrl}
              onChangeText={setMapsUrl}
              placeholder="https://maps.app.goo.gl/..."
              keyboardType="url"
              autoCapitalize="none"
              maxLength={500}
            />
          </Campo>
          <Campo etiqueta="Confirmar antes del" ayuda="La fecha límite del RSVP (2026-12-01)">
            <Entrada
              value={fechaLimite}
              onChangeText={setFechaLimite}
              placeholder="2026-12-01"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </Campo>
        </Bloque>

        <Bloque titulo="El estilo">
          <Campo etiqueta="Temática" ayuda="Ej: safari, princesas, minimalista, gala">
            <Entrada
              value={tematica}
              onChangeText={setTematica}
              placeholder="Elegante en dorado y marfil"
              maxLength={200}
            />
          </Campo>
          <Campo etiqueta="Colores">
            <Entrada
              value={colores}
              onChangeText={setColores}
              placeholder="Dorado, marfil y verde olivo"
              maxLength={160}
            />
          </Campo>
          <Campo etiqueta="Idioma de la invitación">
            <View style={styles.opciones}>
              {IDIOMAS.map((i) => (
                <Pressable
                  key={i.id}
                  onPress={() => setIdioma(i.id)}
                  style={[styles.opcion, idioma === i.id && styles.opcionActiva]}
                >
                  <Text style={[styles.opcionTexto, idioma === i.id && styles.opcionTextoActiva]}>
                    {i.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Campo>
          <Campo
            etiqueta="Contanos lo que soñás"
            ayuda="Detalles, dedicatoria, código de vestimenta, lo que quieras que lleve"
          >
            <Entrada
              value={mensaje}
              onChangeText={setMensaje}
              placeholder="Queremos algo romántico, con una foto de nosotros y cuenta regresiva..."
              multiline
              maxLength={1200}
            />
          </Campo>
        </Bloque>

        <Bloque titulo="¿Con quién hablamos?">
          <Campo etiqueta="Tu nombre" requerido>
            <Entrada value={contactoNombre} onChangeText={setContactoNombre} maxLength={120} />
          </Campo>
          <Campo etiqueta="WhatsApp">
            <Entrada
              value={contactoWhatsapp}
              onChangeText={setContactoWhatsapp}
              placeholder="8888 8888"
              keyboardType="number-pad"
              maxLength={40}
            />
          </Campo>
          <Campo etiqueta="Correo" requerido>
            <Entrada
              value={contactoCorreo}
              onChangeText={setContactoCorreo}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={160}
            />
          </Campo>
        </Bloque>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.botonEnviar} disabled={enviando} onPress={enviar}>
          {enviando ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.botonEnviarTexto}>Continuar al pago →</Text>
          )}
        </Pressable>
        <Text style={styles.notaPie}>
          Todavía no se cobra nada: en el siguiente paso elegís cómo pagar.
        </Text>
      </ScrollView>

      {/* El tipo de evento: en móvil una hoja de abajo, no un <select>. */}
      <Modal
        visible={tipoAbierto}
        transparent
        animationType="slide"
        onRequestClose={() => setTipoAbierto(false)}
      >
        <Pressable style={styles.hojaFondo} onPress={() => setTipoAbierto(false)}>
          <Pressable style={styles.hoja} onPress={(e) => e.stopPropagation()}>
            <View style={styles.hojaEncabezado}>
              <Text style={styles.hojaTitulo}>Tipo de evento</Text>
              <Pressable onPress={() => setTipoAbierto(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={Colors.ink} />
              </Pressable>
            </View>
            <ScrollView>
              {TIPOS_EVENTO.map((t) => (
                <Pressable
                  key={t}
                  style={styles.hojaFila}
                  onPress={() => {
                    setTipoEvento(t);
                    setTipoAbierto(false);
                  }}
                >
                  <Text style={styles.hojaFilaTexto}>{t}</Text>
                  {tipoEvento === t && (
                    <Ionicons name="checkmark" size={18} color={Colors.accent} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Un grupo de campos con su rótulo naranja, como el fieldset de la web. */
function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.bloque}>
      <Text style={styles.bloqueTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

function Campo({
  etiqueta,
  ayuda,
  requerido,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoEtiqueta}>
        {etiqueta}
        {requerido && <Text style={styles.campoAsterisco}> *</Text>}
      </Text>
      {children}
      {ayuda && <Text style={styles.campoAyuda}>{ayuda}</Text>}
    </View>
  );
}

function Entrada(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={Colors.inkMuted}
      style={[styles.input, props.multiline && styles.inputMultilinea]}
    />
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center", padding: Spacing.four },
  vacio: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 14 },
  scroll: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },

  resumen: {
    backgroundColor: Colors.navy,
    borderRadius: Radios.lg,
    padding: Spacing.three,
  },
  resumenPaso: {
    color: "#f5b98a",
    fontFamily: Fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  resumenTitulo: {
    color: "#ffffff",
    fontFamily: Fonts.extraBold,
    fontSize: 20,
    letterSpacing: -0.4,
    marginTop: 5,
  },
  resumenPrecio: { color: Colors.accent },
  resumenDetalle: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  bloque: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  bloqueTitulo: {
    color: Colors.accent,
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  campo: { gap: 5 },
  campoEtiqueta: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13 },
  campoAsterisco: { color: Colors.accent },
  campoAyuda: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, lineHeight: 16 },
  input: {
    backgroundColor: Colors.surface,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === "ios" ? 12 : 9,
  },
  inputMultilinea: { minHeight: 90, textAlignVertical: "top" },

  selector: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  selectorTexto: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 14 },
  selectorVacio: { color: Colors.inkMuted },

  opciones: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  opcion: {
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.full,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  opcionActiva: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  opcionTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12.5 },
  opcionTextoActiva: { color: "#ffffff" },

  error: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    color: Colors.danger,
    fontFamily: Fonts.bold,
    fontSize: 13,
    padding: Spacing.three,
  },
  botonEnviar: {
    alignItems: "center",
    backgroundColor: Colors.accent,
    borderRadius: Radios.full,
    paddingVertical: 15,
  },
  botonEnviarTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },
  notaPie: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12,
    textAlign: "center",
  },

  hojaFondo: { backgroundColor: "rgba(10,16,32,0.45)", flex: 1, justifyContent: "flex-end" },
  hoja: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radios.xl,
    borderTopRightRadius: Radios.xl,
    maxHeight: "70%",
    padding: Spacing.three,
  },
  hojaEncabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: Spacing.two,
  },
  hojaTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 17 },
  hojaFila: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  hojaFilaTexto: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 14.5 },
});
