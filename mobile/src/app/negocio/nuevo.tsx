import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
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

  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [subcategoria, setSubcategoria] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [provincia, setProvincia] = useState<Provincia | null>(null);
  const [canton, setCanton] = useState<string | null>(null);
  const [precioDesde, setPrecioDesde] = useState("");
  const [capMin, setCapMin] = useState("");
  const [capMax, setCapMax] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esLugar = categoria === "lugares";

  async function publicar() {
    setError(null);
    if (!session) {
      router.replace("/cuenta");
      return;
    }
    if (!categoria || !subcategoria || !nombre.trim() || !provincia) {
      setError("Completá al menos qué ofrecés, el nombre y la provincia.");
      return;
    }

    setEnviando(true);
    const slug = await generarSlugUnico(nombre.trim());
    const { error: insertError } = await supabase.from("ranchos").insert({
      owner_id: session.user.id,
      categoria,
      subcategoria,
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      provincia,
      canton: canton || null,
      capacidad_min: esLugar && capMin ? parseInt(capMin) : null,
      capacidad_max: esLugar && capMax ? parseInt(capMax) : null,
      precio_desde: precioDesde ? parseFloat(precioDesde) : null,
      estado: "pendiente",
      slug,
    });
    setEnviando(false);

    if (insertError) {
      setError("No se pudo publicar: " + insertError.message);
      return;
    }
    router.back();
  }

  return (
    <ScrollView
      style={styles.contenedor}
      contentContainerStyle={{ padding: Spacing.four, paddingBottom: 60, gap: Spacing.four }}
    >
      <View style={styles.bloque}>
        <Text style={styles.bloqueTitulo}>¿Qué ofrecés?</Text>
        <View style={styles.chips}>
          {CATEGORIAS.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setCategoria(c);
                setSubcategoria(null);
              }}
              style={[styles.chip, categoria === c && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, categoria === c && styles.chipTextoActivo]}>
                {CATEGORIA_LABEL[c]}
              </Text>
            </Pressable>
          ))}
        </View>

        {categoria && (
          <>
            <Text style={styles.campoLabel}>Exactamente qué</Text>
            <View style={styles.chips}>
              {SUBCATEGORIAS[categoria].map((s) => (
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
            placeholder="Ej. Rancho Los Almendros"
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
        <View style={styles.gap2}>
          <Text style={styles.campoLabel}>Precio desde (₡, opcional)</Text>
          <TextInput
            value={precioDesde}
            onChangeText={setPrecioDesde}
            placeholder="Ej. 150000"
            placeholderTextColor={Colors.inkSoft}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
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

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.botonPrimario, enviando && { opacity: 0.6 }]}
        disabled={enviando}
        onPress={publicar}
      >
        {enviando ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.botonPrimarioTexto}>Publicar (queda en revisión)</Text>
        )}
      </Pressable>
      <Text style={styles.hint}>
        Tu publicación queda pendiente hasta que el equipo de Bookea la
        apruebe. Las fotos, precios por rangos y demás detalles se completan
        después desde la administración del negocio o el sitio web.
      </Text>
    </ScrollView>
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
