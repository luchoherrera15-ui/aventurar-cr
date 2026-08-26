import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import TagNuevo from "@/components/tag-nuevo";
import { Colors, Fonts, Radios, Sombras, Spacing } from "@/constants/theme";

type IconoNombre = keyof typeof Ionicons.glyphMap;

/** El ancho de una tarjeta dentro de un riel horizontal. */
export const ANCHO_RIEL = 186;

/**
 * La tarjeta de un negocio en cualquier directorio — la misma para un
 * rancho de eventos, un salón de uñas, un restaurante o una villa. Era
 * el componente más duplicado de la app (cuatro copias casi idénticas
 * con estilos que se iban separando); ahora vive una sola vez.
 *
 * ── LA FORMA: FOTO CUADRADA + PIE BLANCO, TODO MÁS CHICO ───────────
 * La tarjeta blanca se queda (se probó sin ella y se veía peor: el
 * texto suelto sobre el fondo perdía el agrupamiento), pero encogió:
 * foto CUADRADA en vez de apaisada, tipografía chica y un pie de dos
 * renglones sin línea divisoria ni fila de CTA. Así entran bastantes
 * más por pantalla sin que se pierda la unidad visual del card.
 *
 * El precio y el CTA se fusionaron en un solo renglón: en un card de
 * 186px "Desde ₡25.000" y "Reservar →" en extremos opuestos con una
 * línea divisoria era más ruido que información.
 */
export default function TarjetaNegocio({
  nombre,
  foto,
  etiqueta,
  iconoVacio = "image-outline",
  calificacion,
  ubicacion,
  nota,
  distintivos,
  demo = false,
  nuevo = false,
  pausado = false,
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
  /**
   * Una nota corta bajo el nombre: el rango de precio de un
   * restaurante, "Ver el menú", "Precios en línea".
   *
   * Antes se llamaba `textoSinPrecio` y era el respaldo de cuando no
   * había precio. Al sacarse el precio (26 ago 2026) dejó de ser un
   * respaldo y pasó a ser lo único que va en ese renglón — el nombre
   * viejo ya no describía lo que hace.
   */
  nota?: string | null;
  /** Etiquetas de lo que se puede hacer acá ("Reservá mesa"). */
  distintivos?: string[];
  demo?: boolean;
  /** Se registró hace poco: lleva el tag "NUEVO" con su punto verde
   *  (ver `esNegocioNuevo` en components/tag-nuevo.tsx). */
  nuevo?: boolean;
  /**
   * En pausa (`detalles.en_configuracion`): el dueño todavía la está
   * armando. Se sigue viendo en el directorio pero NO se abre — igual
   * que en la web, donde la card queda sin link. Antes el teléfono la
   * abría igual y le entraban reservas a medias.
   */
  pausado?: boolean;
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
      accessibilityState={{ disabled: pausado }}
      disabled={pausado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tarjeta,
        esRiel && { width: ANCHO_RIEL },
        pausado && { opacity: 0.62 },
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
          {pausado && (
            <View style={styles.pausado}>
              <Text style={styles.pausadoTexto}>En configuración</Text>
            </View>
          )}
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

        {/* El tag va ABAJO de la foto, adentro — pedido textual. Es el
            primero del sistema de tags; los que vengan se suman a esta
            misma fila. */}
        {nuevo && !pausado && (
          <View style={styles.tagsFoto}>
            <TagNuevo />
          </View>
        )}
      </View>

      {/* El texto va SUELTO bajo la foto, sin caja blanca ni línea
          divisoria: dos renglones chicos y nada más. */}
      <View style={styles.cuerpo}>
        <Text style={styles.nombre} numberOfLines={1}>
          {nombre}
        </Text>

        {/* Un solo renglón de contexto: nota, zona y precio. Antes
            eran tres bloques (meta, distintivos y un pie con borde)
            que en un card chico no cabían sin apretarse. */}
        <View style={styles.meta}>
          {calificacion && calificacion.total > 0 ? (
            <>
              <Ionicons name="star" size={10} color={Colors.accent} />
              <Text style={styles.metaFuerte}>
                {calificacion.promedio.toFixed(1).replace(".", ",")}
              </Text>
            </>
          ) : null}
          {!!ubicacion && (
            <Text style={styles.metaTexto} numberOfLines={1}>
              {calificacion && calificacion.total > 0 ? "· " : ""}
              {ubicacion}
            </Text>
          )}
        </View>

        {/* ⚠️ ACÁ IBA EL PRECIO. Se sacó a pedido del dueño (26 ago
            2026) junto con el de las tarjetas de la web — la app y el
            sitio tienen que contar lo mismo.

            `precio_desde` es UN número para un negocio que vende muchas
            cosas a precios distintos: en una barbería con veinte
            servicios es el corte más barato, y no dice nada de lo que
            la persona va a pagar. El precio de verdad está en la ficha,
            servicio por servicio.

            El renglón NO desaparece: sigue diciendo "En configuración"
            cuando el negocio está pausado, y sigue mostrando los
            distintivos. */}
        {(pausado || !!nota || !!distintivos?.length) && (
          <Text style={styles.precio} numberOfLines={1}>
            {[pausado ? "En configuración" : null, pausado ? null : nota, ...(distintivos ?? [])]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        )}
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
  // Cuadrada en las dos variantes: es la forma que pidió el dueño y la
  // que mejor aguanta una foto de negocio (un plato, una fachada, una
  // silla de barbería) sin recortar lo importante.
  fotoRiel: { aspectRatio: 1 },
  fotoCompleta: { aspectRatio: 1 },
  foto: { height: "100%", width: "100%" },
  fotoVacia: { alignItems: "center", flex: 1, justifyContent: "center" },
  tagsFoto: {
    bottom: 8,
    flexDirection: "row",
    gap: 5,
    left: 8,
    position: "absolute",
  },

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
  pausado: {
    backgroundColor: Colors.navy,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pausadoTexto: {
    color: "#ffffff",
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

  // El pie blanco, compacto: dos renglones y nada de línea divisoria.
  cuerpo: { paddingHorizontal: Spacing.two + 2, paddingVertical: Spacing.two },
  nombre: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 13.5, letterSpacing: -0.2 },
  meta: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 2 },
  metaFuerte: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 11 },
  metaTexto: { color: Colors.inkSoft, flexShrink: 1, fontFamily: Fonts.medium, fontSize: 11 },
  precio: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 2 },
  precioMonto: { color: Colors.ink, fontFamily: Fonts.extraBold },
});
