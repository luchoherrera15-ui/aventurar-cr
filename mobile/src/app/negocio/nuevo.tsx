import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { decode as decodeBase64 } from "base64-arraybuffer";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import {
  CANTONES,
  CATEGORIA_LABEL,
  CATEGORIAS,
  PROVINCIAS,
  SUBCATEGORIAS,
  type Categoria,
  type Provincia,
} from "@/lib/types";
import { CATEGORIAS_CITAS, CATEGORIA_CITA_LABEL } from "@/lib/citas";
import { CATEGORIAS_HOSPEDAJES, CATEGORIA_HOSPEDAJE_LABEL } from "@/lib/hospedajes";

type Vertical = "eventos" | "citas" | "hospedajes";

/** Las tres cards del selector — espejo de /mi-rancho/nuevo en la web. */
const VERTICALES: {
  id: Vertical;
  titulo: string;
  detalle: string;
  icono: "sparkles-outline" | "time-outline" | "home-outline";
}[] = [
  {
    id: "eventos",
    titulo: "Eventos",
    detalle: "Salones, catering, música, decoración — lo que se contrata para un evento.",
    icono: "sparkles-outline",
  },
  {
    id: "citas",
    titulo: "Citas y Reservas",
    detalle: "Belleza, barbería, spa, consultorio — atendés con cita por hora.",
    icono: "time-outline",
  },
  {
    id: "hospedajes",
    titulo: "Hospedajes",
    detalle: "Casa, villa, hotel, cabaña — recibís huéspedes por estadía.",
    icono: "home-outline",
  },
];

/**
 * Alta de un servicio o lugar desde la app — el mismo flujo que
 * /mi-rancho/nuevo en la web: queda "pendiente" hasta que el equipo lo
 * apruebe. El slug se genera igual que en la web (nombre limpio, y si
 * ya existe se numera) para que el portal tenga URL corta desde el
 * primer día.
 */

