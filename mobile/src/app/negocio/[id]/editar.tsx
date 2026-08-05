import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { decode as decodeBase64 } from "base64-arraybuffer";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { CANTONES, FOTOS_MAX, PROVINCIAS, type Provincia } from "@/lib/types";

/**
 * Editar un negocio ya publicado desde el teléfono: los datos que se
 * cambian seguido (nombre, descripción, precio, capacidad, ubicación)
 * y la galería completa de fotos — agregar, eliminar y elegir cuál es
 * la portada, igual que en el sitio web. Rangos de precio y descuentos
 * ya se editan acá mismo (pantalla "Precios"); los horarios de
 * alquiler siguen solo en la web.
 */
export default function EditarNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [cargando, setCargando] = useState(true);
  const [esLugar, setEsLugar] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [descripcionLarga, setDescripcionLarga] = useState("");
  const [precioDesde, setPrecioDesde] = useState("");
  const [capMin, setCapMin] = useState("");
  const [capMax, setCapMax] = useState("");
  const [provincia, setProvincia] = useState<Provincia | null>(null);
  const [canton, setCanton] = useState<string | null>(null);
  const [direccion, setDireccion] = useState("");
  // La galería mezcla URLs ya subidas (http...) con fotos recién
  // elegidas del teléfono (file:...). Las locales se suben al guardar.
  const [galeria, setGaleria] = useState<string[]>([]);
  const [portada, setPortada] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("ranchos")
      .select(
        "nombre, descripcion, descripcion_larga, precio_desde, capacidad_min, capacidad_max, provincia, canton, direccion_exacta, foto_url, fotos, categoria",
      )
      .eq("id", id)
      .maybeSingle();

    if (data) {
      setNombre(data.nombre ?? "");
      setDescripcion(data.descripcion ?? "");
      setDescripcionLarga(data.descripcion_larga ?? "");
      setPrecioDesde(data.precio_desde !== null ? String(data.precio_desde) : "");
      setCapMin(data.capacidad_min !== null ? String(data.capacidad_min) : "");
      setCapMax(data.capacidad_max !== null ? String(data.capacidad_max) : "");
      setProvincia((data.provincia as Provincia | null) ?? null);
      setCanton(data.canton ?? null);
      setDireccion(data.direccion_exacta ?? "");
      setEsLugar(data.categoria === "lugares");

      // Si la portada vive fuera de la galería (pasa con negocios
      // creados desde la web), se le suma para que aparezca en la
      // grilla y se pueda administrar como cualquier otra. El Set
      // limpia cualquier repetida que haya quedado guardada de antes.
      const fotos = Array.from(new Set((data.fotos as string[] | null) ?? []));
      const portadaActual = data.foto_url ?? null;
      setGaleria(
        portadaActual && !fotos.includes(portadaActual)
          ? [portadaActual, ...fotos]
          : fotos,
      );
      setPortada(portadaActual ?? fotos[0] ?? null);
    }
    setCargando(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  async function agregarFotos() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos para agregarlas a la galería.");
      return;
    }
    const cupo = FOTOS_MAX - galeria.length;
    if (cupo <= 0) return;
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: cupo,
    });
    if (resultado.canceled || resultado.assets.length === 0) return;

    const nuevas = resultado.assets.slice(0, cupo).map((a) => a.uri);
    setGaleria((previa) => [...previa, ...nuevas]);
    // El primer negocio sin fotos: la primera que entra es la portada.
    setPortada((actual) => actual ?? nuevas[0]);
  }

  function opcionesDeFoto(foto: string) {
    const esPortada = foto === portada;
    Alert.alert(
      esPortada ? "Foto de portada" : "Foto de la galería",
      "¿Qué querés hacer con esta foto?",
      [
        ...(esPortada
          ? []
          : [{ text: "Usar como portada", onPress: () => setPortada(foto) }]),
        {
          text: "Eliminar",
          style: "destructive" as const,
          onPress: () => {
            setGaleria((previa) => {
              const quedan = previa.filter((f) => f !== foto);
              // Si se fue la portada, la hereda la primera que quede.
              setPortada((actual) => (actual === foto ? (quedan[0] ?? null) : actual));
              return quedan;
            });
          },
        },
        { text: "Cancelar", style: "cancel" as const },
      ],
    );
  }

  /** Sube una foto local del teléfono al bucket y devuelve su URL pública. */
  async function subirFoto(uri: string): Promise<string> {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
    const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const { error: subidaError } = await supabase.storage
      .from("ranchos-fotos")
      .upload(path, decodeBase64(base64), {
        contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
        upsert: true,
      });
    if (subidaError) throw new Error(subidaError.message);
    return supabase.storage.from("ranchos-fotos").getPublicUrl(path).data.publicUrl;
  }

  async function guardar() {
    if (!session) return;
    if (!nombre.trim()) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    setGuardando(true);
    setError(null);

    // Primero las fotos nuevas: si alguna falla, no se toca nada más.
    let fotosFinales: string[];
    let portadaFinal: string | null;
    try {
      const subidas = new Map<string, string>();
      for (const foto of galeria) {
        if (!foto.startsWith("http")) subidas.set(foto, await subirFoto(foto));
      }
      fotosFinales = galeria.map((f) => subidas.get(f) ?? f);
      portadaFinal = portada ? (subidas.get(portada) ?? portada) : (fotosFinales[0] ?? null);
    } catch (e) {
      setGuardando(false);
      setError(
        "No se pudo subir una foto: " + (e instanceof Error ? e.message : "error desconocido"),
      );
      return;
    }

    const { error: guardadoError } = await supabase
      .from("ranchos")
      .update({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        descripcion_larga: descripcionLarga.trim() || null,
        precio_desde: precioDesde ? parseFloat(precioDesde) : null,
        capacidad_min: esLugar && capMin ? parseInt(capMin) : null,
        capacidad_max: esLugar && capMax ? parseInt(capMax) : null,
        provincia,
        canton,
        direccion_exacta: direccion.trim() || null,
        foto_url: portadaFinal,
        fotos: fotosFinales,
      })
      .eq("id", id);

    setGuardando(false);
    if (guardadoError) {
      setError("No se pudo guardar: " + guardadoError.message);
      return;
    }
    router.back();
  }

  if (cargando) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Editar" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Editar" subtitulo={nombre} />
      <ScrollView contentContainerStyle={{ padding: Spacing.four, paddingBottom: 60, gap: Spacing.four }}>
        {/* ---------- Galería ---------- */}
        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Fotos</Text>
          <Text style={styles.hintIzq}>
            Hasta {FOTOS_MAX} fotos. Tocá una para hacerla portada o
            eliminarla — los cambios quedan al guardar.
          </Text>
          <View style={styles.grillaFotos}>
            {galeria.map((foto) => (
              <Pressable
                key={foto}
                style={styles.celdaFoto}
                onPress={() => opcionesDeFoto(foto)}
              >
                <Image
                  source={{ uri: foto }}
                  style={styles.fotoMiniatura}
                  contentFit="cover"
                  alt="Foto del negocio"
                />
                {foto === portada && (
                  <View style={styles.etiquetaPortada}>
                    <Text style={styles.etiquetaPortadaTexto}>Portada</Text>
                  </View>
                )}
                {!foto.startsWith("http") && (
                  <View style={styles.etiquetaNueva}>
                    <Text style={styles.etiquetaPortadaTexto}>Nueva</Text>
                  </View>
                )}
              </Pressable>
            ))}
            {galeria.length < FOTOS_MAX && (
              <Pressable style={[styles.celdaFoto, styles.celdaAgregar]} onPress={agregarFotos}>
                <Ionicons name="add" size={26} color={Colors.inkSoft} />
                <Text style={styles.agregarTexto}>Agregar</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ---------- Datos ---------- */}
        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Datos</Text>
          <Campo label="Nombre" value={nombre} onChangeText={setNombre} />
          <Campo
            label="Descripción corta"
            value={descripcion}
            onChangeText={setDescripcion}
            multilinea
          />
          <Campo
            label="Descripción larga"
            value={descripcionLarga}
            onChangeText={setDescripcionLarga}
            multilinea
            alto
          />
          <Campo
            label="Precio desde (₡)"
            value={precioDesde}
            onChangeText={setPrecioDesde}
            numerico
          />
          {esLugar && (
            <View style={{ flexDirection: "row", gap: Spacing.two }}>
              <View style={{ flex: 1 }}>
                <Campo label="Capacidad mín." value={capMin} onChangeText={setCapMin} numerico />
              </View>
              <View style={{ flex: 1 }}>
                <Campo label="Capacidad máx." value={capMax} onChangeText={setCapMax} numerico />
              </View>
            </View>
          )}
        </View>

        {/* ---------- Ubicación ---------- */}
        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Ubicación</Text>
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
          )}
          <Campo label="Dirección exacta" value={direccion} onChangeText={setDireccion} multilinea />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.botonPrimario, guardando && { opacity: 0.6 }]}
          disabled={guardando}
          onPress={guardar}
        >
          {guardando ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.botonPrimarioTexto}>Guardar cambios</Text>
          )}
        </Pressable>
        <Text style={styles.hint}>
          Los rangos de precio y los descuentos se editan en la
          pantalla &quot;Precios&quot; — los horarios de alquiler, por ahora,
          solo desde el sitio web.
        </Text>
      </ScrollView>
    </View>
  );
}

