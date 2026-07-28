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
import { CANTONES, PROVINCIAS, type Provincia } from "@/lib/types";

/**
 * Editar un negocio ya publicado desde el teléfono: los datos que se
 * cambian seguido (nombre, descripción, precio, capacidad, ubicación)
 * y la foto de portada. Lo más fino —galería completa, rangos de
 * precio, descuentos, horarios— sigue en el sitio web, que tiene
 * espacio para esos formularios largos.
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
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoNueva, setFotoNueva] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("ranchos")
      .select(
        "nombre, descripcion, descripcion_larga, precio_desde, capacidad_min, capacidad_max, provincia, canton, direccion_exacta, foto_url, categoria",
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
      setFotoUrl(data.foto_url ?? null);
      setEsLugar(data.categoria === "lugares");
    }
    setCargando(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  async function elegirFoto() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos para cambiar la portada.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!resultado.canceled && resultado.assets[0]) {
      setFotoNueva(resultado.assets[0].uri);
    }
  }

  async function guardar() {
    if (!session) return;
    if (!nombre.trim()) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    setGuardando(true);
    setError(null);

    // La foto nueva se sube primero: si falla, no se toca nada más.
    let urlFinal = fotoUrl;
    if (fotoNueva) {
      try {
        const base64 = await FileSystem.readAsStringAsync(fotoNueva, { encoding: "base64" });
        const extension = fotoNueva.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${id}/${Date.now()}-portada.${extension}`;
        const { error: subidaError } = await supabase.storage
          .from("ranchos-fotos")
          .upload(path, decodeBase64(base64), {
            contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
            upsert: true,
          });
        if (subidaError) {
          setGuardando(false);
          setError("No se pudo subir la foto: " + subidaError.message);
          return;
        }
        urlFinal = supabase.storage.from("ranchos-fotos").getPublicUrl(path).data.publicUrl;
      } catch (e) {
        setGuardando(false);
        setError(e instanceof Error ? e.message : "No se pudo procesar la foto.");
        return;
      }
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
        foto_url: urlFinal,
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
        {/* ---------- Portada ---------- */}
        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Foto de portada</Text>
          <Pressable style={styles.zonaFoto} onPress={elegirFoto}>
            {fotoNueva || fotoUrl ? (
              <Image
                source={{ uri: fotoNueva ?? fotoUrl! }}
                style={styles.preview}
                contentFit="cover"
                alt="Portada"
              />
            ) : (
              <View style={styles.fotoVacia}>
                <Ionicons name="image-outline" size={26} color={Colors.inkSoft} />
                <Text style={styles.hint}>Tocá para elegir una foto</Text>
              </View>
            )}
          </Pressable>
          {(fotoNueva || fotoUrl) && (
            <Pressable onPress={elegirFoto}>
              <Text style={styles.cambiarFoto}>Cambiar foto</Text>
            </Pressable>
          )}
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
          La galería de fotos, los rangos de precio, los descuentos y los
          horarios se configuran desde el sitio web.
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
  zonaFoto: { borderRadius: 14, overflow: "hidden", backgroundColor: Colors.cream2 },
  preview: { width: "100%", height: 170 },
  fotoVacia: {
    height: 170,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.line,
    borderRadius: 14,
  },
  cambiarFoto: { textAlign: "center", fontSize: 13, fontFamily: Fonts.bold, color: Colors.navy },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 999,
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