function slugificar(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

async function generarSlugUnico(nombre: string) {
  const base = slugificar(nombre);
  if (!base) return null;
  for (let i = 0; i < 10; i++) {
    const candidato = i === 0 ? base : `${base}${i + 1}`;
    const { data } = await supabase
      .from("ranchos")
      .select("id")
      .eq("slug", candidato)
      .maybeSingle();
    if (!data) return candidato;
  }
  return null;
}

export default function NuevoNegocioScreen() {
  const router = useRouter();
  const { session } = useAuth();

  // La vertical se elige primero (selector de 3 cards, como la web) y
  // cada una tiene su propio registro con campos distintos.
  const [vertical, setVertical] = useState<Vertical | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [subcategoria, setSubcategoria] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [provincia, setProvincia] = useState<Provincia | null>(null);
  const [canton, setCanton] = useState<string | null>(null);
  const [direccion, setDireccion] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [precioDesde, setPrecioDesde] = useState("");
  const [capMin, setCapMin] = useState("");
  const [capMax, setCapMax] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificación de identidad: obligatoria antes de publicar.
  const [redSocialUrl, setRedSocialUrl] = useState("");
  const [cedulaFrente, setCedulaFrente] = useState<string | null>(null);
  const [cedulaDorso, setCedulaDorso] = useState<string | null>(null);

  const esEventos = vertical === "eventos";
  const esHospedajes = vertical === "hospedajes";
  // La categoría de eventos válida (para subcategorías).
  const categoriaEvento =
    esEventos && (CATEGORIAS as readonly string[]).includes(categoria ?? "")
      ? (categoria as Categoria)
      : null;
  const esLugar = categoriaEvento === "lugares";
  const conCapacidad = esLugar || esHospedajes;
  const conDireccion = esLugar || !esEventos;
  const verificacionCompleta = !!redSocialUrl.trim() && !!cedulaFrente && !!cedulaDorso;

  async function elegirCedula(lado: "frente" | "dorso") {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos para la cédula.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!resultado.canceled && resultado.assets[0]) {
      (lado === "frente" ? setCedulaFrente : setCedulaDorso)(resultado.assets[0].uri);
    }
  }

  /** Sube una foto local al bucket privado de verificación y devuelve su ruta. */
  async function subirCedula(uri: string, lado: "frente" | "dorso"): Promise<string> {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
    const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
    const path = `solicitudes/${Date.now()}-${lado}.${extension}`;
    const { error: subidaError } = await supabase.storage
      .from("verificacion-proveedores")
      .upload(path, decodeBase64(base64), {
        contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
      });
    if (subidaError) throw new Error(subidaError.message);
    return path;
  }

  async function publicar() {
    setError(null);
    if (!session) {
      router.replace("/cuenta");
      return;
    }
    if (!vertical || !categoria || (esEventos && !subcategoria) || !nombre.trim() || !provincia) {
      setError("Completá al menos qué ofrecés, el nombre y la provincia.");
      return;
    }
    if (!verificacionCompleta) {
      setError(
        "Por seguridad, necesitamos un link de tus redes y tu cédula por ambos lados.",
      );
      return;
    }

    setEnviando(true);

    let rutaFrente: string, rutaDorso: string;
    try {
      rutaFrente = await subirCedula(cedulaFrente!, "frente");
      rutaDorso = await subirCedula(cedulaDorso!, "dorso");
    } catch (e) {
      setEnviando(false);
      setError(
        "No se pudo subir la cédula: " + (e instanceof Error ? e.message : "error desconocido"),
      );
      return;
    }

    const slug = await generarSlugUnico(nombre.trim());
    const { data: nuevoRancho, error: insertError } = await supabase
      .from("ranchos")
      .insert({
        owner_id: session.user.id,
        // La vertical + país/zona horaria: espejo del alta de la web.
        // Arrancamos solo en Costa Rica.
        vertical,
        pais: "CR",
        zona_horaria: "America/Costa_Rica",
        categoria,
        subcategoria: esEventos ? subcategoria : null,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        provincia,
        canton: canton || null,
        direccion_exacta: conDireccion && direccion.trim() ? direccion.trim() : null,
        contacto_whatsapp: whatsapp.trim() || null,
        capacidad_min: esLugar && capMin ? parseInt(capMin) : null,
        capacidad_max: conCapacidad && capMax ? parseInt(capMax) : null,
        precio_desde:
          vertical !== "citas" && precioDesde ? parseFloat(precioDesde) : null,
        estado: "pendiente",
        slug,
      })
      .select("id")
      .single();

    if (insertError || !nuevoRancho) {
      setEnviando(false);
      setError("No se pudo publicar: " + (insertError?.message ?? "error desconocido"));
      return;
    }

    // La gente escribe "www.minegocio.com" sin https:// — se lo ponemos.
    const redSocial = redSocialUrl.trim();
    const { error: verifError } = await supabase.from("verificacion_proveedores").insert({
      rancho_id: nuevoRancho.id,
      red_social_url: /^https?:\/\//i.test(redSocial) ? redSocial : `https://${redSocial}`,
      cedula_frente_url: rutaFrente,
      cedula_dorso_url: rutaDorso,
    });
    setEnviando(false);

    if (verifError) {
      setError(
        "Tu negocio se guardó, pero no se pudo registrar la verificación: " +
          verifError.message +
          ". Escribinos a hola@bookea.lat.",
      );
      return;
    }

    // Quien publica su primer negocio pasa de cliente a dueño — igual
    // que la web; nunca al revés y nunca toca a un admin.
    await supabase
      .from("perfiles")
      .update({ rol: "dueno_rancho" })
      .eq("id", session.user.id)
      .eq("rol", "cliente");

    router.back();
  }

  // Paso 1: elegir la vertical — las mismas tres cards que la web.
  if (!vertical) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Publicar" subtitulo="¿Qué tipo de negocio tenés?" />
        <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
          <Text style={styles.selectorNota}>
            Cada tipo tiene su propio registro — solo te pedimos lo que
            aplica a tu negocio.
          </Text>
          {VERTICALES.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => setVertical(v.id)}
              style={({ pressed }) => [styles.selectorCard, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.selectorIcono}>
                <Ionicons name={v.icono} size={22} color={Colors.navy} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.selectorTitulo}>{v.titulo}</Text>
                <Text style={styles.selectorDetalle}>{v.detalle}</Text>
              </View>
              <Ionicons name="arrow-forward" size={17} color={Colors.accent} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        titulo="Publicar"
        subtitulo={VERTICALES.find((v) => v.id === vertical)?.titulo}
        onVolver={() => {
          // Volver del formulario regresa al selector, no a la pantalla anterior.
          setVertical(null);
          setCategoria(null);
          setSubcategoria(null);
        }}
      />
      <ScrollView
      contentContainerStyle={{ padding: Spacing.four, paddingBottom: 60, gap: Spacing.four }}
    >
      <View style={styles.bloque}>
        <Text style={styles.bloqueTitulo}>
          {esEventos ? "¿Qué ofrecés?" : esHospedajes ? "¿Qué tipo de hospedaje?" : "¿Qué tipo de negocio?"}
        </Text>
        <View style={styles.chips}>
          {(esEventos
            ? CATEGORIAS.map((c) => ({ id: c as string, label: CATEGORIA_LABEL[c] }))
            : esHospedajes
              ? CATEGORIAS_HOSPEDAJES.map((c) => ({ id: c as string, label: CATEGORIA_HOSPEDAJE_LABEL[c] }))
              : CATEGORIAS_CITAS.map((c) => ({ id: c as string, label: CATEGORIA_CITA_LABEL[c] }))
          ).map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                setCategoria(c.id);
                setSubcategoria(null);
              }}
              style={[styles.chip, categoria === c.id && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, categoria === c.id && styles.chipTextoActivo]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {categoriaEvento && (
          <>
            <Text style={styles.campoLabel}>Exactamente qué</Text>
            <View style={styles.chips}>
              {SUBCATEGORIAS[categoriaEvento].map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSubcategoria(s.id)}
                  style={[styles.chip, subcategoria === s.id && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, subcategoria === s.id && styles.chipTextoActivo]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.bloque}>
        <Text style={styles.bloqueTitulo}>Tu negocio</Text>
        <View style={styles.gap2}>
          <Text style={styles.campoLabel}>Nombre</Text>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            placeholder={
              esLugar
                ? "Ej. Rancho Los Almendros"
                : esEventos
                  ? "Ej. DJ Mauricio Eventos"
                  : esHospedajes
                    ? "Ej. Villa Vista al Mar"
                    : "Ej. Barbería La Norteña"
            }
            placeholderTextColor={Colors.inkSoft}
            style={styles.input}
          />
        </View>
        <View style={styles.gap2}>
          <Text style={styles.campoLabel}>Descripción corta</Text>
          <TextInput
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Contá en una o dos líneas qué hacés"
            placeholderTextColor={Colors.inkSoft}
            style={[styles.input, { minHeight: 70 }]}
            multiline
          />
        </View>
        {/* El precio: en eventos es "desde", en hospedajes por noche, y
            en citas no se pide — lo definen los servicios en el panel. */}
        {vertical !== "citas" ? (
          <View style={styles.gap2}>
            <Text style={styles.campoLabel}>
              {esHospedajes ? "Precio por noche desde (₡, opcional)" : "Precio desde (₡, opcional)"}
            </Text>
            <TextInput
              value={precioDesde}
              onChangeText={setPrecioDesde}
              placeholder={esHospedajes ? "Ej. 45000" : "Ej. 150000"}
              placeholderTextColor={Colors.inkSoft}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        ) : (
          <Text style={styles.avisoVerificacion}>
            El precio no se pide acá: lo definen tus servicios (corte,
            manicura, consulta...) cuando los configurés en tu panel.
          </Text>
        )}
        {/* Capacidad: los lugares de eventos piden rango; los hospedajes
            solo el máximo de huéspedes (como Airbnb). */}
        {esLugar && (
          <View style={{ flexDirection: "row", gap: Spacing.two }}>
            <View style={[styles.gap2, { flex: 1 }]}>
              <Text style={styles.campoLabel}>Capacidad mín.</Text>
              <TextInput
                value={capMin}
                onChangeText={setCapMin}
                placeholder="20"
                placeholderTextColor={Colors.inkSoft}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={[styles.gap2, { flex: 1 }]}>
              <Text style={styles.campoLabel}>Capacidad máx.</Text>
              <TextInput
                value={capMax}
                onChangeText={setCapMax}
                placeholder="150"
                placeholderTextColor={Colors.inkSoft}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>
        )}
        {esHospedajes && (
          <View style={styles.gap2}>
            <Text style={styles.campoLabel}>¿Cuántos huéspedes recibís? (máx.)</Text>
            <TextInput
              value={capMax}
              onChangeText={setCapMax}
              placeholder="8"
              placeholderTextColor={Colors.inkSoft}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        )}
        {conDireccion && (
          <View style={styles.gap2}>
            <Text style={styles.campoLabel}>Dirección exacta</Text>
            <TextInput
              value={direccion}
              onChangeText={setDireccion}
              placeholder="Ej. Calle Monge, 200m norte de la iglesia"
              placeholderTextColor={Colors.inkSoft}
              style={styles.input}
            />
          </View>
        )}
        <View style={styles.gap2}>
          <Text style={styles.campoLabel}>WhatsApp de contacto (opcional)</Text>
          <TextInput
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="+506 8888-8888"
            placeholderTextColor={Colors.inkSoft}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.bloque}>
        <Text style={styles.bloqueTitulo}>¿Dónde estás?</Text>
        <View style={styles.chips}>
          {PROVINCIAS.map((p) => (
            <Pressable
              key={p}
              onPress={() => {
                setProvincia(p);
                setCanton(null);
              }}
              style={[styles.chip, provincia === p && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, provincia === p && styles.chipTextoActivo]}>{p}</Text>
            </Pressable>
          ))}
        </View>
        {provincia && (
          <>
            <Text style={styles.campoLabel}>Cantón</Text>
            <View style={styles.chips}>
              {CANTONES[provincia].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCanton(c)}
                  style={[styles.chip, canton === c && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, canton === c && styles.chipTextoActivo]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.bloque}>
        <Text style={styles.bloqueTitulo}>Verificación de tu negocio</Text>
        <Text style={styles.avisoVerificacion}>
          Esto es solo por seguridad: nos ayuda a confirmar que quien
          publica es una persona real y no una empresa fantasma. Tu
          cédula la ve únicamente nuestro equipo de revisión.
        </Text>

        <View style={styles.gap2}>
          <Text style={styles.campoLabel}>Link de tus redes o tu sitio web</Text>
          <TextInput
            value={redSocialUrl}
            onChangeText={setRedSocialUrl}
            placeholder="https://instagram.com/tu_negocio"
            placeholderTextColor={Colors.inkSoft}
            autoCapitalize="none"
            keyboardType="url"
            style={styles.input}
          />
        </View>

        <View style={{ flexDirection: "row", gap: Spacing.two }}>
          <View style={[styles.gap2, { flex: 1 }]}>
            <Text style={styles.campoLabel}>Cédula — frente</Text>
            <Pressable style={styles.zonaCedula} onPress={() => elegirCedula("frente")}>
              {cedulaFrente ? (
                <Image source={{ uri: cedulaFrente }} alt="Cédula, frente" style={styles.previewCedula} />
              ) : (
                <Ionicons name="camera-outline" size={22} color={Colors.inkSoft} />
              )}
            </Pressable>
          </View>
          <View style={[styles.gap2, { flex: 1 }]}>
            <Text style={styles.campoLabel}>Cédula — dorso</Text>
            <Pressable style={styles.zonaCedula} onPress={() => elegirCedula("dorso")}>
              {cedulaDorso ? (
                <Image source={{ uri: cedulaDorso }} alt="Cédula, dorso" style={styles.previewCedula} />
              ) : (
                <Ionicons name="camera-outline" size={22} color={Colors.inkSoft} />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.botonPrimario, (enviando || !verificacionCompleta) && { opacity: 0.6 }]}
        disabled={enviando || !verificacionCompleta}
        onPress={publicar}
      >
        {enviando ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.botonPrimarioTexto}>
            {verificacionCompleta ? "Publicar (queda en revisión)" : "Completá la verificación"}
          </Text>
        )}
      </Pressable>
      <Text style={styles.hint}>
        Tu publicación queda pendiente hasta que el equipo de Bookea la
        apruebe. Las fotos, precios por rangos y demás detalles se completan
        después desde la administración del negocio o el sitio web.
      </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  bloque: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.line,
    gap: Spacing.three,
  },
  bloqueTitulo: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink },
  gap2: { gap: 6 },
  campoLabel: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.inkSoft, textTransform: "uppercase" },
  input: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.ink,
    backgroundColor: Colors.cream,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.cream2,
  },
  chipActivo: { backgroundColor: Colors.navy },
  chipTexto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.inkSoft },
  chipTextoActivo: { color: "#ffffff" },
  error: { color: Colors.danger, fontSize: 13, textAlign: "center" },
  botonPrimario: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  botonPrimarioTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },
  hint: { fontSize: 12, color: Colors.inkSoft, textAlign: "center", lineHeight: 17 },
  avisoVerificacion: { fontSize: 12, color: Colors.inkSoft, lineHeight: 17 },
  zonaCedula: {
    height: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.line,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: Colors.cream,
  },
  previewCedula: { width: "100%", height: "100%" },
  selectorNota: {
    fontSize: 13,
    color: Colors.inkSoft,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: Spacing.two,
  },
  selectorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing.four,
  },
  selectorIcono: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cream2,
  },
  selectorTitulo: { fontSize: 16, fontFamily: Fonts.extraBold, color: Colors.ink },
  selectorDetalle: {
    marginTop: 2,
    fontSize: 12.5,
    color: Colors.inkSoft,
    lineHeight: 17,
  },
});
