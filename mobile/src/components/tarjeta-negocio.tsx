import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Sombras, Spacing, type TonoAccion } from "@/constants/theme";

type IconoNombre = keyof typeof Ionicons.glyphMap;

/** El ancho de una tarjeta dentro de un riel horizontal. */
export const ANCHO_RIEL = 268;

/**
 * La tarjeta de un negocio en cualquier directorio — la misma para un
 * rancho de eventos, un salón de uñas, un restaurante o una villa. Era
 * el componente más duplicado de la app (cuatro copias casi idénticas
 * con estilos que se iban separando); ahora vive una sola vez.
 *
 * La estructura es la del mockup: foto arriba con el rubro rotulado en
 * micro-mayúsculas, cuerpo con nombre y línea de contexto, y un pie
 * separado por línea donde el precio va a la izquierda y la acción —
 * siempre naranja — a la derecha.
 */
export default function TarjetaNegocio({
  nombre,
  foto,
  etiqueta,
  iconoVacio = "image-outline",
  calificacion,
  ubicacion,
  precio,
  sufijoPrecio,
  textoSinPrecio = "Consultar",
  cta = "Reservar",
  tonoCta = "reservar",
  distintivos,
  demo = false,
  ancho = "completo",
  favorito,
  onToggleFavorito,
  onPress,
}: {
  nombre: string;
  foto?: string | null;
  /** El rubro, sobre la foto: "Lugares", "Uñas", "Soda"… */
  etiqueta: string;
  iconoVacio?: IconoNombre;
  calificacion?: { promedio: number; total: number } | null;
  ubicacion?: string | null;
  /** Ya formateado en colones; `null` cae en `textoSinPrecio`. */
  precio?: string | null;
  /** Lo que sigue al monto: "por noche", "por persona"… */
  sufijoPrecio?: string;
  textoSinPrecio?: string;
  cta?: string;
  /** El acento de la vertical (ver `VERTICALES` en theme.ts). */
  tonoCta?: TonoAccion;
  /** Etiquetas de lo que se puede hacer acá ("Reservá mesa"). */
  distintivos?: string[];
  demo?: boolean;
  ancho?: "riel" | "completo";
  favorito?: boolean;
  onToggleFavorito?: () => void;
  onPress: () => void;
}) {
  const esRiel = ancho === "riel";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nombre}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tarjeta,
        esRiel && { width: ANCHO_RIEL },
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={[styles.fotoMarco, esRiel ? styles.fotoRiel : styles.fotoCompleta]}>
        {foto ? (
          <Image
            source={{ uri: foto }}
            alt={nombre}
            style={styles.foto}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.fotoVacia}>
            <Ionicons name={iconoVacio} size={32} color={Colors.blue} />
          </View>
        )}

        <View style={styles.etiqueta}>
          <Text style={styles.etiquetaTexto}>{etiqueta}</Text>
        </View>

        <View style={styles.esquinaDerecha}>
          {demo && (
            <View style={styles.demo}>
              <Text style={styles.demoTexto}>Demo</Text>
            </View>
          )}
          {onToggleFavorito && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={favorito ? "Quitar de favoritos" : "Guardar en favoritos"}
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation();
                onToggleFavorito();
              }}
              style={styles.corazon}
            >
              <Ionicons
                name={favorito ? "heart" : "heart-outline"}
                size={17}
                color={favorito ? Colors.accent : Colors.navy}
              />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.cuerpo}>
        <Text style={styles.nombre} numberOfLines={1}>
          {nombre}
        </Text>

        {/* La línea de contexto del mockup: nota, rubro y zona juntos. */}
        <View style={styles.meta}>
          {calificacion && calificacion.total > 0 ? (
            <>
              <Ionicons name="star" size={11} color={Colors.accent} />
              <Text style={styles.metaFuerte}>
                {calificacion.promedio.toFixed(1).replace(".", ",")}
              </Text>
              <Text style={styles.metaTexto}>({calificacion.total})</Text>
            </>
          ) : (
            <Text style={styles.metaTexto}>Sin reseñas</Text>
          )}
          {!!ubicacion && (
            <Text style={styles.metaTexto} numberOfLines={1}>
              · {ubicacion}
            </Text>
          )}
        </View>

        {!!distintivos?.length && (
          <View style={styles.distintivos}>
            {distintivos.map((d) => (
              <View key={d} style={styles.distintivo}>
                <Text style={styles.distintivoTexto}>{d}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.pie}>
          <Text style={styles.precio} numberOfLines={1}>
            {precio ? (
              <>
                Desde <Text style={styles.precioMonto}>{precio}</Text>
                {sufijoPrecio ? ` ${sufijoPrecio}` : ""}
              </>
            ) : (
              textoSinPrecio
            )}
          </Text>
          <Text
            style={[
              styles.cta,
              { color: tonoCta === "navy" ? Colors.navy : Colors.accent },
            ]}
          >
            {cta} →
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    overflow: "hidden",
    ...Sombras.tarjeta,
  },
  fotoMarco: { backgroundColor: Colors.blueLight },
  fotoRiel: { height: 158 },
  fotoCompleta: { aspectRatio: 16 / 10 },
  foto: { height: "100%", width: "100%" },
  fotoVacia: { alignItems: "center", flex: 1, justifyContent: "center" },

  etiqueta: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 8,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    position: "absolute",
    top: 10,
  },
  etiquetaTexto: {
    color: Colors.navy,
    fontFamily: Fonts.extraBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  esquinaDerecha: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    position: "absolute",
    right: 10,
    top: 10,
  },
  demo: {
    backgroundColor: "#fbbf24",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  demoTexto: {
    color: "#1c1c1c",
    fontFamily: Fonts.extraBold,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  corazon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: Radios.full,
    height: 30,
    justifyContent: "center",
    width: 30,
  },

  cuerpo: { padding: Spacing.three },
  nombre: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 16, letterSpacing: -0.3 },
  meta: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 3 },
  metaFuerte: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12 },
  metaTexto: { color: Colors.inkSoft, flexShrink: 1, fontFamily: Fonts.medium, fontSize: 12 },

  distintivos: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  distintivo: {
    backgroundColor: Colors.blueLight,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  distintivoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 10.5 },

  pie: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "space-between",
    marginTop: 11,
    paddingTop: 10,
  },
  precio: { color: Colors.inkSoft, flex: 1, fontFamily: Fonts.medium, fontSize: 12.5 },
  precioMonto: { color: Colors.ink, fontFamily: Fonts.extraBold },
  cta: { color: Colors.accent, fontFamily: Fonts.extraBold, fontSize: 12.5 },
});