function Campo({
  label,
  value,
  onChangeText,
  multilinea,
  alto,
  numerico,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multilinea?: boolean;
  alto?: boolean;
  numerico?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.campoLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multilinea}
        keyboardType={numerico ? "numeric" : "default"}
        placeholderTextColor={Colors.inkSoft}
        style={[styles.input, multilinea && { minHeight: alto ? 110 : 70, textAlignVertical: "top" }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  bloque: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.line,
    gap: Spacing.three,
  },
  bloqueTitulo: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink },
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
  grillaFotos: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  celdaFoto: {
    // Tres por fila con el gap de por medio.
    width: "31%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.cream2,
  },
  fotoMiniatura: { width: "100%", height: "100%" },
  celdaAgregar: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.line,
  },
  agregarTexto: { fontSize: 11.5, fontFamily: Fonts.bold, color: Colors.inkSoft },
  etiquetaPortada: {
    position: "absolute",
    left: 6,
    bottom: 6,
    backgroundColor: Colors.navy,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  etiquetaNueva: {
    position: "absolute",
    right: 6,
    top: 6,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  etiquetaPortadaTexto: { color: "#ffffff", fontSize: 10, fontFamily: Fonts.bold },
  hintIzq: { fontSize: 12, color: Colors.inkSoft, lineHeight: 17 },
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
});
